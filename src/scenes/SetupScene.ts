import Phaser from 'phaser';
import { PlayerConfig, PlayerKind, TOKEN_COLORS, TokenColor } from '../game/GameState';
import { createRng, shuffle } from '../game/Random';
import { t } from '../i18n/I18n';
import { SoundManager } from '../audio/SoundManager';
import { SFX } from '../audio/SoundKeys';
import { Button, bindText } from '../ui/Button';
import { TopBar } from '../ui/TopBar';
import { FONT_DISPLAY, FONT_UI, GAME_WIDTH, PALETTE } from '../ui/Theme';

type SlotKind = PlayerKind | 'empty';
interface Slot {
  kind: SlotKind;
  color: TokenColor;
}

const KIND_CYCLE: SlotKind[] = ['human', 'easy', 'medium', 'empty'];
const KIND_KEY: Record<SlotKind, string> = {
  human: 'setup.human',
  easy: 'setup.bot_easy',
  medium: 'setup.bot_medium',
  empty: 'setup.empty',
};

const ROW_Y0 = 400;
const ROW_H = 105;
const ROW_X = GAME_WIDTH / 2 - 430;

export class SetupScene extends Phaser.Scene {
  private slots: Slot[] = [];
  private manualOrder = false;
  private rows: Phaser.GameObjects.Container[] = [];
  private countButtons: Button[] = [];
  private orderButtons: Button[] = [];
  private error!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;

  constructor() {
    super('Setup');
  }

  init(): void {
    this.slots = [
      { kind: 'human', color: 'red' },
      { kind: 'medium', color: 'blue' },
      { kind: 'empty', color: 'yellow' },
      { kind: 'empty', color: 'green' },
    ];
    this.manualOrder = false;
    this.rows = [];
    this.countButtons = [];
    this.orderButtons = [];
  }

  create(): void {
    this.add.image(0, 0, 'landscape').setOrigin(0);
    new TopBar(this);
    const cx = GAME_WIDTH / 2;

    const plate = this.add.graphics();
    plate.fillStyle(0x000000, 0.25);
    plate.fillRoundedRect(cx - 520, 92, 1050, 920, 26);
    plate.fillStyle(PALETTE.cream, 0.95);
    plate.fillRoundedRect(cx - 530, 82, 1050, 920, 26);
    plate.lineStyle(4, PALETTE.rust, 1);
    plate.strokeRoundedRect(cx - 516, 96, 1022, 892, 18);

    bindText(this.add.text(cx - 5, 140, '', { fontFamily: FONT_DISPLAY, fontSize: '52px', color: PALETTE.rustCss, fontStyle: 'bold' }).setOrigin(0.5), () => t('setup.title'));

    bindText(this.add.text(ROW_X, 230, '', { fontFamily: FONT_UI, fontSize: '28px', color: PALETTE.inkCss, fontStyle: 'bold' }).setOrigin(0, 0.5), () => t('setup.players'));
    [2, 3, 4].forEach((n, i) => {
      this.countButtons.push(new Button(this, ROW_X + 280 + i * 110, 230, { width: 90, height: 54, fontSize: 28, label: () => String(n), onClick: () => this.setCount(n) }));
    });

    bindText(this.add.text(ROW_X, 310, '', { fontFamily: FONT_UI, fontSize: '28px', color: PALETTE.inkCss, fontStyle: 'bold' }).setOrigin(0, 0.5), () => t('setup.order'));
    this.orderButtons.push(new Button(this, ROW_X + 335, 310, { width: 200, height: 54, fontSize: 24, label: () => t('setup.order_random'), onClick: () => this.setManual(false) }));
    this.orderButtons.push(new Button(this, ROW_X + 555, 310, { width: 200, height: 54, fontSize: 24, label: () => t('setup.order_manual'), onClick: () => this.setManual(true) }));
    this.hint = bindText(this.add.text(ROW_X + 680, 310, '', { fontFamily: FONT_UI, fontSize: '18px', color: PALETTE.inkCss, fontStyle: 'italic', wordWrap: { width: 220 } }).setOrigin(0, 0.5), () => t('setup.order_hint'));

    this.error = this.add.text(cx - 5, 840, '', { fontFamily: FONT_UI, fontSize: '24px', color: PALETTE.rustCss, fontStyle: 'bold' }).setOrigin(0.5);

    new Button(this, cx - 200, 920, { width: 260, height: 70, fontSize: 28, fill: PALETTE.meadowDark, label: () => t('btn.back'), onClick: () => this.scene.start('Menu') });
    new Button(this, cx + 190, 920, { width: 320, height: 70, fontSize: 30, label: () => t('btn.confirm'), onClick: () => this.confirm() });

    this.buildRows();
    this.refresh();
  }

  private setCount(n: number): void {
    this.slots.forEach((s, i) => {
      if (i < n && s.kind === 'empty') s.kind = i === 0 ? 'human' : 'medium';
      if (i >= n) s.kind = 'empty';
    });
    this.buildRows();
    this.refresh();
  }

  private setManual(on: boolean): void {
    this.manualOrder = on;
    this.buildRows();
    this.refresh();
  }

  private filledCount(): number {
    return this.slots.filter((s) => s.kind !== 'empty').length;
  }

  private buildRows(): void {
    for (const r of this.rows) r.destroy();
    this.rows = [];
    this.slots.forEach((slot, i) => {
      const row = this.add.container(ROW_X, ROW_Y0 + i * ROW_H);
      const bg = this.add.graphics();
      bg.fillStyle(slot.kind === 'empty' ? PALETTE.parchment : PALETTE.parchmentDark, slot.kind === 'empty' ? 0.5 : 0.8);
      bg.fillRoundedRect(0, -42, 860, 84, 14);
      row.add(bg);

      const handle = this.add.text(36, 0, '☰', { fontFamily: FONT_UI, fontSize: '36px', color: this.manualOrder ? PALETTE.inkCss : '#b9a77c' }).setOrigin(0.5);
      row.add(handle);
      if (this.manualOrder) {
        handle.setInteractive({ useHandCursor: true, draggable: true });
        handle.on('drag', (pointer: Phaser.Input.Pointer) => {
          row.y = Phaser.Math.Clamp(pointer.y, ROW_Y0 - 20, ROW_Y0 + 3 * ROW_H + 20);
          row.setDepth(10);
        });
        handle.on('dragend', () => {
          const to = Phaser.Math.Clamp(Math.round((row.y - ROW_Y0) / ROW_H), 0, this.slots.length - 1);
          const [moved] = this.slots.splice(i, 1);
          this.slots.splice(to, 0, moved);
          SoundManager.play(SFX.buttonClick, 0.4);
          this.buildRows();
          this.refresh();
        });
      }

      row.add(this.add.text(78, 0, `${i + 1}`, { fontFamily: FONT_DISPLAY, fontSize: '34px', color: PALETTE.inkCss, fontStyle: 'bold' }).setOrigin(0.5));

      const kindBtn = new Button(this, 220, 0, {
        width: 220, height: 58, fontSize: 22,
        fill: slot.kind === 'human' ? PALETTE.rust : slot.kind === 'empty' ? 0x9c9078 : PALETTE.meadowDark,
        label: () => t(KIND_KEY[slot.kind]),
        onClick: () => {
          slot.kind = KIND_CYCLE[(KIND_CYCLE.indexOf(slot.kind) + 1) % KIND_CYCLE.length];
          this.buildRows();
          this.refresh();
        },
      });
      row.add(kindBtn);

      row.add(bindText(this.add.text(360, 0, '', { fontFamily: FONT_UI, fontSize: '20px', color: PALETTE.inkCss }).setOrigin(0, 0.5), () => t('setup.color')));

      TOKEN_COLORS.forEach((color, ci) => {
        const x = 480 + ci * 64;
        const taken = this.slots.some((o) => o !== slot && o.kind !== 'empty' && o.color === color);
        const img = this.add.image(x, 0, `token_${color}`).setScale(0.9).setAlpha(taken ? 0.25 : 1);
        row.add(img);
        if (slot.color === color) {
          const ring = this.add.graphics();
          ring.lineStyle(4, PALETTE.rust, 1);
          ring.strokeCircle(x, 0, 28);
          row.add(ring);
        }
        if (!taken && slot.kind !== 'empty') {
          img.setInteractive({ useHandCursor: true });
          img.on('pointerup', () => {
            slot.color = color;
            SoundManager.play(SFX.buttonClick, 0.4);
            this.buildRows();
          });
        }
      });
      if (slot.kind === 'empty') row.setAlpha(0.65);
      this.rows.push(row);
    });
  }

  private refresh(): void {
    const n = this.filledCount();
    this.countButtons.forEach((b, i) => b.setFill(i + 2 === n ? PALETTE.rust : PALETTE.ochre));
    this.orderButtons[0].setFill(this.manualOrder ? PALETTE.ochre : PALETTE.rust);
    this.orderButtons[1].setFill(this.manualOrder ? PALETTE.rust : PALETTE.ochre);
    this.hint.setVisible(this.manualOrder);
    this.error.setText('');
  }

  private confirm(): void {
    const filled = this.slots.filter((s) => s.kind !== 'empty') as { kind: PlayerKind; color: TokenColor }[];
    if (filled.length < 2 || filled.length > 4) {
      SoundManager.play(SFX.invalid);
      this.error.setText(t('setup.need_players'));
      return;
    }
    // Colours must be unique among active seats.
    const used = new Set<TokenColor>();
    for (const s of filled) {
      if (used.has(s.color)) s.color = TOKEN_COLORS.find((c) => !used.has(c))!;
      used.add(s.color);
    }
    const ordered = this.manualOrder ? filled : shuffle(filled, createRng(Date.now()));
    const configs: PlayerConfig[] = ordered.map((s, i) => {
      const nameKey = s.kind === 'human' ? 'setup.player_name' : s.kind === 'easy' ? 'setup.bot_name_easy' : 'setup.bot_name_medium';
      return { name: t(nameKey, { n: i + 1 }), nameKey, nameN: i + 1, kind: s.kind, color: s.color };
    });
    this.scene.start('Game', { configs });
  }
}
