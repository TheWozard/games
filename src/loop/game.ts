// Loop game state and moves, as a pure reducer. Each edge is empty, a line, or a cross (the
// player's note that the loop doesn't go there). Tapping a side cycles it: empty, line, cross, empty.
import { DARK, DIFFICULTIES, edgeCount, generate, isDifficulty, isRules, isSolved, LIGHT, NO_RULES, type Difficulty, type Grid, type Puzzle, type Rules, type Square } from './logic';

export const STORAGE_KEY = 'games.loop.v1';
const HISTORY_LIMIT = 300;

export const EMPTY = 0;
export const LINE = 1;
export const CROSS = 2;
export type Mark = typeof EMPTY | typeof LINE | typeof CROSS;

/** What a tap turns a side into: empty → line → cross → empty. */
export const next = (m: Mark): Mark => (m === EMPTY ? LINE : m === LINE ? CROSS : EMPTY);

export interface Game extends Grid {
  difficulty: Difficulty;
  rules: Rules;
  clues: (number | null)[];
  squares: (Square | null)[]; // per cell
  rings: boolean[]; // per dot
  marks: Mark[]; // per edge
  history: Mark[][];
  done: boolean;
}

export type Action =
  | { type: 'cycle'; edge: number }
  | { type: 'undo' };

export const newGame = (difficulty: Difficulty, rules: Rules = NO_RULES): Game =>
  gameOf(difficulty, rules, generate(difficulty, rules));

/** A new game of a puzzle already made (e.g. in the background, background.ts). */
export function gameOf(difficulty: Difficulty, rules: Rules, { clues, squares, rings }: Puzzle): Game {
  const { rows, cols } = DIFFICULTIES[difficulty];
  return { difficulty, rules: { ...rules }, rows, cols, clues, squares, rings, marks: new Array<Mark>(edgeCount({ rows, cols })).fill(EMPTY), history: [], done: false };
}

/**
 * Validates a save. Older saves carry on: from before squares and rings, with none; from before
 * the rules could be picked, with the rules its clues show.
 */
export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isDifficulty(g?.difficulty)) return false;
  const { rows, cols } = DIFFICULTIES[g.difficulty];
  g.squares ??= new Array(rows * cols).fill(null);
  g.rings ??= new Array((rows + 1) * (cols + 1)).fill(false);
  g.rules ??= { squares: g.squares.some((k) => k !== null), rings: g.rings.some(Boolean) };
  return (
    isRules(g.rules) &&
    g.squares.length === rows * cols && g.squares.every((k) => k === null || k === LIGHT || k === DARK) &&
    g.rings.length === (rows + 1) * (cols + 1) && g.rings.every((x) => typeof x === 'boolean') &&
    g.rows === rows && g.cols === cols &&
    g.clues?.length === rows * cols && g.marks?.length === edgeCount({ rows, cols }) &&
    g.marks.every((m) => m === EMPTY || m === LINE || m === CROSS) &&
    Array.isArray(g.history)
  );
}

const solved = (g: Game, marks: Mark[]) => isSolved(g, g, marks.map((m) => m === LINE));

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'cycle': {
      if (g.done || !(action.edge in g.marks)) return g;
      const marks = g.marks.slice();
      marks[action.edge] = next(g.marks[action.edge]);
      return { ...g, marks, history: [...g.history, g.marks].slice(-HISTORY_LIMIT), done: solved(g, marks) };
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, marks: last, history: g.history.slice(0, -1) };
    }
  }
}
