// Sliding Blocks: blocks two or three squares long sit on a square board. Each slides only along
// its length. Clear a way for the key block to slide out through the gap in the edge.
//
// Variants:
// - Classic: 6 × 6, one key block, leaving on the right.
// - Pillars: as Classic, with a few fixed one-square pillars that never move.
// - Big: 8 × 8, more blocks.
// - Two Keys: 6 × 6, a second key block standing upright that leaves at the bottom. A key block
//   that reaches its exit is out, off the board, and its squares are free; both must get out.
//
// A puzzle is made from a random layout by mapping every position reachable from it. The fewest
// moves to finish is worked out for each, by searching back from the finished positions; the
// start is one the difficulty asks for. So every puzzle can be finished, and the fewest moves it
// takes is known exactly (a move slides one block any distance). Among the starts the script
// finds, it keeps the most interesting (see `interest`).

export const VARIANTS = {
  classic: { label: 'Classic', size: 6, keys: 1, pillars: 0 },
  pillars: { label: 'Pillars', size: 6, keys: 1, pillars: 3 },
  big: { label: 'Big', size: 8, keys: 1, pillars: 0 },
  twoKeys: { label: 'Two Keys', size: 6, keys: 2, pillars: 0 },
} as const;

export type Variant = keyof typeof VARIANTS;
export const isVariant = (value: unknown): value is Variant =>
  typeof value === 'string' && Object.hasOwn(VARIANTS, value);

export const LEVELS = {
  easy: { label: 'Easy' },
  medium: { label: 'Medium' },
  hard: { label: 'Hard' },
} as const;

export type Difficulty = keyof typeof LEVELS;
export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(LEVELS, value);

/** Per variant and difficulty: how many blocks (besides pillars), and the fewest moves wanted. */
export const DIFFICULTIES: Record<Variant, Record<Difficulty, { blocks: [number, number]; moves: [number, number] }>> = {
  classic: {
    easy: { blocks: [7, 9], moves: [5, 9] },
    medium: { blocks: [9, 11], moves: [10, 17] },
    hard: { blocks: [10, 13], moves: [18, 60] },
  },
  pillars: {
    easy: { blocks: [6, 8], moves: [5, 9] },
    medium: { blocks: [8, 10], moves: [10, 17] },
    hard: { blocks: [9, 12], moves: [18, 60] },
  },
  // Big boards need about as full a board as Classic, or a layout can reach far too many positions.
  big: {
    easy: { blocks: [26, 29], moves: [6, 11] },
    medium: { blocks: [26, 29], moves: [12, 20] },
    hard: { blocks: [25, 28], moves: [21, 80] },
  },
  twoKeys: {
    easy: { blocks: [7, 9], moves: [6, 10] },
    medium: { blocks: [8, 10], moves: [11, 18] },
    hard: { blocks: [9, 12], moves: [19, 60] },
  },
};

/** A board's size, how many key blocks it has, and where they leave. */
export interface Shape {
  size: number;
  keys: number;
  /** The row the first key block lies on, and the gap in the right-hand edge it leaves by. */
  exitRow: number;
  /** The column the second key block (if any) stands in, and the gap in the bottom edge it leaves by. */
  exitCol: number;
}

export function shape(variant: Variant): Shape {
  const { size, keys } = VARIANTS[variant];
  return { size, keys, exitRow: Math.floor((size - 1) / 2), exitCol: Math.floor(size / 2) };
}

/**
 * A block at row r, column c (its top-left square), `len` squares long, lying across or down.
 * Pillars are fixed one-square blocks. The key blocks come first: the first lies across, the
 * second (Two Keys) stands down.
 */
export interface Block {
  r: number;
  c: number;
  len: number;
  across: boolean;
  fixed?: boolean;
}

type Random = () => number;

const along = (b: Block) => (b.across ? b.c : b.r);

/** Whether block i is a key block that has reached its exit, and so is out, off the board. */
export const isOut = (blocks: readonly Block[], i: number, s: Shape) => i < s.keys && along(blocks[i]) + blocks[i].len === s.size;

/** Every key block out. */
export const isSolved = (blocks: readonly Block[], s: Shape) => blocks.every((_, i) => i >= s.keys || isOut(blocks, i, s));

/** Which block is on each square (-1 for none); key blocks that are out take up none. */
export function occupancy(blocks: readonly Block[], s: Shape): number[] {
  const { size } = s;
  const grid = new Array<number>(size * size).fill(-1);
  blocks.forEach((b, i) => {
    if (isOut(blocks, i, s)) return;
    for (let k = 0; k < b.len; k++) grid[(b.r + (b.across ? 0 : k)) * size + b.c + (b.across ? k : 0)] = i;
  });
  return grid;
}

/** How far block i can slide: the range of its position (column if across, row if down). */
export function range(blocks: readonly Block[], i: number, s: Shape, grid = occupancy(blocks, s)): [number, number] {
  const b = blocks[i];
  const at = along(b);
  if (b.fixed || isOut(blocks, i, s)) return [at, at];
  const { size } = s;
  const free = (p: number) => {
    const sq = b.across ? b.r * size + p : p * size + b.c;
    return p >= 0 && p < size && (grid[sq] === -1 || grid[sq] === i);
  };
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
// characters: row, column, length, and '-' across, '|' down or '+' a fixed pillar. The key blocks
// come first.

const MARK = (b: Block) => (b.fixed ? '+' : b.across ? '-' : '|');
export const encode = (blocks: readonly Block[]) => blocks.map((b) => `${b.r}${b.c}${b.len}${MARK(b)}`).join('');

export function decode(code: string): Block[] {
  const out: Block[] = [];
  for (let k = 0; k + 4 <= code.length; k += 4) {
    const mark = code[k + 3];
    const block: Block = { r: +code[k], c: +code[k + 1], len: +code[k + 2], across: mark !== '|' };
    if (mark === '+') block.fixed = true;
    out.push(block);
  }
  return out;
}

/**
 * Whether blocks make a sound puzzle for the shape: on the board, not overlapping, the key blocks
 * two long and on their exit lines (the first across, the second down), pillars one square.
 */
export function isLayout(blocks: readonly Block[], s: Shape): boolean {
  const { size, keys } = s;
  if (blocks.length < keys) return false;
  const k0 = blocks[0];
  if (!k0.across || k0.fixed || k0.r !== s.exitRow || k0.len !== 2) return false;
  if (keys === 2) {
    const k1 = blocks[1];
    if (k1.across || k1.fixed || k1.c !== s.exitCol || k1.len !== 2) return false;
  }
  const inside = blocks.every((b) =>
    [b.r, b.c].every(Number.isInteger) && b.r >= 0 && b.c >= 0 &&
    (b.fixed ? b.len === 1 && b.r < size && b.c < size : (b.len === 2 || b.len === 3) &&
      (b.across ? b.c + b.len <= size && b.r < size : b.r + b.len <= size && b.c < size)));
  if (!inside) return false;
  const squares = blocks.reduce((n, b, i) => n + (isOut(blocks, i, s) ? 0 : b.len), 0);
  return occupancy(blocks, s).filter((i) => i !== -1).length === squares;
}

// ---- Generation (run ahead of time by scripts/blocks.ts, not in the game) ----

/**
 * A random layout: the key blocks on their exit lines, the pillars, then other blocks wherever
 * they fit (null if the second key block landed on the first one's row). Nothing else lies along
 * a key block's exit line (it could never get out of the way), and no pillar stands on one.
 */
function layout(variant: Variant, count: number, random: Random): Block[] | null {
  const s = shape(variant);
  const { size } = s;
  const blocks: Block[] = [{ r: s.exitRow, c: Math.floor(random() * (size / 2)), len: 2, across: true }];
  if (s.keys === 2) {
    const r = Math.floor(random() * (size - 1));
    if (r === s.exitRow || r + 1 === s.exitRow) return null; // standing on the first key block's row
    blocks.push({ r, c: s.exitCol, len: 2, across: false });
  }
  const grid = occupancy(blocks, s);
  const onExitLine = (r: number, c: number) => r === s.exitRow || (s.keys === 2 && c === s.exitCol);
  const put = (b: Block) => {
    const squares = Array.from({ length: b.len }, (_, k) => (b.r + (b.across ? 0 : k)) * size + b.c + (b.across ? k : 0));
    if (squares.some((sq) => grid[sq] !== -1)) return false;
    squares.forEach((sq) => (grid[sq] = blocks.length));
    blocks.push(b);
    return true;
  };
  for (let placed = 0, tries = 0; placed < VARIANTS[variant].pillars && tries < 200; tries++) {
    const r = Math.floor(random() * size);
    const c = Math.floor(random() * size);
    if (!onExitLine(r, c) && put({ r, c, len: 1, across: true, fixed: true })) placed++;
  }
  for (let tries = 0, placed = 0; placed < count && tries < 2000; tries++) {
    const across = random() < 0.5;
    const len = random() < 0.7 ? 2 : 3;
    const r = Math.floor(random() * (across ? size : size - len + 1));
    const c = Math.floor(random() * (across ? size - len + 1 : size));
    if (across && r === s.exitRow) continue;
    if (!across && s.keys === 2 && c === s.exitCol) continue;
    if (put({ r, c, len, across })) placed++;
  }
  return blocks;
}

/** Positions explored per layout, at most. A layout with more is skipped. */
const EXPLORE_LIMIT = { classic: 30000, pillars: 30000, big: 60000, twoKeys: 30000 } satisfies Record<Variant, number>;

export interface Puzzle {
  blocks: Block[];
  fewest: number; // the fewest moves that finish it
  interest: number; // see `interest`
}

/** A position as where each block is along its line: one digit per block, in order. */
export const positionKey = (blocks: readonly Block[]) => blocks.map(along).join('');

export interface Explored {
  /** Every position reachable from the start (which is the first), as `positionKey`s. */
  keys: string[];
  /** Per position, the fewest moves to finish from there, or -1 if it can't be finished. */
  moves: Int32Array;
  /** The blocks of position `id`. */
  blocksOf: (id: number) => Block[];
}

/**
 * Every position reachable from `start`, with the fewest moves to finish from each, or null if
 * there are more than `limit`. Blocks keep their shape and line, so a position is just where each
 * is along its line. Run millions of times when making the puzzle list, so it works on the
 * digits and one reused grid rather than on blocks.
 */
export function explore(start: readonly Block[], s: Shape, limit = 30000): Explored | null {
  const n = start.length;
  const { size } = s;
  const across = start.map((b) => b.across);
  const len = start.map((b) => b.len);
  const line = start.map((b) => (b.across ? b.r : b.c)); // the row (across) or column (down) it moves in
  const movable = start.map((b) => !b.fixed);
  const square = (i: number, p: number) => (across[i] ? line[i] * size + p : p * size + line[i]);
  const keys: string[] = [positionKey(start)];
  const index = new Map([[keys[0], 0]]);
  const prev: number[][] = [[]]; // per position, the positions one move before it
  const done: boolean[] = [];
  const grid = new Int16Array(size * size);
  const pos = new Int8Array(n);

  for (let q = 0; q < keys.length; q++) {
    const key = keys[q];
    for (let i = 0; i < n; i++) pos[i] = key.charCodeAt(i) - 48;
    const out = (i: number) => i < s.keys && pos[i] + len[i] === size;
    let finished = true;
    for (let i = 0; i < s.keys; i++) if (!out(i)) finished = false;
    done.push(finished);
    if (finished) continue; // nothing moves on from a finished position
    grid.fill(-1);
    for (let i = 0; i < n; i++) {
      if (out(i)) continue;
      for (let k = 0; k < len[i]; k++) grid[square(i, pos[i] + k)] = i;
    }
    for (let i = 0; i < n; i++) {
      if (!movable[i] || out(i)) continue;
      const at = pos[i];
      const reach = (p: number) => {
        const k2 = key.slice(0, i) + p + key.slice(i + 1);
        let id = index.get(k2);
        if (id === undefined) {
          id = keys.length;
          keys.push(k2);
          index.set(k2, id);
          prev.push([]);
        }
        prev[id].push(q);
      };
      for (let p = at - 1; p >= 0 && grid[square(i, p)] === -1; p--) reach(p);
      for (let p = at + 1; p + len[i] <= size && grid[square(i, p + len[i] - 1)] === -1; p++) reach(p);
    }
    if (keys.length > limit) return null;
  }

  // Back from the finished positions, one move at a time (a key block that's out can't come
  // back, so moves aren't all reversible: this follows them backwards as recorded).
  const moves = new Int32Array(keys.length).fill(-1);
  let frontier: number[] = [];
  done.forEach((d, id) => {
    if (d) {
      moves[id] = 0;
      frontier.push(id);
    }
  });
  for (let d = 1; frontier.length; d++) {
    const ahead: number[] = [];
    for (const id of frontier) {
      for (const m of prev[id]) {
        if (moves[m] === -1) {
          moves[m] = d;
          ahead.push(m);
        }
      }
    }
    frontier = ahead;
  }
  const blocksOf = (id: number) => start.map((b, i) => (b.across ? { ...b, c: +keys[id][i] } : { ...b, r: +keys[id][i] }));
  return { keys, moves, blocksOf };
}

/**
 * How interesting a start is, by one of its shortest solutions: the number of different blocks it
 * moves, plus twice the number it has to move more than once (coming back to a block is what
 * makes a puzzle tricky). `fewest` maps each position's key to its fewest moves.
 */
export function interest(start: readonly Block[], s: Shape, fewest: Map<string, number>): number {
  let blocks = start.slice();
  const count = new Map<number, number>();
  for (let left = fewest.get(positionKey(blocks))!; left > 0; left--) {
    // A move one closer to the finish; among those, one that moves a block already moved, if any
    // (so the count of different blocks is what the solution can't do without).
    const grid = occupancy(blocks, s);
    let chosen: { i: number; next: Block[] } | null = null;
    for (let i = 0; i < blocks.length; i++) {
      const [lo, hi] = range(blocks, i, s, grid);
      for (let p = lo; p <= hi; p++) {
        if (p === along(blocks[i])) continue;
        const next = slide(blocks, i, p);
        if (fewest.get(positionKey(next)) !== left - 1) continue;
        if (!chosen || (count.has(i) && !count.has(chosen.i))) chosen = { i, next };
      }
    }
    count.set(chosen!.i, (count.get(chosen!.i) ?? 0) + 1);
    blocks = chosen!.next;
  }
  const again = [...count.values()].filter((c) => c > 1).length;
  return count.size + 2 * again;
}

export function generate(variant: Variant, difficulty: Difficulty, random: Random = Math.random): Puzzle {
  const s = shape(variant);
  const { blocks: [few, many], moves: [lo, hi] } = DIFFICULTIES[variant][difficulty];
  for (;;) {
    const count = few + Math.floor(random() * (many - few + 1));
    const start = layout(variant, count, random);
    if (!start) continue;
    const found = explore(start, s, EXPLORE_LIMIT[variant]);
    if (!found) continue;
    const { keys, moves, blocksOf } = found;
    // A start has every key block still on the board (a position reached by letting one out
    // first is no place to begin).
    const whole = (id: number) => {
      for (let i = 0; i < s.keys; i++) if (+keys[id][i] + start[i].len === s.size) return false;
      return true;
    };
    let most = -1;
    for (let id = 0; id < keys.length; id++) if (moves[id] >= lo && moves[id] <= hi && moves[id] > most && whole(id)) most = moves[id];
    if (most === -1) continue;
    // The hardest the layout offers within the range; of those (a dozen at most), the most interesting.
    const fewest = new Map(keys.map((k, id) => [k, moves[id]]));
    const best: number[] = [];
    for (let id = 0; id < keys.length && best.length < 12; id++) if (moves[id] === most && whole(id)) best.push(id);
    const scored = best.map((id) => ({ id, score: interest(blocksOf(id), s, fewest) }));
    const top = Math.max(...scored.map((x) => x.score));
    const picks = scored.filter((x) => x.score === top);
    const pick = picks[Math.floor(random() * picks.length)];
    return { blocks: blocksOf(pick.id), fewest: most, interest: pick.score };
  }
}
