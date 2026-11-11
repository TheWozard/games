// Solitaire game state and moves, as a pure reducer (apart from dealing, which uses Math.random).
import { bestTarget, draw, finish, finishable, isWon, move, winnableDeal, type Draw, type Source, type Table } from './logic';

export const STORAGE_KEY = 'games.solitaire.v1';
const HISTORY_LIMIT = 400;

export interface Game {
  draw: Draw;
  table: Table;
  history: Table[];
  moves: number;
  done: boolean;
}

export type Action =
  | { type: 'stock' } // turn over stock cards (or the waste back over)
  | { type: 'tap'; source: Source } // send these cards to their best place
  | { type: 'undo' };

export function newGame(drawCount: Draw): Game {
  return { draw: drawCount, table: winnableDeal(drawCount), history: [], moves: 0, done: false };
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  const t = g?.table;
  if ((g?.draw !== 1 && g?.draw !== 3) || !t || !Array.isArray(g.history)) return false;
  if (!Array.isArray(t.stock) || !Array.isArray(t.waste) || t.foundations?.length !== 4 || t.tableau?.length !== 7) return false;
  const cards = t.stock.length + t.waste.length + t.foundations.reduce((a, n) => a + n, 0) +
    t.tableau.reduce((a, c) => a + c.down.length + c.up.length, 0);
  return cards === 52;
}

/** Records a new table, playing everything up once nothing is left hidden. */
function next(g: Game, table: Table): Game {
  const settled = finishable(table) ? finish(table) : table;
  return {
    ...g,
    table: settled,
    history: [...g.history, g.table].slice(-HISTORY_LIMIT),
    moves: g.moves + 1,
    done: isWon(settled),
  };
}

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'stock': {
      if (g.done || (g.table.stock.length === 0 && g.table.waste.length === 0)) return g;
      return next(g, draw(g.table, g.draw));
    }
    case 'tap': {
      if (g.done) return g;
      const target = bestTarget(g.table, action.source);
      return target ? next(g, move(g.table, action.source, target)) : g;
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, table: last, history: g.history.slice(0, -1), moves: g.moves + 1 };
    }
  }
}
