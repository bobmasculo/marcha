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

    // --- INVENTÁRIO COMPARTILHADO: tudo que as unidades pegam vai para o comandante ---
    /** Cabe no inventário? Armas não se repetem; moeda não ocupa espaço. */
    canPickUp(itemId) {
        if (itemId === 'moeda') return true;
        const inv = this.commander ? this.commander.inventory : null;
        if (!inv || inv.length >= 4) return false;
        return !(itemId === 'shotgun' && inv.includes('shotgun'));
    },

    handleItemPickup(playerId, itemId) {
        if (!this.commander) return;

        if (itemId === 'moeda') {
            this.commander.coins += GAME_CONFIG.COIN_DROP_VALUE;
            this.showFloatingText(this.commander.x, this.commander.y - 60, `+$${GAME_CONFIG.COIN_DROP_VALUE}`, '#ffd700');
            this.updateUI();
            return;
        }

        if (!this.canPickUp(itemId)) return;
        this.commander.inventory.push(itemId);
        this.showMessage(`Item: ${itemId}`);
        this.updateInventoryUI();
    },

    // --- USO DE ITENS ---
    useItem(slotIndex) {
        const player = this.commander;
        if (!player || !player.active || player.health <= 0) return;
        if (slotIndex >= player.inventory.length) return;

        const itemId = player.inventory[slotIndex];

        if (itemId === 'medkit') {
            if (player.health >= player.maxHealth) {
                this.showMessage("Health already full!");
                return;
            }

            const healAmount = 20;
            const oldHealth = player.health;
            const newHealth = Math.min(oldHealth + healAmount, player.maxHealth);
            this.showFloatingText(player.x, player.y - 60, `+${Math.round(newHealth - oldHealth)} HP`, '#00ff00');
            this.updateCharacterHealth(player.id, newHealth);
            if (this.soundManager) this.soundManager.play('impact');

            player.inventory.splice(slotIndex, 1);
            this.showMessage(`Unit healed! HP: ${player.health}/${player.maxHealth}`);
        } else if (itemId === 'shotgun') {
            // A arma fica no inventário: clicar de novo volta para a arma original
            const baseWeapon = PLAYER_CONFIGS[player.playerType].weapon || 'pistol';
            player.weapon = player.weapon === 'shotgun' ? baseWeapon : 'shotgun';
            this.showMessage(`Arma: ${WEAPONS[player.weapon].name}`);
        } else if (itemId === 'bomb') {
            player.inventory.splice(slotIndex, 1);
            this.detonateBomb(player.x, player.y);
        }

        this.updateInventoryUI();
        this.updateUI();
        this.updateStatsPanel();
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
        const items = this.commander ? this.commander.inventory : [];
        if (window.UIManager && typeof window.UIManager.updateInventory === 'function') {
            window.UIManager.updateInventory(items, this.commander ? this.commander.weapon : null);
        }
    },
};
