// animation-manager.js
export default class AnimationManager {
    constructor(scene) {
        this.scene = scene;
        this.createdAnimationTypes = new Set(); // Guarda os tipos que já tiveram animações criadas (ex: 'type1')
        this.playerStates = new Map(); // Guarda o estado (animação, direção) de cada jogador individualmente
    }

    /**
     * Cria animações para um TIPO de jogador, se ainda não foram criadas.
     * @param {Phaser.Physics.Arcade.Sprite} player - A instância do jogador. Precisa ter a propriedade `player.playerType`.
     */
    createPlayerAnimations(player) {
        const playerType = player.playerType;

        // Se as animações para este TIPO já foram criadas, não faz nada.
        if (this.createdAnimationTypes.has(playerType)) {
            return;
        }

        const config = PLAYER_CONFIGS[playerType];
        if (!config) {
            console.error(`Configuração não encontrada para playerType: ${playerType}`);
            return;
        }
        
        console.log(`Criando animações para o tipo: ${playerType}`);

        // Itera sobre as animações definidas na configuração (down, left, right, up, idle)
        Object.entries(config.animationFrames).forEach(([direction, frames]) => {
            if (frames.length === 0) return;
            
            const isShoot = direction.startsWith('shoot_');
            const isIdle = direction === 'idle';

            // A chave da animação é baseada no TIPO, não no ID do jogador. Ex: 'type1_down'
            const animKey = `${playerType}_${direction}`;

            if (!this.scene.anims.exists(animKey)) {
                this.scene.anims.create({
                    key: animKey,
                    frames: this.scene.anims.generateFrameNumbers(config.textureKey, { frames }),
                    frameRate: config.frameRate,
                    repeat: isShoot ? 0 : -1, // Tiro não repete, walk/idle sim
                    yoyo: !isShoot && !isIdle // Walk usa yoyo se desejado, tiro não
                });
            }
        });

        // Marca este tipo como "processado"
        this.createdAnimationTypes.add(playerType);
    }

    updateAnimation(player, velocityX, velocityY) {
        const playerId = player.id;
        const playerType = player.playerType;

        // Garante que o jogador tenha um estado inicial
        if (!this.playerStates.has(playerId)) {
            this.playerStates.set(playerId, { 
                currentAnim: null, 
                lastDirection: GAME_CONFIG.DIRECTION.DOWN,
                lastMoveTime: this.scene.time.now,
                isShooting: false
            });
        }
        const state = this.playerStates.get(playerId);
        const now = this.scene.time.now;
        let direction = GAME_CONFIG.DIRECTION.IDLE;

        const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

        if (speed > 2) {
            const absX = Math.abs(velocityX);
            const absY = Math.abs(velocityY);

            if (absX > absY) {
                direction = velocityX > 0 ? GAME_CONFIG.DIRECTION.RIGHT : GAME_CONFIG.DIRECTION.LEFT;
            } else {
                direction = velocityY > 0 ? GAME_CONFIG.DIRECTION.DOWN : GAME_CONFIG.DIRECTION.UP;
            }
        }

        // Lógica de inatividade e estado de disparo
        if (speed > 2) {
            state.lastMoveTime = now;
            state.isShooting = false; // Mover cancela a pose de tiro
        } else {
            // Se está em pose de tiro e não deu o tempo de 10s, mantém o último frame
            if (state.isShooting && (now - state.lastMoveTime < GAME_CONFIG.IDLE_TIMEOUT_MS)) {
                return;
            }

            if (now - state.lastMoveTime > (GAME_CONFIG.IDLE_TIMEOUT_MS || 10000)) {
                state.isShooting = false;
                direction = GAME_CONFIG.DIRECTION.IDLE;
            } else {
                if (!state.isShooting && player.anims.isPlaying) {
                    player.anims.stop(); // Para a animação no frame atual
                }
                return;
            }
        }

        const newAnimKey = `${playerType}_${direction}`;

        if (state.currentAnim !== newAnimKey) {
            player.anims.play(newAnimKey, true);
            state.currentAnim = newAnimKey;
            if (direction !== GAME_CONFIG.DIRECTION.IDLE) {
                state.lastDirection = direction;
            }
        }
    }

    stopPlayerAnimation(playerId) {
        const player = window.gameManager?.getPlayerById(playerId);
        if (player && player.anims) {
            player.anims.stop();
        }
    }

    /**
     * Toca a animação de tiro e mantém o último quadro.
     */
    playShootAnimation(player, direction) {
        const playerType = player.playerType;
        const animKey = `${playerType}_shoot_${direction}`;
        const state = this.playerStates.get(player.id);

        if (this.scene.anims.exists(animKey)) {
            player.anims.play(animKey, true);
            if (state) {
                state.currentAnim = animKey;
                state.isShooting = true;
                state.lastMoveTime = this.scene.time.now; // Reseta o timer de Idle ao atirar
            }
        } else {
            // Fallback para frame estático se a animação não existir
            this.setAimFrame(player, direction);
        }
    }

    /**
     * Define um frame estático de mira (direção do tiro).
     */
    setAimFrame(player, direction) {
        const playerType = player.playerType;
        const config = PLAYER_CONFIGS[playerType];
        if (!config) return;

        const state = this.playerStates.get(player.id);
        if (state) {
            state.isShooting = true;
            state.lastMoveTime = this.scene.time.now;
            state.lastDirection = direction;
        }

        // Tenta encontrar o frame de tiro, senão usa o de caminhada
        const frames = config.animationFrames[`shoot_${direction}`] || config.animationFrames[direction];
        if (frames && frames.length > 0) {
            player.anims.stop();
            player.setFrame(frames[frames.length - 1]); // Pega o último frame
        }
    }
}