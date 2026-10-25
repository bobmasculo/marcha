const express = require('express');
const cors = require('cors');
const app = express();

const http = require('http').Server(app);

const io = require('socket.io')(http, {
  cors: {
    origin: [
      "http://127.1.1.1",
      "http://localhost",
      "http://192.168.18.13"
    ],
    methods: ["GET", "POST"],
    credentials: true
  } 
});

const PORT = process.env.PORT || 3000;

// ===== CORS PARA O EXPRESS =====
app.use(cors({
  origin: [
    "http://127.1.1.1",
    "http://localhost",
    "http://192.168.18.13"
  ],
  credentials: true
}));

// Serve os arquivos estáticos do jogo
app.use(express.static('public')); // mantém como estava

// ESTADO DO JOGO E LOBBY
let lobbyPlayers = {}; // Guarda os jogadores na sala de espera: { socketId: { id, name, isReady } }
let gameStarted = false; // Flag para controlar se o jogo já começou
let connectedPlayers = {}; // Guarda os sockets e os times que eles controlam (usado após o início do jogo)
let characters = {}; // Guarda o estado de todos os 6 personagens do jogo
let currentTurnTeam = null; // Guarda de quem é o turno atual
let turnCount = 0; // Contador de turnos

// PONTOS DE SPAWN
const spawnPoints = {
    blue: [
       { id: 'Donald', x: 50, y: 200, type: 'american1' },
        { id: 'Stalone', x: 150, y: 200, type: 'american2' },
        { id: 'Mikey', x: 250, y: 200, type: 'american3' },
        { id: 'Arnold', x: 150, y: 300, type: 'american_tank' }
    ],
    red: [
        { id: 'red_1', x: 1600, y: 1400, type: 'type2' }, 
        { id: 'red_2', x: 1700, y: 1400, type: 'comunista2' },
        { id: 'red_3', x: 1800, y: 1400, type: 'comunista1' },
        { id: 'stalin', x: 1700, y: 1500, type: 'comunist_tank' }
    ]
};

// Constantes do Jogo no Servidor
const GAME_CONSTANTS = {
    SHOOT_DAMAGE: 10,
    MAX_HEALTH: 100,
    HIT_RADIUS: 50 // Raio para considerar um acerto no alvo
};

// Função para iniciar ou reiniciar o estado do jogo
function initializeGame() {
    gameStarted = true;
    currentTurnTeam = 'blue'; // O time 'blue' sempre começa
    turnCount = 1; // O jogo começa no turno 1
    console.log("Initializing game state with all characters...");
    characters = {};
    [...spawnPoints.blue, ...spawnPoints.red].forEach(spawn => {
        characters[spawn.id] = {
            id: spawn.id,
            x: spawn.x,
            y: spawn.y,
            rotation: 0,
            team: spawn.id.includes('blue') ? 'blue' : 'red',
            type: spawn.type,
            health: GAME_CONSTANTS.MAX_HEALTH // Adiciona vida ao estado do personagem
        };
    });
}

// Não inicia o jogo ao ligar o servidor, espera o lobby.
// initializeGame(); 

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Se o jogo já começou, não permite novos jogadores
    if (gameStarted) {
        console.log(`Game in progress. Disconnecting player ${socket.id}.`);
        socket.emit('game_in_progress'); // Um evento mais específico
        socket.disconnect();
        return;
    }

    // Adiciona o novo jogador ao lobby
    lobbyPlayers[socket.id] = { 
        id: socket.id, 
        name: `Jogador ${Object.keys(lobbyPlayers).length + 1}`, 
        isReady: false 
    };
    
    // Envia o estado atualizado do lobby para todos
    broadcastLobbyState();

    // --- LISTENERS DO LOBBY ---
    socket.on('player_ready_status', (isReady) => {
        if (lobbyPlayers[socket.id]) {
            lobbyPlayers[socket.id].isReady = !!isReady; // Garante que é booleano
            console.log(`[Lobby] Player ${socket.id} ready status: ${isReady}`);
            broadcastLobbyState();
            checkAllPlayersReady();
        }
    });

    socket.on('player_name_update', (name) => {
        if (lobbyPlayers[socket.id] && name) {
            lobbyPlayers[socket.id].name = name.substring(0, 15); // Limita o tamanho do nome
            broadcastLobbyState();
        }
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        // Se o jogador estava no lobby
        if (lobbyPlayers[socket.id]) {
            delete lobbyPlayers[socket.id];
            broadcastLobbyState();
        }

        // Se o jogador estava em um jogo em andamento
        if (connectedPlayers[socket.id] && gameStarted) {
            console.log(`Player ${socket.id} disconnected during an active game. Aborting match and resetting server.`);
            
            // 1. Notifica os outros jogadores que o jogo foi abortado
            const playerName = lobbyPlayers[socket.id]?.name || 'Um jogador';
            const reason = `${playerName} desconectou.`;
            socket.broadcast.emit('game_aborted', reason);

            // 2. Reseta completamente o estado do servidor para voltar ao estado de lobby
            gameStarted = false;
            lobbyPlayers = {};
            connectedPlayers = {};
            characters = {};
            console.log("Server state has been reset. Ready for a new lobby.");
            turnCount = 0;

            // 3. Força todos os clientes restantes a recarregarem a página para voltar ao lobby inicial
            io.emit('force_reload');
        }
        currentTurnTeam = null; // Reseta o turno
    });

    // --- LISTENERS DO JOGO (permanecem os mesmos) ---
    socket.on('request_restart_game', () => {
        console.log(`Game restart requested by ${socket.id}`);
        // Esta lógica pode precisar ser repensada. Por agora, vamos recarregar o servidor.
        // Ou, idealmente, resetar o estado para o lobby.
        gameStarted = false;
        lobbyPlayers = {};
        connectedPlayers = {};
        characters = {};
        currentTurnTeam = null;
        turnCount = 0;
        console.log("Server state reset. Ready for a new lobby.");
        // Força todos os clientes a recarregarem a página para voltar ao lobby
        io.emit('force_reload');
    });

    socket.on('character_movement', ({ characterId, x, y, rotation }) => {
        if (gameStarted && characters[characterId]) {
            characters[characterId].x = x;
            characters[characterId].y = y;
            characters[characterId].rotation = rotation;
            socket.broadcast.emit('character_moved', characters[characterId]);
        }
    });

    socket.on('character_shot', ({ characterId, shotData }) => {
        if (!gameStarted) return;

        // 1. Transmite o efeito visual do tiro para todos, para que vejam imediatamente.
        socket.broadcast.emit('character_shot_fired', { characterId, shotData });

        // 2. Lógica de dano autoritativa do servidor
        const shooter = characters[characterId];
        if (!shooter) return;

        // Função para encontrar o inimigo mais próximo do ponto de impacto
        let targetCharacter = null;
        let minDist = Infinity;
        Object.values(characters).forEach(p => {
            if (!p || p.id === shooter.id || p.team === shooter.team || p.health <= 0) return;
            
            const dist = Math.sqrt(Math.pow(p.x - shotData.x, 2) + Math.pow(p.y - shotData.y, 2));
            if (dist < GAME_CONSTANTS.HIT_RADIUS && dist < minDist) {
                minDist = dist;
                targetCharacter = p;
            }
        });

        // 3. Se um alvo foi encontrado, aplica o dano e atualiza o estado
        if (targetCharacter) {
            targetCharacter.health -= GAME_CONSTANTS.SHOOT_DAMAGE;
            if (targetCharacter.health < 0) {
                targetCharacter.health = 0;
            }
            
            // 4. Anuncia a mudança de vida para TODOS os clientes
            io.emit('character_health_update', { 
                characterId: targetCharacter.id, 
                newHealth: targetCharacter.health 
            });
        }
    });

    socket.on('end_turn', () => {
        if (!gameStarted || !currentTurnTeam) return;

        // Verifica se quem terminou o turno é o jogador correto
        const playerTeam = connectedPlayers[socket.id]?.team;
        if (playerTeam !== currentTurnTeam) {
            console.warn(`Player ${socket.id} (team ${playerTeam}) tried to end turn, but it's ${currentTurnTeam}'s turn.`);
            return;
        }

        // Troca o turno
        currentTurnTeam = (currentTurnTeam === 'red') ? 'blue' : 'red';
        turnCount++;
        console.log(`New turn started for team: ${currentTurnTeam}`);

        // Notifica todos os jogadores sobre o novo turno usando a função centralizada
        broadcastTurnChange();
    });
});

/**
 * Função centralizada para notificar todos os jogadores sobre a mudança de turno.
 * Esta será a ÚNICA fonte de verdade sobre o estado do turno.
 */
function broadcastTurnChange() {
    console.log(`Broadcasting turn update. Team: ${currentTurnTeam}, Turn: ${turnCount}`);
    io.emit('turn_update', { 
        currentTurnTeam: currentTurnTeam,
        turnCount: turnCount
    });
}

/**
 * Envia o estado atual do lobby para todos os clientes conectados.
 */
function broadcastLobbyState() {
    const state = {
        players: Object.values(lobbyPlayers)
    };
    io.emit('lobby_state_update', state);
}

/**
 * Verifica se todos os jogadores no lobby estão prontos para iniciar o jogo.
 */
function checkAllPlayersReady() {
    const playersInLobby = Object.values(lobbyPlayers);
    // Precisa de pelo menos 2 jogadores para começar
    if (playersInLobby.length < 2 || gameStarted) {
        return;
    }

    const allReady = playersInLobby.every(p => p.isReady);

    if (allReady) {
        console.log('All players are ready! Starting game...');
        initializeGame(); // Prepara os personagens e marca o jogo como iniciado
        // A função initializeGame() já define currentTurnTeam = 'blue'

        // Atribui times aos jogadores do lobby
        let availableTeams = ['blue', 'red'];
        // Ordena os jogadores por ID para garantir uma atribuição determinística
        const sortedPlayers = playersInLobby.sort((a, b) => a.id.localeCompare(b.id));

        sortedPlayers.forEach(player => {
            const team = availableTeams.shift();
            if (team) {
                connectedPlayers[player.id] = { team: team };
                // Envia o estado inicial do jogo para cada jogador
                io.to(player.id).emit('game_start', {
                    characters,
                    yourTeam: team,
                    initialTurn: {
                        currentTurnTeam: currentTurnTeam,
                        turnCount: turnCount
                    }
                });
            }
        });

        // Limpa o lobby
        lobbyPlayers = {};
    }
}


http.listen(PORT, () => {
    console.log(`Server listening on *:${PORT}`);
});
