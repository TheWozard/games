// Gradient game state and moves, as a pure reducer.
import { corners, DIFFICULTIES, fixedTiles, isDifficulty, shuffled, type Difficulty, type Lab } from './logic';

export const STORAGE_KEY = 'games.gradient.v1';
const HISTORY_LIMIT = 500;

export interface Game {
  difficulty: Difficulty;
  cols: number;
  rows: number;
  corners: Lab[];
  fixed: boolean[]; // per position
  order: number[]; // tile id at each position; a tile's id is its home position
  selected: number | null; // position of the first tile picked for a swap
  history: [number, number][]; // swaps made, for undo
  done: boolean;
}

export type Action =
  | { type: 'tap'; pos: number }
  | { type: 'swap'; from: number; to: number }
  | { type: 'undo' };

export function newGame(difficulty: Difficulty): Game {
  const { cols, rows, fixed: pattern } = DIFFICULTIES[difficulty];
  const fixed = fixedTiles(cols, rows, pattern);
  return {
    difficulty,
    cols,
    rows,
    corners: corners(),
    fixed,
    order: shuffled(fixed),
    selected: null,
    history: [],
    done: false,
  };
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isDifficulty(g?.difficulty)) return false;
  const { cols, rows } = DIFFICULTIES[g.difficulty];
  const n = cols * rows;
  return (
    g.cols === cols && g.rows === rows &&
    g.corners?.length === 4 && g.fixed?.length === n && g.order?.length === n &&
    new Set(g.order).size === n && Array.isArray(g.history)
  );
}

function swap(g: Game, from: number, to: number, record = true): Game {
  const order = g.order.slice();
  [order[from], order[to]] = [order[to], order[from]];
  const done = order.every((id, pos) => id === pos);
  return {
    ...g,
    order,
    selected: null,
    history: record ? [...g.history, [from, to] as [number, number]].slice(-HISTORY_LIMIT) : g.history,
    done,
  };
}

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'tap': {
      const p = action.pos;
      if (g.done || g.fixed[p]) return g;
      if (g.selected === null) return { ...g, selected: p };
      if (g.selected === p) return { ...g, selected: null };
      return swap(g, g.selected, p);
    }
    case 'swap': {
      const { from, to } = action;
      if (g.done || from === to || g.fixed[from] || g.fixed[to]) return g;
      return swap(g, from, to);
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...swap(g, last[0], last[1], false), history: g.history.slice(0, -1) };
    }
  }
}
