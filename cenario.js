// cenario.js
import { CHUNK_SIZE, CELL_SIZE, CELLS_PER_CHUNK } from './world-gen.js';

/**
 * Classe auxiliar para definir áreas retangulares na QuadTree.
 */
class QuadRect {
    constructor(x, y, w, h) {
        this.x = x; this.y = y; this.w = w; this.h = h;
    }
    contains(point) {
        return (point.x >= this.x - this.w && point.x <= this.x + this.w &&
                point.y >= this.y - this.h && point.y <= this.y + this.h);
    }
    intersects(range) {
        return !(range.x - range.w > this.x + this.w || range.x + range.w < this.x - this.w ||
                 range.y - range.h > this.y + this.h || range.y + range.h < this.y - this.h);
    }
}

/**
 * Estrutura de dados QuadTree para particionamento espacial.
 */
class QuadTree {
    constructor(boundary, capacity) {
        this.boundary = boundary; // QuadRect
        this.capacity = capacity;
        this.points = [];
        this.divided = false;
    }

    split() {
        let x = this.boundary.x; let y = this.boundary.y;
        let w = this.boundary.w / 2; let h = this.boundary.h / 2;
        this.northwest = new QuadTree(new QuadRect(x - w, y - h, w, h), this.capacity);
        this.northeast = new QuadTree(new QuadRect(x + w, y - h, w, h), this.capacity);
        this.southwest = new QuadTree(new QuadRect(x - w, y + h, w, h), this.capacity);
        this.southeast = new QuadTree(new QuadRect(x + w, y + h, w, h), this.capacity);
        this.divided = true;
    }

    insert(point) {
        if (!this.boundary.contains(point)) return false;
        if (this.points.length < this.capacity) {
            this.points.push(point);
            return true;
        }
        if (!this.divided) this.split();
        return (this.northwest.insert(point) || this.northeast.insert(point) ||
                this.southwest.insert(point) || this.southeast.insert(point));
    }

    query(range, found) {
        if (!found) found = [];
        if (!this.boundary.intersects(range)) return found;
        for (let p of this.points) {
            if (range.contains(p)) found.push(p.data);
        }
        if (this.divided) {
            this.northwest.query(range, found);
            this.northeast.query(range, found);
            this.southwest.query(range, found);
            this.southeast.query(range, found);
        }
        return found;
    }
}

export default class Cenario {
    constructor(scene) {
        this.scene = scene;
        this.cellSize = CELL_SIZE;
        this.gridGraphics = null;
        this.gridVisible = false;
        // Grupos de física: os pedaços do mundo (chunk-manager.js) adicionam e removem os objetos
        this.obstaclesGroup = this.scene.physics.add.staticGroup();
        this.animatedGroup = this.scene.physics.add.group({ immovable: true, allowGravity: false });
        this.highlightGraphics = this.scene.add.graphics().setDepth(999); // Gráfico para o quadrado verde/vermelho
        this.quadTree = null;
        this.oresGroup = this.scene.physics.add.staticGroup();
    }

    /**
     * Reconstrói a QuadTree com as entidades atuais (Players e NPCs).
     * A área acompanha o foco (comandante): o mundo pode ser enorme, e só interessa quem está perto.
     */
    updateQuadTree(entities, focus) {
        const boundary = new QuadRect(focus.x, focus.y, 3500, 2500);
        this.quadTree = new QuadTree(boundary, 4);

        entities.forEach(entity => {
            if (entity.active && entity.health > 0) {
                this.quadTree.insert({ x: entity.x, y: entity.y, data: entity });
            }
        });
    }

    /**
     * Busca entidades em um raio circular usando a QuadTree.
     */
    getEntitiesInRange(x, y, radius) {
        if (!this.quadTree) return [];
        const range = new QuadRect(x, y, radius, radius);
        return this.quadTree.query(range);
    }

    // ---------------------------------------------------------------- debug do grid (tecla G)
    toggleGrid() {
        if (!this.gridGraphics) {
            this.gridGraphics = this.scene.add.graphics().setDepth(1000);
        }
        this.gridVisible = !this.gridVisible;
        this.gridGraphics.setVisible(this.gridVisible);
        if (this.gridVisible) {
            this.drawGrid();
        } else {
            this.gridGraphics.clear();
        }
    }

    /** Desenha as células bloqueadas dos pedaços carregados. Chamado de tempos em tempos enquanto ligado. */
    drawGrid() {
        if (!this.gridGraphics) return;
        this.gridGraphics.clear();
        this.gridGraphics.fillStyle(0xff0000, 0.3);
        this.scene.chunks.loaded.forEach(chunk => {
            const ox = chunk.data.cx * CHUNK_SIZE;
            const oy = chunk.data.cy * CHUNK_SIZE;
            for (let gy = 0; gy < CELLS_PER_CHUNK; gy++) {
                for (let gx = 0; gx < CELLS_PER_CHUNK; gx++) {
                    if (chunk.data.cells[gy * CELLS_PER_CHUNK + gx] === 1) {
                        this.gridGraphics.fillRect(ox + gx * CELL_SIZE, oy + gy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
                    }
                }
            }
            this.gridGraphics.lineStyle(1, 0xffffff, 0.15);
            this.gridGraphics.strokeRect(ox, oy, CHUNK_SIZE, CHUNK_SIZE);
        });
    }

    isWorldPositionBlocked(x, y) {
        return this.scene.chunks.isBlockedAt(x, y);
    }

    /**
     * Verifica se existe uma linha direta sem obstáculos entre dois pontos.
     * @returns {boolean} True se a visão estiver limpa, False se houver obstáculo.
     */
    checkLineOfSight(x1, y1, x2, y2) {
        const chunks = this.scene.chunks;
        if (!chunks) return true;

        const line = new Phaser.Geom.Line(x1, y1, x2, y2);
        // Bresenham: confere apenas as células do grid que a linha atravessa
        const points = Phaser.Geom.Line.BresenhamPoints(line, CELL_SIZE / 2);

        for (const p of points) {
            if (chunks.isCellBlocked(Math.floor(p.x / CELL_SIZE), Math.floor(p.y / CELL_SIZE))) {
                return false;
            }
        }
        return true;
    }

    highlightCell(x, y, isValid) {
        this.highlightGraphics.clear();
        const size = this.cellSize || 50;
        
        // Arredonda para a grade (Snap to grid)
        const cellX = Math.floor(x / size) * size;
        const cellY = Math.floor(y / size) * size;
        
        const color = isValid ? 0x00ff00 : 0xff0000;
        
        this.highlightGraphics.fillStyle(color, 0.3);
        this.highlightGraphics.fillRect(cellX, cellY, size, size);
        this.highlightGraphics.lineStyle(2, color, 0.8);
        this.highlightGraphics.strokeRect(cellX, cellY, size, size);
    }

    clearHighlight() {
        this.highlightGraphics.clear();
    }
}
