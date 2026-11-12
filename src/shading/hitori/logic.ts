// Hitori: shade cells so no number repeats in any row or column among the unshaded ones. Shaded
// cells never touch side by side, and the unshaded cells stay connected.
//
// Puzzles start from a Latin square (each number once per row and column) and a set of shaded cells
// that can't take one more: no two side by side, the rest connected, and every other cell either
// touches a shaded one or would cut the rest in two. Each shaded cell's number then becomes a copy
// of one already in its row or column, so it has to go. A solver counts the shadings that fit; a
// puzzle is kept only if there's one.
import { connected, shuffle, sides, type Random } from '../grid';

export const DIFFICULTIES = {
  easy: { label: 'Easy', size: 5 },
  medium: { label: 'Medium', size: 7 },
  hard: { label: 'Hard', size: 9 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;
export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

export interface Puzzle {
  size: number;
  numbers: number[]; // per cell, 1..size
  solution: boolean[]; // per cell: shaded
}

// ---- Solver ----
// Each cell is unknown, kept (unshaded) or shaded. Shading a cell keeps its neighbors; keeping a
// cell shades the other copies of its number in its row and column; the kept and unknown cells must
// stay connected. Once no row or column has a repeat left among the unshaded, the unknown cells are
// all kept: one answer. And if any of them could be shaded as well (no shaded neighbor, and the rest
// still connected), that's a second.

const UNKNOWN = 0;
const KEPT = 1;
const SHADED = 2;

/** Up to `limit` answers (shaded cells), or null if `budget` steps run out first. */
export function solutions(p: Pick<Puzzle, 'size' | 'numbers'>, limit = 2, budget = 100_000): boolean[][] | null {
  const n = p.size;
  const { numbers } = p;
  // The other cells with the same number in the same row or column.
  const twins = numbers.map((v, i) => {
    const r = Math.floor(i / n);
    const c = i % n;
    const out: number[] = [];
    for (let t = 0; t < n; t++) {
      if (t !== c && numbers[r * n + t] === v) out.push(r * n + t);
      if (t !== r && numbers[t * n + c] === v) out.push(t * n + c);
    }
    return out;
  });
  const found: boolean[][] = [];
  let steps = 0;
  let out = false;

  /** Applies a cell's state and everything it forces; false on a contradiction. */
  const set = (state: Uint8Array, i: number, v: number): boolean => {
    const stack: [number, number][] = [[i, v]];
    while (stack.length) {
      const [x, s] = stack.pop()!;
      if (state[x] === s) continue;
      if (state[x] !== UNKNOWN) return false;
      state[x] = s;
      if (s === SHADED) for (const j of sides(n, x)) stack.push([j, KEPT]);
      else for (const j of twins[x]) stack.push([j, SHADED]);
    }
    return connected(n, (j) => state[j] !== SHADED);
  };

  const walk = (state: Uint8Array): void => {
    if (found.length >= limit || out) return;
    if (++steps > budget) {
      out = true;
      return;
    }
    // A cell that still repeats among the unshaded: one of its copies has to go.
    const open = state.findIndex((s, i) => s === UNKNOWN && twins[i].some((j) => state[j] !== SHADED));
    if (open < 0) {
      found.push(Array.from(state, (s) => s === SHADED));
      if (found.length >= limit) return;
      // Could any unknown cell be shaded too?
      for (let i = 0; i < n * n; i++) {
        if (state[i] !== UNKNOWN || sides(n, i).some((j) => state[j] === SHADED)) continue;
        if (connected(n, (j) => j !== i && state[j] !== SHADED)) {
          found.push(Array.from(state, (s, j) => s === SHADED || j === i));
          return;
        }
      }
      return;
    }
    for (const v of [SHADED, KEPT]) {
      const next = state.slice();
      if (set(next, open, v)) walk(next);
      if (found.length >= limit || out) return;
    }
  };
  walk(new Uint8Array(n * n));
  return out ? null : found;
}

export function isUnique(p: Pick<Puzzle, 'size' | 'numbers'>): boolean {
  const found = solutions(p);
  return found !== null && found.length === 1;
}

// ---- Generator ----

/** A random Latin square: a shifted pattern, its rows, columns and numbers shuffled. */
function latin(n: number, random: Random): number[] {
  const rows = shuffle(Array.from({ length: n }, (_, k) => k), random);
  const cols = shuffle(Array.from({ length: n }, (_, k) => k), random);
  const syms = shuffle(Array.from({ length: n }, (_, k) => k + 1), random);
  return Array.from({ length: n * n }, (_, i) => syms[(rows[Math.floor(i / n)] + cols[i % n]) % n]);
}

/** Shaded cells that can't take one more: none side by side, the rest connected. */
function shading(n: number, random: Random): boolean[] {
  const shaded = new Array<boolean>(n * n).fill(false);
  for (const i of shuffle(Array.from({ length: n * n }, (_, k) => k), random)) {
    if (sides(n, i).some((j) => shaded[j])) continue;
    shaded[i] = true;
    if (!connected(n, (j) => !shaded[j])) shaded[i] = false;
  }
  return shaded;
}

export function generate(difficulty: Difficulty, random: Random = Math.random): Puzzle {
  const n = DIFFICULTIES[difficulty].size;
  for (;;) {
    const square = latin(n, random);
    const shaded = shading(n, random);
    // A few tries at the shaded cells' numbers before starting over.
    for (let tries = 0; tries < 6; tries++) {
      const numbers = square.slice();
      for (let i = 0; i < n * n; i++) {
        if (!shaded[i]) continue;
        const r = Math.floor(i / n);
        const c = i % n;
        const copies: number[] = [];
        for (let t = 0; t < n; t++) {
          if (!shaded[r * n + t]) copies.push(square[r * n + t]);
          if (!shaded[t * n + c]) copies.push(square[t * n + c]);
        }
        numbers[i] = copies[Math.floor(random() * copies.length)];
      }
      const p = { size: n, numbers };
      if (isUnique(p)) return { ...p, solution: shaded };
    }
  }
}

// ---- Checks ----

/** Shaded cells side by side, and kept (circled) cells repeating a kept number in their row or column. */
export function conflicts(p: Pick<Puzzle, 'size' | 'numbers'>, shaded: boolean[], kept: boolean[]): boolean[] {
  const n = p.size;
  return p.numbers.map((v, i) => {
    if (shaded[i]) return sides(n, i).some((j) => shaded[j]);
    if (!kept[i]) return false;
    const r = Math.floor(i / n);
    const c = i % n;
    for (let t = 0; t < n; t++) {
      const a = r * n + t;
      const b = t * n + c;
      if ((a !== i && kept[a] && p.numbers[a] === v) || (b !== i && kept[b] && p.numbers[b] === v)) return true;
    }
    return false;
  });
}

export function isPuzzle(value: unknown, difficulty: Difficulty): value is Puzzle {
  const p = value as Puzzle | null;
  const n = DIFFICULTIES[difficulty].size;
  return (
    typeof p === 'object' && p !== null && p.size === n &&
    Array.isArray(p.numbers) && p.numbers.length === n * n && p.numbers.every((v) => Number.isInteger(v) && v >= 1 && v <= n) &&
    Array.isArray(p.solution) && p.solution.length === n * n && p.solution.every((s) => typeof s === 'boolean')
  );
}
