import Phaser from 'phaser';
import { SoundManager } from '../audio/SoundManager';
import { SFX } from '../audio/SoundKeys';
import { AIPlayer } from '../game/AIPlayer';
import { moveCost } from '../game/Board';
import { GameEvent, GameState, PlayerConfig, PlayerState } from '../game/GameState';
import { HARE_CARD_I18N } from '../game/HareCards';
import { createRng } from '../game/Random';
import { Action, forwardMoveError } from '../game/Rules';
import { I18n, t } from '../i18n/I18n';
import { ActionPanel } from '../ui/ActionPanel';
import { BoardRenderer } from '../ui/BoardRenderer';
import { playerName } from '../ui/names';
import { RaceCardOverlay, showHandoff, showHareCard } from '../ui/Overlays';
import { PlayerHud } from '../ui/PlayerHud';
import { FONT_DISPLAY, PALETTE } from '../ui/Theme';
import { TopBar } from '../ui/TopBar';

export interface GameSceneData {
  configs: PlayerConfig[];
  seed?: number;
}

const BOT_THINK_MS = 600;

/** Board render + game loop. All rules are delegated to GameState. */
export class GameScene extends Phaser.Scene {
  protected setup!: GameSceneData;
  protected state!: GameState;
  protected boardView!: BoardRenderer;
  protected hud!: PlayerHud;
  protected panel!: ActionPanel;
  protected raceCard!: RaceCardOverlay;
  protected alive = false;

  private bots = new Map<number, AIPlayer>();
  private queue: GameEvent[] = [];
  private humanResolve: ((a: Action) => void) | null = null;
  private legal: Action[] = [];
  private choiceResult: 'win' | 'lose' = 'win';

  constructor(key = 'Game') {
    super(key);
  }

  init(data: GameSceneData): void {
    this.setup = data;
    this.bots = new Map();
    this.queue = [];
    this.humanResolve = null;
    this.legal = [];
  }

  create(): void {
    this.alive = true;
    this.raceCard = new RaceCardOverlay(this);
    new TopBar(this, { extra: this.topBarExtras() });

    const seed = this.setup.seed ?? Date.now();
    this.state = new GameState(this.setup.configs, { seed });
    const aiRng = createRng(seed ^ 0x5eed);
    for (const p of this.state.players) {
      if (p.kind !== 'human') this.bots.set(p.id, new AIPlayer(p.kind, aiRng));
    }

    this.boardView = new BoardRenderer(this, this.state.board);
    for (const p of this.state.players) this.boardView.addToken(p.id, p.color, p.pos);
    this.boardView.onSquareClick = (i) => this.handleSquareClick(i);
    this.boardView.onSquareHover = (i) => this.hoverText(i);

    this.hud = new PlayerHud(this, this.state);
    this.panel = new ActionPanel(this);

    const off = this.state.on((e) => this.queue.push(e));
    const esc = () => this.raceCard.close();
    this.input.keyboard?.on('keydown-ESC', esc);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      off();
      this.input.keyboard?.off('keydown-ESC', esc);
    });

    this.time.delayedCall(300, () => void this.runGame());
  }

  protected topBarExtras() {
    return [
      { label: () => t('btn.menu'), onClick: () => this.scene.start('Menu'), width: 120 },
      { label: () => t('btn.race_card'), onClick: () => this.raceCard.toggle(), width: 220 },
    ];
  }

  // ── hooks for the tutorial ───────────────────────────────────────────
  protected async onGameStart(): Promise<void> {}
  protected async beforeHumanAction(_p: PlayerState): Promise<void> {}
  protected async afterEvent(_e: GameEvent): Promise<void> {}
  protected async onGameOver(): Promise<void> {}

  // ── main loop ────────────────────────────────────────────────────────
  private async runGame(): Promise<void> {
    const st = this.state;
    const humans = st.players.filter((p) => p.kind === 'human').length;
    let last = -1;
    await this.onGameStart();

    while (this.alive && !st.isOver()) {
      const p = st.currentPlayer;
      const isHuman = p.kind === 'human';
      const name = playerName(p);
      this.hud.setActive(p.id);
      this.panel.setPlayerSwatch(p.color);
      this.panel.setMessage(() => t('turn.your_turn', { name: playerName(p) }));
      if (isHuman && humans >= 2 && last !== p.id) await showHandoff(this, name, p.color);
      if (!this.alive) return;
      last = p.id;

      const kind = st.beginTurn();
      await this.drain();
      if (!this.alive) return;

      if (kind === 'skipped') {
        this.panel.setMessage(() => t('turn.skipped', { name: playerName(p) }));
        await this.pause(isHuman);
      } else if (kind === 'chewed') {
        await this.pause(isHuman);
      } else {
        if (kind === 'restarted') this.panel.setMessage(() => t('turn.restart', { name: playerName(p) }));
        let action: Action;
        if (isHuman) {
          await this.beforeHumanAction(p);
          if (!this.alive) return;
          action = await this.awaitHuman(p);
        } else {
          action = await this.botAction(p);
        }
        if (!this.alive) return;
        st.applyAction(action);
        await this.drain();
        if (!this.alive) return;
        if (st.phase === 'awaitHareChoice') {
          st.resolveHareChoice(this.choiceResult);
          await this.drain();
        }
      }
      if (!this.alive) return;
      st.endTurn();
      await this.drain();
      this.hud.refresh();
    }

    if (!this.alive) return;
    this.hud.setActive(-1);
    await this.onGameOver();
    if (!this.alive) return;
    this.time.delayedCall(1200, () => {
      this.scene.start('GameOver', { players: st.players.map((p) => ({ ...p })), ranking: st.ranking.slice(), configs: this.setup.configs });
    });
  }

  private pause(isHuman: boolean): Promise<void> {
    if (isHuman) return this.panel.waitButton(() => t('btn.continue'));
    return this.delay(1100);
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, r));
  }

  private async botAction(p: PlayerState): Promise<Action> {
    this.panel.setMessage(() => t('turn.bot_thinking', { name: playerName(p) }));
    await this.delay(BOT_THINK_MS);
    return this.bots.get(p.id)!.chooseAction(this.state, p.id);
  }

  // ── human input ──────────────────────────────────────────────────────
  private awaitHuman(p: PlayerState): Promise<Action> {
    this.legal = this.state.legalActions();
    const dests = this.legal.filter((a) => a.type !== 'STAY').map((a) => (a as { to: number }).to);
    this.boardView.setHighlights(dests);
    const stays = this.legal.filter((a): a is Extract<Action, { type: 'STAY' }> => a.type === 'STAY');
    const key = p.lettucePhase === 'mustLeave' ? 'turn.must_leave' : stays.length ? 'turn.choose_move_carrot' : 'turn.choose_move';
    this.panel.setMessage(() => t(key, { name: playerName(p) }));
    this.panel.setButtons(
      stays.map((s) => ({
        label: () => t(s.delta > 0 ? 'btn.stay_plus' : 'btn.stay_minus'),
        fill: s.delta > 0 ? PALETTE.meadowDark : PALETTE.rust,
        onClick: () => this.resolveHuman(s),
      })),
    );
    return new Promise((resolve) => (this.humanResolve = resolve));
  }

  private resolveHuman(a: Action) {
    const r = this.humanResolve;
    if (!r) return;
    this.humanResolve = null;
    this.legal = [];
    this.boardView.clearHighlights();
    this.boardView.hideTooltip();
    this.panel.clearButtons();
    r(a);
  }

  private handleSquareClick(i: number) {
    if (!this.humanResolve) return;
    const p = this.state.currentPlayer;
    if (i === p.pos) return;
    const a = this.legal.find((x) => x.type !== 'STAY' && x.to === i);
    if (a) {
      this.resolveHuman(a);
      return;
    }
    SoundManager.play(SFX.invalid);
    this.boardView.shakeSquare(i);
    const err = i > p.pos ? forwardMoveError(this.state, p, i) ?? 'error.not_forward' : 'error.not_forward';
    this.panel.log(() => t(err));
  }

  private hoverText(i: number): string | null {
    const typeName = t(`square.${this.state.board[i]}`);
    if (!this.humanResolve) return `${i > 0 && i < this.state.home ? `${i} · ` : ''}${typeName}`;
    const p = this.state.currentPlayer;
    const a = this.legal.find((x) => x.type !== 'STAY' && x.to === i);
    if (a?.type === 'MOVE') {
      const cost = moveCost(i - p.pos);
      return i === this.state.home ? t('turn.hover_home', { cost }) : t('turn.hover_cost', { square: typeName, cost });
    }
    if (a?.type === 'BACK') return t('turn.hover_back', { square: typeName, n: p.pos - i, gain: 10 * (p.pos - i) });
    return typeName;
  }

  // ── event playback ───────────────────────────────────────────────────
  protected async drain(): Promise<void> {
    while (this.alive && this.queue.length) {
      const e = this.queue.shift()!;
      await this.playEvent(e);
      if (!this.alive) return;
      await this.afterEvent(e);
    }
    if (this.alive) this.hud.refresh();
  }

  protected async playEvent(e: GameEvent): Promise<void> {
    const st = this.state;
    const nameOf = (id: number) => () => playerName(st.player(id));
    switch (e.type) {
      case 'move': {
        if (e.kind === 'backward') SoundManager.play(SFX.backward);
        await this.boardView.moveToken(e.player, e.from, e.to, e.kind);
        if (e.kind !== 'backward') SoundManager.play(SFX.move, 0.5);
        break;
      }
      case 'carrots': {
        this.hud.setShownCarrots(e.player, e.total);
        const pos = this.boardView.tokenPosition(e.player);
        this.floatText(pos.x, pos.y - 30, `${e.delta > 0 ? '+' : ''}${e.delta} 🥕`, e.delta > 0 ? '#2f6b1f' : PALETTE.rustCss);
        SoundManager.play(e.delta > 0 ? SFX.carrotGain : SFX.carrotLose, 0.45);
        if (e.reason === 'tortoise') {
          const gain = e.delta;
          this.panel.log(() => t('square.tortoise_back', { name: nameOf(e.player)(), gain }));
        }
        await this.delay(e.reason === 'move' ? 120 : 350);
        break;
      }
      case 'stay': {
        const key = e.delta > 0 ? 'square.carrot_gain' : 'square.carrot_pay';
        this.panel.log(() => t(key, { name: nameOf(e.player)() }));
        break;
      }
      case 'lettuceArrive':
        this.panel.log(() => t('square.lettuce_arrive', { name: nameOf(e.player)() }));
        await this.boardView.setLettuceFlip(e.player, true);
        break;
      case 'lettuceChew': {
        SoundManager.play(SFX.lettuceChew);
        await this.boardView.setLettuceFlip(e.player, false);
        const msg = () => t('square.lettuce_chew', { name: nameOf(e.player)(), gain: e.gain, pos: I18n.ordinal(e.position) });
        this.panel.setMessage(msg);
        this.panel.log(msg);
        break;
      }
      case 'bonus':
        this.panel.log(() => t('square.number_bonus', { name: nameOf(e.player)(), pos: I18n.ordinal(e.position), gain: e.amount }));
        this.boardView.pulseToken(e.player);
        break;
      case 'hareDraw': {
        const p = st.player(e.player);
        const choice = e.card === 'WIN_LOSE_10';
        const bot = this.bots.get(p.id);
        const result = await showHareCard(this, e.card, {
          interactive: p.kind === 'human',
          choice,
          canLose: p.carrots >= 10,
          botChoice: choice && bot ? bot.chooseWinLose(st, p.id) : undefined,
          playerLabel: playerName(p),
        });
        if (result !== 'ok') this.choiceResult = result;
        this.panel.log(() => `${nameOf(e.player)()}: ${t(HARE_CARD_I18N[e.card])}`);
        break;
      }
      case 'hareEffect':
        if (e.outcome !== 'moved') this.panel.log(() => `${t('hare.title')} → ${t(`hare.outcome_${e.outcome}`, { amount: e.amount ?? '' })}`);
        break;
      case 'skip':
        this.panel.log(() => t('turn.skipped', { name: nameOf(e.player)() }));
        break;
      case 'restart':
        this.panel.log(() => t('turn.restart', { name: nameOf(e.player)() }));
        SoundManager.play(SFX.hareBad);
        break;
      case 'extraTurn':
        this.panel.log(() => t('turn.extra', { name: nameOf(e.player)() }));
        break;
      case 'finish':
        SoundManager.play(SFX.finish);
        this.panel.log(() => t('square.finish', { name: nameOf(e.player)(), pos: I18n.ordinal(e.place) }));
        await this.boardView.moveToken(e.player, st.home, st.home, 'finish', e.place);
        break;
      case 'turnStart':
      case 'gameOver':
        break;
    }
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const txt = this.add
      .text(x, y, text, { fontFamily: FONT_DISPLAY, fontSize: '26px', color, fontStyle: 'bold', stroke: '#f6ecd2', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(45);
    this.tweens.add({ targets: txt, y: y - 50, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => txt.destroy() });
  }
}
