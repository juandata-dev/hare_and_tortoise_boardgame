import Phaser from 'phaser';
import { TOKEN_COLORS } from '../game/GameState';
import { createRng } from '../game/Random';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE, TOKEN_FILL } from './Theme';

type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

/**
 * All artwork is drawn procedurally in the spirit of the 1978 Ravensburger
 * edition (earthy palette, soft shadows, hand-drawn shapes) and baked into
 * textures once at preload, so no copyrighted scans are shipped.
 */
export function generateArt(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const bake = (key: string, w: number, h: number, draw: (g: G) => void) => {
    if (scene.textures.exists(key)) return;
    g.clear();
    draw(g);
    g.generateTexture(key, w, h);
  };

  for (const color of TOKEN_COLORS) {
    bake(`token_${color}`, 56, 56, (g) => drawToken(g, 28, 28, 24, TOKEN_FILL[color]));
  }
  bake('icon_carrot', 48, 48, (g) => drawCarrot(g, 24, 26, 1));
  bake('icon_lettuce', 48, 48, (g) => drawLettuce(g, 24, 25, 1));
  bake('icon_hare', 48, 48, (g) => drawHare(g, 24, 28, 0.9, 0x8a6a48));
  bake('icon_tortoise', 52, 44, (g) => drawTortoise(g, 26, 26, 1));
  bake('icon_flag', 48, 48, (g) => drawFlag(g, 16, 6, 1));
  bake('card_back', 240, 330, (g) => drawCardBack(g, 240, 330));
  bake('card_face', 240, 330, (g) => drawCardFace(g, 240, 330));
  bake('mascot_0', 130, 150, (g) => drawMascot(g, 65, 90, false));
  bake('mascot_1', 130, 150, (g) => drawMascot(g, 65, 90, true));
  bake('landscape', GAME_WIDTH, GAME_HEIGHT, (g) => drawLandscape(g, GAME_WIDTH, GAME_HEIGHT));
  bake('glow', 96, 96, (g) => {
    for (let r = 46; r > 0; r -= 2) {
      g.fillStyle(PALETTE.highlight, 0.05 + (1 - r / 46) * 0.12);
      g.fillCircle(48, 48, r);
    }
  });
  g.destroy();
}

export function ellipsePts(cx: number, cy: number, rx: number, ry: number, rot = 0, n = 28): Pt[] {
  const pts: Pt[] = [];
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push({ x: cx + x * c - y * s, y: cy + x * s + y * c });
  }
  return pts;
}

function fillEllipseRot(g: G, cx: number, cy: number, rx: number, ry: number, rot: number) {
  g.fillPoints(ellipsePts(cx, cy, rx, ry, rot), true);
}

function drawToken(g: G, cx: number, cy: number, r: number, fill: number) {
  g.fillStyle(0x000000, 0.25);
  g.fillCircle(cx + 2, cy + 3, r);
  g.fillStyle(Phaser.Display.Color.ValueToColor(fill).darken(30).color, 1);
  g.fillCircle(cx, cy, r);
  g.fillStyle(fill, 1);
  g.fillCircle(cx, cy, r - 3);
  g.lineStyle(2, Phaser.Display.Color.ValueToColor(fill).darken(20).color, 0.8);
  g.strokeCircle(cx, cy, r - 9);
  g.fillStyle(0xffffff, 0.35);
  fillEllipseRot(g, cx - 7, cy - 8, 8, 5, -0.6);
}

export function drawCarrot(g: G, cx: number, cy: number, s: number) {
  g.fillStyle(0x4f8a2f, 1);
  fillEllipseRot(g, cx - 4 * s, cy - 14 * s, 3 * s, 9 * s, -0.5);
  fillEllipseRot(g, cx + 4 * s, cy - 14 * s, 3 * s, 9 * s, 0.5);
  fillEllipseRot(g, cx, cy - 16 * s, 3 * s, 9 * s, 0);
  g.fillStyle(0xe07a24, 1);
  g.fillPoints(
    [
      { x: cx - 8 * s, y: cy - 7 * s },
      { x: cx + 8 * s, y: cy - 7 * s },
      { x: cx + 2 * s, y: cy + 17 * s },
      { x: cx - 1 * s, y: cy + 18 * s },
    ],
    true,
  );
  g.fillStyle(0xf39a45, 1);
  g.fillCircle(cx, cy - 7 * s, 8 * s);
  g.lineStyle(1.5 * s, 0xb4561a, 0.9);
  for (const y of [-2, 4, 10]) g.lineBetween(cx - 5 * s + y * 0.2 * s, cy + y * s, cx + 1 * s, cy + y * s + 1 * s);
}

export function drawLettuce(g: G, cx: number, cy: number, s: number) {
  const leaves = [
    [-10, 2, 0x5f9a35], [10, 2, 0x5f9a35], [0, -9, 0x6aa83c], [-7, -5, 0x76b446], [7, -5, 0x76b446], [0, 6, 0x4f8a2f],
  ] as const;
  for (const [dx, dy, col] of leaves) {
    g.fillStyle(col, 1);
    g.fillCircle(cx + dx * s, cy + dy * s, 10 * s);
  }
  g.fillStyle(0xb7dc8a, 1);
  g.fillCircle(cx, cy - 1 * s, 8 * s);
  g.lineStyle(1.5 * s, 0x3f6f25, 0.8);
  g.lineBetween(cx, cy + 12 * s, cx, cy - 6 * s);
  g.lineBetween(cx, cy + 4 * s, cx - 8 * s, cy - 3 * s);
  g.lineBetween(cx, cy + 4 * s, cx + 8 * s, cy - 3 * s);
}

export function drawHare(g: G, cx: number, cy: number, s: number, col: number) {
  const dark = Phaser.Display.Color.ValueToColor(col).darken(25).color;
  g.fillStyle(dark, 1);
  fillEllipseRot(g, cx + 3 * s, cy - 19 * s, 3.5 * s, 11 * s, 0.35);
  g.fillStyle(col, 1);
  fillEllipseRot(g, cx - 1 * s, cy - 20 * s, 3.5 * s, 12 * s, 0.15);
  fillEllipseRot(g, cx - 3 * s, cy + 4 * s, 14 * s, 10 * s, -0.15); // body
  fillEllipseRot(g, cx + 7 * s, cy - 7 * s, 7.5 * s, 6.5 * s, 0.2); // head
  g.fillStyle(0xf4efe4, 1);
  g.fillCircle(cx - 16 * s, cy + 2 * s, 4 * s); // tail
  fillEllipseRot(g, cx + 6 * s, cy + 12 * s, 6 * s, 2.5 * s, 0); // paw
  g.fillStyle(0x2a1d12, 1);
  g.fillCircle(cx + 10 * s, cy - 8 * s, 1.4 * s);
  g.fillStyle(0xd88b8b, 1);
  g.fillCircle(cx + 14.5 * s, cy - 6 * s, 1.3 * s);
}

export function drawTortoise(g: G, cx: number, cy: number, s: number) {
  g.fillStyle(0x7f8f4a, 1);
  g.fillCircle(cx + 18 * s, cy - 2 * s, 5 * s); // head
  for (const [dx, dy] of [[-11, 8], [9, 8], [-14, 3], [12, 3]]) fillEllipseRot(g, cx + dx * s, cy + dy * s, 4 * s, 3 * s, 0);
  g.fillStyle(0x6b5434, 1);
  g.slice(cx, cy + 4 * s, 16 * s, Math.PI, 0, false);
  g.fillPath();
  g.fillStyle(0x8c6d42, 1);
  g.slice(cx, cy + 4 * s, 13 * s, Math.PI, 0, false);
  g.fillPath();
  g.lineStyle(1.5 * s, 0x4f3c22, 0.9);
  g.strokeRect(cx - 4 * s, cy - 6 * s, 8 * s, 6 * s);
  g.lineBetween(cx - 4 * s, cy - 3 * s, cx - 11 * s, cy - 1 * s);
  g.lineBetween(cx + 4 * s, cy - 3 * s, cx + 11 * s, cy - 1 * s);
  g.lineBetween(cx, cy - 6 * s, cx, cy - 12 * s);
  g.fillStyle(0x56461f, 1);
  g.fillRect(cx - 16 * s, cy + 3 * s, 32 * s, 2.5 * s);
  g.fillStyle(0x1f1a12, 1);
  g.fillCircle(cx + 20 * s, cy - 3 * s, 1.2 * s);
}

export function drawFlag(g: G, x: number, y: number, s: number) {
  g.lineStyle(3 * s, 0x5a4026, 1);
  g.lineBetween(x, y, x, y + 36 * s);
  g.fillStyle(0xc0392b, 1);
  g.fillPoints([{ x: x + 1, y: y + 2 * s }, { x: x + 26 * s, y: y + 9 * s }, { x: x + 1, y: y + 17 * s }], true);
  g.fillStyle(0x5a4026, 1);
  g.fillCircle(x, y, 2.5 * s);
}

function drawCardBack(g: G, w: number, h: number) {
  g.fillStyle(0x000000, 0.25);
  g.fillRoundedRect(6, 8, w - 8, h - 10, 18);
  g.fillStyle(0x7b3f22, 1);
  g.fillRoundedRect(0, 0, w - 8, h - 10, 18);
  g.fillStyle(0xe9d7aa, 1);
  g.fillRoundedRect(10, 10, w - 28, h - 30, 12);
  g.lineStyle(3, 0x7b3f22, 1);
  g.strokeRoundedRect(18, 18, w - 44, h - 46, 10);
  for (let i = 0; i < 9; i++) {
    g.lineStyle(1, 0xc5ab73, 0.6);
    g.strokeCircle((w - 8) / 2, (h - 10) / 2, 30 + i * 12);
  }
  drawHare(g, (w - 8) / 2, (h - 10) / 2 + 10, 3.2, 0x5b3a22);
}

function drawCardFace(g: G, w: number, h: number) {
  g.fillStyle(0x000000, 0.25);
  g.fillRoundedRect(6, 8, w - 8, h - 10, 18);
  g.fillStyle(0xf6ecd2, 1);
  g.fillRoundedRect(0, 0, w - 8, h - 10, 18);
  g.lineStyle(4, 0x7b3f22, 1);
  g.strokeRoundedRect(8, 8, w - 24, h - 26, 12);
  g.fillStyle(0xe7d6a6, 1);
  g.fillRoundedRect(22, 22, w - 52, 120, 10);
  drawHare(g, (w - 8) / 2, 90, 2.2, 0x8a6a48);
}

function drawMascot(g: G, cx: number, cy: number, earsDown: boolean) {
  const col = 0xc9a77c;
  const dark = 0xa47f55;
  // ears
  g.fillStyle(dark, 1);
  fillEllipseRot(g, cx - 14, cy - 52, 9, 30, earsDown ? -0.45 : -0.15);
  fillEllipseRot(g, cx + 14, cy - 52, 9, 30, earsDown ? 0.45 : 0.15);
  g.fillStyle(0xe7b7a8, 1);
  fillEllipseRot(g, cx - 14, cy - 50, 4.5, 22, earsDown ? -0.45 : -0.15);
  fillEllipseRot(g, cx + 14, cy - 50, 4.5, 22, earsDown ? 0.45 : 0.15);
  // body + head
  g.fillStyle(col, 1);
  fillEllipseRot(g, cx, cy + 28, 34, 30, 0);
  g.fillCircle(cx, cy - 8, 30);
  g.fillStyle(0xf4ecdc, 1);
  fillEllipseRot(g, cx, cy + 32, 20, 20, 0);
  fillEllipseRot(g, cx, cy + 2, 14, 10, 0);
  // face
  g.fillStyle(0x2a1d12, 1);
  g.fillCircle(cx - 11, cy - 12, 4);
  g.fillCircle(cx + 11, cy - 12, 4);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - 10, cy - 13.5, 1.4);
  g.fillCircle(cx + 12, cy - 13.5, 1.4);
  g.fillStyle(0xd27d7d, 1);
  g.fillTriangle(cx - 4, cy - 2, cx + 4, cy - 2, cx, cy + 3);
  g.lineStyle(2, 0x6b4a2f, 1);
  g.lineBetween(cx, cy + 3, cx, cy + 7);
  g.lineBetween(cx - 16, cy - 1, cx - 30, cy - 4);
  g.lineBetween(cx + 16, cy - 1, cx + 30, cy - 4);
  // waistcoat
  g.fillStyle(0x3d6b8c, 1);
  g.fillRect(cx - 24, cy + 22, 48, 10);
  g.fillStyle(0xe0b84a, 1);
  g.fillCircle(cx, cy + 27, 3);
}

export function drawLandscape(g: G, w: number, h: number) {
  const rng = createRng(1979);
  // sky: soft vertical gradient in bands (fillGradientStyle is WebGL-only)
  const top = Phaser.Display.Color.ValueToColor(0xbfdcdc);
  const bottom = Phaser.Display.Color.ValueToColor(0xeee6c4);
  for (let i = 0; i < 40; i++) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 39, i);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    g.fillRect(0, i * 8, w, 9);
  }
  // distant hills
  const hill = (base: number, amp: number, freq: number, phase: number, col: number) => {
    const pts: Pt[] = [{ x: 0, y: h }];
    for (let x = 0; x <= w; x += 20) {
      pts.push({ x, y: base + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase) * amp * 0.3 });
    }
    pts.push({ x: w, y: h });
    g.fillStyle(col, 1);
    g.fillPoints(pts, true);
  };
  hill(120, 30, 0.004, 0.5, 0xa9bf86);
  hill(170, 26, 0.006, 2.1, 0x93ad69);
  hill(230, 22, 0.005, 4.0, 0x84a05a);
  // meadow with patchy texture
  g.fillStyle(0x7d9a43, 1);
  g.fillRect(0, 300, w, h - 300);
  hill(290, 18, 0.007, 1.2, 0x7d9a43);
  for (let i = 0; i < 1400; i++) {
    const x = rng() * w;
    const y = 260 + rng() * (h - 260);
    const tone = [0x8aa64c, 0x6f8c3a, 0x90ad56, 0x6a8536][Math.floor(rng() * 4)];
    g.fillStyle(tone, 0.35);
    fillEllipseRot(g, x, y, 10 + rng() * 30, 4 + rng() * 10, rng() * 0.6 - 0.3);
  }
  // hedgerows and trees on the horizon
  for (let i = 0; i < 26; i++) {
    const x = rng() * w;
    const y = 150 + rng() * 120;
    const r = 18 + rng() * 22;
    g.fillStyle(0x5c4632, 1);
    g.fillRect(x - 3, y, 6, r * 0.9);
    g.fillStyle(0x4c6b2b, 1);
    g.fillCircle(x, y, r);
    g.fillStyle(0x5f8034, 1);
    g.fillCircle(x - r * 0.3, y - r * 0.3, r * 0.65);
  }
  // flowers
  for (let i = 0; i < 500; i++) {
    const x = rng() * w;
    const y = 320 + rng() * (h - 320);
    g.fillStyle([0xf4ecdc, 0xf0cf5c, 0xd98fa0, 0xb3a3d6][Math.floor(rng() * 4)], 0.85);
    g.fillCircle(x, y, 1.5 + rng() * 1.8);
  }
}
