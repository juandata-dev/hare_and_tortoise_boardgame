import Phaser from 'phaser';
import { SoundManagerService } from '../audio/SoundManager';
import { t } from '../i18n/I18n';
import { generateArt } from '../ui/Art';
import { FONT_DISPLAY, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../ui/Theme';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor(PALETTE.panel);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, t('app.title'), { fontFamily: FONT_DISPLAY, fontSize: '56px', color: PALETTE.creamCss })
      .setOrigin(0.5);
    const barW = 600;
    const frame = this.add.graphics();
    frame.lineStyle(3, PALETTE.ochre, 1);
    frame.strokeRoundedRect(GAME_WIDTH / 2 - barW / 2, GAME_HEIGHT / 2, barW, 28, 8);
    const bar = this.add.graphics();
    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(PALETTE.ochre, 1);
      bar.fillRoundedRect(GAME_WIDTH / 2 - barW / 2 + 4, GAME_HEIGHT / 2 + 4, (barW - 8) * v, 20, 6);
    });
    SoundManagerService.preload(this);
  }

  create(): void {
    generateArt(this);
    this.scene.start('Menu');
  }
}
