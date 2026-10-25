export default class SoundManager {
    constructor(scene) {
        this.scene = scene;
        this.music = null;
    }

    preload() {
        // Carrega os arquivos de áudio
        // Certifique-se de criar a pasta 'assets/sounds' e colocar os arquivos lá
        this.scene.load.audio('shoot', 'assets/audio/leohpaz/13_Ice_explosion_01.wav');
        this.scene.load.audio('hit', 'assets/audio/leohpaz/03_Claw_03.wav');
        this.scene.load.audio('bg_music', 'assets/audio/xDeviruchi/And-the-Journey-Begins.wav');
        this.scene.load.audio('impact', 'assets/audio/leohpaz/51_Flee_02.wav');
    }

    create() {
        // O SoundManager do Phaser é global: sem isso a música se acumula a cada restart da cena
        this.stopMusic();
        if (this.scene.cache.audio.exists('bg_music')) {
            this.music = this.scene.sound.add('bg_music', { 
                volume: GAME_CONFIG.MUSIC_VOLUME, 
                loop: true 
            });
            this.music.play();
        }
        this.scene.events.once('shutdown', () => this.stopMusic());
    }

    stopMusic() {
        if (this.music) {
            this.music.stop();
            this.music.destroy();
            this.music = null;
        }
    }

    playShoot() {
        if (this.scene.cache.audio.exists('shoot')) {
            this.scene.sound.play('shoot', { volume: GAME_CONFIG.SFX_VOLUME });
        }
    }

    playHit() {
        if (this.scene.cache.audio.exists('hit')) {
            this.scene.sound.play('hit', { volume: GAME_CONFIG.SFX_VOLUME });
        }
    }

    /**
     * Toca um som genérico pela chave.
     * @param {string} key - A chave do áudio a ser tocado.
     */
    play(key) {
        if (this.scene.cache.audio.exists(key)) {
            this.scene.sound.play(key, { volume: GAME_CONFIG.SFX_VOLUME });
        }
    }
}