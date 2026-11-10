// Mine finder: reveal every safe cell; numbers count the mines among a cell's eight neighbours.
// Mines are placed on the first tap, away from it, and only in layouts that a deduction-only
// solver can clear from there, so a game never comes down to a guess.

export const DIFFICULTIES = {
  easy: { label: 'Easy', rows: 9, cols: 9, mines: 10 },
  medium: { label: 'Medium', rows: 14, cols: 10, mines: 22 },
  hard: { label: 'Hard', rows: 18, cols: 12, mines: 40 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;

export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

type Random = () => number;

export interface Board {
  rows: number;
  cols: number;
}

export function neighbours(i: number, { rows, cols }: Board): number[] {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if ((dr || dc) && rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc);
    }
  }
  return out;
}

/** For each cell, how many of its neighbours are mines. */
export function counts(mines: readonly boolean[], board: Board): number[] {
  return mines.map((_, i) => neighbours(i, board).filter((j) => mines[j]).length);
}

/** Cells uncovered by revealing `start`: it, plus everything reachable through zero-count cells. */
export function flood(start: number, near: readonly number[], board: Board, blocked: (i: number) => boolean): number[] {
  const seen = new Set([start]);
  const queue = [start];
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k];
    if (near[i] !== 0) continue;
    for (const j of neighbours(i, board)) {
      if (!seen.has(j) && !blocked(j)) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return queue;
}

const MAX_ATTEMPTS = 1000;

/** A mine layout with `first` and its neighbours clear, solvable from `first` without guessing. */
export function placeMines(board: Board, count: number, first: number, random: Random = Math.random): boolean[] {
  const total = board.rows * board.cols;
  const keepClear = new Set([first, ...neighbours(first, board)]);
  const open = [...Array(total).keys()].filter((i) => !keepClear.has(i));
  let mines: boolean[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Partial Fisher–Yates: the first `count` cells of `open` become mines.
    for (let k = 0; k < count; k++) {
      const j = k + Math.floor(random() * (open.length - k));
      [open[k], open[j]] = [open[j], open[k]];
    }
    mines = new Array(total).fill(false);
    for (let k = 0; k < count; k++) mines[open[k]] = true;
    if (solvable(mines, board, first)) break;
  }
  return mines;
}

/**
 * Whether the board can be cleared from `first` by deduction alone, using: a number whose mines
 * are all found clears its other neighbours; a number with exactly as many hidden neighbours as
 * missing mines makes them all mines; the same two rules on the difference of two numbers whose
 * hidden neighbours overlap as a subset; and the total mine count.
 */
export function solvable(mines: readonly boolean[], board: Board, first: number): boolean {
  const total = mines.length;
  const mineCount = mines.filter(Boolean).length;
  const near = counts(mines, board);
  const UNKNOWN = 0, SAFE = 1, MINE = 2;
  const known = new Array<number>(total).fill(UNKNOWN);
  let safeLeft = total - mineCount;
  let minesLeft = mineCount;

  const reveal = (i: number) => {
    if (known[i] !== UNKNOWN) return;
    for (const j of flood(i, near, board, (k) => known[k] !== UNKNOWN)) {
      if (known[j] === UNKNOWN) {
        known[j] = SAFE;
        safeLeft--;
      }
    }
  };
  const mark = (i: number) => {
    if (known[i] !== UNKNOWN) return;
    known[i] = MINE;
    minesLeft--;
  };

  reveal(first);
  while (safeLeft > 0) {
    let progress = false;

    // Constraints: for each revealed number next to hidden cells, those cells and how many mines.
    const constraints: { cells: number[]; mines: number }[] = [];
    for (let i = 0; i < total; i++) {
      if (known[i] !== SAFE || near[i] === 0) continue;
      const around = neighbours(i, board);
      const hidden = around.filter((j) => known[j] === UNKNOWN);
      if (hidden.length === 0) continue;
      const m = near[i] - around.filter((j) => known[j] === MINE).length;
      if (m === 0) hidden.forEach(reveal);
      else if (m === hidden.length) hidden.forEach(mark);
      else {
        constraints.push({ cells: hidden, mines: m });
        continue;
      }
      progress = true;
    }
    if (progress) continue;

    for (const a of constraints) {
      for (const b of constraints) {
        if (a === b || a.cells.length >= b.cells.length) continue;
        if (!a.cells.every((i) => b.cells.includes(i))) continue;
        const rest = b.cells.filter((i) => !a.cells.includes(i));
        const m = b.mines - a.mines;
        if (m === 0) rest.forEach(reveal);
        else if (m === rest.length) rest.forEach(mark);
        else continue;
        progress = true;
      }
    }
    if (progress) continue;

    const hidden = known.flatMap((k, i) => (k === UNKNOWN ? [i] : []));
    if (minesLeft === 0) hidden.forEach(reveal);
    else if (minesLeft === hidden.length) hidden.forEach(mark);
    else return false;
  }
  return true;
}
