// input-manager.js
// Entrada do jogador: mouse, teclado, câmera, zoom e fixação da UI na tela.
// Métodos mesclados no prototype do GameManager (ver game-manager.js).
export const InputMethods = {

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


        // Tecla 'P': painel de upgrades
        this.scene.input.keyboard.on('keydown-P', () => UIManager.toggleUpgradePanel(this.scene));

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
    },


    zoomIn() {
        const cam = this.scene.cameras.main;
        const newZoom = Phaser.Math.Clamp(cam.zoom + 0.2, 0.5, 3);
        cam.zoomTo(newZoom, 300);
    },


    zoomOut() {
        const cam = this.scene.cameras.main;
        const newZoom = Phaser.Math.Clamp(cam.zoom - 0.2, 0.5, 3);
        cam.zoomTo(newZoom, 300);
    },


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
    },

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
    },


    isPointerInUIArea(pointer) {
        // Compara a posição Y do mouse (tela) com a altura da barra de UI configurada
        return pointer.y >= (this.scene.scale.height - GAME_CONFIG.UI_BAR_HEIGHT);
    },


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
    },

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
        fixElement(window.inventoryLabel);
        fixElement(window.coinText);
        fixElement(window.scoreText);
        fixElement(window.transmitBtn);
        fixElement(window.progressText);
        fixElement(window.spawnMinerBtn);
        fixElement(window.spawnSoldierBtn);
        fixElement(window.spawnSpyBtn);
        fixElement(window.upgradeBtn);
        fixElement(window.upgradePanel);
        fixElement(window.objectiveText);
        fixElement(window.distanceText);

        // Corrige a posição dos slots e ícones do inventário
        if (window.inventorySlots) {
            window.inventorySlots.forEach(slotObj => {
                fixElement(slotObj.slot);
                fixElement(slotObj.icon);
            });
        }
    },


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

    },
};
