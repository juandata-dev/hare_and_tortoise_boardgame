import Phaser from 'phaser';
import { SoundManager } from '../audio/SoundManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    SoundManager.attach(this.game);
    this.sound.pauseOnBlur = false;
    this.scene.start('Preload');
  }
}
