// GameScene.js
import Minimap from './minimap.js'; // Importar o Minimap
import SoundManager from './sound-manager.js'; // Importar SoundManager
import PathManager from './path-manager.js';
import NpcManager from './npc-manager.js';
import Cenario from './cenario.js';
import ShotManager from './ShotManager.js';
import AnimationManager from './animation-manager.js';
import GameManager from './game-manager.js';

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
        this.shotManager = null; // Gerenciador de tiros
    }
 
    init(data) {
        // Recebe os dados da LobbyScene (ou de onde quer que a cena seja iniciada)
        console.log("GameScene iniciada com dados:", data);
        this.initialGameData = data;
        this.missionNumber = (data && data.missionNumber) ? data.missionNumber : 1; 
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



        // Criar cenário
        this.meuCenario.criarChao('terra', 3300, 2200);
        
        
        this.meuCenario.mapa(mapaArray);
        this.meuCenario.obstaculos();
        this.meuCenario.configurarGridNavigation(3300, 2200);

        // Cria o PathManager DEPOIS que o grid do cenário foi configurado
        this.pathManager = new PathManager(this, this.meuCenario.grid, this.meuCenario.cellSize);


        // Adiciona colisão entre JOGADORES e o CENÁRIO (obstáculos e animados)
        this.physics.add.collider(this.gameManager.players, this.meuCenario.obstaclesGroup);
        this.physics.add.collider(this.gameManager.players, this.meuCenario.animatedGroup);

        // Cria os NPCs no mundo
        this.npcManager.create();

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

        // --- LÓGICA DE MINERAÇÃO ---
        // Gera os minérios no mapa
        this.meuCenario.createOreField(GAME_CONFIG.TOTAL_ORES || 2500);

        // Sobreposição entre players e minérios
        this.physics.add.overlap(this.gameManager.players, this.meuCenario.oresGroup, (player, ore) => {
            if (player.playerType === 'minerador') {
                this.gameManager.collectOre(player, ore);
            }
        });

        // Adiciona colisão entre JOGADORES e NPCs (Evita passar por cima)
        this.physics.add.collider(
            this.gameManager.players, 
            this.npcManager.npcs, 
            (player, npc) => {
                // Callback de colisão: A física para o movimento, e o servidor detecta a proximidade para atacar.
            }
        );

        // Configurar cena
        this.physics.world.setBounds(-100, -50, 3300, 2200);
        this.cameras.main.setBounds(-100, -50, 3300, 2200);
        this.cameras.main.centerOn(800, 800);

        // --- CONFIGURAÇÃO VISUAL DA NÉVOA DE GUERRA (OVERLAY) ---
        // 1. Cria uma textura de renderização para servir de máscara (preta por padrão)
        this.fowRT = this.make.renderTexture({ width: 3500, height: 2300 }, false);
        
        // 2. Cria o overlay preto semi-transparente que cobre o mapa
        this.fowOverlay = this.add.rectangle(-100, -50, 3500, 2300, 0x000000, 0.65)
            .setOrigin(0)
            .setDepth(9990); // Acima do cenário e sprites, abaixo da UI

        // 3. Cria o "pincel" de visão (um círculo branco que será desenhado na máscara)
        this.visionBrush = this.make.graphics({ x: 0, y: 0, add: false });
        this.visionBrush.fillStyle(0xffffff, 1);
        this.visionBrush.fillCircle(0, 0, GAME_CONFIG.PLAYER_VISION_RANGE || 600);

        // 4. Aplica a máscara invertida (onde desenharmos branco no RT, o overlay ficará transparente)
        const fowMask = new Phaser.Display.Masks.BitmapMask(this, this.fowRT);
        fowMask.invertAlpha = true;
        this.fowOverlay.setMask(fowMask);
        this.fowOverlay.setVisible(GAME_CONFIG.FOG_OF_WAR_ENABLED);

        // Configurar UI
        UIManager.createSimpleUI(this);

        // --- CRIAR MINIMAPA ---
        const minimapWidth = 200;
        const minimapHeight = 150;
        const minimapX = 10; // Posição X no canto superior esquerdo
        const minimapY = 10; // Posição Y no canto superior esquerdo
        this.minimap = new Minimap(this, minimapX, minimapY, minimapWidth, minimapHeight, { worldWidth: 3300, worldHeight: 2200 });

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

            // Atualiza a QuadTree com a posição de todos os personagens vivos
            const allEntities = [
                ...this.gameManager.players.getChildren(),
                ...this.npcManager.npcs.getChildren()
            ];
            this.meuCenario.updateQuadTree(allEntities);

            this.updateFogOfWar();
            if (this.minimap) {
                this.minimap.update(this.gameManager.players.getChildren(), this.npcManager.npcs.getChildren(), 'player');

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

        // Atualiza a visibilidade do overlay preto
        if (this.fowOverlay) this.fowOverlay.setVisible(isEnabled);
        // Limpa a textura de máscara para redesenhar a visão atual
        if (this.fowRT) this.fowRT.clear();

        // Pega todos os jogadores e todos os NPCs para a checagem
        const players = this.gameManager.players.getChildren();
        const npcs = this.npcManager.npcs.getChildren();
        const allEntities = [...players, ...npcs];

        // Verifica se a configuração global existe e se a Fog of War está ativa
        if (!isEnabled) {
            // Se FOG está DESATIVADO, torna todos visíveisok
            allEntities.forEach(unit => {
                unit.setVisible(true);
            });
            return;
        }

        // Unidades que pertencem ao jogador e dão visão (Soldados)
        const myVisionUnits = players.filter(u => u.active);

        // DESENHA OS BURACOS DE VISÃO: Para cada unidade minha, "fura" o overlay
        myVisionUnits.forEach(u => {
            // Ajusta o tamanho do pincel de visão para o alcance desta unidade específica
            const vRange = u.visionRange || 50;
            this.visionBrush.clear();
            this.visionBrush.fillStyle(0xffffff, 1);
            this.visionBrush.fillCircle(0, 0, vRange);

            // Offset de +100 e +50 porque o RenderTexture e o Overlay começam em (-100, -50)
            this.fowRT.draw(this.visionBrush, u.x + 100, u.y + 50);
        });

        allEntities.forEach(unit => {
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