// Gradient game state and moves, as a pure reducer.
import { corners, fixedTiles, isPattern, isSize, PATTERNS, shuffled, SIZES, type Lab, type Pattern, type Size } from './logic';

export const STORAGE_KEY = 'games.gradient.v1';
const HISTORY_LIMIT = 500;

export interface Settings {
  size: Size;
  pattern: Pattern;
}

export interface Game extends Settings {
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

export const DEFAULT: Settings = { size: 'small', pattern: 'checker' };

export function newGame({ size, pattern }: Settings): Game {
  const { cols, rows } = SIZES[size];
  const fixed = fixedTiles(cols, rows, pattern);
  return {
    size,
    pattern,
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

export const describe = ({ size, pattern }: Settings) =>
  `${SIZES[size].cols}×${SIZES[size].rows} · ${PATTERNS[pattern].label}`;

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isSize(g?.size) || !isPattern(g.pattern)) return false;
  const { cols, rows } = SIZES[g.size];
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

export interface Line {
  correct: boolean; // every tile in it is home
  fixed: boolean; // every tile in it is fixed, so it's always correct (no marker shown)
}

/** For each row and column: whether it's complete, and whether it's made only of fixed tiles. */
export function lines(g: Game): { rows: Line[]; cols: Line[] } {
  const line = (cells: number[]): Line => ({
    correct: cells.every((p) => g.order[p] === p),
    fixed: cells.every((p) => g.fixed[p]),
  });
  const range = (n: number) => [...Array(n).keys()];
  return {
    rows: range(g.rows).map((r) => line(range(g.cols).map((c) => r * g.cols + c))),
    cols: range(g.cols).map((c) => line(range(g.rows).map((r) => r * g.cols + c))),
  };
}

/** What earlier versions (with three fixed levels) saved, mapped to the matching settings. */
const OLD_LEVELS: Record<string, Settings> = {
  easy: { size: 'small', pattern: 'checker' },
  medium: { size: 'medium', pattern: 'border' },
  hard: { size: 'large', pattern: 'corners' },
};

/** A saved game in the current shape, upgrading one saved by an earlier version; else null. */
export function fromSaved(value: unknown): Game | null {
  if (isGame(value)) return value;
  const old = value as { difficulty?: unknown } | null;
  if (typeof old?.difficulty !== 'string' || !Object.hasOwn(OLD_LEVELS, old.difficulty)) return null;
  const { difficulty, ...rest } = old as { difficulty: string };
  const upgraded = { ...rest, ...OLD_LEVELS[difficulty] };
  return isGame(upgraded) ? upgraded : null;
}
