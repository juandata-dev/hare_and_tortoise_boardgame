import { describe, expect, it } from 'vitest';
import { AIPlayer } from '../src/game/AIPlayer';
import { GameState, PlayerConfig, PlayerKind } from '../src/game/GameState';
import { createRng } from '../src/game/Random';
import { legalActions } from '../src/game/Rules';

const COLORS = ['red', 'blue', 'yellow', 'green'] as const;

export function simulate(kinds: Exclude<PlayerKind, 'human'>[], seed: number) {
  const configs: PlayerConfig[] = kinds.map((kind, i) => ({ name: `B${i}`, kind, color: COLORS[i] }));
  const g = new GameState(configs, { seed, maxTurns: 4000 });
  const rng = createRng(seed * 7 + 3);
  const bots = kinds.map((k) => new AIPlayer(k, rng));
  let maxMs = 0;
  while (!g.isOver()) {
    const kind = g.beginTurn();
    if (kind === 'normal' || kind === 'restarted') {
      const t0 = performance.now();
      const a = bots[g.current].chooseAction(g, g.current);
      maxMs = Math.max(maxMs, performance.now() - t0);
      expect(legalActions(g, g.currentPlayer).length).toBeGreaterThan(0);
      g.applyAction(a);
      if (g.phase === 'awaitHareChoice') g.resolveHareChoice(bots[g.current].chooseWinLose(g, g.current));
    }
    g.endTurn();
  }
  return { g, maxMs };
}

describe('AI', () => {
  const configs: Exclude<PlayerKind, 'human'>[][] = [
    ['easy', 'easy'],
    ['medium', 'medium'],
    ['easy', 'medium', 'easy'],
    ['medium', 'easy', 'medium', 'easy'],
  ];
  for (const kinds of configs) {
    it(`${kinds.join(' vs ')} always plays legally and finishes`, () => {
      let capped = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const { g, maxMs } = simulate(kinds, seed);
        expect(g.ranking).toHaveLength(kinds.length);
        expect(maxMs).toBeLessThan(100);
        if (g.turnCount >= g.maxTurns) capped++;
      }
      expect(capped).toBe(0);
    });
  }

  it('medium beats easy most of the time', () => {
    let mediumWins = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const { g } = simulate(seed % 2 ? ['medium', 'easy'] : ['easy', 'medium'], seed);
      if (g.players[g.ranking[0]].kind === 'medium') mediumWins++;
    }
    expect(mediumWins).toBeGreaterThan(60);
  });
});
