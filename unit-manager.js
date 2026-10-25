// unit-manager.js
// Unidades: criação, seleção, formação, movimento e atualização por frame.
// Métodos mesclados no prototype do GameManager (ver game-manager.js).
export const UnitMethods = {
    // Player management
    createPlayer(x, y, playerType, id, name) {
        // Pega a configuração específica para este tipo de jogador
        const config = PLAYER_CONFIGS[playerType];
        if (!config) {
            console.error(`[GameManager] Configuração não encontrada para playerType: ${playerType}`);
            return null;
        }

        // Cria o sprite usando a 'textureKey' da configuração (ex: 'player1')
        const player = this.scene.physics.add.sprite(x, y, config.textureKey)
            .setOrigin(0.5, 1)
            .setCollideWorldBounds(true);

        // Prioriza largura e altura exatas se definidas em PLAYER_CONFIGS
        if (config.width && config.height) {
            player.setDisplaySize(config.width, config.height);
        } else if (config.scale) {
            player.setScale(config.scale);
        }

        // CORREÇÃO CRÍTICA: setSize usa valores NÃO ESCALADOS.
        // Reduzimos a hitbox para focar nos pés (30% da altura), permitindo deslizar em quinas.
        const unscaledWidth = config.frameWidth;
        const unscaledHeight = config.frameHeight;
        
        // SOLUÇÃO ROBUSTA: Usa um corpo CIRCULAR apenas na base (pés).
        // Círculos deslizam em quinas sem prender e não sofrem com erros de precisão retangular.
        const radius = Math.floor(unscaledWidth * 0.2); // Raio de 20% da largura do frame
        player.body.setCircle(radius);
        // Alinha o círculo exatamente no centro inferior do sprite
        const offsetX = (unscaledWidth / 2) - radius;
        const offsetY = unscaledHeight - (radius * 2); // Alinha o círculo na base do sprite
        player.body.setOffset(offsetX, offsetY);
        player.setBounce(0);
        player.setFriction(0); // Garante que o corpo deslize perfeitamente sem "grudar"

        player.id = id; // O ID agora é o socket.id do servidor
        player.name = name || id; // <--- Agora usa o nome vindo do config.js
        player.playerType = playerType; // ESSENCIAL para que outros sistemas saibam qual config usar
        player.team = 'player';
        player.maxHealth = GAME_CONFIG.MAX_HEALTH + this.getUpgradeBonus('health');
        player.health = player.maxHealth;
        player.visionRange = config.visionRange || 600;
        player.weapon = config.weapon || 'pistol'; // Atribui arma padrão da config
        player.hasKillBonus = false;
        player.inventory = []; // Slots { id, count }; só o do comandante é usado
        player.coins = 0;

        player.setDepth(y);

        const idleFrame = config.animationFrames.idle[0];
        player.setFrame(idleFrame);

        // Barra de Vida Visual
        player.healthBar = this.scene.add.graphics().setDepth(player.depth + 1);
        this.drawHealthBar(player.healthBar, 40, 6, player.health / player.maxHealth);

        player.setInteractive({ useHandCursor: true });
        player.on('pointerdown', () => {
            if (this.actionMode === 'shoot') return;
            // Apenas o comandante pode ser selecionado manualmente
            if (player === this.commander) this.selectPlayer(player);
        });

        this.animationManager.createPlayerAnimations(player);
        return player;
    },

    /**
     * Desenha a barra de vida em um objeto Graphics.
     */
    drawHealthBar(graphics, width, height, percentage) {
        graphics.clear();
        if (percentage <= 0) return;
        // Fundo (Preto)
        graphics.fillStyle(0x000000, 0.7);
        graphics.fillRect(-width / 2, -height / 2, width, height);
        // Barra (Verde/Amarelo/Vermelho)
        const color = percentage > 0.5 ? 0x00ff00 : (percentage > 0.2 ? 0xffff00 : 0xff0000);
        graphics.fillStyle(color, 1);
        graphics.fillRect(-width / 2 + 1, -height / 2 + 1, Math.max(0, (width - 2) * percentage), height - 2);
    },

    // --- MODO OFFLINE: SETUP E LÓGICA ---
    setupOfflineGame(missionNumber = 1) {
        console.log('[GameManager] Configurando jogo OFFLINE...');
        this.currentMissionNumber = Number(missionNumber);

        // Cria o LÍDER (Único Player)
        const cfg = PLAYER_SETUP;
        const start = this.scene.world.start; // centro do mundo
        this.commander = this.createPlayer(start.x, start.y, cfg.type, 'player_leader', cfg.name);
        this.players.add(this.commander);
        
        this.commander.coins = this.mission.startCoins;

        const stats = PLAYER_CONFIGS[cfg.type];
        this.commander.armor = stats.armor || GAME_CONFIG.ARMOR;
        this.commander.weaponStrength = stats.weaponStrength || GAME_CONFIG.WEAPON_STRENGTH;
        this.commander.weapon = stats.weapon || 'pistol';

        // Centraliza a câmera no player
        this.scene.cameras.main.centerOn(this.commander.x, this.commander.y);

        // SELECIONA O COMANDANTE AUTOMATICAMENTE NO INÍCIO
        this.selectPlayer(this.commander);

        // Inicializa visuais e mostra o aviso de missão
        this.updateUI();
        this.updateObjectiveUI();
    },

    /**
     * Calcula o custo dinâmico: Initial * 2 ^ (unidades vivas desse tipo)
     */
    getUnitCost(type) {
        const initialCost = GAME_CONFIG.UNIT_COSTS[type] || 10;
        const count = this.players.getChildren().filter(p => p && p.active && p.health > 0 && p.playerType === type).length;
        return initialCost * Math.pow(2, count);
    },


    spawnUnit(type) {
        const cost = this.getUnitCost(type);
        if (!this.commander || this.commander.coins < cost) {
            this.showMessage(`Need ${cost} coins to spawn ${type}!`);
            return;
        }

        this.commander.coins -= cost;

        // Descobre quantos seguidores já existem para atribuir o próximo slot na formação
        const followerCount = this.players.getChildren().filter(p => p.isFollower).length;

        // Spawn perto do comandante
        const spawnX = this.commander.x + Phaser.Math.Between(-60, 60);
        const spawnY = this.commander.y + Phaser.Math.Between(-60, 60);
        const id = `${type}_${Date.now()}`;
        const unit = this.createPlayer(spawnX, spawnY, type, id, type.charAt(0).toUpperCase() + type.slice(1));
        this.players.add(unit);
        
        // Configura para seguir o comandante
        unit.isFollower = true;
        unit.formationSlotIndex = followerCount; // Define o lugar dele no triângulo
        this.updateUI(); // Atualiza a UI DEPOIS de adicionar ao grupo para o custo subir corretamente
        this.showMessage(`${type.toUpperCase()} deployed!`);
    },


    restartGame(characters) {
        // 1. Limpa todos os jogadores e seus elementos de UI
        this.players.getChildren().forEach(p => {
            if (p.healthBar) p.healthBar.destroy();
            p.destroy();
        });
        this.players.clear(true, true);

        // 2. Reseta o estado do GameManager
        this.selectedPlayer = null;
        this.setActionMode(null);
        this.removeShootVisuals();
        if (this.shared.highlightBox) this.shared.highlightBox.setVisible(false);

        // 3. Recria o jogo 
        this.setupOfflineGame(this.currentMissionNumber);

        // 4. Seleciona o primeiro personagem do time
        this.selectPlayer(this.players.getChildren()[0]);
        this.showMessage('Game Restarted!');
    },


    removePlayer(playerId) {
        const playerToRemove = this.players.getChildren().find(p => p.id === playerId);
        if (playerToRemove) {
            if (playerToRemove.healthBar) playerToRemove.healthBar.destroy();
            playerToRemove.destroy();
        }
    },


    getPlayerById(id) {
        return this.players.getChildren().find(p => p.id === id);
    },


    selectPlayer(player) {
        if (player.health <= 0) {
            this.showMessage('This player is out of combat!');
            return;
        }

        // 2. Em RTS, sempre permitimos selecionar nossas unidades.
        // 3. Se todas as condições forem atendidas, seleciona o jogador.
        this.selectedPlayer = player;
        
        // Centraliza a câmera no jogador selecionado com uma animação suave (500ms)
        this.scene.cameras.main.pan(player.x, player.y, 500, 'Power2');
        
        this.setActionMode(null);

        this.removeShootVisuals();
        this.createHighlightBox(player);
        this.updateUI();
        this.updateStatsPanel(); // Atualiza o painel de stats com o novo jogador

        console.log(`Player selected: ${player.name}`);
    },


    selectNextPlayer() {
        // Agora o TAB volta a funcionar para alternar entre os personagens do seu time
        // Restringido para selecionar apenas o comandante
        const allPlayers = this.players.getChildren().filter(p => p && p.health > 0 && p === this.commander);
        if (allPlayers.length === 0) return;

        let currentIndex = 0;
        if (this.selectedPlayer && this.selectedPlayer.health > 0) {
            currentIndex = allPlayers.findIndex(p => p === this.selectedPlayer);
        }

        const nextIndex = (currentIndex + 1) % allPlayers.length;
        const nextPlayer = allPlayers[nextIndex];

        if (nextPlayer) {
            this.selectPlayer(nextPlayer);
        }
    },

    createHighlightBox(player) {
        const config = PLAYER_CONFIGS[player.playerType];
        if (!config) {
            console.error(`[GameManager] Configuração não encontrada para o tipo de jogador: ${player.playerType}`);
            return;
        }

        const highlightX = player.x;
        const highlightY = player.y + config.highlightOffset;
        // Usa as dimensões de exibição reais do sprite (considerando setDisplaySize ou scale)
        const highlightWidth = player.displayWidth + 10;
        const highlightHeight = player.displayHeight + 10;

        if (!this.shared.highlightBox) {
            this.shared.highlightBox = this.scene.add.rectangle(highlightX, highlightY, highlightWidth, highlightHeight)
                .setStrokeStyle(3, 0x66ccff)
                .setDepth(1000);
        } else {
            this.shared.highlightBox.setPosition(highlightX, highlightY)
                .setSize(highlightWidth, highlightHeight)
                .setStrokeStyle(3, 0x66ccff)
                .setVisible(true);
        }
    },


    getPlayerAt(x, y) {
        return this.players.getChildren().find(p =>
            p && p.health > 0 && p.getBounds().contains(x, y)
        );
    },


    getNpcAt(x, y) {
        if (!this.scene.npcManager || !this.scene.npcManager.npcs) return null;
        return this.scene.npcManager.npcs.getChildren().find(n => 
            n.active && n.visible && n.getBounds().contains(x, y)
        );
    },

    // Ações do jogador
    moveSelectedPlayer(targetX, targetY) {
        const player = this.selectedPlayer;
        
        // Usa o PathManager para encontrar o caminho
        this.scene.pathManager.findPath(player.x, player.y, targetX, targetY, (path) => {
            if (path && path.length > 0) {
                // Limita o caminho à distância máxima de movimento
                let totalDist = 0;
                let limitedPath = [new Phaser.Math.Vector2(player.x, player.y)]; // Começa da posição exata do jogador
                for (let i = 0; i < path.length; i++) {
                    const segmentDist = Phaser.Math.Distance.Between(limitedPath[limitedPath.length - 1].x, limitedPath[limitedPath.length - 1].y, path[i].x, path[i].y);
                    if (totalDist + segmentDist > GAME_CONFIG.MAX_MOVE_DISTANCE) {
                        this.showMessage(`Destination exceeds move limit (${GAME_CONFIG.MAX_MOVE_DISTANCE}px). Moving as far as possible.`);
                        break; // Para de adicionar pontos ao caminho
                    }
                    totalDist += segmentDist;
                    limitedPath.push(path[i]);
                }

                player.path = limitedPath;
            player._lastDistToTarget = Infinity; // Reinicia rastreador de progresso
            player._stuckFrames = 0;
                player.currentPathIndex = 1; // Começa no primeiro waypoint do caminho encontrado
                this.updateUI();
                this.setActionMode(null);
                this.spawnClickFX(limitedPath[limitedPath.length - 1].x, limitedPath[limitedPath.length - 1].y);
            } else {
                this.showMessage('Cannot find a path to that location.');
            }
        });
    },

    // Este método agora só atualiza o jogador local
    updateLocalPlayerMovement() {
        // Verifica se o comandante está se movendo (tem um caminho ou um alvo)
        const commanderIsMoving = this.commander && (this.commander.path || this.commander.target);

        this.players.children.iterate(p => {
            // Se o personagem estiver morto ou inativo, ignora toda a lógica de movimento/ação
            if (!p || !p.active || p.health <= 0) return;
            
            // --- LÓGICA DE ATAQUE AUTOMÁTICO (APENAS SOLDADOS) ---
            if (p.playerType === 'soldado' && p.active && p.health > 0) {
                // Cooldown de 1.5 segundos para ataque automático
                if (!p._lastAutoAttack || this.scene.time.now - p._lastAutoAttack > 1500) {
                    const weaponKey = p.weapon || 'pistol';
                    const weaponConfig = WEAPONS[weaponKey] || WEAPONS['pistol'];
                    
                    let nearestEnemy = null;
                    let minDist = weaponConfig.range * (1 + this.getUpgradeBonus('range'));

                    // Busca NPCs visíveis no alcance da arma
                    this.scene.npcManager.npcs.getChildren().forEach(npc => {
                        if (npc.active && npc.visible && npc.health > 0) {
                            const d = Phaser.Math.Distance.Between(p.x, p.y, npc.x, npc.y);
                            if (d <= minDist) {
                                // Verifica se há linha de visão antes de atirar
                                if (this.scene.meuCenario.checkLineOfSight(p.x, p.y, npc.x, npc.y)) {
                                    minDist = d;
                                    nearestEnemy = npc;
                                }
                            }
                        }
                    });

                    if (nearestEnemy) {
                        p._lastAutoAttack = this.scene.time.now;
                        // Executa o tiro sem alterar a seleção global, evitando bugs de UI/Moedas
                        this.executeShoot(nearestEnemy.x, nearestEnemy.y, nearestEnemy, p);
                    }
                }
            }

            // --- LÓGICA ESPECÍFICA DO MINERADOR (AUTO-MINING) ---
            let isAutoMining = false;
            // Só minera se o comandante estiver parado
            if (!commanderIsMoving && p.active && p.health > 0 && p.playerType === 'minerador') {
                const MINE_VISION = 100;
                
                // Procura minério se não tiver um alvo ou se o alvo atual sumiu (foi coletado)
                if (!p._miningTarget || !p._miningTarget.active) {
                    p._miningTarget = null;
                    
                    // Throttle a busca por minério para não pesar no processamento (a cada 500ms)
                    if (!p._lastOreSearch || this.scene.time.now - p._lastOreSearch > 500) {
                        p._lastOreSearch = this.scene.time.now;
                        
                        let nearestOre = null;
                        let minDist = MINE_VISION;
                        
                        // Busca no grupo de minérios do cenário
                        this.scene.meuCenario.oresGroup.getChildren().forEach(ore => {
                            if (ore.active) {
                                const dist = Phaser.Math.Distance.Between(p.x, p.y, ore.x, ore.y);
                                if (dist < minDist) {
                                    minDist = dist;
                                    nearestOre = ore;
                                }
                            }
                        });
                        if (nearestOre) p._miningTarget = nearestOre;
                    }
                }

                if (p._miningTarget && p._miningTarget.active) {
                    isAutoMining = true;
                    p.target = { x: p._miningTarget.x, y: p._miningTarget.y };
                    p.path = null; // Prioriza o minério sobre a rota de formação
                }
            }

            // --- LÓGICA DE FORMAÇÃO EM TRIÂNGULO (SNAP FOLLOW) ---
            if (!isAutoMining && p.isFollower && this.commander && this.commander.active && p !== this.commander) {
                // Define os offsets para a formação em triângulo/V atrás do comandante
                const formationSlots = [
                    { dx: -60, dy: 60 },  // Slot 1: Esquerda-Atrás
                    { dx: 60, dy: 60 },   // Slot 2: Direita-Atrás
                    { dx: -110, dy: 110 }, // Slot 3: Mais à Esquerda-Atrás
                    { dx: 110, dy: 110 },  // Slot 4: Mais à Direita-Atrás
                    { dx: 0, dy: 120 }     // Slot 5: Centro-Atrás
                ];

                const slot = formationSlots[p.formationSlotIndex % formationSlots.length];
                const targetX = this.commander.x + slot.dx;
                const targetY = this.commander.y + slot.dy;

                const distToSlot = Phaser.Math.Distance.Between(p.x, p.y, targetX, targetY);
                
                // Threshold para começar a mover para o slot (reduzido para 20px para ser bem "snap")
                if (distToSlot > 20) {
                    const hasLoS = this.scene.meuCenario.checkLineOfSight(p.x, p.y, targetX, targetY);
                    
                    if (hasLoS) {
                        // Se tem visão direta, usa movimento direto (muito mais rápido e "snap")
                        p.target = { x: targetX, y: targetY };
                        p.path = null; 
                    } else if (!p.path || this.scene.time.now - (p._lastFollowCalc || 0) > 500) {
                        // Se houver obstáculo, recalcula o caminho a cada 500ms
                        p._lastFollowCalc = this.scene.time.now;
                        this.scene.pathManager.findPath(p.x, p.y, targetX, targetY, (path) => {
                            if (path && path.length > 1) {
                                p.path = path;
                                p.currentPathIndex = 1;
                            }
                        });
                    }
                } else if (distToSlot < 10) {
                    // Se já chegou no slot, para completamente
                    if (p.body) p.body.setVelocity(0, 0);
                    p.target = null;
                    p.path = null;
                }
            }

            // NOVA LÓGICA DE PATHFINDING
            if (p.path && p.currentPathIndex < p.path.length) {
                // Define o alvo como o próximo waypoint no caminho
                p.target = p.path[p.currentPathIndex];
                if (!p.target) return;

                let distToTarget = Phaser.Math.Distance.Between(p.x, p.y, p.target.x, p.target.y);
                
                // LÓGICA DE DETECÇÃO DE TRAVAMENTO MELHORADA
                // Verifica se o personagem está fazendo progresso real em direção ao alvo
                const progress = (p._lastDistToTarget || Infinity) - distToTarget;

                if (p.target && (progress < 0.1 || !p.body.blocked.none) && distToTarget > 15) {
                    p._stuckFrames = (p._stuckFrames || 0) + 1;
                    if (p._stuckFrames > 40) { // Se não houver progresso por ~0.6s
                        // SOLUÇÃO: Teleporte de segurança para desvencilhar (Unstuck)
                        console.log(`[Unstuck] ${p.id} destravado automaticamente.`);
                        
                        // Efeito visual no local antigo e no novo
                        if (this.scene.shotManager) this.scene.shotManager.createTeleportEffect(p.x, p.y);
                        if (this.scene.shotManager) this.scene.shotManager.createTeleportEffect(p.target.x, p.target.y);

                        // Move o personagem para a posição exata do waypoint onde ele deveria estar
                        p.setPosition(p.target.x, p.target.y);
                        if (p.body) p.body.reset(p.target.x, p.target.y);
                        
                        p._stuckFrames = 0;
                        p._lastDistToTarget = Infinity;
                        return; 
                    }
                } else {
                    p._stuckFrames = 0;
                }
                
                p._lastDistToTarget = distToTarget;

                // Move em direção ao alvo atual (waypoint)
                this.updatePlayerMovement(p);

                // Se chegou ao waypoint, avança para o próximo
                // TOLERÂNCIA: 15px para pontos no caminho, 5px para o destino final.
                // Isso evita que o personagem fique "sambando" em quinas de paredes.
                if (!p.target) return;
                
                distToTarget = Phaser.Math.Distance.Between(p.x, p.y, p.target.x, p.target.y);
                const arrivalThreshold = (p.currentPathIndex === p.path.length - 1) ? 5 : 15;
                if (p.target && distToTarget < arrivalThreshold) {
                    p.currentPathIndex++;
                    if (p.currentPathIndex >= p.path.length) {
                        // Chegou ao fim do caminho
                        p.path = null;
                        p.target = null;
                        this.clearDestinationMarker();
                    }
                }
            } else if (p.target) {
                // FALLBACK DE SEGURANÇA: Se tiver target mas não path (evita travamento da IA antiga)
                this.updatePlayerMovement(p);
                
                // Verifica chegada manual
                if (Phaser.Math.Distance.Between(p.x, p.y, p.target.x, p.target.y) < 4) {
                    p.setVelocity(0).setPosition(p.target.x, p.target.y);
                    p.target = null;
                    if (this.animationManager) this.animationManager.updateAnimation(p, 0, 0);
                } 
            } else {
                p.setVelocity(0);

                // CORREÇÃO: Removemos o bloco que forçava o frame estático.
                // O updateAnimation já possui proteção interna para não sobrescrever enquanto o tiro acontece.
                if (this.animationManager) {
                    this.animationManager.updateAnimation(p, 0, 0);
                }
            }
        });
    },

    // Este método atualiza a UI de todos os jogadores e a mira do jogador local
    updatePlayers() {
        const allPlayers = this.players.getChildren();
        allPlayers.forEach(p => {
            if (!p) return;
            this.updatePlayerUI(p);

            // SOLUÇÃO ROBUSTA: Verificação de Clipping (Anti-Stuck)
            // Se o player estiver DENTRO de um obstáculo, empurra ele para fora imediatamente
            this.scene.physics.overlap(p, [this.scene.meuCenario.obstaclesGroup, this.scene.meuCenario.animatedGroup], (obj1, obj2) => {
                const angle = Phaser.Math.Angle.Between(obj2.x, obj2.y, obj1.x, obj1.y);
                // Força de ejeção: empurra o personagem na direção oposta ao centro do obstáculo
                const ejectionForce = 5; // Aumentado para 5 para uma resposta mais imediata
                obj1.x += Math.cos(angle) * ejectionForce;
                obj1.y += Math.sin(angle) * ejectionForce;
                // Sincroniza o corpo físico com a nova posição corrigida
                if (obj1.body) obj1.body.reset(obj1.x, obj1.y);
            });
        });
    },


    updatePlayerMovement(player) {
        // Proteção contra chamadas onde o alvo ainda não foi definido ou foi limpo
        if (!player || !player.target) return;

        const dist = Phaser.Math.Distance.Between(player.x, player.y, player.target.x, player.target.y);

        const angle = Phaser.Math.Angle.Between(player.x, player.y, player.target.x, player.target.y);
        const speed = GAME_CONFIG.SPEED * (player.speedMult || 1);
        let velocityX = Math.cos(angle) * speed;
        let velocityY = Math.sin(angle) * speed;

        // LÓGICA DE SEPARAÇÃO: Impede que os personagens do mesmo time fiquem um em cima do outro
        // e se prendam mutuamente nas quinas das paredes.
        const separation = this.calculatePlayerSeparation(player);
        velocityX += separation.x;
        velocityY += separation.y;

        // Não rotacionar sprite durante o movimento para evitar conflitos com as animações
        player.setVelocity(velocityX, velocityY);

        if (this.animationManager) {
            this.animationManager.updateAnimation(player, velocityX, velocityY);
        }

        // REMOVIDO: Modificar Y manualmente quebra a resolução de colisão do Arcade Physics
        // player.y += Math.sin(this.scene.time.now / 200) * 0.3;
        
        player.setDepth(player.y);
    },

    /**
     * Calcula força de repulsão entre membros do mesmo time para evitar engavetamentos.
     */
    calculatePlayerSeparation(player) {
        let sepX = 0;
        let sepY = 0;
        const teamMates = this.players.getChildren();
        
        teamMates.forEach(other => {
            if (other === player || !other.active || other.health <= 0) return;
            
            const dist = Phaser.Math.Distance.Between(player.x, player.y, other.x, other.y);
            if (dist < 50) { // Distância de conforto entre aliados
                const force = 0.3; // Reduzido para evitar empurrar aliados contra as paredes
                sepX += (player.x - other.x) * force;
                sepY += (player.y - other.y) * force;
            }
        });
        return { x: sepX, y: sepY };
    },


    updatePlayerUI(player) {
        if (this.selectedPlayer === player && this.shared.highlightBox) {
            const config = PLAYER_CONFIGS[player.playerType];
            if (!config) return;
            const offsetY = config.highlightOffset;
            this.shared.highlightBox.setPosition(player.x, player.y + offsetY);
        }

        if (player.healthBar && player.health > 0) {
            const config = PLAYER_CONFIGS[player.playerType];
            if (!config) return;
            // Posiciona a barra logo acima do texto de vida
            player.healthBar.setPosition(player.x, player.y + config.healthTextOffset - 15);
            player.healthBar.setDepth(player.depth + 1);
        }

        if (this.actionMode === 'shoot' && this.selectedPlayer === player && this.shared.shootIndicator) {
            const pointer = this.scene.input.activePointer;
            
            // Verifica hover sobre inimigos ou NPCs
            const hoveredPlayer = this.getPlayerAt(pointer.worldX, pointer.worldY);
            const hoveredNpc = this.getNpcAt(pointer.worldX, pointer.worldY);
            
            const isEnemy = hoveredPlayer && hoveredPlayer.team !== this.selectedPlayer.team;
            const isNpc = !!hoveredNpc;

            if (isEnemy || isNpc) {
                this.shared.shootIndicator.setVisible(true);
                this.shared.shootIndicator.setPosition(pointer.worldX, pointer.worldY);
            } else {
                this.shared.shootIndicator.setVisible(false);
            }

            // Selecionar animação/frame baseado na direção do cursor para manter o personagem "dentro do quadrado"
            const aimAngle = Phaser.Math.Angle.Between(player.x, player.y, pointer.worldX, pointer.worldY);
            const aimDirection = this.getDirectionFromAngle(Phaser.Math.RadToDeg(aimAngle));

            if (this.animationManager) {
                // Usar frame estático ao mirar (não mostrar animação de andar)
                this.animationManager.setAimFrame(player, aimDirection);
            }
        }

        // Desenhar overlay vermelho translúcido fora do alcance (usa máscara para recortar o círculo do jogador ou do centro definido)
        if (this.showShootRange) {
            const center = (this.selectedPlayer && this.selectedPlayer.health > 0) ? { x: this.selectedPlayer.x, y: this.selectedPlayer.y } : (this.shared.shootRangeCenter || { x: 0, y: 0 });

            // Criar overlay e máscara se necessário
            if (!this.shared.shootRangeOverlay) {
                this.shared.shootRangeOverlay = this.scene.add.graphics().setDepth(9998);
                // preenchimento grande para cobrir o mundo (usar alpha configurável)
                this.shared.shootRangeOverlay.fillStyle(0xff0000, GAME_CONFIG.SHOOT_OVERLAY_ALPHA);
                this.shared.shootRangeOverlay.fillRect(-5000, -5000, 10000, 10000);

                this.shared.shootRangeMaskGraphics = this.scene.add.graphics().setDepth(9999);
                this.shared.shootRangeMaskGraphics.fillStyle(0xffffff, 1);
                this.shared.shootRangeMaskGraphics.fillCircle(center.x, center.y, GAME_CONFIG.SHOOT_DISTANCE);
                // Não mostrar o gráfico da máscara (usado apenas pela GeometryMask)
                this.shared.shootRangeMaskGraphics.setVisible(false);

                this.shared.shootRangeMask = new Phaser.Display.Masks.GeometryMask(this.scene, this.shared.shootRangeMaskGraphics);
                this.shared.shootRangeMask.invertAlpha = true; // mostrar overlay fora do círculo
                this.shared.shootRangeOverlay.setMask(this.shared.shootRangeMask);
            } else {
                // Atualizar posição do buraco (círculo claro)
                this.shared.shootRangeMaskGraphics.clear();
                this.shared.shootRangeMaskGraphics.fillStyle(0xffffff, 1);
                this.shared.shootRangeMaskGraphics.fillCircle(center.x, center.y, GAME_CONFIG.SHOOT_DISTANCE);
                // Manter máscara invisível (não mostrar o círculo branco no mundo)
                this.shared.shootRangeMaskGraphics.setVisible(false);
            }
        } else if (this.shared.shootRangeOverlay) {
            // Limpar overlay e máscara quando desligado
            if (this.shared.shootRangeOverlay) {
                this.shared.shootRangeOverlay.clear();
                this.shared.shootRangeOverlay.destroy();
                this.shared.shootRangeOverlay = null;
            }
            if (this.shared.shootRangeMaskGraphics) {
                this.shared.shootRangeMaskGraphics.clear();
                this.shared.shootRangeMaskGraphics.destroy();
                this.shared.shootRangeMaskGraphics = null;
            }
            if (this.shared.shootRangeMask) {
                this.shared.shootRangeMask = null;
            }
        }

        // Se não estiver no modo de atirar, suavemente resetar a rotação para 0 (orientação padrão do sprite)
        if (this.actionMode !== 'shoot') {
            if (Math.abs(Phaser.Math.Angle.Normalize(player.rotation)) > 0.0001) {
                player.rotation = Phaser.Math.Angle.RotateTo(player.rotation, 0, GAME_CONFIG.TURN_SPEED);
            }
        }
    },

    clearDestinationMarker() {
        if (window.destinationMarker) {
            window.destinationMarker.destroy();
            window.destinationMarker = null;
        }
        if (window.distanceText) {
            window.distanceText.setText('');
        }
    },
};
