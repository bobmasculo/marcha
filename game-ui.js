// game-ui.js
// Interface do jogo: painel de stats, mensagens, HUD e telas de fim de jogo.
// Métodos mesclados no prototype do GameManager (ver game-manager.js).
export const GameUIMethods = {
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
    },


    toggleStatsPanelVisibility() {
        this.shared.statsPanelVisible = !this.shared.statsPanelVisible;
        // Atualiza imediatamente a visibilidade do painel
        this.updateStatsPanel();
    },

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
    },


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
    },

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
    },

    // Game state
    checkVictoryCondition() {
        const allPlayers = this.players.getChildren();
        const playersAlive = allPlayers.filter(p => p.health > 0);

        if (playersAlive.length === 0) {
            let winner = 'draw';
            let reason = 'Commander Defeated';

            this.handleGameOver({ winner, scores: 0, reason });
        }
    },


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
    },

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
    },
};
