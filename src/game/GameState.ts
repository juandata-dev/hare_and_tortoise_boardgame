import { BOARD, START_INDEX, SquareType, moveCost } from './Board';
import { HareCardType, HareDeck } from './HareCards';
import { Rng, createRng } from './Random';
import {
  Action,
  LettucePhase,
  RulesPlayer,
  RulesView,
  STARTING_CARROTS,
  STARTING_LETTUCES,
  TORTOISE_REWARD_PER_SQUARE,
  backwardTarget,
  dropBackTarget,
  finishedCount,
  homeIndex,
  isActionLegal,
  lastCarrotBehind,
  legalActions,
  moveUpTarget,
  nextCarrotAhead,
  numberSquareBonus,
  racePosition,
} from './Rules';

export type PlayerKind = 'human' | 'easy' | 'medium';
export type TokenColor = 'red' | 'blue' | 'yellow' | 'green' | 'white' | 'black';
export const TOKEN_COLORS: TokenColor[] = ['red', 'blue', 'yellow', 'green', 'white', 'black'];

export interface PlayerConfig {
  name: string;
  kind: PlayerKind;
  color: TokenColor;
  /** Optional localisable default name (UI concern; e.g. 'setup.player_name' + n). */
  nameKey?: string;
  nameN?: number;
}

export interface PlayerState extends RulesPlayer {
  id: number;
  name: string;
  nameKey?: string;
  nameN?: number;
  kind: PlayerKind;
  color: TokenColor;
  pos: number;
  carrots: number;
  lettuces: number;
  finished: boolean;
  finishPlace: number | null;
  lettucePhase: LettucePhase;
  missNext: boolean;
  /** Carrots paid for the most recent forward move (for "Your last turn was free"). */
  lastMoveCost: number;
  restarts: number;
}

export type Phase = 'turnStart' | 'awaitAction' | 'awaitHareChoice' | 'turnEnd' | 'gameOver';

export type CarrotReason =
  | 'move' | 'tortoise' | 'stay' | 'lettuce' | 'bonus' | 'card' | 'restart';

export type GameEvent =
  | { type: 'turnStart'; player: number }
  | { type: 'move'; player: number; from: number; to: number; cost: number; kind: 'forward' | 'backward' | 'card' | 'restart' }
  | { type: 'carrots'; player: number; delta: number; total: number; reason: CarrotReason }
  | { type: 'stay'; player: number; delta: number }
  | { type: 'lettuceArrive'; player: number }
  | { type: 'lettuceChew'; player: number; gain: number; position: number }
  | { type: 'bonus'; player: number; position: number; amount: number }
  | { type: 'hareDraw'; player: number; card: HareCardType }
  | { type: 'hareEffect'; player: number; card: HareCardType; outcome: string; amount?: number }
  | { type: 'skip'; player: number }
  | { type: 'restart'; player: number }
  | { type: 'extraTurn'; player: number }
  | { type: 'finish'; player: number; place: number }
  | { type: 'gameOver'; ranking: number[] };

export type TurnStartKind = 'normal' | 'skipped' | 'chewed' | 'restarted';

export type Listener = (e: GameEvent) => void;

export interface GameOptions {
  seed?: number;
  rng?: Rng;
  board?: readonly SquareType[];
  hareOrder?: HareCardType[];
  /** Safety cap: the game ends by race position after this many turns. */
  maxTurns?: number;
}

/** Authoritative game state machine. Pure TypeScript — no Phaser dependency. */
export class GameState implements RulesView {
  readonly board: readonly SquareType[];
  readonly players: PlayerState[];
  readonly deck: HareDeck;
  readonly rng: Rng;
  readonly maxTurns: number;

  current = 0;
  phase: Phase = 'turnStart';
  turnCount = 0;
  pendingChoice: HareCardType | null = null;
  ranking: number[] = [];
  private extraTurn = false;
  private listeners = new Set<Listener>();

  constructor(configs: PlayerConfig[], opts: GameOptions = {}) {
    if (configs.length < 2 || configs.length > 4) throw new Error('Hare & Tortoise needs 2–4 players');
    this.rng = opts.rng ?? createRng(opts.seed);
    this.board = opts.board ?? BOARD;
    this.maxTurns = opts.maxTurns ?? 3000;
    this.deck = new HareDeck(this.rng, opts.hareOrder);
    this.players = configs.map((c, id) => ({
      id,
      name: c.name,
      nameKey: c.nameKey,
      nameN: c.nameN,
      kind: c.kind,
      color: c.color,
      pos: START_INDEX,
      carrots: STARTING_CARROTS,
      lettuces: STARTING_LETTUCES,
      finished: false,
      finishPlace: null,
      lettucePhase: 'none',
      missNext: false,
      lastMoveCost: 0,
      restarts: 0,
    }));
  }

  // ── events ────────────────────────────────────────────────────────────
  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: GameEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  // ── queries ───────────────────────────────────────────────────────────
  get home(): number {
    return homeIndex(this);
  }

  get currentPlayer(): PlayerState {
    return this.players[this.current];
  }

  player(id: number): PlayerState {
    return this.players[id];
  }

  position(id: number): number {
    return racePosition(this, id);
  }

  legalActions(id = this.current): Action[] {
    if (this.phase !== 'awaitAction' || id !== this.current) return [];
    return legalActions(this, this.players[id]);
  }

  isOver(): boolean {
    return this.phase === 'gameOver';
  }

  // ── turn flow ─────────────────────────────────────────────────────────
  /**
   * START_TURN → CHECK_STUCK. Resolves everything that happens before the
   * player chooses: missed turns, the lettuce chew, number-square bonuses
   * and the restart rule.
   */
  beginTurn(): TurnStartKind {
    this.assertPhase('turnStart');
    const p = this.currentPlayer;
    this.emit({ type: 'turnStart', player: p.id });

    if (p.missNext) {
      p.missNext = false;
      this.emit({ type: 'skip', player: p.id });
      this.phase = 'turnEnd';
      return 'skipped';
    }

    if (p.lettucePhase === 'arrived') {
      const position = this.position(p.id);
      const gain = 10 * position;
      p.lettuces -= 1;
      p.lettucePhase = 'mustLeave';
      this.emit({ type: 'lettuceChew', player: p.id, gain, position });
      this.addCarrots(p, gain, 'lettuce');
      this.phase = 'turnEnd';
      return 'chewed';
    }

    const bonus = numberSquareBonus(this, p);
    if (bonus > 0) {
      this.emit({ type: 'bonus', player: p.id, position: bonus / 10, amount: bonus });
      this.addCarrots(p, bonus, 'bonus');
    }

    this.phase = 'awaitAction';
    if (legalActions(this, p).length === 0) {
      this.restart(p);
      return 'restarted';
    }
    return 'normal';
  }

  /** WAIT_INPUT → MOVE → RESOLVE_SQUARE. */
  applyAction(action: Action): void {
    this.assertPhase('awaitAction');
    const p = this.currentPlayer;
    if (!isActionLegal(this, p, action)) {
      throw new Error(`Illegal action ${JSON.stringify(action)} for player ${p.id} at ${p.pos}`);
    }
    this.phase = 'turnEnd';

    if (action.type === 'STAY') {
      this.emit({ type: 'stay', player: p.id, delta: action.delta });
      this.addCarrots(p, action.delta, 'stay');
      return;
    }

    if (action.type === 'BACK') {
      const from = p.pos;
      p.pos = action.to;
      p.lettucePhase = 'none';
      this.emit({ type: 'move', player: p.id, from, to: action.to, cost: 0, kind: 'backward' });
      this.addCarrots(p, TORTOISE_REWARD_PER_SQUARE * (from - action.to), 'tortoise');
      return;
    }

    const from = p.pos;
    const cost = moveCost(action.to - from);
    p.pos = action.to;
    p.lettucePhase = 'none';
    p.lastMoveCost = cost;
    this.emit({ type: 'move', player: p.id, from, to: action.to, cost, kind: 'forward' });
    this.addCarrots(p, -cost, 'move');
    this.resolveSquare(p);
  }

  /** Resolve a "Win or lose 10 carrots" choice. */
  resolveHareChoice(choice: 'win' | 'lose'): void {
    this.assertPhase('awaitHareChoice');
    const p = this.currentPlayer;
    const lose = choice === 'lose' && p.carrots >= 10;
    this.pendingChoice = null;
    this.emit({ type: 'hareEffect', player: p.id, card: 'WIN_LOSE_10', outcome: lose ? 'lose' : 'win', amount: 10 });
    this.addCarrots(p, lose ? -10 : 10, 'card');
    this.phase = 'turnEnd';
  }

  /** END_TURN: advance to the next player still racing (or the same one after "Take another turn"). */
  endTurn(): void {
    this.assertPhase('turnEnd');
    this.turnCount++;
    if (this.checkGameOver()) return;
    if (this.extraTurn && !this.currentPlayer.finished) {
      this.extraTurn = false;
    } else {
      this.extraTurn = false;
      do {
        this.current = (this.current + 1) % this.players.length;
      } while (this.players[this.current].finished);
    }
    this.phase = 'turnStart';
  }

  // ── internals ─────────────────────────────────────────────────────────
  private resolveSquare(p: PlayerState): void {
    if (p.pos === this.home) {
      this.finish(p);
      return;
    }
    const sq = this.board[p.pos];
    if (sq === 'LETTUCE') {
      p.lettucePhase = 'arrived';
      this.emit({ type: 'lettuceArrive', player: p.id });
    } else if (sq === 'HARE') {
      this.drawHareCard(p);
    }
  }

  private drawHareCard(p: PlayerState): void {
    const card = this.deck.draw();
    this.emit({ type: 'hareDraw', player: p.id, card });
    const fx = (outcome: string, amount?: number) =>
      this.emit({ type: 'hareEffect', player: p.id, card, outcome, amount });

    switch (card) {
      case 'MISS_TURN':
        p.missNext = true;
        fx('miss');
        break;
      case 'EXTRA_TURN':
        this.extraTurn = true;
        fx('extra');
        this.emit({ type: 'extraTurn', player: p.id });
        break;
      case 'FREE_RIDE':
        fx('refund', p.lastMoveCost);
        this.addCarrots(p, p.lastMoveCost, 'card');
        break;
      case 'CHEW_LETTUCE':
        if (p.lettuces > 0) {
          p.lettucePhase = 'arrived';
          fx('chew');
          this.emit({ type: 'lettuceArrive', player: p.id });
        } else {
          p.missNext = true;
          fx('miss');
        }
        break;
      case 'WIN_LOSE_10':
        this.pendingChoice = card;
        this.phase = 'awaitHareChoice';
        break;
      case 'NEXT_CARROT':
        this.cardMove(p, nextCarrotAhead(this, p), fx);
        break;
      case 'LAST_CARROT':
        this.cardMove(p, lastCarrotBehind(this, p), fx);
        break;
      case 'MOVE_UP':
        this.cardMove(p, moveUpTarget(this, p), fx);
        break;
      case 'DROP_BACK':
        this.cardMove(p, dropBackTarget(this, p), fx);
        break;
    }
  }

  private cardMove(p: PlayerState, to: number | null, fx: (o: string) => void): void {
    if (to === null || to === p.pos) {
      fx('none');
      return;
    }
    const from = p.pos;
    p.pos = to;
    fx('moved');
    this.emit({ type: 'move', player: p.id, from, to, cost: 0, kind: 'card' });
    // A card move never triggers another hare draw nor a tortoise reward,
    // but arriving on a lettuce starts the lettuce sequence.
    if (this.board[to] === 'LETTUCE' && p.lettuces > 0) {
      p.lettucePhase = 'arrived';
      this.emit({ type: 'lettuceArrive', player: p.id });
    }
  }

  /** § 3.8 — back to START with 68 carrots, then move off on this same turn. */
  private restart(p: PlayerState): void {
    const from = p.pos;
    p.pos = START_INDEX;
    p.lettucePhase = 'none';
    p.restarts++;
    this.emit({ type: 'restart', player: p.id });
    this.emit({ type: 'move', player: p.id, from, to: START_INDEX, cost: 0, kind: 'restart' });
    const delta = STARTING_CARROTS - p.carrots;
    p.carrots = STARTING_CARROTS;
    this.emit({ type: 'carrots', player: p.id, delta, total: p.carrots, reason: 'restart' });
  }

  private finish(p: PlayerState): void {
    p.finished = true;
    p.finishPlace = finishedCount(this);
    p.lettucePhase = 'none';
    this.ranking.push(p.id);
    this.emit({ type: 'finish', player: p.id, place: p.finishPlace });
  }

  private checkGameOver(): boolean {
    const racing = this.players.filter((p) => !p.finished);
    if (racing.length > 1 && this.turnCount < this.maxTurns) return false;
    // Remaining players are ranked by their race position.
    racing
      .sort((a, b) => racePosition(this, a.id) - racePosition(this, b.id) || a.carrots - b.carrots)
      .forEach((p) => {
        if (!this.ranking.includes(p.id)) this.ranking.push(p.id);
      });
    this.phase = 'gameOver';
    this.emit({ type: 'gameOver', ranking: this.ranking.slice() });
    return true;
  }

  private addCarrots(p: PlayerState, delta: number, reason: CarrotReason): void {
    if (delta === 0) return;
    p.carrots += delta;
    this.emit({ type: 'carrots', player: p.id, delta, total: p.carrots, reason });
  }

  private assertPhase(expected: Phase): void {
    if (this.phase !== expected) throw new Error(`Expected phase ${expected}, got ${this.phase}`);
  }

  /** Lightweight copy for AI look-ahead (no listeners). */
  snapshot(): RulesView {
    return {
      board: this.board,
      players: this.players.map((p) => ({ ...p })),
    };
  }

  canMoveBackward(id = this.current): boolean {
    return backwardTarget(this, this.players[id]) !== null;
  }
}
