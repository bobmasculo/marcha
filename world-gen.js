// world-gen.js
// Geração determinística do mundo, por pedaços (chunks). Não depende do Phaser.
// Cada pedaço nasce de hash(seed, cx, cy): o mesmo pedaço sempre sai igual, então o mundo
// não precisa ser guardado. Mundos enormes cabem na memória porque só os pedaços perto
// da câmera existem de verdade (ver chunk-manager.js).

export const CHUNK_SIZE = 500;           // lado de um pedaço, em px
export const CELL_SIZE = 50;             // lado de uma célula do grid de navegação
export const CELLS_PER_CHUNK = CHUNK_SIZE / CELL_SIZE;

/** Tamanhos de mundo (múltiplos de CHUNK_SIZE). 'vast' tem 600 × 400 pedaços. */
export const WORLD_SIZES = {
    small:  { width: 2500,   height: 1500 },
    medium: { width: 3500,   height: 2500 },
    large:  { width: 4500,   height: 3000 },
    huge:   { width: 5500,   height: 3500 },
    vast:   { width: 300000, height: 200000 }
};

const START_SAFE_RADIUS = 700;   // sem obstáculos nem aliens perto do início
const ALIEN_SAFE_RADIUS = 1000;

// Recortes das árvores grandes em tree-variations.png (x, y, largura, altura)
export const TREE_FRAMES = [
    { name: 'arvore0', x: 8,   y: 160, w: 112, h: 129 },
    { name: 'arvore1', x: 136, y: 160, w: 112, h: 129 },
    { name: 'arvore2', x: 264, y: 160, w: 112, h: 129 },
    { name: 'arvore3', x: 392, y: 160, w: 112, h: 129 }
];

// Formas de ruína, em blocos de 100 px (dx, dy). Nenhuma fecha uma área: o caminho sempre contorna.
const RUIN_SHAPES = [
    [[0, 0], [1, 0]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [0, 1]],
    [[0, 0], [1, 0], [1, 1]]
];
const BRICK = 100;

export function hash32(seed, x, y) {
    let h = seed | 0;
    h = Math.imul(h ^ (x | 0), 0x85ebca6b);
    h = (h << 13) | (h >>> 19);
    h = Math.imul(h ^ (y | 0), 0xc2b2ae35);
    h ^= h >>> 16;
    h = Math.imul(h, 0x27d4eb2f);
    h ^= h >>> 15;
    return h >>> 0;
}

export function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Monta o mundo de uma missão. mission.map: { size, openness, seed?, aliensPerChunk?, veinChance? }.
 * Se aliensPerChunk / veinChance não vierem no perfil, saem de mission.npcCount / mission.ores.
 */
export function buildWorld(mission, seed) {
    const profile = mission.map;
    const size = WORLD_SIZES[profile.size];
    const chunksX = Math.ceil(size.width / CHUNK_SIZE);
    const chunksY = Math.ceil(size.height / CHUNK_SIZE);
    const total = chunksX * chunksY;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    return {
        width: size.width,
        height: size.height,
        chunksX,
        chunksY,
        seed: (profile.seed ?? seed) >>> 0,
        openness: profile.openness ?? 0.85,
        aliensPerChunk: profile.aliensPerChunk ?? clamp(mission.npcCount / total, 0.3, 1.2),
        veinChance: profile.veinChance ?? clamp(mission.ores / (total * 10), 0.15, 0.6),
        start: {
            x: Math.floor(size.width / 2 / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2,
            y: Math.floor(size.height / 2 / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2
        }
    };
}

export class WorldGen {
    constructor(world) {
        this.world = world;
    }

    inWorld(cx, cy) {
        return cx >= 0 && cy >= 0 && cx < this.world.chunksX && cy < this.world.chunksY;
    }

    /**
     * Gera o conteúdo do pedaço (cx, cy):
     *   obstacles: { kind, collider{x1,y1,x2,y2}, visual{...} }
     *   ores:      { id, x, y }
     *   aliens:    { spawnId, type, x, y, waypoints }
     *   cells:     Uint8Array(CELLS_PER_CHUNK²), 1 = célula bloqueada
     */
    generateChunk(cx, cy) {
        const w = this.world;
        const S = CHUNK_SIZE;
        const ox = cx * S;
        const oy = cy * S;
        const rng = mulberry32(hash32(w.seed, cx, cy));
        const between = (a, b) => a + rng() * (b - a);
        const centerX = ox + S / 2;
        const centerY = oy + S / 2;
        const distStart = Math.hypot(centerX - w.start.x, centerY - w.start.y);

        const obstacles = [];
        const colliders = [];
        const addCollider = (x1, y1, x2, y2) => colliders.push({ x1, y1, x2, y2 });
        const blockedByAny = (x, y, pad = 0) =>
            colliders.some(c => x > c.x1 - pad && x < c.x2 + pad && y > c.y1 - pad && y < c.y2 + pad);

        const nearStart = distStart < START_SAFE_RADIUS;
        const ruinChance = 0.04 + (1 - w.openness) * 0.5;
        const groveChance = 0.25 + (1 - w.openness) * 0.3;

        if (!nearStart) {
            const roll = rng();
            if (roll < 0.012) {
                // Pirâmide: um bloco grande e raro
                const bx = centerX;
                const by = oy + S - 110;
                obstacles.push({
                    kind: 'pyramid',
                    collider: { x1: bx - 80, y1: by - 60, x2: bx + 80, y2: by },
                    visual: { texture: 'piramide', x: bx, y: by, originX: 0.5, originY: 1, scale: 0.6, depth: by }
                });
                addCollider(bx - 80, by - 60, bx + 80, by);
            } else if (roll < 0.012 + ruinChance) {
                // Ruína: poucos tijolos, afastados 90 px da borda do pedaço (>= 180 px de vão entre pedaços)
                const shape = RUIN_SHAPES[Math.floor(rng() * RUIN_SHAPES.length)];
                const extentX = (Math.max(...shape.map(b => b[0])) + 1) * BRICK;
                const extentY = (Math.max(...shape.map(b => b[1])) + 1) * BRICK;
                const px = ox + 90 + rng() * Math.max(0, S - 180 - extentX);
                const py = oy + 90 + rng() * Math.max(0, S - 180 - extentY);
                shape.forEach(([dx, dy]) => {
                    const x1 = px + dx * BRICK;
                    const y1 = py + dy * BRICK;
                    obstacles.push({
                        kind: 'brick',
                        collider: { x1, y1, x2: x1 + BRICK, y2: y1 + BRICK },
                        visual: { texture: 'Brick_20-512x512', x: x1 + BRICK / 2, y: y1 + BRICK / 2, width: BRICK, height: BRICK, depth: 0 }
                    });
                    addCollider(x1, y1, x1 + BRICK, y1 + BRICK);
                });
            }

            if (rng() < groveChance) {
                // Bosque: 2 a 6 árvores, só o tronco bloqueia
                const count = 2 + Math.floor(rng() * 5);
                const placed = [];
                for (let i = 0; i < count; i++) {
                    for (let attempt = 0; attempt < 5; attempt++) {
                        const bx = between(ox + 70, ox + S - 70);
                        const by = between(oy + 140, oy + S - 40);
                        if (blockedByAny(bx, by, 40)) continue;
                        if (placed.some(p => Math.hypot(p.x - bx, p.y - by) < 80)) continue;
                        placed.push({ x: bx, y: by });
                        const frame = TREE_FRAMES[Math.floor(rng() * TREE_FRAMES.length)];
                        obstacles.push({
                            kind: 'tree',
                            collider: { x1: bx - 20, y1: by - 24, x2: bx + 20, y2: by },
                            visual: { texture: 'cid_atlas', frame: frame.name, x: bx, y: by, originX: 0.5, originY: 1, depth: by }
                        });
                        addCollider(bx - 20, by - 24, bx + 20, by);
                        break;
                    }
                }
            }
        }

        // Minério em veios
        const ores = [];
        if (rng() < w.veinChance) {
            const vx = between(ox + 100, ox + S - 100);
            const vy = between(oy + 100, oy + S - 100);
            const count = 6 + Math.floor(rng() * 7);
            for (let i = 0; i < count; i++) {
                const x = vx + between(-90, 90);
                const y = vy + between(-90, 90);
                if (blockedByAny(x, y, 8)) continue;
                ores.push({ id: `${cx},${cy},${i}`, x, y });
            }
        }

        // Aliens em grupo
        const aliens = [];
        if (distStart >= ALIEN_SAFE_RADIUS) {
            const base = Math.floor(w.aliensPerChunk);
            const count = base + (rng() < w.aliensPerChunk - base ? 1 : 0);
            if (count > 0) {
                const campX = between(ox + 120, ox + S - 120);
                const campY = between(oy + 120, oy + S - 120);
                for (let i = 0; i < count; i++) {
                    let x = campX;
                    let y = campY;
                    for (let attempt = 0; attempt < 6; attempt++) {
                        x = campX + between(-70, 70);
                        y = campY + between(-70, 70);
                        if (!blockedByAny(x, y, 30)) break;
                    }
                    const type = rng() < 0.6 ? 'alien' : 'guarda';
                    aliens.push({
                        spawnId: `${cx},${cy},${i}`,
                        type,
                        x,
                        y,
                        waypoints: [
                            { x, y },
                            { x: x + between(-200, 200), y: y + between(-200, 200) },
                            { x: x + between(-200, 200), y: y + between(-200, 200) }
                        ]
                    });
                }
            }
        }

        return { cx, cy, obstacles, colliders, ores, aliens, cells: this.buildCells(ox, oy, colliders) };
    }

    /** Uma célula é bloqueada se o centro ou um dos 4 cantos (a 45% do lado) cai num obstáculo. */
    buildCells(ox, oy, colliders) {
        const cells = new Uint8Array(CELLS_PER_CHUNK * CELLS_PER_CHUNK);
        if (!colliders.length) return cells;
        const m = CELL_SIZE * 0.45;
        const inside = (x, y) => colliders.some(c => x > c.x1 && x < c.x2 && y > c.y1 && y < c.y2);
        for (let gy = 0; gy < CELLS_PER_CHUNK; gy++) {
            for (let gx = 0; gx < CELLS_PER_CHUNK; gx++) {
                const x = ox + gx * CELL_SIZE + CELL_SIZE / 2;
                const y = oy + gy * CELL_SIZE + CELL_SIZE / 2;
                if (inside(x, y) || inside(x - m, y - m) || inside(x + m, y - m) || inside(x - m, y + m) || inside(x + m, y + m)) {
                    cells[gy * CELLS_PER_CHUNK + gx] = 1;
                }
            }
        }
        return cells;
    }
}
