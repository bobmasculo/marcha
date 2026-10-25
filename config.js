// config.js
// Constantes do jogo
const GAME_CONFIG = {
    SPEED: 180,
    START_FULLSCREEN: true, // Se true, o jogo entrará em tela cheia ao iniciar a partida
    TURN_SPEED: 0.12, // velocidade angular (radians por frame) para virar suavemente
    AIM_HOLD_MS: 800, // tempo em ms para manter o frame de mira após atirar
    MAX_MOVE_DISTANCE: 700, // máximo de pixels que um jogador pode se mover por turno
    SHOOT_OVERLAY_ALPHA: 0.22, // opacidade do overlay fora do alcance (0.0 - 1.0)
    NPC_ATTACK_RANGE: 400, // Agora os Aliens atacam de longe
    NPC_DAMAGE: 5, // Dano base do NPC
    PLAYER_DAMAGE: 5, // Dano base do Jogador
    NPC_VISION_RANGE: 200, // Visão aumentada para manter o alvo enquanto atira
    PLAYER_VISION_RANGE: 600, // Visão do jogador e da IA (Diferente dos NPCs)
    NPC_SPEED: 460, // Velocidade padrão do NPC
    NPC_MAX_HEALTH: 100, // Vida máxima do NPC
    IDLE_TIMEOUT_MS: 5000, // Tempo para entrar em idle (10 segundos)
    NPC_ARMOR: 30, // Armadura do NPC
    NPC_WEAPON_STRENGTH: 40, // Força de ataque do NPC
    RANDOM_NPC_COUNT: 55, // Quantidade total de NPCs no mapa
    RANDOM_NPC_TYPE: 'alien', // Tipo de NPC (alien ou guarda) definido em NPC_CONFIGS
    NPC_ATTACK_COOLDOWN: 1000, // Tempo entre ataques (ms)
    MAX_HEALTH: 100,
    UI_BAR_HEIGHT: 80,
    ORE_VALUE: 10, // Quanto vale cada minério coletado
    TOTAL_ORES: 2500, // Quantidade total de minérios a serem gerados no mapa
    NPC_RETREAT_THRESHOLD: 0.3, // Recua ao chegar em 30% de vida
    INITIAL_COINS: 50,
    UNIT_COSTS: { minerador: 25, soldado: 25 },
    SHOOT_DISTANCE: 100,
    MUSIC_VOLUME: 0.2, // Volume da música de fundo (0.0 a 1.0)
    SFX_VOLUME: 0.5,   // Volume dos efeitos sonoros (tiros, impactos, etc)
    ARMOR: 40,
    WEAPON_STRENGTH: 40,
    MESSAGE_INITIAL_COST: 6, // Custo inicial para enviar mensagem
    MESSAGE_PROGRESS_PER_CLICK: 10, // Porcentagem ganha a cada clique (10%)

    DIRECTION: {
        UP: 'up',
        DOWN: 'down',
        LEFT: 'left',
        RIGHT: 'right',
        IDLE: 'idle'
    },
    FOG_OF_WAR_ENABLED: false,
};

// Definição das Armas e seus atributos
const WEAPONS = {
        'pistol': { 
            name: 'Pistola', 
            minDamage: 1, 
            maxDamage: 1, 
            range: 500,
            shootType: 'game_feel', // Corrigido para usar o sistema de projétil com textura
            projectileSpeed: 1100, 
            projectileTexture: 'plasma_bullet', // Agora usa sua imagem carregada
            projectileScale: 0.08, // Ajuste o tamanho do tiro aqui (0.3 = 30% do tamanho original)
            projectileRotation: -1.57, // Correção de rotação (-90 graus)
            projectileLight: {
                color: 0x00ffff, // Ciano (combina com o plasma)
                radius: 0,
                intensity: 0.5
            },
            image: 'assets/armas/pistola.png',
            muzzleFlash: {
                texture: 'flash_texture', // Coloque o nome da sua textura aqui
                scale: 0.15,
                rotation: -1.57 // -90 graus (ajuste se a imagem apontar para baixo)
            }
        },
        'shotgun': { 
            name: 'Escopeta', 
            minDamage: 1, 
            maxDamage: 1, 
            range: 550, 
            shootType: 'game_feel_rifle', // Novo tipo de tiro
            projectileSpeed: 1100, 
            projectileTexture: 'plasma_bullet_rifle', 
            projectileScale: 0.06, 
            projectileRotation: -1.57, 
            image: 'assets/armas/shotgun.png', 
            projectileLight: {
                color: 0x00ffff, // Ciano (combina com o plasma)
                radius: 0,
                intensity: 0.5
            },
            muzzleFlash: {
                texture: 'flash_texture', // Coloque o nome da sua textura aqui
                scale: 0.25,
                rotation: -1.57 // -90 graus (ajuste se a imagem apontar para baixo)
            }
        }
};
const range = (start, end) => {
    const isReverse = start > end;
    const length = isReverse ? start - end + 1 : end - start + 1;
    return Array.from({ length }, (_, i) => isReverse ? start - i : start + i);
};

const PLAYER_CONFIGS = {
    'comandante': {
        textureKey: 'comandante',
        path: 'assets/new/stalin_universal.png',
        frameWidth: 64, // Poderia ter um tamanho diferente
        frameHeight: 64,
        frameRate: 8,
        scale: 0.8,
        get displayHeight() { return this.frameHeight * this.scale; },
        get displayWidth() { return this.frameWidth * this.scale; },
        weapon: 'pistol',
        visionRange: 600,
        healthTextOffset: -55, // Ajustado para ficar mais acima, como os outros
        highlightOffset: -25,  // Ajustado para ficar mais acima, como os outros
        muzzleOffset: { x: 10, y: 0 },
        armor: 50,
        weaponStrength: 50,
        animationFrames: {
            down: range(130,138),
            left: range(117,125),
            right: range(143,151),
            up: range(104,112),
            idle: [182,183,184],
            shoot_down: [80,81,82,83,84,85],
            shoot_left: [67,68,69,70,71,72],
            shoot_right: [92,93,94,95,96,97,98],
            shoot_up: [55,56,57,58,59]
        }
    },
    'minerador': {
        textureKey: 'minerador',
        path: 'assets/personagens/engenheiro_americano.png',
        frameWidth: 64, // Poderia ter um tamanho diferente
        frameHeight: 64,
        frameRate: 15,
        scale: 0.8,
        get displayHeight() { return this.frameHeight * this.scale; },
        get displayWidth() { return this.frameWidth * this.scale; },
        visionRange: 300, // Metade do padrão
        healthTextOffset: -55, // Ajustado para ficar mais próximo do corpo
        highlightOffset: -20,  // Ajustado para ficar mais próximo do corpo
        muzzleOffset: { x: 10, y: -45 },
        weapon: 'pistol',
        armor: 30,
        weaponStrength: 30,
        animationFrames: {
             down: range(130,138),
            left: range(117,125),
            right: range(143,151),
            up: range(104,112),
            idle: [235],
        }
    },
    'soldado': {
        textureKey: 'soldado',
        path: 'assets/new/maoc_universal.png',
        frameWidth: 64, // Poderia ter um tamanho diferente
        frameHeight: 64,
        frameRate: 15,
        scale: 0.8,
        get displayHeight() { return this.frameHeight * this.scale; },
        get displayWidth() { return this.frameWidth * this.scale; },
        visionRange: 300, // Metade do padrão
        weapon: 'shotgun', 
        healthTextOffset: -55, // Ajustado para ficar mais próximo do corpo
        highlightOffset: -20,  // Ajustado para ficar mais próximo do corpo
        muzzleOffset: { x: 10, y: -45 },
        armor: 40,
        weaponStrength: 45,
        animationFrames: {
            down: range(130,138),
            left: range(117,125),
            right: range(143,151),
            up: range(104,112),
            idle: [235],
            shoot_down: [80,81,82,83,84,85],
            shoot_left: [67,68,69,70,71,72],
            shoot_right: [92,93,94,95,96,97,98],
            shoot_up: [55,56,57,58,59]
        }
    },
};

const PLAYER_SETUP = {
    name: 'Commander', 
    type: 'comandante', 
    x: 150, 
    y: 200
};

// Configuração do Phaser será criada em main.js após definir as funções
let CONFIG = null;

//mapa.. 
const extras_mapas = [


{
    tipo: 'cenario',
    x: 600,
    y: 1050,
    atlas: 'cid_atlas',
    anim: 'cid_img',
    start: 0, end: 2,
    width: 64, height: 64, // Define o tamanho exato em pixels para esta animação
    angle: 0, frameRate: 5
},


{
    tipo: 'cenario',
    x: 2900,
    y: 1700,
       atlas: 'cid_atlas',
    anim: 'cid_img',   // Nome único para esta animação
    prefix: 'frame_',     // Prefixo no JSON (ex: fire_0001.png)
    start: 0, end: 2, 
    start: 0, end: 0,
    zeroPad: 0,
    scale: 0.6,
    angle: 0, frameRate: 5
},

{
    tipo: 'cenario',
    x: 150,
    y: 50,
       atlas: 'cid_atlas',
    anim: 'cid_img',   // Nome único para esta animação
    prefix: 'frame_',     // Prefixo no JSON (ex: fire_0001.png)
    start: 0, end: 2, 
    zeroPad: 0,
    scale: 0.6,
    angle: 0, frameRate: 5
},

{
    tipo: 'cenario',
    x: 350,
    y: 50,
       atlas: 'cid_atlas',
    anim: 'cid_img',   // Nome único para esta animação
    prefix: 'frame_',     // Prefixo no JSON (ex: fire_0001.png)
    start: 0, end: 2,   // Intervalo de frames
    zeroPad: 0,          // Quantidade de zeros (ex: frame_1) 
    angle: 0,
    frameRate: 7,
    scale: 0.7
},
{
    tipo: 'cenario',
    x: 3000,
    y: 2000,
        atlas: 'cid_atlas',
    anim: 'cid_img',
    prefix: 'frame_',
    start: 0, end: 2,
    zeroPad: 0,
    scale: 0.7,
    angle: 0,
    frameRate: 1
},
{
    tipo: 'cenario',
    x: 3050,
    y: 2050,
        atlas: 'cid_atlas',
    anim: 'cid_img',
    prefix: 'frame_',
    start: 0, end: 2, zeroPad: 0,
    scale: 0.5, angle: 0, frameRate: 1
}];

const mapaArray = [
    
     { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 800, 
        y: 1050, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 800, 
        y: 950, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 800, 
        y: 850, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 800, 
        y: 1150, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 800, 
        y: 550, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 800, 
        y: 750, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 800, 
        y: 650, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
     { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 800, 
        y: 450, 
        width: 100, 
        height: 100, 
        angle: 0 
    },

   
    
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 2230, 
        y: 2100, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
     { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 2230, 
        y: 2000, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 2230, 
        y: 1900, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    



    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 2230, 
        y: 1800, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 2230, 
        y: 1700, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 2230, 
        y: 1600, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 2230, 
        y: 1500, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 800, 
        y: 350, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 800, 
        y: 250, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 800, 
        y: 150, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 800, 
        y: 50, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 800, 
        y: 0, 
        width: 100, 
        height: 100, 
        angle: 0 
    },
    { 
        id: 'Brick_20-512x512', 
        tipo: 'obstaculo', 
        x: 2230, 
        y: 1410, 
        width: 100, 
        height: 100, 
        angle: 0 
    }
];

mapaArray.push(...extras_mapas);

const NPC_CONFIGS = {
    'alien': {
        textureKey: 'npc_alien',
        path: 'assets/new/new_alien.png',
        frameWidth: 64,
        frameHeight: 64,
        scale: 1,
        speed: 60,
        health: 100,
        armor: 30,
        tint: 0x00ff00, // Alien levemente esverdeado
        weaponStrength: 40,
        animationFrames: {
             down: range(130,138),
            left: range(117,125),
            right: range(143,151),
            up: range(104,112),
            idle: [185],
            shoot_down: [80,81,82,83,84,85],
            shoot_left: [67,68,69,70,71,72],
            shoot_right: [92,93,94,95,96,97,98],
            shoot_up: [55,56,57,58,59],
            morto: [262,264,264,265],
        }
    },
    'guarda': {
        textureKey: 'npc_guarda',
        path: 'assets/guard_spritesheet.png',
        frameWidth: 64,
        frameHeight: 64,
        scale: 1,
        speed: 60,
        health: 100,
        armor: 30,
       // tint: 0xff8888, // Guarda com tom avermelhado de ameaça
        weaponStrength: 40,
        animationFrames: {
            down: [0, 8, 16, 24],
            left: [25, 26, 27],
            right: [5, 6, 7],
            up: [4, 12, 20, 28]
        }
    }
};

// Outros objetos do mapa

// Expor variáveis para módulos (GameScene.js)
window.GAME_CONFIG = GAME_CONFIG;
window.PLAYER_CONFIGS = PLAYER_CONFIGS;
window.NPC_CONFIGS = NPC_CONFIGS;
window.WEAPONS = WEAPONS; // <--- ADICIONADO: Exporta as armas para o escopo global
window.mapaArray = mapaArray;
window.extras_mapas = extras_mapas;
window.PLAYER_SETUP = PLAYER_SETUP;
