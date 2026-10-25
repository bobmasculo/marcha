/**
 * @class NpcManager
 * @description Gerencia a criação, posicionamento e lógica dos NPCs no jogo.
 */
export default class NpcManager {
    /**
     * @param {Phaser.Scene} scene A cena Phaser onde os NPCs serão criados.
     */
    constructor(scene) {
        this.scene = scene; 
        this.npcs = null;
        this.activeDrops = {}; // Armazena drops ativos no cliente

        this.spawned = new Map(); // spawnId -> sprite vivo (evita criar o mesmo alien duas vezes)

        this.lastUpdateTime = 0; // Para controlar frequência de atualização da IA
        this.showDebugVision = false; // Flag para ativar/desativar debug visual
        this.debugGraphics = null;
        
        this.logicTick = 0; // Contador para escalonamento de IA

        this.STATES = {
            PATROL: 'PATROL',
            CHASE: 'CHASE',
            ATTACK: 'ATTACK',
            RETREAT: 'RETREAT'
        };
        
        // Função global para debug: Reseta NPCs para a posição inicial
        window.resetNpcs = () => this.resetAllNpcs();
    }

    /**
     * Carrega os assets (spritesheets) dos NPCs.
     * Deve ser chamado dentro do método preload() da GameScene.
     */
    preload() {
        // Carrega dinamicamente todos os spritesheets definidos em NPC_CONFIGS
        for (const type in NPC_CONFIGS) {
            const config = NPC_CONFIGS[type];
            // Evita carregar a mesma textura duas vezes
            if (!this.scene.textures.exists(config.textureKey)) {
                this.scene.load.spritesheet(config.textureKey, config.path, {
                    frameWidth: config.frameWidth,
                    frameHeight: config.frameHeight
                });
            }
        }

        // Imagens dos itens vêm da tabela ITEMS (config.js)
        for (const id in ITEMS) {
            const def = ITEMS[id];
            if (this.scene.textures.exists(def.texture)) continue;
            if (def.sheet) this.scene.load.spritesheet(def.texture, def.path, def.sheet);
            else this.scene.load.image(def.texture, def.path);
        }
    }

    /**
     * Cria os sprites dos NPCs no mundo e configura suas propriedades.
     * Deve ser chamado dentro do método create() da GameScene.
     */
    create() {
        this.npcs = this.scene.physics.add.group();

        // Inicializa o objeto de gráficos para o debug
        this.debugGraphics = this.scene.add.graphics().setDepth(3000);

        // Adiciona listeners para drops
        // Listeners de rede removidos para modo offline

        // Cria animações para cada TIPO de NPC definido em NPC_CONFIGS
        for (const type in NPC_CONFIGS) {
            const config = NPC_CONFIGS[type];
            Object.entries(config.animationFrames).forEach(([direction, framesConfig]) => {
                const animKey = `npc_${type}_${direction}`;
                if (!this.scene.anims.exists(animKey)) {
                    // Normaliza: Se framesConfig for array, envelopa em { frames: ... }
                    const genConfig = Array.isArray(framesConfig) ? { frames: framesConfig } : framesConfig;

                    this.scene.anims.create({
                        key: animKey,
                        frames: this.scene.anims.generateFrameNumbers(config.textureKey, genConfig),
                        frameRate: config.frameRate || 8,
                        repeat: direction === 'morto' ? 0 : -1
                    });
                }
            });
        }

        // Animação da moeda (frames 0 a 7)
        if (!this.scene.anims.exists('coin_spin')) {
            this.scene.anims.create({
                key: 'coin_spin',
                frames: this.scene.anims.generateFrameNumbers('coin', { start: 0, end: 7 }),
                frameRate: 8,
                repeat: -1
            });
        }

        // Os aliens são criados pelos pedaços do mundo (ChunkManager -> spawnFromSpec)
    }

    /**
     * Cria um alien a partir da especificação gerada para o pedaço (world-gen.js).
     * spawnId é estável: o mesmo alien nunca aparece duas vezes e, depois de morto, não volta.
     */
    spawnFromSpec(spec, chunkKey) {
        if (this.spawned.has(spec.spawnId)) return null;

        const npc = this.createSingleNpc({
            id: `rnd_${spec.type}_${spec.spawnId.replace(/,/g, '_')}`,
            type: spec.type,
            x: spec.x,
            y: spec.y,
            waypoints: spec.waypoints
        }, 0);
        if (!npc) return null;

        npc.setData('spawnId', spec.spawnId);
        npc.setData('chunkKey', chunkKey);
        this.spawned.set(spec.spawnId, npc);
        npc.once('destroy', () => this.spawned.delete(spec.spawnId));
        return npc;
    }

    /** Remove o alien do jogo (pedaço descarregado ou corpo que já sumiu). */
    despawnNpc(npc) {
        if (npc.healthBar) npc.healthBar.destroy();
        npc.destroy();
    }

    /**
     * Método auxiliar para instanciar um NPC com todas as configurações padrão.
     */
    createSingleNpc(npcData, index) {
        const config = NPC_CONFIGS[npcData.type];
        if (!config) {
            console.error(`[NpcManager] Tipo não encontrado: ${npcData.type}`);
            return;
        }

        const npcSprite = this.npcs.create(npcData.x, npcData.y, config.textureKey);
            npcSprite.setCollideWorldBounds(true);
            npcSprite.body.setAllowGravity(false); // Garante que a gravidade não afete o NPC
            npcSprite.setData('type', npcData.type);
            
            // Configurações de dados do NPC
            // Garante que o ID comece com 'npc' e seja único para o sistema de tiro funcionar
            let uniqueId = npcData.id;
            if (!uniqueId.startsWith('npc')) {
                uniqueId = `npc_${uniqueId}`;
            }
            uniqueId = `${uniqueId}_${index}`; // Adiciona índice para garantir unicidade
            npcSprite.setData('id', uniqueId);
            npcSprite.id = uniqueId; // Propriedade direta para compatibilidade com GameManager

            npcSprite.setData('waypoints', npcData.waypoints || []);
            npcSprite.setData('currentWaypointIndex', 0);
            npcSprite.setData('speed', npcData.speed || config.speed || GAME_CONFIG.NPC_SPEED);
            
            // Novas propriedades para persistência da perseguição
            npcSprite.setData('targetPlayer', null); // O jogador que ele está atualmente mirando
            npcSprite.setData('lastKnownTargetPos', null); // Última posição conhecida do alvo

            npcSprite.health = config.health || GAME_CONFIG.NPC_MAX_HEALTH; 
            npcSprite.armor = config.armor || GAME_CONFIG.NPC_ARMOR;  
            npcSprite.weaponStrength = config.weaponStrength || GAME_CONFIG.NPC_WEAPON_STRENGTH;

            // --- EFEITOS VISUAIS: COR E BRILHO (APENAS PARA SPAWNS ALEATÓRIOS) ---
            // Os NPCs gerados pelos pedaços do mundo (spawnFromSpec) têm IDs começando com 'rnd_'
            if (npcData.id && npcData.id.startsWith('rnd_')) {
                if (config.tint) {
                    npcSprite.setTint(config.tint);
                }
            }
            // -------------------------------------

            // Barra de Vida Visual para NPC
            npcSprite.healthBar = this.scene.add.graphics().setDepth(101);
            this.drawHealthBar(npcSprite.healthBar, 30, 4, npcSprite.health / (config.health || GAME_CONFIG.NPC_MAX_HEALTH));

            // Aplica a escala se definida
            const finalScale = npcData.scale || config.scale || 1;
            npcSprite.setScale(finalScale);
            
            // Aplica dimensões customizadas de exibição se definidas (sobrescreve escala)
            if (npcData.displayWidth && npcData.displayHeight) {
                npcSprite.setDisplaySize(npcData.displayWidth, npcData.displayHeight);
            } else if (config.width && config.height) {
                npcSprite.setDisplaySize(config.width, config.height);
            }

            // CORREÇÃO CRÍTICA: Hitbox baseada no tamanho original do frame
            const unscaledW = config.frameWidth;
            const unscaledH = config.frameHeight;
            
            // SOLUÇÃO ROBUSTA: Corpo circular na base para NPCs (evita prender em patrulha)
            const radius = Math.floor(unscaledW * 0.2);
            npcSprite.body.setCircle(radius);
            npcSprite.body.setOffset((unscaledW / 2) - radius, unscaledH - (radius * 2)); // Alinha o círculo na base do sprite
            npcSprite.setFriction(0); // Garante que o corpo deslize perfeitamente sem "grudar"
            npcSprite.setBounce(0);
            
            // Inicia com o primeiro frame da animação de olhar para baixo configurada
            const downFrames = config.animationFrames.down;
            const initialFrame = Array.isArray(downFrames) ? downFrames[0] : (downFrames.start || 0);
            npcSprite.setFrame(initialFrame);
            if (this.showDebugVision) console.log(`NPC ${npcData.id} criado em (${npcData.x}, ${npcData.y})`);
            return npcSprite;
    }

    /**
     * Desenha a barra de vida para o NPC.
     */
    drawHealthBar(graphics, width, height, percentage) {
        graphics.clear();
        if (percentage <= 0) return;
        // Fundo
        graphics.fillStyle(0x000000, 0.7);
        graphics.fillRect(-width / 2, -height / 2, width, height);
        // Barra (sempre vermelha para inimigos ou baseada em % como o player)
        const color = percentage > 0.5 ? 0x00ff00 : (percentage > 0.2 ? 0xffff00 : 0xff0000);
        graphics.fillStyle(color, 1);
        graphics.fillRect(-width / 2 + 1, -height / 2 + 1, Math.max(0, (width - 2) * percentage), height - 2);
    }

    /**
     * Para a animação do NPC e define frame de idle.
     * Chamado quando o NPC ataca.
     */
    handleNpcAttack(npcId, targetId, x, y) {
        if (!this.npcs) return;
        const npc = this.npcs.getChildren().find(n => n.getData('id') === npcId);
        if (npc) {
            console.log(`[NpcManager] Parando NPC ${npcId} para ataque.`);
            // Sincroniza a posição exata do servidor (evita desvios visuais entre clientes)
            if (x !== undefined && y !== undefined) {
                npc.body.reset(x, y); // Reset para movimento e física imediatamente
            } else {
                npc.body.reset(npc.x, npc.y);
            }

            // Para o movimento e define flag de ataque
            npc.setData('isAttacking', true);

            npc.anims.stop();
            npc.setFrame(0); // Frame 0 é assumido como idle/parado

            // Efeito visual: Virar para o alvo
            if (targetId && this.scene.gameManager) {
                const type = npc.getData('type');
                const config = NPC_CONFIGS[type];
                const target = this.scene.gameManager.getPlayerById(targetId);
                
                if (target && config) {
                    const dx = target.x - npc.x;
                    const dy = target.y - npc.y;
                    let dirKey = 'down';
                    if (Math.abs(dx) > Math.abs(dy)) {
                        dirKey = dx > 0 ? 'right' : 'left';
                    } else {
                        dirKey = dy > 0 ? 'down' : 'up';
                    }
                    const frames = config.animationFrames[dirKey];
                    const frameToSet = Array.isArray(frames) ? frames[0] : (frames.start || 0);
                    npc.setFrame(frameToSet);
                }
            }

            // FIX: O NPC para de patrulhar permanentemente ao entrar em combate.
            // Adiciona timeout para liberar o NPC após o ataque (1s de animação/cooldown)
            this.scene.time.delayedCall(1000, () => {
                if (npc && npc.active) {
                    npc.setData('isAttacking', false);
                }
            });
        }
    }

    /**
     * Processa o comando de perseguição vindo do servidor.
     */
    handleNpcFollow({ npcId, targetId, x, y, speed }) {
        if (!this.npcs) return;
        const npc = this.npcs.getChildren().find(n => n.getData('id') === npcId);
        
        if (npc && npc.body) {
            // Define estado de perseguição para parar a patrulha
            npc.setData('isChasing', true);
            
            // IMPORTANTE: Destrava o NPC se ele estava "atacando" (parado)
            npc.setData('isAttacking', false);
            
            // Armazena o alvo da perseguição para atualização contínua no update()
            npc.setData('chaseTarget', { x, y });
            npc.setData('chaseSpeed', speed || 60);

            // Move o NPC até o alvo usando a física do Phaser
            this.scene.physics.moveTo(npc, x, y, speed || 60);
        }
    }

    /**
     * Para a perseguição e retoma o estado normal (ou fica parado até próxima ordem).
     */
    handleNpcStopFollow({ npcId }) {
        if (!this.npcs) return;
        const npc = this.npcs.getChildren().find(n => n.getData('id') === npcId);
        
        if (npc && npc.body) {
            npc.setData('isChasing', false);
            npc.body.stop();
            
            // Opcional: Se quiser que ele volte a patrulhar imediatamente, 
            // você precisaria recalcular o caminho para o waypoint mais próximo.
            // Por enquanto, ele vai parar e o update() vai retomar a patrulha 
            // se houver waypoints definidos.
        }
    }

    /**
     * Lida com o respawn do NPC vindo do servidor.
     */
    handleNpcRespawn(data) {
        if (!this.npcs) return;
        const npc = this.npcs.getChildren().find(n => n.getData('id') === data.id);
        if (npc) {
            npc.setActive(true).setVisible(true);
            if (npc.body) npc.body.enable = true;
            npc.setPosition(data.x, data.y);
            npc.health = data.health;
            
            // Redesenha a barra no respawn
            const config = NPC_CONFIGS[npc.getData('type')];
            this.drawHealthBar(npc.healthBar, 30, 4, npc.health / (config.health || GAME_CONFIG.NPC_MAX_HEALTH));

            // Reset flags
            npc.setData('isChasing', false);
            npc.setData('isAttacking', false);
            npc.setData('currentWaypointIndex', 0); // Reinicia patrulha
            
            console.log(`[NpcManager] NPC ${data.id} respawned.`);
        }
    }

    update() {
        if (!this.npcs) return;

        this.logicTick++;
        const now = this.scene.time.now;
        const players = this.scene.gameManager ? this.scene.gameManager.players.getChildren() : [];
        const npcChildren = this.npcs.getChildren();

        // Limpa debug apenas se necessário
        if (this.debugGraphics) this.debugGraphics.clear();

        // 1. Escalonamento de Lógica (Time Slicing): 
        // Atualiza a percepção pesada de apenas uma parte dos NPCs por frame.
        const batchSize = Math.ceil(npcChildren.length / 5);
        const startIndex = (this.logicTick % 5) * batchSize;
        const endIndex = startIndex + batchSize;

        npcChildren.forEach((npc, index) => {
            if (!npc.active) return;

            // Se o NPC está morto, apenas escondemos a barra e pulamos a lógica
            if (npc.health <= 0) {
                if (npc.healthBar) npc.healthBar.setVisible(false);
                return;
            }

            if (npc.healthBar) {
                npc.healthBar.setPosition(npc.x, npc.y - 65);
                npc.healthBar.setDepth(npc.depth + 1);
                // Sincroniza visibilidade com o sprite (importante para Fog of War)
                npc.healthBar.setVisible(npc.visible);
            }

            // 2. Percepção e IA (Escalonado): Só roda para o lote atual
            if (index >= startIndex && index < endIndex) {
                this.updateNpcPerception(npc, players);
            }

            // 3. Execução de Movimento (Todo frame): Mantém a física suave
            this.executeNpcMovement(npc);

            // 4. Animações (Todo frame)
            this.updateNpcAnimations(npc);

            // Sincroniza a profundidade visual pelo eixo Y para o efeito de sobreposição
            npc.setDepth(npc.y);

            // SOLUÇÃO ROBUSTA: Anti-clipping para NPCs
            if (npc.active && npc.body) {
                this.scene.physics.overlap(npc, [this.scene.meuCenario.obstaclesGroup, this.scene.meuCenario.animatedGroup], (n, obs) => {
                    const angle = Phaser.Math.Angle.Between(obs.x, obs.y, n.x, n.y);
                    const ejectionForce = 3;
                    n.x += Math.cos(angle) * ejectionForce;
                    n.y += Math.sin(angle) * ejectionForce;
                    n.body.reset(n.x, n.y);
                });
            }
        });

        // 5. Coleta de Itens (Otimizado): Roda apenas a cada 10 frames
        if (this.logicTick % 10 === 0) {
            this.updateDropCollection(players);
        }
    }

    /**
     * Lógica pesada de detecção de alvos e linha de visão.
     */
    updateNpcPerception(npc, players) {
        if (!npc.active || npc.health <= 0) {
            // Se o NPC está inativo ou morto, ele não deve ter um alvo ativo.
            npc.setData('targetPlayer', null);
            npc.setData('isEngaged', false);
            npc.setData('isChasing', false);
            return false;
        }

        const VISION_RANGE = GAME_CONFIG.NPC_VISION_RANGE;
        const ATTACK_RANGE = GAME_CONFIG.NPC_ATTACK_RANGE;
        const SPY_MULT = GAME_CONFIG.SPY_AGGRO_MULTIPLIER;
        const now = this.scene.time.now;

        // --- RECUO: com pouca vida o NPC larga o alvo e volta a patrulhar por um tempo ---
        const maxHealth = (NPC_CONFIGS[npc.getData('type')] || {}).health || GAME_CONFIG.NPC_MAX_HEALTH;
        if (!npc.getData('hasRetreated') && npc.health / maxHealth <= GAME_CONFIG.NPC_RETREAT_THRESHOLD) {
            npc.setData('hasRetreated', true);
            npc.setData('retreatUntil', now + GAME_CONFIG.NPC_RETREAT_COOLDOWN_MS);
        }
        if ((npc.getData('retreatUntil') || 0) > now) {
            npc.setData('targetPlayer', null);
            npc.setData('isEngaged', false);
            npc.setData('isChasing', false);
            npc.setData('lastKnownTargetPos', null);
            return false;
        }
        
        let currentTarget = npc.getData('targetPlayer'); // O alvo que o NPC está perseguindo/atacando
        let nearestPlayerInVision = null; // O jogador mais próximo atualmente visível
        let minDistToNearestPlayer = Infinity;

        // OTIMIZAÇÃO: Busca espacial via QuadTree
        const nearbyEntities = this.scene.meuCenario.getEntitiesInRange(npc.x, npc.y, VISION_RANGE * SPY_MULT);
        
        for (let i = 0; i < nearbyEntities.length; i++) {
            const entity = nearbyEntities[i];
            // Verifica se a entidade é um player (tem ID e não começa com 'npc')
            const entId = entity.id || (entity.getData && entity.getData('id'));
            const isPlayer = entId && !entId.startsWith('npc') && entity.team !== 'npc';
            
            if (isPlayer && entity.active && entity.health > 0 && entity.team !== 'npc') {
                const d = Phaser.Math.Distance.Between(npc.x, npc.y, entity.x, entity.y);
                // O espião é isca: chama atenção de mais longe e tem prioridade como alvo
                const isSpy = entity.playerType === 'espiao';
                const range = isSpy ? VISION_RANGE * SPY_MULT : VISION_RANGE;
                const effectiveDist = isSpy ? d / SPY_MULT : d;
                if (d <= range && effectiveDist < minDistToNearestPlayer) {
                    minDistToNearestPlayer = effectiveDist;
                    nearestPlayerInVision = entity;
                }
            }
        }

        // --- Lógica para determinar o alvo atual do NPC ---
        // 1. Se o NPC já tem um alvo, verifica se ele ainda está vivo e é válido.
        if (currentTarget) {
            const actualTargetPlayer = this.scene.gameManager.getPlayerById(currentTarget.id);
            if (!actualTargetPlayer || actualTargetPlayer.health <= 0) {
                // O alvo atual morreu ou não existe mais, limpa o alvo.
                npc.setData('targetPlayer', null);
                npc.setData('isEngaged', false);
                npc.setData('isChasing', false);
                if (this.showDebugVision) console.log(`[NPC STATE] ${npc.getData('id')} alvo ${currentTarget.id} morto. Desengajando.`);
                currentTarget = null;
            } else {
                // O alvo atual está vivo, atualiza sua posição no objeto de referência.
                currentTarget.x = actualTargetPlayer.x;
                currentTarget.y = actualTargetPlayer.y;

                // Desiste se o alvo fugiu para longe demais
                if (Phaser.Math.Distance.Between(npc.x, npc.y, currentTarget.x, currentTarget.y) > GAME_CONFIG.NPC_LEASH_RANGE) {
                    npc.setData('targetPlayer', null);
                    npc.setData('isEngaged', false);
                    npc.setData('isChasing', false);
                    currentTarget = null;
                }
            }
        }

        // 2. Se um novo jogador é visto, ele pode se tornar o alvo.
        if (nearestPlayerInVision) {
            // Se não há alvo, ou o novo jogador visível é mais próximo, ou perdemos LoS para o alvo antigo e agora vemos um novo.
            if (!currentTarget || minDistToNearestPlayer < Phaser.Math.Distance.Between(npc.x, npc.y, currentTarget.x, currentTarget.y)) {
                 npc.setData('targetPlayer', { id: nearestPlayerInVision.id, x: nearestPlayerInVision.x, y: nearestPlayerInVision.y });
                 npc.setData('lastKnownTargetPos', { x: nearestPlayerInVision.x, y: nearestPlayerInVision.y });
                 npc.setData('isEngaged', true); // Engaja com o novo alvo
                 if (this.showDebugVision) console.log(`[NPC STATE] ${npc.getData('id')} novo alvo: ${nearestPlayerInVision.id}`);
                 currentTarget = npc.getData('targetPlayer'); // Atualiza a referência
            }
        }

        // --- Processa o comportamento do NPC com base no currentTarget ---
        if (currentTarget && npc.getData('isEngaged')) { // Se o NPC tem um alvo e está engajado
            const hasLoS = this.scene.meuCenario.checkLineOfSight(npc.x, npc.y, currentTarget.x, currentTarget.y);
            const distToTarget = Phaser.Math.Distance.Between(npc.x, npc.y, currentTarget.x, currentTarget.y);
            npc.setData('distToTarget', distToTarget);
            npc.setData('hasLoS', hasLoS);

            // ATUALIZAÇÃO CRÍTICA: Sempre atualiza a posição do alvo para que a perseguição seja precisa
            npc.setData('chaseTarget', { x: currentTarget.x, y: currentTarget.y });

            // DEBUG VISUAL MELHORADO
            // Log de visão com throttling para não inundar o console
            const lastVisionLog = npc.getData('lastVisionLog') || 0; // Pega o último timestamp do log de visão
            // Loga apenas se o debug estiver ativo E se passaram 2 segundos desde o último log de visão
            if (this.showDebugVision && (this.scene.time.now - lastVisionLog > 2000)) { 
                // Atualiza o timestamp do último log de visão
                npc.setData('lastVisionLog', this.scene.time.now);
                console.log(`[NPC VISION] ${npc.getData('id')} vê ${currentTarget.id}? ${hasLoS} | Dist: ${distToTarget.toFixed(0)} | Est: ${npc.getData('isChasing') ? 'Correndo' : 'Engajado'}`);
                
                // Círculo de visão mais visível (Branco suave)
                this.debugGraphics.lineStyle(2, 0xffffff, 0.4);
                this.debugGraphics.strokeCircle(npc.x, npc.y, VISION_RANGE);

                // Linha de Visão (LoS): VERDE se OK, VERMELHO se BLOQUEADO
                const losColor = hasLoS ? 0x00ff00 : 0xff0000; // Verde se tem LoS, Vermelho se não
                this.debugGraphics.lineStyle(4, losColor, 0.8); // Linha grossa (4px) e bem visível (0.8 alpha)
                this.debugGraphics.lineBetween(npc.x, npc.y, currentTarget.x, currentTarget.y);
            }

            // Atualiza a última posição conhecida se tiver LoS
            if (hasLoS) {
                npc.setData('lastKnownTargetPos', { x: currentTarget.x, y: currentTarget.y });
            }

            if (distToTarget <= ATTACK_RANGE && hasLoS) {
                // Lógica de ataque
                const targetSprite = this.scene.gameManager.getPlayerById(currentTarget.id);
                if (targetSprite && targetSprite.health > 0) {
                    const now = this.scene.time.now;
                    const lastAttack = npc.getData('lastAttackTime') || 0;
                    
                    // Ataca baseado apenas no Cooldown (RTS)
                    if (now - lastAttack > GAME_CONFIG.NPC_ATTACK_COOLDOWN) {
                        npc.setData('lastAttackTime', now);
                        
                        // Efeito visual de tiro (Ranged)
                        this.scene.gameManager.executeRemoteShoot(npc, targetSprite.x, targetSprite.y);
                        
                        // Dano do config, reduzido pela armadura do alvo
                        const gm = this.scene.gameManager;
                        const damage = gm.applyArmor(GAME_CONFIG.NPC_DAMAGE, targetSprite.armor);
                        gm.updateCharacterHealth(currentTarget.id, targetSprite.health - damage, npc);
                        this.handleNpcAttack(npc.getData('id'), currentTarget.id);
                    }
                }
                // COMPORTAMENTO RANGED: Se está no alcance e tem visão, PARA de andar para atirar
                npc.setData('isChasing', false);
            } else {
                // Lógica de perseguição normal
                const wasChasing = npc.getData('isChasing');
                npc.setData('isChasing', true);
                    
                    // Loga apenas se o debug estiver ativo E o NPC não estava perseguindo antes
                    if (this.showDebugVision && !wasChasing) {
                        if (hasLoS) console.log(`[NPC CHASE] ${npc.getData('id')} perseguindo ${currentTarget.id}`);
                        else console.log(`[NPC CHASE] ${npc.getData('id')} perdeu LoS, perseguindo última posição conhecida de ${currentTarget.id}`);
                    }
            }
        } else { // Não há alvo válido ou o NPC não está engajado
            npc.setData('isEngaged', false);
            npc.setData('isChasing', false);
            npc.setData('targetPlayer', null);
            npc.setData('lastKnownTargetPos', null);
        }
    }

    /**
     * Executa o deslocamento físico baseado no estado da IA.
     */
    executeNpcMovement(npc) {
        if (npc.getData('isAttacking')) {
            if (npc.body) npc.body.stop();
            return;
        }

        const isEngaged = npc.getData('isEngaged');
        const isChasing = npc.getData('isChasing');

        // Reset stuck frames if not engaged or not chasing
        if (!isEngaged || !isChasing) {
            npc.setData('stuckFrames', 0);
        }

        if (isEngaged && isChasing) {
            const now = this.scene.time.now;
            const lastPathCalc = npc.getData('lastPathCalc') || 0;
            const chaseTarget = npc.getData('chaseTarget');
            
            if (!chaseTarget) return;

            // --- Detecção de travamento para NPCs ---
            // Se o NPC está tentando se mover mas a velocidade real é quase zero
            // e ele não está muito perto do alvo, pode estar preso em um canto.
            if ((npc.body.speed < 10 || !npc.body.blocked.none) && Phaser.Math.Distance.Between(npc.x, npc.y, chaseTarget.x, chaseTarget.y) > 15) {
                let stuckFrames = npc.getData('stuckFrames') || 0;
                stuckFrames++;
                npc.setData('stuckFrames', stuckFrames);
                if (stuckFrames > 25) { // Se ficou "parado" por aprox. 0.4s
                    // SOLUÇÃO: Teleporte para desvencilhar do obstáculo
                    if (npc.path && npc.path[npc.currentPathIndex]) {
                        const nextPoint = npc.path[npc.currentPathIndex];
                        if (this.showDebugVision) console.warn(`[NPC STUCK] ${npc.getData('id')} unstucking via teleport.`);
                        
                        // Efeito visual no local antigo e no novo
                        if (this.scene.shotManager) this.scene.shotManager.createTeleportEffect(npc.x, npc.y);
                        if (this.scene.shotManager) this.scene.shotManager.createTeleportEffect(nextPoint.x, nextPoint.y);

                        npc.setPosition(nextPoint.x, nextPoint.y);
                        if (npc.body) npc.body.reset(nextPoint.x, nextPoint.y);
                        npc.setData('stuckFrames', 0);
                    }
                    return;
                }
            } else {
                npc.setData('stuckFrames', 0);
            }

            const dist = Phaser.Math.Distance.Between(npc.x, npc.y, chaseTarget.x, chaseTarget.y);
            const hasLoS = this.scene.meuCenario.checkLineOfSight(npc.x, npc.y, chaseTarget.x, chaseTarget.y);

            // AJUSTE: MOVIMENTO DIRETO (Bypass Pathfinding)
            // Só permite movimento direto se estiver MUITO perto (120px) e com visão limpa.
            // Isso evita que NPCs tentem "raspar" em quinas de paredes distantes.
            if (hasLoS && dist < 120) {
                const speed = npc.getData('speed');
                const angle = Phaser.Math.Angle.Between(npc.x, npc.y, chaseTarget.x, chaseTarget.y);
                
                const sep = this.calculateSeparation(npc);
                npc.body.setVelocity(
                    Math.cos(angle) * speed + (sep.x * 0.5),
                    Math.sin(angle) * speed + sep.y
                );
                npc.path = null; // Limpa rotas antigas
                return;
            }

            if (now - lastPathCalc > 1000) {
                npc.setData('lastPathCalc', now);
                if (this.showDebugVision) {
                    console.log(`[NPC PATH] ${npc.getData('id')} recalculando caminho para (${chaseTarget.x.toFixed(0)}, ${chaseTarget.y.toFixed(0)})`);
                }

                this.scene.pathManager.findPath(npc.x, npc.y, chaseTarget.x, chaseTarget.y, (path) => {
                    if (path) {
                        npc.path = path;
                        npc.currentPathIndex = 1;
                    } else {
                        // NOVO: Loga se o pathfinding falhou
                        if (this.showDebugVision) console.warn(`[NPC PATH] ${npc.getData('id')} falhou ao encontrar caminho para (${chaseTarget.x.toFixed(0)}, ${chaseTarget.y.toFixed(0)})`);
                    }
                });
            }
        } else if (!isEngaged) {
            npc.path = null;
            this.updatePatrol(npc);
        }

        // TRAVA DE DISPARO: Se o Alien está no alcance de tiro (isEngaged) mas parou de correr (isChasing = false),
        // garante que a velocidade seja zero para ele ficar parado enquanto atira.
        if (isEngaged && !isChasing) {
            npc.body.setVelocity(0, 0);
            return;
        }

        if (npc.path && npc.currentPathIndex < npc.path.length) {
            const target = npc.path[npc.currentPathIndex];
            const speed = npc.getData('speed');
            
            const sep = this.calculateSeparation(npc);

            // Aplicamos a velocidade de movimento + a força de separação
            const angle = Phaser.Math.Angle.Between(npc.x, npc.y, target.x, target.y);
            
            let vx = Math.cos(angle) * speed + (sep.x * 0.5);
            let vy = Math.sin(angle) * speed + (sep.y * 0.5);

            npc.body.setVelocity(vx, vy);

            const distToNode = Phaser.Math.Distance.Between(npc.x, npc.y, target.x, target.y);

            // Tolerância maior para NPCs (15px) para evitar travamentos em patrulha/perseguição
            const nodeTolerance = (npc.currentPathIndex === npc.path.length - 1) ? 8 : 18;
            if (distToNode < nodeTolerance) {
                npc.currentPathIndex++;
            }
        } else {
            // Se não tem path e não está patrulhando, para a física
            if (!isEngaged && (!npc.getData('waypoints') || npc.getData('waypoints').length === 0)) {
                npc.body.setVelocity(0, 0);
            }
        }
    }

    /**
     * Auxiliar para calcular força de separação entre NPCs.
     */
    calculateSeparation(npc) {
        let sepX = 0;
        let sepY = 0;
        const separationRadius = 50;

        // OTIMIZAÇÃO CRÍTICA: Em vez de iterar por TODOS os NPCs do jogo (O(N^2)),
        // usamos a QuadTree para buscar apenas os vizinhos imediatos.
        const nearby = this.scene.meuCenario.getEntitiesInRange(npc.x, npc.y, separationRadius);

        for (let i = 0; i < nearby.length; i++) {
            const other = nearby[i];
            if (other === npc || !other.active || other.team === 'player') continue;

            const dist = Phaser.Math.Distance.Between(npc.x, npc.y, other.x, other.y);
            if (dist < separationRadius && dist > 0) {
                const force = 0.2;
                sepX += (npc.x - other.x) * force;
                sepY += (npc.y - other.y) * force;
            }
        }
        return { x: sepX, y: sepY };
    }

    /**
     * Atualiza as animações baseada no vetor de velocidade.
     */
    updateNpcAnimations(npc) {
        const v = npc.body.velocity;
        const type = npc.getData('type');
        const config = NPC_CONFIGS[type];
        if (!config) return;

        if (v.length() < 4) {
            // Se parado, para no primeiro frame da direção atual
            if (npc.anims.isPlaying) npc.anims.stop();
        } else if (Math.abs(v.x) > Math.abs(v.y)) {
            const dir = v.x > 0 ? 'right' : 'left';
            npc.play(`npc_${type}_${dir}`, true);
        } else {
            const dir = v.y > 0 ? 'down' : 'up';
            npc.play(`npc_${type}_${dir}`, true);
        }
    }

    /**
     * Lógica de coleta de drops (rodada com frequência reduzida).
     */
    updateDropCollection(players) {
        const gm = this.scene.gameManager;
        Object.values(this.activeDrops).forEach(drop => {
            const picker = players.find(p =>
                p.active && p.health > 0 && Phaser.Math.Distance.Between(p.x, p.y, drop.x, drop.y) < 60
            );
            if (!picker) return;
            if (gm.canPickUp(drop.itemId)) {
                this.handleItemPickedUp({ dropId: drop.id, pickerId: picker.id, itemId: drop.itemId });
            } else if (this.scene.time.now - (drop.lastFullMessage || 0) > 3000) {
                // Inventário cheio: o item continua no chão, com aviso
                drop.lastFullMessage = this.scene.time.now;
                gm.showMessage('Inventário cheio!');
            }
        });
    }

    updatePatrol(npc) {
        const waypoints = npc.getData('waypoints');
        if (!waypoints || waypoints.length === 0) return;

        const index = npc.getData('currentWaypointIndex');
        const target = waypoints[index];
        
        if (!target) return;

        const speed = npc.getData('speed');
        const distance = Phaser.Math.Distance.Between(npc.x, npc.y, target.x, target.y);

        // Se o NPC estiver bloqueado em alguma direção, pula para o próximo waypoint para tentar destravar
        if (npc.body.blocked.left || npc.body.blocked.right || npc.body.blocked.up || npc.body.blocked.down) {
            npc.setData('currentWaypointIndex', (index + 1) % waypoints.length);
            return;
        }

        // Tolerância de chegada ao ponto (10px)
        if (distance < 10) {
            // CORREÇÃO: Removemos o npc.body.reset() que causava o efeito de "teleporte/respawn" visual.
            // Agora o NPC apenas muda o alvo para o próximo waypoint circularmente e continua andando.
            npc.setData('currentWaypointIndex', (index + 1) % waypoints.length);
        } else {
            this.scene.physics.moveTo(npc, target.x, target.y, speed);
        }
    }

    /**
     * Reseta todos os NPCs para o primeiro waypoint da lista.
     */
    resetAllNpcs() {
        if (!this.npcs) return;
        console.log("Forçando reset dos NPCs...");
        this.npcs.children.iterate((npc) => {
            const waypoints = npc.getData('waypoints');
            if (waypoints && waypoints.length > 0) {
                const start = waypoints[0];
                npc.setData('isAttacking', false); // Garante que volte a andar se resetado
                npc.body.reset(start.x, start.y);
                npc.setData('currentWaypointIndex', 1);
            }
        });
    }

    /**
     * Cria o item no chão a partir da tabela ITEMS. Some sozinho depois de DROP_LIFETIME_MS,
     * piscando nos últimos DROP_WARNING_MS.
     */
    handleItemDropped(drop) {
        const def = ITEMS[drop.itemId];
        if (!def) {
            console.error(`[NpcManager] Item desconhecido: ${drop.itemId}`);
            return;
        }

        const dropSprite = this.scene.physics.add.sprite(drop.x, drop.y, def.texture);
        dropSprite.setScale(def.scale);
        dropSprite.setDepth(2000); // Profundidade alta para aparecer acima de tudo
        if (def.anim) dropSprite.play(def.anim);

        const lifetime = GAME_CONFIG.DROP_LIFETIME_MS;
        const warning = GAME_CONFIG.DROP_WARNING_MS;
        const blink = this.scene.time.delayedCall(lifetime - warning, () => {
            if (!dropSprite.active) return;
            this.scene.tweens.add({ targets: dropSprite, alpha: 0.2, duration: 250, yoyo: true, repeat: -1 });
        });
        const expire = this.scene.time.delayedCall(lifetime, () => this.removeDrop(drop.id));

        this.activeDrops[drop.id] = { ...drop, sprite: dropSprite, timers: [blink, expire] };
    }

    /** Remove o item do chão (pego ou expirado), cancelando timers e tweens de aviso. */
    removeDrop(dropId) {
        const drop = this.activeDrops[dropId];
        if (!drop) return;
        drop.timers.forEach(t => t.remove(false));
        this.scene.tweens.killTweensOf(drop.sprite);
        drop.sprite.destroy();
        delete this.activeDrops[dropId];
    }

    /**
     * Lida com o evento de item recolhido
     */
    handleItemPickedUp(data) {
        console.log(`[NpcManager] Recebido item_picked_up para ${data.dropId}, picker: ${data.pickerId}`);
        const dropId = data.dropId;
        this.removeDrop(dropId);

        // Adiciona ao inventário do jogador via GameManager
        if (this.scene.gameManager && data.itemId) {
            this.scene.gameManager.handleItemPickup(data.pickerId, data.itemId);
        }
    }
}