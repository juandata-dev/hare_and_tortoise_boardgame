import { BOARD, HOME_INDEX, START_INDEX, SquareType, maxDistance, moveCost, numberOfSquare } from './Board';

export const STARTING_CARROTS = 68;
export const STARTING_LETTUCES = 3;
export const CARROT_SQUARE_EXCHANGE = 10;
export const TORTOISE_REWARD_PER_SQUARE = 10;

export type LettucePhase = 'none' | 'arrived' | 'mustLeave';

/** Minimal read-only view of a player needed by the rules. */
export interface RulesPlayer {
  readonly id: number;
  readonly pos: number;
  readonly carrots: number;
  readonly lettuces: number;
  readonly finished: boolean;
  readonly finishPlace: number | null;
  readonly lettucePhase: LettucePhase;
}

export interface RulesView {
  readonly board: readonly SquareType[];
  readonly players: readonly RulesPlayer[];
}

export type Action =
  | { type: 'MOVE'; to: number }        // forward move, paid with carrots
  | { type: 'BACK'; to: number }        // free backward move to the nearest tortoise
  | { type: 'STAY'; delta: 10 | -10 };  // wait on a carrot square

export function homeIndex(view: RulesView): number {
  return view.board.length - 1;
}

export function finishedCount(view: RulesView): number {
  return view.players.filter((p) => p.finished).length;
}

/** Squares other than START/HOME hold at most one piece. */
export function isOccupied(view: RulesView, index: number, exceptId?: number): boolean {
  if (index === START_INDEX || index === homeIndex(view)) return false;
  return view.players.some((p) => p.id !== exceptId && !p.finished && p.pos === index);
}

/**
 * Race position (1 = leading). Finished players are always ahead of anyone
 * still racing, in their finishing order.
 */
export function racePosition(view: RulesView, playerId: number): number {
  const me = view.players.find((p) => p.id === playerId);
  if (!me) throw new Error(`Unknown player ${playerId}`);
  if (me.finished && me.finishPlace !== null) return me.finishPlace;
  const ahead = view.players.filter((p) => p.id !== me.id && (p.finished || p.pos > me.pos)).length;
  return ahead + 1;
}

/** Maximum carrots allowed after paying to finish in the given place. */
export function finishCarrotLimit(place: number): number {
  return 10 * place;
}

export function canFinishWith(view: RulesView, lettuces: number, carrotsAfter: number): boolean {
  return lettuces === 0 && carrotsAfter >= 0 && carrotsAfter <= finishCarrotLimit(finishedCount(view) + 1);
}

export function nearestTortoiseBehind(view: RulesView, pos: number): number | null {
  for (let i = pos - 1; i > START_INDEX; i--) {
    if (view.board[i] === 'TORTOISE') return i;
  }
  return null;
}

export function backwardTarget(view: RulesView, player: RulesPlayer): number | null {
  const t = nearestTortoiseBehind(view, player.pos);
  if (t === null) return null;
  return isOccupied(view, t, player.id) ? null : t;
}

/** Why a forward destination is illegal, or null if legal. Used for UI errors. */
export function forwardMoveError(view: RulesView, player: RulesPlayer, to: number): string | null {
  const home = homeIndex(view);
  const n = to - player.pos;
  if (n <= 0) return 'error.not_forward';
  if (to > home) return 'error.overshoot';
  const cost = moveCost(n);
  if (cost > player.carrots) return 'error.no_carrot';
  const sq = view.board[to];
  if (to === home) {
    if (player.lettuces > 0) return 'error.finish_lettuce';
    if (!canFinishWith(view, player.lettuces, player.carrots - cost)) return 'error.finish_carrots';
    return null;
  }
  if (isOccupied(view, to, player.id)) return 'error.occupied';
  if (sq === 'TORTOISE') return 'error.tortoise_forward';
  if (sq === 'LETTUCE' && player.lettuces === 0) return 'error.lettuce_required';
  return null;
}

export function legalActions(view: RulesView, player: RulesPlayer): Action[] {
  if (player.finished) return [];
  // Turn 2 on a lettuce: the chew is automatic and the player cannot move.
  if (player.lettucePhase === 'arrived') return [];
  const actions: Action[] = [];
  const home = homeIndex(view);
  const maxN = Math.min(maxDistance(player.carrots), home - player.pos);
  for (let n = 1; n <= maxN; n++) {
    const to = player.pos + n;
    if (forwardMoveError(view, player, to) === null) actions.push({ type: 'MOVE', to });
  }
  const back = backwardTarget(view, player);
  if (back !== null) actions.push({ type: 'BACK', to: back });
  if (view.board[player.pos] === 'CARROT' && player.lettucePhase !== 'mustLeave') {
    actions.push({ type: 'STAY', delta: 10 });
    if (player.carrots >= CARROT_SQUARE_EXCHANGE) actions.push({ type: 'STAY', delta: -10 });
  }
  return actions;
}

export function isActionLegal(view: RulesView, player: RulesPlayer, action: Action): boolean {
  return legalActions(view, player).some((a) => sameAction(a, action));
}

export function sameAction(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'STAY' && b.type === 'STAY') return a.delta === b.delta;
  if (a.type !== 'STAY' && b.type !== 'STAY') return a.to === b.to;
  return false;
}

/** Carrots paid (positive) or received (negative) by an action, excluding square effects. */
export function actionCarrotDelta(player: RulesPlayer, action: Action): number {
  switch (action.type) {
    case 'MOVE': return -moveCost(action.to - player.pos);
    case 'BACK': return TORTOISE_REWARD_PER_SQUARE * (player.pos - action.to);
    case 'STAY': return action.delta;
  }
}

/** Bonus collected at the start of a turn on a number/flag square, or 0. */
export function numberSquareBonus(view: RulesView, player: RulesPlayer): number {
  if (player.finished) return 0;
  const n = numberOfSquare(view.board[player.pos]);
  if (n === null) return 0;
  return racePosition(view, player.id) === n ? 10 * n : 0;
}

/** Destination for "Move up one position", or null when the card has no effect. */
export function moveUpTarget(view: RulesView, player: RulesPlayer): number | null {
  const home = homeIndex(view);
  const ahead = view.players
    .filter((p) => p.id !== player.id && !p.finished && p.pos > player.pos)
    .sort((a, b) => a.pos - b.pos)[0];
  if (!ahead) return null;
  for (let i = ahead.pos + 1; i < home; i++) {
    if (cardLandingOk(view, player, i)) return i;
  }
  return null;
}

/** Destination for "Drop back one position", or null when the card has no effect. */
export function dropBackTarget(view: RulesView, player: RulesPlayer): number | null {
  const behind = view.players
    .filter((p) => p.id !== player.id && !p.finished && p.pos < player.pos)
    .sort((a, b) => b.pos - a.pos)[0];
  if (!behind) return null;
  for (let i = behind.pos - 1; i > START_INDEX; i--) {
    if (cardLandingOk(view, player, i)) return i;
  }
  return START_INDEX;
}

function cardLandingOk(view: RulesView, player: RulesPlayer, i: number): boolean {
  const sq = view.board[i];
  if (isOccupied(view, i, player.id)) return false;
  if (sq === 'TORTOISE' && i > player.pos) return false;
  if (sq === 'LETTUCE' && player.lettuces === 0) return false;
  return true;
}

export function nextCarrotAhead(view: RulesView, player: RulesPlayer): number | null {
  for (let i = player.pos + 1; i < homeIndex(view); i++) {
    if (view.board[i] === 'CARROT' && !isOccupied(view, i, player.id)) return i;
  }
  return null;
}

export function lastCarrotBehind(view: RulesView, player: RulesPlayer): number | null {
  for (let i = player.pos - 1; i > START_INDEX; i--) {
    if (view.board[i] === 'CARROT' && !isOccupied(view, i, player.id)) return i;
  }
  return null;
}

export { BOARD, HOME_INDEX, START_INDEX, moveCost };
