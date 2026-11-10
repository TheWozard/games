// Sudoku rules and puzzle generation. Pure functions over 81-cell arrays (row-major, 0 = empty),
// with candidate sets stored as bitmasks (bit d set = digit d allowed).

export const DIFFICULTIES = {
  easy: { label: 'Easy', clues: 40 },
  medium: { label: 'Medium', clues: 32 },
  hard: { label: 'Hard', clues: 26 },
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

function freeMask(grid: Grid, i: number): number {
  let used = 0;
  for (const p of PEERS[i]) used |= 1 << grid[p];
  return ALL_DIGITS & ~used;
}

function bitCount(m: number): number {
  let n = 0;
  for (; m; n++) m &= m - 1;
  return n;
}

function shuffle<T>(a: T[], random: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The empty cell with the fewest candidates: index -1 when the grid is full, null at a dead end. */
function pickCell(grid: Grid): { index: number; mask: number } | null {
  let best = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    const mask = freeMask(grid, i);
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

function fillRandom(grid: Grid, random: () => number): boolean {
  const pick = pickCell(grid);
  if (!pick) return false;
  if (pick.index === -1) return true;
  for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random)) {
    if (!(pick.mask & (1 << d))) continue;
    grid[pick.index] = d;
    if (fillRandom(grid, random)) return true;
  }
  grid[pick.index] = 0;
  return false;
}

/** A random complete, valid Sudoku grid. */
export function solvedGrid(random: () => number = Math.random): Grid {
  const grid: Grid = new Array(81).fill(0);
  fillRandom(grid, random);
  return grid;
}

/** Counts solutions up to `limit`, leaving the grid as it found it. */
export function countSolutions(grid: Grid, limit: number): number {
  const pick = pickCell(grid);
  if (!pick) return 0;
  if (pick.index === -1) return 1;
  let count = 0;
  for (let d = 1; d <= 9 && count < limit; d++) {
    if (!(pick.mask & (1 << d))) continue;
    grid[pick.index] = d;
    count += countSolutions(grid, limit - count);
  }
  grid[pick.index] = 0;
  return count;
}

/** A random full grid, then clues removed in random order while the solution stays unique. */
export function generate(difficulty: Difficulty, random: () => number = Math.random): { puzzle: Grid; solution: Grid } {
  const solution = solvedGrid(random);
  const puzzle = solution.slice();
  let clues = 81;
  for (const i of shuffle([...Array(81).keys()], random)) {
    if (clues <= DIFFICULTIES[difficulty].clues) break;
    const value = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle, 2) === 1) clues--;
    else puzzle[i] = value;
  }
  return { puzzle, solution };
}
