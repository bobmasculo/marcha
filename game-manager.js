// game-manager.js
// Orquestrador do jogo. Os métodos ficam divididos por responsabilidade:
//   input-manager.js   mouse, teclado, câmera e zoom
//   combat-manager.js  tiro, dano, morte e efeitos
//   unit-manager.js    unidades, seleção, formação e movimento
//   economy.js         moedas, transmissão, mineração e inventário
//   game-ui.js         painel de stats, mensagens e fim de jogo
//   progression.js     missões, objetivos e upgrades
import { InputMethods } from './input-manager.js';
import { CombatMethods } from './combat-manager.js';
import { UnitMethods } from './unit-manager.js';
import { EconomyMethods } from './economy.js';
import { GameUIMethods } from './game-ui.js';
import { ProgressionMethods } from './progression.js';

export default class GameManager {
    constructor(scene, animManager, soundManager) {
        this.scene = scene;
        this.players = scene.physics.add.group();
        this.animationManager = animManager; // Armazena a referência
        this.soundManager = soundManager; // Armazena a referência do som
        this.currentMissionNumber = 1; // Default para missão 1
        this.commander = null;
        this.selectedPlayer = null; 
        this.actionMode = null;
        this.messageProgress = 0; // Progresso do objetivo (0 a 100)
        this.messageCurrentCost = GAME_CONFIG.MESSAGE_INITIAL_COST || 100;
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

        this.initProgression();

        this.setupInput();
        this.setupResizeHandler();

        // UI para jogadores conectados
       // this.shared.connectedPlayersText = this.scene.add.text(10, 10, 'Conectando...', { fontSize: '16px', fill: '#fff', stroke: '#000', strokeThickness: 2 }).setScrollFactor(0).setDepth(10000);

        // Cria a UI de Atributos (Botão e Painel)
        this.createStatsUI();

    }

    // Update loop
    update() {
        this.fixUI();
        this.updateDragging();
        this.updateCamera();
        this.updateLocalPlayerMovement();
        this.updatePlayers();

        // --- LÓGICA DE REGENERAÇÃO DO COMANDANTE (10 HP/s) ---
        if (this.commander && this.commander.active && this.commander.health > 0 && this.commander.health < this.commander.maxHealth) {
            if (this.scene.time.now - this.lastRegenTime > 1000) {
                const healAmount = GAME_CONFIG.COMMANDER_REGEN_PER_SEC;
                const nextHealth = Math.min(this.commander.health + healAmount, this.commander.maxHealth);
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
}

Object.assign(GameManager.prototype, InputMethods, CombatMethods, UnitMethods, EconomyMethods, GameUIMethods, ProgressionMethods);
