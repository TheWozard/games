// Nonogram game state and moves, as a pure reducer. Each cell is empty, shaded in a color (1 when
// there are no colors), or crossed: the player's note that it stays empty. A stroke (a tap, or a
// drag along a row or column) paints its cells one value, as one undo step.
import { DIFFICULTIES, generate, isDifficulty, isRules, isSolved, NO_RULES, type Difficulty, type Puzzle, type Rules, type Run } from './logic';

export const STORAGE_KEY = 'games.nonogram.v1';
const HISTORY_LIMIT = 300;

export const EMPTY = 0;
export const CROSS = -1;

export interface Game {
  difficulty: Difficulty;
  rules: Rules;
  size: number;
  colors: number;
  rows: Run[][];
  cols: Run[][];
  cells: number[]; // EMPTY, CROSS or a color 1..colors
  history: number[][];
  done: boolean;
}

export type Action =
  | { type: 'paint'; indices: number[]; value: number }
  | { type: 'undo' };

export function gameOf(difficulty: Difficulty, rules: Rules, { size, colors, rows, cols }: Puzzle): Game {
  return {
    difficulty, rules: { ...rules }, size, colors, rows, cols,
    cells: new Array<number>(size * size).fill(EMPTY), history: [], done: false,
  };
}

export const newGame = (difficulty: Difficulty, rules: Rules = NO_RULES): Game =>
  gameOf(difficulty, rules, generate(difficulty, rules));

/** The cells as shading only: crosses count as empty. */
export const shading = (cells: number[]) => cells.map((v) => (v === CROSS ? EMPTY : v));

const isRun = (colors: number) => (run: unknown): boolean => {
  const r = run as Run | null;
  return typeof r === 'object' && r !== null &&
    Number.isInteger(r.color) && r.color >= 1 && r.color <= colors &&
    (r.length === null || (Number.isInteger(r.length) && r.length >= 1));
};

const isClues = (clues: unknown, size: number, colors: number) =>
  Array.isArray(clues) && clues.length === size &&
  clues.every((clue) => Array.isArray(clue) && clue.every(isRun(colors)));

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isDifficulty(g?.difficulty) || !isRules(g.rules)) return false;
  const { size, colors } = DIFFICULTIES[g.difficulty];
  const k = g.rules.colors ? colors : 1;
  const isCell = (v: unknown) => v === EMPTY || v === CROSS || (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= k);
  return (
    g.size === size && g.colors === k &&
    isClues(g.rows, size, k) && isClues(g.cols, size, k) &&
    Array.isArray(g.cells) && g.cells.length === size * size && g.cells.every(isCell) &&
    Array.isArray(g.history) && g.history.every((h) => Array.isArray(h) && h.length === size * size) &&
    typeof g.done === 'boolean'
  );
}

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'paint': {
      const { indices, value } = action;
      if (g.done || !(value === EMPTY || value === CROSS || (Number.isInteger(value) && value >= 1 && value <= g.colors))) return g;
      const targets = indices.filter((i) => i in g.cells && g.cells[i] !== value);
      if (!targets.length) return g;
      const cells = g.cells.slice();
      for (const i of targets) cells[i] = value;
      return { ...g, cells, history: [...g.history, g.cells].slice(-HISTORY_LIMIT), done: isSolved(g, shading(cells)) };
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, cells: last, history: g.history.slice(0, -1) };
    }
  }
}
