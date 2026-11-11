// Sliding Blocks: blocks two or three squares long sit on a 6 × 6 board. Each slides only along
// its length. Clear a way for the key block to slide out through the gap in the right-hand edge.
//
// A puzzle is made from a random layout by mapping every position reachable from it. The key
// block's distance from the exit is worked out for each, by searching back from the positions
// where it's out; the start is one of the positions the difficulty asks for. So every puzzle can
// be solved, and the fewest moves it takes is known exactly (a move slides one block any distance).

export const SIZE = 6;
/** The row the key block is on, and the gap in the right-hand edge it leaves by. */
export const EXIT_ROW = 2;

export const DIFFICULTIES = {
  easy: { label: 'Easy', blocks: [7, 9], moves: [5, 9] },
  medium: { label: 'Medium', blocks: [9, 11], moves: [10, 17] },
  hard: { label: 'Hard', blocks: [10, 13], moves: [18, 60] },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;
export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

/** A block at row r, column c (its top-left square), `len` squares long, lying across or down. */
export interface Block {
  r: number;
  c: number;
  len: number;
  across: boolean;
}

type Random = () => number;

/** Block 0 is the key block. It's out once its right end reaches the last column. */
export const isSolved = (blocks: readonly Block[]) => blocks[0].c + blocks[0].len === SIZE;

/** Which block is on each square (-1 for none). */
export function occupancy(blocks: readonly Block[]): number[] {
  const grid = new Array<number>(SIZE * SIZE).fill(-1);
  blocks.forEach((b, i) => {
    for (let k = 0; k < b.len; k++) grid[(b.r + (b.across ? 0 : k)) * SIZE + b.c + (b.across ? k : 0)] = i;
  });
  return grid;
}

/** How far block i can slide: the range of its position (column if across, row if down). */
export function range(blocks: readonly Block[], i: number, grid = occupancy(blocks)): [number, number] {
  const b = blocks[i];
  const free = (p: number) => {
    const sq = b.across ? b.r * SIZE + p : p * SIZE + b.c;
    return p >= 0 && p < SIZE && (grid[sq] === -1 || grid[sq] === i);
  };
  const at = b.across ? b.c : b.r;
  let lo = at;
  while (free(lo - 1)) lo--;
  let hi = at;
  while (free(hi + b.len)) hi++;
  return [lo, hi];
}

/** Block i slid to position `to` (column if across, row if down). */
export function slide(blocks: readonly Block[], i: number, to: number): Block[] {
  const out = blocks.slice();
  out[i] = blocks[i].across ? { ...blocks[i], c: to } : { ...blocks[i], r: to };
  return out;
}

// ---- Stored puzzles ----
// The puzzles ship pre-made (puzzles.ts, written by scripts/blocks.ts), each block as four
// characters: row, column, length, and '-' across or '|' down. The key block comes first.

export const encode = (blocks: readonly Block[]) => blocks.map((b) => `${b.r}${b.c}${b.len}${b.across ? '-' : '|'}`).join('');

export function decode(code: string): Block[] {
  const out: Block[] = [];
  for (let k = 0; k + 4 <= code.length; k += 4) {
    out.push({ r: +code[k], c: +code[k + 1], len: +code[k + 2], across: code[k + 3] === '-' });
  }
  return out;
}

/** Whether blocks make a sound puzzle: on the board, not overlapping, the key block on the exit row. */
export function isLayout(blocks: readonly Block[]): boolean {
  if (!blocks.length || !blocks[0].across || blocks[0].r !== EXIT_ROW || blocks[0].len !== 2) return false;
  const inside = blocks.every((b) =>
    [b.r, b.c].every(Number.isInteger) && (b.len === 2 || b.len === 3) && b.r >= 0 && b.c >= 0 &&
    (b.across ? b.c + b.len <= SIZE && b.r < SIZE : b.r + b.len <= SIZE && b.c < SIZE));
  if (!inside) return false;
  const squares = blocks.reduce((n, b) => n + b.len, 0);
  return occupancy(blocks).filter((i) => i !== -1).length === squares;
}

// ---- Generation (run ahead of time by scripts/blocks.ts, not in the game) ----

/** A random layout: the key block on the exit row, then others wherever they fit. */
function layout(count: number, random: Random): Block[] {
  const blocks: Block[] = [{ r: EXIT_ROW, c: Math.floor(random() * 3), len: 2, across: true }];
  const grid = occupancy(blocks);
  for (let tries = 0; blocks.length < count && tries < 400; tries++) {
    const across = random() < 0.5;
    const len = random() < 0.7 ? 2 : 3;
    const r = Math.floor(random() * (across ? SIZE : SIZE - len + 1));
    const c = Math.floor(random() * (across ? SIZE - len + 1 : SIZE));
    // Nothing else lies across the exit row: it could never get out of the key block's way.
    if (across && r === EXIT_ROW) continue;
    const squares = Array.from({ length: len }, (_, k) => (r + (across ? 0 : k)) * SIZE + c + (across ? k : 0));
    if (squares.some((sq) => grid[sq] !== -1)) continue;
    squares.forEach((sq) => (grid[sq] = blocks.length));
    blocks.push({ r, c, len, across });
  }
  return blocks;
}

/** Positions explored per layout, at most. A layout with more is skipped (they're rare). */
const EXPLORE_LIMIT = 30000;

export interface Puzzle {
  blocks: Block[];
  fewest: number; // the fewest moves that solve it
}

/**
 * Every position reachable from `start`, each with the fewest moves to solve it from there (-1
 * if it can't be solved), or null if there are more than `limit`. Blocks keep their shape, so a
 * position is just where each block is along its line: one digit per block.
 */
export function explore(start: readonly Block[], limit = EXPLORE_LIMIT): { blocks: Block[]; moves: number }[] | null {
  const n = start.length;
  const along = (b: Block) => (b.across ? b.c : b.r);
  const keys: string[] = [start.map(along).join('')];
  const index = new Map([[keys[0], 0]]);
  const next: number[][] = [];
  const grid = new Int8Array(SIZE * SIZE);
  const square = (i: number, p: number, k: number) => {
    const b = start[i];
    return b.across ? b.r * SIZE + p + k : (p + k) * SIZE + b.c;
  };

  for (let q = 0; q < keys.length; q++) {
    const key = keys[q];
    grid.fill(-1);
    for (let i = 0; i < n; i++) for (let k = 0; k < start[i].len; k++) grid[square(i, +key[i], k)] = i;
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const at = +key[i];
      const len = start[i].len;
      const tryTo = (p: number) => {
        let id = index.get(key.slice(0, i) + p + key.slice(i + 1));
        if (id === undefined) {
          id = keys.length;
          keys.push(key.slice(0, i) + p + key.slice(i + 1));
          index.set(keys[id], id);
        }
        out.push(id);
      };
      for (let p = at - 1; p >= 0 && grid[square(i, p, 0)] === -1; p--) tryTo(p);
      for (let p = at + 1; p + len <= SIZE && grid[square(i, p, len - 1)] === -1; p++) tryTo(p);
    }
    next.push(out);
    if (keys.length > limit) return null;
  }

  // Moves can always be slid back, so searching out from the solved positions (key block at
  // the exit) finds the fewest moves to a solution from everywhere.
  const moves = new Int32Array(keys.length).fill(-1);
  const exit = String(SIZE - start[0].len);
  let frontier: number[] = [];
  keys.forEach((k, id) => {
    if (k[0] === exit) {
      moves[id] = 0;
      frontier.push(id);
    }
  });
  for (let d = 1; frontier.length; d++) {
    const ahead: number[] = [];
    for (const id of frontier) {
      for (const m of next[id]) {
        if (moves[m] === -1) {
          moves[m] = d;
          ahead.push(m);
        }
      }
    }
    frontier = ahead;
  }
  return keys.map((k, id) => ({
    blocks: start.map((b, i) => (b.across ? { ...b, c: +k[i] } : { ...b, r: +k[i] })),
    moves: moves[id],
  }));
}

export function generate(difficulty: Difficulty, random: Random = Math.random): Puzzle {
  const { blocks: [few, many], moves: [lo, hi] } = DIFFICULTIES[difficulty];
  for (;;) {
    const count = few + Math.floor(random() * (many - few + 1));
    const positions = explore(layout(count, random));
    if (!positions) continue;
    const fits = positions.filter((p) => p.moves >= lo && p.moves <= hi);
    if (!fits.length) continue;
    // The hardest the layout offers within the range (a random one of those).
    const most = Math.max(...fits.map((p) => p.moves));
    const best = fits.filter((p) => p.moves === most);
    const pick = best[Math.floor(random() * best.length)];
    return { blocks: pick.blocks, fewest: pick.moves };
  }
}
