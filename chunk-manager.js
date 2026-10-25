// chunk-manager.js
// Mundo aberto por pedaços: cria os objetos do Phaser só dos pedaços perto da câmera e do
// comandante, e destrói os que ficaram para trás. O conteúdo vem de world-gen.js.
//
// O que o jogador mudou (minério coletado, alien morto) fica nas listas `mined` e `killed`,
// para não reaparecer quando o pedaço for carregado de novo.
import { CHUNK_SIZE, CELLS_PER_CHUNK, WorldGen, TREE_FRAMES } from './world-gen.js';

const MAX_CACHE = 800;          // pedaços gerados mantidos na memória (só dados, bem pequenos)
const LOADS_PER_FRAME = 4;      // limite de pedaços criados por frame ao andar
const ORPHAN_DISTANCE = 4000;   // alien sem pedaço some se ficar tão longe do comandante

export default class ChunkManager {
    constructor(scene, world) {
        this.scene = scene;
        this.world = world;
        this.gen = new WorldGen(world);

        this.cache = new Map();   // "cx,cy" -> dados gerados
        this.loaded = new Map();  // "cx,cy" -> { data, objects, colliders, ores }
        this.killed = new Set();  // spawnId de aliens mortos
        this.mined = new Set();   // id de minérios coletados
        this.visited = new Set(); // "cx,cy" de pedaços já explorados (para o radar)

        this.lastVisitedKey = '';
        this.frame = 0;

        this.prepareTextures();
    }

    prepareTextures() {
        const tex = this.scene.textures;
        // Textura 1x1 usada como corpo invisível dos obstáculos
        if (!tex.exists('blank')) {
            const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xffffff, 1);
            g.fillRect(0, 0, 4, 4);
            g.generateTexture('blank', 4, 4);
            g.destroy();
        }
        // Recortes nomeados das árvores dentro do spritesheet de árvores
        const trees = tex.get('cid_atlas');
        TREE_FRAMES.forEach(f => { if (!trees.has(f.name)) trees.add(f.name, 0, f.x, f.y, f.w, f.h); });
    }

    key(cx, cy) {
        return `${cx},${cy}`;
    }

    // ------------------------------------------------------------------ consultas
    getData(cx, cy) {
        const k = this.key(cx, cy);
        let data = this.cache.get(k);
        if (!data) {
            data = this.gen.generateChunk(cx, cy);
            this.cache.set(k, data);
            // Descarta o mais antigo (ordem de inserção). Pedaços carregados guardam a própria referência.
            if (this.cache.size > MAX_CACHE) this.cache.delete(this.cache.keys().next().value);
        }
        return data;
    }

    /** A célula do grid (gx, gy) está bloqueada? Fora do mundo conta como bloqueada. */
    isCellBlocked(gx, gy) {
        const cx = Math.floor(gx / CELLS_PER_CHUNK);
        const cy = Math.floor(gy / CELLS_PER_CHUNK);
        if (!this.gen.inWorld(cx, cy)) return true;
        const data = this.getData(cx, cy);
        return data.cells[(gy - cy * CELLS_PER_CHUNK) * CELLS_PER_CHUNK + (gx - cx * CELLS_PER_CHUNK)] === 1;
    }

    /** O ponto (x, y) está dentro de um obstáculo ou fora do mundo? */
    isBlockedAt(x, y) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        if (!this.gen.inWorld(cx, cy)) return true;
        return this.getData(cx, cy).colliders.some(c => x > c.x1 && x < c.x2 && y > c.y1 && y < c.y2);
    }

    // ----------------------------------------------------------- carregar / descarregar
    /**
     * foci: lista de { x, y, rx, ry } (centro em px e raio em pedaços) que devem existir.
     * immediate: carrega tudo agora (início da partida); senão, no máximo LOADS_PER_FRAME por frame.
     */
    update(foci, immediate = false) {
        this.frame++;

        const needed = new Set();
        foci.forEach(f => {
            const ccx = Math.floor(f.x / CHUNK_SIZE);
            const ccy = Math.floor(f.y / CHUNK_SIZE);
            for (let cy = ccy - f.ry; cy <= ccy + f.ry; cy++) {
                for (let cx = ccx - f.rx; cx <= ccx + f.rx; cx++) {
                    if (this.gen.inWorld(cx, cy)) needed.add(this.key(cx, cy));
                }
            }
        });

        // Carrega os que faltam, os mais próximos do primeiro foco antes
        const first = foci[0];
        const missing = [...needed].filter(k => !this.loaded.has(k));
        if (missing.length) {
            const dist = k => {
                const [cx, cy] = k.split(',').map(Number);
                return Math.hypot((cx + 0.5) * CHUNK_SIZE - first.x, (cy + 0.5) * CHUNK_SIZE - first.y);
            };
            missing.sort((a, b) => dist(a) - dist(b));
            const limit = immediate ? missing.length : LOADS_PER_FRAME;
            missing.slice(0, limit).forEach(k => {
                const [cx, cy] = k.split(',').map(Number);
                this.loaded.set(k, this.createChunk(cx, cy));
            });
        }

        // Descarrega o que saiu da área, com 1 pedaço de folga para não piscar na borda
        const keep = new Set();
        foci.forEach(f => {
            const ccx = Math.floor(f.x / CHUNK_SIZE);
            const ccy = Math.floor(f.y / CHUNK_SIZE);
            for (let cy = ccy - f.ry - 1; cy <= ccy + f.ry + 1; cy++) {
                for (let cx = ccx - f.rx - 1; cx <= ccx + f.rx + 1; cx++) keep.add(this.key(cx, cy));
            }
        });
        for (const [k, chunk] of this.loaded) {
            if (!keep.has(k)) {
                this.destroyChunk(chunk);
                this.loaded.delete(k);
            }
        }

        if (this.frame % 60 === 0) this.cleanOrphans();
    }

    createChunk(cx, cy) {
        const scene = this.scene;
        const data = this.getData(cx, cy);
        const ox = cx * CHUNK_SIZE;
        const oy = cy * CHUNK_SIZE;
        const k = this.key(cx, cy);
        const chunk = { key: k, data, objects: [], colliders: [], ores: [] };

        // Chão: recorte do 'terra' que se repete a cada 5 × 3 pedaços (1 px a mais para não deixar frestas)
        const frameName = `chao_${cx % 5}_${cy % 3}`;
        const terra = scene.textures.get('terra');
        if (!terra.has(frameName)) terra.add(frameName, 0, (cx % 5) * CHUNK_SIZE, (cy % 3) * CHUNK_SIZE, CHUNK_SIZE, CHUNK_SIZE);
        chunk.objects.push(
            scene.add.image(ox, oy, 'terra', frameName).setOrigin(0).setDepth(-1).setScale((CHUNK_SIZE + 1) / CHUNK_SIZE)
        );

        // Obstáculos: corpo invisível (colisão) + imagem
        const obstaclesGroup = scene.meuCenario.obstaclesGroup;
        data.obstacles.forEach(o => {
            const c = o.collider;
            const body = obstaclesGroup.create((c.x1 + c.x2) / 2, (c.y1 + c.y2) / 2, 'blank');
            body.setVisible(false).setDisplaySize(c.x2 - c.x1, c.y2 - c.y1).refreshBody();
            body.setData('blocking', true);
            chunk.colliders.push(body);

            const v = o.visual;
            const image = v.frame ? scene.add.image(v.x, v.y, v.texture, v.frame) : scene.add.image(v.x, v.y, v.texture);
            if (v.originX !== undefined) image.setOrigin(v.originX, v.originY);
            if (v.width) image.setDisplaySize(v.width, v.height);
            if (v.scale) image.setScale(v.scale);
            image.setDepth(v.depth);
            chunk.objects.push(image);
        });

        // Minério
        data.ores.forEach(o => {
            if (this.mined.has(o.id)) return;
            const ore = scene.add.rectangle(o.x, o.y, 8, 8, 0x0000ff);
            scene.physics.add.existing(ore, true);
            ore.setData('type', 'ore');
            ore.setData('oreId', o.id);
            ore.setData('value', GAME_CONFIG.ORE_VALUE || 10);
            scene.meuCenario.oresGroup.add(ore);
            chunk.ores.push(ore);
        });

        // Aliens
        data.aliens.forEach(spec => {
            if (this.killed.has(spec.spawnId)) return;
            scene.npcManager.spawnFromSpec(spec, k);
        });

        return chunk;
    }

    destroyChunk(chunk) {
        const obstaclesGroup = this.scene.meuCenario.obstaclesGroup;
        chunk.colliders.forEach(body => obstaclesGroup.remove(body, true, true));
        chunk.objects.forEach(obj => obj.destroy());
        chunk.ores.forEach(ore => { if (ore.scene) ore.destroy(); });

        // Aliens do pedaço: os que estão em combate ficam até se afastarem (cleanOrphans)
        const npcManager = this.scene.npcManager;
        npcManager.npcs.getChildren().slice().forEach(npc => {
            if (npc.getData('chunkKey') !== chunk.key) return;
            const busy = npc.health > 0 && npc.getData('isEngaged');
            if (!busy) npcManager.despawnNpc(npc);
        });
    }

    /** Remove aliens sem pedaço carregado que ficaram longe demais do comandante. */
    cleanOrphans() {
        const commander = this.scene.gameManager && this.scene.gameManager.commander;
        if (!commander) return;
        const npcManager = this.scene.npcManager;
        npcManager.npcs.getChildren().slice().forEach(npc => {
            if (this.loaded.has(npc.getData('chunkKey'))) return;
            if (Phaser.Math.Distance.Between(commander.x, commander.y, npc.x, npc.y) > ORPHAN_DISTANCE) {
                npcManager.despawnNpc(npc);
            }
        });
    }

    // ------------------------------------------------------------------ progresso
    markKilled(spawnId) {
        if (spawnId) this.killed.add(spawnId);
    }

    markOreMined(oreId) {
        if (oreId) this.mined.add(oreId);
    }

    /** Marca como explorados os pedaços ao redor de (x, y). Devolve a quantidade total explorada. */
    markVisited(x, y, radius = 1) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cy = Math.floor(y / CHUNK_SIZE);
        const key = this.key(cx, cy);
        if (key === this.lastVisitedKey) return this.visited.size;
        this.lastVisitedKey = key;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (this.gen.inWorld(cx + dx, cy + dy)) this.visited.add(this.key(cx + dx, cy + dy));
            }
        }
        return this.visited.size;
    }
}
