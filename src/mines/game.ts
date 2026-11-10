// Mine finder game state and moves, as a pure reducer (apart from placing mines on the first
// reveal, which uses Math.random unless a source is passed in).
import { counts, DIFFICULTIES, flood, isDifficulty, neighbours, placeMines, type Difficulty } from './logic';

export const STORAGE_KEY = 'games.mines.v1';

export interface Game {
  difficulty: Difficulty;
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

export function newGame(difficulty: Difficulty): Game {
  const { rows, cols, mines } = DIFFICULTIES[difficulty];
  return {
    difficulty,
    rows,
    cols,
    mineCount: mines,
    mines: null,
    revealed: new Array(rows * cols).fill(false),
    flagged: new Array(rows * cols).fill(false),
    status: 'playing',
    exploded: null,
  };
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isDifficulty(g?.difficulty)) return false;
  const { rows, cols } = DIFFICULTIES[g.difficulty];
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
  // Tapping a revealed number whose mines are all flagged opens the rest of its neighbours.
  const around = neighbours(i, board);
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
