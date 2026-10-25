/**
 * @class PathManager
 * @description Manages pathfinding requests using EasyStar.js to avoid performance bottlenecks.
 * It processes one path request per frame.
 */
export default class PathManager {
    /**
     * @param {Phaser.Scene} scene The main game scene.
     * @param {Array<Array<number>>} grid The 2D grid representing the world (0 for walkable, 1 for blocked).
     * @param {number} cellSize The size of each cell in the grid in pixels.
     */
    constructor(scene, grid, cellSize) {
        this.scene = scene;
        this.cellSize = cellSize;
        this.easystar = new EasyStar.js();
        
        if (grid) {
            this.easystar.enableDiagonals(); // Permite movimento diagonal para evitar quinas
            this.setGrid(grid);
        }

        this.requestQueue = [];
        this.isCalculating = false;
    }

    /**
     * Sets the grid for pathfinding.
     * @param {Array<Array<number>>} grid The 2D grid.
     */
    setGrid(grid) {
        this.grid = grid;
        this.easystar.setGrid(this.grid);
        this.easystar.setAcceptableTiles([0]); // 0 is walkable
    }

    /**
     * Converts world coordinates (pixels) to grid coordinates (tiles).
     * @param {number} worldX
     * @param {number} worldY
     * @returns {{x: number, y: number}}
     */
    worldToGrid(worldX, worldY) {
        const gridX = Math.floor(worldX / this.cellSize);
        const gridY = Math.floor(worldY / this.cellSize);
        return { x: gridX, y: gridY };
    }

    /**
     * Converts grid coordinates (tiles) to world coordinates (pixels), centering in the tile.
     * @param {number} gridX
     * @param {number} gridY
     * @returns {{x: number, y: number}}
     */
    gridToWorld(gridX, gridY) {
        const worldX = gridX * this.cellSize + this.cellSize / 2;
        const worldY = gridY * this.cellSize + this.cellSize / 2;
        return { x: worldX, y: worldY };
    }

    /**
     * Queues a pathfinding request. The path will be calculated in a future frame.
     * @param {number} startWorldX The starting X in world coordinates.
     * @param {number} startWorldY The starting Y in world coordinates.
     * @param {number} endWorldX The ending X in world coordinates.
     * @param {number} endWorldY The ending Y in world coordinates.
     * @param {function(Phaser.Types.Math.Vector2[] | null)} callback The function to call with the resulting path or null.
     */
    findPath(startWorldX, startWorldY, endWorldX, endWorldY, callback) {
        if (!this.grid) {
            console.error('[PathManager] Grid não definido! Certifique-se de que o Cenario gerou o grid corretamente.');
            callback(null);
            return;
        }

        const gridWidth = this.grid[0].length;
        const gridHeight = this.grid.length;

        let startGrid = this.worldToGrid(startWorldX, startWorldY);
        let endGrid = this.worldToGrid(endWorldX, endWorldY);

        // Garante que as coordenadas estejam dentro dos limites do grid
        startGrid.x = Phaser.Math.Clamp(startGrid.x, 0, gridWidth - 1);
        startGrid.y = Phaser.Math.Clamp(startGrid.y, 0, gridHeight - 1);
        endGrid.x = Phaser.Math.Clamp(endGrid.x, 0, gridWidth - 1);
        endGrid.y = Phaser.Math.Clamp(endGrid.y, 0, gridHeight - 1);

        // Se o destino estiver bloqueado (parede), tenta achar o vizinho livre mais próximo
        if (this.grid[endGrid.y][endGrid.x] !== 0) {
            const nearest = this.findNearestWalkable(endGrid.x, endGrid.y);
            if (nearest) {
                endGrid = nearest;
            } else {
                // Retorna null sem spammar o console se for realmente impossível chegar
                callback(null);
                return;
            }
        }

        this.requestQueue.push({ start: startGrid, end: endGrid, callback: callback });
    }

    /**
     * Procura a célula caminhável (0) mais próxima em um raio de busca.
     */
    findNearestWalkable(gridX, gridY) {
        const gridWidth = this.grid[0].length;
        const gridHeight = this.grid.length;
        const searchRadius = 5; // Aumentado para procurar em até 5 tiles de distância

        for (let r = 1; r <= searchRadius; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const nx = gridX + dx;
                    const ny = gridY + dy;
                    if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
                        if (this.grid[ny][nx] === 0) {
                            return { x: nx, y: ny };
                        }
                    }
                }
            }
        }
        return null;
    }

    /**
     * This method should be called in the scene's update loop.
     */
    update() {
        if (this.requestQueue.length > 0 && !this.isCalculating) {
            this.isCalculating = true;
            const request = this.requestQueue.shift();
            
            this.easystar.findPath(request.start.x, request.start.y, request.end.x, request.end.y, (path) => {
                this.isCalculating = false;
                const worldPath = path ? path.map(p => new Phaser.Math.Vector2(this.gridToWorld(p.x, p.y))) : null;
                request.callback(worldPath);
            });
            
            this.easystar.calculate();
        }
    }
}