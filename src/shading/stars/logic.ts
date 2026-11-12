// Star Battle: place stars so every row, every column and every outlined region holds the same
// number of them (one, or two on the biggest board). Stars never touch, not even at a corner.
//
// Puzzles start from a real placement of stars. Regions grow around them (one star each, or two
// joined by a path), and a solver counts the placements the regions allow. While it finds a second
// one, a cell that second placement uses as a star (and ours doesn't) moves to a neighboring
// region, which keeps ours right and breaks that one.
import { around, connected, shuffle, sides, type Random } from '../grid';

export const DIFFICULTIES = {
  easy: { label: 'Easy', size: 6, stars: 1 },
  medium: { label: 'Medium', size: 8, stars: 1 },
  hard: { label: 'Hard', size: 9, stars: 2 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;
export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

export interface Puzzle {
  size: number;
  stars: number; // per row, column and region
  regions: number[]; // per cell: its region, 0..size-1
  solution: boolean[]; // per cell: a star
}

// ---- Solver ----
// Row by row: each row picks `stars` columns, none side by side, none touching the row above, with
// no column or region over its count. Rows are bit masks of columns.

/** Every way to put k stars in a row of n with none side by side, as bit masks. */
function rowChoices(n: number, k: number): number[] {
  const out: number[] = [];
  for (let m = 0; m < 1 << n; m++) {
    let bits = 0;
    for (let x = m; x; x &= x - 1) bits++;
    if (bits === k && (m & (m << 1)) === 0) out.push(m);
  }
  return out;
}

/**
 * Up to `limit` star placements the puzzle allows, as row masks; null if `budget` steps run out
 * first. `order` shuffles the choices tried (for making a random placement).
 */
export function solutions(
  n: number,
  k: number,
  regions: number[] | null,
  limit = 2,
  budget = 200_000,
  random?: Random,
): number[][] | null {
  const choices = rowChoices(n, k);
  const colCount = new Array<number>(n).fill(0);
  const regCount = new Array<number>(n).fill(0);
  // Cells of each region in rows r and below, for the region check.
  const regLeft: number[][] = [];
  if (regions) {
    for (let r = n; r >= 0; r--) {
      regLeft[r] = r === n ? new Array<number>(n).fill(0) : regLeft[r + 1].slice();
      if (r < n) for (let c = 0; c < n; c++) regLeft[r][regions[r * n + c]]++;
    }
  }
  const found: number[][] = [];
  const rows: number[] = [];
  let steps = 0;
  let out = false;

  const walk = (r: number, prev: number): void => {
    if (found.length >= limit || out) return;
    if (r === n) {
      found.push(rows.slice());
      return;
    }
    if (++steps > budget) {
      out = true;
      return;
    }
    const near = prev | (prev << 1) | (prev >> 1);
    const list = random ? shuffle(choices.slice(), random) : choices;
    const left = n - r - 1; // rows after this one
    for (const m of list) {
      if (m & near) continue;
      let ok = true;
      for (let c = 0; c < n && ok; c++) if (m & (1 << c) && colCount[c] >= k) ok = false;
      if (!ok) continue;
      if (regions) {
        for (let c = 0; c < n && ok; c++) if (m & (1 << c) && regCount[regions[r * n + c]] >= k) ok = false;
        if (!ok) continue;
      }
      for (let c = 0; c < n; c++) if (m & (1 << c)) { colCount[c]++; if (regions) regCount[regions[r * n + c]]++; }
      // Each column can still take at most one star every other row; each region only has its
      // cells further down.
      let fine = true;
      for (let c = 0; c < n && fine; c++) if (k - colCount[c] > Math.ceil(left / 2)) fine = false;
      if (fine && regions) for (let g = 0; g < n && fine; g++) if (k - regCount[g] > regLeft[r + 1][g]) fine = false;
      if (fine) {
        rows.push(m);
        walk(r + 1, m);
        rows.pop();
      }
      for (let c = 0; c < n; c++) if (m & (1 << c)) { colCount[c]--; if (regions) regCount[regions[r * n + c]]--; }
      if (found.length >= limit || out) return;
    }
  };
  walk(0, 0);
  return out ? null : found;
}

const toCells = (n: number, rows: number[]) =>
  Array.from({ length: n * n }, (_, i) => (rows[Math.floor(i / n)] & (1 << (i % n))) !== 0);

/** Whether the puzzle has exactly one placement (within the step budget). */
export function isUnique(p: Pick<Puzzle, 'size' | 'stars' | 'regions'>): boolean {
  const found = solutions(p.size, p.stars, p.regions);
  return found !== null && found.length === 1;
}

// ---- Generator ----

/** Regions around the stars: one star each, or pairs joined by a path; then grown to fill. */
function growRegions(n: number, k: number, stars: number[], random: Random): number[] | null {
  const region = new Array<number>(n * n).fill(-1);
  if (k === 1) stars.forEach((s, g) => (region[s] = g));
  else {
    const isStar = new Set(stars);
    const left = shuffle(stars.slice(), random);
    let g = 0;
    while (left.length) {
      const a = left.pop()!;
      region[a] = g;
      // The nearest unpaired star, by a path through free cells.
      const from = new Map<number, number>([[a, -1]]);
      const queue = [a];
      let b = -1;
      for (let q = 0; q < queue.length && b < 0; q++) {
        for (const j of shuffle(sides(n, queue[q]), random)) {
          if (from.has(j) || region[j] >= 0) continue;
          from.set(j, queue[q]);
          if (isStar.has(j)) {
            if (left.includes(j)) { b = j; break; }
            continue; // another region's star: not through it
          }
          queue.push(j);
        }
      }
      if (b < 0) return null;
      left.splice(left.indexOf(b), 1);
      for (let x = b; x !== a; x = from.get(x)!) region[x] = g;
      g++;
    }
  }
  // Grow: a random free cell beside a region joins it.
  for (;;) {
    const edge: number[] = [];
    for (let i = 0; i < n * n; i++) if (region[i] < 0 && sides(n, i).some((j) => region[j] >= 0)) edge.push(i);
    if (!edge.length) break;
    const i = edge[Math.floor(random() * edge.length)];
    const near = sides(n, i).filter((j) => region[j] >= 0);
    region[i] = region[near[Math.floor(random() * near.length)]];
  }
  return region.every((g) => g >= 0) ? region : null;
}

export function generate(difficulty: Difficulty, random: Random = Math.random): Puzzle {
  const { size: n, stars: k } = DIFFICULTIES[difficulty];
  for (;;) {
    const placed = solutions(n, k, null, 1, 100_000, random);
    if (!placed?.length) continue;
    const solution = toCells(n, placed[0]);
    const stars = solution.flatMap((s, i) => (s ? [i] : []));
    const regions = growRegions(n, k, stars, random);
    if (!regions) continue;
    // Break every other placement, one cell at a time.
    for (let tries = 0; tries < 60; tries++) {
      const found = solutions(n, k, regions);
      if (!found) break;
      if (found.length === 1) return { size: n, stars: k, regions, solution };
      const other = toCells(n, found.find((rows) => toCells(n, rows).some((s, i) => s !== solution[i]))!);
      const moves = shuffle(other.flatMap((s, i) => (s && !solution[i] ? [i] : [])), random);
      let moved = false;
      for (const x of moves) {
        const g = regions[x];
        const into = shuffle(sides(n, x).filter((j) => regions[j] !== g), random);
        // The region it leaves must stay in one piece, and keep a cell.
        if (!into.length || !connected(n, (i) => i !== x && regions[i] === g)) continue;
        if (!regions.some((v, i) => i !== x && v === g)) continue;
        regions[x] = regions[into[0]];
        moved = true;
        break;
      }
      if (!moved) break;
    }
  }
}

// ---- Checks ----

/** Stars that break a rule: touching another star, or one too many in their row, column or region. */
export function conflicts(p: Pick<Puzzle, 'size' | 'stars' | 'regions'>, stars: boolean[]): boolean[] {
  const n = p.size;
  const row = new Array<number>(n).fill(0);
  const col = new Array<number>(n).fill(0);
  const reg = new Array<number>(n).fill(0);
  stars.forEach((s, i) => {
    if (!s) return;
    row[Math.floor(i / n)]++;
    col[i % n]++;
    reg[p.regions[i]]++;
  });
  return stars.map((s, i) =>
    s && (row[Math.floor(i / n)] > p.stars || col[i % n] > p.stars || reg[p.regions[i]] > p.stars || around(n, i).some((j) => stars[j])),
  );
}

export function isPuzzle(value: unknown, difficulty: Difficulty): value is Puzzle {
  const p = value as Puzzle | null;
  const { size: n, stars: k } = DIFFICULTIES[difficulty];
  return (
    typeof p === 'object' && p !== null && p.size === n && p.stars === k &&
    Array.isArray(p.regions) && p.regions.length === n * n && p.regions.every((g) => Number.isInteger(g) && g >= 0 && g < n) &&
    Array.isArray(p.solution) && p.solution.length === n * n && p.solution.every((s) => typeof s === 'boolean')
  );
}
