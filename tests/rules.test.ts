import { describe, expect, it } from 'vitest';
import { BOARD, HOME_INDEX, SquareType, countSquares, maxDistance, moveCost } from '../src/game/Board';
import { GameState, PlayerConfig, PlayerState } from '../src/game/GameState';
import { HARE_DECK_COMPOSITION, HareCardType } from '../src/game/HareCards';
import {
  Action,
  backwardTarget,
  forwardMoveError,
  legalActions,
  numberSquareBonus,
  racePosition,
} from '../src/game/Rules';

const P = (n: number, kind: PlayerConfig['kind'] = 'human'): PlayerConfig[] =>
  (['red', 'blue', 'yellow', 'green'] as const).slice(0, n).map((color, i) => ({ name: `P${i + 1}`, kind, color }));

function game(n = 2, hareOrder?: HareCardType[], seed = 1) {
  return new GameState(P(n), { seed, hareOrder });
}

function place(g: GameState, id: number, patch: Partial<PlayerState>) {
  Object.assign(g.players[id], patch);
}

function act(g: GameState, a: Action) {
  g.beginTurn();
  g.applyAction(a);
}

function idx(type: SquareType, after = 0): number {
  return BOARD.findIndex((s, i) => i > after && s === type);
}

describe('board', () => {
  it('has START, 63 race squares and HOME', () => {
    expect(BOARD.length).toBe(65);
    expect(BOARD[0]).toBe('START');
    expect(BOARD[HOME_INDEX]).toBe('HOME');
    expect(BOARD[10]).toBe('LETTUCE');
    const c = countSquares();
    expect(c.TORTOISE).toBe(9);
    expect(c.LETTUCE).toBe(4);
    expect(c.FLAG).toBe(5);
  });
});

describe('movement cost', () => {
  const expected = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66, 78, 91, 105, 120, 136, 153, 171, 190, 210];
  for (let n = 1; n <= 20; n++) {
    it(`n=${n} costs ${expected[n - 1]}`, () => {
      expect(moveCost(n)).toBe(expected[n - 1]);
      expect(moveCost(n)).toBe((n * (n + 1)) / 2);
    });
  }
  it('maxDistance inverts the cost', () => {
    expect(maxDistance(68)).toBe(11);
    expect(maxDistance(66)).toBe(11);
    expect(maxDistance(65)).toBe(10);
    expect(maxDistance(0)).toBe(0);
  });
});

describe('forward moves', () => {
  it('pays before moving and never lands on a tortoise', () => {
    const g = game();
    const acts = (g.beginTurn(), g.legalActions());
    expect(acts.some((a) => a.type === 'MOVE' && a.to === 11)).toBe(false); // 11 = tortoise
    g.applyAction({ type: 'MOVE', to: 2 });
    expect(g.players[0].carrots).toBe(68 - 3);
  });
  it('blocks occupied squares', () => {
    const g = game();
    place(g, 1, { pos: 2 });
    expect(forwardMoveError(g, g.players[0], 2)).toBe('error.occupied');
  });
  it('requires a lettuce card to land on a lettuce square', () => {
    const g = game();
    place(g, 0, { lettuces: 0 });
    expect(forwardMoveError(g, g.players[0], 10)).toBe('error.lettuce_required');
  });
});

describe('tortoise', () => {
  it('backward move earns 10 per square and is free', () => {
    const g = game();
    place(g, 0, { pos: 14, carrots: 5 });
    act(g, { type: 'BACK', to: 11 });
    expect(g.players[0].pos).toBe(11);
    expect(g.players[0].carrots).toBe(5 + 30);
  });
  it('is blocked when the nearest tortoise is occupied', () => {
    const g = game();
    place(g, 0, { pos: 18 });
    place(g, 1, { pos: 15 });
    expect(backwardTarget(g, g.players[0])).toBeNull();
  });
  it('can chain on the following turn', () => {
    const g = game();
    place(g, 0, { pos: 15 });
    expect(backwardTarget(g, g.players[0])).toBe(11);
  });
});

describe('carrot square', () => {
  it('allows staying for ±10', () => {
    const g = game();
    place(g, 0, { pos: 2 });
    g.beginTurn();
    const stays = g.legalActions().filter((a) => a.type === 'STAY');
    expect(stays).toHaveLength(2);
    g.applyAction({ type: 'STAY', delta: -10 });
    expect(g.players[0].carrots).toBe(58);
  });
});

describe('number / flag squares', () => {
  it('pay 10×position at the start of the next turn when position matches', () => {
    const g = game(3);
    place(g, 0, { pos: 8 }); // POS_2
    place(g, 1, { pos: 9 });
    expect(racePosition(g, 0)).toBe(2);
    g.beginTurn();
    expect(g.players[0].carrots).toBe(68 + 20);
  });
  it('lose the bonus when overtaken', () => {
    const g = game(3);
    place(g, 0, { pos: 8 });
    place(g, 1, { pos: 9 });
    place(g, 2, { pos: 12 });
    expect(racePosition(g, 0)).toBe(3);
    expect(numberSquareBonus(g, g.players[0])).toBe(0);
  });
  it('never pay POS_3/POS_4 in a 2-player game', () => {
    const g = game(2);
    place(g, 0, { pos: 4 }); // POS_3
    expect(numberSquareBonus(g, g.players[0])).toBe(0);
    place(g, 0, { pos: 9 }); // POS_4
    expect(numberSquareBonus(g, g.players[0])).toBe(0);
  });
  it('never pay POS_4 in a 3-player game', () => {
    const g = game(3);
    place(g, 0, { pos: 9 });
    place(g, 1, { pos: 20 });
    place(g, 2, { pos: 21 });
    expect(racePosition(g, 0)).toBe(3);
    expect(numberSquareBonus(g, g.players[0])).toBe(0);
  });
  it('flag pays 10 to the leader', () => {
    const g = game(2);
    place(g, 0, { pos: 7 });
    expect(numberSquareBonus(g, g.players[0])).toBe(10);
  });
});

describe('lettuce sequence', () => {
  it('arrive → chew (cannot move) → must depart', () => {
    const g = game(2);
    place(g, 1, { pos: 5 });
    act(g, { type: 'MOVE', to: 10 });
    expect(g.players[0].lettucePhase).toBe('arrived');
    g.endTurn();
    g.beginTurn(); g.applyAction({ type: 'STAY', delta: 10 }); g.endTurn(); // P2 waits on carrot 5
    expect(g.beginTurn()).toBe('chewed');
    expect(g.players[0].lettuces).toBe(2);
    expect(g.players[0].carrots).toBe(68 - 55 + 10); // 1st place chew
    expect(g.phase).toBe('turnEnd');
    g.endTurn();
    g.beginTurn(); g.applyAction({ type: 'STAY', delta: 10 }); g.endTurn();
    g.beginTurn();
    const acts = g.legalActions();
    expect(acts.length).toBeGreaterThan(0);
    expect(acts.every((a) => a.type !== 'STAY')).toBe(true);
    expect(acts.some((a) => a.type === 'MOVE' && a.to === 10)).toBe(false);
  });
});

describe('finishing', () => {
  it('cannot finish with lettuces remaining', () => {
    const g = game();
    place(g, 0, { pos: 63, carrots: 5, lettuces: 1 });
    expect(forwardMoveError(g, g.players[0], HOME_INDEX)).toBe('error.finish_lettuce');
  });
  it('cannot finish with excess carrots', () => {
    const g = game();
    place(g, 0, { pos: 63, carrots: 12, lettuces: 0 });
    expect(forwardMoveError(g, g.players[0], HOME_INDEX)).toBe('error.finish_carrots');
    place(g, 0, { carrots: 11 });
    expect(forwardMoveError(g, g.players[0], HOME_INDEX)).toBeNull();
  });
  it('second finisher may hold up to 20', () => {
    const g = game(3);
    place(g, 1, { finished: true, finishPlace: 1, pos: HOME_INDEX });
    place(g, 0, { pos: 63, carrots: 21, lettuces: 0 });
    expect(forwardMoveError(g, g.players[0], HOME_INDEX)).toBeNull();
    place(g, 0, { carrots: 22 });
    expect(forwardMoveError(g, g.players[0], HOME_INDEX)).toBe('error.finish_carrots');
  });
  it('finished players count as ahead', () => {
    const g = game(3);
    place(g, 1, { finished: true, finishPlace: 1, pos: HOME_INDEX });
    place(g, 0, { pos: 40 });
    place(g, 2, { pos: 30 });
    expect(racePosition(g, 0)).toBe(2);
  });
  it('ends the game when only one player is left', () => {
    const g = game(2);
    place(g, 0, { pos: 63, carrots: 5, lettuces: 0 });
    act(g, { type: 'MOVE', to: HOME_INDEX });
    g.endTurn();
    expect(g.isOver()).toBe(true);
    expect(g.ranking).toEqual([0, 1]);
  });
});

describe('restart rule', () => {
  it('returns to START with 68 carrots and moves off on the same turn', () => {
    const g = game(2);
    // Square 12 (POS_3): nearest tortoise behind is 11, occupied; 1 carrot can't reach 13? 13 = carrot, costs 1.
    place(g, 0, { pos: 12, carrots: 0 });
    place(g, 1, { pos: 11 });
    expect(legalActions(g, g.players[0])).toHaveLength(0);
    expect(g.beginTurn()).toBe('restarted');
    expect(g.players[0].pos).toBe(0);
    expect(g.players[0].carrots).toBe(68);
    expect(g.phase).toBe('awaitAction');
    expect(g.legalActions().length).toBeGreaterThan(0);
  });
  it('keeps chewed lettuces discarded', () => {
    const g = game(2);
    place(g, 0, { pos: 12, carrots: 0, lettuces: 1 });
    place(g, 1, { pos: 11 });
    g.beginTurn();
    expect(g.players[0].lettuces).toBe(1);
  });
});

describe('hare cards', () => {
  it('deck has 12 cards in Ravensburger composition', () => {
    expect(Object.values(HARE_DECK_COMPOSITION).reduce((a, b) => a + b, 0)).toBe(12);
  });

  const onHare = (card: HareCardType, setup?: (g: GameState) => void) => {
    const g = game(3, [card]);
    setup?.(g);
    g.beginTurn();
    const p = g.players[0];
    const target = idx('HARE', p.pos);
    g.applyAction({ type: 'MOVE', to: target });
    return g;
  };

  it('Miss a turn skips the next turn', () => {
    const g = onHare('MISS_TURN');
    g.endTurn();
    g.beginTurn(); g.applyAction({ type: 'MOVE', to: 2 }); g.endTurn();
    g.beginTurn(); g.applyAction({ type: 'MOVE', to: 5 }); g.endTurn();
    expect(g.beginTurn()).toBe('skipped');
  });
  it('Take another turn gives the same player another turn', () => {
    const g = onHare('EXTRA_TURN');
    g.endTurn();
    expect(g.current).toBe(0);
  });
  it('Your last turn was free refunds the move', () => {
    const g = onHare('FREE_RIDE');
    expect(g.players[0].carrots).toBe(68);
  });
  it('Chew a lettuce with lettuces starts the sequence', () => {
    const g = onHare('CHEW_LETTUCE');
    expect(g.players[0].lettucePhase).toBe('arrived');
  });
  it('Chew a lettuce without lettuces misses a turn', () => {
    const g = onHare('CHEW_LETTUCE', (g) => place(g, 0, { lettuces: 0 }));
    expect(g.players[0].missNext).toBe(true);
  });
  it('Win or lose 10 asks for a choice', () => {
    const g = onHare('WIN_LOSE_10');
    expect(g.phase).toBe('awaitHareChoice');
    g.resolveHareChoice('lose');
    expect(g.players[0].carrots).toBe(68 - 1 - 10);
    expect(g.phase).toBe('turnEnd');
  });
  it('Move to next carrot square', () => {
    const g = onHare('NEXT_CARROT');
    expect(g.players[0].pos).toBe(2);
  });
  it('Move to next carrot skips occupied carrot squares', () => {
    const g = onHare('NEXT_CARROT', (g) => place(g, 1, { pos: 2 }));
    expect(g.players[0].pos).toBe(5);
  });
  it('Go back to last carrot square', () => {
    const g = onHare('LAST_CARROT', (g) => place(g, 0, { pos: 10, lettucePhase: 'mustLeave' }));
    expect(g.players[0].pos).toBe(13);
  });
  it('Go back with no carrot behind does nothing', () => {
    const g = onHare('LAST_CARROT');
    expect(g.players[0].pos).toBe(1);
  });
  it('Move up one position jumps just ahead of the next player (skipping tortoises)', () => {
    const g = onHare('MOVE_UP', (g) => {
      place(g, 1, { pos: 10 }); // lettuce; 11 is tortoise → lands on 12
    });
    expect(g.players[0].pos).toBe(12);
  });
  it('Move up one position has no effect when leading', () => {
    const g = onHare('MOVE_UP');
    expect(g.players[0].pos).toBe(1);
  });
  it('Drop back one position lands behind the next player, tortoise without reward', () => {
    const g = onHare('DROP_BACK', (g) => {
      place(g, 0, { pos: 13, lettucePhase: 'none' });
      place(g, 1, { pos: 12 });
      place(g, 2, { pos: 30 });
    });
    // hare at 14; player behind is on 12 → first legal square behind is 11 (tortoise)
    expect(g.players[0].pos).toBe(11);
    expect(g.players[0].carrots).toBe(68 - 1);
  });
  it('Drop back one position has no effect when last', () => {
    const g = onHare('DROP_BACK', (g) => {
      place(g, 1, { pos: 20 });
      place(g, 2, { pos: 21 });
    });
    expect(g.players[0].pos).toBe(1);
  });
});
