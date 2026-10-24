import Phaser from 'phaser';
import { SoundManager } from '../audio/SoundManager';
import { I18n, t } from '../i18n/I18n';
import { Button, bindText } from './Button';
import { FONT_DISPLAY, GAME_WIDTH, PALETTE, TOP_BAR_H } from './Theme';

export interface TopBarOptions {
  extra?: { label: () => string; onClick: () => void; width?: number }[];
}

/** Language + SFX toggles; present on every screen. */
export class TopBar extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, opts: TopBarOptions = {}) {
    super(scene, 0, 0);
    const bg = scene.add.graphics();
    bg.fillStyle(PALETTE.panel, 0.92);
    bg.fillRect(0, 0, GAME_WIDTH, TOP_BAR_H);
    bg.lineStyle(2, PALETTE.ochre, 0.8);
    bg.lineBetween(0, TOP_BAR_H, GAME_WIDTH, TOP_BAR_H);
    this.add(bg);

    const lang = new Button(scene, 58, TOP_BAR_H / 2, {
      width: 100, height: 30, fontSize: 16, fill: PALETTE.meadowDark,
      label: () => (I18n.language === 'es' ? 'ES ▸ EN' : 'EN ▸ ES'),
      onClick: () => I18n.toggle(),
    });
    const sfx = new Button(scene, 178, TOP_BAR_H / 2, {
      width: 130, height: 30, fontSize: 16, fill: PALETTE.meadowDark,
      label: () => t(SoundManager.isEnabled ? 'menu.sfx_on' : 'menu.sfx_off'),
      onClick: () => SoundManager.toggle(),
    });
    const offSfx = SoundManager.onChange(() => sfx.refreshLabel());
    this.once(Phaser.GameObjects.Events.DESTROY, offSfx);
    this.add([lang, sfx]);

    const title = scene.add
      .text(GAME_WIDTH / 2, TOP_BAR_H / 2, '', { fontFamily: FONT_DISPLAY, fontSize: '24px', color: PALETTE.creamCss, fontStyle: 'bold' })
      .setOrigin(0.5);
    bindText(title, () => t('app.title'));
    this.add(title);

    let x = GAME_WIDTH - 10;
    for (const e of opts.extra ?? []) {
      const w = e.width ?? 170;
      x -= w / 2;
      this.add(new Button(scene, x, TOP_BAR_H / 2, { width: w, height: 30, fontSize: 16, fill: PALETTE.rust, label: e.label, onClick: e.onClick }));
      x -= w / 2 + 10;
    }
    this.setDepth(90);
    scene.add.existing(this);
  }
}
