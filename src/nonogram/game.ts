// Nonogram game state and moves, as a pure reducer. Each cell is empty, shaded in a color (1 when
// there are no colors), or crossed: the player's note that it stays empty. A stroke (a tap, or a
// drag along a row or column) paints its cells one value, as one undo step.
import { PALETTE } from '../shared/palette';
import { DIFFICULTIES, generate, isDifficulty, isRules, isSolved, NO_RULES, type Difficulty, type Puzzle, type Rules, type Run } from './logic';

// ---- Palettes ----
// A colored puzzle is drawn in one of these sets of PALETTE's colors (by index), picked at random.
// Each set keeps apart the pairs that are hard to tell apart: red and green (or orange and green,
// or red and lime) for color-blind players, and near neighbors like blue and purple or yellow and lime.
export const PALETTES: Record<2 | 3, readonly (readonly number[])[]> = {
  2: [
    [0, 1], // red, blue
    [2, 4], // yellow, purple
    [5, 6], // orange, teal
    [1, 5], // blue, orange
    [2, 1], // yellow, blue
    [6, 0], // teal, red
    [4, 8], // purple, lime
    [11, 2], // indigo, yellow
    [10, 0], // white, red
    [7, 6], // pink, teal
  ],
  3: [
    [0, 1, 2], // red, blue, yellow
    [6, 4, 2], // teal, purple, yellow
    [5, 1, 10], // orange, blue, white
    [7, 6, 2], // pink, teal, yellow
    [0, 6, 10], // red, teal, white
    [11, 2, 7], // indigo, yellow, pink
    [7, 1, 2], // pink, blue, yellow
    [5, 11, 6], // orange, indigo, teal
    [4, 6, 10], // purple, teal, white
  ],
};

/** A random palette for a puzzle with this many colors (none for a plain one: it uses the accent). */
export function pickPalette(colors: number, random: () => number = Math.random): number[] {
  const list = PALETTES[colors as 2 | 3];
  return list ? [...list[Math.floor(random() * list.length)]] : [];
}

/** PALETTE's first colors, as a palette: what games were drawn in before palettes were picked. */
const firstColors = (colors: number) => Array.from({ length: colors > 1 ? colors : 0 }, (_, k) => k);

/** The palette a game is drawn in (older saves have none, and used the first colors). */
export const paletteOf = (g: Game): number[] => g.palette ?? firstColors(g.colors);

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
  palette?: number[]; // color k is PALETTE[palette[k - 1]]; empty without colors (missing in older saves)
  cells: number[]; // EMPTY, CROSS or a color 1..colors
  history: number[][];
  done: boolean;
}

export type Action =
  | { type: 'paint'; indices: number[]; value: number }
  | { type: 'undo' };

export function gameOf(difficulty: Difficulty, rules: Rules, { size, colors, rows, cols }: Puzzle, palette = firstColors(colors)): Game {
  return {
    difficulty, rules: { ...rules }, size, colors, rows, cols, palette: [...palette],
    cells: new Array<number>(size * size).fill(EMPTY), history: [], done: false,
  };
}

export function newGame(difficulty: Difficulty, rules: Rules = NO_RULES, random: () => number = Math.random): Game {
  const p = generate(difficulty, rules, random);
  return gameOf(difficulty, rules, p, pickPalette(p.colors, random));
}

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

const isPalette = (palette: unknown, colors: number) =>
  palette === undefined ||
  (Array.isArray(palette) && palette.length === (colors > 1 ? colors : 0) && new Set(palette).size === palette.length &&
    palette.every((i) => Number.isInteger(i) && i >= 0 && i < PALETTE.length));

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isDifficulty(g?.difficulty) || !isRules(g.rules)) return false;
  const { size, colors } = DIFFICULTIES[g.difficulty];
  const k = g.rules.colors ? colors : 1;
  const isCell = (v: unknown) => v === EMPTY || v === CROSS || (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= k);
  return (
    g.size === size && g.colors === k && isPalette(g.palette, k) &&
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
