export default class Minimap {
    /**
     * @param {Phaser.Scene} scene A cena para adicionar o minimapa.
     * @param {number} x A posição x do minimapa.
     * @param {number} y A posição y do minimapa.
     * @param {number} width A largura do minimapa.
     * @param {number} height A altura do minimapa.
     * @param {object} mapData Dados sobre o mapa principal.
     * @param {number} mapData.worldWidth A largura do mundo do jogo.
     * @param {number} mapData.worldHeight A altura do mundo do jogo.
     */
    constructor(scene, x, y, width, height, mapData) {
        this.scene = scene;
        this.width = width;
        this.height = height;
        this.mapData = mapData;

        // Container para agrupar todos os elementos do minimapa
        this.container = this.scene.add.container(x, y).setScrollFactor(0).setDepth(9998);

        // Gráfico para o fundo estático e borda
        this.background = this.scene.add.graphics();
        this.container.add(this.background);

        // Gráfico para os pontos dinâmicos dos jogadores
        this.dots = this.scene.add.graphics();
        this.container.add(this.dots);

        this.dotSize = 6; // Tamanho dos pontos que representam os jogadores

        this.create();
    }

    /**
     * Cria as partes estáticas do minimapa, como o fundo e a borda.
     */
    create() {
        // Desenha o fundo
        this.background.fillStyle(0x000000, 0.6);
        this.background.fillRect(0, 0, this.width, this.height);

        // Desenha a borda
        this.background.lineStyle(2, 0x00ffff, 0.7);
        this.background.strokeRect(0, 0, this.width, this.height);
    }

    /**
     * Atualiza as posições dos jogadores no minimapa.
     * @param {Phaser.GameObjects.GameObject[]} players Um array de objetos de jogadores.
     * @param {Phaser.GameObjects.GameObject[]} npcs Um array de objetos de NPCs.
     * @param {string} myTeam O time do jogador local ('blue' ou 'red').
     */
    update(players, npcs, myTeam) {
        // Limpa apenas os pontos dos jogadores do frame anterior
        this.dots.clear();

        players.forEach(player => {
            // Pula jogadores inativos ou mortos
            if (!player.active || player.health <= 0) {
                return;
            }

            const isMyTeam = player.team === myTeam;
            const isRevealed = player.isRevealed;

            // Mostra apenas aliados e inimigos revelados
            if (isMyTeam || isRevealed) {
                // Calcula a posição no minimapa (relativa ao container)
                const minimapX = (player.x / this.mapData.worldWidth) * this.width;
                const minimapY = (player.y / this.mapData.worldHeight) * this.height;

                // Define a cor do ponto baseado no time
                const dotColor = isMyTeam ? 0x00ffff : 0xff0000; // Ciano para aliados, Vermelho para inimigos

                this.dots.fillStyle(dotColor, 1);
                this.dots.fillCircle(minimapX, minimapY, this.dotSize / 2);
            }
        });

        // Desenha os NPCs como pontos amarelos
        if (npcs) {
            npcs.forEach(npc => {
                // Pula NPCs inativos ou mortos
                if (!npc.active || (npc.health !== undefined && npc.health <= 0)) {
                    return;
                }

                const minimapX = (npc.x / this.mapData.worldWidth) * this.width;
                const minimapY = (npc.y / this.mapData.worldHeight) * this.height;

                this.dots.fillStyle(0xffff00, 1); // Amarelo
                this.dots.fillCircle(minimapX, minimapY, this.dotSize / 2);
            });
        }
    }

    /**
     * Reposiciona o container do minimapa.
     * @param {number} x A nova posição x.
     * @param {number} y A nova posição y.
     */
    setPosition(x, y) {
        this.container.setPosition(x, y);
    }

    /**
     * Destrói o objeto gráfico do minimapa.
     */
    destroy() {
        this.container.destroy();
    }
}