// Killer Sudoku: Sudoku's rules (rows, columns and 3×3 boxes hold 1–9) plus cages: groups
// of cells whose digits add up to the cage's sum, with no digit repeated inside a cage.
// Puzzles have a unique solution: random solved grid → random cages → solver check, and wherever
// two solutions disagree that cell becomes a given, until only one solution remains.
import { PEERS, solvedGrid } from '../classic/logic';

// `sizes`: cage sizes to draw from (cages may end up split smaller to keep the solution unique).
// `extra`: additional givens on top of any needed for uniqueness, to ease the start.
export const DIFFICULTIES = {
  easy: { label: 'Easy', sizes: [2, 2, 3], extra: 6 },
  medium: { label: 'Medium', sizes: [2, 3, 3, 4], extra: 0 },
  hard: { label: 'Hard', sizes: [3, 4, 4, 5, 5], extra: 0 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;

export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

export interface Cage {
  cells: number[]; // sorted, so cells[0] is the top-left-most (where the sum is shown)
  sum: number;
}

type Random = () => number;
const ALL_DIGITS = 0x3fe; // bits 1..9

function shuffle<T>(a: T[], random: Random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pick = <T>(a: readonly T[], random: Random): T => a[Math.floor(random() * a.length)];

const bitCount = (m: number) => {
  let n = 0;
  for (; m; n++) m &= m - 1;
  return n;
};

/** COMBOS[size][sum]: every set of `size` distinct digits adding to `sum`, as bitmasks. */
const COMBOS: number[][][] = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => []));
for (let mask = 2; mask <= ALL_DIGITS; mask += 2) {
  let sum = 0;
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) sum += d;
  COMBOS[bitCount(mask)][sum].push(mask);
}

/** The digit sets a cage of `size` cells summing to `sum` can use, e.g. (2, 3) → [[1, 2]]. */
export function combinations(size: number, sum: number): number[][] {
  return (COMBOS[size]?.[sum] ?? []).map((m) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => m & (1 << d)));
}

/** Whether a full cage is correct: right sum, no repeats. */
export const cageSatisfied = (sum: number, vals: readonly number[]) =>
  new Set(vals).size === vals.length && vals.reduce((a, b) => a + b, 0) === sum;

// ---- Generation ----

const orthogonal = (i: number) => {
  const r = Math.floor(i / 9);
  const c = i % 9;
  const out: number[] = [];
  if (r > 0) out.push(i - 9);
  if (r < 8) out.push(i + 9);
  if (c > 0) out.push(i - 1);
  if (c < 8) out.push(i + 1);
  return out;
};

/** Splits the grid into connected cages with no repeated digit, sized per difficulty. */
function partition(solution: readonly number[], sizes: readonly number[], random: Random): number[][] {
  const maxSize = Math.max(...sizes);
  const owner = new Array(81).fill(-1);
  const cages: number[][] = [];
  const fits = (cage: number[], j: number) => owner[j] === -1 && !cage.some((i) => solution[i] === solution[j]);
  for (const start of shuffle([...Array(81).keys()], random)) {
    if (owner[start] !== -1) continue;
    const want = pick(sizes, random);
    const cage = [start];
    owner[start] = cages.length;
    while (cage.length < want) {
      const frontier = cage.flatMap(orthogonal).filter((j) => fits(cage, j));
      if (frontier.length === 0) break;
      const next = pick(frontier, random);
      owner[next] = cages.length;
      cage.push(next);
    }
    cages.push(cage);
  }
  // Fold leftover single cells into a neighboring cage where they fit.
  for (let k = 0; k < cages.length; k++) {
    if (cages[k].length !== 1) continue;
    const i = cages[k][0];
    owner[i] = -1;
    const options = orthogonal(i)
      .map((j) => owner[j])
      .filter((o) => o !== -1 && o !== k && cages[o].length < maxSize && fits(cages[o], i));
    if (options.length === 0) {
      owner[i] = k;
      continue;
    }
    const into = pick(options, random);
    cages[into].push(i);
    owner[i] = into;
    cages[k] = [];
  }
  return cages.filter((c) => c.length > 0).map((c) => c.sort((a, b) => a - b));
}

// Search steps allowed per uniqueness check. When a check runs out, another cell is given away
// instead, which always makes the next check cheaper, so generation can't stall.
const SEARCH_BUDGET = 4000;

export interface Puzzle {
  cages: Cage[];
  puzzle: number[]; // givens
  solution: number[];
}

export function generate(difficulty: Difficulty, random: Random = Math.random, budget = SEARCH_BUDGET): Puzzle {
  const solution = solvedGrid(random);
  const sumOf = (cells: number[]) => cells.reduce((a, i) => a + solution[i], 0);
  let cages: Cage[] = partition(solution, DIFFICULTIES[difficulty].sizes, random).map((cells) => ({ cells, sum: sumOf(cells) }));
  const puzzle = new Array(81).fill(0);

  // Splitting a cage adds information without revealing a digit, so prefer it over a given.
  const trySplit = (k: number, keep?: number): boolean => {
    const halves = split(cages[k].cells, keep ?? cages[k].cells[0], random);
    if (!halves) return false;
    cages = [...cages.slice(0, k), ...cages.slice(k + 1), ...halves.map((cells) => ({ cells, sum: sumOf(cells) }))];
    return true;
  };

  for (;;) {
    const found = solve(cages, puzzle, 2, budget);
    if (found?.length === 1) break;
    if (found) {
      // Two solutions: split the cage of a cell where they differ, or else give that cell away.
      const differ = shuffle([...Array(81).keys()].filter((i) => found[0][i] !== found[1][i]), random);
      if (differ.some((i) => trySplit(cages.findIndex((c) => c.cells.includes(i)), i))) continue;
      puzzle[differ[0]] = solution[differ[0]];
    } else {
      // Out of budget: split the biggest cage, or else give away an empty cell.
      const biggest = cages.reduce((b, c, k) => (c.cells.length > cages[b].cells.length ? k : b), 0);
      if (trySplit(biggest)) continue;
      const cell = pick([...Array(81).keys()].filter((i) => !puzzle[i]), random);
      puzzle[cell] = solution[cell];
    }
  }
  // A one-cell cage is a given in all but name; show it as one.
  for (const c of cages) if (c.cells.length === 1) puzzle[c.cells[0]] = c.sum;
  const empty = shuffle([...Array(81).keys()].filter((i) => !puzzle[i]), random);
  for (const i of empty.slice(0, DIFFICULTIES[difficulty].extra)) puzzle[i] = solution[i];
  cages.sort((a, b) => a.cells[0] - b.cells[0]);
  return { cages, puzzle, solution };
}

/** Splits a cage of 4+ cells into two connected parts of 2+ cells, or null if it can't. */
function split(cells: number[], keep: number, random: Random): [number[], number[]] | null {
  if (cells.length < 4) return null;
  const inCage = new Set(cells);
  for (let attempt = 0; attempt < 20; attempt++) {
    const size = 2 + Math.floor(random() * (cells.length - 3));
    const part = [keep];
    while (part.length < size) {
      const frontier = part.flatMap(orthogonal).filter((j) => inCage.has(j) && !part.includes(j));
      if (frontier.length === 0) break;
      part.push(pick(frontier, random));
    }
    const rest = cells.filter((i) => !part.includes(i));
    if (part.length < 2 || rest.length < 2) continue;
    // The rest must be connected too.
    const seen = new Set([rest[0]]);
    const queue = [rest[0]];
    for (let q = 0; q < queue.length; q++) {
      for (const j of orthogonal(queue[q])) {
        if (rest.includes(j) && !seen.has(j)) {
          seen.add(j);
          queue.push(j);
        }
      }
    }
    if (seen.size === rest.length) return [part.sort((a, b) => a - b), rest.sort((a, b) => a - b)];
  }
  return null;
}

// ---- Solver ----

/** The 27 rows, columns and boxes. */
const UNITS: number[][] = [
  ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
  ...Array.from({ length: 9 }, (_, b) =>
    Array.from({ length: 9 }, (_, k) => (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3))),
];

/**
 * Extra sum constraints implied by the cages: each row, column and box adds to 45, so the cells of
 * a unit not covered by cages lying wholly inside it add to 45 minus those cages' sums.
 */
function virtualCages(cages: readonly Cage[]): Cage[] {
  const cageOf = new Array<number>(81);
  cages.forEach((c, k) => c.cells.forEach((i) => (cageOf[i] = k)));
  const out: Cage[] = [];
  for (const unit of UNITS) {
    const inUnit = new Set(unit);
    const inside = new Set(unit.map((i) => cageOf[i]).filter((k) => cages[k].cells.every((i) => inUnit.has(i))));
    const rest = unit.filter((i) => !inside.has(cageOf[i]));
    if (rest.length === 0 || rest.length === 9) continue;
    out.push({ cells: rest, sum: 45 - [...inside].reduce((a, k) => a + cages[k].sum, 0) });
  }
  return out;
}

/** Finds up to `limit` solutions, or gives up (null) after `budget` search steps. */
export function solve(cages: readonly Cage[], givens: readonly number[], limit: number, budget = Infinity): number[][] | null {
  // Every constraint is "these cells hold distinct digits adding to this sum": the real cages,
  // plus the ones the 45 rule implies.
  const groups = [...cages, ...virtualCages(cages)];
  const combos = groups.map((c) => COMBOS[c.cells.length]?.[c.sum] ?? []);
  const required = new Array<number>(groups.length);
  const values = givens.slice();
  const found: number[][] = [];
  const cand = new Array<number>(81);
  let steps = 0;

  const search = () => {
    if (++steps > budget) return;

    // Candidates: free in the cell's row, column and box...
    for (let i = 0; i < 81; i++) {
      if (values[i]) continue;
      let used = 0;
      for (const p of PEERS[i]) used |= 1 << values[p];
      cand[i] = ALL_DIGITS & ~used;
    }
    // ...and, for every group the cell is in, part of a digit set that contains the digits placed
    // in the group so far and whose missing digits each still fit some empty cell of the group.
    for (let k = 0; k < groups.length; k++) {
      const cells = groups[k].cells;
      let placed = 0;
      let reach = 0;
      for (const i of cells) {
        if (values[i]) placed |= 1 << values[i];
        else reach |= cand[i];
      }
      let allowed = 0;
      let need = ALL_DIGITS;
      for (const c of combos[k]) {
        if ((c & placed) !== placed || (c & ~placed & ~reach) !== 0) continue;
        allowed |= c;
        need &= c;
      }
      if (!allowed) return;
      required[k] = need & ~placed;
      for (const i of cells) {
        if (values[i]) continue;
        cand[i] &= allowed;
        if (!cand[i]) return;
      }
    }

    // Branch on the cell with the fewest candidates...
    let best = -1;
    let bestMask = 0;
    let bestCount = Infinity;
    for (let i = 0; i < 81 && bestCount > 1; i++) {
      if (values[i]) continue;
      const count = bitCount(cand[i]);
      if (count < bestCount) {
        best = i;
        bestMask = cand[i];
        bestCount = count;
      }
    }
    if (best === -1) {
      found.push(values.slice());
      return;
    }

    // ...unless some digit has exactly one place to go (or none: dead end) in a row, column or
    // box, or among the cells of a group that must contain it.
    const single = (cells: readonly number[], digits: number): boolean | null => {
      for (let d = 1; d <= 9; d++) {
        const bit = 1 << d;
        if (!(digits & bit)) continue;
        let spot = -1;
        let spots = 0;
        for (const i of cells) {
          if (!values[i] && cand[i] & bit) {
            spot = i;
            spots++;
          }
        }
        if (spots === 0) return null;
        if (spots === 1) {
          best = spot;
          bestMask = bit;
          bestCount = 1;
          return true;
        }
      }
      return false;
    };
    if (bestCount > 1) {
      for (const unit of UNITS) {
        let placed = 0;
        for (const i of unit) if (values[i]) placed |= 1 << values[i];
        const r = single(unit, ALL_DIGITS & ~placed);
        if (r === null) return;
        if (r) break;
      }
    }
    if (bestCount > 1) {
      for (let k = 0; k < groups.length; k++) {
        const r = single(groups[k].cells, required[k]);
        if (r === null) return;
        if (r) break;
      }
    }

    for (let d = 1; d <= 9 && found.length < limit; d++) {
      if (!(bestMask & (1 << d))) continue;
      values[best] = d;
      search();
      values[best] = 0;
    }
  };

  search();
  return steps > budget ? null : found;
}
