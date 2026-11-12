// Nurikabe: shade cells to make one connected sea around islands. Each number is an island of
// exactly that many unshaded cells, holding only that number; islands don't touch side by side,
// and the sea has no 2×2 block of shaded cells.
//
// Puzzles start from a real answer: from an all-sea board, cells in 2×2 pools turn to land (as long
// as the sea stays connected and no island outgrows the largest size), until no pool is left and
// enough is land. Each island gets its number in one of its cells. A solver then lists the shapes
// each number's island could take and counts the ways to fit them together. While it finds a second
// answer, a cell that answer makes land (and ours leaves sea) turns to land in ours too, as a new
// island of 1 or one more cell of the island beside it; ours still fits, and the other may not.
import { block4, blocks, connected, shuffle, sides, type Random } from '../grid';

export const DIFFICULTIES = {
  // biggest: the largest island. Bigger ones have so many possible shapes that checking a puzzle
  // gets slow (8×8 with islands of 5: up to half a second on a laptop).
  easy: { label: 'Easy', size: 5, biggest: 4, land: 0.35 },
  medium: { label: 'Medium', size: 7, biggest: 4, land: 0.38 },
  hard: { label: 'Hard', size: 8, biggest: 4, land: 0.4 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;
export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

export interface Puzzle {
  size: number;
  clues: (number | null)[]; // per cell: an island's size, or null
  solution: boolean[]; // per cell: shaded (sea)
}

// ---- Solver ----

/** Every island the clue at `at` could be: connected shapes of its size, holding no other clue or touching one. */
function shapesOf(n: number, clues: (number | null)[], at: number, budget: { left: number }): number[][] | null {
  const size = clues[at]!;
  const banned = new Uint8Array(n * n);
  clues.forEach((v, i) => {
    if (v === null || i === at) return;
    banned[i] = 1;
    for (const j of sides(n, i)) banned[j] = 1;
  });
  if (banned[at]) return [];
  const out: number[][] = [];
  const seen = new Set<string>();
  const cells = [at];
  const inside = new Uint8Array(n * n);
  inside[at] = 1;
  // Grow one cell at a time from the frontier; dedupe shapes by their sorted cells.
  const grow = (): boolean => {
    if (--budget.left < 0) return false;
    if (cells.length === size) {
      const key = cells.slice().sort((a, b) => a - b).join(',');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(cells.slice());
      }
      return true;
    }
    const tried = new Set<number>();
    for (const c of cells) {
      for (const j of sides(n, c)) {
        if (inside[j] || banned[j] || tried.has(j)) continue;
        tried.add(j);
        inside[j] = 1;
        cells.push(j);
        const ok = grow();
        cells.pop();
        inside[j] = 0;
        if (!ok) return false;
      }
    }
    return true;
  };
  return grow() ? out : null;
}

/**
 * Up to `limit` answers (the sea's cells), or null if `budget` steps run out first. Clues are placed
 * one at a time, the one with fewest shapes still fitting first; a cell no island can reach any more
 * is sea, and four such cells in a block end that branch.
 */
export function solutions(p: Pick<Puzzle, 'size' | 'clues'>, limit = 2, budget = 300_000): boolean[][] | null {
  const n = p.size;
  const room = { left: budget };
  const clueCells = p.clues.flatMap((v, i) => (v === null ? [] : [i]));
  const shapes: number[][][] = [];
  for (const at of clueCells) {
    const s = shapesOf(n, p.clues, at, room);
    if (!s) return null;
    shapes.push(s);
  }
  const used = new Int16Array(n * n); // cells in a placed island
  const near = new Int16Array(n * n); // cells beside a placed island (no other island may take them)
  const placed = new Array<boolean>(clueCells.length).fill(false);
  const found: boolean[][] = [];
  let out = false;
  const fits = (s: number[]) => s.every((c) => !used[c] && !near[c]);
  const fourSea = blocks(n);

  const walk = (): void => {
    if (found.length >= limit || out) return;
    if (--room.left < 0) {
      out = true;
      return;
    }
    // The clue with fewest shapes that still fit; and what land is still possible.
    let best = -1;
    let bestFits: number[][] = [];
    const maybe = Uint8Array.from(used, (u) => (u ? 1 : 0));
    for (let k = 0; k < clueCells.length; k++) {
      if (placed[k]) continue;
      const f = shapes[k].filter(fits);
      if (!f.length) return;
      for (const s of f) for (const c of s) maybe[c] = 1;
      if (best < 0 || f.length < bestFits.length) {
        best = k;
        bestFits = f;
      }
    }
    // Cells no island can reach are sea: no 2×2 of them, and they must be able to join up.
    for (const i of fourSea) if (block4(n, i).every((c) => !maybe[c])) return;
    if (best < 0) {
      if (!connected(n, (i) => !used[i])) return;
      found.push(Array.from(used, (u) => !u));
      return;
    }
    // The sure sea must be able to join up through cells no island has taken.
    if (!seaCanJoin(n, used, maybe)) return;
    placed[best] = true;
    for (const s of bestFits) {
      for (const c of s) {
        used[c]++;
        for (const j of sides(n, c)) near[j]++;
      }
      walk();
      for (const c of s) {
        used[c]--;
        for (const j of sides(n, c)) near[j]--;
      }
      if (found.length >= limit || out) break;
    }
    placed[best] = false;
  };
  walk();
  return out ? null : found;
}

/** Whether every cell that must be sea can reach every other through cells not yet land. */
function seaCanJoin(n: number, used: Int16Array, maybe: Uint8Array): boolean {
  let start = -1;
  let sure = 0;
  for (let i = 0; i < n * n; i++) {
    if (!maybe[i]) {
      sure++;
      if (start < 0) start = i;
    }
  }
  if (sure === 0) return true;
  const seen = new Uint8Array(n * n);
  seen[start] = 1;
  const stack = [start];
  let reached = 1;
  while (stack.length) {
    for (const j of sides(n, stack.pop()!)) {
      if (seen[j] || used[j]) continue;
      seen[j] = 1;
      if (!maybe[j]) reached++;
      stack.push(j);
    }
  }
  return reached === sure;
}

export function isUnique(p: Pick<Puzzle, 'size' | 'clues'>): boolean {
  const found = solutions(p);
  return found !== null && found.length === 1;
}

// ---- Generator ----

/** The island (connected land) holding cell i. */
function islandOf(n: number, land: boolean[], i: number): number[] {
  const seen = new Set([i]);
  const stack = [i];
  while (stack.length) {
    for (const j of sides(n, stack.pop()!)) {
      if (land[j] && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return [...seen];
}

/** A random answer: land from 2×2 pools of sea, the sea kept connected, no island over `biggest`. */
function answer(n: number, biggest: number, share: number, random: Random): boolean[] | null {
  const land = new Array<boolean>(n * n).fill(false);
  const canLand = (i: number) => {
    if (land[i]) return false;
    land[i] = true;
    const ok = islandOf(n, land, i).length <= biggest && connected(n, (j) => !land[j]);
    land[i] = false;
    return ok;
  };
  for (;;) {
    const pools = new Set<number>();
    for (const b of blocks(n)) if (block4(n, b).every((c) => !land[c])) for (const c of block4(n, b)) pools.add(c);
    const enough = land.filter(Boolean).length >= share * n * n;
    if (!pools.size && enough) return land;
    const pick = shuffle(pools.size ? [...pools] : land.flatMap((l, i) => (l ? [] : [i])), random).find(canLand);
    if (pick === undefined) return pools.size ? null : land;
    land[pick] = true;
  }
}

export function generate(difficulty: Difficulty, random: Random = Math.random): Puzzle {
  const { size: n, biggest, land: share } = DIFFICULTIES[difficulty];
  for (;;) {
    const land = answer(n, biggest, share, random);
    if (!land) continue;
    const clues = new Array<number | null>(n * n).fill(null);
    const seen = new Set<number>();
    land.forEach((l, i) => {
      if (!l || seen.has(i)) return;
      const isl = islandOf(n, land, i);
      isl.forEach((c) => seen.add(c));
      clues[isl[Math.floor(random() * isl.length)]] = isl.length;
    });
    // While another answer fits, turn a cell that it makes land (and ours leaves sea) into land:
    // a new island of 1, or one more cell for the island beside it. Ours still fits the new clues.
    for (let tries = 0; tries < 40; tries++) {
      const found = solutions({ size: n, clues });
      if (!found) break;
      if (found.length === 1) return { size: n, clues, solution: land.map((l) => !l) };
      const other = found.find((sea) => sea.some((v, i) => v === land[i]))!;
      let grew = false;
      for (const x of shuffle(other.flatMap((sea, i) => (!sea && !land[i] ? [i] : [])), random)) {
        const next = sides(n, x).filter((j) => land[j]);
        const touched = new Set(next.map((j) => islandOf(n, land, j)[0]));
        if (touched.size > 1) continue; // it would join two islands
        land[x] = true;
        const isl = islandOf(n, land, x);
        if (isl.length > biggest || !connected(n, (i) => !land[i])) {
          land[x] = false;
          continue;
        }
        const at = isl.find((c) => clues[c] !== null);
        if (at === undefined) clues[x] = 1;
        else clues[at] = isl.length;
        grew = true;
        break;
      }
      if (!grew) break;
    }
  }
}

// ---- Checks ----

/** Shaded cells in a 2×2 block of shade. */
export function conflicts(p: Pick<Puzzle, 'size'>, shaded: boolean[]): boolean[] {
  const n = p.size;
  const bad = new Array<boolean>(n * n).fill(false);
  for (const b of blocks(n)) if (block4(n, b).every((c) => shaded[c])) for (const c of block4(n, b)) bad[c] = true;
  return bad;
}

export function isPuzzle(value: unknown, difficulty: Difficulty): value is Puzzle {
  const p = value as Puzzle | null;
  const n = DIFFICULTIES[difficulty].size;
  return (
    typeof p === 'object' && p !== null && p.size === n &&
    Array.isArray(p.clues) && p.clues.length === n * n && p.clues.every((v) => v === null || (Number.isInteger(v) && v >= 1)) &&
    Array.isArray(p.solution) && p.solution.length === n * n && p.solution.every((s) => typeof s === 'boolean')
  );
}
