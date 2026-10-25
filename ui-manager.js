// ui-manager.js
class UIManager {    
    static createSimpleUI(scene) {
        const width = scene.scale.width;
        const height = scene.scale.height;
        
        // Criar barra de UI
        const uiBar = scene.add.rectangle(0, height - GAME_CONFIG.UI_BAR_HEIGHT, width, GAME_CONFIG.UI_BAR_HEIGHT, 0x000000, 0.7)
            .setOrigin(0, 0)
            .setScrollFactor(0)
            .setDepth(10000)
            .setStrokeStyle(1, 0x444444, 0.8) // Linha superior sutil
            .setInteractive()
            .on('pointerdown', (pointer) => {
                // Evitar que cliques na UI interajam com o jogo
                pointer.event.stopPropagation();
            });
            
        
       
        
        uiBar.y = height - GAME_CONFIG.UI_BAR_HEIGHT;
        
        // Botões de Spawn (Direita)
        const btnY = height - GAME_CONFIG.UI_BAR_HEIGHT / 2;
        window.spawnSpyBtn = this._createButton(scene, width - 390, btnY, 'ESPIÃO ($40)', {
            width: 130,
            backgroundColor: 0x440044,
            onClick: () => { if (window.gameManager) window.gameManager.spawnUnit('espiao'); }
        });

        window.upgradeBtn = this._createButton(scene, width / 2 - 200, btnY, 'UPGRADES [P]', {
            width: 110,
            backgroundColor: 0x553300,
            onClick: () => this.toggleUpgradePanel(scene)
        });

        window.spawnMinerBtn = this._createButton(scene, width - 250, btnY, 'MINERADOR ($250)', {
            width: 130,
            backgroundColor: 0x444400,
            onClick: () => { if (window.gameManager) window.gameManager.spawnUnit('minerador'); }
        });

        window.spawnSoldierBtn = this._createButton(scene, width - 100, btnY, 'SOLDADO ($250)', {
            width: 130,
            backgroundColor: 0x004400,
            onClick: () => { if (window.gameManager) window.gameManager.spawnUnit('soldado'); }
        });

        // Botão de Transmissão (Centro)
        window.transmitBtn = this._createButton(scene, width / 2 + 100, btnY, 'TRANSMITIR ($100)', {
            width: 160,
            backgroundColor: 0x004466,
            onClick: () => { if (window.gameManager) window.gameManager.transmitMessage(); }
        });

        // Texto de Progresso da Mensagem
        window.progressText = scene.add.text(width / 2 + 100, height - GAME_CONFIG.UI_BAR_HEIGHT + 15, 'PROGRESS: 0%', {
            fontSize: '12px',
            fill: '#00ffff',
            fontStyle: 'bold'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(10001);

        // Objetivo da missão (topo, centro)
        window.objectiveText = scene.add.text(width / 2, 10, '', {
            fontSize: '14px',
            fill: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold'
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(10001);

        // Moedas centralizadas à esquerda do centro
        window.coinText = scene.add.text(width / 2 - 50, height - GAME_CONFIG.UI_BAR_HEIGHT / 2, 'Coins: 0', {
            fontSize: '14px',
            fill: '#ffd700',
            stroke: '#000000',
            strokeThickness: 2,
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5).setScrollFactor(0).setDepth(10001);
        
        // Texto de distância
        window.distanceText = scene.add.text(width / 2, height - GAME_CONFIG.UI_BAR_HEIGHT + 25, '', {
            fontSize: '16px',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 3
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(10001);

        // Texto de debug (modo de ação) - Movido de createInstructions
        window.debugText = scene.add.text(scene.cameras.main.centerX, 85, 'Ready to play!', {
            fontSize: '12px',
            fill: '#ffff00',
            stroke: '#000000',
            strokeThickness: 2
        })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(10000);

        // Atualizar cor do label e botões conforme estado na criação
        this.updateButtonStates();
        
        // Armazenar referência da barra
        window.uiBar = uiBar;

        // Criar UI de Inventário
        this.createInventoryUI(scene);
        this.createUpgradePanel(scene);
        
        console.log('UI criada com botões funcionais');
    }
    
    /**
     * Cria um botão customizado com fundo arredondado e texto.
     * @private
     */
    static _createButton(scene, x, y, text, config) {
        const {
            width = 85, height = 24, cornerRadius = 4,
            backgroundColor = 0x1a1a1a, hoverColor = 0x333333,
            textColor = '#ffffff', onClick = () => {}
        } = config;

        const buttonContainer = scene.add.container(x, y);
        buttonContainer.setScrollFactor(0).setDepth(10001);

        const background = scene.add.graphics();
        background.fillStyle(backgroundColor, 1);
        background.lineStyle(1, 0x444444, 1);
        background.fillRoundedRect(-width / 2, -height / 2, width, height, cornerRadius);
        background.strokeRoundedRect(-width / 2, -height / 2, width, height, cornerRadius);
        buttonContainer.add(background);

        const label = scene.add.text(0, 0, text, {
            fontSize: '11px',
            fill: textColor,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        buttonContainer.add(label);

        buttonContainer.setSize(width, height);
        buttonContainer.setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                buttonContainer.setScale(0.95);
                onClick();
            })
            .on('pointerup', () => {
                buttonContainer.setScale(1);
            })
            .on('pointerover', () => {
                // Só aplica o hover se o botão estiver habilitado
                if (buttonContainer.input.enabled) {
                    background.clear();
                    background.fillStyle(hoverColor, 1).fillRoundedRect(-width / 2, -height / 2, width, height, cornerRadius);
                    background.lineStyle(1, 0x00ffff, 0.5).strokeRoundedRect(-width / 2, -height / 2, width, height, cornerRadius);
                }
            })
            .on('pointerout', () => {
                buttonContainer.setScale(1);
                // Redesenha o botão com base no estado atual (ativo ou inativo)
                this.updateButtonStates();
            });

        // Armazenar referências para fácil atualização
        buttonContainer.background = background;
        buttonContainer.label = label;
        buttonContainer.config = { ...config, width, height, cornerRadius, backgroundColor };

        return buttonContainer;
    }
    
    static repositionUI(scene) {
        const width = scene.scale.width;
        const height = scene.scale.height;

        // Reposiciona todos os elementos da UI atualizando suas coordenadas de tela alvo (_screenX, _screenY)
        // O loop `fixUI` do GameManager usará essas coordenadas para posicionar os elementos corretamente com o zoom.
        if (window.uiBar) {
            window.uiBar._screenX = 0;
            window.uiBar._screenY = height - GAME_CONFIG.UI_BAR_HEIGHT;
        }
        if (window.coinText) { window.coinText._screenX = width / 2 - 50; window.coinText._screenY = height - GAME_CONFIG.UI_BAR_HEIGHT / 2; }
        if (window.spText) { window.spText._screenX = width / 2 + 50; window.spText._screenY = height - GAME_CONFIG.UI_BAR_HEIGHT / 2; }

        if (window.distanceText) { window.distanceText._screenX = width / 2; window.distanceText._screenY = height - GAME_CONFIG.UI_BAR_HEIGHT + 25; }
        if (window.debugText) window.debugText._screenX = width / 2;

        if (window.spawnMinerBtn) { window.spawnMinerBtn._screenX = width - 250; window.spawnMinerBtn._screenY = height - GAME_CONFIG.UI_BAR_HEIGHT / 2; }
        if (window.spawnSoldierBtn) { window.spawnSoldierBtn._screenX = width - 100; window.spawnSoldierBtn._screenY = height - GAME_CONFIG.UI_BAR_HEIGHT / 2; }
        if (window.spawnSpyBtn) { window.spawnSpyBtn._screenX = width - 390; window.spawnSpyBtn._screenY = height - GAME_CONFIG.UI_BAR_HEIGHT / 2; }
        if (window.upgradeBtn) { window.upgradeBtn._screenX = width / 2 - 200; window.upgradeBtn._screenY = height - GAME_CONFIG.UI_BAR_HEIGHT / 2; }
        if (window.objectiveText) { window.objectiveText._screenX = width / 2; window.objectiveText._screenY = 10; }
        if (window.upgradePanel) { window.upgradePanel._screenX = width / 2; window.upgradePanel._screenY = height / 2; }
        if (window.transmitBtn) { window.transmitBtn._screenX = width / 2 + 100; window.transmitBtn._screenY = height - GAME_CONFIG.UI_BAR_HEIGHT / 2; }
        if (window.progressText) { window.progressText._screenX = width / 2 + 100; window.progressText._screenY = height - GAME_CONFIG.UI_BAR_HEIGHT + 15; }

        if (window.gameManager && window.gameManager.statsPanel) {
            const panelWidth = 220;
            window.gameManager.statsPanel._screenX = width - panelWidth - 10;
        }

        const invStartY = height - GAME_CONFIG.UI_BAR_HEIGHT / 2;
        const invStartX = 20; // Move o inventário para a extrema ESQUERDA
        if (window.inventoryLabel) { window.inventoryLabel._screenX = invStartX; window.inventoryLabel._screenY = height - GAME_CONFIG.UI_BAR_HEIGHT + 10; }
        if (window.inventorySlots) {
            const slotSize = 36;
            const spacing = 4; // Espaçamento pequeno para não encavalar
            window.inventorySlots.forEach((slotObj, i) => {
                const x = invStartX + (i * (slotSize + spacing)) + slotSize/2;
                slotObj.slot._screenX = x; slotObj.slot._screenY = invStartY;
                slotObj.icon._screenX = x; slotObj.icon._screenY = invStartY;
            });
        }
        
    }

    // Método para atualizar estado dos botões
    static updateButtonStates() {
        if (!window.gameManager) return;

        if (window.spawnMinerBtn) {
            const cost = window.gameManager.getUnitCost('minerador');
            window.spawnMinerBtn.label.setText(`MINERADOR ($${cost})`);
            // Opacidade visual: mais claro se não tiver dinheiro
            const canAfford = window.gameManager.commander && window.gameManager.commander.coins >= cost;
            window.spawnMinerBtn.label.setAlpha(canAfford ? 1 : 0.5);
        }

        if (window.spawnSoldierBtn) {
            const cost = window.gameManager.getUnitCost('soldado');
            window.spawnSoldierBtn.label.setText(`SOLDADO ($${cost})`);
            const canAfford = window.gameManager.commander && window.gameManager.commander.coins >= cost;
            window.spawnSoldierBtn.label.setAlpha(canAfford ? 1 : 0.5);
        }

        if (window.spawnSpyBtn) {
            const cost = window.gameManager.getUnitCost('espiao');
            window.spawnSpyBtn.label.setText(`ESPIÃO ($${cost})`);
            const canAfford = window.gameManager.commander && window.gameManager.commander.coins >= cost;
            window.spawnSpyBtn.label.setAlpha(canAfford ? 1 : 0.5);
        }

        if (window.upgradeButtons) {
            Object.entries(window.upgradeButtons).forEach(([key, btn]) => {
                const gm = window.gameManager;
                const cost = gm.getUpgradeCost(key);
                const level = gm.getUpgradeLevel(key);
                const max = UPGRADE_DEFS[key].max;
                btn.label.setText(cost === null ? `${UPGRADE_DEFS[key].label}  Lv ${level}/${max}  MÁX` : `${UPGRADE_DEFS[key].label}  Lv ${level}/${max}  $${cost}`);
                const canAfford = cost !== null && gm.commander && gm.commander.coins >= cost;
                btn.label.setAlpha(canAfford ? 1 : 0.5);
            });
        }

        // Só missões de transmissão usam o botão e o progresso de rádio
        const isTransmitMission = !window.gameManager.mission || window.gameManager.mission.objective.type === 'transmit';
        if (window.transmitBtn) window.transmitBtn.setVisible(isTransmitMission);
        if (window.progressText) window.progressText.setVisible(isTransmitMission);

        if (window.transmitBtn && window.gameManager) {
            const cost = window.gameManager.messageCurrentCost;
            window.transmitBtn.label.setText(`TRANSMITIR ($${cost})`);
            const canAfford = window.gameManager.commander && window.gameManager.commander.coins >= cost;
            window.transmitBtn.label.setAlpha(canAfford ? 1 : 0.5);
            
            if (window.progressText) {
                window.progressText.setText(`PROGRESS: ${window.gameManager.messageProgress}%`);
            }
        }
    }
    static toggleUpgradePanel(scene) {
        if (!window.upgradePanel) return;
        window.upgradePanel.setVisible(!window.upgradePanel.visible);
        this.updateButtonStates();
    }

    static createUpgradePanel(scene) {
        const defs = Object.entries(UPGRADE_DEFS);
        const width = 300;
        const rowGap = 44;
        const height = 110 + defs.length * rowGap;
        const container = scene.add.container(scene.cameras.main.width / 2, scene.cameras.main.height / 2)
            .setScrollFactor(0).setDepth(10050).setVisible(false);

        const bg = scene.add.rectangle(0, 0, width, height, 0x000000, 0.92)
            .setStrokeStyle(2, 0xffaa00)
            .setDepth(10050)
            .setInteractive(); // Bloqueia cliques no mapa por trás do painel
        const title = scene.add.text(0, -height / 2 + 24, 'UPGRADES', {
            fontSize: '20px', fill: '#ffaa00', fontStyle: 'bold'
        }).setOrigin(0.5);
        container.add([bg, title]);

        window.upgradeButtons = {};
        defs.forEach(([key, def], i) => {
            const y = -height / 2 + 70 + i * rowGap;
            const btn = this._createButton(scene, 0, y, def.label, {
                width: 250, height: 26, backgroundColor: 0x333333,
                onClick: () => { if (window.gameManager) window.gameManager.buyUpgrade(key); }
            });
            const desc = scene.add.text(0, y + 18, def.desc, { fontSize: '10px', fill: '#aaaaaa' }).setOrigin(0.5);
            container.add([btn, desc]);
            window.upgradeButtons[key] = btn;
        });

        const closeBtn = this._createButton(scene, 0, height / 2 - 26, 'FECHAR', {
            width: 120, backgroundColor: 0xcc3333, hoverColor: 0xff5555,
            onClick: () => this.toggleUpgradePanel(scene)
        });
        container.add(closeBtn);

        window.upgradePanel = container;
    }

    static createInventoryUI(scene) {
        const width = scene.cameras.main.width;
        const height = scene.cameras.main.height;
        const barHeight = GAME_CONFIG.UI_BAR_HEIGHT;
        
        window.inventorySlots = [];
        const slotSize = 32;
        const spacing = 6;
        // Posiciona na extrema ESQUERDA da barra
        const startX = 20; 
        const startY = height - barHeight / 2;

        // Label
        window.inventoryLabel = scene.add.text(startX, height - barHeight + 8, 'ITEMS', {
            fontSize: '10px',
            fill: '#aaaaaa',
            fontStyle: 'bold'
        }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10001);

        for (let i = 0; i < 4; i++) {
            const x = startX + (i * (slotSize + spacing)) + slotSize/2;
            
            // Fundo do slot
            const slot = scene.add.rectangle(x, startY, slotSize, slotSize, 0x222222)
                .setStrokeStyle(1, 0x555555)
                .setScrollFactor(0)
                .setDepth(10001);
            
            // Ícone do item (inicialmente invisível)
            const icon = scene.add.sprite(x, startY, null)
                .setScrollFactor(0)
                .setDepth(10002)
                .setVisible(false)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', (pointer) => {
                    pointer.event.stopPropagation(); // Impede clique no mapa
                    if (window.gameManager) window.gameManager.useItem(i);
                });
                
            window.inventorySlots.push({ slot, icon });
        }
    }

    static updateInventory(items, equippedWeapon) {
        if (!window.inventorySlots) return;
        
        console.log('[UIManager] Atualizando inventário:', items);

        window.inventorySlots.forEach((slotObj, index) => {
            if (index < items.length) {
                const itemId = items[index];
                let texture = 'rock'; // fallback
                if (itemId === 'moeda') texture = 'coin';
                else if (itemId === 'shotgun') texture = 'shotgun';
                else if (itemId === 'medkit') texture = 'medkit';
                else if (itemId === 'bomb') texture = 'bomb';

                // Verificação de segurança: se a textura não existe, usa fallback para 'rock'
                if (!slotObj.icon.scene.textures.exists(texture)) {
                    console.warn(`[UIManager] Textura '${texture}' para o item '${itemId}' não encontrada. Usando 'rock'.`);
                    texture = 'rock';
                }

                slotObj.icon.setTexture(texture);
                if (itemId === 'moeda') slotObj.icon.setFrame(0); // Pega o primeiro frame da moeda
                
                // Ajusta escala para caber no slot (max 26px)
                if (slotObj.icon.width > 0 && slotObj.icon.height > 0) {
                    const scale = Math.min(26 / slotObj.icon.width, 26 / slotObj.icon.height);
                    slotObj.icon.setScale(scale);
                    // FIX: Atualiza a escala base para o fixUI do GameManager não distorcer no zoom
                    slotObj.icon._baseScaleX = scale;
                    slotObj.icon._baseScaleY = scale;
                } else {
                    slotObj.icon.setScale(1); // Fallback seguro
                }
                
                slotObj.icon.setVisible(true);
                // Realça slot ocupado; verde quando é a arma em uso
                const isEquipped = itemId === equippedWeapon;
                slotObj.slot.setStrokeStyle(isEquipped ? 2 : 1, isEquipped ? 0x00ff00 : 0xffffff);
            } else {
                slotObj.icon.setVisible(false);
                slotObj.slot.setStrokeStyle(1, 0x555555); // Slot vazio escuro
            }
        });
    }
}
window.UIManager = UIManager;
