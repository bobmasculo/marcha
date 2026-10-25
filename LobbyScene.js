import { MISSIONS, getMission } from './progression.js';

// Paleta do lobby
const COLOR = {
    bgTop: 0x03050f,
    bgBottom: 0x0b2146,
    accent: 0x00e5ff,
    accentCss: '#00e5ff',
    neon: '#ff2fd6',
    panel: 0x08162f,
    go: 0x12b34a,
    goHover: 0x1ee061
};

const FONT = 'Arial, sans-serif';
const FONT_TITLE = '"Arial Black", Arial, sans-serif';

const CREDITS_TEXT = [
    "Music: Lines of Code",
    "Author: Trevor Lentz",
    "License: CC-BY 3.0",
    "URL: https://opengameart.org/content/lines-of-code",
    "--------------------------------------------------",
    "SFX: RPG Sound Pack (Shoot/Hit/Impact)",
    "Author: leohpaz",
    "License: CC-BY 4.0",
    "URL: https://opengameart.org/content/rpg-sound-pack",
    "--------------------------------------------------",
    "LPC Shadow",
    "Author: Dr. Jamgo",
    "License: CC0 (Public Domain)",
    "URL: https://opengameart.org/content/shadow-for-lpc-sprite",
    "--------------------------------------------------",
    "LPC Human Body, Head, Eyes & Ears",
    "Authors: Stephen Challener (Redshrike), Johannes Sjölund (wulax),",
    "Matthew Krohn (makrohn), pflat",
    "License: CC-BY-SA 3.0 / GPL 3.0",
    "URLs: https://opengameart.org/content/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles",
    "--------------------------------------------------",
    "LPC Pants and Formal Shirts",
    "Authors: bluecarrot16, JaidynReiman, Joe White,",
    "Matthew Krohn (makrohn), Johannes Sjölund (wulax),",
    "Thane Brimhall (pennomi), laetissima, pflat",
    "License: CC-BY-SA 3.0 / GPL 3.0",
    "URLs: https://opengameart.org/content/lpc-gentleman",
    "https://opengameart.org/content/lpc-medieval-fantasy-character-sprites",
    "--------------------------------------------------",
    "LPC Long Boots (shoes)",
    "Authors: bluecarrot16, Nila122",
    "License: CC-BY-SA 3.0 / GPL 3.0",
    "URL: https://opengameart.org/content/lpc-clothes-and-hair",
    "--------------------------------------------------",
    "LPC Nose and Expressions",
    "Authors: Thane Brimhall (pennomi), Matthew Krohn (makrohn),",
    "Stephen Challener (Redshrike), Johannes Sjölund (wulax)",
    "License: CC-BY-SA 3.0 / GPL 3.0",
    "URL: https://opengameart.org/content/lpc-base-character-expressions",
    "--------------------------------------------------",
    "LPC Crossbow & Bolts",
    "Authors: Dr. Jamgo, pflat, Michael Whitlock (bigbeargames),",
    "Matthew Krohn (makrohn), Johannes Sjölund (wulax),",
    "Benjamin K. Smith (BenCreating), Sander Frenken (castelonia),",
    "Nila122, Eliza Wyatt (ElizaWy), Joe White",
    "License: CC0 & CC-BY-SA 3.0",
    "URL: https://opengameart.org/content/lpc-crossbow-final",
    "--------------------------------------------------",
    "'Thick' Male Revised Run/Climb",
    "Author: JaidynReiman (based on ElizaWy's LPC Revised)",
    "License: CC-BY-SA 3.0 / GPL 3.0",
    "URL: https://opengameart.org/content/thick-male-revised-runclimb",
    "--------------------------------------------------",
    "Tree Variations (Jetrel's Wood Tileset)",
    "Author: Bertram",
    "License: CC-BY 3.0 / GPL 2.0",
    "URL: https://opengameart.org/content/tree-variations-from-jetrels-wood-tileset",
    "--------------------------------------------------",
    "Lasers and Beams",
    "Author: Rawdanitsu",
    "License: CC-BY 3.0",
    "URL: https://opengameart.org/content/lasers-and-beams",
    "--------------------------------------------------",
    "LPC Plant Repack",
    "Author: William.Thompsonj",
    "License: CC-BY-SA 3.0 / GPL 3.0",
    "URL: https://opengameart.org/content/lpc-plant-repack",
    "--------------------------------------------------",
    "Happyland Tileset",
    "Author: Buch",
    "License: CC0 (Public Domain)",
    "URL: https://opengameart.org/content/happyland-tileset",
    "--------------------------------------------------",
    "LPC Sci-Fi Sprite Pack",
    "Authors: Skorpios, Casper Nilsson, Nila122, bluecarrot16",
    "License: CC-BY-SA 3.0 / GPL 3.0",
    "URL: https://opengameart.org/content/lpc-skorpios-scifi-sprite-pack",
    "--------------------------------------------------",
    "LPC Misc Tile Atlas (Trees, Furniture, Bridges)",
    "Authors: Lanea Zimmerman (Sharm), Stephen Challener (Redshrike),",
    "Charles Gabriel, Manuel Teira, bluecarrot16",
    "License: CC-BY-SA 3.0 / GPL 3.0",
    "URL: https://opengameart.org/content/lpc-misc-tile-atlas-interior-exterior-trees-bridges-furniture",
    "--------------------------------------------------",
    "Item icons (medkit, grenade, adrenaline)",
    "Author: War UFO team (original pixel art)",
    "License: CC0 (Public Domain)",
    "--------------------------------------------------",
    "Total Asset Licenses: CC0, CC-BY 3.0, CC-BY 4.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0",
    "",
    "Thank you to the OpenGameArt community!"
];

const GUIDE_LINES = [
    'Clique esquerdo: mover / atirar no alien',
    'Botão direito ou Espaço: atirar',
    'Setas ou arrastar: câmera    + / -: zoom',
    '1 a 4: usar itens    P: upgrades',
    'Minere, recrute e cumpra o objetivo'
];

const LORE = '"Em um futuro superaquecido, aliens, capitalistas e comunistas lutam para manter o mundo numa primavera eterna."';

/**
 * @class LobbyScene
 * @description Tela inicial: escolha da missão e início do jogo.
 * Layout em coluna única centrada: título, citação, cartão da missão, botão de iniciar.
 * Guia de controles no canto inferior esquerdo e créditos no direito.
 */
export default class LobbyScene extends Phaser.Scene {
    constructor() {
        super('LobbyScene');
    }

    init(data) {
        this.currentMission = data && data.missionNumber ? data.missionNumber : 1;
        this.starting = false;
    }

    preload() {
        // Colagem com o mapa-múndi; só o recorte do mapa é usado no cartão da missão
        this.load.image('ufo', 'assets/cidade/map.png');
    }

    create() {
        this.W = this.scale.width;
        this.H = this.scale.height;
        this.cx = this.W / 2;

        this.createBackground();
        this.createTitle();
        this.createMissionCard();
        this.createStartButton();
        this.createGuide();
        this.createCreditsButton();

        this.add.text(this.cx, this.H - 14, 'Bob Games', {
            fontSize: '12px', fill: '#5d7a99', fontFamily: FONT
        }).setOrigin(0.5);

        this.renderMission();
        this.setupKeys();
    }

    update(time, delta) {
        // Estrelas à deriva, devagar, voltando pela esquerda
        const dx = delta / 1000;
        this.stars.forEach(star => {
            star.obj.x -= star.speed * dx;
            if (star.obj.x < -4) star.obj.x = this.W + 4;
        });
    }

    // ------------------------------------------------------------------ fundo
    createBackground() {
        const bg = this.add.graphics();
        bg.fillGradientStyle(COLOR.bgTop, COLOR.bgTop, COLOR.bgBottom, COLOR.bgBottom, 1);
        bg.fillRect(0, 0, this.W, this.H);

        // Planeta no horizonte, só a calota de cima aparece
        const planet = this.add.graphics();
        planet.fillStyle(0x0b3a6b, 0.35);
        planet.fillCircle(this.cx, this.H + 520, 760);
        planet.lineStyle(3, COLOR.accent, 0.35);
        planet.strokeCircle(this.cx, this.H + 520, 760);

        this.stars = [];
        for (let i = 0; i < 120; i++) {
            const size = Phaser.Math.FloatBetween(0.5, 1.8);
            const obj = this.add.circle(
                Phaser.Math.Between(0, this.W), Phaser.Math.Between(0, this.H),
                size, 0xffffff, Phaser.Math.FloatBetween(0.3, 1)
            );
            this.stars.push({ obj, speed: size * 4 });
            this.tweens.add({
                targets: obj, alpha: 0.15, duration: Phaser.Math.Between(1200, 3200),
                ease: 'Sine.easeInOut', yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2000)
            });
        }
    }

    // ----------------------------------------------------------------- título
    createTitle() {
        const title = this.add.text(this.cx, 96, 'WAR UFO', {
            fontSize: '76px', fontFamily: FONT_TITLE, fill: '#e8fbff',
            stroke: COLOR.neon, strokeThickness: 6,
            padding: { x: 24, y: 16 }, // folga para o brilho não ser cortado
            shadow: { offsetX: 0, offsetY: 0, color: COLOR.neon, blur: 18, stroke: true, fill: true }
        }).setOrigin(0.5);

        // Flutua pouco: 6 px para cada lado
        this.tweens.add({
            targets: title, y: title.y + 6, duration: 2400,
            ease: 'Sine.easeInOut', yoyo: true, repeat: -1
        });

        this.add.text(this.cx, 156, 'RTS  ·  ALPHA 0.35  ·  BUILD 25-10', {
            fontSize: '15px', fontFamily: FONT, fill: COLOR.accentCss
        }).setOrigin(0.5).setAlpha(0.85);

        this.add.text(this.cx, 204, LORE, {
            fontSize: '15px', fontFamily: FONT, fontStyle: 'italic', fill: '#b9c8da',
            align: 'center', wordWrap: { width: 640 }
        }).setOrigin(0.5);
    }

    // ------------------------------------------------------------- cartão da missão
    createMissionCard() {
        const w = 560;
        const h = 250;
        const y = 410;
        this.card = { w, h, y };

        // Recorte do mapa-múndi dentro da colagem map.png, escurecido para dar leitura ao texto
        const tex = this.textures.get('ufo');
        if (!tex.has('mapa')) tex.add('mapa', 0, 416, 229, 416, 192);
        this.add.image(this.cx, y, 'ufo', 'mapa').setDisplaySize(w, h).setAlpha(0.35);

        const panel = this.add.graphics();
        panel.fillStyle(COLOR.panel, 0.7);
        panel.fillRect(this.cx - w / 2, y - h / 2, w, h);
        panel.lineStyle(2, COLOR.accent, 0.8);
        panel.strokeRect(this.cx - w / 2, y - h / 2, w, h);

        this.missionLabel = this.add.text(this.cx, y - 98, '', {
            fontSize: '14px', fontFamily: FONT, fontStyle: 'bold', fill: COLOR.accentCss
        }).setOrigin(0.5);

        this.missionName = this.add.text(this.cx, y - 62, '', {
            fontSize: '34px', fontFamily: FONT_TITLE, fill: '#ffffff',
            stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5);

        this.missionBriefing = this.add.text(this.cx, y - 18, '', {
            fontSize: '16px', fontFamily: FONT, fontStyle: 'italic', fill: '#dfe9f5',
            align: 'center', wordWrap: { width: w - 120 }
        }).setOrigin(0.5);

        const divider = this.add.graphics();
        divider.lineStyle(1, COLOR.accent, 0.4);
        divider.lineBetween(this.cx - 200, y + 24, this.cx + 200, y + 24);

        this.missionObjective = this.add.text(this.cx, y + 52, '', {
            fontSize: '17px', fontFamily: FONT, fontStyle: 'bold', fill: '#58f08a'
        }).setOrigin(0.5);

        this.missionDetails = this.add.text(this.cx, y + 86, '', {
            fontSize: '13px', fontFamily: FONT, fill: '#9fb3c8'
        }).setOrigin(0.5);

        // Setas para escolher a missão (também com as teclas esquerda e direita)
        this.arrowPrev = this.createArrow(this.cx - w / 2 - 36, y, '◀', -1);
        this.arrowNext = this.createArrow(this.cx + w / 2 + 36, y, '▶', 1);
    }

    createArrow(x, y, symbol, step) {
        const arrow = this.add.text(x, y, symbol, {
            fontSize: '34px', fontFamily: FONT, fill: COLOR.accentCss
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        arrow.on('pointerover', () => arrow.setScale(1.2));
        arrow.on('pointerout', () => arrow.setScale(1));
        arrow.on('pointerdown', () => this.changeMission(step));
        return arrow;
    }

    changeMission(step) {
        const next = Phaser.Math.Clamp(this.currentMission + step, 1, MISSIONS.length);
        if (next === this.currentMission) return;
        this.currentMission = next;
        this.renderMission();
    }

    objectiveText(objective) {
        if (objective.type === 'eliminate') return `Objetivo: eliminar ${objective.goal} aliens`;
        if (objective.type === 'mine') return `Objetivo: minerar $${objective.goal}`;
        return 'Objetivo: transmitir a mensagem até 100%';
    }

    /** Preenche o cartão com a missão escolhida e liga/desliga as setas nas pontas. */
    renderMission() {
        const mission = getMission(this.currentMission);
        this.missionLabel.setText(`MISSÃO ${this.currentMission} DE ${MISSIONS.length}`);
        this.missionName.setText(mission.name.toUpperCase());
        this.missionBriefing.setText(mission.briefing);
        this.missionObjective.setText(this.objectiveText(mission.objective));
        this.missionDetails.setText(`Aliens: ${mission.npcCount}   ·   Minério: ${mission.ores}   ·   Moedas iniciais: $${mission.startCoins}`);
        this.arrowPrev.setAlpha(this.currentMission > 1 ? 1 : 0.2);
        this.arrowNext.setAlpha(this.currentMission < MISSIONS.length ? 1 : 0.2);
    }

    // ------------------------------------------------------------------ iniciar
    createStartButton() {
        const btn = this.add.container(this.cx, 590);
        const bg = this.add.rectangle(0, 0, 320, 64, COLOR.go).setStrokeStyle(3, 0xffffff);
        const label = this.add.text(0, 0, 'INICIAR MISSÃO', {
            fontSize: '26px', fontFamily: FONT_TITLE, fill: '#ffffff'
        }).setOrigin(0.5);
        btn.add([bg, label]);
        btn.setSize(320, 64).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.startGame())
            .on('pointerover', () => bg.setFillStyle(COLOR.goHover))
            .on('pointerout', () => bg.setFillStyle(COLOR.go));

        this.tweens.add({
            targets: btn, scale: 1.03, duration: 900,
            ease: 'Sine.easeInOut', yoyo: true, repeat: -1
        });

        this.add.text(this.cx, 640, 'ou pressione ENTER', {
            fontSize: '12px', fontFamily: FONT, fill: '#7f95ad'
        }).setOrigin(0.5);
    }

    startGame() {
        if (this.starting) return;
        this.starting = true;
        if (GAME_CONFIG.START_FULLSCREEN && !this.scale.isFullscreen) {
            this.scale.startFullscreen();
        }
        this.scene.start('GameScene', { offline: true, team: 'blue', missionNumber: this.currentMission });
    }

    setupKeys() {
        const kb = this.input.keyboard;
        kb.on('keydown-ENTER', () => this.startGame());
        kb.on('keydown-LEFT', () => this.changeMission(-1));
        kb.on('keydown-RIGHT', () => this.changeMission(1));
    }

    // ------------------------------------------------------------ guia e créditos
    createGuide() {
        const x = 24;
        const w = 360;
        const h = 146;
        const y = this.H - h - 28;

        const panel = this.add.graphics();
        panel.fillStyle(0x000000, 0.55);
        panel.fillRect(x, y, w, h);
        panel.lineStyle(1, COLOR.accent, 0.5);
        panel.strokeRect(x, y, w, h);

        this.add.text(x + 16, y + 12, 'COMO JOGAR', {
            fontSize: '14px', fontFamily: FONT, fontStyle: 'bold', fill: COLOR.accentCss
        });
        this.add.text(x + 16, y + 38, GUIDE_LINES.map(line => `•  ${line}`).join('\n'), {
            fontSize: '13px', fontFamily: FONT, fill: '#ffffff', lineSpacing: 7
        });
    }

    createCreditsButton() {
        const w = 150;
        const h = 40;
        const btn = this.add.container(this.W - 24 - w / 2, this.H - 28 - h / 2);
        const bg = this.add.rectangle(0, 0, w, h, 0x1c2a3d, 0.9).setStrokeStyle(1, 0x8aa0b8);
        const label = this.add.text(0, 0, 'CRÉDITOS', {
            fontSize: '15px', fontFamily: FONT, fill: '#ffffff'
        }).setOrigin(0.5);
        btn.add([bg, label]);
        btn.setSize(w, h).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.showCredits())
            .on('pointerover', () => bg.setStrokeStyle(2, 0xffff00))
            .on('pointerout', () => bg.setStrokeStyle(1, 0x8aa0b8));
    }

    /**
     * Exibe o painel de créditos com as informações das assets
     */
    showCredits() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Overlay escuro para foco
        const overlay = this.add.rectangle(centerX, centerY, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.8)
            .setInteractive().setDepth(100); // Bloqueia cliques no fundo

        const panel = this.add.container(centerX, centerY).setDepth(101);
        const panelWidth = 700;
        const panelHeight = 500;
        const bg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x111111).setStrokeStyle(3, 0x00ffff);

        const title = this.add.text(0, -panelHeight / 2 + 35, 'CRÉDITOS DOS ASSETS', {
            fontSize: '24px', fill: '#00ffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        const topLimit = -panelHeight / 2 + 80;
        const content = this.add.text(0, topLimit, CREDITS_TEXT.join('\n'), {
            fontSize: '14px',
            fill: '#cccccc',
            align: 'center',
            lineSpacing: 8,
            wordWrap: { width: panelWidth - 100 }
        }).setOrigin(0.5, 0);

        // --- SISTEMA DE SCROLL (MÁSCARA E INTERAÇÃO) ---
        // 1. Define a área visível (Viewport)
        const viewHeight = panelHeight - 180;
        const maskGraphics = this.make.graphics();
        maskGraphics.fillStyle(0xffffff);
        // A máscara limita o que aparece entre o título e o botão de fechar
        maskGraphics.fillRect(centerX - (panelWidth / 2), centerY - (panelHeight / 2) + 75, panelWidth, viewHeight);
        const mask = maskGraphics.createGeometryMask();
        content.setMask(mask);

        // 2. Define os limites do Scroll (relativos ao centro do painel)
        const bottomLimit = topLimit - Math.max(0, content.height - viewHeight);

        // --- SISTEMA DE BARRA DE ROLAGEM VISUAL ---
        const scrollbarX = panelWidth / 2 - 20;
        const scrollbarTrack = this.add.graphics();
        scrollbarTrack.fillStyle(0x333333, 0.5);
        scrollbarTrack.fillRoundedRect(scrollbarX, topLimit, 6, viewHeight, 3);

        const scrollbarHandle = this.add.graphics();

        const updateScrollbar = () => {
            const contentHeight = content.height;
            if (contentHeight <= viewHeight) {
                scrollbarTrack.setVisible(false);
                scrollbarHandle.setVisible(false);
                return;
            }

            const scrollRange = topLimit - bottomLimit;
            const scrollProgress = Phaser.Math.Clamp((topLimit - content.y) / scrollRange, 0, 1);

            // Altura da barra proporcional ao conteúdo visível
            const handleHeight = Math.max(30, (viewHeight / contentHeight) * viewHeight);
            const availableSpace = viewHeight - handleHeight;

            scrollbarHandle.clear();
            scrollbarHandle.fillStyle(0x00ffff, 1);
            scrollbarHandle.fillRoundedRect(scrollbarX, topLimit + (scrollProgress * availableSpace), 6, handleHeight, 3);
        };

        updateScrollbar();

        // 3. Interação com a Roda do Mouse
        overlay.on('wheel', (pointer, deltaX, deltaY) => {
            // Move o texto e trava nos limites
            content.y = Phaser.Math.Clamp(content.y - (deltaY * 0.8), bottomLimit, topLimit);
            updateScrollbar();
        });

        // 4. Interação com Drag (Arrastar com o mouse/dedo)
        let isDragging = false;
        let startY = 0;
        let textStartY = 0;

        overlay.on('pointerdown', (pointer) => {
            isDragging = true;
            startY = pointer.y;
            textStartY = content.y;
        });

        const onPointerMove = (pointer) => {
            if (!isDragging) return;
            const diff = pointer.y - startY;
            content.y = Phaser.Math.Clamp(textStartY + diff, bottomLimit, topLimit);
            updateScrollbar();
        };

        const onPointerUp = () => {
            isDragging = false;
        };

        this.input.on('pointermove', onPointerMove);
        this.input.on('pointerup', onPointerUp);

        // Botão Fechar
        const closeBtn = this.add.container(0, panelHeight / 2 - 40);
        const closeBg = this.add.rectangle(0, 0, 120, 35, 0xcc0000).setStrokeStyle(1, 0xffffff);
        const closeTxt = this.add.text(0, 0, 'FECHAR', { fontSize: '16px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        closeBtn.add([closeBg, closeTxt]);

        closeBtn.setSize(120, 35).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // Limpa os listeners globais ao fechar
                this.input.off('pointermove', onPointerMove);
                this.input.off('pointerup', onPointerUp);
                maskGraphics.destroy();
                overlay.destroy();
                panel.destroy();
            });

        panel.add([bg, title, content, scrollbarTrack, scrollbarHandle, closeBtn]);

        // Efeito de entrada
        panel.setScale(0.5);
        panel.alpha = 0;
        this.tweens.add({
            targets: panel,
            scale: 1,
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
    }
}
