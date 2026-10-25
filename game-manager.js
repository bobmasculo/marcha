// game-manager.js
export default class GameManager {
    constructor(scene, animManager, netManager, soundManager) {
        this.scene = scene;
        this.players = scene.physics.add.group();
        this.animationManager = animManager; // Armazena a referência
        this.networkManager = null; // OFFLINE ONLY
        this.soundManager = soundManager; // Armazena a referência do som
        this.isOffline = true; // Flag offline sempre true
        this.currentMissionNumber = 1; // Default para missão 1
        this.commander = null;
        this.selectedPlayer = null; 
        this.actionMode = null;
        this.messageProgress = 0; // Progresso do objetivo (0 a 100)
        this.messageCurrentCost = GAME_CONFIG.MESSAGE_INITIAL_COST || 100;
        this.turnEnding = true; // Inicia como TRUE para bloquear o timeout antes do jogo começar
        this.isGameOver = false; // Pausa a simulação e evita telas de fim de jogo duplicadas
        this.isIsometricView = false; // Flag para o modo isométrico
        this.lastRegenTime = 0; // Controle de regeneração do comandante
        this.showShootRange = false; // flag para exibir alcance de tiro
        this.autoRetaliation = true; // Flag para permitir/bloquear o autofire/retaliação
        this.shared = { 
            statsPanelVisible: true, // Flag para controlar a visibilidade do painel de stats
            highlightBox: null,
            shootIndicator: null,
            isDragging: false,
            isMapInteraction: false, // Nova flag para garantir que o clique começou no mapa
            connectedPlayersText: null, // Texto para exibir jogadores conectados
            dragStart: { x: 0, y: 0 },
            dragStartPoint: { x: 0, y: 0 }, // Ponto inicial do clique na tela (screen space)
            dragStartTime: 0, // Nova variável para medir a duração do clique
            lastPointerPos: { x: 0, y: 0 },
            shootRangeGraphics: null,
            statsPanel: null
        };

        // Tornar acessível globalmente para UI
        window.gameManager = this;

        this.setupInput();
        this.setupResizeHandler();

        // UI para jogadores conectados
       // this.shared.connectedPlayersText = this.scene.add.text(10, 10, 'Conectando...', { fontSize: '16px', fill: '#fff', stroke: '#000', strokeThickness: 2 }).setScrollFactor(0).setDepth(10000);

        // Cria a UI de Atributos (Botão e Painel)
        this.createStatsUI();

    }

    setupInput() {
        this.scene.input.topOnly = false;
        this.cursors = this.scene.input.keyboard.createCursorKeys();

        // Teclado shortcuts
        this.scene.input.keyboard.on('keydown-TAB', (event) => {
            event.preventDefault();
            this.selectNextPlayer();
        });

        // Teclas de modo removidas pois agora o clique é contextual
        // this.scene.input.keyboard.on('keydown-V', () => { ... });
        // this.scene.input.keyboard.on('keydown-S', () => { ... });

        // Tecla 'R' para toggle do alcance visual (opcional, já que o botão sumiu)
        this.scene.input.keyboard.on('keydown-R', () => this.toggleRangeVisual());


        // MOVIDO: Painel de Stats agora é na tecla 'U'
        this.scene.input.keyboard.on('keydown-U', () => {
            this.toggleStatsPanelVisibility();
            const status = this.shared.statsPanelVisible ? 'on' : 'off';
            this.showMessage(`Stats Panel ${status}`);
        });

        // TECLA 'I': FAKE ISOMÉTRICO (Estilo Diablo 2:1 - Apenas Squash Y)
        this.scene.input.keyboard.on('keydown-I', () => {
            this.isIsometricView = !this.isIsometricView;
            this.showMessage(this.isIsometricView ? 'Fake ISO (Diablo 2:1): ON' : 'Top-Down View: ON');
        });

        // TECLA 'K': LIGA/DESLIGA AUTOFIRE (RETALIAÇÃO)
        this.scene.input.keyboard.on('keydown-K', () => {
            this.autoRetaliation = !this.autoRetaliation;
            const status = this.autoRetaliation ? 'ENABLED' : 'DISABLED';
            this.showMessage(`Squad Auto-Response: ${status}`);
        });

        // NOVO: Toggle Fog of War
        this.scene.input.keyboard.on('keydown-O', () => {
            if (typeof GAME_CONFIG !== 'undefined') {
                GAME_CONFIG.FOG_OF_WAR_ENABLED = !GAME_CONFIG.FOG_OF_WAR_ENABLED;
                const status = GAME_CONFIG.FOG_OF_WAR_ENABLED ? 'ON' : 'OFF';
                this.showMessage(`Fog of War: ${status}`);
                this.scene.updateFogOfWar(); // Força a atualização visual imediata
            }
        });

        // Zoom In (+ e Numpad +)
        [Phaser.Input.Keyboard.KeyCodes.PLUS, Phaser.Input.Keyboard.KeyCodes.NUMPAD_ADD, Phaser.Input.Keyboard.KeyCodes.EQUALS].forEach(key => {
            this.scene.input.keyboard.addKey(key).on('down', () => {
                this.showMessage('Zoom +');
                this.zoomIn();
            });
        });

        // Zoom Out (- e Numpad -)
        [Phaser.Input.Keyboard.KeyCodes.MINUS, Phaser.Input.Keyboard.KeyCodes.NUMPAD_SUBTRACT, Phaser.Input.Keyboard.KeyCodes.DASH].forEach(key => {
            this.scene.input.keyboard.addKey(key).on('down', () => {
                this.showMessage('Zoom -');
                this.zoomOut();
            });
        });

        // Rastreia o início do clique para diferenciar clique de arrasto com precisão
        this.scene.input.on('pointerdown', (pointer, currentlyOver) => {
            // Verifica se o mouse está sobre algum objeto de UI (Depth >= 10000)
            const clickedOnUI = currentlyOver && currentlyOver.some(obj => obj.depth >= 10000);

            // Se clicou em um objeto de UI ou na área da barra, bloqueia interação com o mapa
            if (clickedOnUI || this.isPointerInUIArea(pointer)) {
                this.shared.isMapInteraction = false;
                return;
            }
            this.shared.isMapInteraction = true;
            this.shared.dragStartPoint = { x: pointer.x, y: pointer.y };
            this.shared.dragStartTime = this.scene.time.now;
            this.shared.isDragging = false;
        });

        // Clique no mapa
        this.scene.input.on('pointerup', (pointer) => {
            // Se a interação não começou no mapa (ex: começou na UI), ignora completamente
            if (!this.shared.isMapInteraction) return;
            this.shared.isMapInteraction = false;

            // Ignora se não for o botão esquerdo (0)
            if (pointer.button !== 0) return;

            // Se a flag de arrasto estiver ativa, significa que o usuário estava movendo a câmera.
            // Finalizamos o arrasto aqui e impedimos que isso seja contado como um clique no mapa.
            if (this.shared.isDragging) {
                this.shared.isDragging = false;
                document.body.style.cursor = 'default';
                return;
            }

            // Cálculo manual da distância para garantir precisão (evita bugs do getDistance)
            const startX = this.shared.dragStartPoint.x;
            const startY = this.shared.dragStartPoint.y;
            const dist = Phaser.Math.Distance.Between(startX, startY, pointer.x, pointer.y);
            const duration = this.scene.time.now - this.shared.dragStartTime;

            // Aumentamos a duração permitida para 500ms para ser mais tolerante a cliques lentos
            if (dist < 15 && duration < 500) {
                this.handleMapClick(pointer);
            }
        });

        // Garante que o estado de drag seja limpo se o mouse for solto fora da tela
        this.scene.input.on('pointerupoutside', () => {
            this.shared.isMapInteraction = false;
            if (this.shared.isDragging) {
                this.shared.isDragging = false;
                document.body.style.cursor = 'default';
            }
        });
    }

    zoomIn() {
        const cam = this.scene.cameras.main;
        const newZoom = Phaser.Math.Clamp(cam.zoom + 0.2, 0.5, 3);
        cam.zoomTo(newZoom, 300);
    }

    zoomOut() {
        const cam = this.scene.cameras.main;
        const newZoom = Phaser.Math.Clamp(cam.zoom - 0.2, 0.5, 3);
        cam.zoomTo(newZoom, 300);
    }

    setupResizeHandler() {
        this.scene.scale.on('resize', (gameSize) => {
            const { width, height } = gameSize;
            this.scene.cameras.main.setViewport(0, 0, width, height);
            // Chama o UIManager para reposicionar todos os elementos da UI.
            // Isso garante que a UI se ajuste corretamente ao novo tamanho da tela.
            if (window.UIManager) {
                window.UIManager.repositionUI(this.scene);
            }
        });
    }

    // Modos de ação
    toggleMoveMode() {
        if (this.actionMode === 'move') {
            this.setActionMode(null);
        } else {
            this.setActionMode('move');
        }
    }

    toggleShootMode() {
        if (this.actionMode === 'shoot') {
            this.setActionMode(null);
        } else {
            this.setActionMode('shoot');
        }
    }

    setActionMode(mode) {
        this.actionMode = mode;
        this.updateUIMode();

        if (mode === 'shoot' && this.selectedPlayer) {
            this.createShootVisuals();
        } else {
            this.removeShootVisuals();
        }

        // Atualizar UI
        UIManager.updateButtonStates();
    }

    // Player management
    createPlayer(x, y, playerType, id, name) {
        // Pega a configuração específica para este tipo de jogador
        const config = PLAYER_CONFIGS[playerType];
        if (!config) {
            console.error(`[GameManager] Configuração não encontrada para playerType: ${playerType}`);
            return null;
        }

        // Cria o sprite usando a 'textureKey' da configuração (ex: 'player1')
        const player = this.scene.physics.add.sprite(x, y, config.textureKey)
            .setOrigin(0.5, 1)
            .setCollideWorldBounds(true);

        // Prioriza largura e altura exatas se definidas em PLAYER_CONFIGS
        if (config.width && config.height) {
            player.setDisplaySize(config.width, config.height);
        } else if (config.scale) {
            player.setScale(config.scale);
        }

        // CORREÇÃO CRÍTICA: setSize usa valores NÃO ESCALADOS.
        // Reduzimos a hitbox para focar nos pés (30% da altura), permitindo deslizar em quinas.
        const unscaledWidth = config.frameWidth;
        const unscaledHeight = config.frameHeight;
        
        // SOLUÇÃO ROBUSTA: Usa um corpo CIRCULAR apenas na base (pés).
        // Círculos deslizam em quinas sem prender e não sofrem com erros de precisão retangular.
        const radius = Math.floor(unscaledWidth * 0.2); // Raio de 20% da largura do frame
        player.body.setCircle(radius);
        // Alinha o círculo exatamente no centro inferior do sprite
        const offsetX = (unscaledWidth / 2) - radius;
        const offsetY = unscaledHeight - (radius * 2); // Alinha o círculo na base do sprite
        player.body.setOffset(offsetX, offsetY);
        player.setBounce(0);
        player.setFriction(0); // Garante que o corpo deslize perfeitamente sem "grudar"

        player.id = id; // O ID agora é o socket.id do servidor
        player.name = name || id; // <--- Agora usa o nome vindo do config.js
        player.playerType = playerType; // ESSENCIAL para que outros sistemas saibam qual config usar
        player.team = 'player';
        player.health = GAME_CONFIG.MAX_HEALTH;
        player.visionRange = config.visionRange || 600;
        player.weapon = config.weapon || 'pistol'; // Atribui arma padrão da config
        player.hasKillBonus = false;
        player.inventory = []; // Inicializa inventário vazio
        player.coins = 0;

        player.setDepth(y);

        const idleFrame = config.animationFrames.idle[0];
        player.setFrame(idleFrame);

        // Barra de Vida Visual
        player.healthBar = this.scene.add.graphics().setDepth(player.depth + 1);
        this.drawHealthBar(player.healthBar, 40, 6, player.health / GAME_CONFIG.MAX_HEALTH);

        player.setInteractive({ useHandCursor: true });
        player.on('pointerdown', () => {
            if (this.actionMode === 'shoot') return;
            // Apenas o comandante pode ser selecionado manualmente
            if (player === this.commander) this.selectPlayer(player);
        });

        this.animationManager.createPlayerAnimations(player);
        this.updateConnectedPlayersText();
        return player;
    }

    /**
     * Desenha a barra de vida em um objeto Graphics.
     */
    drawHealthBar(graphics, width, height, percentage) {
        graphics.clear();
        if (percentage <= 0) return;
        // Fundo (Preto)
        graphics.fillStyle(0x000000, 0.7);
        graphics.fillRect(-width / 2, -height / 2, width, height);
        // Barra (Verde/Amarelo/Vermelho)
        const color = percentage > 0.5 ? 0x00ff00 : (percentage > 0.2 ? 0xffff00 : 0xff0000);
        graphics.fillStyle(color, 1);
        graphics.fillRect(-width / 2 + 1, -height / 2 + 1, Math.max(0, (width - 2) * percentage), height - 2);
    }

    setLocalPlayerId(id) {
        // Esta função não é mais necessária
    }

    // --- MODO OFFLINE: SETUP E LÓGICA ---
    setupOfflineGame(missionNumber = 1) {
        console.log('[GameManager] Configurando jogo OFFLINE...');
        this.currentMissionNumber = Number(missionNumber);

        // Cria o LÍDER (Único Player)
        const cfg = PLAYER_SETUP;
        this.commander = this.createPlayer(cfg.x, cfg.y, cfg.type, 'player_leader', cfg.name);
        this.players.add(this.commander);
        
        this.commander.coins = GAME_CONFIG.INITIAL_COINS;

        const stats = PLAYER_CONFIGS[cfg.type];
        this.commander.armor = stats.armor || GAME_CONFIG.ARMOR;
        this.commander.weaponStrength = stats.weaponStrength || GAME_CONFIG.WEAPON_STRENGTH;
        this.commander.weapon = stats.weapon || 'pistol';

        // Centraliza a câmera no player
        this.scene.cameras.main.centerOn(this.commander.x, this.commander.y);

        // SELECIONA O COMANDANTE AUTOMATICAMENTE NO INÍCIO
        this.selectPlayer(this.commander);

        // Inicializa visuais e mostra o aviso de missão
        this.updateUI();
        this.turnEnding = false;
    }

    /**
     * Executa a transmissão da mensagem para avançar no objetivo principal.
     */
    transmitMessage() {
        if (!this.commander || this.commander.coins < this.messageCurrentCost) {
            this.showMessage(`Need $${this.messageCurrentCost} to transmit!`);
            return;
        }

        this.commander.coins -= this.messageCurrentCost;
        this.messageProgress += GAME_CONFIG.MESSAGE_PROGRESS_PER_CLICK || 10;
        this.messageCurrentCost *= 2; // Dobra o custo a cada clique

        // Efeito visual de rádio
        if (this.scene.shotManager && this.commander) {
            this.scene.shotManager.createRadioWaveEffect(this.commander.x, this.commander.y - 40);
        }

        this.showMessage(`Transmission: ${this.messageProgress}% complete!`);
        this.updateUI();

        if (this.messageProgress >= 100) {
            this.messageProgress = 100;
            this.handleGameOver({ winner: 'player', reason: 'Communication Restored!' });
        }
    }

    /**
     * Calcula o custo dinâmico: Initial * 2 ^ (unidades vivas desse tipo)
     */
    getUnitCost(type) {
        const initialCost = GAME_CONFIG.UNIT_COSTS[type] || 10;
        const count = this.players.getChildren().filter(p => p && p.active && p.health > 0 && p.playerType === type).length;
        return initialCost * Math.pow(2, count);
    }

    spawnUnit(type) {
        const cost = this.getUnitCost(type);
        if (!this.commander || this.commander.coins < cost) {
            this.showMessage(`Need ${cost} coins to spawn ${type}!`);
            return;
        }

        this.commander.coins -= cost;

        // Descobre quantos seguidores já existem para atribuir o próximo slot na formação
        const followerCount = this.players.getChildren().filter(p => p.isFollower).length;

        // Spawn perto do comandante
        const spawnX = this.commander.x + Phaser.Math.Between(-60, 60);
        const spawnY = this.commander.y + Phaser.Math.Between(-60, 60);
        const id = `${type}_${Date.now()}`;
        const unit = this.createPlayer(spawnX, spawnY, type, id, type.charAt(0).toUpperCase() + type.slice(1));
        this.players.add(unit);
        
        // Configura para seguir o comandante
        unit.isFollower = true;
        unit.formationSlotIndex = followerCount; // Define o lugar dele no triângulo
        this.updateUI(); // Atualiza a UI DEPOIS de adicionar ao grupo para o custo subir corretamente
        this.showMessage(`${type.toUpperCase()} deployed!`);
    }

    /**
     * Aciona a retaliação dos companheiros de equipe quando um personagem é atacado por um NPC.
     * @param {Phaser.GameObjects.Sprite} attackedPlayer O jogador que sofreu o ataque.
     * @param {Phaser.GameObjects.Sprite} npcAttacker O NPC que realizou o ataque.
     */
    triggerTeamRetaliation(attackedPlayer, npcAttacker) {
        // 1. Verifica se a retaliação global está ativa
        if (!this.autoRetaliation) return;

        const teammates = this.players.getChildren().filter(p =>
            p.active &&
            p.health > 0 &&
            p.team === attackedPlayer.team
        );

        let staggerDelay = 0;

        teammates.forEach((teammate) => {
            const dist = Phaser.Math.Distance.Between(teammate.x, teammate.y, npcAttacker.x, npcAttacker.y);
            const hasLoS = this.scene.meuCenario.checkLineOfSight(teammate.x, teammate.y, npcAttacker.x, npcAttacker.y);

            if (dist <= (GAME_CONFIG.SHOOT_DISTANCE || 450) && hasLoS) {
                // Agenda a sequência de retaliação para este companheiro de equipe de forma escalonada
                this.scene.time.addEvent({
                    delay: staggerDelay,
                    callback: () => {
                        // Re-verifica se as condições ainda são válidas (NPC ainda vivo e atirador ativo)
                        if (npcAttacker.health <= 0 || !teammate.active || teammate.health <= 0) return;

                        console.log(`[Retaliation] ${teammate.id} is in range and will retaliate.`);
                
                        // Fase 1: Mira (Vira o personagem)
                        const aimAngle = Phaser.Math.Angle.Between(teammate.x, teammate.y, npcAttacker.x, npcAttacker.y);
                        const aimDirection = this.getDirectionFromAngle(Phaser.Math.RadToDeg(aimAngle));
                        if (this.animationManager) this.animationManager.setAimFrame(teammate, aimDirection);

                        // Fase 2: Disparo (300ms após iniciar a mira)
                        this.scene.time.addEvent({
                            delay: 300,
                            callback: () => {
                                if (npcAttacker.health <= 0 || !teammate.active || teammate.health <= 0) return;
                                this.executeRemoteShoot(teammate, npcAttacker.x, npcAttacker.y);
                                this.resolveOfflineShot(teammate, npcAttacker.x, npcAttacker.y);
                            }
                        });
                    }
                });

                // Incrementa o delay para o próximo soldado (300ms mira + 700ms intervalo pós-tiro)
                staggerDelay += 1000;
            }
        });
    }

    restartGame(characters) {
        // 1. Limpa todos os jogadores e seus elementos de UI
        this.players.getChildren().forEach(p => {
            if (p.healthBar) p.healthBar.destroy();
            p.destroy();
        });
        this.players.clear(true, true);

        // 2. Reseta o estado do GameManager
        this.selectedPlayer = null;
        this.setActionMode(null);
        this.removeShootVisuals();
        if (this.shared.highlightBox) this.shared.highlightBox.setVisible(false);

        // 3. Recria o jogo 
        this.setupOfflineGame(this.currentMissionNumber);

        // 4. Seleciona o primeiro personagem do time
        this.selectPlayer(this.players.getChildren()[0]);
        this.showMessage('Game Restarted!');
    }

    removePlayer(playerId) {
        const playerToRemove = this.players.getChildren().find(p => p.id === playerId);
        if (playerToRemove) {
            if (playerToRemove.healthBar) playerToRemove.healthBar.destroy();
            playerToRemove.destroy();
        }
    }

    getPlayerById(id) {
        return this.players.getChildren().find(p => p.id === id);
    }

    selectPlayer(player) {
        if (player.health <= 0) {
            this.showMessage('This player is out of combat!');
            return;
        }

        // 2. Em RTS, sempre permitimos selecionar nossas unidades.
        // 3. Se todas as condições forem atendidas, seleciona o jogador.
        this.selectedPlayer = player;
        
        // Centraliza a câmera no jogador selecionado com uma animação suave (500ms)
        this.scene.cameras.main.pan(player.x, player.y, 500, 'Power2');
        
        this.setActionMode(null);

        this.removeShootVisuals();
        this.createHighlightBox(player);
        this.updateUI();
        this.updateStatsPanel(); // Atualiza o painel de stats com o novo jogador

        console.log(`Player selected: ${player.name}`);
    }

    selectNextPlayer() {
        // Agora o TAB volta a funcionar para alternar entre os personagens do seu time
        // Restringido para selecionar apenas o comandante
        const allPlayers = this.players.getChildren().filter(p => p && p.health > 0 && p === this.commander);
        if (allPlayers.length === 0) return;

        let currentIndex = 0;
        if (this.selectedPlayer && this.selectedPlayer.health > 0) {
            currentIndex = allPlayers.findIndex(p => p === this.selectedPlayer);
        }

        const nextIndex = (currentIndex + 1) % allPlayers.length;
        const nextPlayer = allPlayers[nextIndex];

        if (nextPlayer) {
            this.selectPlayer(nextPlayer);
        }
    }

    getFirstPlayerOfTeam(team) {
        return this.players.getChildren().find(p => p.team === team);
    }

    createHighlightBox(player) {
        const config = PLAYER_CONFIGS[player.playerType];
        if (!config) {
            console.error(`[GameManager] Configuração não encontrada para o tipo de jogador: ${player.playerType}`);
            return;
        }

        const highlightX = player.x;
        const highlightY = player.y + config.highlightOffset;
        // Usa as dimensões de exibição reais do sprite (considerando setDisplaySize ou scale)
        const highlightWidth = player.displayWidth + 10;
        const highlightHeight = player.displayHeight + 10;

        if (!this.shared.highlightBox) {
            this.shared.highlightBox = this.scene.add.rectangle(highlightX, highlightY, highlightWidth, highlightHeight)
                .setStrokeStyle(3, 0x66ccff)
                .setDepth(1000);
        } else {
            this.shared.highlightBox.setPosition(highlightX, highlightY)
                .setSize(highlightWidth, highlightHeight)
                .setStrokeStyle(3, 0x66ccff)
                .setVisible(true);
        }
    }

    // Visuals de tiro
    createShootVisuals() {
        if (!this.selectedPlayer) return;

        if (!this.shared.shootIndicator) {
            this.shared.shootIndicator = this.scene.add.circle(0, 0, 20, 0xff0000, 0.3)
                .setDepth(1000)
                .setVisible(false); // Começa invisível

            // Efeito de pulso (aumenta e diminui)
            this.scene.tweens.add({
                targets: this.shared.shootIndicator,
                scale: { from: 1, to: 1.3 },
                alpha: { from: 0.3, to: 0.6 },
                duration: 600,
                yoyo: true,
                repeat: -1
            });
        }
    }

    // Alterna a visualização do alcance de tiro (círculo vermelho)
    toggleRangeVisual() {
        this.showShootRange = !this.showShootRange;

        // Se ativado, definir centro do overlay para jogador selecionado ou para o centro da câmera
        if (this.showShootRange) {
            if (this.selectedPlayer) {
                this.shared.shootRangeCenter = { x: this.selectedPlayer.x, y: this.selectedPlayer.y };
            } else {
                // centro da câmera
                const cam = this.scene.cameras.main;
                const centerX = cam.scrollX + cam.width / 2;
                const centerY = cam.scrollY + cam.height / 2;
                this.shared.shootRangeCenter = { x: centerX, y: centerY };
                this.showMessage('Range activated (no player selected). Select a player to anchor.');
            }
        } else {
            // desligando limpar gráficos (será limpo no updatePlayerUI)
            if (this.shared.shootRangeOverlay) {
                this.shared.shootRangeOverlay.clear();
                this.shared.shootRangeOverlay.destroy();
                this.shared.shootRangeOverlay = null;
            }
            if (this.shared.shootRangeMaskGraphics) {
                this.shared.shootRangeMaskGraphics.clear();
                this.shared.shootRangeMaskGraphics.destroy();
                this.shared.shootRangeMaskGraphics = null;
            }
            this.shared.shootRangeCenter = null;
        }

        if (window.uiBar) {
            // atualizar botões para refletir estado
            UIManager.updateButtonStates();
        }
    }

    removeShootVisuals() {
        if (this.shared.shootIndicator) {
            this.shared.shootIndicator.destroy();
            this.shared.shootIndicator = null;
        }
    }

    // Map interaction
    handleMapClick(pointer) {
        if (this.isPointerInUIArea(pointer) || this.shared.isDragging) return;
        if (!this.selectedPlayer) return;

        const clickedNpc = this.getNpcAt(pointer.worldX, pointer.worldY);

        if (clickedNpc) {
            // Se clicar em um NPC, tenta atirar
            this.executeShoot(clickedNpc.x, clickedNpc.y, clickedNpc);
            return;
        }

        // Se clicar no chão, move automaticamente (SNAP TO GRID)
        const cellSize = this.scene.meuCenario.cellSize || 50;
        const targetX = Math.floor(pointer.worldX / cellSize) * cellSize + cellSize / 2;
        const targetY = Math.floor(pointer.worldY / cellSize) * cellSize + cellSize / 2;

        // Verifica se está bloqueado antes de mover
        if (this.scene.meuCenario.isWorldPositionBlocked(targetX, targetY)) {
            this.showMessage("Position blocked!");
            return;
        }
        this.moveSelectedPlayer(targetX, targetY);
    }

    isPointerInUIArea(pointer) {
        // Compara a posição Y do mouse (tela) com a altura da barra de UI configurada
        return pointer.y >= (this.scene.scale.height - GAME_CONFIG.UI_BAR_HEIGHT);
    }

    getPlayerAt(x, y) {
        return this.players.getChildren().find(p =>
            p && p.health > 0 && p.getBounds().contains(x, y)
        );
    }

    getNpcAt(x, y) {
        if (!this.scene.npcManager || !this.scene.npcManager.npcs) return null;
        return this.scene.npcManager.npcs.getChildren().find(n => 
            n.active && n.visible && n.getBounds().contains(x, y)
        );
    }

    // Ações do jogador
    moveSelectedPlayer(targetX, targetY) {
        const player = this.selectedPlayer;
        
        // Usa o PathManager para encontrar o caminho
        this.scene.pathManager.findPath(player.x, player.y, targetX, targetY, (path) => {
            if (path && path.length > 0) {
                // Limita o caminho à distância máxima de movimento
                let totalDist = 0;
                let limitedPath = [new Phaser.Math.Vector2(player.x, player.y)]; // Começa da posição exata do jogador
                for (let i = 0; i < path.length; i++) {
                    const segmentDist = Phaser.Math.Distance.Between(limitedPath[limitedPath.length - 1].x, limitedPath[limitedPath.length - 1].y, path[i].x, path[i].y);
                    if (totalDist + segmentDist > GAME_CONFIG.MAX_MOVE_DISTANCE) {
                        this.showMessage(`Destination exceeds move limit (${GAME_CONFIG.MAX_MOVE_DISTANCE}px). Moving as far as possible.`);
                        break; // Para de adicionar pontos ao caminho
                    }
                    totalDist += segmentDist;
                    limitedPath.push(path[i]);
                }

                player.path = limitedPath;
                player._pendingPath = limitedPath; 
            player._lastDistToTarget = Infinity; // Reinicia rastreador de progresso
            player._stuckFrames = 0;
                // Calcula o ângulo alvo para o primeiro waypoint
                player.targetRotation = Phaser.Math.Angle.Between(player.x, player.y, limitedPath[1].x, limitedPath[1].y);
                player.currentPathIndex = 1; // Começa no primeiro waypoint do caminho encontrado
                this.updateUI();
                this.setActionMode(null);
                this.spawnClickFX(limitedPath[limitedPath.length - 1].x, limitedPath[limitedPath.length - 1].y);
            } else {
                this.showMessage('Cannot find a path to that location.');
            }
        });
    }

    executeShoot(targetX, targetY, targetEntity = null, shooter = this.selectedPlayer) {
        if (!shooter) return;

        // Forçar parada do movimento ao atirar para não sobrescrever animação
        shooter.setVelocity(0, 0);
        shooter.path = null;
        shooter.target = null;

        const weaponKey = shooter.weapon || 'pistol';
        const weaponConfig = WEAPONS[weaponKey] || WEAPONS['pistol'];

        const dist = Phaser.Math.Distance.Between(shooter.x, shooter.y, targetX, targetY);
        if (dist > weaponConfig.range) {
            this.showMessage('Target too far!');
            return;
        }

        // Ajustar frame/animação instantaneamente para a direção do tiro (manter dentro do quadrado)
        const aimAngle = Phaser.Math.Angle.Between(shooter.x, shooter.y, targetX, targetY);
        const aimDirection = this.getDirectionFromAngle(Phaser.Math.RadToDeg(aimAngle));

        // MUDANÇA: Agora usa playShootAnimation para disparar a sequência completa de frames
        if (this.animationManager) this.animationManager.playShootAnimation(shooter, aimDirection);

        const isSelectedShooter = shooter === this.selectedPlayer;
        if (isSelectedShooter) this.updateUI();
        
        // Tocar som de tiro
        if (this.soundManager) this.soundManager.playShoot();

        // Calcula a posição inicial do tiro a partir da ponta da arma
        const typeKey = shooter.playerType || (shooter.getData ? shooter.getData('type') : null);
        const config = PLAYER_CONFIGS[typeKey] || (typeof NPC_CONFIGS !== 'undefined' ? NPC_CONFIGS[typeKey] : null);
        const muzzleOffset = (config && config.muzzleOffset) ? config.muzzleOffset : { x: 0, y: 0 };
        const startX = shooter.x + muzzleOffset.x;
        const startY = shooter.y + muzzleOffset.y;

        // Chama o ShotManager para o efeito visual
        if (weaponConfig.shootType === 'game_feel_rifle') {
            this.scene.shotManager.fireGameFeelProjectile_rifle(startX, startY, targetX, targetY, 0, false, shooter, weaponConfig);
        } else {
            this.scene.shotManager.fireGameFeelProjectile(startX, startY, targetX, targetY, 0, false, shooter, weaponConfig);
        }
        this.resolveOfflineShot(shooter, targetX, targetY); // Lógica de dano offline
        // Só o tiro do jogador limpa o modo de ação; o autofire dos soldados não pode cancelá-lo
        if (isSelectedShooter) {
            this.setActionMode(null);
            this.removeShootVisuals();
        }
    }

    // Resolve o tiro localmente (cálculo de dano)
    resolveOfflineShot(shooter, targetX, targetY) {
        // Procura alvo no raio
        let target = this.findNearestEnemy(shooter, targetX, targetY, 50);
        
        // Se não achou jogador, procura NPC
        if (!target) {
            // Busca NPC por proximidade em um raio de 60px para evitar erros de precisão da IA
            target = this.scene.npcManager.npcs.getChildren().find(n => 
                n.active && n.visible && Phaser.Math.Distance.Between(targetX, targetY, n.x, n.y) <= 60
            );
        }
        // Dados para o dado (simulação visual)
        const rollData = { x: targetX, y: targetY, roll: 0, targetNumber: 0, isHit: false, isCritical: false };

        if (target) {
            const s = shooter.weaponStrength || GAME_CONFIG.WEAPON_STRENGTH;
            const t = target.armor || GAME_CONFIG.ARMOR;

            // Tabela de acerto (copiada do server)
            const isHit = true; // SEMPRE ACERTA conforme solicitado
            
            rollData.roll = 1;
            rollData.targetNumber = 1;
            rollData.isHit = isHit;
            rollData.isCritical = false;

            if (isHit) {
                // Usa a constante global de dano do jogador
                let damage = GAME_CONFIG.PLAYER_DAMAGE || 1;

                console.log(`[COMBAT] Atirador: ${shooter.id} | Dano: ${damage}`);

                const targetNpcId = target.getData ? target.getData('id') : null;
                if (targetNpcId && typeof targetNpcId === 'string' && targetNpcId.startsWith('npc')) {
                    this.handleNpcDamage({ npcId: targetNpcId, damage: damage });
                    
                    // RETALIAÇÃO DO NPC: O NPC agora foca em quem o atacou
                    const npc = this.scene.npcManager.npcs.getChildren().find(n => n.getData('id') === targetNpcId);
                    if (npc && npc.active) {
                        npc.setData('targetPlayer', { id: shooter.id, x: shooter.x, y: shooter.y });
                        npc.setData('isEngaged', true);
                        npc.setData('isChasing', true);
                        npc.setData('lastKnownTargetPos', { x: shooter.x, y: shooter.y });
                    }
                } else {
                    this.updateCharacterHealth(target.id, target.health - damage);
                }
            }
        } else {
            rollData.roll = Math.floor(Math.random() * 6) + 1; // Rola só pra mostrar efeito
        }
        this.showDiceRoll(rollData);
    }

    // Executa um tiro vindo de um jogador remoto
    executeRemoteShoot(shooter, targetX, targetY) {
        if (!shooter) return;

        // Vira o sprite do atirador na direção do tiro
        const aimAngle = Phaser.Math.Angle.Between(shooter.x, shooter.y, targetX, targetY);
        const aimDirection = this.getDirectionFromAngle(Phaser.Math.RadToDeg(aimAngle));
        
        // Aplica o frame de mira visualmente
        // MUDANÇA: Garante que tiros remotos/IA também toquem a animação completa
        if (this.animationManager) this.animationManager.playShootAnimation(shooter, aimDirection);

        // Calcula a posição inicial do tiro a partir da ponta da arma
        // Tenta obter a configuração tanto de jogadores quanto de NPCs para evitar erros de undefined
        const typeKey = shooter.playerType || (shooter.getData ? shooter.getData('type') : null);
        const config = PLAYER_CONFIGS[typeKey] || (typeof NPC_CONFIGS !== 'undefined' ? NPC_CONFIGS[typeKey] : null);
        const muzzleOffset = (config && config.muzzleOffset) ? config.muzzleOffset : { x: 0, y: 0 };
        const startX = shooter.x + muzzleOffset.x;
        const startY = shooter.y + muzzleOffset.y;

        // Chama o ShotManager para o efeito visual correto
        if (shooter.weapon === 'shotgun') {
            this.scene.shotManager.fireGameFeelProjectile_rifle(startX, startY, targetX, targetY, 0, false, shooter);
        } else {
            this.scene.shotManager.fireGameFeelProjectile(startX, startY, targetX, targetY, 0, false, shooter);
        }
        const displayId = shooter.id || (shooter.getData ? shooter.getData('id') : "Unit");
        this.showMessage(`${displayId.substring(0, 5)} fired!`);
    }

    findNearestEnemy(shooter, targetX, targetY, maxDistance = 50) {
        let targetPlayer = null;
        let minDist = Infinity;

        this.players.getChildren().forEach(p => {
            if (!p || p === shooter || p.team === shooter.team || p.health <= 0) return;

            const d = Phaser.Math.Distance.Between(p.x, p.y, targetX, targetY);
            if (d < maxDistance && d < minDist) {
                minDist = d;
                targetPlayer = p;
            }
        });

        return targetPlayer;
    }

    // Nova função para atualizar a vida com base nos dados do servidor
    updateCharacterHealth(characterId, newHealth, attacker = null) {
        const target = this.getPlayerById(characterId);
        if (!target) return;

        // Proteção extra contra corrupção de estado por valores NaN
        if (isNaN(newHealth)) {
            console.error(`[GameManager] Erro fatal: Tentativa de definir vida como NaN para ${characterId}`);
            return;
        }

        const oldHealth = target.health;
        
        // FIX: Mostrar texto flutuante de dano para feedback visual (NPCs e Tiros)
        if (newHealth < oldHealth) {
            const damage = Math.round(oldHealth - newHealth);

            // REAÇÃO AO TIRO: Para o movimento do personagem imediatamente
            target.path = null;
            target.target = null;
            target.setVelocity(0, 0);

            // Se houver um atacante NPC, vira para ele (dar target visual)
            if (attacker && (attacker.id || (attacker.getData && attacker.getData('id')))) {
                const angle = Phaser.Math.Angle.Between(target.x, target.y, attacker.x, attacker.y);
                const direction = this.getDirectionFromAngle(Phaser.Math.RadToDeg(angle));
                if (this.animationManager) this.animationManager.setAimFrame(target, direction);
            }

            this.showFloatingText(target.x, target.y - 60, `-${damage}`, '#ff0000');
        }

        target.health = newHealth;

        // Atualiza a barra de vida visual
        this.drawHealthBar(target.healthBar, 40, 6, target.health / GAME_CONFIG.MAX_HEALTH);

        // Se tomou dano, toca som de machucado
        if (newHealth < oldHealth && this.soundManager) {
            this.soundManager.playHit();
        }

        // Lógica de morte
        if (target.health <= 0 && oldHealth > 0) {
            if (target.healthBar) target.healthBar.setVisible(false);
            this.showMessage(`${target.name} was eliminated!`);

            // Se o comandante morrer, o jogo acaba (Derrota)
            if (target === this.commander) {
                this.handleGameOver({ winner: 'enemy', reason: 'Commander Defeated' });
            } else if (target.playerType === 'soldado' || target.playerType === 'minerador') {
                // Se for soldado ou minerador, o corpo fica no chão
                target.setActive(false);
                if (target.body) target.body.setEnable(false);
                target.setAlpha(0.4); // Mais transparente para parecer um corpo
                target.setDepth(-0.5); // Fica abaixo das unidades vivas mas acima do chão (-1)
                target.anims.stop();
                target.isFollower = false; // Para de seguir o comandante
                target.path = null;
                target.target = null;
            } else {
                target.setAlpha(0.3).setActive(false).setVisible(false);
            }

            this.updateUI(); // Força atualização dos preços na UI após a morte
            this.checkVictoryCondition(); // Verifica vitória imediatamente no modo offline
        }

        // Atualiza a UI se o personagem morto era o selecionado
        if (this.selectedPlayer === target) this.updateUI();
        if (this.selectedPlayer === target) this.updateStatsPanel();

        // LÓGICA DE RETALIAÇÃO
        const attackerId = (attacker && attacker.getData) ? attacker.getData('id') : null;
        if (attackerId && typeof attackerId === 'string' && attackerId.startsWith('npc')) {
            this.triggerTeamRetaliation(target, attacker);
        }
    }

    // Nova função para aplicar dano em NPC vindo do servidor
    handleNpcDamage({ npcId, damage }) {
        if (!this.scene.npcManager || !this.scene.npcManager.npcs) return;
        
        const npc = this.scene.npcManager.npcs.getChildren().find(n => n.getData('id') === npcId);
        if (npc) {
            // Aplica dano direto na propriedade health do sprite
            if (typeof npc.health === 'undefined') npc.health = GAME_CONFIG.NPC_MAX_HEALTH; // Fallback
            
            npc.health = Math.max(0, npc.health - damage);
            
            this.showFloatingText(npc.x, npc.y - 40, `-${damage}`, '#ff0000');
            if (this.soundManager) this.soundManager.playHit();

            if (npc.health <= 0) {
                npc.health = 0;
                if (npc.healthBar) npc.healthBar.setVisible(false);
                if (npc.body) {
                    npc.body.stop();
                    npc.body.enable = false;
                }
                if (npc.healthText) npc.healthText.setVisible(false);
                this.showMessage('NPC Eliminated!');

                // Toca a animação de morte definida no config.js
                const type = npc.getData('type');
                const deathAnim = `npc_${type}_morto`;
                if (this.scene.anims.exists(deathAnim)) {
                    npc.play(deathAnim);
                    // Opcional: faz o corpo sumir após alguns segundos
                    this.scene.time.delayedCall(3000, () => { if(npc.active) npc.setVisible(false).setActive(false); });
                } else {
                    npc.setActive(false).setVisible(false);
                }
                
                // Lógica de Drop Offline
                if (Math.random() < 0.9) { // Aumentado para 90% de chance de drop total
                    // Novos Pesos: Moeda(20%), Shotgun(20%), Medkit(20%), Nuclear Bomb(25%), Bomb(15%)
                    const rand = Math.random();
                    let itemId = rand < 0.20 ? 'moeda' : (rand < 0.40 ? 'shotgun' : (rand < 0.60 ? 'medkit' : (rand < 0.85 ? 'nuclear_bomb' : 'bomb')));
                    
                    const drop = {
                        id: `drop_${Date.now()}_${Math.floor(Math.random()*1000)}`,
                        itemId: itemId,
                        x: npc.x,
                        y: npc.y
                    };
                    this.scene.npcManager.handleItemDropped(drop);
                }
            } else {
                // ATUALIZAÇÃO: Redesenha a barra de vida do NPC com a nova porcentagem
                const config = NPC_CONFIGS[npc.getData('type')];
                this.scene.npcManager.drawHealthBar(npc.healthBar, 30, 4, npc.health / (config.health || GAME_CONFIG.NPC_MAX_HEALTH));

                if (npc.healthText) npc.healthText.setText(npc.health.toString());
                this.showMessage(`NPC hit! HP: ${npc.health}`);
            }
        }
    }

    // Efeitos visuais
    spawnClickFX(x, y) {
        if (window.destinationMarker) window.destinationMarker.destroy();

        window.destinationMarker = this.scene.add.circle(x, y, 8, 0x00ff00, 0.7)
            .setDepth(2000);

        this.scene.tweens.add({
            targets: window.destinationMarker,
            scale: 1.5,
            alpha: 0.3,
            yoyo: true,
            repeat: -1,
            duration: 400
        });
    }

    // Helper para mostrar texto flutuante (usado para dano em NPC)
    showFloatingText(x, y, message, color) {
        const text = this.scene.add.text(x, y, message, {
            fontSize: '20px',
            fill: color,
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2000);

        this.scene.tweens.add({
            targets: text, y: y - 50, alpha: 0, duration: 1000,
            onComplete: () => text.destroy()
        });
    }

    // Processa efeitos visuais vindos do servidor
    handleSpawnEffect(data) {
        if (data.type === 'blood') {
            this.createBloodEffect(data.x, data.y);
        } else if (data.type === 'explosion') {
            this.createExplosionEffect(data.x, data.y);
        }
    }

    // Cria uma explosão de partículas de sangue usando sprites e tweens
    createBloodEffect(x, y) {
        for (let i = 0; i < 8; i++) {
            const particle = this.scene.add.image(x, y, 'blood_particle').setDepth(2000);
            const angle = Phaser.Math.Between(0, 360);
            const speed = Phaser.Math.Between(50, 150);
            const duration = Phaser.Math.Between(300, 600);
            
            const velocityX = Math.cos(Phaser.Math.DegToRad(angle)) * speed;
            const velocityY = Math.sin(Phaser.Math.DegToRad(angle)) * speed;
            
            this.scene.tweens.add({
                targets: particle,
                x: x + (velocityX * (duration / 1000)),
                y: y + (velocityY * (duration / 1000)),
                alpha: 0,
                scale: 0.5,
                duration: duration,
                onComplete: () => particle.destroy()
            });
        }
    }

    createExplosionEffect(x, y) {
        const explosion = this.scene.add.circle(x, y, 10, 0xffa500, 1).setDepth(2000);
        
        this.scene.tweens.add({
            targets: explosion,
            scale: 10, // Expande para cobrir o raio
            alpha: 0,
            duration: 500,
            onComplete: () => explosion.destroy()
        });

        // Texto de BOOM
        this.showFloatingText(x, y, "BOOM!", '#ff0000');
    }

    // Update loop
    update() {
        this.fixUI();
        this.updateDragging();
        this.updateCamera();
        this.updateLocalPlayerMovement();
        this.updatePlayers();

        // --- LÓGICA DE REGENERAÇÃO DO COMANDANTE (10 HP/s) ---
        if (this.commander && this.commander.active && this.commander.health > 0 && this.commander.health < GAME_CONFIG.MAX_HEALTH) {
            if (this.scene.time.now - this.lastRegenTime > 1000) {
                const healAmount = 10;
                const nextHealth = Math.min(this.commander.health + healAmount, GAME_CONFIG.MAX_HEALTH);
                this.updateCharacterHealth(this.commander.id, nextHealth);
                this.lastRegenTime = this.scene.time.now;
            }
        }

        // --- LÓGICA DE DESTAQUE DO GRID (Highlight) ---
        if (this.selectedPlayer && this.selectedPlayer.active) {
            const pointer = this.scene.input.activePointer;
            
            // Calcula o centro da célula sob o mouse
            const cellSize = this.scene.meuCenario.cellSize || 50;
            const cellCenterX = Math.floor(pointer.worldX / cellSize) * cellSize + cellSize / 2;
            const cellCenterY = Math.floor(pointer.worldY / cellSize) * cellSize + cellSize / 2;

            // Verifica distância e bloqueio
            const dist = Phaser.Math.Distance.Between(this.selectedPlayer.x, this.selectedPlayer.y, cellCenterX, cellCenterY);
            const withinRange = dist <= GAME_CONFIG.MAX_MOVE_DISTANCE;
            const blocked = this.scene.meuCenario.isWorldPositionBlocked(cellCenterX, cellCenterY);

            // Desenha verde se válido, vermelho se inválido
            this.scene.meuCenario.highlightCell(pointer.worldX, pointer.worldY, withinRange && !blocked);
        } else {
            if (this.scene.meuCenario) this.scene.meuCenario.clearHighlight();
        }
    }

    updateCamera() {
        let camSpeed = 12;
        const cam = this.scene.cameras.main;

        // Movimento da câmera
        if (this.cursors.left.isDown) cam.scrollX -= camSpeed;
        if (this.cursors.right.isDown) cam.scrollX += camSpeed;
        
        // No modo isométrico, a câmera visualmente percorre menos pixels verticais.
        // Aumentamos a velocidade de scroll em Y para compensar o achatamento visual.
        let ySpeed = this.isIsometricView ? camSpeed * 1.8 : camSpeed;
        if (this.cursors.up.isDown) cam.scrollY -= ySpeed;
        if (this.cursors.down.isDown) cam.scrollY += ySpeed;
    }

    /**
     * Garante que todos os elementos da UI permaneçam fixos na tela.
     * Isso é um patch para garantir que o scrollFactor seja sempre 0,
     * já que a criação desses elementos não está neste arquivo.
     */
    fixUI() {
        const cam = this.scene.cameras.main;
        const zoom = cam.zoom;
        const centerX = this.scene.scale.width / 2;
        const centerY = this.scene.scale.height / 2;
        
        // Fator de achatamento (Diablo 2 usa aprox 0.5 a 0.6)
        const squashY = this.isIsometricView ? 0.5 : 1.0;
        
        const invZoom = 1 / zoom;

        // Função para fixar um elemento na tela compensando o zoom
        const fixElement = (el) => {
            if (!el) return;
            
            // Inicializa posição de tela se não existir
            if (el._screenX === undefined) el._screenX = el.x;
            if (el._screenY === undefined) el._screenY = el.y;
            
            // Inicializa escala base se não existir (preserva tamanho original do ícone)
            if (el._baseScaleX === undefined) el._baseScaleX = el.scaleX;
            if (el._baseScaleY === undefined) el._baseScaleY = el.scaleY;

            el.setScrollFactor(0);
            
            // Compensa a escala
            el.setScale(el._baseScaleX * invZoom, el._baseScaleY * invZoom);

            // Compensa a posição:
            // O zoom ocorre a partir do centro da câmera.
            // Calculamos onde o objeto precisa estar no mundo para ser projetado na posição de tela desejada.
            // Fórmula: WorldPos = Center + (ScreenPos - Center) / Zoom
            const worldX = centerX + (el._screenX - centerX) / zoom;
            const worldY = centerY + (el._screenY - centerY) / zoom;
            
            el.setPosition(worldX, worldY);
        };

        // Aplica a correção para a barra principal
        if (window.uiBar) {
            fixElement(window.uiBar);
            
            // Ajuste especial para a largura da barra cobrir a tela inteira
            // displayWidth (Tamanho Visual) = Tamanho da Tela
            // Tamanho no Mundo = Tamanho da Tela / Zoom
            window.uiBar.displayWidth = this.scene.scale.width / zoom;
            window.uiBar.displayHeight = (GAME_CONFIG.UI_BAR_HEIGHT || 50) / zoom;
        }

        // Aplica para outros elementos conhecidos
        fixElement(window.playerInfoText);
        fixElement(window.spText);
        fixElement(this.statsPanel);
        fixElement(window.debugText);
        fixElement(window.optionsPanel);
        fixElement(window.inventoryLabel);
        fixElement(window.coinText);
        fixElement(window.scoreText);
        fixElement(window.transmitBtn);
        fixElement(window.progressText);
        fixElement(window.spawnMinerBtn);
        fixElement(window.spawnSoldierBtn);
        fixElement(window.distanceText);

        // Corrige a posição dos slots e ícones do inventário
        if (window.inventorySlots) {
            window.inventorySlots.forEach(slotObj => {
                fixElement(slotObj.slot);
                fixElement(slotObj.icon);
            });
        }
    }

    updateDragging() {
        const pointer = this.scene.input.activePointer;

        // Só processa arrasto se a interação começou validamente no mapa
        if (!this.shared.isMapInteraction) return;

        if (pointer.isDown && !this.shared.isDragging) {
            // Usa o ponto inicial salvo no pointerdown para calcular a distância
            const startX = this.shared.dragStartPoint.x;
            const startY = this.shared.dragStartPoint.y;
            const dist = Phaser.Math.Distance.Between(startX, startY, pointer.x, pointer.y);

            // CORREÇÃO: Reduzido threshold para 5px e removida a verificação !playerAtPointer.
            // Isso permite arrastar a câmera mesmo clicando em cima de um jogador e evita cliques acidentais.
            if (dist > 5) {
                this.shared.isDragging = true;
                this.shared.dragStart = { x: pointer.worldX, y: pointer.worldY };
                this.shared.lastPointerPos = { x: pointer.x, y: pointer.y };
                document.body.style.cursor = 'grabbing';
            }
        }

        if (this.shared.isDragging && pointer.isDown) {
            const deltaX = pointer.x - this.shared.lastPointerPos.x;
            const deltaY = pointer.y - this.shared.lastPointerPos.y;

            this.scene.cameras.main.scrollX -= deltaX / this.scene.cameras.main.zoom;
            this.scene.cameras.main.scrollY -= deltaY / this.scene.cameras.main.zoom;

            this.shared.lastPointerPos = { x: pointer.x, y: pointer.y };
        }

    }

    // Este método agora só atualiza o jogador local
    updateLocalPlayerMovement() {
        // Verifica se o comandante está se movendo (tem um caminho ou um alvo)
        const commanderIsMoving = this.commander && (this.commander.path || this.commander.target);

        this.players.children.iterate(p => {
            // Se o personagem estiver morto ou inativo, ignora toda a lógica de movimento/ação
            if (!p || !p.active || p.health <= 0) return;
            
            // --- LÓGICA DE ATAQUE AUTOMÁTICO (APENAS SOLDADOS) ---
            if (p.playerType === 'soldado' && p.active && p.health > 0) {
                // Cooldown de 1.5 segundos para ataque automático
                if (!p._lastAutoAttack || this.scene.time.now - p._lastAutoAttack > 1500) {
                    const weaponKey = p.weapon || 'pistol';
                    const weaponConfig = WEAPONS[weaponKey] || WEAPONS['pistol'];
                    
                    let nearestEnemy = null;
                    let minDist = weaponConfig.range;

                    // Busca NPCs visíveis no alcance da arma
                    this.scene.npcManager.npcs.getChildren().forEach(npc => {
                        if (npc.active && npc.visible && npc.health > 0) {
                            const d = Phaser.Math.Distance.Between(p.x, p.y, npc.x, npc.y);
                            if (d <= minDist) {
                                // Verifica se há linha de visão antes de atirar
                                if (this.scene.meuCenario.checkLineOfSight(p.x, p.y, npc.x, npc.y)) {
                                    minDist = d;
                                    nearestEnemy = npc;
                                }
                            }
                        }
                    });

                    if (nearestEnemy) {
                        p._lastAutoAttack = this.scene.time.now;
                        // Executa o tiro sem alterar a seleção global, evitando bugs de UI/Moedas
                        this.executeShoot(nearestEnemy.x, nearestEnemy.y, nearestEnemy, p);
                    }
                }
            }

            // --- LÓGICA ESPECÍFICA DO MINERADOR (AUTO-MINING) ---
            let isAutoMining = false;
            // Só minera se o comandante estiver parado
            if (!commanderIsMoving && p.active && p.health > 0 && p.playerType === 'minerador') {
                const MINE_VISION = 100;
                
                // Procura minério se não tiver um alvo ou se o alvo atual sumiu (foi coletado)
                if (!p._miningTarget || !p._miningTarget.active) {
                    p._miningTarget = null;
                    
                    // Throttle a busca por minério para não pesar no processamento (a cada 500ms)
                    if (!p._lastOreSearch || this.scene.time.now - p._lastOreSearch > 500) {
                        p._lastOreSearch = this.scene.time.now;
                        
                        let nearestOre = null;
                        let minDist = MINE_VISION;
                        
                        // Busca no grupo de minérios do cenário
                        this.scene.meuCenario.oresGroup.getChildren().forEach(ore => {
                            if (ore.active) {
                                const dist = Phaser.Math.Distance.Between(p.x, p.y, ore.x, ore.y);
                                if (dist < minDist) {
                                    minDist = dist;
                                    nearestOre = ore;
                                }
                            }
                        });
                        if (nearestOre) p._miningTarget = nearestOre;
                    }
                }

                if (p._miningTarget && p._miningTarget.active) {
                    isAutoMining = true;
                    p.target = { x: p._miningTarget.x, y: p._miningTarget.y };
                    p.path = null; // Prioriza o minério sobre a rota de formação
                }
            }

            // --- LÓGICA DE FORMAÇÃO EM TRIÂNGULO (SNAP FOLLOW) ---
            if (!isAutoMining && p.isFollower && this.commander && this.commander.active && p !== this.commander) {
                // Define os offsets para a formação em triângulo/V atrás do comandante
                const formationSlots = [
                    { dx: -60, dy: 60 },  // Slot 1: Esquerda-Atrás
                    { dx: 60, dy: 60 },   // Slot 2: Direita-Atrás
                    { dx: -110, dy: 110 }, // Slot 3: Mais à Esquerda-Atrás
                    { dx: 110, dy: 110 },  // Slot 4: Mais à Direita-Atrás
                    { dx: 0, dy: 120 }     // Slot 5: Centro-Atrás
                ];

                const slot = formationSlots[p.formationSlotIndex % formationSlots.length];
                const targetX = this.commander.x + slot.dx;
                const targetY = this.commander.y + slot.dy;

                const distToSlot = Phaser.Math.Distance.Between(p.x, p.y, targetX, targetY);
                
                // Threshold para começar a mover para o slot (reduzido para 20px para ser bem "snap")
                if (distToSlot > 20) {
                    const hasLoS = this.scene.meuCenario.checkLineOfSight(p.x, p.y, targetX, targetY);
                    
                    if (hasLoS) {
                        // Se tem visão direta, usa movimento direto (muito mais rápido e "snap")
                        p.target = { x: targetX, y: targetY };
                        p.path = null; 
                    } else if (!p.path || this.scene.time.now - (p._lastFollowCalc || 0) > 500) {
                        // Se houver obstáculo, recalcula o caminho a cada 500ms
                        p._lastFollowCalc = this.scene.time.now;
                        this.scene.pathManager.findPath(p.x, p.y, targetX, targetY, (path) => {
                            if (path && path.length > 1) {
                                p.path = path;
                                p.currentPathIndex = 1;
                            }
                        });
                    }
                } else if (distToSlot < 10 && !p._pendingPath) {
                    // Se já chegou no slot, para completamente
                    if (p.body) p.body.setVelocity(0, 0);
                    p.target = null;
                    p.path = null;
                }
            }

            // --- LÓGICA DE ROTAÇÃO ANTES DO MOVIMENTO ---
            if (p.isRotatingToMove) {
                // Rotaciona suavemente em direção ao targetRotation
                p.rotation = Phaser.Math.Angle.RotateTo(p.rotation, p.targetRotation, GAME_CONFIG.TURN_SPEED * 2); // Velocidade de rotação

                // Se a rotação estiver quase completa, inicia o movimento
                if (Math.abs(Phaser.Math.Angle.Normalize(p.rotation - p.targetRotation)) < 0.05) { // Tolerância de 0.05 radianos
                    p.isRotatingToMove = false;
                    p.rotation = p.targetRotation; // Garante que a rotação seja exata
                    // Transfere o caminho pendente para o caminho ativo e inicia o movimento
                    p.path = p._pendingPath;
                    p._pendingPath = null;
                } else {
                    // Enquanto rotaciona, o jogador não se move
                    p.setVelocity(0, 0);
                    // Atualiza a animação para mostrar o frame estático na direção da rotação
                    if (this.animationManager) this.animationManager.updateAnimation(p, 0, 0); // Passa 0,0 para indicar que está parado
                }
                return; // Não processa o movimento normal ainda
            }

            // NOVA LÓGICA DE PATHFINDING
            if (p.path && p.currentPathIndex < p.path.length) {
                // Define o alvo como o próximo waypoint no caminho
                p.target = p.path[p.currentPathIndex];
                if (!p.target) return;

                let distToTarget = Phaser.Math.Distance.Between(p.x, p.y, p.target.x, p.target.y);
                
                // LÓGICA DE DETECÇÃO DE TRAVAMENTO MELHORADA
                // Verifica se o personagem está fazendo progresso real em direção ao alvo
                const progress = (p._lastDistToTarget || Infinity) - distToTarget;

                if (p.target && (progress < 0.1 || !p.body.blocked.none) && distToTarget > 15) {
                    p._stuckFrames = (p._stuckFrames || 0) + 1;
                    if (p._stuckFrames > 40) { // Se não houver progresso por ~0.6s
                        // SOLUÇÃO: Teleporte de segurança para desvencilhar (Unstuck)
                        console.log(`[Unstuck] ${p.id} destravado automaticamente.`);
                        
                        // Efeito visual no local antigo e no novo
                        if (this.scene.shotManager) this.scene.shotManager.createTeleportEffect(p.x, p.y);
                        if (this.scene.shotManager) this.scene.shotManager.createTeleportEffect(p.target.x, p.target.y);

                        // Move o personagem para a posição exata do waypoint onde ele deveria estar
                        p.setPosition(p.target.x, p.target.y);
                        if (p.body) p.body.reset(p.target.x, p.target.y);
                        
                        p._stuckFrames = 0;
                        p._lastDistToTarget = Infinity;
                        return; 
                    }
                } else {
                    p._stuckFrames = 0;
                }
                
                p._lastDistToTarget = distToTarget;

                // Move em direção ao alvo atual (waypoint)
                this.updatePlayerMovement(p);

                // Se chegou ao waypoint, avança para o próximo
                // TOLERÂNCIA: 15px para pontos no caminho, 5px para o destino final.
                // Isso evita que o personagem fique "sambando" em quinas de paredes.
                if (!p.target) return;
                
                distToTarget = Phaser.Math.Distance.Between(p.x, p.y, p.target.x, p.target.y);
                const arrivalThreshold = (p.currentPathIndex === p.path.length - 1) ? 5 : 15;
                if (p.target && distToTarget < arrivalThreshold) {
                    p.currentPathIndex++;
                    if (p.currentPathIndex >= p.path.length) {
                        // Chegou ao fim do caminho
                        p.path = null;
                        p.target = null;
                        this.clearDestinationMarker();
                    }
                }
            } else if (p.target) {
                // FALLBACK DE SEGURANÇA: Se tiver target mas não path (evita travamento da IA antiga)
                this.updatePlayerMovement(p);
                
                // Verifica chegada manual
                if (Phaser.Math.Distance.Between(p.x, p.y, p.target.x, p.target.y) < 4) {
                    p.setVelocity(0).setPosition(p.target.x, p.target.y);
                    p.target = null;
                    if (this.animationManager) this.animationManager.updateAnimation(p, 0, 0);
                } 
            } else {
                p.setVelocity(0);

                // CORREÇÃO: Removemos o bloco que forçava o frame estático.
                // O updateAnimation já possui proteção interna para não sobrescrever enquanto o tiro acontece.
                if (this.animationManager) {
                    this.animationManager.updateAnimation(p, 0, 0);
                }
            }
        });
    }

    // Este método atualiza a UI de todos os jogadores e a mira do jogador local
    updatePlayers() {
        const allPlayers = this.players.getChildren();
        allPlayers.forEach(p => {
            if (!p) return;
            this.updatePlayerUI(p);

            // SOLUÇÃO ROBUSTA: Verificação de Clipping (Anti-Stuck)
            // Se o player estiver DENTRO de um obstáculo, empurra ele para fora imediatamente
            this.scene.physics.overlap(p, [this.scene.meuCenario.obstaclesGroup, this.scene.meuCenario.animatedGroup], (obj1, obj2) => {
                const angle = Phaser.Math.Angle.Between(obj2.x, obj2.y, obj1.x, obj1.y);
                // Força de ejeção: empurra o personagem na direção oposta ao centro do obstáculo
                const ejectionForce = 5; // Aumentado para 5 para uma resposta mais imediata
                obj1.x += Math.cos(angle) * ejectionForce;
                obj1.y += Math.sin(angle) * ejectionForce;
                // Sincroniza o corpo físico com a nova posição corrigida
                if (obj1.body) obj1.body.reset(obj1.x, obj1.y);
            });
        });
    }

    // Atualiza a posição e rotação de um jogador remoto
    updateCharacterState(characterInfo) {
        const character = this.getPlayerById(characterInfo.id);
        // A condição correta é: se o personagem existe e NÃO é o meu próprio personagem (controlado por este cliente),
        // então atualize seu estado com base nos dados do servidor.
        if (character && this.networkManager && character.id !== this.networkManager.getClientId()) {
            character.setPosition(characterInfo.x, characterInfo.y);
            // Atualiza o status de revelado (Fog of War)
            character.isRevealed = characterInfo.isRevealed;
            // A rotação e a animação serão tratadas pela lógica de movimento para suavidade.
        }
    }

    updatePlayerMovement(player) {
        // Proteção contra chamadas onde o alvo ainda não foi definido ou foi limpo
        if (!player || !player.target) return;

        const dist = Phaser.Math.Distance.Between(player.x, player.y, player.target.x, player.target.y);

        const angle = Phaser.Math.Angle.Between(player.x, player.y, player.target.x, player.target.y);
        let velocityX = Math.cos(angle) * GAME_CONFIG.SPEED;
        let velocityY = Math.sin(angle) * GAME_CONFIG.SPEED;

        // LÓGICA DE SEPARAÇÃO: Impede que os personagens do mesmo time fiquem um em cima do outro
        // e se prendam mutuamente nas quinas das paredes.
        const separation = this.calculatePlayerSeparation(player);
        velocityX += separation.x;
        velocityY += separation.y;

        // Não rotacionar sprite durante o movimento para evitar conflitos com as animações
        player.setVelocity(velocityX, velocityY);

        if (this.animationManager) {
            this.animationManager.updateAnimation(player, velocityX, velocityY);
        }

        // REMOVIDO: Modificar Y manualmente quebra a resolução de colisão do Arcade Physics
        // player.y += Math.sin(this.scene.time.now / 200) * 0.3;
        
        player.setDepth(player.y);
    }

    // Adiciona um método para inicializar as propriedades de rotação no jogador
    // Isso é útil para garantir que todos os jogadores tenham essas propriedades
    // quando são criados, evitando 'undefined' em tempo de execução.

    /**
     * Calcula força de repulsão entre membros do mesmo time para evitar engavetamentos.
     */
    calculatePlayerSeparation(player) {
        let sepX = 0;
        let sepY = 0;
        const teamMates = this.players.getChildren();
        
        teamMates.forEach(other => {
            if (other === player || !other.active || other.health <= 0) return;
            
            const dist = Phaser.Math.Distance.Between(player.x, player.y, other.x, other.y);
            if (dist < 50) { // Distância de conforto entre aliados
                const force = 0.3; // Reduzido para evitar empurrar aliados contra as paredes
                sepX += (player.x - other.x) * force;
                sepY += (player.y - other.y) * force;
            }
        });
        return { x: sepX, y: sepY };
    }

    updatePlayerUI(player) {
        if (this.selectedPlayer === player && this.shared.highlightBox) {
            const config = PLAYER_CONFIGS[player.playerType];
            if (!config) return;
            const offsetY = config.highlightOffset;
            this.shared.highlightBox.setPosition(player.x, player.y + offsetY);
        }

        if (player.healthBar && player.health > 0) {
            const config = PLAYER_CONFIGS[player.playerType];
            if (!config) return;
            // Posiciona a barra logo acima do texto de vida
            player.healthBar.setPosition(player.x, player.y + config.healthTextOffset - 15);
            player.healthBar.setDepth(player.depth + 1);
        }

        if (this.actionMode === 'shoot' && this.selectedPlayer === player && this.shared.shootIndicator) {
            const pointer = this.scene.input.activePointer;
            
            // Verifica hover sobre inimigos ou NPCs
            const hoveredPlayer = this.getPlayerAt(pointer.worldX, pointer.worldY);
            const hoveredNpc = this.getNpcAt(pointer.worldX, pointer.worldY);
            
            const isEnemy = hoveredPlayer && hoveredPlayer.team !== this.selectedPlayer.team;
            const isNpc = !!hoveredNpc;

            if (isEnemy || isNpc) {
                this.shared.shootIndicator.setVisible(true);
                this.shared.shootIndicator.setPosition(pointer.worldX, pointer.worldY);
            } else {
                this.shared.shootIndicator.setVisible(false);
            }

            // Selecionar animação/frame baseado na direção do cursor para manter o personagem "dentro do quadrado"
            const aimAngle = Phaser.Math.Angle.Between(player.x, player.y, pointer.worldX, pointer.worldY);
            const aimDirection = this.getDirectionFromAngle(Phaser.Math.RadToDeg(aimAngle));

            if (this.animationManager) {
                // Usar frame estático ao mirar (não mostrar animação de andar)
                this.animationManager.setAimFrame(player, aimDirection);
            }
        }

        // Desenhar overlay vermelho translúcido fora do alcance (usa máscara para recortar o círculo do jogador ou do centro definido)
        if (this.showShootRange) {
            const center = (this.selectedPlayer && this.selectedPlayer.health > 0) ? { x: this.selectedPlayer.x, y: this.selectedPlayer.y } : (this.shared.shootRangeCenter || { x: 0, y: 0 });

            // Criar overlay e máscara se necessário
            if (!this.shared.shootRangeOverlay) {
                this.shared.shootRangeOverlay = this.scene.add.graphics().setDepth(9998);
                // preenchimento grande para cobrir o mundo (usar alpha configurável)
                this.shared.shootRangeOverlay.fillStyle(0xff0000, GAME_CONFIG.SHOOT_OVERLAY_ALPHA);
                this.shared.shootRangeOverlay.fillRect(-5000, -5000, 10000, 10000);

                this.shared.shootRangeMaskGraphics = this.scene.add.graphics().setDepth(9999);
                this.shared.shootRangeMaskGraphics.fillStyle(0xffffff, 1);
                this.shared.shootRangeMaskGraphics.fillCircle(center.x, center.y, GAME_CONFIG.SHOOT_DISTANCE);
                // Não mostrar o gráfico da máscara (usado apenas pela GeometryMask)
                this.shared.shootRangeMaskGraphics.setVisible(false);

                this.shared.shootRangeMask = new Phaser.Display.Masks.GeometryMask(this.scene, this.shared.shootRangeMaskGraphics);
                this.shared.shootRangeMask.invertAlpha = true; // mostrar overlay fora do círculo
                this.shared.shootRangeOverlay.setMask(this.shared.shootRangeMask);
            } else {
                // Atualizar posição do buraco (círculo claro)
                this.shared.shootRangeMaskGraphics.clear();
                this.shared.shootRangeMaskGraphics.fillStyle(0xffffff, 1);
                this.shared.shootRangeMaskGraphics.fillCircle(center.x, center.y, GAME_CONFIG.SHOOT_DISTANCE);
                // Manter máscara invisível (não mostrar o círculo branco no mundo)
                this.shared.shootRangeMaskGraphics.setVisible(false);
            }
        } else if (this.shared.shootRangeOverlay) {
            // Limpar overlay e máscara quando desligado
            if (this.shared.shootRangeOverlay) {
                this.shared.shootRangeOverlay.clear();
                this.shared.shootRangeOverlay.destroy();
                this.shared.shootRangeOverlay = null;
            }
            if (this.shared.shootRangeMaskGraphics) {
                this.shared.shootRangeMaskGraphics.clear();
                this.shared.shootRangeMaskGraphics.destroy();
                this.shared.shootRangeMaskGraphics = null;
            }
            if (this.shared.shootRangeMask) {
                this.shared.shootRangeMask = null;
            }
        }

        // Se não estiver no modo de atirar, suavemente resetar a rotação para 0 (orientação padrão do sprite)
        if (this.actionMode !== 'shoot') {
            if (Math.abs(Phaser.Math.Angle.Normalize(player.rotation)) > 0.0001) {
                player.rotation = Phaser.Math.Angle.RotateTo(player.rotation, 0, GAME_CONFIG.TURN_SPEED);
            }
        }
    }

    updateShootLine() {
        // Linha de tiro removida: agora usamos apenas o indicador (bola) na posição do cursor.
    }

    clearDestinationMarker() {
        if (window.destinationMarker) {
            window.destinationMarker.destroy();
            window.destinationMarker = null;
        }
        if (window.distanceText) {
            window.distanceText.setText('');
        }
    }

    updatePlayerDistance() {
        if (!this.selectedPlayer || !this.selectedPlayer.target || !window.distanceText) return;

        const dist = Phaser.Math.Distance.Between(
            this.selectedPlayer.x,
            this.selectedPlayer.y,
            this.selectedPlayer.target.x,
            this.selectedPlayer.target.y
        );

        window.distanceText.setText(`Distância: ${dist.toFixed(2)} px`);
    }
    // Olha texto na tela
    updateConnectedPlayersText() {
        /*
        const allCharacters = this.players.getChildren();
        const playerCount = allCharacters.length;
        let playerList = `Personagens no Jogo (${playerCount}):\n`;
        
        allCharacters.forEach(p => {
            const isMine = p.team === this.myTeam ? '(Meu Time)' : '(Inimigo)';
            playerList += `- ${p.id} ${isMine}\n`;
        });
        
        this.shared.connectedPlayersText.setText(playerList);
        */

    }
    // UI updates
    updateUI() {
        // Atualiza botões de recrutamento (preços e transparência)
        UIManager.updateButtonStates();

        if (!this.selectedPlayer) {
            if (window.playerInfoText) window.playerInfoText.setText('Select a player');
            if (window.spText) window.spText.setText('AP: --');
            return;
        }

        const player = this.selectedPlayer;

        if (player.health <= 0) {
            if (window.playerInfoText) window.playerInfoText.setText(`${player.name} - ☠️ DEFEATED ☠️`);
            return;
        }

        // CORREÇÃO: O dinheiro exibido deve ser sempre o do COMANDANTE
        if (window.coinText) window.coinText.setText(`Coins: ${this.commander ? this.commander.coins : 0}`);
        this.updateInventoryUI();
    }

    // --- VISUALIZAÇÃO DE DADOS ---
    showDiceRoll(data) {
        const { x, y, isHit } = data;

        // Cor: Verde se acertou, Vermelho se errou, Branco se não tinha alvo (tiro no chão)
        let color = isHit ? '#00ff00' : '#ffffff';

        // Simplificado para mostrar apenas o dano causado visualmente
        let textStr = isHit ? `-${GAME_CONFIG.PLAYER_DAMAGE}` : `MISSED`;

        const text = this.scene.add.text(x, y - 60, textStr, {
            fontSize: '24px',
            fill: color,
            stroke: '#000000',
            strokeThickness: 4,
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(2000);

        this.scene.tweens.add({
            targets: text,
            y: y - 100, // Sobe um pouco
            alpha: 0,
            duration: 1000, // 1 segundo de duração
            onComplete: () => text.destroy()
        });
    }

    handleKillBonusUpdate(data) {
        const char = this.getPlayerById(data.characterId);
        if (char) {
            char.hasKillBonus = data.hasBonus;
            console.log(`Character ${char.id} kill bonus status: ${char.hasKillBonus}`);
            
            if (data.hasBonus) {
                // Mostra um efeito visual de bônus ganho
                const bonusText = this.scene.add.text(char.x, char.y - 100, 'KILL BONUS!', {
                    fontSize: '22px',
                    fill: '#ff8c00', // Laranja
                    stroke: '#000000',
                    strokeThickness: 4,
                    fontStyle: 'bold'
                }).setOrigin(0.5).setDepth(2001);

                this.scene.tweens.add({
                    targets: bonusText,
                    y: char.y - 140,
                    alpha: 0,
                    duration: 2000,
                    onComplete: () => bonusText.destroy()
                });
            }
        }
    }

    // --- SISTEMA DE UI DE ATRIBUTOS ---
    createStatsUI() {
        const { width, height } = this.scene.scale;

        // Posição no canto superior direito
        const panelWidth = 220;
        const panelHeight = 170;
        const panelX = width - panelWidth - 10;
        const panelY = 10;

        // Painel de Stats (Container) - Inicialmente invisível até selecionar alguém
        this.statsPanel = this.scene.add.container(panelX, panelY).setScrollFactor(0).setDepth(10001).setVisible(false);
        
        const bg = this.scene.add.rectangle(0, 0, panelWidth, panelHeight, 0x000000, 0.8)
            .setOrigin(0)
            .setStrokeStyle(2, 0x00ffff); // Ciano
            
        // Título
        const title = this.scene.add.text(panelWidth / 2, 10, 'UNIT STATUS', {
            fontSize: '14px',
            fill: '#00ffff',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0);

        this.statsInfoText = this.scene.add.text(15, 35, '', {
            fontSize: '14px',
            fill: '#ffffff',
            lineSpacing: 6
        });
        
        this.statsPanel.add([bg, title, this.statsInfoText]);
        this.shared.statsPanel = this.statsPanel;
    }

    toggleStatsPanelVisibility() {
        this.shared.statsPanelVisible = !this.shared.statsPanelVisible;
        // Atualiza imediatamente a visibilidade do painel
        this.updateStatsPanel();
    }

    toggleStatsPanel() {
        // Método mantido vazio para compatibilidade se algo ainda chamar
    }

    updateStatsPanel() {
        if (!this.selectedPlayer) {
            this.statsPanel.setVisible(false);
            return;
        }

        // Respeita a flag global de visibilidade
        if (!this.shared.statsPanelVisible) {
            this.statsPanel.setVisible(false);
            return;
        }

        this.statsPanel.setVisible(true);
        const p = this.selectedPlayer;

        // Configurações das armas no cliente
        const weaponConfigs = {
            'pistol': { name: 'Pistol', minDamage: 10, maxDamage: 40 },
            'shotgun': { name: 'Shotgun', minDamage: 20, maxDamage: 50 }
        };

        // Pega os dados da arma do jogador para exibir na UI
        const weaponKey = p.weapon || 'pistol';
        const weapon = weaponConfigs[weaponKey] || weaponConfigs['pistol'];
        const damageText = `${weapon.minDamage}-${weapon.maxDamage}`;

        const text = `Name: ${p.name}\nHP: ${p.health}/${GAME_CONFIG.MAX_HEALTH}\nWeapon: ${weapon.name}\nDamage: ${damageText}\nArmor: ${p.armor || 0}\nStrength: ${p.weaponStrength || 0}`;
        this.statsInfoText.setText(text);
        console.log('[StatsPanel] Text set to:', text);
    }

    updateUIMode() {
        let message = '';

        if (this.actionMode === 'move') { // A tecla agora é 'V'
            message = 'MOVE MODE (V): Click on the map to move the player';
        } else if (this.actionMode === 'shoot') {
            message = 'SHOOT MODE: Click on an enemy to shoot';
        } else {
            message = 'War Ufo Alpha 0.129';
        }

        if (window.debugText) window.debugText.setText(message);
    }

    // Game state
    checkVictoryCondition() {
        const allPlayers = this.players.getChildren();
        const playersAlive = allPlayers.filter(p => p.health > 0);

        if (playersAlive.length === 0) {
            let winner = 'draw';
            let reason = 'Commander Defeated';

            this.handleGameOver({ winner, scores: 0, reason });
        }
    }

    handleGameOver({ winner, scores, reason }) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.scene.physics.pause();
        this.selectedPlayer = null;
        this.setActionMode(null);

        if (this.shared.highlightBox) {
            this.shared.highlightBox.destroy();
            this.shared.highlightBox = null;
        }

        // --- TELA NEGRA DE VITÓRIA ---
        const { width, height } = this.scene.scale;
        const blackBg = this.scene.add.rectangle(width/2, height/2, width, height, 0x000000)
            .setScrollFactor(0).setDepth(10005);

        let finalMsg = "";
        if (winner === 'player') {
            finalMsg = "Mission Success! The area is secure.";
        } else {
            finalMsg = "Mission Failed. The Commander has fallen.";
        }

        const playerWon = (winner === 'player');

        const victoryText = this.scene.add.text(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.centerY - 40,
            playerWon ? `🏆 MISSION ${this.currentMissionNumber} COMPLETE 🏆\n\n${finalMsg}` : `❌ MISSION ${this.currentMissionNumber} FAILED ❌\n\nRetreat and regroup!`,
            {
                fontSize: '22px',
                fill: '#ffffff',
                fontStyle: 'bold',
                align: 'center',
                wordWrap: { width: 500 }
            }
        )
            .setAlign('center')
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10010);

        // Determina se o jogador local ganhou para avançar de missão
        const nextMission = playerWon ? this.currentMissionNumber + 1 : this.currentMissionNumber;

        const restartButton = this.scene.add.text(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.centerY + 80,
            playerWon ? `IR PARA MISSÃO ${nextMission}` : 'TRY AGAIN',
            {
                fontSize: '20px',
                fill: '#ffffff',
                backgroundColor: playerWon ? '#006600' : '#660000',
                padding: { x: 20, y: 10 }
            }
        )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10010)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // Reinicia a cena do jogo com a próxima missão sem passar pelo lobby
                this.scene.scene.restart({ missionNumber: nextMission });
            });

        this.scene.tweens.add({
            targets: victoryText,
            scale: 1.1,
            yoyo: true,
            repeat: -1,
            duration: 1000
        });
    }

    // Mensagens
    showMessage(text) {
        console.log('Message:', text);

        if (window.messageText) window.messageText.destroy();

        window.messageText = this.scene.add.text(
            this.scene.cameras.main.centerX,
            this.scene.cameras.main.height - 100,
            text,
            {
                fontSize: '20px',
                fill: '#ffffff',
                backgroundColor: '#000000',
                padding: { x: 10, y: 5 },
                stroke: '#ff0000',
                strokeThickness: 3
            }
        )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10002);

        this.scene.tweens.add({
            targets: window.messageText,
            alpha: 0,
            delay: 2000,
            duration: 1000,
            onComplete: () => {
                if (window.messageText) window.messageText.destroy();
            }
        });
    }

    /** 
     * Lógica central para finalizar um turno. Reseta o SP dos jogadores e a UI.
     * Pode ser chamada tanto localmente (offline) quanto em resposta a um evento do servidor.
     * @param {object} turnData - Dados opcionais do servidor, como o SP a ser resetado.
     */
    endTurn(turnData = {}) {
        // Reseta a flag que impede a troca de turno por tempo
        this.turnEnding = false;

        // **CORREÇÃO**: Usa o SP vindo do servidor (se disponível) ou o padrão do jogo.
        const spToReset = turnData.sp !== undefined ? turnData.sp : GAME_CONFIG.MAX_SP;

        this.players.getChildren().forEach(p => {
            if (p && p.health > 0) {
                p.target = null; // Limpa qualquer alvo de movimento pendente
            }
        });

        this.selectedPlayer = null;
        this.setActionMode(null);
        if (this.shared.highlightBox) this.shared.highlightBox.setVisible(false);

        this.showMessage('Turn finished! Awaiting next turn...');
        this.updateUI();
        this.updateStatsPanel(); // Garante que o painel suma ao deselecionar
    }

    /**
     * Chamado quando o jogador local clica no botão "Fim de Turno".
     * Apenas emite um evento para o servidor.
     * **CORREÇÃO**: Esta função agora obtém o characterId correto do TurnManager.
     */
    requestEndTurn() {
        // RTS: Não existe mais fim de turno manual.
    }

    handleOfflineTurnChange(nextTeamId) {
        // RTS: Nada para trocar.
    }


    /**
     * Atualiza a UI e o estado do jogo com base em quem é o turno.
     */
    updateTurnState() {
        if (this.isMyTurn) {
            // this.showMessage("É a sua vez!"); // Esta mensagem agora pode ser gerenciada na GameScene
        }
        UIManager.updateButtonStates(); // Atualiza a visibilidade/interatividade dos botões
    }

    // --- USO DE ITENS ---
    useItem(slotIndex) {
        if (!this.selectedPlayer) return;
        
        const player = this.selectedPlayer;
        if (slotIndex >= player.inventory.length) return;

        const itemId = player.inventory[slotIndex];

        if (itemId === 'medkit') {
            // Verifica se o personagem já está com a vida cheia
            if (player.health >= GAME_CONFIG.MAX_HEALTH) {
                this.showMessage("Health already full!");
                return;
            }
            
            const healAmount = 20; // Valor solicitado de cura
            const oldHealth = player.health;
            const newHealth = Math.min(oldHealth + healAmount, GAME_CONFIG.MAX_HEALTH);
            
            // Efeito visual de cura (Texto Verde subindo)
            this.showFloatingText(player.x, player.y - 60, `+${Math.round(newHealth - oldHealth)} HP`, '#00ff00');
            
            // Atualiza a vida internamente e o texto sobre a cabeça
            this.updateCharacterHealth(player.id, newHealth);
            
            // Som de confirmação
            if (this.soundManager) this.soundManager.play('impact');

            // Remove o item do inventário e atualiza a interface
            player.inventory.splice(slotIndex, 1);
            this.updateInventoryUI();
            this.updateUI();
            this.showMessage(`Unit healed! HP: ${player.health}/${GAME_CONFIG.MAX_HEALTH}`);
        }

    }

    // --- SISTEMA DE INVENTÁRIO ---
    handleItemPickup(playerId, itemId) {
        const player = this.getPlayerById(playerId);
        if (player) {
            // Se for moeda, não adiciona ao inventário (já foi tratado pelo coin_update)
            if (itemId === 'moeda') return;

            // Limite de 4 itens no inventário e verifica duplicidade
            if (player.inventory.length < 4 && !player.inventory.includes(itemId)) {
                player.inventory.push(itemId);
                console.log(`[GameManager] Item ${itemId} adicionado ao inventário de ${playerId}. Total: ${player.inventory.length}`);
                
                // Se for o jogador selecionado, atualiza a UI imediatamente
                if (this.selectedPlayer === player) {
                    this.updateInventoryUI();
                }
            }
        }
    }

    /**
     * Lógica de mineração: adiciona moedas e remove o recurso.
     */
    collectOre(miner, ore) {
        if (!ore.active) return;

        const value = ore.getData('value') || GAME_CONFIG.ORE_VALUE;
        if (this.commander) {
            this.commander.coins += value;
            this.updateUI();
            // Feedback visual rápido de coleta
            this.showFloatingText(ore.x, ore.y, `+$${value}`, '#0000ff');
            ore.destroy(); // Remove o minério do mapa
        }
    }

    updateInventoryUI() {
        const items = this.selectedPlayer ? this.selectedPlayer.inventory : [];
        console.log(`[GameManager] updateInventoryUI para ${this.selectedPlayer ? this.selectedPlayer.id : 'null'}:`, items);
        if (window.UIManager && typeof window.UIManager.updateInventory === 'function') {
            window.UIManager.updateInventory(items);
        }
    }

    /**
     * Converte um ângulo em graus para uma string de direção ('up', 'down', 'left', 'right').
     * @param {number} angleDeg Ângulo em graus.
     * @returns {string} Direção correspondente.
     */
    getDirectionFromAngle(angleDeg) {
        if (angleDeg >= -45 && angleDeg <= 45) {
            return GAME_CONFIG.DIRECTION.RIGHT;
        } else if (angleDeg > 45 && angleDeg < 135) {
            return GAME_CONFIG.DIRECTION.DOWN;
        } else if (angleDeg >= 135 || angleDeg <= -135) {
            return GAME_CONFIG.DIRECTION.LEFT;
        } else {
            return GAME_CONFIG.DIRECTION.UP;
        }
    }
}
