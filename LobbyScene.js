import { getMission } from './progression.js';

/**
 * @class LobbyScene
 * @description Gerencia a interface e a lógica da sala de espera do jogo.
 */
export default class LobbyScene extends Phaser.Scene {
    constructor() {
        super('LobbyScene');
    }

    init(data) {
        this.currentMission = data && data.missionNumber ? data.missionNumber : 1;
    }

    preload() {
        // Carregar assets para o lobby embelezado
        this.load.image('ufo', 'assets/cidade/map.png');
    }

    create() {
        console.log("Initializing Offline Lobby...");

        // --- IMAGEM DE FUNDO ---
        const bg = this.add.image(0, 0, 'ufo').setOrigin(0, 0).setDepth(-1);

        const resizeBackground = () => {
            bg.displayWidth = this.scale.width;
            bg.displayHeight = this.scale.height;
        };

        resizeBackground();
        this.scale.on('resize', resizeBackground, this);

        // Adicionar estrelas animadas no fundo
        this.createStarfield();

        // --- CABEÇALHO COM BRANDING ---
        // Container principal para o header
        const headerContainer = this.add.container(this.cameras.main.width / 2, 80);

        // Nome do jogo com estilo futurista
        const gameTitle = this.add.text(0, 0, 'WAR UFO', {
            fontSize: '44px',
            fill: 'rgb(27, 45, 45)',
            fontFamily: 'Arial Black, sans-serif',
            stroke: '#ff00ff',
            strokeThickness: 3,
            shadow: {
                offsetX: 3,
                offsetY: 3,
                color: '#ff00ff',
                blur: 8,
                stroke: true,
                fill: true
            }
        }).setOrigin(0.5);

        // Logo da Bob Games (se a imagem existir)
        let bobLogo = null;
        try {
            // bobLogo = this.add.image(0, 50, 'bob-logo');
            // bobLogo.setScale(0.3);
            // bobLogo.setOrigin(0.5);
        } catch (e) {
            // Se não encontrar a imagem, usa texto
            const companyText = this.add.text(0, 50, 'Bob Games', {
                fontSize: '24px',
                fill: '#ffaa00',
                fontFamily: 'Arial, sans-serif',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);
            headerContainer.add(companyText);
        }

        // Subtítulo do lobby
        const lobbySubtitle = this.add.text(0, 100, 'Alpha 0.35 · build 25-10', {
            fontSize: '28px',
            fill: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            stroke: '#00ffff',
            strokeThickness: 1
        }).setOrigin(0.5);

        // INDICADOR DE MISSÃO ATUAL
        const missionText = this.add.text(0, 150, `MISSION ${this.currentMission}: ${getMission(this.currentMission).name.toUpperCase()}`, {
            fontSize: '22px',
            fill: '#00ff00',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        // Frase de lore/contexto do jogo (Posicionada fora do container para ficar estática)
        const loreText = this.add.text(this.cameras.main.width / 2, 245, '"In an overheated future, aliens, capitalists, and communists are fighting to keep the world in an eternal spring."', {
            fontSize: '18px',
            fill: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'italic',
            stroke: '#000000',
            strokeThickness: 2,
            align: 'center',
            wordWrap: { width: 550 }
        }).setOrigin(0.5);

        headerContainer.add([gameTitle, lobbySubtitle, missionText]);
        if (bobLogo) headerContainer.add(bobLogo);

        // Animação de flutuação para o header
        this.tweens.add({
            targets: headerContainer,
            y: 400,
            duration: 2000,
            ease: 'Sine.easeInOut',
            yoyo: true,
            repeat: -1
        });

        // --- SELEÇÃO DE TIME ---
        const centerX = this.cameras.main.width / 2;
        const startY = this.cameras.main.height / 2;

        // Botão Único de START para RTS
        const btnStart = this.add.container(centerX, startY + 200);
        const bgStart = this.add.rectangle(0, 0, 300, 70, 0x00cc00).setStrokeStyle(3, 0xffffff);
        const txtStart = this.add.text(0, 0, 'START MISSION', { fontSize: '28px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        btnStart.add([bgStart, txtStart]);

        btnStart.setSize(300, 70).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (GAME_CONFIG.START_FULLSCREEN && !this.scale.isFullscreen) {
                    this.scale.startFullscreen();
                }
                this.scene.start('GameScene', { offline: true, team: 'blue', missionNumber: this.currentMission });
            })
            .on('pointerover', () => bgStart.setFillStyle(0x00ff00))
            .on('pointerout', () => bgStart.setFillStyle(0x00cc00));

        // --- BOTÃO DE CRÉDITOS ---
        const btnCredits = this.add.container(centerX, this.cameras.main.height - 60);
        const bgCredits = this.add.rectangle(0, 0, 180, 40, 0x333333, 0.8).setStrokeStyle(1, 0xaaaaaa);
        const txtCredits = this.add.text(0, 0, '📜 CREDITS', { fontSize: '16px', fill: '#ffffff' }).setOrigin(0.5);
        btnCredits.add([bgCredits, txtCredits]);

        btnCredits.setSize(180, 40).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.showCredits())
            .on('pointerover', () => bgCredits.setStrokeStyle(2, 0xffff00))
            .on('pointerout', () => bgCredits.setStrokeStyle(1, 0xaaaaaa));

        // --- QUICK INSTRUCTIONS (Bottom Left) ---
        const instrContainer = this.add.container(20, this.cameras.main.height - 150);
        const instrBg = this.add.rectangle(0, 0, 320, 130, 0x000000, 0.6)
            .setOrigin(0)
            .setStrokeStyle(1, 0x00ffff, 0.5);

        const instrTitle = this.add.text(15, 12, "COMMANDER'S GUIDE", {
            fontSize: '16px', fill: '#00ffff', fontStyle: 'bold', fontFamily: 'Arial'
        });

        const instrBody = this.add.text(15, 40,
            "• Inspired by the 1992 UFO classic\n" +
            "• ARROWS: Navigate the battlefield\n" +
            "• UI BUTTONS: Toggle Move/Shoot modes\n" +
            "• LEFT CLICK: Select and execute actions",
            { fontSize: '13px', fill: '#ffffff', lineSpacing: 6, fontFamily: 'Arial' }
        );

        instrContainer.add([instrBg, instrTitle, instrBody]);
    }

    /**
     * Exibe o painel de créditos com as informações das assets
     */
    showCredits() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Overlay escuro para foco
        const overlay = this.add.rectangle(centerX, centerY, this.cameras.main.width, this.cameras.main.height, 0x000000, 0.8)
            .setInteractive(); // Bloqueia cliques no fundo

        const panel = this.add.container(centerX, centerY);
        const panelWidth = 700;
        const panelHeight = 500;
        const bg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x111111).setStrokeStyle(3, 0x00ffff);

        const title = this.add.text(0, -panelHeight / 2 + 35, 'GAME ASSETS CREDITS', {
            fontSize: '24px', fill: '#00ffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        const creditsText = [
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
            "Total Asset Licenses: CC0, CC-BY 3.0, CC-BY 4.0, CC-BY-SA 3.0, GPL 2.0, GPL 3.0",
            "",
            "Thank you to the OpenGameArt community!"
        ];

        const topLimit = -panelHeight / 2 + 80;
        const content = this.add.text(0, topLimit, creditsText.join('\n'), {
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
        const closeTxt = this.add.text(0, 0, 'CLOSE', { fontSize: '16px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
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

    /**
     * Cria um campo de estrelas animadas no fundo para dar atmosfera espacial
     */
    createStarfield() {
        const stars = [];
        const numStars = 100;

        for (let i = 0; i < numStars; i++) {
            const x = Phaser.Math.Between(0, this.cameras.main.width);
            const y = Phaser.Math.Between(0, this.cameras.main.height);
            const size = Phaser.Math.FloatBetween(0.5, 2);
            const brightness = Phaser.Math.FloatBetween(0.3, 1);

            const star = this.add.circle(x, y, size, 0xffffff, brightness);
            stars.push(star);

            // Animação de pulsar para cada estrela
            this.tweens.add({
                targets: star,
                alpha: 0.2,
                duration: Phaser.Math.Between(1000, 3000),
                ease: 'Sine.easeInOut',
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 2000)
            });
        }

        return stars;
    }
}
