import type { TokenColor } from '../game/GameState';
import type { SquareType } from '../game/Board';

export const GAME_WIDTH = 1920;
export const GAME_HEIGHT = 1080;
export const TOP_BAR_H = 40;
export const HUD_W = 260;
export const ACTION_H = 180;

export const FONT_DISPLAY = 'Georgia, "Palatino Linotype", "Book Antiqua", "Times New Roman", serif';
export const FONT_UI = '"Segoe UI", "Trebuchet MS", Arial, sans-serif';

/** Earthy 1978 Ravensburger palette. */
export const PALETTE = {
  ink: 0x3b2a1a,
  inkCss: '#3b2a1a',
  cream: 0xf6ecd2,
  creamCss: '#f6ecd2',
  parchment: 0xeadcb6,
  parchmentDark: 0xd4c08e,
  ochre: 0xc8932f,
  ochreCss: '#c8932f',
  rust: 0xa64b2a,
  rustCss: '#a64b2a',
  meadow: 0x7d9a43,
  meadowDark: 0x55702b,
  forest: 0x3d5523,
  sky: 0xbcd7d9,
  path: 0xcfae74,
  pathEdge: 0x9b7a45,
  highlight: 0xfff3a0,
  highlightCss: '#fff3a0',
  panel: 0x2f3a1f,
  panelCss: '#2f3a1f',
  shadow: 0x000000,
};

export const TOKEN_FILL: Record<TokenColor, number> = {
  red: 0xd9675b,
  blue: 0x6f93c9,
  yellow: 0xf0cf5c,
  green: 0x79b46a,
  white: 0xf4f1ea,
  black: 0x454545,
};

export const TOKEN_CSS: Record<TokenColor, string> = {
  red: '#d9675b',
  blue: '#6f93c9',
  yellow: '#f0cf5c',
  green: '#79b46a',
  white: '#f4f1ea',
  black: '#454545',
};

export const SQUARE_FILL: Record<SquareType, number> = {
  START: 0xe9d9a8,
  CARROT: 0xf1c27d,
  FLAG: 0xe8e0c8,
  POS_2: 0xdfe7c4,
  POS_3: 0xdfe7c4,
  POS_4: 0xdfe7c4,
  LETTUCE: 0xc5e0a0,
  HARE: 0xe6d3b8,
  TORTOISE: 0xb8c9a0,
  HOME: 0xe9d9a8,
};
