import { CHUNK_SIZE } from './world-gen.js';

/**
 * Radar do mapa. Mostra uma janela do mundo centrada no comandante, com as áreas já exploradas
 * em azul claro, as bordas do mundo em vermelho e as unidades como pontos.
 * (O mundo pode ter 300000 × 200000 px, então não existe "mapa inteiro" para desenhar.)
 */
export default class Minimap {
    /**
     * @param {Phaser.Scene} scene A cena para adicionar o radar.
     * @param {number} x A posição x do radar na tela.
     * @param {number} y A posição y do radar na tela.
     * @param {number} width A largura do radar.
     * @param {number} height A altura do radar.
     * @param {object} mapData { viewWidth, viewHeight }: tamanho, em px do mundo, da janela mostrada.
     * @param {object} world O mundo da missão (width, height).
     */
    constructor(scene, x, y, width, height, mapData, world) {
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.mapData = mapData;
        this.world = world;

        // Container para agrupar todos os elementos do radar
        this.container = this.scene.add.container(x, y).setScrollFactor(0).setDepth(9998);

        // Fundo estático e borda
        this.background = this.scene.add.graphics();
        this.container.add(this.background);

        // Áreas exploradas e limites do mundo
        this.terrain = this.scene.add.graphics();
        this.container.add(this.terrain);

        // Pontos dinâmicos das unidades
        this.dots = this.scene.add.graphics();
        this.container.add(this.dots);

        // Coordenadas do comandante, em pedaços
        this.label = this.scene.add.text(4, height - 14, '', { fontSize: '10px', fill: '#9be8ff' });
        this.container.add(this.label);

        this.dotSize = 6;
        this.create();
    }

    create() {
        this.background.fillStyle(0x000000, 0.6);
        this.background.fillRect(0, 0, this.width, this.height);
        this.background.lineStyle(2, 0x00ffff, 0.7);
        this.background.strokeRect(0, 0, this.width, this.height);
    }

    /**
     * @param {Phaser.GameObjects.GameObject[]} players Unidades do jogador.
     * @param {Phaser.GameObjects.GameObject[]} npcs NPCs.
     * @param {string} myTeam O time do jogador local.
     * @param {object} extra { focus: {x, y}, chunks: ChunkManager }
     */
    update(players, npcs, myTeam, extra) {
        const { focus, chunks } = extra;
        const { viewWidth, viewHeight } = this.mapData;
        const left = focus.x - viewWidth / 2;
        const top = focus.y - viewHeight / 2;
        const sx = this.width / viewWidth;
        const sy = this.height / viewHeight;
        const toX = worldX => (worldX - left) * sx;
        const toY = worldY => (worldY - top) * sy;
        const clampX = v => Math.min(this.width, Math.max(0, v));
        const clampY = v => Math.min(this.height, Math.max(0, v));

        // Áreas exploradas e limites do mundo
        this.terrain.clear();
        this.terrain.fillStyle(0x3a7fb0, 0.35);
        chunks.visited.forEach(key => {
            const [cx, cy] = key.split(',').map(Number);
            const x1 = clampX(toX(cx * CHUNK_SIZE));
            const y1 = clampY(toY(cy * CHUNK_SIZE));
            const x2 = clampX(toX((cx + 1) * CHUNK_SIZE));
            const y2 = clampY(toY((cy + 1) * CHUNK_SIZE));
            if (x2 > x1 && y2 > y1) this.terrain.fillRect(x1, y1, x2 - x1, y2 - y1);
        });
        this.terrain.lineStyle(2, 0xff3030, 0.9);
        [[0, 0, this.world.width, 0], [0, this.world.height, this.world.width, this.world.height],
         [0, 0, 0, this.world.height], [this.world.width, 0, this.world.width, this.world.height]].forEach(([x1, y1, x2, y2]) => {
            const ax = toX(x1), ay = toY(y1), bx = toX(x2), by = toY(y2);
            const vertical = x1 === x2;
            if (vertical && (ax < 0 || ax > this.width)) return;
            if (!vertical && (ay < 0 || ay > this.height)) return;
            this.terrain.lineBetween(
                vertical ? ax : clampX(ax), vertical ? clampY(ay) : ay,
                vertical ? bx : clampX(bx), vertical ? clampY(by) : by
            );
        });

        // Unidades
        this.dots.clear();
        const inside = (px, py) => px >= 0 && px <= this.width && py >= 0 && py <= this.height;
        const half = this.dotSize / 2;

        npcs.forEach(npc => {
            if (!npc.active || (npc.health !== undefined && npc.health <= 0)) return;
            const px = toX(npc.x), py = toY(npc.y);
            if (!inside(px, py)) return;
            this.dots.fillStyle(0xffff00, 1); // Amarelo
            this.dots.fillCircle(px, py, half);
        });

        players.forEach(player => {
            if (!player.active || player.health <= 0) return;
            const px = toX(player.x), py = toY(player.y);
            if (!inside(px, py)) return;
            this.dots.fillStyle(0x00ffff, 1); // Ciano para aliados
            this.dots.fillCircle(px, py, half);
        });

        this.label.setText(`área ${Math.floor(focus.x / CHUNK_SIZE)},${Math.floor(focus.y / CHUNK_SIZE)}  ·  ${chunks.visited.size} exploradas`);
    }

    setPosition(x, y) {
        this.container.setPosition(x, y);
    }

    destroy() {
        this.container.destroy();
    }
}
