// cenario.js

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
        this.grid = null;
        this.gridGraphics = null;
        this.gridVisible = false;
        this.obstacles = [];
        // Inicializa grupos de física para gerenciar colisões
        this.obstaclesGroup = this.scene.physics.add.staticGroup();
        this.animatedGroup = this.scene.physics.add.group({ immovable: true, allowGravity: false });
        this.sceneryGroup = this.scene.add.group(); // Grupo para objetos puramente visuais (sem colisão)
        this.highlightGraphics = this.scene.add.graphics().setDepth(999); // Gráfico para o quadrado verde/vermelho
        this.quadTree = null;
        this.oresGroup = this.scene.physics.add.staticGroup();
    }

    /**
     * Reconstrói a QuadTree com as entidades atuais (Players e NPCs).
     */
    updateQuadTree(entities) {
        // Expandimos levemente a área (buffer de 200px) para garantir que 
        // entidades nas bordas extremas do mapa ainda sejam detectadas.
        // Centro: 1600, 1075 | Meia-Largura: 1900 | Meia-Altura: 1300
        const boundary = new QuadRect(1600, 1075, 1900, 1300);
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

    /**
     * Cria campos de minério no mapa com lógica de agrupamento (veios).
     */
    createOreField(totalCount) {
        console.log(`[Cenario] Gerando ${totalCount} minérios...`);
        const veinsCount = 15; // Número de "veios" ou clusters
        const oresPerVein = Math.floor(totalCount / veinsCount);

        for (let v = 0; v < veinsCount; v++) {
            // Centro do veio
            const centerX = Phaser.Math.Between(200, 3100);
            const centerY = Phaser.Math.Between(200, 2000);

            // Se o centro estiver bloqueado, pula este veio
            if (this.isWorldPositionBlocked(centerX, centerY)) {
                v--; continue;
            }

            for (let i = 0; i < oresPerVein; i++) {
                // Espalha ao redor do centro usando distribuição normal/gaussiana para parecer natural
                const x = centerX + Phaser.Math.Between(-150, 150);
                const y = centerY + Phaser.Math.Between(-150, 150);

                if (x < 0 || x > 3300 || y < 0 || y > 2200 || this.isWorldPositionBlocked(x, y)) {
                    continue;
                }

                // Cria o minério como um pequeno quadrado azul
                const ore = this.scene.add.rectangle(x, y, 8, 8, 0x0000ff);
                this.scene.physics.add.existing(ore, true); // true = static body
                
                // Configura dados do recurso
                ore.setData('type', 'ore');
                ore.setData('value', GAME_CONFIG.ORE_VALUE || 10);
                
                this.oresGroup.add(ore);
            }
        }
    }
    
  criarChao(texture, width, height, offsetX = -100, offsetY = -50) {
    const tile = this.scene.textures.get(texture).getSourceImage();
    const tileWidth = tile.width;
    const tileHeight = tile.height;

    for (let x = offsetX; x < width + offsetX; x += tileWidth) {
        for (let y = offsetY; y < height + offsetY; y += tileHeight) {
            this.scene.add
                .image(x, y, texture)
                .setOrigin(0, 0)
                .setDepth(-1);
        }
    }
}


    
    mapa(items) {
        this.obstacles = items;
    }
    
    obstaculos() {
        if (!this.obstacles) return;

        this.obstacles.forEach(obsData => {
            if (obsData.tipo === 'obstaculo') {
                // Usar staticImage é mais apropriado para obstáculos fixos
                const obstaculo = this.obstaclesGroup.create(obsData.x, obsData.y, obsData.id);

                if (obsData.width && obsData.height) {
                    obstaculo.setSize(obsData.width, obsData.height);
                    obstaculo.setDisplaySize(obsData.width, obsData.height);
                }

                // 1. Aplica o ângulo se ele for definido
                if (obsData.angle) {
                    obstaculo.setAngle(obsData.angle);
                }

                // Configura propriedade blocking
                obstaculo.setData('blocking', obsData.blocking);
                if (obsData.blocking === false) {
                    obstaculo.body.checkCollision.none = true;
                }

                // 2. Atualiza o corpo físico para a nova rotação (ESSENCIAL)
                obstaculo.refreshBody();
            } else if (obsData.tipo === 'animado') {
                // Cria o sprite usando o atlas definido
                const animado = this.scene.physics.add.sprite(obsData.x, obsData.y, obsData.atlas);
                this.animatedGroup.add(animado); // Adiciona ao grupo para colisão

                // Define a escala se fornecida
                if (obsData.scale) {
                    animado.setScale(obsData.scale);
                }

                // Define largura e altura customizadas se fornecidas (em pixels)
                if (obsData.width && obsData.height) {
                    animado.setDisplaySize(obsData.width, obsData.height);
                }

                // Define o ângulo se fornecido
                if (obsData.angle) {
                    animado.setAngle(obsData.angle);
                }

                // Configura propriedade blocking
                animado.setData('blocking', obsData.blocking);
                if (obsData.blocking === false) {
                    animado.body.checkCollision.none = true;
                }

                // Cria e reproduz a animação baseada no prefixo e JSON do atlas
                if (obsData.anim) {
                    if (!this.scene.anims.exists(obsData.anim)) {
                        let frames;
                        if (obsData.prefix) {
                            // Se tem prefixo, usa lógica de Atlas
                            frames = this.scene.anims.generateFrameNames(obsData.atlas, {
                                prefix: obsData.prefix,
                                start: obsData.start || 0,
                                end: obsData.end || 0,
                                zeroPad: obsData.zeroPad || 0,
                                suffix: obsData.suffix || ''
                            });
                        } else {
                            // Se não tem prefixo, usa lógica de Spritesheet (64x64)
                            frames = this.scene.anims.generateFrameNumbers(obsData.atlas, {
                                start: obsData.start || 0,
                                end: obsData.end || 0
                            });
                        }

                        this.scene.anims.create({
                            key: obsData.anim,
                            frames: frames,
                            frameRate: obsData.frameRate || 10,
                            repeat: -1
                        });
                    }
                    animado.play(obsData.anim);
                }

                // Configurações de física para objeto estático/imóvel
                animado.setImmovable(true);
                animado.body.setAllowGravity(false);
                animado.refreshBody();
            } else if (obsData.tipo === 'cenario') {
                // Lógica para objetos de cenário (sem física/colisão)
                let cenarioObj;

                if (obsData.atlas) {
                    // Se tiver atlas, é animado
                    cenarioObj = this.scene.add.sprite(obsData.x, obsData.y, obsData.atlas);
                    
                    // Configura animação se houver
                    if (obsData.anim) {
                        if (!this.scene.anims.exists(obsData.anim)) {
                            let frames;
                            if (obsData.prefix) {
                                // Se tem prefixo, usa lógica de Atlas
                                frames = this.scene.anims.generateFrameNames(obsData.atlas, {
                                    prefix: obsData.prefix,
                                    start: obsData.start || 0,
                                    end: obsData.end || 0,
                                    zeroPad: obsData.zeroPad || 0,
                                    suffix: obsData.suffix || ''
                                });
                            } else {
                                // Se não tem prefixo, usa lógica de Spritesheet (64x64)
                                frames = this.scene.anims.generateFrameNumbers(obsData.atlas, {
                                    start: obsData.start || 0,
                                    end: obsData.end || 0
                                });
                            }
                            this.scene.anims.create({
                                key: obsData.anim,
                                frames: frames,
                                frameRate: obsData.frameRate || 10,
                                repeat: -1
                            });
                        }
                        cenarioObj.play(obsData.anim);
                    }
                } else {
                    // Se não, é imagem estática
                    cenarioObj = this.scene.add.image(obsData.x, obsData.y, obsData.id);
                }

                // Configurações comuns
                if (obsData.width && obsData.height) {
                    cenarioObj.setDisplaySize(obsData.width, obsData.height);
                } else if (obsData.scale) {
                    cenarioObj.setScale(obsData.scale);
                }
                if (obsData.angle) cenarioObj.setAngle(obsData.angle);

                // Define profundidade (Depth) usando Y para z-sort correto com jogadores
                cenarioObj.setDepth(obsData.y);

                // Garante explicitamente que objetos de cenário não bloqueiam
                cenarioObj.setData('blocking', false);

                this.sceneryGroup.add(cenarioObj);
            }
        });
    }
    
    configurarGridNavigation(width, height) {
        this.gridWidth = width;
        this.gridHeight = height;
        this.cellSize = 50;

        // --- GERAÇÃO AUTOMÁTICA DO GRID PARA PATHFINDING ---
        const cols = Math.ceil(this.gridWidth / this.cellSize);
        const rows = Math.ceil(this.gridHeight / this.cellSize);
        
        this.grid = []; // Inicializa a matriz do grid

        for (let y = 0; y < rows; y++) {
            const row = [];
            for (let x = 0; x < cols; x++) {
                // Aumentamos a margem de segurança (offset) para 0.45 (quase a borda total)
                // Isso garante que o personagem nunca chegue perto o suficiente da parede para "raspar"
                const cx = x * this.cellSize + this.cellSize / 2;
                const cy = y * this.cellSize + this.cellSize / 2;
                const margin = this.cellSize * 0.45; 

                const blocked = this.isWorldPositionBlocked(cx, cy) || 
                                this.isWorldPositionBlocked(cx - margin, cy - margin) ||
                                this.isWorldPositionBlocked(cx + margin, cy + margin) ||
                                this.isWorldPositionBlocked(cx + margin, cy - margin) ||
                                this.isWorldPositionBlocked(cx - margin, cy + margin);

                row.push(blocked ? 1 : 0);
            }
            this.grid.push(row);
        }
        console.log(`[Cenario] Grid de navegação gerado: ${cols}x${rows}`);
    }
    
    toggleGrid() {
        if (!this.gridGraphics) {
            this.gridGraphics = this.scene.add.graphics().setDepth(1000);
        }
        this.gridVisible = !this.gridVisible;
        this.gridGraphics.setVisible(this.gridVisible);
        if (this.gridVisible) {
            this.drawGrid();
        }
    }
    
    drawGrid() {
        if (!this.gridGraphics || !this.grid) return;
        this.gridGraphics.clear();
        
        // Desenha as linhas do grid para orientação visual
        this.gridGraphics.lineStyle(1, 0xffffff, 0.1);
        for (let x = 0; x <= this.gridWidth; x += this.cellSize) {
            this.gridGraphics.lineBetween(x, 0, x, this.gridHeight);
        }
        for (let y = 0; y <= this.gridHeight; y += this.cellSize) {
            this.gridGraphics.lineBetween(0, y, this.gridWidth, y);
        }

        // Pinta as células bloqueadas (valor 1 no grid) em vermelho translúcido
        this.gridGraphics.fillStyle(0xff0000, 0.3); 
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y].length; x++) {
                if (this.grid[y][x] === 1) {
                    this.gridGraphics.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
                }
            }
        }
    }
    
    cenario() {
        console.log('Cenário configurado');
    }
    
    isWorldPositionBlocked(x, y) {
        // Verifica colisão com obstáculos estáticos
        const staticBlocked = this.obstaclesGroup.getChildren().some(obs => {
            if (obs.getData('blocking') === false) return false;
            return obs.active && obs.getBounds().contains(x, y);
        });
        if (staticBlocked) return true;

        // Verifica colisão com objetos animados
        const animBlocked = this.animatedGroup.getChildren().some(obs => {
            if (obs.getData('blocking') === false) return false;
            return obs.active && obs.getBounds().contains(x, y);
        });
        return animBlocked;
    }
    
    /**
     * Verifica se existe uma linha direta sem obstáculos entre dois pontos.
     * @param {number} x1 Origem X
     * @param {number} y1 Origem Y
     * @param {number} x2 Destino X
     * @param {number} y2 Destino Y
     * @returns {boolean} True se a visão estiver limpa, False se houver parede.
     */
    checkLineOfSight(x1, y1, x2, y2) {
        if (!this.grid) return true;

        const cellSize = this.cellSize || 50;
        const line = new Phaser.Geom.Line(x1, y1, x2, y2);
        
        // Otimização: Usa o algoritmo de Bresenham para checar apenas as células do grid
        const points = Phaser.Geom.Line.BresenhamPoints(line, cellSize / 2);

        for (const p of points) {
            const gx = Math.floor(p.x / cellSize);
            const gy = Math.floor(p.y / cellSize);

            // Se encontrar uma célula bloqueada (1) no grid, visão obstruída
            if (this.grid[gy] && this.grid[gy][gx] === 1) {
                return false;
            }
        }
        return true;
    }
    
    /**
     * Encontra um caminho entre dois pontos usando algoritmo A* simples.
     * Usa isWorldPositionBlocked para verificar colisões.
     * @param {number} startX - Posição X inicial
     * @param {number} startY - Posição Y inicial
     * @param {number} endX - Posição X final
     * @param {number} endY - Posição Y final
     * @returns {Array<{x, y}>} Lista de waypoints
     */
    findPath(startX, startY, endX, endY) {
        const cellSize = this.cellSize || 50;
        const gridWidth = Math.ceil((this.gridWidth || 3300) / cellSize);
        const gridHeight = Math.ceil((this.gridHeight || 2200) / cellSize);

        const startGridX = Math.floor(startX / cellSize);
        const startGridY = Math.floor(startY / cellSize);
        const endGridX = Math.floor(endX / cellSize);
        const endGridY = Math.floor(endY / cellSize);

        // Se o destino estiver fora dos limites, retorna vazio
        if (endGridX < 0 || endGridX >= gridWidth || endGridY < 0 || endGridY >= gridHeight) {
            return [];
        }

        const openList = [];
        const closedList = new Set();

        // Nó inicial
        openList.push({
            x: startGridX,
            y: startGridY,
            g: 0,
            h: Math.abs(startGridX - endGridX) + Math.abs(startGridY - endGridY),
            f: 0,
            parent: null
        });

        while (openList.length > 0) {
            // Ordena por F (menor custo total primeiro)
            openList.sort((a, b) => a.f - b.f);
            const currentNode = openList.shift();

            // Chegou ao destino?
            if (currentNode.x === endGridX && currentNode.y === endGridY) {
                const path = [];
                let curr = currentNode;
                while (curr.parent) { // Reconstrói o caminho de trás para frente
                    path.push({
                        x: curr.x * cellSize + cellSize / 2,
                        y: curr.y * cellSize + cellSize / 2
                    });
                    curr = curr.parent;
                }
                return path.reverse();
            }

            closedList.add(`${currentNode.x},${currentNode.y}`);

            // Vizinhos: Cima, Baixo, Esquerda, Direita
            const neighbors = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];

            for (const offset of neighbors) {
                const nx = currentNode.x + offset.x;
                const ny = currentNode.y + offset.y;

                if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;
                if (closedList.has(`${nx},${ny}`)) continue;

                // OTIMIZAÇÃO CRÍTICA: Consulta o grid pré-calculado em vez de fazer check de física
                if (this.grid && this.grid[ny] && this.grid[ny][nx] === 1) {
                    continue;
                }

                const g = currentNode.g + 1;
                const h = Math.abs(nx - endGridX) + Math.abs(ny - endGridY);
                const f = g + h;

                const existingNode = openList.find(n => n.x === nx && n.y === ny);
                if (existingNode) {
                    if (g < existingNode.g) {
                        existingNode.g = g;
                        existingNode.f = f;
                        existingNode.parent = currentNode;
                    }
                } else {
                    openList.push({ x: nx, y: ny, g, h, f, parent: currentNode });
                }
            }
        }
        return []; // Caminho não encontrado
    }

    findNearestValidCell(x, y) {
        return { x, y };
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