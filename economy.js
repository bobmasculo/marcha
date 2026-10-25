// economy.js
// Economia: moedas, transmissão, mineração e inventário.
// Métodos mesclados no prototype do GameManager (ver game-manager.js).
export const EconomyMethods = {
    /**
     * Executa a transmissão da mensagem para avançar no objetivo principal.
     */
    transmitMessage() {
        if (this.mission.objective.type !== 'transmit') return;
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
        this.updateObjectiveUI();
        this.updateUI();

        if (this.messageProgress >= 100) {
            this.messageProgress = 100;
            this.handleGameOver({ winner: 'player', reason: 'Communication Restored!' });
        }
    },

    // --- USO DE ITENS ---
    useItem(slotIndex) {
        if (!this.selectedPlayer) return;
        
        const player = this.selectedPlayer;
        if (slotIndex >= player.inventory.length) return;

        const itemId = player.inventory[slotIndex];

        if (itemId === 'medkit') {
            // Verifica se o personagem já está com a vida cheia
            if (player.health >= player.maxHealth) {
                this.showMessage("Health already full!");
                return;
            }
            
            const healAmount = 20; // Valor solicitado de cura
            const oldHealth = player.health;
            const newHealth = Math.min(oldHealth + healAmount, player.maxHealth);
            
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
            this.showMessage(`Unit healed! HP: ${player.health}/${player.maxHealth}`);
        }

    },

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
    },

    /**
     * Lógica de mineração: adiciona moedas e remove o recurso.
     */
    collectOre(miner, ore) {
        if (!ore.active) return;

        const value = Math.round((ore.getData('value') || GAME_CONFIG.ORE_VALUE) * (1 + this.getUpgradeBonus('mining')));
        if (this.commander) {
            this.commander.coins += value;
            this.updateUI();
            // Feedback visual rápido de coleta
            this.showFloatingText(ore.x, ore.y, `+$${value}`, '#0000ff');
            ore.destroy(); // Remove o minério do mapa
            this.registerOreMined(value);
        }
    },


    updateInventoryUI() {
        const items = this.selectedPlayer ? this.selectedPlayer.inventory : [];
        console.log(`[GameManager] updateInventoryUI para ${this.selectedPlayer ? this.selectedPlayer.id : 'null'}:`, items);
        if (window.UIManager && typeof window.UIManager.updateInventory === 'function') {
            window.UIManager.updateInventory(items);
        }
    },
};
