export type SquareType =
  | 'START'    // position 0
  | 'CARROT'   // draw/pay ±10 per turn while waiting
  | 'FLAG'     // position 1 (also 5th/6th in 5–6 player games)
  | 'POS_2'    // position 2 number square
  | 'POS_3'    // position 3 number square
  | 'POS_4'    // position 4 number square
  | 'LETTUCE'  // chew a lettuce over 3 turns
  | 'HARE'     // draw a hare card
  | 'TORTOISE' // backward-move destination; earn 10 carrots/square
  | 'HOME';    // finish line (last index)

/**
 * Standard Ravensburger track (post-1986 edition): START, 63 race squares, HOME.
 *
 * Verified against the Software Challenge reference implementation of
 * Hase und Igel (software-challenge/backend, games/hui/.../plugin2025/Board.kt).
 * That generator keeps the official lettuce/tortoise indices and lists every
 * segment in the original board order before optionally shuffling it, so the
 * unshuffled order below is the printed board:
 *  - 9 tortoise squares at 11, 15, 19, 24, 30, 37, 43, 50, 56
 *  - 4 lettuce squares at 10 (first lettuce, as confirmed by D. Parlett), 22, 42, 57
 *  - the final stretch is fixed: HARE, CARROT, FLAG, CARROT, HARE, CARROT, HOME
 *
 * Note: the PRD draft assumed 66 positions (HOME = 65). The verified board has
 * 65 positions (HOME = 64). All rules read from this array and HOME_INDEX.
 */
export const BOARD: readonly SquareType[] = [
  'START',    // 0
  'HARE',     // 1
  'CARROT',   // 2
  'HARE',     // 3
  'POS_3',    // 4
  'CARROT',   // 5
  'HARE',     // 6
  'FLAG',     // 7
  'POS_2',    // 8
  'POS_4',    // 9
  'LETTUCE',  // 10  ← first lettuce
  'TORTOISE', // 11
  'POS_3',    // 12
  'CARROT',   // 13
  'HARE',     // 14
  'TORTOISE', // 15
  'FLAG',     // 16
  'POS_2',    // 17
  'POS_4',    // 18
  'TORTOISE', // 19
  'POS_3',    // 20
  'CARROT',   // 21
  'LETTUCE',  // 22
  'POS_2',    // 23
  'TORTOISE', // 24
  'HARE',     // 25
  'CARROT',   // 26
  'POS_4',    // 27
  'POS_3',    // 28
  'POS_2',    // 29
  'TORTOISE', // 30
  'HARE',     // 31
  'FLAG',     // 32
  'CARROT',   // 33
  'HARE',     // 34
  'POS_2',    // 35
  'POS_3',    // 36
  'TORTOISE', // 37
  'CARROT',   // 38
  'HARE',     // 39
  'CARROT',   // 40
  'POS_2',    // 41
  'LETTUCE',  // 42
  'TORTOISE', // 43
  'POS_3',    // 44
  'POS_4',    // 45
  'HARE',     // 46
  'POS_2',    // 47
  'FLAG',     // 48
  'CARROT',   // 49
  'TORTOISE', // 50
  'HARE',     // 51
  'POS_3',    // 52
  'POS_2',    // 53
  'POS_4',    // 54
  'CARROT',   // 55
  'TORTOISE', // 56
  'LETTUCE',  // 57
  'HARE',     // 58
  'CARROT',   // 59
  'FLAG',     // 60
  'CARROT',   // 61
  'HARE',     // 62
  'CARROT',   // 63
  'HOME',     // 64
];

export const START_INDEX = 0;
export const HOME_INDEX = BOARD.length - 1;

export function squareAt(index: number, board: readonly SquareType[] = BOARD): SquareType {
  const sq = board[index];
  if (sq === undefined) throw new Error(`Invalid square index ${index}`);
  return sq;
}

/** Race position that a number/flag square pays out for, or null. */
export function numberOfSquare(type: SquareType): number | null {
  switch (type) {
    case 'FLAG': return 1;
    case 'POS_2': return 2;
    case 'POS_3': return 3;
    case 'POS_4': return 4;
    default: return null;
  }
}

export function isNumberSquare(type: SquareType): boolean {
  return numberOfSquare(type) !== null;
}

/** Movement cost for n squares forward: n(n+1)/2. */
export function moveCost(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid distance ${n}`);
  return (n * (n + 1)) / 2;
}

/** Largest distance affordable with the given carrots. */
export function maxDistance(carrots: number): number {
  return Math.floor((Math.sqrt(8 * carrots + 1) - 1) / 2);
}

export function countSquares(board: readonly SquareType[] = BOARD): Record<SquareType, number> {
  const out = {
    START: 0, CARROT: 0, FLAG: 0, POS_2: 0, POS_3: 0, POS_4: 0,
    LETTUCE: 0, HARE: 0, TORTOISE: 0, HOME: 0,
  } as Record<SquareType, number>;
  for (const s of board) out[s]++;
  return out;
}
