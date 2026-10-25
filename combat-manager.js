// combat-manager.js
// Combate: modos de ação, tiro, dano, morte, retaliação e efeitos visuais de combate.
// Métodos mesclados no prototype do GameManager (ver game-manager.js).
export const CombatMethods = {
    // Modos de ação
    toggleMoveMode() {
        if (this.actionMode === 'move') {
            this.setActionMode(null);
        } else {
            this.setActionMode('move');
        }
    },


    toggleShootMode() {
        if (this.actionMode === 'shoot') {
            this.setActionMode(null);
        } else {
            this.setActionMode('shoot');
        }
    },


    setActionMode(mode) {
        this.actionMode = mode;
        this.updateUIMode();

        if (mode === 'shoot' && this.selectedPlayer) {
            this.createShootVisuals();
        } else {
            this.removeShootVisuals();
        }

        // Atualizar UI
        UIManager.updateButtonStates();
    },

    // Visuals de tiro
    createShootVisuals() {
        if (!this.selectedPlayer) return;

        if (!this.shared.shootIndicator) {
            this.shared.shootIndicator = this.scene.add.circle(0, 0, 20, 0xff0000, 0.3)
                .setDepth(1000)
                .setVisible(false); // Começa invisível

            // Efeito de pulso (aumenta e diminui)
            this.scene.tweens.add({
                targets: this.shared.shootIndicator,
                scale: { from: 1, to: 1.3 },
                alpha: { from: 0.3, to: 0.6 },
                duration: 600,
                yoyo: true,
                repeat: -1
            });
        }
    },

    // Alterna a visualização do alcance de tiro (círculo vermelho)
    toggleRangeVisual() {
        this.showShootRange = !this.showShootRange;

        // Se ativado, definir centro do overlay para jogador selecionado ou para o centro da câmera
        if (this.showShootRange) {
            if (this.selectedPlayer) {
                this.shared.shootRangeCenter = { x: this.selectedPlayer.x, y: this.selectedPlayer.y };
            } else {
                // centro da câmera
                const cam = this.scene.cameras.main;
                const centerX = cam.scrollX + cam.width / 2;
                const centerY = cam.scrollY + cam.height / 2;
                this.shared.shootRangeCenter = { x: centerX, y: centerY };
                this.showMessage('Range activated (no player selected). Select a player to anchor.');
            }
        } else {
            // desligando limpar gráficos (será limpo no updatePlayerUI)
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
            this.shared.shootRangeCenter = null;
        }

        if (window.uiBar) {
            // atualizar botões para refletir estado
            UIManager.updateButtonStates();
        }
    },


    removeShootVisuals() {
        if (this.shared.shootIndicator) {
            this.shared.shootIndicator.destroy();
            this.shared.shootIndicator = null;
        }
    },

    /**
     * Aciona a retaliação dos companheiros de equipe quando um personagem é atacado por um NPC.
     * @param {Phaser.GameObjects.Sprite} attackedPlayer O jogador que sofreu o ataque.
     * @param {Phaser.GameObjects.Sprite} npcAttacker O NPC que realizou o ataque.
     */
    triggerTeamRetaliation(attackedPlayer, npcAttacker) {
        // 1. Verifica se a retaliação global está ativa
        if (!this.autoRetaliation) return;

        const teammates = this.players.getChildren().filter(p =>
            p.active &&
            p.health > 0 &&
            p.team === attackedPlayer.team
        );

        let staggerDelay = 0;

        teammates.forEach((teammate) => {
            const dist = Phaser.Math.Distance.Between(teammate.x, teammate.y, npcAttacker.x, npcAttacker.y);
            const hasLoS = this.scene.meuCenario.checkLineOfSight(teammate.x, teammate.y, npcAttacker.x, npcAttacker.y);

            if (dist <= (GAME_CONFIG.SHOOT_DISTANCE || 450) && hasLoS) {
                // Agenda a sequência de retaliação para este companheiro de equipe de forma escalonada
                this.scene.time.addEvent({
                    delay: staggerDelay,
                    callback: () => {
                        // Re-verifica se as condições ainda são válidas (NPC ainda vivo e atirador ativo)
                        if (npcAttacker.health <= 0 || !teammate.active || teammate.health <= 0) return;

                        console.log(`[Retaliation] ${teammate.id} is in range and will retaliate.`);
                
                        // Fase 1: Mira (Vira o personagem)
                        const aimAngle = Phaser.Math.Angle.Between(teammate.x, teammate.y, npcAttacker.x, npcAttacker.y);
                        const aimDirection = this.getDirectionFromAngle(Phaser.Math.RadToDeg(aimAngle));
                        if (this.animationManager) this.animationManager.setAimFrame(teammate, aimDirection);

                        // Fase 2: Disparo (300ms após iniciar a mira)
                        this.scene.time.addEvent({
                            delay: 300,
                            callback: () => {
                                if (npcAttacker.health <= 0 || !teammate.active || teammate.health <= 0) return;
                                this.executeRemoteShoot(teammate, npcAttacker.x, npcAttacker.y);
                                this.resolveOfflineShot(teammate, npcAttacker.x, npcAttacker.y);
                            }
                        });
                    }
                });

                // Incrementa o delay para o próximo soldado (300ms mira + 700ms intervalo pós-tiro)
                staggerDelay += 1000;
            }
        });
    },


    executeShoot(targetX, targetY, targetEntity = null, shooter = this.selectedPlayer) {
        if (!shooter) return;

        // Forçar parada do movimento ao atirar para não sobrescrever animação
        shooter.setVelocity(0, 0);
        shooter.path = null;
        shooter.target = null;

        const weaponKey = shooter.weapon || 'pistol';
        const weaponConfig = WEAPONS[weaponKey] || WEAPONS['pistol'];

        // Cadência de tiro do jogador (os soldados já têm o próprio intervalo de autofire)
        if (shooter === this.selectedPlayer) {
            const now = this.scene.time.now;
            if (now - (shooter._lastShotTime || 0) < weaponConfig.fireRate) return;
            shooter._lastShotTime = now;
        }

        const dist = Phaser.Math.Distance.Between(shooter.x, shooter.y, targetX, targetY);
        if (dist > weaponConfig.range * (1 + this.getUpgradeBonus('range'))) {
            this.showMessage('Target too far!');
            return;
        }

        // Ajustar frame/animação instantaneamente para a direção do tiro (manter dentro do quadrado)
        const aimAngle = Phaser.Math.Angle.Between(shooter.x, shooter.y, targetX, targetY);
        const aimDirection = this.getDirectionFromAngle(Phaser.Math.RadToDeg(aimAngle));

        // MUDANÇA: Agora usa playShootAnimation para disparar a sequência completa de frames
        if (this.animationManager) this.animationManager.playShootAnimation(shooter, aimDirection);

        const isSelectedShooter = shooter === this.selectedPlayer;
        if (isSelectedShooter) this.updateUI();
        
        // Tocar som de tiro
        if (this.soundManager) this.soundManager.playShoot();

        // Calcula a posição inicial do tiro a partir da ponta da arma
        const typeKey = shooter.playerType || (shooter.getData ? shooter.getData('type') : null);
        const config = PLAYER_CONFIGS[typeKey] || (typeof NPC_CONFIGS !== 'undefined' ? NPC_CONFIGS[typeKey] : null);
        const muzzleOffset = (config && config.muzzleOffset) ? config.muzzleOffset : { x: 0, y: 0 };
        const startX = shooter.x + muzzleOffset.x;
        const startY = shooter.y + muzzleOffset.y;

        // Chama o ShotManager para o efeito visual
        if (weaponConfig.shootType === 'game_feel_rifle') {
            this.scene.shotManager.fireGameFeelProjectile_rifle(startX, startY, targetX, targetY, 0, false, shooter, weaponConfig);
        } else {
            this.scene.shotManager.fireGameFeelProjectile(startX, startY, targetX, targetY, 0, false, shooter, weaponConfig);
        }
        this.resolveOfflineShot(shooter, targetX, targetY); // Lógica de dano offline
        // Só o tiro do jogador limpa o modo de ação; o autofire dos soldados não pode cancelá-lo
        if (isSelectedShooter) {
            this.setActionMode(null);
            this.removeShootVisuals();
        }
    },

    /** Botão direito: o comandante atira no ponto do cursor (ou no alien que estiver ali). */
    shootAtPointer(pointer) {
        if (!this.selectedPlayer || this.isGameOver) return;
        const npc = this.getNpcAt(pointer.worldX, pointer.worldY);
        if (npc) this.executeShoot(npc.x, npc.y, npc);
        else this.executeShoot(pointer.worldX, pointer.worldY);
    },

    /** Espaço: atira no alien visível mais próximo, dentro do alcance e com linha de visão. */
    shootAtNearest() {
        const shooter = this.selectedPlayer;
        if (!shooter || this.isGameOver) return;
        const weapon = WEAPONS[shooter.weapon] || WEAPONS['pistol'];
        const range = weapon.range * (1 + this.getUpgradeBonus('range'));
        let nearest = null;
        let minDist = range;
        this.scene.npcManager.npcs.getChildren().forEach(npc => {
            if (!npc.active || !npc.visible || npc.health <= 0) return;
            const d = Phaser.Math.Distance.Between(shooter.x, shooter.y, npc.x, npc.y);
            if (d <= minDist && this.scene.meuCenario.checkLineOfSight(shooter.x, shooter.y, npc.x, npc.y)) {
                minDist = d;
                nearest = npc;
            }
        });
        if (nearest) this.executeShoot(nearest.x, nearest.y, nearest);
        else this.showMessage('Nenhum alien ao alcance');
    },

    /**
     * Explosão em área. Atinge só NPCs: unidades do jogador nunca são feridas.
     * damage null = letal. targets = tipos de NPC atingidos (omitido = todos; a bomba usa só 'alien').
     */
    blastAt(x, y, radius, { damage = null, targets = null } = {}) {
        // Onda de choque + clarão + tremor de câmera
        const wave = this.scene.add.circle(x, y, 20, 0xff8800, 0.5).setStrokeStyle(4, 0xffee88).setDepth(3000);
        this.scene.tweens.add({
            targets: wave, radius: radius, alpha: 0, duration: 600, ease: 'Quad.out',
            onComplete: () => wave.destroy()
        });
        this.scene.shotManager.createExplosionEffect(x, y);
        this.scene.cameras.main.shake(radius > 250 ? 400 : 200, radius > 250 ? 0.01 : 0.005);
        if (this.soundManager) this.soundManager.play('shoot');

        // Percorre uma cópia: matar um NPC pode soltar drops e mexer na lista
        const victims = this.scene.npcManager.npcs.getChildren().filter(npc =>
            npc.active && npc.health > 0 &&
            (!targets || targets.includes(npc.getData('type'))) &&
            Phaser.Math.Distance.Between(x, y, npc.x, npc.y) <= radius
        );
        victims.forEach(npc => this.handleNpcDamage({ npcId: npc.getData('id'), damage: damage === null ? npc.health : damage }));
        this.showMessage(victims.length ? `BOOM! ${victims.length} atingidos` : 'BOOM! Ninguém atingido');
    },

    /** Sorteia um item pelo dropWeight da tabela ITEMS. */
    rollDrop() {
        const entries = Object.entries(ITEMS);
        let roll = Math.random() * entries.reduce((sum, [, def]) => sum + def.dropWeight, 0);
        for (const [id, def] of entries) {
            roll -= def.dropWeight;
            if (roll < 0) return id;
        }
        return entries[0][0];
    },

    /**
     * Dano de um tiro: sorteia entre min e max da arma, aplica o bônus de upgrade
     * (só para o time do jogador) e reduz pela armadura do alvo.
     */
    computeDamage(attacker, target) {
        const weapon = WEAPONS[attacker.weapon] || WEAPONS['pistol'];
        let damage = Phaser.Math.Between(weapon.minDamage, weapon.maxDamage);
        if (attacker.team === 'player') {
            damage *= 1 + this.getUpgradeBonus('damage');
        }
        return this.applyArmor(damage, target.armor);
    },

    /** Reduz o dano pela armadura: armadura / (armadura + ARMOR_SCALE). Mínimo de 1. */
    applyArmor(damage, armor = 0) {
        const reduction = armor / (armor + GAME_CONFIG.ARMOR_SCALE);
        return Math.max(1, Math.round(damage * (1 - reduction)));
    },

    // Resolve o tiro localmente (cálculo de dano)
    resolveOfflineShot(shooter, targetX, targetY) {
        // Procura alvo no raio
        let target = this.findNearestEnemy(shooter, targetX, targetY, 50);
        
        // Se não achou jogador, procura NPC
        if (!target) {
            // Busca NPC por proximidade em um raio de 60px para evitar erros de precisão da IA
            target = this.scene.npcManager.npcs.getChildren().find(n => 
                n.active && n.visible && n.health > 0 && Phaser.Math.Distance.Between(targetX, targetY, n.x, n.y) <= 60
            );
        }
        // Dados para o dado (simulação visual)
        const rollData = { x: targetX, y: targetY, roll: 0, targetNumber: 0, isHit: false, isCritical: false };

        // Parede no caminho bloqueia o tiro
        if (target && !this.scene.meuCenario.checkLineOfSight(shooter.x, shooter.y, target.x, target.y)) {
            target = null;
            rollData.blocked = true;
        }

        if (target) {
            // Sempre acerta; o dano depende da arma, dos upgrades e da armadura do alvo
            const isHit = true;
            const damage = this.computeDamage(shooter, target);

            rollData.roll = 1;
            rollData.targetNumber = 1;
            rollData.isHit = isHit;
            rollData.isCritical = false;
            rollData.damage = damage;

            if (isHit) {

                console.log(`[COMBAT] Atirador: ${shooter.id} | Dano: ${damage}`);

                const targetNpcId = target.getData ? target.getData('id') : null;
                if (targetNpcId && typeof targetNpcId === 'string' && targetNpcId.startsWith('npc')) {
                    this.handleNpcDamage({ npcId: targetNpcId, damage: damage });
                    
                    // RETALIAÇÃO DO NPC: O NPC agora foca em quem o atacou
                    const npc = this.scene.npcManager.npcs.getChildren().find(n => n.getData('id') === targetNpcId);
                    if (npc && npc.active) {
                        npc.setData('targetPlayer', { id: shooter.id, x: shooter.x, y: shooter.y });
                        npc.setData('isEngaged', true);
                        npc.setData('isChasing', true);
                        npc.setData('lastKnownTargetPos', { x: shooter.x, y: shooter.y });
                    }
                } else {
                    this.updateCharacterHealth(target.id, target.health - damage);
                }
            }
        } else {
            rollData.roll = Math.floor(Math.random() * 6) + 1; // Rola só pra mostrar efeito
        }
        this.showDiceRoll(rollData);
    },

    // Executa um tiro vindo de um jogador remoto
    executeRemoteShoot(shooter, targetX, targetY) {
        if (!shooter) return;

        // Vira o sprite do atirador na direção do tiro
        const aimAngle = Phaser.Math.Angle.Between(shooter.x, shooter.y, targetX, targetY);
        const aimDirection = this.getDirectionFromAngle(Phaser.Math.RadToDeg(aimAngle));
        
        // Aplica o frame de mira visualmente
        // MUDANÇA: Garante que tiros remotos/IA também toquem a animação completa
        if (this.animationManager) this.animationManager.playShootAnimation(shooter, aimDirection);

        // Calcula a posição inicial do tiro a partir da ponta da arma
        // Tenta obter a configuração tanto de jogadores quanto de NPCs para evitar erros de undefined
        const typeKey = shooter.playerType || (shooter.getData ? shooter.getData('type') : null);
        const config = PLAYER_CONFIGS[typeKey] || (typeof NPC_CONFIGS !== 'undefined' ? NPC_CONFIGS[typeKey] : null);
        const muzzleOffset = (config && config.muzzleOffset) ? config.muzzleOffset : { x: 0, y: 0 };
        const startX = shooter.x + muzzleOffset.x;
        const startY = shooter.y + muzzleOffset.y;

        // Chama o ShotManager para o efeito visual correto
        if (shooter.weapon === 'shotgun') {
            this.scene.shotManager.fireGameFeelProjectile_rifle(startX, startY, targetX, targetY, 0, false, shooter);
        } else {
            this.scene.shotManager.fireGameFeelProjectile(startX, startY, targetX, targetY, 0, false, shooter);
        }
    },


    findNearestEnemy(shooter, targetX, targetY, maxDistance = 50) {
        let targetPlayer = null;
        let minDist = Infinity;

        this.players.getChildren().forEach(p => {
            if (!p || p === shooter || p.team === shooter.team || p.health <= 0) return;

            const d = Phaser.Math.Distance.Between(p.x, p.y, targetX, targetY);
            if (d < maxDistance && d < minDist) {
                minDist = d;
                targetPlayer = p;
            }
        });

        return targetPlayer;
    },

    // Nova função para atualizar a vida com base nos dados do servidor
    updateCharacterHealth(characterId, newHealth, attacker = null) {
        const target = this.getPlayerById(characterId);
        if (!target) return;

        // Proteção extra contra corrupção de estado por valores NaN
        if (isNaN(newHealth)) {
            console.error(`[GameManager] Erro fatal: Tentativa de definir vida como NaN para ${characterId}`);
            return;
        }

        const oldHealth = target.health;
        
        // FIX: Mostrar texto flutuante de dano para feedback visual (NPCs e Tiros)
        if (newHealth < oldHealth) {
            const damage = Math.round(oldHealth - newHealth);

            // REAÇÃO AO TIRO: Para o movimento do personagem imediatamente
            target.path = null;
            target.target = null;
            target.setVelocity(0, 0);

            // Se houver um atacante NPC, vira para ele (dar target visual)
            if (attacker && (attacker.id || (attacker.getData && attacker.getData('id')))) {
                const angle = Phaser.Math.Angle.Between(target.x, target.y, attacker.x, attacker.y);
                const direction = this.getDirectionFromAngle(Phaser.Math.RadToDeg(angle));
                if (this.animationManager) this.animationManager.setAimFrame(target, direction);
            }

            this.showFloatingText(target.x, target.y - 60, `-${damage}`, '#ff0000');
        }

        target.health = newHealth;

        // Atualiza a barra de vida visual
        this.drawHealthBar(target.healthBar, 40, 6, target.health / target.maxHealth);

        // Se tomou dano, toca som de machucado
        if (newHealth < oldHealth && this.soundManager) {
            this.soundManager.playHit();
        }

        // Lógica de morte
        if (target.health <= 0 && oldHealth > 0) {
            if (target.healthBar) target.healthBar.setVisible(false);
            this.showMessage(`${target.name} was eliminated!`);

            // Se o comandante morrer, o jogo acaba (Derrota)
            if (target === this.commander) {
                this.handleGameOver({ winner: 'enemy', reason: 'Commander Defeated' });
            } else if (target.playerType === 'soldado' || target.playerType === 'minerador') {
                // Se for soldado ou minerador, o corpo fica no chão
                target.setActive(false);
                if (target.body) target.body.setEnable(false);
                target.setAlpha(0.4); // Mais transparente para parecer um corpo
                target.setDepth(-0.5); // Fica abaixo das unidades vivas mas acima do chão (-1)
                target.anims.stop();
                target.isFollower = false; // Para de seguir o comandante
                target.path = null;
                target.target = null;
            } else {
                target.setAlpha(0.3).setActive(false).setVisible(false);
            }

            this.updateUI(); // Força atualização dos preços na UI após a morte
            this.checkVictoryCondition(); // Verifica vitória imediatamente no modo offline
        }

        // Atualiza a UI se o personagem morto era o selecionado
        if (this.selectedPlayer === target) this.updateUI();
        if (this.selectedPlayer === target) this.updateStatsPanel();

        // LÓGICA DE RETALIAÇÃO
        const attackerId = (attacker && attacker.getData) ? attacker.getData('id') : null;
        if (attackerId && typeof attackerId === 'string' && attackerId.startsWith('npc')) {
            this.triggerTeamRetaliation(target, attacker);
        }
    },

    // Nova função para aplicar dano em NPC vindo do servidor
    handleNpcDamage({ npcId, damage }) {
        if (!this.scene.npcManager || !this.scene.npcManager.npcs) return;
        
        const npc = this.scene.npcManager.npcs.getChildren().find(n => n.getData('id') === npcId);
        if (npc && npc.health > 0) {
            // Aplica dano direto na propriedade health do sprite
            if (typeof npc.health === 'undefined') npc.health = GAME_CONFIG.NPC_MAX_HEALTH; // Fallback
            
            npc.health = Math.max(0, npc.health - damage);
            
            this.showFloatingText(npc.x, npc.y - 40, `-${damage}`, '#ff0000');
            if (this.soundManager) this.soundManager.playHit();

            if (npc.health <= 0) {
                npc.health = 0;
                if (npc.healthBar) npc.healthBar.setVisible(false);
                if (npc.body) {
                    npc.body.stop();
                    npc.body.enable = false;
                }
                if (npc.healthText) npc.healthText.setVisible(false);
                this.showMessage('NPC Eliminated!');
                this.registerKill();

                // Remove o NPC do jogo de vez: some com um fade e o sprite é destruído.
                // Quem tem animação de morte (config.js) a toca antes de sumir.
                const type = npc.getData('type');
                const deathAnim = `npc_${type}_morto`;
                const removeBody = () => {
                    if (!npc.scene) return;
                    this.scene.tweens.add({
                        targets: npc,
                        alpha: 0,
                        duration: 400,
                        onComplete: () => {
                            if (npc.healthBar) npc.healthBar.destroy();
                            npc.destroy();
                        }
                    });
                };
                if (this.scene.anims.exists(deathAnim)) {
                    npc.play(deathAnim);
                    this.scene.time.delayedCall(2500, removeBody);
                } else {
                    npc.setActive(false);
                    removeBody();
                }
                
                // Lógica de Drop Offline
                if (Math.random() < 0.9) { // Aumentado para 90% de chance de drop total
                    const itemId = this.rollDrop();
                    
                    const drop = {
                        id: `drop_${Date.now()}_${Math.floor(Math.random()*1000)}`,
                        itemId: itemId,
                        x: npc.x,
                        y: npc.y
                    };
                    this.scene.npcManager.handleItemDropped(drop);
                }
            } else {
                // ATUALIZAÇÃO: Redesenha a barra de vida do NPC com a nova porcentagem
                const config = NPC_CONFIGS[npc.getData('type')];
                this.scene.npcManager.drawHealthBar(npc.healthBar, 30, 4, npc.health / (config.health || GAME_CONFIG.NPC_MAX_HEALTH));

                if (npc.healthText) npc.healthText.setText(npc.health.toString());
                this.showMessage(`NPC hit! HP: ${npc.health}`);
            }
        }
    },

    /**
     * Converte um ângulo em graus para uma string de direção ('up', 'down', 'left', 'right').
     * @param {number} angleDeg Ângulo em graus.
     * @returns {string} Direção correspondente.
     */
    getDirectionFromAngle(angleDeg) {
        if (angleDeg >= -45 && angleDeg <= 45) {
            return GAME_CONFIG.DIRECTION.RIGHT;
        } else if (angleDeg > 45 && angleDeg < 135) {
            return GAME_CONFIG.DIRECTION.DOWN;
        } else if (angleDeg >= 135 || angleDeg <= -135) {
            return GAME_CONFIG.DIRECTION.LEFT;
        } else {
            return GAME_CONFIG.DIRECTION.UP;
        }
    },

    // Efeitos visuais
    spawnClickFX(x, y) {
        if (window.destinationMarker) window.destinationMarker.destroy();

        window.destinationMarker = this.scene.add.circle(x, y, 8, 0x00ff00, 0.7)
            .setDepth(2000);

        this.scene.tweens.add({
            targets: window.destinationMarker,
            scale: 1.5,
            alpha: 0.3,
            yoyo: true,
            repeat: -1,
            duration: 400
        });
    },

    // Helper para mostrar texto flutuante (usado para dano em NPC)
    showFloatingText(x, y, message, color) {
        const text = this.scene.add.text(x, y, message, {
            fontSize: '20px',
            fill: color,
            stroke: '#000000',
            strokeThickness: 3,
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2000);

        this.scene.tweens.add({
            targets: text, y: y - 50, alpha: 0, duration: 1000,
            onComplete: () => text.destroy()
        });
    },

    // Processa efeitos visuais vindos do servidor
    handleSpawnEffect(data) {
        if (data.type === 'blood') {
            this.createBloodEffect(data.x, data.y);
        } else if (data.type === 'explosion') {
            this.createExplosionEffect(data.x, data.y);
        }
    },

    // Cria uma explosão de partículas de sangue usando sprites e tweens
    createBloodEffect(x, y) {
        for (let i = 0; i < 8; i++) {
            const particle = this.scene.add.image(x, y, 'blood_particle').setDepth(2000);
            const angle = Phaser.Math.Between(0, 360);
            const speed = Phaser.Math.Between(50, 150);
            const duration = Phaser.Math.Between(300, 600);
            
            const velocityX = Math.cos(Phaser.Math.DegToRad(angle)) * speed;
            const velocityY = Math.sin(Phaser.Math.DegToRad(angle)) * speed;
            
            this.scene.tweens.add({
                targets: particle,
                x: x + (velocityX * (duration / 1000)),
                y: y + (velocityY * (duration / 1000)),
                alpha: 0,
                scale: 0.5,
                duration: duration,
                onComplete: () => particle.destroy()
            });
        }
    },


    createExplosionEffect(x, y) {
        const explosion = this.scene.add.circle(x, y, 10, 0xffa500, 1).setDepth(2000);
        
        this.scene.tweens.add({
            targets: explosion,
            scale: 10, // Expande para cobrir o raio
            alpha: 0,
            duration: 500,
            onComplete: () => explosion.destroy()
        });

        // Texto de BOOM
        this.showFloatingText(x, y, "BOOM!", '#ff0000');
    },

    // --- VISUALIZAÇÃO DE DADOS ---
    showDiceRoll(data) {
        const { x, y, isHit } = data;

        // Cor: Verde se acertou, Vermelho se errou, Branco se não tinha alvo (tiro no chão)
        let color = isHit ? '#00ff00' : '#ffffff';

        // Simplificado para mostrar apenas o dano causado visualmente
        let textStr = isHit ? `-${data.damage}` : (data.blocked ? 'BLOCKED' : '');

        if (!textStr) return;
        const text = this.scene.add.text(x, y - 60, textStr, {
            fontSize: '24px',
            fill: color,
            stroke: '#000000',
            strokeThickness: 4,
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(2000);

        this.scene.tweens.add({
            targets: text,
            y: y - 100, // Sobe um pouco
            alpha: 0,
            duration: 1000, // 1 segundo de duração
            onComplete: () => text.destroy()
        });
    },
};
