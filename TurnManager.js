/**
 * @class TurnManager
 * @description Gerencia o estado dos turnos no lado do cliente.
 */
export default class TurnManager {
    /**
     * @param {Phaser.Scene} scene A cena Phaser que está usando este gerenciador.
     */
    constructor(scene) {
        /** @type {Phaser.Scene} */
        this.scene = scene;

        /** @type {string|null} O ID do personagem cujo turno está ativo. */
        this.activeCharacterId = null;

        /** @type {string|null} O ID do time cujo turno está ativo. */
        this.activeTeamId = null;

        /** @type {string|null} O ID do time do jogador local. */
        this.localTeamId = null;

        /** @type {string|null} O ID do personagem que o jogador local controla neste turno. */
        this.localPlayerCharacterId = null;

        // Controle de tempo
        this.turnStartTime = 0;
        this.turnTimeLimit = 60;

        // Escuta o evento da rede para iniciar um novo turno
        this.scene.events.on('network_new_turn', this.handleNewTurn, this);
    }

    /**
     * Define os dados iniciais do jogador local.
     * @param {string} teamId O ID do time do jogador.
     */
    setLocalTeam(teamId) {
        this.localTeamId = teamId;
    }

    /**
     * NOVO: Define o estado inicial do turno com base nos dados de início de jogo.
     * Isso garante que o TurnManager saiba quem começa antes do primeiro evento 'network_new_turn'.
     * @param {object} initialTurnData - Dados do turno inicial. Ex: { activeCharacterId: 'char123', teamId: 'teamA' }
     */
    setInitialTurn(initialTurnData) {
        if (!initialTurnData || !initialTurnData.activeCharacterId) {
            console.warn('[TurnManager] Tentativa de definir turno inicial sem dados válidos.');
            // Mesmo sem dados, emita um evento para garantir que a UI comece desabilitada.
            this.scene.events.emit('turn_changed', { activeCharacterId: null, isOurTurn: false });
            return;
        }
        // Reutiliza a mesma lógica de 'handleNewTurn' para consistência.
        this.handleNewTurn(initialTurnData);
    }

    /**
     * Chamado quando o servidor anuncia um novo turno.
     * @param {object} turnData - Dados do turno vindos do servidor. Ex: { activeCharacterId: 'char123', teamId: 'teamA' }
     */
    handleNewTurn(turnData) {
        // **CORREÇÃO**: Lida com diferentes formatos de turnData para robustez.
        const activeCharacterId = turnData.activeCharacterId;
        const teamId = turnData.teamId;

        if (!activeCharacterId || !teamId) {
            console.error('[TurnManager] handleNewTurn recebeu dados de turno inválidos:', turnData);
            return;
        }

        console.log(`[TurnManager] Novo turno iniciado para o personagem: ${activeCharacterId} do time ${teamId}`);
        this.activeCharacterId = activeCharacterId;
        this.activeTeamId = teamId;

        // Verifica se o turno é do time do jogador local
        if (teamId === this.localTeamId) {
            this.localPlayerCharacterId = activeCharacterId;
            console.log(`[TurnManager] É o nosso turno! Personagem: ${this.localPlayerCharacterId}`);
        } else {
            this.localPlayerCharacterId = null;
        }

        // Atualiza o tempo do turno
        this.turnTimeLimit = turnData.turnTimeLimit || 60;
        this.turnStartTime = this.scene.time.now;

        // Emite um evento global para que outras partes do jogo (UI, Câmera, etc.) possam reagir.
        this.scene.events.emit('turn_changed', {
            activeCharacterId: this.activeCharacterId,
            isOurTurn: this.isOurTurn(),
            sp: turnData.sp,
            teamId: this.activeTeamId
        });
    }

    /**
     * Retorna o tempo restante do turno em segundos.
     */
    getRemainingTime() {
        if (!this.turnStartTime) return 0;
        const elapsed = (this.scene.time.now - this.turnStartTime) / 1000;
        return Math.max(0, Math.ceil(this.turnTimeLimit - elapsed));
    }

    /**
     * Verifica se é o turno do jogador local.
     * @returns {boolean}
     */
    isOurTurn() {
        return this.localPlayerCharacterId !== null && this.activeCharacterId === this.localPlayerCharacterId;
    }

    /**
     * Retorna o ID do personagem ativo.
     * @returns {string|null}
     */
    getActiveCharacterId() {
        return this.activeCharacterId;
    }

    /**
     * Retorna o ID do time ativo.
     * @returns {string|null}
     */
    getActiveTeamId() {
        return this.activeTeamId;
    }

    destroy() {
        this.scene.events.off('network_new_turn', this.handleNewTurn, this);
    }
}