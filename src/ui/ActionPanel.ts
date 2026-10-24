import Phaser from 'phaser';
import { I18n } from '../i18n/I18n';
import { Button } from './Button';
import { ACTION_H, FONT_DISPLAY, FONT_UI, GAME_HEIGHT, GAME_WIDTH, HUD_W, PALETTE } from './Theme';

export interface PanelButton {
  label: () => string;
  onClick: () => void;
  fill?: number;
  width?: number;
}

const TOP = GAME_HEIGHT - ACTION_H;

/** Bottom panel: current prompt, a short event log and the current player's buttons. */
export class ActionPanel {
  private message: Phaser.GameObjects.Text;
  private logText: Phaser.GameObjects.Text;
  private messageFn: () => string = () => '';
  private logFns: (() => string)[] = [];
  private buttons: Button[] = [];
  private swatch: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene) {
    const g = scene.add.graphics().setDepth(5);
    g.fillStyle(PALETTE.panel, 0.94);
    g.fillRect(0, TOP, GAME_WIDTH, ACTION_H);
    g.lineStyle(3, PALETTE.ochre, 0.9);
    g.lineBetween(0, TOP, GAME_WIDTH, TOP);
    this.swatch = scene.add.image(48, TOP + 52, 'token_red').setDepth(6).setVisible(false);
    this.message = scene.add
      .text(HUD_W - 170, TOP + 26, '', { fontFamily: FONT_DISPLAY, fontSize: '28px', color: PALETTE.creamCss, fontStyle: 'bold', wordWrap: { width: 1040 } })
      .setDepth(6);
    this.logText = scene.add
      .text(HUD_W - 170, TOP + 92, '', { fontFamily: FONT_UI, fontSize: '19px', color: '#d9cfae', lineSpacing: 4, wordWrap: { width: 1040 } })
      .setDepth(6);
    const off = I18n.onChange(() => this.render());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  setPlayerSwatch(color: string | null) {
    if (color) this.swatch.setTexture(`token_${color}`).setVisible(true);
    else this.swatch.setVisible(false);
  }

  setMessage(fn: () => string) {
    this.messageFn = fn;
    this.render();
  }

  log(fn: () => string) {
    this.logFns.push(fn);
    if (this.logFns.length > 3) this.logFns.shift();
    this.render();
  }

  private render() {
    this.message.setText(this.messageFn());
    this.logText.setText(this.logFns.map((f) => '• ' + f()).join('\n'));
  }

  setButtons(buttons: PanelButton[]) {
    this.clearButtons();
    let x = GAME_WIDTH - 30;
    for (const b of buttons.slice().reverse()) {
      const w = b.width ?? 250;
      x -= w / 2;
      this.buttons.push(new Button(this.scene, x, TOP + ACTION_H / 2, { width: w, height: 68, fontSize: 24, fill: b.fill, label: b.label, onClick: b.onClick }).setDepth(7));
      x -= w / 2 + 16;
    }
  }

  clearButtons() {
    for (const b of this.buttons) b.destroy();
    this.buttons = [];
  }

  /** Show one button and resolve when clicked (or Space/Enter). */
  waitButton(label: () => string, fill?: number): Promise<void> {
    return new Promise((resolve) => {
      const kb = this.scene.input.keyboard;
      const done = () => {
        kb?.off('keydown-SPACE', done);
        kb?.off('keydown-ENTER', done);
        this.clearButtons();
        resolve();
      };
      this.setButtons([{ label, onClick: done, fill }]);
      kb?.once('keydown-SPACE', done);
      kb?.once('keydown-ENTER', done);
    });
  }
}
