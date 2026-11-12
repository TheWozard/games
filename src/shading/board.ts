// The state and moves every shading game shares, as a pure reducer. Each cell is empty, holds the
// game's mark (a star, shade or lamp: MAIN) or the player's note (an X, a dot, a circle: NOTE).
// Some cells are fixed (Nurikabe's numbers, Light Up's walls) and take nothing. A stroke (a tap,
// or a drag along a row or column) sets its cells to one value, as one undo step. The game is done
// when the marks are exactly the puzzle's answer: every puzzle has only one.

export const EMPTY = 0;
export const MAIN = 1;
export const NOTE = 2;

const HISTORY_LIMIT = 300;

/** What the screen needs from a puzzle: its size, its answer (the MAIN cells), and its fixed cells. */
export interface Shape {
  size: number;
  solution: boolean[];
}

export interface Game<P extends Shape> {
  difficulty: string;
  puzzle: P;
  marks: number[];
  history: number[][];
  done: boolean;
}

export type Action =
  | { type: 'paint'; indices: number[]; value: number }
  | { type: 'undo' };

export function gameOf<P extends Shape>(difficulty: string, puzzle: P): Game<P> {
  return { difficulty, puzzle, marks: new Array<number>(puzzle.size * puzzle.size).fill(EMPTY), history: [], done: false };
}

export const isDone = (marks: number[], solution: boolean[]) => marks.every((m, i) => (m === MAIN) === solution[i]);

export function reducer<P extends Shape>(g: Game<P>, action: Action, fixed: (i: number) => boolean): Game<P> {
  switch (action.type) {
    case 'paint': {
      const { indices, value } = action;
      if (g.done || !(value === EMPTY || value === MAIN || value === NOTE)) return g;
      const targets = indices.filter((i) => i in g.marks && !fixed(i) && g.marks[i] !== value);
      if (!targets.length) return g;
      const marks = g.marks.slice();
      for (const i of targets) marks[i] = value;
      return { ...g, marks, history: [...g.history, g.marks].slice(-HISTORY_LIMIT), done: isDone(marks, g.puzzle.solution) };
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, marks: last, history: g.history.slice(0, -1) };
    }
  }
}

/** Validates a save: the game's difficulty and puzzle (by the game's own checks), and marks to fit. */
export function isGame<P extends Shape>(
  value: unknown,
  isDifficulty: (d: unknown) => boolean,
  isPuzzle: (p: unknown, difficulty: string) => boolean,
): value is Game<P> {
  const g = value as Partial<Game<P>> | null;
  if (typeof g !== 'object' || g === null || !isDifficulty(g.difficulty) || !isPuzzle(g.puzzle, g.difficulty as string)) return false;
  const cells = g.puzzle!.size * g.puzzle!.size;
  const isMark = (m: unknown) => m === EMPTY || m === MAIN || m === NOTE;
  return (
    Array.isArray(g.marks) && g.marks.length === cells && g.marks.every(isMark) &&
    Array.isArray(g.history) && g.history.every((h) => Array.isArray(h) && h.length === cells) &&
    typeof g.done === 'boolean'
  );
}
