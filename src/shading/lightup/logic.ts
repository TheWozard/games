// Light Up: place lamps in the white cells. A lamp lights its own cell and every cell in its row and
// column up to a wall. Every white cell must be lit, no lamp may light another, and a number on a
// wall says how many lamps sit beside it.
//
// Puzzles start from walls laid out symmetrically and lamps placed until every cell is lit. Every
// wall gets its count, and a solver checks there's one answer; then counts are taken away in random
// order while there still is (Easy keeps more of them).
import { shuffle, sides, type Random } from '../grid';

export const DIFFICULTIES = {
  // walls: the share of cells that are walls, kept within [min, max]. Boards with many walls have
  // one answer more often, so without the cap the generator drifts toward them.
  easy: { label: 'Easy', size: 7, walls: [0.18, 0.3], keep: 0.6 },
  medium: { label: 'Medium', size: 8, walls: [0.18, 0.28], keep: 0.3 },
  hard: { label: 'Hard', size: 10, walls: [0.16, 0.26], keep: 0 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;
export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

/** A wall without a number. */
export const WALL = -1;

export interface Puzzle {
  size: number;
  walls: (number | null)[]; // per cell: null for white, WALL, or a wall's count 0..4
  solution: boolean[]; // per cell: a lamp
}

/** The white cells a lamp at i would light (not i itself): along its row and column to the walls. */
export function sight(p: Pick<Puzzle, 'size' | 'walls'>, i: number): number[] {
  const n = p.size;
  const r = Math.floor(i / n);
  const c = i % n;
  const out: number[] = [];
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    for (let rr = r + dr, cc = c + dc; rr >= 0 && rr < n && cc >= 0 && cc < n; rr += dr, cc += dc) {
      if (p.walls[rr * n + cc] !== null) break;
      out.push(rr * n + cc);
    }
  }
  return out;
}

/** Which cells are lit by these lamps. */
export function lit(p: Pick<Puzzle, 'size' | 'walls'>, lamps: boolean[]): boolean[] {
  const on = lamps.slice();
  lamps.forEach((l, i) => {
    if (l) for (const j of sight(p, i)) on[j] = true;
  });
  return on;
}

// ---- Solver ----
// Each white cell is unknown, a lamp or empty. A lamp empties all it sees; a wall with as many lamps
// as its number empties its other sides, and one with only as many open sides as it still needs
// fills them. An unlit cell with one place left that could light it gets its lamp there. Then it
// branches on the unlit cell with fewest such places: a lamp at the first, or empty there and a lamp
// at the next, and so on, so no answer is counted twice.

const UNKNOWN = 0;
const LAMP = 1;
const EMPTY = 2;

/** Up to `limit` answers (lamp cells), or null if `budget` steps run out first. */
export function solutions(p: Pick<Puzzle, 'size' | 'walls'>, limit = 2, budget = 100_000): boolean[][] | null {
  const n = p.size;
  const white = p.walls.map((w) => w === null);
  const seen = p.walls.map((_, i) => (white[i] ? sight(p, i) : []));
  const numbered = p.walls.flatMap((w, i) => (w !== null && w >= 0 ? [i] : []));
  const besides = p.walls.map((_, i) => sides(n, i).filter((j) => white[j]));
  const found: boolean[][] = [];
  let steps = 0;
  let out = false;

  /** Settles everything the state forces; false on a contradiction. */
  const settle = (state: Uint8Array): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      for (const w of numbered) {
        const need = p.walls[w]!;
        let lamps = 0;
        let open = 0;
        for (const j of besides[w]) {
          if (state[j] === LAMP) lamps++;
          else if (state[j] === UNKNOWN) open++;
        }
        if (lamps > need || lamps + open < need) return false;
        if (open && (lamps === need || lamps + open === need)) {
          for (const j of besides[w]) if (state[j] === UNKNOWN) state[j] = lamps === need ? EMPTY : LAMP;
          changed = true;
        }
      }
      for (let i = 0; i < n * n; i++) {
        if (!white[i]) continue;
        if (state[i] === LAMP) {
          for (const j of seen[i]) {
            if (state[j] === LAMP) return false;
            if (state[j] === UNKNOWN) {
              state[j] = EMPTY;
              changed = true;
            }
          }
          continue;
        }
        if (seen[i].some((j) => state[j] === LAMP)) continue; // lit
        const places = [i, ...seen[i]].filter((j) => state[j] === UNKNOWN);
        if (!places.length) return false;
        if (places.length === 1) {
          state[places[0]] = LAMP;
          changed = true;
        }
      }
    }
    return true;
  };

  const walk = (state: Uint8Array): void => {
    if (found.length >= limit || out) return;
    if (++steps > budget) {
      out = true;
      return;
    }
    if (!settle(state)) return;
    // The unlit cell with fewest places left to light it from.
    let best: number[] | null = null;
    for (let i = 0; i < n * n; i++) {
      if (!white[i] || state[i] === LAMP || seen[i].some((j) => state[j] === LAMP)) continue;
      const places = [i, ...seen[i]].filter((j) => state[j] === UNKNOWN);
      if (!best || places.length < best.length) best = places;
    }
    if (!best) {
      // All lit, so every cell left unknown is seen by a lamp and can't hold one: it's empty. The
      // numbers must then be met by the lamps already placed.
      const lamps = Array.from(state, (s) => s === LAMP);
      if (numbered.every((w) => besides[w].filter((j) => lamps[j]).length === p.walls[w])) found.push(lamps);
      return;
    }
    for (let k = 0; k < best.length; k++) {
      const next = state.slice();
      for (let m = 0; m < k; m++) next[best[m]] = EMPTY;
      next[best[k]] = LAMP;
      walk(next);
      if (found.length >= limit || out) return;
    }
  };
  walk(new Uint8Array(n * n));
  return out ? null : found;
}

export function isUnique(p: Pick<Puzzle, 'size' | 'walls'>): boolean {
  const found = solutions(p);
  return found !== null && found.length === 1;
}

// ---- Generator ----

/** Walls at random, the same turned half around (as these puzzles usually are). */
function layout(n: number, share: number, random: Random): (number | null)[] {
  const walls = new Array<number | null>(n * n).fill(null);
  for (let i = 0; i < n * n; i++) {
    const j = n * n - 1 - i;
    if (j < i) break;
    if (random() < share) walls[i] = walls[j] = WALL;
  }
  return walls;
}

export function generate(difficulty: Difficulty, random: Random = Math.random): Puzzle {
  const { size: n, walls: share, keep } = DIFFICULTIES[difficulty];
  for (;;) {
    const walls = layout(n, (share[0] + share[1]) / 2, random);
    const count = walls.filter((w) => w !== null).length / (n * n);
    if (count < share[0] || count > share[1]) continue;
    // Lamps, one at a time on a cell still dark, until all are lit.
    const lamps = new Array<boolean>(n * n).fill(false);
    let on = lit({ size: n, walls }, lamps);
    for (const i of shuffle(walls.flatMap((w, k) => (w === null ? [k] : [])), random)) {
      if (on[i]) continue;
      lamps[i] = true;
      on = lit({ size: n, walls }, lamps);
    }
    // Every wall's count, then take counts away while the answer stays the only one.
    const counted = walls.map((w, i) => (w === null ? null : sides(n, i).filter((j) => lamps[j]).length));
    const p = { size: n, walls: counted };
    if (!isUnique(p)) continue;
    const order = shuffle(counted.flatMap((w, i) => (w === null ? [] : [i])), random);
    const keepCount = Math.round(order.length * keep);
    for (const i of order.slice(keepCount)) {
      const was = p.walls[i];
      p.walls[i] = WALL;
      if (!isUnique(p)) p.walls[i] = was;
    }
    return { ...p, solution: lamps };
  }
}

// ---- Checks ----

/** Lamps that light another lamp, and numbered walls with more lamps beside them than their number. */
export function conflicts(p: Pick<Puzzle, 'size' | 'walls'>, lamps: boolean[]): boolean[] {
  const n = p.size;
  return p.walls.map((w, i) => {
    if (w === null) return lamps[i] && sight(p, i).some((j) => lamps[j]);
    return w >= 0 && sides(n, i).filter((j) => lamps[j]).length > w;
  });
}

export function isPuzzle(value: unknown, difficulty: Difficulty): value is Puzzle {
  const p = value as Puzzle | null;
  const n = DIFFICULTIES[difficulty].size;
  return (
    typeof p === 'object' && p !== null && p.size === n &&
    Array.isArray(p.walls) && p.walls.length === n * n &&
    p.walls.every((w) => w === null || w === WALL || (Number.isInteger(w) && w >= 0 && w <= 4)) &&
    Array.isArray(p.solution) && p.solution.length === n * n && p.solution.every((s) => typeof s === 'boolean')
  );
}
