// FreeCell game state and moves, as a pure reducer (apart from dealing, which uses Math.random).
// Cards that are safe to put up go to the foundations by themselves after every move.
import {
  autoplay, bestTarget, canMove, COLUMNS, DIFFICULTIES, isDifficulty, isWon, move, winnableDeal,
  type Difficulty, type Source, type Table, type Target,
} from './logic';

export const STORAGE_KEY = 'games.freecell.v1';
const HISTORY_LIMIT = 400;

export interface Game {
  difficulty: Difficulty;
  table: Table;
  history: Table[]; // tables before each move, for undo
  done: boolean;
}

export type Action =
  | { type: 'tap'; source: Source } // send these cards to their best place
  | { type: 'move'; source: Source; target: Target } // dragged to a chosen place
  | { type: 'undo' };

export function newGame(difficulty: Difficulty): Game {
  return { difficulty, table: autoplay(winnableDeal(DIFFICULTIES[difficulty].cells)), history: [], done: false };
}

const isCard = (c: unknown) => Number.isInteger(c) && (c as number) >= 0 && (c as number) < 52;

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  const t = g?.table;
  if (!isDifficulty(g?.difficulty) || !t || !Array.isArray(g.history)) return false;
  if (!Array.isArray(t.cells) || t.cells.length !== DIFFICULTIES[g.difficulty].cells) return false;
  if (!Array.isArray(t.foundations) || t.foundations.length !== 4 || !Array.isArray(t.columns) || t.columns.length !== COLUMNS) return false;
  const cards = [...t.cells.filter((c) => c !== null), ...t.columns.flat()];
  return cards.every(isCard) && cards.length + t.foundations.reduce((a, n) => a + n, 0) === 52;
}

/** Records a new table, after sending up whatever is now safe to. */
function next(g: Game, table: Table): Game {
  const settled = autoplay(table);
  return { ...g, table: settled, history: [...g.history, g.table].slice(-HISTORY_LIMIT), done: isWon(settled) };
}

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'tap': {
      if (g.done) return g;
      const target = bestTarget(g.table, action.source);
      return target ? next(g, move(g.table, action.source, target)) : g;
    }
    case 'move': {
      if (g.done || !canMove(g.table, action.source, action.target)) return g;
      return next(g, move(g.table, action.source, action.target));
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, table: last, history: g.history.slice(0, -1) };
    }
  }
}
