/**
 * @class PathManager
 * @description Pathfinding com EasyStar.js, uma requisição por frame.
 * O mundo pode ser enorme, então não existe um grid do mapa inteiro: cada busca monta uma
 * janela de células em volta do trajeto, consultando o ChunkManager (obstáculos de cada pedaço).
 */
const WINDOW_PADDING = 12;   // células de folga em volta do trajeto
const MAX_WINDOW = 120;      // maior lado da janela, em células (6000 px com células de 50)

export default class PathManager {
    /**
     * @param {Phaser.Scene} scene The main game scene.
     * @param {number} cellSize The size of each cell in the grid in pixels.
     */
    constructor(scene, cellSize) {
        this.scene = scene;
        this.cellSize = cellSize;
        this.easystar = new EasyStar.js();
        this.easystar.enableDiagonals(); // Permite movimento diagonal para evitar quinas
        this.easystar.setAcceptableTiles([0]); // 0 é caminhável

        this.requestQueue = [];
        this.isCalculating = false;
    }

    /** Converts world coordinates (pixels) to grid coordinates (cells). */
    worldToGrid(worldX, worldY) {
        return { x: Math.floor(worldX / this.cellSize), y: Math.floor(worldY / this.cellSize) };
    }

    /** Converts grid coordinates to world coordinates (pixels), centering in the cell. */
    gridToWorld(gridX, gridY) {
        return { x: gridX * this.cellSize + this.cellSize / 2, y: gridY * this.cellSize + this.cellSize / 2 };
    }

    /**
     * Queues a pathfinding request. The path will be calculated in a future frame.
     * @param {function(Phaser.Math.Vector2[] | null)} callback Called with the world path or null.
     */
    findPath(startWorldX, startWorldY, endWorldX, endWorldY, callback) {
        this.requestQueue.push({
            start: this.worldToGrid(startWorldX, startWorldY),
            end: this.worldToGrid(endWorldX, endWorldY),
            callback
        });
    }

    /** Monta a janela de células do trajeto. Devolve null se o destino não tem saída. */
    buildWindow(start, end) {
        const chunks = this.scene.chunks;

        let minX = Math.min(start.x, end.x) - WINDOW_PADDING;
        let maxX = Math.max(start.x, end.x) + WINDOW_PADDING;
        let minY = Math.min(start.y, end.y) - WINDOW_PADDING;
        let maxY = Math.max(start.y, end.y) + WINDOW_PADDING;

        // Destino muito longe: a janela fica centrada no início e o destino é preso na borda dela
        if (maxX - minX + 1 > MAX_WINDOW) {
            minX = start.x - MAX_WINDOW / 2;
            maxX = minX + MAX_WINDOW - 1;
        }
        if (maxY - minY + 1 > MAX_WINDOW) {
            minY = start.y - MAX_WINDOW / 2;
            maxY = minY + MAX_WINDOW - 1;
        }

        const grid = [];
        for (let y = minY; y <= maxY; y++) {
            const row = [];
            for (let x = minX; x <= maxX; x++) row.push(chunks.isCellBlocked(x, y) ? 1 : 0);
            grid.push(row);
        }

        const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
        const localStart = { x: clamp(start.x, minX, maxX) - minX, y: clamp(start.y, minY, maxY) - minY };
        let localEnd = { x: clamp(end.x, minX, maxX) - minX, y: clamp(end.y, minY, maxY) - minY };

        // Destino bloqueado (parede, árvore, fora do mundo): usa a célula livre mais próxima
        if (grid[localEnd.y][localEnd.x] !== 0) {
            localEnd = this.findNearestWalkable(grid, localEnd.x, localEnd.y);
            if (!localEnd) return null;
        }

        return { grid, offsetX: minX, offsetY: minY, start: localStart, end: localEnd };
    }

    /** Procura a célula caminhável (0) mais próxima em um raio de busca. */
    findNearestWalkable(grid, gridX, gridY) {
        const height = grid.length;
        const width = grid[0].length;
        const searchRadius = 5;

        for (let r = 1; r <= searchRadius; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const nx = gridX + dx;
                    const ny = gridY + dy;
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height && grid[ny][nx] === 0) {
                        return { x: nx, y: ny };
                    }
                }
            }
        }
        return null;
    }

    /** Chamar no update() da cena: processa uma requisição por frame. */
    update() {
        if (!this.requestQueue.length || this.isCalculating) return;

        const request = this.requestQueue.shift();
        const win = this.buildWindow(request.start, request.end);
        if (!win) {
            request.callback(null);
            return;
        }

        this.isCalculating = true;
        this.easystar.setGrid(win.grid);
        this.easystar.findPath(win.start.x, win.start.y, win.end.x, win.end.y, (path) => {
            this.isCalculating = false;
            const worldPath = path
                ? path.map(p => new Phaser.Math.Vector2(this.gridToWorld(p.x + win.offsetX, p.y + win.offsetY)))
                : null;
            request.callback(worldPath);
        });
        this.easystar.calculate();
    }
}
