import Phaser from 'phaser';
import { SoundManager } from '../audio/SoundManager';
import { SFX } from '../audio/SoundKeys';
import { moveCost } from '../game/Board';
import { HARE_CARD_I18N, HareCardType } from '../game/HareCards';
import { t } from '../i18n/I18n';
import { Button, bindText } from './Button';
import { ACTION_H, FONT_DISPLAY, FONT_UI, GAME_HEIGHT, GAME_WIDTH, PALETTE, TOKEN_CSS } from './Theme';
import type { TokenColor } from '../game/GameState';

const GOOD_CARDS: HareCardType[] = ['EXTRA_TURN', 'FREE_RIDE', 'NEXT_CARROT', 'MOVE_UP', 'WIN_LOSE_10'];
export const isGoodCard = (c: HareCardType) => GOOD_CARDS.includes(c);

function dim(scene: Phaser.Scene, depth: number, alpha = 0.55) {
  return scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, alpha).setOrigin(0).setDepth(depth).setInteractive();
}

// ── Hare card modal ─────────────────────────────────────────────────────
export interface HareModalOptions {
  /** Human player: wait for a click. Bot: auto-close after 1.5 s. */
  interactive: boolean;
  /** "Win or lose 10" — offer two buttons. */
  choice?: boolean;
  canLose?: boolean;
  /** Bot decision for the choice card. */
  botChoice?: 'win' | 'lose';
  playerLabel: string;
}

export function showHareCard(scene: Phaser.Scene, card: HareCardType, opts: HareModalOptions): Promise<'ok' | 'win' | 'lose'> {
  return new Promise((resolve) => {
    const depth = 60;
    const shade = dim(scene, depth);
    const cx = GAME_WIDTH / 2 + 130;
    const cy = GAME_HEIGHT / 2 - 60;
    const cardImg = scene.add.image(cx, cy, 'card_back').setDepth(depth + 1).setScale(1.3);
    const objs: Phaser.GameObjects.GameObject[] = [shade, cardImg];
    SoundManager.play(SFX.hareDraw);

    const finish = (result: 'ok' | 'win' | 'lose') => {
      scene.input.keyboard?.off('keydown-SPACE', okKey);
      scene.input.keyboard?.off('keydown-ENTER', okKey);
      for (const o of objs) o.destroy();
      resolve(result);
    };
    const okKey = () => {
      if (!opts.choice) finish('ok');
    };

    scene.tweens.add({
      targets: cardImg,
      scaleX: 0,
      duration: 220,
      delay: 250,
      yoyo: true,
      onYoyo: () => {
        cardImg.setTexture('card_face');
        SoundManager.play(isGoodCard(card) ? SFX.hareGood : SFX.hareBad);
      },
      onComplete: () => {
        const title = bindText(scene.add.text(cx - 4, cy - 30, '', { fontFamily: FONT_DISPLAY, fontSize: '28px', color: PALETTE.rustCss, fontStyle: 'bold' }).setOrigin(0.5).setDepth(depth + 2), () => t('hare.title'));
        const text = bindText(
          scene.add.text(cx - 4, cy + 80, '', { fontFamily: FONT_DISPLAY, fontSize: '26px', color: PALETTE.inkCss, align: 'center', wordWrap: { width: 250 } }).setOrigin(0.5).setDepth(depth + 2),
          () => t(HARE_CARD_I18N[card]),
        );
        const who = scene.add.text(cx - 4, cy - 250, opts.playerLabel, { fontFamily: FONT_DISPLAY, fontSize: '30px', color: PALETTE.creamCss, fontStyle: 'bold' }).setOrigin(0.5).setDepth(depth + 2);
        objs.push(title, text, who);
        const by = cy + 270;
        if (opts.interactive) {
          if (opts.choice) {
            objs.push(new Button(scene, cx - 130, by, { width: 230, height: 64, fill: PALETTE.meadowDark, label: () => t('btn.win10'), onClick: () => finish('win') }).setDepth(depth + 3));
            const lose = new Button(scene, cx + 130, by, { width: 230, height: 64, fill: PALETTE.rust, label: () => t('btn.lose10'), onClick: () => finish('lose') }).setDepth(depth + 3);
            lose.setEnabled(opts.canLose !== false);
            objs.push(lose);
          } else {
            objs.push(new Button(scene, cx, by, { width: 220, height: 64, label: () => t('btn.ok'), onClick: () => finish('ok') }).setDepth(depth + 3));
            scene.input.keyboard?.on('keydown-SPACE', okKey);
            scene.input.keyboard?.on('keydown-ENTER', okKey);
          }
        } else {
          scene.time.delayedCall(1500, () => finish(opts.choice ? opts.botChoice ?? 'win' : 'ok'));
        }
      },
    });
  });
}

// ── Race card ───────────────────────────────────────────────────────────
export class RaceCardOverlay {
  private objs: Phaser.GameObjects.GameObject[] = [];

  constructor(private scene: Phaser.Scene) {}

  get open() {
    return this.objs.length > 0;
  }

  toggle() {
    if (this.open) this.close();
    else this.show();
  }

  show() {
    const s = this.scene;
    const depth = 70;
    const w = 620;
    const h = 700;
    const x = GAME_WIDTH - w - 30;
    const y = 60;
    const g = s.add.graphics().setDepth(depth);
    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(x + 6, y + 8, w, h, 18);
    g.fillStyle(PALETTE.cream, 0.98);
    g.fillRoundedRect(x, y, w, h, 18);
    g.lineStyle(4, PALETTE.rust, 1);
    g.strokeRoundedRect(x + 8, y + 8, w - 16, h - 16, 12);
    g.setInteractive(new Phaser.Geom.Rectangle(x, y, w, h), Phaser.Geom.Rectangle.Contains);
    this.objs.push(g);
    this.objs.push(bindText(s.add.text(x + w / 2, y + 40, '', { fontFamily: FONT_DISPLAY, fontSize: '26px', color: PALETTE.rustCss, fontStyle: 'bold' }).setOrigin(0.5).setDepth(depth + 1), () => t('race.title')));
    for (let col = 0; col < 2; col++) {
      const cx = x + 60 + col * 290;
      this.objs.push(bindText(s.add.text(cx, y + 80, '', { fontFamily: FONT_UI, fontSize: '20px', color: PALETTE.inkCss, fontStyle: 'bold' }).setDepth(depth + 1), () => t('race.squares')));
      this.objs.push(bindText(s.add.text(cx + 140, y + 80, '', { fontFamily: FONT_UI, fontSize: '20px', color: PALETTE.inkCss, fontStyle: 'bold' }).setDepth(depth + 1), () => t('race.carrots')));
      for (let r = 0; r < 10; r++) {
        const n = col * 10 + r + 1;
        const ry = y + 116 + r * 44;
        if (r % 2 === 0) {
          const band = s.add.rectangle(cx - 16, ry - 6, 250, 40, PALETTE.parchment, 0.8).setOrigin(0).setDepth(depth + 0.5);
          this.objs.push(band);
        }
        this.objs.push(s.add.text(cx + 30, ry, String(n), { fontFamily: FONT_DISPLAY, fontSize: '24px', color: PALETTE.inkCss }).setOrigin(0.5, 0).setDepth(depth + 1));
        this.objs.push(s.add.text(cx + 190, ry, `${moveCost(n)} 🥕`, { fontFamily: FONT_DISPLAY, fontSize: '24px', color: PALETTE.inkCss }).setOrigin(0.5, 0).setDepth(depth + 1));
      }
    }
    this.objs.push(bindText(s.add.text(x + 40, y + 570, '', { fontFamily: FONT_UI, fontSize: '19px', color: PALETTE.rustCss, wordWrap: { width: w - 80 } }).setDepth(depth + 1), () => t('race.finish')));
    this.objs.push(new Button(s, x + w / 2, y + h - 50, { width: 200, height: 52, fontSize: 22, label: () => t('btn.close'), onClick: () => this.close() }).setDepth(depth + 2));
  }

  close() {
    for (const o of this.objs) o.destroy();
    this.objs = [];
  }
}

// ── Hotseat hand-off ────────────────────────────────────────────────────
export function showHandoff(scene: Phaser.Scene, name: string, color: TokenColor): Promise<void> {
  return new Promise((resolve) => {
    const depth = 80;
    const bg = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, PALETTE.panel, 0.97).setOrigin(0).setDepth(depth).setInteractive({ useHandCursor: true });
    const token = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 150, `token_${color}`).setScale(2.4).setDepth(depth + 1);
    const title = scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', { fontFamily: FONT_DISPLAY, fontSize: '72px', color: TOKEN_CSS[color] === '#454545' ? PALETTE.creamCss : TOKEN_CSS[color], fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(depth + 1);
    bindText(title, () => `🎯  ${t('turn.your_turn', { name })}`);
    const hint = bindText(scene.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 110, '', { fontFamily: FONT_UI, fontSize: '28px', color: PALETTE.creamCss }).setOrigin(0.5).setDepth(depth + 1), () => t('turn.tap_continue'));
    scene.tweens.add({ targets: hint, alpha: 0.4, yoyo: true, repeat: -1, duration: 700 });
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      scene.input.keyboard?.off('keydown', close);
      SoundManager.play(SFX.turnStart);
      for (const o of [bg, token, title, hint]) o.destroy();
      resolve();
    };
    // Ignore the click that ended the previous turn.
    scene.time.delayedCall(250, () => {
      bg.on('pointerup', close);
      scene.input.keyboard?.on('keydown', close);
    });
  });
}

// ── Tutorial coach ──────────────────────────────────────────────────────
export class CoachOverlay {
  private objs: Phaser.GameObjects.GameObject[] = [];

  constructor(private scene: Phaser.Scene) {}

  get active() {
    return this.objs.length > 0;
  }

  show(textKey: string, title?: string): Promise<void> {
    const s = this.scene;
    return new Promise((resolve) => {
      const depth = 75;
      const w = 1180;
      const h = ACTION_H + 20;
      const x = (GAME_WIDTH - w) / 2 + 130;
      const y = GAME_HEIGHT - h - 6;
      const blocker = s.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.12).setOrigin(0).setDepth(depth).setInteractive();
      const g = s.add.graphics().setDepth(depth + 1);
      g.fillStyle(0x000000, 0.3);
      g.fillRoundedRect(x + 5, y + 6, w, h, 18);
      g.fillStyle(PALETTE.cream, 0.95);
      g.fillRoundedRect(x, y, w, h, 18);
      g.lineStyle(4, PALETTE.meadowDark, 1);
      g.strokeRoundedRect(x + 6, y + 6, w - 12, h - 12, 14);
      const mascot = s.add.sprite(x + 80, y + h / 2 + 4, 'mascot_0').setDepth(depth + 2);
      if (!s.anims.exists('mascot_talk')) {
        s.anims.create({ key: 'mascot_talk', frames: [{ key: 'mascot_0' }, { key: 'mascot_1' }], frameRate: 3, repeat: -1 });
      }
      mascot.play('mascot_talk');
      s.tweens.add({ targets: mascot, y: mascot.y - 6, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.easeInOut' });
      const heading = s.add.text(x + 165, y + 22, title ?? '', { fontFamily: FONT_DISPLAY, fontSize: '22px', color: PALETTE.rustCss, fontStyle: 'bold' }).setDepth(depth + 2);
      const text = bindText(
        s.add.text(x + 165, y + (title ? 54 : 30), '', { fontFamily: FONT_UI, fontSize: '23px', color: PALETTE.inkCss, wordWrap: { width: w - 420 }, lineSpacing: 4 }).setDepth(depth + 2),
        () => t(textKey),
      );
      this.objs.push(blocker, g, mascot, heading, text);
      const close = () => {
        s.input.keyboard?.off('keydown-SPACE', close);
        s.input.keyboard?.off('keydown-ENTER', close);
        for (const o of this.objs) o.destroy();
        this.objs = [];
        resolve();
      };
      this.objs.push(new Button(s, x + w - 130, y + h / 2, { width: 210, height: 64, fill: PALETTE.meadowDark, label: () => t('btn.got_it'), onClick: close }).setDepth(depth + 3));
      s.time.delayedCall(200, () => {
        s.input.keyboard?.on('keydown-SPACE', close);
        s.input.keyboard?.on('keydown-ENTER', close);
      });
    });
  }
}
