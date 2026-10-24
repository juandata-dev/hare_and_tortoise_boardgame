import Phaser from 'phaser';
import { SoundManager } from '../audio/SoundManager';
import { SFX } from '../audio/SoundKeys';
import { I18n } from '../i18n/I18n';
import { FONT_UI, PALETTE } from './Theme';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fontSize?: number;
  fill?: number;
  textColor?: string;
  /** Re-evaluated when the language changes. */
  label: () => string;
  onClick: () => void;
}

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private bw: number;
  private bh: number;
  private fill: number;
  private enabledState = true;
  private hovered = false;
  private labelFn: () => string;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOptions) {
    super(scene, x, y);
    this.bw = opts.width ?? 240;
    this.bh = opts.height ?? 56;
    this.fill = opts.fill ?? PALETTE.ochre;
    this.labelFn = opts.label;
    this.bg = scene.add.graphics();
    this.text = scene.add
      .text(0, 0, opts.label(), {
        fontFamily: FONT_UI,
        fontSize: `${opts.fontSize ?? 24}px`,
        color: opts.textColor ?? PALETTE.creamCss,
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);
    this.add([this.bg, this.text]);
    this.setSize(this.bw, this.bh);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => { this.hovered = true; this.redraw(); });
    this.on('pointerout', () => { this.hovered = false; this.redraw(); });
    this.on('pointerup', () => {
      if (!this.enabledState) return;
      SoundManager.play(SFX.buttonClick, 0.5);
      opts.onClick();
    });
    const off = I18n.onChange(() => this.refreshLabel());
    this.once(Phaser.GameObjects.Events.DESTROY, off);
    this.redraw();
    scene.add.existing(this);
  }

  refreshLabel(): void {
    if (!this.scene) return;
    this.text.setText(this.labelFn());
    this.fitText();
  }

  setLabel(fn: () => string): this {
    this.labelFn = fn;
    this.refreshLabel();
    return this;
  }

  setFill(color: number): this {
    this.fill = color;
    this.redraw();
    return this;
  }

  setEnabled(on: boolean): this {
    this.enabledState = on;
    if (on) this.setInteractive({ useHandCursor: true });
    else this.disableInteractive();
    this.redraw();
    return this;
  }

  private fitText() {
    this.text.setScale(1);
    const max = this.bw - 16;
    if (this.text.width > max) this.text.setScale(max / this.text.width);
  }

  private redraw() {
    const g = this.bg;
    const base = this.enabledState ? this.fill : 0x8a8a7a;
    const col = this.hovered && this.enabledState ? Phaser.Display.Color.ValueToColor(base).lighten(10).color : base;
    g.clear();
    g.fillStyle(0x000000, 0.28);
    g.fillRoundedRect(-this.bw / 2 + 2, -this.bh / 2 + 4, this.bw, this.bh, 12);
    g.fillStyle(Phaser.Display.Color.ValueToColor(col).darken(22).color, 1);
    g.fillRoundedRect(-this.bw / 2, -this.bh / 2, this.bw, this.bh, 12);
    g.fillStyle(col, 1);
    g.fillRoundedRect(-this.bw / 2 + 2, -this.bh / 2 + 2, this.bw - 4, this.bh - 6, 10);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(-this.bw / 2 + 6, -this.bh / 2 + 4, this.bw - 12, this.bh / 2 - 6, 8);
    this.text.setAlpha(this.enabledState ? 1 : 0.6);
    this.fitText();
  }
}

/** Keeps a Text object in sync with the current language. */
export function bindText(text: Phaser.GameObjects.Text, fn: () => string): Phaser.GameObjects.Text {
  text.setText(fn());
  const off = I18n.onChange(() => {
    if (text.scene) text.setText(fn());
  });
  text.once(Phaser.GameObjects.Events.DESTROY, off);
  return text;
}
