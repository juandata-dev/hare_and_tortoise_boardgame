import Phaser from 'phaser';
import type { PlayerConfig, PlayerState } from '../game/GameState';
import { I18n, t } from '../i18n/I18n';
import { Button, bindText } from '../ui/Button';
import { playerName } from '../ui/names';
import { TopBar } from '../ui/TopBar';
import { FONT_DISPLAY, FONT_UI, GAME_WIDTH, PALETTE } from '../ui/Theme';

export interface GameOverData {
  players: PlayerState[];
  ranking: number[];
  configs: PlayerConfig[];
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data: GameOverData): void {
    this.add.image(0, 0, 'landscape').setOrigin(0);
    new TopBar(this);
    const cx = GAME_WIDTH / 2;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(cx - 490, 130, 990, 820, 26);
    g.fillStyle(PALETTE.cream, 0.96);
    g.fillRoundedRect(cx - 500, 120, 990, 820, 26);
    g.lineStyle(4, PALETTE.rust, 1);
    g.strokeRoundedRect(cx - 486, 134, 962, 792, 18);

    const winner = data.players[data.ranking[0]];
    bindText(this.add.text(cx - 5, 190, '', { fontFamily: FONT_DISPLAY, fontSize: '48px', color: PALETTE.rustCss, fontStyle: 'bold' }).setOrigin(0.5), () => t('gameover.title'));
    bindText(this.add.text(cx - 5, 262, '', { fontFamily: FONT_DISPLAY, fontSize: '36px', color: PALETTE.inkCss, fontStyle: 'italic' }).setOrigin(0.5), () => t('gameover.winner', { name: playerName(winner) }));
    this.add.image(cx - 5, 345, `token_${winner.color}`).setScale(1.5);

    const cols = [cx - 400, cx - 260, cx + 110, cx + 270];
    const head = (x: number, key: string) =>
      bindText(this.add.text(x, 420, '', { fontFamily: FONT_UI, fontSize: '22px', color: PALETTE.rustCss, fontStyle: 'bold' }), () => t(key));
    head(cols[0], 'gameover.rank');
    head(cols[1], 'gameover.player');
    head(cols[2], 'gameover.carrots_left');
    data.ranking.forEach((id, i) => {
      const p = data.players[id];
      const y = 480 + i * 70;
      const band = this.add.graphics();
      band.fillStyle(i === 0 ? PALETTE.highlight : PALETTE.parchment, i === 0 ? 0.9 : 0.7);
      band.fillRoundedRect(cx - 430, y - 28, 860, 58, 12);
      bindText(this.add.text(cols[0], y, '', { fontFamily: FONT_DISPLAY, fontSize: '28px', color: PALETTE.inkCss, fontStyle: 'bold' }).setOrigin(0, 0.5), () => I18n.ordinal(i + 1));
      this.add.image(cols[1] + 18, y, `token_${p.color}`).setScale(0.7);
      bindText(this.add.text(cols[1] + 50, y, '', { fontFamily: FONT_DISPLAY, fontSize: '28px', color: PALETTE.inkCss }).setOrigin(0, 0.5), () => playerName(p));
      this.add.text(cols[2], y, `🥕 ${p.carrots}`, { fontFamily: FONT_UI, fontSize: '26px', color: PALETTE.inkCss }).setOrigin(0, 0.5);
      bindText(this.add.text(cols[3], y, '', { fontFamily: FONT_UI, fontSize: '22px', color: p.finished ? '#2f6b1f' : PALETTE.rustCss, fontStyle: 'italic' }).setOrigin(0, 0.5), () => t(p.finished ? 'gameover.status_home' : 'gameover.status_racing'));
    });

    new Button(this, cx - 180, 860, { width: 300, height: 70, fontSize: 28, label: () => t('gameover.play_again'), onClick: () => this.scene.start('Setup') });
    new Button(this, cx + 170, 860, { width: 300, height: 70, fontSize: 28, fill: PALETTE.meadowDark, label: () => t('gameover.main_menu'), onClick: () => this.scene.start('Menu') });
  }
}
