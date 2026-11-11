// Sudoku rules and puzzle generation. Pure functions over 81-cell arrays (row-major, 0 = empty),
// with candidate sets stored as bitmasks (bit d set = digit d allowed).
import { BOXES, grade } from './grade';

// A difficulty is the tier of techniques a puzzle needs (grade.ts): Easy is singles only, Medium
// needs pointing or pairs, Hard needs triples, fish or wings. `clues`: the fewest givens it keeps.
export const DIFFICULTIES = {
  easy: { label: 'Easy', tier: 1, clues: 36 },
  medium: { label: 'Medium', tier: 2, clues: 28 },
  hard: { label: 'Hard', tier: 3, clues: 0 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;

export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

export type Grid = number[];

const ALL_DIGITS = 0x3fe; // bits 1..9

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** For each cell, the 20 other cells that share its row, column or box. */
export const PEERS: readonly (readonly number[])[] = Array.from({ length: 81 }, (_, i) => {
  const peers: number[] = [];
  for (let j = 0; j < 81; j++) {
    if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) peers.push(j);
  }
  return peers;
});

export type Peers = readonly (readonly number[])[];

function freeMask(grid: Grid, i: number, peers: Peers): number {
  let used = 0;
  for (const p of peers[i]) used |= 1 << grid[p];
  return ALL_DIGITS & ~used;
}

function bitCount(m: number): number {
  let n = 0;
  for (; m; n++) m &= m - 1;
  return n;
}

export function shuffle<T>(a: T[], random: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The empty cell with the fewest candidates: index -1 when the grid is full, null at a dead end. */
function pickCell(grid: Grid, peers: Peers): { index: number; mask: number } | null {
  let best = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    const mask = freeMask(grid, i, peers);
    const count = bitCount(mask);
    if (count === 0) return null;
    if (count < bestCount) {
      best = i;
      bestMask = mask;
      bestCount = count;
      if (count === 1) break;
    }
  }
  return { index: best, mask: bestMask };
}

/** A random complete, valid Sudoku grid. */
export function solvedGrid(random: () => number = Math.random): Grid {
  const grid: Grid = new Array(81).fill(0);
  const fill = (): boolean => {
    const pick = pickCell(grid, PEERS);
    if (!pick) return false;
    if (pick.index === -1) return true;
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random)) {
      if (!(pick.mask & (1 << d))) continue;
      grid[pick.index] = d;
      if (fill()) return true;
    }
    grid[pick.index] = 0;
    return false;
  };
  fill();
  return grid;
}

/** Counts solutions up to `limit`, leaving the grid as it found it. */
export function countSolutions(grid: Grid, limit: number, peers: Peers = PEERS): number {
  const pick = pickCell(grid, peers);
  if (!pick) return 0;
  if (pick.index === -1) return 1;
  let count = 0;
  for (let d = 1; d <= 9 && count < limit; d++) {
    if (!(pick.mask & (1 << d))) continue;
    grid[pick.index] = d;
    count += countSolutions(grid, limit - count, peers);
  }
  grid[pick.index] = 0;
  return count;
}

/**
 * Givens removed from `solution` in random order while the difficulty's techniques can still
 * solve it (so it has one solution, reached without guessing), down to the difficulty's fewest
 * givens. `needs`: the tier the result takes, which may be easier than the difficulty's.
 */
export function dig(
  solution: Grid,
  difficulty: Difficulty,
  random: () => number,
  regions: readonly number[] = BOXES,
): { puzzle: Grid; needs: number } {
  const { tier, clues } = DIFFICULTIES[difficulty];
  const puzzle = solution.slice();
  let left = 81;
  let needs = 1;
  for (const i of shuffle([...Array(81).keys()], random)) {
    if (left <= clues) break;
    const value = puzzle[i];
    puzzle[i] = 0;
    const g = grade(puzzle, tier, regions);
    if (g) {
      left--;
      needs = g;
    } else {
      puzzle[i] = value;
    }
  }
  return { puzzle, needs };
}

// Grids tried before settling for the last one, however it grades. At about one Hard in ten,
// running out is a one-in-a-billion event.
export const MAX_TRIES = 200;

/** A puzzle that needs the difficulty's own tier, not just easier ones: dug from new grids until one does. */
export function generate(difficulty: Difficulty, random: () => number = Math.random): { puzzle: Grid; solution: Grid } {
  for (let tries = 1; ; tries++) {
    const solution = solvedGrid(random);
    const { puzzle, needs } = dig(solution, difficulty, random);
    if (needs === DIFFICULTIES[difficulty].tier || tries >= MAX_TRIES) return { puzzle, solution };
  }
}
