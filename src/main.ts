import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameOverScene } from './scenes/GameOverScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { PreloadScene } from './scenes/PreloadScene';
import { SetupScene } from './scenes/SetupScene';
import { TutorialScene } from './scenes/TutorialScene';
import { GAME_HEIGHT, GAME_WIDTH, PALETTE } from './ui/Theme';

// `?renderer=canvas` forces the Canvas renderer (useful on machines without GPU acceleration).
const forceCanvas = new URLSearchParams(window.location.search).get('renderer') === 'canvas';

const game = new Phaser.Game({
  type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: PALETTE.panel,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, roundPixels: false },
  fps: { target: 60 },
  scene: [BootScene, PreloadScene, MenuScene, SetupScene, GameScene, TutorialScene, GameOverScene],
});

// Exposed for debugging and automated smoke tests.
(window as unknown as { __game: Phaser.Game }).__game = game;
