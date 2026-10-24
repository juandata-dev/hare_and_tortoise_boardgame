import Phaser from 'phaser';
import { t } from '../i18n/I18n';
import { drawHare, drawTortoise } from '../ui/Art';
import { Button, bindText } from '../ui/Button';
import { TopBar } from '../ui/TopBar';
import { FONT_DISPLAY, FONT_UI, GAME_WIDTH, PALETTE } from '../ui/Theme';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.add.image(0, 0, 'landscape').setOrigin(0);
    new TopBar(this);

    const cx = GAME_WIDTH / 2;
    const plate = this.add.graphics();
    plate.fillStyle(0x000000, 0.25);
    plate.fillRoundedRect(cx - 470, 166, 950, 760, 28);
    plate.fillStyle(PALETTE.cream, 0.94);
    plate.fillRoundedRect(cx - 480, 156, 950, 760, 28);
    plate.lineStyle(5, PALETTE.rust, 1);
    plate.strokeRoundedRect(cx - 466, 170, 922, 732, 20);

    const art = this.add.graphics();
    drawHare(art, cx - 330, 430, 2.6, 0x8a6a48);
    drawTortoise(art, cx + 320, 440, 2.6);

    const title = this.add.text(cx - 5, 290, '', { fontFamily: FONT_DISPLAY, fontSize: '76px', color: PALETTE.rustCss, fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
    bindText(title, () => t('app.title'));
    title.setWordWrapWidth(820);
    const sub = this.add.text(cx - 5, 420, '', { fontFamily: FONT_DISPLAY, fontSize: '34px', color: PALETTE.inkCss, fontStyle: 'italic' }).setOrigin(0.5);
    bindText(sub, () => t('app.subtitle'));

    new Button(this, cx - 5, 540, { width: 420, height: 76, fontSize: 32, label: () => t('menu.new_game'), onClick: () => this.scene.start('Setup') });
    new Button(this, cx - 5, 640, { width: 420, height: 76, fontSize: 32, fill: PALETTE.meadowDark, label: () => t('menu.tutorial'), onClick: () => this.startTutorial() });

    const credit = this.add.text(cx - 5, 860, '', { fontFamily: FONT_UI, fontSize: '20px', color: PALETTE.inkCss }).setOrigin(0.5);
    bindText(credit, () => t('app.credit'));
  }

  private startTutorial(): void {
    this.scene.start('Tutorial', {
      configs: [
        { name: t('setup.player_name', { n: 1 }), nameKey: 'setup.player_name', nameN: 1, kind: 'human', color: 'red' },
        { name: t('setup.bot_name_medium', { n: 2 }), nameKey: 'setup.bot_name_medium', nameN: 2, kind: 'medium', color: 'blue' },
      ],
    });
  }
}
