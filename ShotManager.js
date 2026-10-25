// /var/www/html/brics/ShotManager.js
export default class ShotManager {
    constructor(scene) {
        this.scene = scene;
    }

    create() {
        this.generateTextures();
    }

    generateTextures() {
        // Generic Bullet
        if (!this.scene.textures.exists('bullet')) {
            const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xffff00, 1);
            g.fillCircle(3, 3, 3);
            g.generateTexture('bullet', 6, 6);
            g.destroy();
        }
        // Spark
        if (!this.scene.textures.exists('spark_particle')) {
            const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xffff00, 1);
            g.fillCircle(2, 2, 2);
            g.generateTexture('spark_particle', 4, 4);
            g.destroy();
        }
        // Shell Casing
        if (!this.scene.textures.exists('shell_casing')) {
            const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0x4B4F54, 1);
            g.fillRect(0, 0, 3, 1); // 3x1 pixel casing
            g.generateTexture('shell_casing', 3, 5);
            g.destroy();
        }
        // Bullet Tracer
        if (!this.scene.textures.exists('bullet_tracer')) {
            const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xffffff, 1);
            g.fillRect(0, 0, 60, 6);
            g.generateTexture('bullet_tracer', 30, 3);
            g.destroy();
        }
        // Rifle Bullet Tracer
        if (!this.scene.textures.exists('bullet_tracer_rifle')) {
            const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xffef00, 1); // Yellowish
            g.fillRect(0, 0, 80, 4); // Longer and thinner
            g.generateTexture('bullet_tracer_rifle', 40, 2);
            g.destroy();
        }
        // Fire Particle (Flamethrower)
        if (!this.scene.textures.exists('fire_particle')) {
            const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xff4400, 1);
            g.fillCircle(4, 4, 4);
            g.generateTexture('fire_particle', 8, 8);
            g.destroy();
        }
        // White Square (Generic fallback)
        if (!this.scene.textures.exists('white_square')) {
            const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xffffff, 1);
            g.fillRect(0, 0, 8, 8);
            g.generateTexture('white_square', 8, 8);
            g.destroy();
        }
        // Dust Particle (Poeira)
        if (!this.scene.textures.exists('dust_particle')) {
            const g = this.scene.make.graphics({ x: 0, y: 0, add: false });
            g.fillStyle(0xcccccc, 0.8); // Cinza claro
            g.fillCircle(3, 3, 3);
            g.generateTexture('dust_particle', 6, 6);
            g.destroy();
        }
    }

    createMuzzleSparks(x, y, angle) {
        if (!this.scene.textures.exists('spark_particle')) return;

        const emitter = this.scene.add.particles(x, y, 'spark_particle', {
            speed: { min: 100, max: 250 },
            angle: { min: Phaser.Math.RadToDeg(angle) - 25, max: Phaser.Math.RadToDeg(angle) + 25 },
            scale: { start: 1, end: 0 },
            lifespan: 150,
            quantity: 4,
            blendMode: 'ADD',
            emitting: false
        });
        emitter.setDepth(2002);
        emitter.explode();
        this.scene.time.delayedCall(200, () => emitter.destroy());
    }

    createMuzzleFlash(x, y, angle, config = {}) {
        // Handles config from both simple objects (NPCs) and weapon configs (Players)
        // Checks 'muzzleFlash' property or the config object itself if it has texture/scale properties
        const mfConfig = config.muzzleFlash || config; 
        
        if (mfConfig && mfConfig.texture && this.scene.textures.exists(mfConfig.texture)) {
            const texture = mfConfig.texture;
            const scale = mfConfig.scale !== undefined ? mfConfig.scale : 1.0;
            const rotationOffset = mfConfig.rotation !== undefined ? mfConfig.rotation : -Math.PI / 2;
            
            const flash = this.scene.add.sprite(x, y, texture).setDepth(2001);
            flash.setRotation(angle + rotationOffset);
            flash.setScale(scale);
            
            if (mfConfig.tint) {
                if (mfConfig.tint === 'random') {
                    flash.setTint(Math.floor(Math.random() * 0xffffff));
                } else {
                    flash.setTint(mfConfig.tint);
                }
            }
            
            this.scene.tweens.add({
                targets: flash,
                alpha: 0,
                scale: scale * 1.2,
                duration: 80,
                onComplete: () => flash.destroy()
            });
            return true;
        }
        return false;
    }

    createProjectileLight(proj, config = {}) {
        const pLight = config.projectileLight;
        if (pLight) {
            const { color = 0xffffff, radius = 100, intensity = 0.5, scale = 1.0 } = pLight;
            const light = this.scene.add.pointlight(proj.x, proj.y, color, radius, intensity);
            light.setScale(scale);
            light.setDepth(proj.depth - 1);
            
            const updateLight = () => {
                if (proj.active && light.active) {
                    light.setPosition(proj.x, proj.y);
                } else {
                    light.destroy();
                    this.scene.events.off('update', updateLight);
                }
            };
            this.scene.events.on('update', updateLight);
            
            proj.once('destroy', () => {
                light.destroy();
                this.scene.events.off('update', updateLight);
            });
        }
    }

    createShellCasing(x, y) {
        const shell = this.scene.add.image(x, y, 'shell_casing');
        shell.setDepth(y);

        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const dist = Phaser.Math.Between(15, 35);

        this.scene.tweens.add({
            targets: shell,
            x: x + Math.cos(angle) * dist,
            y: y + Math.sin(angle) * dist,
            angle: Phaser.Math.Between(0, 360),
            duration: 400,
            ease: 'Quad.out',
            onUpdate: () => shell.setDepth(shell.y),
            onComplete: () => {
                this.scene.tweens.add({
                    targets: shell,
                    alpha: 0,
                    delay: 300,
                    duration: 1000,
                    onComplete: () => shell.destroy()
                });
            }
        });
    }

    /**
     * Cria um efeito visual de teleporte/fumaça azul para o sistema de unstuck.
     */
    createTeleportEffect(x, y) {
        const color = 0x00ffff; // Ciano/Azul elétrico

        // 1. Círculo de luz expansivo
        const light = this.scene.add.circle(x, y, 5, color, 0.6).setDepth(2000);
        this.scene.tweens.add({
            targets: light,
            radius: 30,
            alpha: 0,
            duration: 350,
            onComplete: () => light.destroy()
        });

        // 2. Burst de partículas (usando a textura de faíscas já existente)
        if (this.scene.textures.exists('spark_particle')) {
            const emitter = this.scene.add.particles(x, y, 'spark_particle', {
                speed: { min: 20, max: 120 },
                scale: { start: 1, end: 0 },
                tint: color,
                lifespan: 400,
                quantity: 12,
                emitting: false
            }).setDepth(2001);
            emitter.explode();
            this.scene.time.delayedCall(500, () => emitter.destroy());
        }
    }

    /**
     * Cria um efeito de ondas de rádio expansivas saindo de um ponto.
     */
    createRadioWaveEffect(x, y) {
        const color = 0x00ffff; // Ciano para combinar com a UI de progresso

        for (let i = 0; i < 3; i++) {
            this.scene.time.delayedCall(i * 300, () => {
                if (!this.scene) return;

                // Cria um círculo que servirá como a onda
                const wave = this.scene.add.circle(x, y, 5, color, 0);
                wave.setStrokeStyle(2, color, 0.8);
                wave.setDepth(2000);

                // Animação de expansão e sumiço
                this.scene.tweens.add({
                    targets: wave,
                    radius: 150,
                    alpha: 0,
                    duration: 1000,
                    ease: 'Quad.out',
                    onComplete: () => wave.destroy()
                });
            });
        }
    }

    createImpactEffect(x, y) {
        const impact = this.scene.add.circle(x, y, 4, 0xffaa00, 0.8).setDepth(2001);
        this.scene.tweens.add({
            targets: impact,
            scale: 2,
            alpha: 0,
            duration: 200,
            onComplete: () => impact.destroy()
        });
    }

    createGroundHitEffect(x, y) {
        // Efeito no chão removido por solicitação do usuário.
        // A função permanece vazia para evitar erros de chamada em outros métodos.
    }

    createBurnTrail(startX, startY, endX, endY) {
        // Used by Beams to mark the ground
        this.createGroundHitEffect(endX, endY);
    }

    createExplosionEffect(x, y) {
        const flash = this.scene.add.circle(x, y, 15, 0xffff00, 1).setDepth(3001);
        this.scene.tweens.add({
            targets: flash,
            scale: 0,
            duration: 100,
            onComplete: () => flash.destroy()
        });

        const explosion = this.scene.add.circle(x, y, 10, 0xff4400, 1).setDepth(3000);
        this.scene.tweens.add({
            targets: explosion,
            scale: 4,
            alpha: 0,
            duration: 300,
            ease: 'Quad.out',
            onComplete: () => explosion.destroy()
        });
    }

    // --- FIRING METHODS --- 

    fire(params) {
        const { shootType, startX, startY, targetX, targetY, damage, isCritical, source, target, config, projectileGroup } = params;

        switch (shootType) {
            case 'projectile':
                if (projectileGroup) {
                    this.fireProjectile(projectileGroup, startX, startY, targetX, targetY, damage, isCritical, source, config);
                } else {
                    console.warn('ShotManager: projectileGroup não fornecido para shootType="projectile"');
                }
                break;
            case 'beam':
                this.fireBeam(startX, startY, targetX, targetY, damage, isCritical, source, target);
                break;
            case 'continuous_beam':
                this.fireContinuousBeam(source, target, config);
                break;
            case 'game_feel':
                this.fireGameFeelProjectile(startX, startY, targetX, targetY, damage, isCritical, source, config);
                break;
            case 'game_feel_rifle':
                this.fireGameFeelProjectile_rifle(startX, startY, targetX, targetY, damage, isCritical, source, config);
                break;    
            case 'flamethrower':
                this.fireFlamethrower(startX, startY, targetX, targetY, damage, isCritical, source, config);
                break;
            case 'raycast':
            default:
                this.fireRaycast(startX, startY, targetX, targetY, damage, isCritical, source, target, config);
                break;
        }
    }

    fireGameFeelProjectile(startX, startY, tx, ty, damage, isCritical, source, config = {}) {
        const angle = Phaser.Math.Angle.Between(startX, startY, tx, ty);

        this.scene.cameras.main.shake(25, 0.001);
        this.createMuzzleSparks(startX, startY, angle);

        if (!this.createMuzzleFlash(startX, startY, angle, config)) {
            // Default Flash
            const glow = this.scene.add.circle(startX, startY, 50, 0xffff66, 0.08).setDepth(2000);
            const core = this.scene.add.circle(startX, startY, 18, 0xffff00, 0.25).setDepth(2001);
            this.scene.tweens.add({
                targets: [glow, core],
                scale: { from: 0.5, to: 1.3 },
                alpha: { from: 1, to: 0 },
                duration: 90,
                ease: 'Quad.easeOut',
                onComplete: () => { glow.destroy(); core.destroy(); }
            });
        }

        const texture = config.projectileTexture || 'bullet_tracer';
        const proj = this.scene.add.sprite(startX, startY, texture);
        proj.setDepth(2000);

        const rotationOffset = config.projectileRotation !== undefined ? config.projectileRotation : 0;
        proj.setRotation(angle + rotationOffset);
        
        this.createProjectileLight(proj, config);

        if (config.projectileScale) {
             if (typeof config.projectileScale === 'number') {
                 proj.setScale(config.projectileScale);
             } else {
                 proj.setScale(config.projectileScale.x || 1, config.projectileScale.y || 1);
             }
        } else {
            proj.setScale(1.5, 0.6);
        }

        const speed = config.projectileSpeed || 1500;
        const dist = Phaser.Math.Distance.Between(startX, startY, tx, ty);
        const duration = (dist / speed) * 1000;

        this.createShellCasing(startX, startY);

        this.scene.tweens.add({
            targets: proj,
            x: tx,
            y: ty,
            duration: duration,
            onUpdate: () => {
                // Update light if attached (handled by createProjectileLight listener, but kept for safety)
            },
            onComplete: () => {
                this.createImpactEffect(tx, ty);
                this.createGroundHitEffect(tx, ty);
                
                if (this.scene.textures.exists('spark_particle')) {
                    const emitter = this.scene.add.particles(tx, ty, 'spark_particle', {
                        speed: { min: 50, max: 150 },
                        scale: { start: 1, end: 0 },
                        lifespan: 200,
                        quantity: 6,
                        emitting: false
                    });
                    emitter.explode();
                    this.scene.time.delayedCall(1000, () => emitter.destroy());
                }
                proj.destroy();
            }
        });

        // Instant damage for game feel shots
        // A lógica de dano foi movida para o GameManager.resolveOfflineShot()
        // para manter a consistência. Este método agora é puramente visual.
        if (this.scene.gameManager) {
            // O GameManager já lida com o dano, então não precisamos fazer nada aqui.
            // Apenas garantimos que o efeito visual aconteça.
        }
    }


    fireGameFeelProjectile_rifle(startX, startY, tx, ty, damage, isCritical, source, config = {}) {
        const angle = Phaser.Math.Angle.Between(startX, startY, tx, ty);

        this.scene.cameras.main.shake(25, 0.001);
        this.createMuzzleSparks(startX, startY, angle);

        if (!this.createMuzzleFlash(startX, startY, angle, config)) {
            // Default Flash
            const glow = this.scene.add.circle(startX, startY, 50, 0xffff66, 0.08).setDepth(2000);
            const core = this.scene.add.circle(startX, startY, 18, 0xffff00, 0.25).setDepth(2001);
            this.scene.tweens.add({
                targets: [glow, core],
                scale: { from: 0.5, to: 1.3 },
                alpha: { from: 1, to: 0 },
                duration: 90,
                ease: 'Quad.easeOut',
                onComplete: () => { glow.destroy(); core.destroy(); }
            });
        }

        const texture = config.projectileTexture || 'bullet_tracer_rifle';
        const proj = this.scene.add.sprite(startX, startY, texture);
        proj.setDepth(2000);

        const rotationOffset = config.projectileRotation !== undefined ? config.projectileRotation : 0;
        proj.setRotation(angle + rotationOffset);
        
        this.createProjectileLight(proj, config);

        if (config.projectileScale) {
             if (typeof config.projectileScale === 'number') {
                 proj.setScale(config.projectileScale);
             } else {
                 proj.setScale(config.projectileScale.x || 1, config.projectileScale.y || 1);
             }
        } else {
            proj.setScale(1.5, 0.6);
        }

        const speed = config.projectileSpeed || 1500;
        const dist = Phaser.Math.Distance.Between(startX, startY, tx, ty);
        const duration = (dist / speed) * 1000;

        this.createShellCasing(startX, startY);

        this.scene.tweens.add({
            targets: proj,
            x: tx,
            y: ty,
            duration: duration,
            onUpdate: () => {
                // Update light if attached (handled by createProjectileLight listener, but kept for safety)
            },
            onComplete: () => {
                this.createImpactEffect(tx, ty);
                this.createGroundHitEffect(tx, ty);
                
                if (this.scene.textures.exists('spark_particle')) {
                    const emitter = this.scene.add.particles(tx, ty, 'spark_particle', {
                        speed: { min: 50, max: 150 },
                        scale: { start: 1, end: 0 },
                        lifespan: 200,
                        quantity: 6,
                        emitting: false
                    });
                    emitter.explode();
                    this.scene.time.delayedCall(1000, () => emitter.destroy());
                }
                proj.destroy();
            }
        });

        // Instant damage for game feel shots
        // A lógica de dano foi movida para o GameManager.resolveOfflineShot()
        if (this.scene.gameManager) {
            // O GameManager já lida com o dano.
        }
    }

    fireProjectile(group, startX, startY, tx, ty, damage, isCritical, source, config = {}) {
        const texture = config.projectileTexture || 'bullet';
        const proj = group.create(startX, startY, this.scene.textures.exists(texture) ? texture : 'bullet');
        proj.damage = damage;
        proj.isCritical = isCritical;
        proj.source = source;

        const angle = Phaser.Math.Angle.Between(startX, startY, tx, ty);
        const rotationOffset = config.projectileRotation !== undefined ? config.projectileRotation : 0;
        proj.setRotation(angle + rotationOffset);

        if (config.projectileScale) {
            if (typeof config.projectileScale === 'number') proj.setScale(config.projectileScale);
            else proj.setScale(config.projectileScale.x || 1, config.projectileScale.y || 1);
        }

        this.createProjectileLight(proj, config);
        this.createMuzzleFlash(startX, startY, angle, config);
        this.createShellCasing(startX, startY);

        const speed = config.projectileSpeed || 500;
        this.scene.physics.moveTo(proj, tx, ty, speed);

        const dist = Phaser.Math.Distance.Between(startX, startY, tx, ty);
        const duration = (dist / speed) * 1000 + 1000;

        this.scene.time.delayedCall(duration, () => {
            if (proj.active) {
                this.createGroundHitEffect(proj.x, proj.y);
                proj.destroy();
            }
        });
    }

    fireRaycast(startX, startY, tx, ty, damage, isCritical, source, target, config = {}) {
        const angle = Phaser.Math.Angle.Between(startX, startY, tx, ty);
        const totalDist = Phaser.Math.Distance.Between(startX, startY, tx, ty);
        const step = 20;
        const repeatCount = Math.floor(totalDist / step);
        let currentDist = 0;

        const tracerGraphics = this.scene.add.graphics().setDepth(2000);
        const tracerDelay = Phaser.Math.Between(2, 8);

        const timer = this.scene.time.addEvent({
            delay: tracerDelay,
            repeat: repeatCount,
            callback: () => {
                if (!tracerGraphics.active) { timer.remove(); return; }
                tracerGraphics.clear();
                const x1 = startX + Math.cos(angle) * currentDist;
                const y1 = startY + Math.sin(angle) * currentDist;
                const x2 = startX + Math.cos(angle) * (currentDist + step);
                const y2 = startY + Math.sin(angle) * (currentDist + step);
                
                const color = isCritical ? 0xffff00 : 0xff0000;
                tracerGraphics.lineStyle(2, color, 1);
                tracerGraphics.lineBetween(x1, y1, x2, y2);
                currentDist += step;
            }
        });

        this.scene.time.delayedCall((tracerDelay * (repeatCount + 1)) + 50, () => {
            if (tracerGraphics.active) tracerGraphics.destroy();
        });

        this.createMuzzleFlash(startX, startY, angle, config);
        this.createShellCasing(startX, startY);
        this.createImpactEffect(tx, ty);

        if (target && target.takeDamage) {
            target.takeDamage(damage, source, isCritical);
        } else {
            this.createGroundHitEffect(tx, ty);
        }
    }

    fireBeam(startX, startY, tx, ty, damage, isCritical, source, target) {
        const chargeDuration = 300;
        const charge = this.scene.add.circle(startX, startY, 5, 0x00ffff, 0.5).setDepth(2001);

        this.scene.tweens.add({
            targets: charge,
            scale: 4,
            alpha: 1,
            duration: chargeDuration,
            onComplete: () => {
                charge.destroy();
                
                if (source.isDead || !source.active) return;

                if (target && target.takeDamage) {
                    target.takeDamage(damage, source, isCritical);
                } else {
                    this.createGroundHitEffect(tx, ty);
                }
                
                this.createBurnTrail(startX, startY, tx, ty);

                const graphics = this.scene.add.graphics().setDepth(2000);
                this.scene.tweens.addCounter({
                    from: 0, to: 1, duration: 200,
                    onUpdate: () => {
                        if (!graphics.scene) return;
                        graphics.clear();
                        const colors = [0xff4500, 0xff0000, 0xffffff, 0x00ffff];
                        const dist = Phaser.Math.Distance.Between(startX, startY, tx, ty);
                        const angle = Phaser.Math.Angle.Between(startX, startY, tx, ty);
                        const segments = Math.floor(dist / 20);

                        colors.forEach((color, i) => {
                            graphics.lineStyle(2 + (i % 2), color, 0.7);
                            graphics.beginPath();
                            graphics.moveTo(startX, startY);
                            for (let j = 1; j < segments; j++) {
                                const ratio = j / segments;
                                const px = startX + (tx - startX) * ratio;
                                const py = startY + (ty - startY) * ratio;
                                const jitter = Phaser.Math.Between(-10, 10);
                                const envelope = Math.sin(ratio * Math.PI);
                                const offset = jitter * envelope;
                                const perpAngle = angle + Math.PI / 2;
                                graphics.lineTo(px + Math.cos(perpAngle) * offset, py + Math.sin(perpAngle) * offset);
                            }
                            graphics.lineTo(tx, ty);
                            graphics.strokePath();
                        });
                    },
                    onComplete: () => { if (graphics.scene) graphics.destroy(); }
                });
            }
        });
    }

    fireContinuousBeam(source, target, config = {}) {
        const duration = source.laserDuration || 2000;
        const color = source.laserColor || 0xff0000;
        const thickness = source.laserThickness || 4;
        const damage = source.damage || 1;

        const graphics = this.scene.add.graphics().setDepth(2000);
        let elapsed = 0;
        const tickRate = 100;
        let lastTick = 0;

        const event = this.scene.time.addEvent({
            delay: 16,
            loop: true,
            callback: () => {
                elapsed += 16;
                if (elapsed >= duration || !source.active || source.isDead || !target.active || target.health <= 0) {
                    graphics.destroy();
                    event.remove();
                    return;
                }

                const sx = source.x + (source.beamOffsetX || 0);
                const sy = source.y + (source.beamOffsetY || 0);
                const tx = target.x;
                const ty = target.y;

                graphics.clear();
                const alpha = 0.6 + Math.sin(elapsed * 0.01) * 0.4;
                graphics.lineStyle(thickness * 3, color, alpha * 0.4);
                graphics.lineBetween(sx, sy, tx, ty);
                graphics.lineStyle(thickness, 0xffffff, 1);
                graphics.lineBetween(sx, sy, tx, ty);

                if (elapsed - lastTick >= tickRate) {
                    lastTick = elapsed;
                    const totalTicks = duration / tickRate;
                    const damagePerTick = Math.max(1, Math.floor(damage / totalTicks));
                    if (target.takeDamage) {
                        target.takeDamage(damagePerTick, source);
                        const angle = Phaser.Math.Angle.Between(sx, sy, tx, ty);
                        this.createMuzzleSparks(tx, ty, angle + Math.PI);
                    }
                }
            }
        });
    }

    fireFlamethrower(startX, startY, tx, ty, damage, isCritical, source, config = {}) {
        const angle = Phaser.Math.Angle.Between(startX, startY, tx, ty);
        const range = config.range || 250;
        const coneAngle = 0.6; 

        if (!this.scene.textures.exists('fire_particle')) return;

        const avgSpeed = 250;
        const lifespan = (range / avgSpeed) * 1000;

        const emitter = this.scene.add.particles(startX, startY, 'fire_particle', {
            speed: { min: 150, max: 350 },
            angle: { min: Phaser.Math.RadToDeg(angle) - 15, max: Phaser.Math.RadToDeg(angle) + 15 },
            scale: { start: 1, end: 0 },
            lifespan: lifespan,
            quantity: 24,
            blendMode: 'ADD',
            emitting: false
        });
        emitter.setDepth(2002);
        emitter.explode();
        this.scene.time.delayedCall(lifespan + 200, () => emitter.destroy());

        if (this.scene.npcManager && this.scene.npcManager.npcs) {
            this.scene.npcManager.npcs.forEach(npc => {
                if (!npc.active || npc.isDead) return;
                const dist = Phaser.Math.Distance.Between(startX, startY, npc.x, npc.y);
                if (dist <= range) {
                    const angleToNpc = Phaser.Math.Angle.Between(startX, startY, npc.x, npc.y);
                    const diff = Phaser.Math.Angle.Wrap(angleToNpc - angle);
                    if (Math.abs(diff) < coneAngle / 2) {
                        this.scene.npcManager.takeDamage(npc, damage, source, isCritical);
                        this.scene.npcManager.applyBurn(npc, config.burnDamage || 5, config.burnDuration || 3000, source);
                    }
                }
            });
        }
    }
}