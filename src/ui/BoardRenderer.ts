import Phaser from 'phaser';
import { SquareType, numberOfSquare } from '../game/Board';
import type { TokenColor } from '../game/GameState';
import { t } from '../i18n/I18n';
import { bindText } from './Button';
import { FONT_DISPLAY, FONT_UI, PALETTE, SQUARE_FILL } from './Theme';

export const SQUARE_R = 31;
const END_R = 46;

/** Hand-placed control points of the winding track (screen coordinates). */
const TRACK_POINTS: [number, number][] = [
  [370, 800], [560, 838], [780, 800], [1000, 836], [1230, 800], [1460, 832], [1680, 790],
  [1810, 690], [1770, 575], [1590, 545], [1360, 580], [1130, 540], [900, 580], [680, 545], [490, 560],
  [380, 470], [420, 350], [600, 300], [820, 330], [1040, 290], [1260, 320], [1470, 280], [1640, 300], [1790, 190],
];

interface TokenView {
  container: Phaser.GameObjects.Container;
  token: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Image;
  index: number;
}

export class BoardRenderer {
  readonly positions: Phaser.Math.Vector2[];
  private tokens = new Map<number, TokenView>();
  private highlights: Phaser.GameObjects.GameObject[] = [];
  private highlightSet = new Set<number>();
  private tooltip: Phaser.GameObjects.Container;
  private tooltipText: Phaser.GameObjects.Text;

  onSquareClick: (index: number) => void = () => {};
  onSquareHover: (index: number) => string | null = () => null;

  constructor(private scene: Phaser.Scene, private board: readonly SquareType[]) {
    const curve = new Phaser.Curves.Spline(TRACK_POINTS.map(([x, y]) => new Phaser.Math.Vector2(x, y)));
    this.positions = curve.getSpacedPoints(board.length - 1).map((p) => new Phaser.Math.Vector2(p.x, p.y));
    // Static artwork is baked once into a texture so it costs nothing per frame.
    const rt = scene.add.renderTexture(0, 0, scene.scale.width, scene.scale.height).setOrigin(0).setDepth(0);
    if (scene.textures.exists('landscape')) rt.draw('landscape', 0, 0);
    const track = this.drawTrack(curve);
    rt.draw(track);
    track.destroy();
    this.drawSquares(rt);
    this.tooltipText = scene.add.text(0, 0, '', { fontFamily: FONT_UI, fontSize: '20px', color: PALETTE.creamCss, fontStyle: 'bold' }).setOrigin(0.5);
    const tipBg = scene.add.graphics();
    this.tooltip = scene.add.container(0, 0, [tipBg, this.tooltipText]).setDepth(40).setVisible(false);
    this.tooltip.setData('bg', tipBg);
  }

  get home(): number {
    return this.board.length - 1;
  }

  // ── static drawing ────────────────────────────────────────────────────
  private drawTrack(curve: Phaser.Curves.Spline): Phaser.GameObjects.Graphics {
    const pts = curve.getSpacedPoints(600);
    const g = this.scene.make.graphics({}, false);
    const stroke = (w: number, col: number, a: number, dy = 0) => {
      g.lineStyle(w, col, a);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y + dy);
      for (const p of pts) g.lineTo(p.x, p.y + dy);
      g.strokePath();
    };
    stroke(92, 0x000000, 0.18, 6);
    stroke(90, PALETTE.pathEdge, 1);
    stroke(80, PALETTE.path, 1);
    stroke(54, 0xd9bd86, 0.6);
    // pebbles along the path edge
    const rnd = new Phaser.Math.RandomDataGenerator(['hare']);
    for (let i = 0; i < pts.length; i += 3) {
      const p = pts[i];
      g.fillStyle(rnd.pick([0xb99a64, 0xe2c99a, 0xa88a55]), 0.7);
      g.fillCircle(p.x + rnd.between(-34, 34), p.y + rnd.between(-34, 34), rnd.realInRange(1.5, 3.5));
    }
    return g;
  }

  private drawSquares(rt: Phaser.GameObjects.RenderTexture) {
    this.board.forEach((type, i) => {
      const p = this.positions[i];
      const r = type === 'START' || type === 'HOME' ? END_R : SQUARE_R;
      const c = this.scene.add.container(p.x, p.y).setDepth(2);
      let live = false;
      const g = this.scene.add.graphics();
      g.fillStyle(0x000000, 0.22);
      g.fillCircle(2, 4, r);
      g.fillStyle(Phaser.Display.Color.ValueToColor(SQUARE_FILL[type]).darken(28).color, 1);
      g.fillCircle(0, 0, r);
      g.fillStyle(SQUARE_FILL[type], 1);
      g.fillCircle(0, 0, r - 3);
      g.lineStyle(1.5, 0xffffff, 0.35);
      g.strokeCircle(0, 0, r - 7);
      c.add(g);

      const n = numberOfSquare(type);
      if (type === 'CARROT') c.add(this.scene.add.image(0, 0, 'icon_carrot').setScale(0.95));
      else if (type === 'LETTUCE') c.add(this.scene.add.image(0, 0, 'icon_lettuce'));
      else if (type === 'HARE') c.add(this.scene.add.image(0, 0, 'icon_hare'));
      else if (type === 'TORTOISE') c.add(this.scene.add.image(0, 2, 'icon_tortoise').setScale(0.95));
      else if (type === 'FLAG') c.add(this.scene.add.image(2, 0, 'icon_flag').setScale(0.9));
      else if (n !== null) {
        c.add(this.scene.add.text(0, 1, String(n), { fontFamily: FONT_DISPLAY, fontSize: '34px', color: PALETTE.inkCss, fontStyle: 'bold' }).setOrigin(0.5));
      } else {
        const label = this.scene.add.text(0, 0, '', { fontFamily: FONT_DISPLAY, fontSize: '19px', color: PALETTE.rustCss, fontStyle: 'bold' }).setOrigin(0.5);
        bindText(label, () => t(type === 'START' ? 'square.START' : 'square.HOME').toUpperCase());
        c.add(label);
        live = true;
      }
      if (i > 0 && i < this.home) {
        c.add(this.scene.add.text(r - 6, r - 8, String(i), { fontFamily: FONT_UI, fontSize: '13px', color: PALETTE.inkCss, backgroundColor: '#f6ecd2cc', padding: { x: 3, y: 0 } }).setOrigin(0.5));
      }

      const zone = this.scene.add.zone(p.x, p.y, r * 2, r * 2).setDepth(30);
      zone.setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
      zone.on('pointerup', () => this.onSquareClick(i));
      zone.on('pointerover', () => this.showTooltip(i));
      zone.on('pointerout', () => this.hideTooltip());
      if (!live) {
        rt.draw(c);
        c.destroy();
      }
    });
  }

  // ── tooltip ───────────────────────────────────────────────────────────
  private showTooltip(i: number) {
    const text = this.onSquareHover(i);
    if (!text) return;
    this.tooltipText.setText(text);
    const bg = this.tooltip.getData('bg') as Phaser.GameObjects.Graphics;
    const w = this.tooltipText.width + 24;
    const h = this.tooltipText.height + 14;
    bg.clear();
    bg.fillStyle(PALETTE.panel, 0.94);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(2, PALETTE.ochre, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    const p = this.positions[i];
    this.tooltip.setPosition(Phaser.Math.Clamp(p.x, 300 + w / 2, 1900 - w / 2), p.y - 62).setVisible(true);
  }

  hideTooltip() {
    this.tooltip.setVisible(false);
  }

  // ── highlights ────────────────────────────────────────────────────────
  setHighlights(indices: number[], color = PALETTE.highlight) {
    this.clearHighlights();
    for (const i of indices) {
      const p = this.positions[i];
      const r = i === 0 || i === this.home ? END_R : SQUARE_R;
      const glow = this.scene.add.image(p.x, p.y, 'glow').setDepth(1.5).setScale((r * 2.4) / 96);
      const ring = this.scene.add.graphics().setDepth(3);
      ring.lineStyle(5, color, 1);
      ring.strokeCircle(p.x, p.y, r + 3);
      this.scene.tweens.add({ targets: [ring, glow], alpha: { from: 1, to: 0.35 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.highlights.push(glow, ring);
      this.highlightSet.add(i);
    }
  }

  clearHighlights() {
    for (const h of this.highlights) {
      this.scene.tweens.killTweensOf(h);
      h.destroy();
    }
    this.highlights = [];
    this.highlightSet.clear();
  }

  isHighlighted(i: number) {
    return this.highlightSet.has(i);
  }

  shakeSquare(i: number) {
    const p = this.positions[i];
    const r = i === 0 || i === this.home ? END_R : SQUARE_R;
    const ring = this.scene.add.graphics({ x: p.x, y: p.y }).setDepth(4);
    ring.lineStyle(6, 0xc0392b, 1);
    ring.strokeCircle(0, 0, r + 2);
    ring.lineBetween(-r * 0.5, -r * 0.5, r * 0.5, r * 0.5);
    ring.lineBetween(-r * 0.5, r * 0.5, r * 0.5, -r * 0.5);
    this.scene.tweens.add({ targets: ring, x: { from: p.x - 7, to: p.x + 7 }, duration: 50, yoyo: true, repeat: 3 });
    this.scene.tweens.add({ targets: ring, alpha: 0, delay: 350, duration: 300, onComplete: () => ring.destroy() });
  }

  // ── tokens ────────────────────────────────────────────────────────────
  addToken(id: number, color: TokenColor, index: number) {
    const container = this.scene.add.container(0, 0).setDepth(10 + id);
    const shadow = this.scene.add.ellipse(2, 16, 40, 14, 0x000000, 0.3);
    const token = this.scene.add.image(0, 0, `token_${color}`).setScale(0.82);
    const badge = this.scene.add.image(15, -15, 'icon_lettuce').setScale(0.55).setVisible(false);
    container.add([shadow, token, badge]);
    const view: TokenView = { container, token, badge, index };
    this.tokens.set(id, view);
    const p = this.slotPosition(id, index);
    container.setPosition(p.x, p.y);
  }

  tokenPosition(id: number): Phaser.Math.Vector2 {
    const v = this.tokens.get(id)!;
    return new Phaser.Math.Vector2(v.container.x, v.container.y);
  }

  /** Position for a token on a square; START keeps several pieces side by side. */
  private slotPosition(id: number, index: number): Phaser.Math.Vector2 {
    const p = this.positions[index];
    if (index === 0) {
      const off = [[-18, -18], [18, -18], [-18, 18], [18, 18]][id % 4];
      return new Phaser.Math.Vector2(p.x + off[0], p.y + off[1]);
    }
    return p.clone();
  }

  /** Finished pieces wait in the HOME meadow beside the track. */
  private homeAreaPosition(place: number): Phaser.Math.Vector2 {
    const p = this.positions[this.home];
    return new Phaser.Math.Vector2(p.x - 150 + (place - 1) * 52, p.y - 78);
  }

  setLettuceFlip(id: number, flipped: boolean): Promise<void> {
    const v = this.tokens.get(id)!;
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: v.token,
        scaleX: 0,
        duration: 160,
        yoyo: true,
        onYoyo: () => {
          v.token.setTint(flipped ? 0x9a9a9a : 0xffffff);
          v.badge.setVisible(flipped);
        },
        onComplete: () => resolve(),
      });
    });
  }

  moveToken(id: number, from: number, to: number, kind: 'forward' | 'backward' | 'card' | 'restart' | 'finish', place = 0): Promise<void> {
    const v = this.tokens.get(id)!;
    v.index = to;
    v.container.setDepth(20);
    const path: Phaser.Math.Vector2[] = [];
    if (kind === 'restart') {
      path.push(this.slotPosition(id, 0));
    } else {
      const step = to > from ? 1 : -1;
      for (let i = from + step; step > 0 ? i <= to : i >= to; i += step) path.push(this.slotPosition(id, i));
    }
    if (kind === 'finish') path.push(this.homeAreaPosition(place));
    const hop = Math.max(90, Math.min(400, 1200 / Math.max(path.length, 1)));
    return new Promise((resolve) => {
      const chain = path.map((p) => ({
        targets: v.container,
        x: p.x,
        y: p.y,
        duration: kind === 'restart' ? 900 : hop,
        ease: 'Sine.easeInOut',
      }));
      if (chain.length === 0) return resolve();
      this.scene.tweens.chain({
        tweens: chain,
        onComplete: () => {
          v.container.setDepth(10 + id);
          resolve();
        },
      });
      // a little hop for each square
      this.scene.tweens.add({ targets: v.token, y: -10, duration: hop / 2, yoyo: true, repeat: Math.max(path.length - 1, 0), ease: 'Quad.easeOut' });
    });
  }

  /** Re-seat every token instantly (e.g. after layout changes). */
  placeToken(id: number, index: number, finishedPlace: number | null) {
    const v = this.tokens.get(id)!;
    v.index = index;
    const p = finishedPlace ? this.homeAreaPosition(finishedPlace) : this.slotPosition(id, index);
    v.container.setPosition(p.x, p.y);
  }

  pulseToken(id: number) {
    const v = this.tokens.get(id);
    if (!v) return;
    this.scene.tweens.add({ targets: v.container, scale: { from: 1.25, to: 1 }, duration: 350, ease: 'Back.easeOut' });
  }
}
