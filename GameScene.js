// GameScene.js
import Minimap from './minimap.js'; // Importar o Minimap
import SoundManager from './sound-manager.js'; // Importar SoundManager
import PathManager from './path-manager.js';
import NpcManager from './npc-manager.js';
import Cenario from './cenario.js';
import ShotManager from './ShotManager.js';
import AnimationManager from './animation-manager.js';
import GameManager from './game-manager.js';
import { getMission } from './progression.js';
import { buildWorld, CHUNK_SIZE } from './world-gen.js';
import ChunkManager from './chunk-manager.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
        // Inicialize as variáveis que eram globais
        this.meuCenario = null;
        this.gameManager = null; 
        this.animationManager = null; 
        this.soundManager = null; // Gerenciador de som
        this.cursors = null; 
        this.npcManager = null;
        this.minimap = null; // Adicionar propriedade para o Minimap
        this.pathManager = null; // Gerenciador de pathfinding
        this.chunks = null; // Mundo aberto por pedaços
        this.shotManager = null; // Gerenciador de tiros
    }
 
    init(data) {
        // Recebe os dados da LobbyScene (ou de onde quer que a cena seja iniciada)
        console.log("GameScene iniciada com dados:", data);
        this.initialGameData = data;
        this.missionNumber = (data && data.missionNumber) ? data.missionNumber : 1;
        this.mission = getMission(this.missionNumber);
        // Cada partida sorteia uma seed nova; passar data.seed repete o mesmo mapa
        this.seed = (data && data.seed !== undefined) ? data.seed : Math.floor(Math.random() * 4294967296);
        this.world = buildWorld(this.mission, this.seed);
    }

    preload() {
        console.log('GameScene: Carregando assets...');

        // Carrega dinamicamente todos os spritesheets definidos em PLAYER_CONFIGS
        for (const type in PLAYER_CONFIGS) {
            const config = PLAYER_CONFIGS[type];
            this.load.spritesheet(config.textureKey, config.path, { frameWidth: config.frameWidth, frameHeight: config.frameHeight });
        }


        this.load.image('terra', 'assets/warufo.png');
        this.load.image('base_gelo', 'assets/cidade/base_snow_flat_E.png');
        this.load.image('parasol', 'assets/cidade/detail-parasol-a.png');
        this.load.image('piramide', 'assets/cidade/pyramidMayan.png');
        this.load.image('perfeito', 'assets/cidade/perfeito2.jpg');
        this.load.image('arvore1', 'assets/cidade/treeFrozen.png');
        this.load.image('arvore2', 'assets/cidade/treePineFrozen.png');
        this.load.image('conveyor', 'assets/cidade/conveyor-bars-fence.png');
        this.load.image('muro-cima', 'assets/texturas/muro-cima.png');
        this.load.image('murovirado', 'assets/texturas/murovirado.png');
        this.load.image('Brick_20-512x512', 'assets/cidade/Brick_20-512x512.png');
        this.load.image('plasma_bullet', 'assets/efeitos/gun_tiro.png');
        this.load.image('plasma_bullet_rifle', 'assets/efeitos/rifle_tiro.png');



        // Exemplo: Carregando o atlas (imagem + json) para o objeto animado
        this.load.atlas('teste_atlas', 'assets/test.png', 'assets/teste.json');

        this.load.atlas('mira_atlas', 'assets/personagens/mira/mira.png', 'assets/personagens/mira/mira.json');

        this.load.spritesheet('cid_atlas', 'assets/cidade/animados/tree-variations.png', { frameWidth: 64, frameHeight: 64 });
        this.load.atlas('com_atlas', 'assets/cidade/animados/comunista.png', 'assets/cidade/animados/pcomunista.json');
        this.load.atlas('bam_atlas', 'assets/cidade/animados/bandeira.png', 'assets/cidade/animados/bandeira.json');

        // Inicializa e carrega sons
        this.soundManager = new SoundManager(this);
        this.soundManager.preload();

        // Inicializa e carrega NPCs
        this.npcManager = new NpcManager(this);
        this.npcManager.preload();

        // Gera uma textura simples para partículas de sangue (para não precisar de arquivo externo)
        if (!this.textures.exists('blood_particle')) {
            const graphics = this.make.graphics({ x: 0, y: 0, add: false });
            graphics.fillStyle(0xcc0000, 1); // Vermelho sangue
            graphics.fillCircle(4, 4, 4);
            graphics.generateTexture('blood_particle', 8, 8);
            graphics.destroy();
        }

        console.log('GameScene: Assets carregados!');
    }

    create() {
        console.log('GameScene: Inicializando jogo...');

        // **CORREÇÃO CRÍTICA**: Inicializar os gerenciadores ANTES de registrar os listeners que dependem deles.
        this.animationManager = new AnimationManager(this);

        // Inicializa o ShotManager
        this.shotManager = new ShotManager(this);
        this.shotManager.create();

        // Inicia a música e passa o soundManager para o GameManager
        this.soundManager.create();
        this.gameManager = new GameManager(this, this.animationManager, this.soundManager);
        this.meuCenario = new Cenario(this);
        this.cursors = this.input.keyboard.createCursorKeys();

        // --- IMPLEMENTAÇÃO DA MIRA (CURSOR) ---
        // 1. Criar a animação da mira usando os frames do atlas carregado
        // Tenta pegar os frames diretamente da textura para garantir que existem
        const textureMira = this.textures.get('mira_atlas');
        const framesMira = textureMira.getFrameNames();

        if (framesMira.length > 0 && !this.anims.exists('animacao_mira')) {
            this.anims.create({
                key: 'animacao_mira',
                frames: this.anims.generateFrameNames('mira_atlas', { frames: framesMira }),
                frameRate: 24,
                repeat: -1
            });
        }

        // 2. Criar o sprite da mira (invisível inicialmente e fixo na tela)
        this.miraSprite = this.add.sprite(0, 0, 'mira_atlas');
        if (framesMira.length > 0) this.miraSprite.setFrame(framesMira[0]);
        this.miraSprite.setVisible(false);
        this.miraSprite.setDepth(10000); // Garante que fique por cima de tudo
        this.miraSprite.setOrigin(0.5);

        // --------------------------------------

        // Input para alternar o Grid (Tecla G)
        this.input.keyboard.on('keydown-G', () => {
            if (this.meuCenario) {
                this.meuCenario.toggleGrid();
                const status = this.meuCenario.gridVisible ? 'ON' : 'OFF';
                this.gameManager.showMessage(`Debug Blocked Areas: ${status}`);
            }
        });

        // Comando para ligar/desligar o minimapa (Tecla M)
        this.input.keyboard.on('keydown-M', () => {
            if (this.minimap && this.minimap.container) {
                this.minimap.container.setVisible(!this.minimap.container.visible);
            }
        });

        // Atalho para Debug de Visão dos NPCs (Tecla Y)
        this.input.keyboard.on('keydown-Y', () => {
            this.npcManager.showDebugVision = !this.npcManager.showDebugVision;
            console.log(`[DEBUG] NPC Vision Debug: ${this.npcManager.showDebugVision ? 'ON' : 'OFF'}`);
            this.gameManager.showMessage(this.npcManager.showDebugVision ? 'NPC Vision Debug: ON' : 'NPC Vision Debug: OFF');
        });

        this.events.on('force_reload', () => {
            location.reload();
        });



        // --- MUNDO ---
        const world = this.world;
        this.physics.world.setBounds(0, 0, world.width, world.height);
        this.cameras.main.setBounds(0, 0, world.width, world.height);
        this.cameras.main.centerOn(world.start.x, world.start.y);

        // Grupo e animações dos NPCs; os aliens em si são criados pelos pedaços
        this.npcManager.create();
        this.chunks = new ChunkManager(this, world);
        this.pathManager = new PathManager(this, this.meuCenario.cellSize);

        // Carrega de uma vez o mundo ao redor do início
        this.chunks.update([{ x: world.start.x, y: world.start.y, rx: 4, ry: 3 }], true);

        // Adiciona colisão entre JOGADORES e o CENÁRIO (obstáculos e animados)
        this.physics.add.collider(this.gameManager.players, this.meuCenario.obstaclesGroup);
        this.physics.add.collider(this.gameManager.players, this.meuCenario.animatedGroup);

        // Adiciona colisão entre NPCs e o CENÁRIO
        // FIX: Adicionado processCallback para ignorar objetos com blocking: false
        this.physics.add.collider(
            this.npcManager.npcs, 
            this.meuCenario.obstaclesGroup,
            null,
            (npc, obs) => {
                if (obs.getData && obs.getData('blocking') === false) return false;
                return true;
            }
        );
        this.physics.add.collider(
            this.npcManager.npcs, 
            this.meuCenario.animatedGroup,
            null,
            (npc, obs) => {
                if (obs.getData && obs.getData('blocking') === false) return false;
                return true;
            }
        );

        // Sobreposição entre players e minérios (os minérios vêm dos pedaços)
        this.physics.add.overlap(this.gameManager.players, this.meuCenario.oresGroup, (player, ore) => {
            if (player.playerType === 'minerador') {
                this.gameManager.collectOre(player, ore);
            }
        });

        // Adiciona colisão entre JOGADORES e NPCs (Evita passar por cima)
        this.physics.add.collider(this.gameManager.players, this.npcManager.npcs);

        // --- NÉVOA DE GUERRA ---
        // A textura é criada sob demanda (updateFogOfWar) e acompanha a câmera, não o mapa inteiro
        this.fowRT = null;
        this.visionBrush = this.make.graphics({ x: 0, y: 0, add: false });
        this.visionBrush.fillStyle(0xffffff, 1);
        this.visionBrush.fillCircle(0, 0, GAME_CONFIG.PLAYER_VISION_RANGE || 600);

        // Configurar UI
        UIManager.createSimpleUI(this);

        // --- RADAR (janela de 3000 × 2250 px em volta do comandante) ---
        this.minimap = new Minimap(this, 10, 10, 200, 150, { viewWidth: 3000, viewHeight: 2250 }, world);

        // Usa os dados recebidos da LobbyScene para configurar o jogo
        // **NOVA ABORDAGEM**: Pega os dados de início diretamente do NetworkManager.
        // Isso é mais robusto do que depender da passagem de dados entre cenas,
        // que pode falhar devido a problemas de timing. Passa o missionNumber.
        this.gameManager.setupOfflineGame(this.missionNumber);

        console.log('GameScene: Jogo inicializado com sucesso!');
    }

    update() {
        // Fim de jogo: congela a simulação (a tela de resultado é só UI)
        if (this.gameManager && this.gameManager.isGameOver) return;

        if (this.gameManager) {
            this.gameManager.update();

            const commander = this.gameManager.commander;
            const focus = commander ? { x: commander.x, y: commander.y } : this.world.start;

            // Mundo por pedaços: carrega o que a câmera e o comandante precisam, descarta o resto
            const view = this.cameras.main.worldView;
            this.chunks.update([
                { x: view.centerX, y: view.centerY, rx: Math.ceil(view.width / 2 / CHUNK_SIZE) + 1, ry: Math.ceil(view.height / 2 / CHUNK_SIZE) + 1 },
                { x: focus.x, y: focus.y, rx: 2, ry: 2 }
            ]);
            if (commander && commander.active) {
                this.gameManager.registerExploration(this.chunks.markVisited(commander.x, commander.y, 1));
            }

            // Atualiza a QuadTree com a posição de todos os personagens vivos
            const allEntities = [
                ...this.gameManager.players.getChildren(),
                ...this.npcManager.npcs.getChildren()
            ];
            this.meuCenario.updateQuadTree(allEntities, focus);
            if (this.meuCenario.gridVisible && this.game.getFrame() % 30 === 0) this.meuCenario.drawGrid();

            this.updateFogOfWar();
            if (this.minimap) {
                this.minimap.update(this.gameManager.players.getChildren(), this.npcManager.npcs.getChildren(), 'player', { focus, chunks: this.chunks });

                // --- LÓGICA PARA O MINIMAPA ACOMPANHAR O ZOOM ---
                const cam = this.cameras.main;
                const zoom = cam.zoom;
                const width = this.scale.width;
                const height = this.scale.height;
                const centerX = width / 2;
                const centerY = height / 2;
                const desiredX = 10;
                const desiredY = 10;

                // 1. Escala inversa para manter tamanho fixo visualmente
                this.minimap.container.setScale(1 / zoom);

                // 2. Calcula a posição no mundo para que o elemento apareça fixo na tela
                const x = centerX + (desiredX - centerX) / zoom;
                const y = centerY + (desiredY - centerY) / zoom;
                
                this.minimap.container.setPosition(x, y);
            }

            // --- LÓGICA DA MIRA (CURSOR) ---
            // Controla a visibilidade da mira baseado no modo de ação (Atirar)
            if (this.miraSprite) {
                const isShootMode = this.gameManager.actionMode === 'shoot';
                
                if (isShootMode) {
                    if (!this.miraSprite.visible) {
                        this.miraSprite.setVisible(true);
                        if (this.anims.exists('animacao_mira')) this.miraSprite.play('animacao_mira');
                    }
                    // Atualiza posição constantemente
                    const pointer = this.input.activePointer;
                    const cam = this.cameras.main;
                    
                    // Converte a posição da tela para o mundo usando o estado ATUAL da câmera
                    // Isso corrige o lag/desync quando a câmera se move ou dá zoom no mesmo frame
                    const worldPoint = pointer.positionToCamera(cam);
                    
                    this.miraSprite.setPosition(worldPoint.x, worldPoint.y);
                    this.miraSprite.setScale(1 / cam.zoom);
                } else if (this.miraSprite.visible) {
                    this.miraSprite.setVisible(false);
                    this.miraSprite.stop();
                }
            }
        }
        if (this.npcManager) {
            this.npcManager.update();
        }
        if (this.pathManager) {
            this.pathManager.update();
        }
    }

    /**
     * Atualiza a visibilidade dos jogadores baseado na Fog of War.
     * Inimigos só aparecem se estiverem dentro do raio de visão (MAX_MOVE_DISTANCE).
     */
    updateFogOfWar() {
        if (!this.gameManager || !this.gameManager.players || !this.npcManager) return;
        
        const isEnabled = typeof GAME_CONFIG !== 'undefined' && GAME_CONFIG.FOG_OF_WAR_ENABLED;

        // A névoa é uma textura do tamanho da área visível (zoom mínimo 0.5), colada na câmera a cada frame
        if (isEnabled && !this.fowRT) {
            const margin = 100;
            this.fowMargin = margin;
            this.fowRT = this.add.renderTexture(0, 0, Math.ceil(this.scale.width / 0.5) + margin * 2, Math.ceil(this.scale.height / 0.5) + margin * 2)
                .setOrigin(0)
                .setDepth(9990); // Acima do cenário e sprites, abaixo da UI
        }
        if (this.fowRT) this.fowRT.setVisible(isEnabled);

        // Pega todos os jogadores e todos os NPCs para a checagem
        const players = this.gameManager.players.getChildren();
        const npcs = this.npcManager.npcs.getChildren();
        const allEntities = [...players, ...npcs];

        // Verifica se a configuração global existe e se a Fog of War está ativa
        if (!isEnabled) {
            // Se FOG está DESATIVADO, torna todos visíveisok
            // Unidades inativas (corpos já escondidos) não podem voltar a aparecer
            allEntities.forEach(unit => {
                if (unit.active) unit.setVisible(true);
            });
            return;
        }

        // Unidades que pertencem ao jogador e dão visão (Soldados)
        const myVisionUnits = players.filter(u => u.active);

        // DESENHA OS BURACOS DE VISÃO: escurece a área da câmera e apaga um círculo por unidade
        const view = this.cameras.main.worldView;
        this.fowRT.setPosition(view.x - this.fowMargin, view.y - this.fowMargin);
        this.fowRT.clear();
        this.fowRT.fill(0x000000, 0.65);
        myVisionUnits.forEach(u => {
            const vRange = u.visionRange || 50;
            this.visionBrush.clear();
            this.visionBrush.fillStyle(0xffffff, 1);
            this.visionBrush.fillCircle(0, 0, vRange);
            this.fowRT.erase(this.visionBrush, u.x - this.fowRT.x, u.y - this.fowRT.y);
        });

        allEntities.forEach(unit => {
            if (!unit.active) return;
            // NOVO: Verifica se a unidade está temporariamente revelada pela IA
            if (unit.isTemporarilyRevealed) {
                unit.setVisible(true);
                if (unit.healthBar) unit.healthBar.setVisible(true);
                return;
            }

            // Se o personagem estiver marcado como revelado pelo servidor, ele fica visível
            if (unit.isRevealed) {
                unit.setVisible(true);
                if (unit.healthBar) unit.healthBar.setVisible(true);
                return;
            }

            // Inimigos: verifica se alguma das minhas unidades está perto o suficiente
            const isVisible = myVisionUnits.some(myUnit => 
                Phaser.Math.Distance.Between(myUnit.x, myUnit.y, unit.x, unit.y) <= (myUnit.visionRange || 600)
            );

            unit.setVisible(isVisible);
            if (unit.healthBar) unit.healthBar.setVisible(isVisible);
        });
    }

}