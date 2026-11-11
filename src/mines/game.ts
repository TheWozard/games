// Mine finder game state and moves, as a pure reducer (apart from placing mines on the first
// reveal, which uses Math.random unless a source is passed in).
import { counts, flood, isDensity, isSize, mineCount, neighbors, placeMines, SIZES, type Density, type Size } from './logic';

export const STORAGE_KEY = 'games.mines.v1';

export interface Game {
  size: Size;
  density: Density;
  rows: number;
  cols: number;
  mineCount: number;
  mines: boolean[] | null; // placed on the first reveal
  revealed: boolean[];
  flagged: boolean[];
  status: 'playing' | 'won' | 'lost';
  exploded: number | null; // the mine that ended the game
}

export type Action =
  | { type: 'tap'; index: number } // reveal (or, on a number, clear around it)
  | { type: 'flag'; index: number }; // long-press / right-click

export function newGame(size: Size, density: Density): Game {
  const { rows, cols } = SIZES[size];
  return {
    size,
    density,
    rows,
    cols,
    mineCount: mineCount(size, density),
    mines: null,
    revealed: new Array(rows * cols).fill(false),
    flagged: new Array(rows * cols).fill(false),
    status: 'playing',
    exploded: null,
  };
}

/** Saves from before size and density were separate settings had one difficulty instead. */
const OLD_DIFFICULTIES: Record<string, [Size, Density]> = { easy: ['small', 'few'], medium: ['medium', 'some'], hard: ['large', 'many'] };

/** Validates a save, reading a pre-split save's difficulty as the size and density it stood for. */
export function isGame(value: unknown): value is Game {
  const g = value as (Partial<Game> & { difficulty?: string }) | null;
  if (g && !g.size && g.difficulty && Object.hasOwn(OLD_DIFFICULTIES, g.difficulty)) {
    [g.size, g.density] = OLD_DIFFICULTIES[g.difficulty];
    delete g.difficulty;
  }
  if (!isSize(g?.size) || !isDensity(g.density)) return false;
  const { rows, cols } = SIZES[g.size];
  const cells = rows * cols;
  return (
    g.rows === rows && g.cols === cols &&
    (g.mines === null || g.mines?.length === cells) &&
    g.revealed?.length === cells && g.flagged?.length === cells &&
    (g.status === 'playing' || g.status === 'won' || g.status === 'lost')
  );
}

export const flagsLeft = (g: Game) => g.mineCount - g.flagged.filter(Boolean).length;

function toggleFlag(g: Game, i: number): Game {
  if (g.status !== 'playing' || g.revealed[i]) return g;
  const flagged = g.flagged.slice();
  flagged[i] = !flagged[i];
  return { ...g, flagged };
}

/** Reveals `targets` (flooding out from zeros), then checks for a loss or a win. */
function open(g: Game, mines: boolean[], targets: number[]): Game {
  const board = { rows: g.rows, cols: g.cols };
  const near = counts(mines, board);
  const revealed = g.revealed.slice();
  let exploded: number | null = null;
  for (const t of targets) {
    if (revealed[t] || g.flagged[t]) continue;
    if (mines[t]) {
      exploded ??= t;
      revealed[t] = true;
      continue;
    }
    for (const j of flood(t, near, board, (k) => revealed[k] || g.flagged[k] || mines[k])) revealed[j] = true;
  }
  if (exploded !== null) return { ...g, mines, revealed, status: 'lost', exploded };
  const safeLeft = revealed.filter((r, i) => !r && !mines[i]).length;
  if (safeLeft === 0) return { ...g, mines, revealed, flagged: mines.slice(), status: 'won' };
  return { ...g, mines, revealed };
}

function reveal(g: Game, i: number, random: () => number): Game {
  if (g.status !== 'playing' || g.flagged[i]) return g;
  const board = { rows: g.rows, cols: g.cols };
  const mines = g.mines ?? placeMines(board, g.mineCount, i, random);
  if (!g.revealed[i]) return open(g, mines, [i]);
  // Tapping a revealed number whose mines are all flagged opens the rest of its neighbors.
  const around = neighbors(i, board);
  const n = around.filter((j) => mines[j]).length;
  const flags = around.filter((j) => g.flagged[j]).length;
  const hidden = around.filter((j) => !g.revealed[j] && !g.flagged[j]);
  return n > 0 && flags === n && hidden.length > 0 ? open(g, mines, hidden) : g;
}

export function reducer(g: Game, action: Action, random: () => number = Math.random): Game {
  switch (action.type) {
    case 'tap':
      return reveal(g, action.index, random);
    case 'flag':
      return toggleFlag(g, action.index);
  }
}
