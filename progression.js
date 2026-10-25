// progression.js
// Missões (dados), upgrades e objetivos. As definições de upgrade ficam em config.js (UPGRADE_DEFS). Os métodos são mesclados no prototype do GameManager.

/**
 * Cada missão é um objeto: para criar uma nova, basta acrescentar uma entrada.
 * objective.type:
 *   'transmit'  - chegar a 100% no botão TRANSMITIR
 *   'eliminate' - eliminar `goal` aliens
 *   'mine'      - coletar `goal` moedas de minério
 *   'explore'   - explorar `goal` áreas (pedaços de 500 × 500 px) do mapa
 *
 * map: tamanho do mundo (small | medium | large | huge | vast), abertura (1 = quase sem obstáculos)
 * e, opcionalmente, aliensPerChunk e veinChance. Ver world-gen.js.
 */
export const MISSIONS = [
    { name: 'Primeiro Contato', briefing: 'Restabeleça o contato com a base.',
      npcCount: 20, ores: 1500, startCoins: 50, objective: { type: 'transmit' },
      map: { size: 'small', openness: 0.9 } },
    { name: 'Limpeza de Área', briefing: 'Elimine a ameaça alienígena.',
      npcCount: 30, ores: 1500, startCoins: 75, objective: { type: 'eliminate', goal: 15 },
      map: { size: 'medium', openness: 0.85 } },
    { name: 'Corrida do Ouro', briefing: 'Minere o suficiente para financiar a guerra.',
      npcCount: 35, ores: 2500, startCoins: 50, objective: { type: 'mine', goal: 600 },
      map: { size: 'large', openness: 0.85 } },
    { name: 'Silêncio de Rádio', briefing: 'Transmita a mensagem sob forte presença inimiga.',
      npcCount: 55, ores: 2500, startCoins: 50, objective: { type: 'transmit' },
      map: { size: 'medium', openness: 0.75 } },
    { name: 'Extermínio', briefing: 'Derrube o enxame.',
      npcCount: 55, ores: 2500, startCoins: 100, objective: { type: 'eliminate', goal: 40 },
      map: { size: 'huge', openness: 0.8 } },
    // Mundo aberto de 300000 × 200000 px: só os pedaços perto da câmera existem
    { name: 'Fronteira', briefing: 'Explore o território desconhecido.',
      npcCount: 0, ores: 0, startCoins: 100, objective: { type: 'explore', goal: 150 },
      map: { size: 'vast', openness: 0.9, aliensPerChunk: 0.5, veinChance: 0.3 } }
];

/** Depois da última missão a lista recomeça com mais inimigos. */
export function getMission(number) {
    const index = Math.max(0, number - 1);
    const base = MISSIONS[index % MISSIONS.length];
    const loops = Math.floor(index / MISSIONS.length);
    const objective = { ...base.objective };
    if (objective.goal) objective.goal += loops * 10;
    return { ...base, number, npcCount: base.npcCount + loops * 5, objective };
}

export const ProgressionMethods = {
    initProgression() {
        this.mission = this.scene.mission;
        this.kills = 0;
        this.coinsMined = 0;
        this.explored = 0;
        // O registry sobrevive ao restart da cena: upgrades valem de uma missão para a outra
        this.upgrades = { damage: 0, health: 0, mining: 0, range: 0, ...(this.scene.registry.get('upgrades') || {}) };
    },

    getUpgradeLevel(key) {
        return this.upgrades[key] || 0;
    },

    getUpgradeBonus(key) {
        return this.getUpgradeLevel(key) * UPGRADE_DEFS[key].per;
    },

    /** Custo do próximo nível, ou null se já estiver no máximo. */
    getUpgradeCost(key) {
        const level = this.getUpgradeLevel(key);
        if (level >= UPGRADE_DEFS[key].max) return null;
        return UPGRADE_DEFS[key].base * Math.pow(2, level);
    },

    buyUpgrade(key) {
        const cost = this.getUpgradeCost(key);
        if (cost === null) {
            this.showMessage(`${UPGRADE_DEFS[key].label} já está no nível máximo!`);
            return;
        }
        if (!this.commander || this.commander.coins < cost) {
            this.showMessage(`Precisa de $${cost} para melhorar ${UPGRADE_DEFS[key].label}!`);
            return;
        }

        this.commander.coins -= cost;
        this.upgrades[key]++;
        this.scene.registry.set('upgrades', { ...this.upgrades });

        // Vida máxima vale também para quem já está em campo
        if (key === 'health') {
            const extra = UPGRADE_DEFS.health.per;
            this.players.getChildren().forEach(p => {
                if (!p.active || p.health <= 0) return;
                p.maxHealth += extra;
                p.health += extra;
                this.drawHealthBar(p.healthBar, 40, 6, p.health / p.maxHealth);
            });
        }

        this.showMessage(`${UPGRADE_DEFS[key].label} nível ${this.upgrades[key]}!`);
        this.updateUI();
        this.updateStatsPanel();
    },

    registerKill() {
        this.kills++;
        this.updateObjectiveUI();
        this.checkObjective();
    },

    /** Chamado a cada frame com o total de áreas exploradas; só reage quando o número muda. */
    registerExploration(count) {
        if (count === this.explored) return;
        this.explored = count;
        this.updateObjectiveUI();
        this.checkObjective();
    },

    registerOreMined(value) {
        this.coinsMined += value;
        this.updateObjectiveUI();
        this.checkObjective();
    },

    checkObjective() {
        const { type, goal } = this.mission.objective;
        if (type === 'eliminate' && this.kills >= goal) {
            this.handleGameOver({ winner: 'player', reason: 'Área limpa' });
        } else if (type === 'mine' && this.coinsMined >= goal) {
            this.handleGameOver({ winner: 'player', reason: 'Meta de mineração atingida' });
        } else if (type === 'explore' && this.explored >= goal) {
            this.handleGameOver({ winner: 'player', reason: 'Território explorado' });
        }
    },

    getObjectiveText() {
        const { type, goal } = this.mission.objective;
        const title = `MISSÃO ${this.mission.number}: ${this.mission.name.toUpperCase()}`;
        if (type === 'eliminate') return `${title}\nEliminar aliens: ${this.kills}/${goal}`;
        if (type === 'mine') return `${title}\nMinerar: $${this.coinsMined}/${goal}`;
        if (type === 'explore') return `${title}\nExplorar: ${this.explored}/${goal} áreas`;
        return `${title}\nTransmitir: ${this.messageProgress}%`;
    },

    updateObjectiveUI() {
        if (window.objectiveText) window.objectiveText.setText(this.getObjectiveText());
    }
};
