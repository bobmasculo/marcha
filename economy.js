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
    // commander.inventory é uma lista de slots { id, count }.

    /** Slot do inventário que ainda aceita mais deste item (pilha não cheia), se houver. */
    findStackSlot(itemId) {
        const stackMax = ITEMS[itemId].stack || 1;
        return this.commander.inventory.find(s => s.id === itemId && s.count < stackMax);
    },

    /** Cabe no inventário? Item único não repete; item instantâneo (moeda) não ocupa slot. */
    canPickUp(itemId) {
        const def = ITEMS[itemId];
        if (!def || !this.commander) return false;
        if (def.use === 'instant') return true;
        const inv = this.commander.inventory;
        if (def.unique && inv.some(s => s.id === itemId)) return false;
        if (this.findStackSlot(itemId)) return true;
        return inv.length < GAME_CONFIG.INVENTORY_SLOTS;
    },

    handleItemPickup(playerId, itemId) {
        const def = ITEMS[itemId];
        if (!def || !this.commander) return;

        if (def.use === 'instant') {
            const coins = def.effect.coins;
            this.commander.coins += coins;
            this.showFloatingText(this.commander.x, this.commander.y - 60, `+$${coins}`, '#ffd700');
            this.updateUI();
            return;
        }

        if (!this.canPickUp(itemId)) return;
        const slot = this.findStackSlot(itemId);
        if (slot) slot.count++;
        else this.commander.inventory.push({ id: itemId, count: 1 });
        this.showMessage(`Item: ${def.name}`);
        this.updateInventoryUI();
    },

    // --- USO DE ITENS ---
    useItem(slotIndex) {
        const player = this.commander;
        if (!player || !player.active || player.health <= 0 || this.isGameOver) return;
        const slot = player.inventory[slotIndex];
        if (!slot) return;

        const def = ITEMS[slot.id];
        const fx = def.effect;
        let consumed = false;

        if (fx.heal) {
            if (player.health >= player.maxHealth) {
                this.showMessage('Health already full!');
                return;
            }
            const newHealth = Math.min(player.health + fx.heal, player.maxHealth);
            this.showFloatingText(player.x, player.y - 60, `+${Math.round(newHealth - player.health)} HP`, '#00ff00');
            this.updateCharacterHealth(player.id, newHealth);
            if (this.soundManager) this.soundManager.play('impact');
            consumed = true;
        } else if (fx.weapon) {
            // A arma fica no inventário: clicar de novo volta para a arma original
            const baseWeapon = PLAYER_CONFIGS[player.playerType].weapon || 'pistol';
            player.weapon = player.weapon === fx.weapon ? baseWeapon : fx.weapon;
            this.showMessage(`Arma: ${WEAPONS[player.weapon].name}`);
        } else if (fx.blast && fx.throwRange) {
            consumed = this.throwGrenade(player, def);
        } else if (fx.blast) {
            this.blastAt(player.x, player.y, fx.blast, { damage: fx.damage, targets: fx.targets });
            consumed = true;
        } else if (fx.speed) {
            this.addEffect('speed', def.name.toUpperCase(), fx.duration, {
                start: () => { player.speedMult = fx.speed; },
                end: () => { player.speedMult = 1; }
            });
            consumed = true;
        }

        if (consumed) {
            slot.count--;
            if (slot.count <= 0) player.inventory.splice(slotIndex, 1);
        }

        this.updateInventoryUI();
        this.updateUI();
        this.updateStatsPanel();
    },

    /** Lança a granada no alien mais próximo dentro do alcance. Devolve false se não havia alvo. */
    throwGrenade(player, def) {
        const fx = def.effect;
        let target = null;
        let minDist = fx.throwRange;
        this.scene.npcManager.npcs.getChildren().forEach(npc => {
            if (!npc.active || npc.health <= 0) return;
            const d = Phaser.Math.Distance.Between(player.x, player.y, npc.x, npc.y);
            if (d <= minDist) { minDist = d; target = npc; }
        });
        if (!target) {
            this.showMessage('Nenhum alvo ao alcance');
            return false;
        }

        const tx = target.x;
        const ty = target.y;
        const grenade = this.scene.add.image(player.x, player.y - 30, def.texture).setScale(def.scale * 0.8).setDepth(3000);
        this.scene.tweens.add({
            targets: grenade, x: tx, y: ty, angle: 360,
            duration: Math.max(150, minDist / 1.2),
            onComplete: () => {
                grenade.destroy();
                this.blastAt(tx, ty, fx.blast, { damage: fx.damage, targets: fx.targets });
            }
        });
        return true;
    },

    // --- EFEITOS TEMPORÁRIOS (adrenalina etc.) ---
    /** Liga um efeito por `duration` ms; usar de novo renova o tempo em vez de empilhar. */
    addEffect(key, label, duration, { start, end }) {
        const existing = this.effects[key];
        if (existing) {
            existing.until = this.scene.time.now + duration;
            return;
        }
        if (start) start();
        this.effects[key] = { label, until: this.scene.time.now + duration, end };
        this.showMessage(`${label}!`);
    },

    updateEffects() {
        const now = this.scene.time.now;
        const keys = Object.keys(this.effects);
        keys.forEach(key => {
            const effect = this.effects[key];
            if (now >= effect.until) {
                if (effect.end) effect.end();
                delete this.effects[key];
            }
        });
        if (!window.effectText) return;
        const lines = Object.values(this.effects).map(e => `${e.label} ${Math.ceil((e.until - now) / 1000)}s`);
        window.effectText.setText(lines.join('\n'));
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
        const slots = this.commander ? this.commander.inventory : [];
        if (window.UIManager && typeof window.UIManager.updateInventory === 'function') {
            window.UIManager.updateInventory(slots, this.commander ? this.commander.weapon : null);
        }
    },
};
