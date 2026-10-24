import Phaser from 'phaser';
import type { GameState, PlayerState } from '../game/GameState';
import { I18n, t } from '../i18n/I18n';
import { playerName } from './names';
import { FONT_DISPLAY, FONT_UI, HUD_W, PALETTE, TOKEN_CSS, TOP_BAR_H } from './Theme';

const CARD_H = 200;
const CARD_GAP = 10;

interface Card {
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  carrots: Phaser.GameObjects.Text;
  lettuces: Phaser.GameObjects.Text;
  position: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  kind: Phaser.GameObjects.Text;
}

/** Left-hand panel with one card per player. */
export class PlayerHud {
  private cards: Card[] = [];
  private shownCarrots: number[];
  private activeId = -1;

  constructor(private scene: Phaser.Scene, private state: GameState) {
    const bg = scene.add.graphics().setDepth(5);
    bg.fillStyle(PALETTE.panel, 0.88);
    bg.fillRect(0, TOP_BAR_H, HUD_W, 860);
    bg.lineStyle(2, PALETTE.ochre, 0.7);
    bg.lineBetween(HUD_W, TOP_BAR_H, HUD_W, TOP_BAR_H + 860);
    this.shownCarrots = state.players.map((p) => p.carrots);
    state.players.forEach((p, i) => this.cards.push(this.makeCard(p, i)));
    const off = I18n.onChange(() => this.refresh());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.refresh();
  }

  private makeCard(p: PlayerState, i: number): Card {
    const s = this.scene;
    const y = TOP_BAR_H + 14 + i * (CARD_H + CARD_GAP);
    const container = s.add.container(12, y).setDepth(6);
    const glow = s.add.graphics();
    const frame = s.add.graphics();
    frame.fillStyle(PALETTE.cream, 0.96);
    frame.fillRoundedRect(0, 0, HUD_W - 24, CARD_H, 14);
    frame.fillStyle(Phaser.Display.Color.HexStringToColor(TOKEN_CSS[p.color]).color, 1);
    frame.fillRoundedRect(0, 0, HUD_W - 24, 10, { tl: 14, tr: 14, bl: 0, br: 0 });
    const token = s.add.image(36, 50, `token_${p.color}`).setScale(0.85);
    const name = s.add.text(70, 34, '', { fontFamily: FONT_DISPLAY, fontSize: '22px', color: PALETTE.inkCss, fontStyle: 'bold' });
    const kind = s.add.text(70, 62, '', { fontFamily: FONT_UI, fontSize: '15px', color: '#6d5a40' });
    const carrots = s.add.text(16, 96, '', { fontFamily: FONT_UI, fontSize: '22px', color: PALETTE.inkCss, fontStyle: 'bold' });
    const lettuces = s.add.text(16, 128, '', { fontFamily: FONT_UI, fontSize: '22px', color: PALETTE.inkCss, fontStyle: 'bold' });
    const position = s.add.text(HUD_W - 36, 168, '', {
      fontFamily: FONT_DISPLAY, fontSize: '24px', color: PALETTE.creamCss, fontStyle: 'bold',
      backgroundColor: PALETTE.rustCss, padding: { x: 8, y: 4 },
    }).setOrigin(1, 0.5);
    const status = s.add.text(16, 168, '', { fontFamily: FONT_UI, fontSize: '15px', color: PALETTE.rustCss, fontStyle: 'italic', wordWrap: { width: 150 } }).setOrigin(0, 0.5);
    container.add([glow, frame, token, name, kind, carrots, lettuces, position, status]);
    return { container, frame, glow, name, carrots, lettuces, position, status, kind };
  }

  setShownCarrots(id: number, total: number) {
    const before = this.shownCarrots[id];
    this.shownCarrots[id] = total;
    const card = this.cards[id];
    card.carrots.setText(this.carrotLabel(total));
    if (before !== total) {
      card.carrots.setColor(total > before ? '#3c7a2a' : PALETTE.rustCss);
      this.scene.tweens.add({ targets: card.carrots, scale: { from: 1.2, to: 1 }, duration: 300, onComplete: () => card.carrots.setColor(PALETTE.inkCss) });
    }
  }

  private carrotLabel(n: number) {
    return `🥕 ${n}  ${t('hud.carrots').toLowerCase()}`;
  }

  setActive(id: number) {
    this.activeId = id;
    this.cards.forEach((c, i) => {
      this.scene.tweens.killTweensOf(c.glow);
      c.glow.clear();
      if (i === id) {
        c.glow.lineStyle(10, PALETTE.highlight, 1);
        c.glow.strokeRoundedRect(-3, -3, HUD_W - 18, CARD_H + 6, 16);
        c.glow.setAlpha(1);
        this.scene.tweens.add({ targets: c.glow, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
      }
    });
  }

  refresh() {
    const st = this.state;
    st.players.forEach((p, i) => {
      const c = this.cards[i];
      c.name.setText(playerName(p));
      const maxW = HUD_W - 24 - 80;
      c.name.setScale(c.name.width > maxW ? maxW / c.name.width : 1);
      c.kind.setText(t(p.kind === 'human' ? 'setup.human' : p.kind === 'easy' ? 'setup.bot_easy' : 'setup.bot_medium'));
      c.carrots.setText(this.carrotLabel(this.shownCarrots[i]));
      c.lettuces.setText(`🥬 ${p.lettuces}  ${t('hud.lettuces').toLowerCase()}`);
      c.position.setText(I18n.ordinal(st.position(p.id)));
      let status = '';
      if (p.finished) status = t('hud.finished', { place: p.finishPlace ?? '' });
      else if (p.lettucePhase === 'arrived') status = `🥬 ${t('hud.lettuce_chewing')}`;
      else if (p.missNext) status = `⏸ ${t('hud.miss_next')}`;
      c.status.setText(status);
      c.container.setAlpha(p.finished ? 0.75 : 1);
    });
    if (this.activeId >= 0) this.setActive(this.activeId);
  }

  syncCarrots() {
    this.state.players.forEach((p) => (this.shownCarrots[p.id] = p.carrots));
    this.refresh();
  }
}
