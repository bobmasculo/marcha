// main.js
import LobbyScene from './LobbyScene.js';
import GameScene from './GameScene.js';

// ======================
// VARIÁVEIS GLOBAIS DE CONFIGURAÇÃO
// ======================
const CONFIG = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#3a3a3a',
    parent: 'game-container', // <-- INSTRUÇÃO PARA USAR O DIV
     scale: {
        mode: Phaser.Scale.FIT,
            width: 1280,   // Resolução lógica de desenvolvimento
            height: 720,
            autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
            gravity: { x: 0, y: 0 },
            overlapBias: 12, // Aumenta a sensibilidade de sobreposição
            tileBias: 32     // Melhora a detecção em quinas
        }
    },
    // Adiciona as duas cenas ao jogo. A primeira da lista é a que inicia.
    scene: [LobbyScene, GameScene]
};

// Inicializar o jogo
new Phaser.Game(CONFIG);
