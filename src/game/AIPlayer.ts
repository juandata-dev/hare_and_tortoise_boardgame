import { moveCost, numberOfSquare } from './Board';
import { Rng, pickWeighted } from './Random';
import {
  Action,
  RulesPlayer,
  RulesView,
  actionCarrotDelta,
  canFinishWith,
  finishCarrotLimit,
  finishedCount,
  homeIndex,
  legalActions,
  racePosition,
} from './Rules';

export type AIDifficulty = 'easy' | 'medium';

/**
 * Bot decision engine. Receives a read-only view of the game and returns an
 * action; never mutates the view. Runs in well under 100 ms.
 */
export class AIPlayer {
  constructor(readonly difficulty: AIDifficulty, private readonly rng: Rng) {}

  chooseAction(view: RulesView, playerId: number): Action {
    const me = view.players.find((p) => p.id === playerId);
    if (!me) throw new Error(`Unknown player ${playerId}`);
    const actions = legalActions(view, me);
    if (actions.length === 0) throw new Error('AI asked to move with no legal actions');
    const finish = actions.find((a) => a.type === 'MOVE' && a.to === homeIndex(view));
    if (finish) return finish;
    return this.difficulty === 'easy' ? this.chooseEasy(view, me, actions) : this.chooseMedium(view, me, actions);
  }

  /** "Win or lose 10 carrots": true = win (take 10). */
  chooseWinLose(view: RulesView, playerId: number): 'win' | 'lose' {
    const me = view.players.find((p) => p.id === playerId)!;
    if (this.difficulty === 'easy') return 'win';
    if (me.carrots < 10) return 'win';
    // Near home, shed carrots if we are above the finishing budget.
    if (me.lettuces === 0 && me.pos >= homeIndex(view) - 10) {
      const need = moveCost(homeIndex(view) - me.pos);
      const limit = finishCarrotLimit(finishedCount(view) + 1);
      return me.carrots - need > limit ? 'lose' : 'win';
    }
    return me.carrots < 60 ? 'win' : 'lose';
  }

  // ── Easy ──────────────────────────────────────────────────────────────
  private chooseEasy(view: RulesView, me: RulesPlayer, actions: Action[]): Action {
    const back = actions.find((a) => a.type === 'BACK');
    const forward = actions.filter((a) => a.type === 'MOVE');
    const stays = actions.filter((a) => a.type === 'STAY');

    if (back && me.carrots < 20 && this.rng() < 0.2) return back;
    // Stranded holding lettuces past the last lettuce square: head back.
    if (back && me.lettuces > 0 && !lettuceAhead(view, me.pos)) return back;

    const pool = [...forward, ...stays];
    if (pool.length === 0) return back ?? actions[0];
    return pickWeighted(
      pool.map((a) => ({ item: a, weight: this.easyWeight(view, me, a) })),
      this.rng,
    );
  }

  private easyWeight(view: RulesView, me: RulesPlayer, a: Action): number {
    if (a.type === 'STAY') {
      // Near home with too many carrots, even an easy bot sheds them.
      const tooMany = me.lettuces === 0 && me.carrots > desiredCarrots(view, homeIndex(view) - me.pos) + 10;
      if (tooMany) return a.delta < 0 ? 3 : 0.2;
      return me.carrots < 30 && a.delta > 0 ? 1.5 : 0.5;
    }
    if (a.type !== 'MOVE') return 1;
    const sq = view.board[a.to];
    let w = 1;
    if (sq === 'LETTUCE' && me.lettuces > 0) w *= 2;
    if (sq === 'CARROT' && me.carrots < 30) w *= 1.5;
    // Easy bots still avoid moves that leave them almost broke.
    if (me.carrots + actionCarrotDelta(me, a) < 5) w *= 0.3;
    return w;
  }

  // ── Medium ────────────────────────────────────────────────────────────
  private chooseMedium(view: RulesView, me: RulesPlayer, actions: Action[]): Action {
    let best: Action[] = [];
    let bestScore = -Infinity;
    for (const a of actions) {
      const s = this.scoreMedium(view, me, a);
      if (s > bestScore + 1e-9) {
        bestScore = s;
        best = [a];
      } else if (Math.abs(s - bestScore) <= 1e-9) {
        best.push(a);
      }
    }
    return best[Math.floor(this.rng() * best.length)];
  }

  /** Heuristic score for one action (§ 7.2). */
  scoreMedium(view: RulesView, me: RulesPlayer, a: Action): number {
    const home = homeIndex(view);
    const carrotsAfter = me.carrots + actionCarrotDelta(me, a);
    const to = a.type === 'STAY' ? me.pos : a.to;
    const sq = view.board[to];
    let score = 0;

    if (a.type === 'MOVE' && to === home && canFinishWith(view, me.lettuces, carrotsAfter)) return 1000;

    // Advance progress: +1 per square of net forward progress.
    score += to - me.pos;

    if (a.type === 'MOVE') {
      if (sq === 'LETTUCE' && me.lettuces > 0) score += 80;
      const n = numberOfSquare(sq);
      if (n !== null && predictedPosition(view, me, to) === n) score += 50;
      if (sq === 'HARE') score += (this.rng() * 2 - 1) * 10;
      if (me.carrots > 80 && -actionCarrotDelta(me, a) >= 20) score += 20;
    }

    if (a.type === 'BACK' && me.carrots < 20) score += 35;

    const endgame = me.lettuces === 0 && home - to <= 10;
    if (carrotsAfter < 15 && !endgame) score -= 40;

    // ── planning extras so the bot actually reaches HOME ──
    const remainingLettuceAhead = lettuceAhead(view, to);
    const lettucesAfter = me.lettuces;
    if (lettucesAfter > 0 && !remainingLettuceAhead && !(a.type === 'MOVE' && sq === 'LETTUCE')) {
      // Holding lettuces with no lettuce square left ahead: must retreat.
      score -= a.type === 'BACK' ? 0 : 120;
    }

    const distHome = home - to;
    // Carrot budget: keep roughly what is needed to reach HOME and finish.
    if (lettucesAfter === 0 || (sq === 'LETTUCE' && lettucesAfter === 1)) {
      const excess = carrotsAfter - desiredCarrots(view, distHome);
      if (excess > 0) score -= excess * 0.3;
      else score += excess * (distHome <= 10 ? 0.5 : 0.25);
    } else if (carrotsAfter > 140) {
      score -= (carrotsAfter - 140) * 0.1;
    }

    // Waiting on a carrot square is only useful to fix the carrot budget.
    if (a.type === 'STAY') {
      score -= 6;
      if (a.delta > 0 && me.carrots < 25 && !endgame) score += 10;
    }
    return score;
  }
}

/** Rough carrots wanted with `dist` squares left: travel cost plus half the finish allowance. */
function desiredCarrots(view: RulesView, dist: number): number {
  const travel = dist <= 6 ? moveCost(dist) : 3.5 * dist;
  return travel + finishCarrotLimit(finishedCount(view) + 1) / 2;
}

function lettuceAhead(view: RulesView, pos: number): boolean {
  for (let i = pos + 1; i < view.board.length; i++) if (view.board[i] === 'LETTUCE') return true;
  return false;
}

function predictedPosition(view: RulesView, me: RulesPlayer, to: number): number {
  const moved: RulesView = {
    board: view.board,
    players: view.players.map((p) => (p.id === me.id ? { ...p, pos: to } : p)),
  };
  return racePosition(moved, me.id);
}
