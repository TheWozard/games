// Loop game state and moves, as a pure reducer. Each edge is empty, a line, or a cross (the
// player's note that the loop doesn't go there). Left-click adds a line (or clears a cross);
// right-click removes a line, or crosses out a side that's already empty.
import { DIFFICULTIES, edgeCount, generate, isDifficulty, isSolved, type Difficulty, type Grid } from './logic';

export const STORAGE_KEY = 'games.loop.v1';
const HISTORY_LIMIT = 300;

export const EMPTY = 0;
export const LINE = 1;
export const CROSS = 2;
export type Mark = typeof EMPTY | typeof LINE | typeof CROSS;

/** Adding: an empty side becomes a line; a cross is cleared back to empty. */
export const added = (m: Mark): Mark => (m === CROSS ? EMPTY : LINE);
/** Removing: a line goes; an empty side is crossed out; a cross stays. */
export const removed = (m: Mark): Mark => (m === LINE ? EMPTY : CROSS);

export interface Game extends Grid {
  difficulty: Difficulty;
  clues: (number | null)[];
  marks: Mark[]; // per edge
  history: Mark[][];
  done: boolean;
}

export type Action =
  | { type: 'add'; edge: number; live?: boolean } // left-click, or a touch drag along the side
  | { type: 'remove'; edge: number; live?: boolean } // right-click, or a touch drag across it
  | { type: 'commit'; before: Mark[] } // end of a touch drag: everything it did is one undo step
  | { type: 'undo' };

export function newGame(difficulty: Difficulty): Game {
  const { rows, cols } = DIFFICULTIES[difficulty];
  const { clues } = generate(difficulty);
  return { difficulty, rows, cols, clues, marks: new Array<Mark>(edgeCount({ rows, cols })).fill(EMPTY), history: [], done: false };
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isDifficulty(g?.difficulty)) return false;
  const { rows, cols } = DIFFICULTIES[g.difficulty];
  return (
    g.rows === rows && g.cols === cols &&
    g.clues?.length === rows * cols && g.marks?.length === edgeCount({ rows, cols }) &&
    g.marks.every((m) => m === EMPTY || m === LINE || m === CROSS) &&
    Array.isArray(g.history)
  );
}

const solved = (g: Game, marks: Mark[]) => isSolved(g, g.clues, marks.map((m) => m === LINE));

/** Sets one edge. Live changes (mid-drag) aren't recorded until the drag's 'commit'. */
function mark(g: Game, edge: number, to: Mark, live = false): Game {
  if (g.done || g.marks[edge] === to) return g;
  const marks = g.marks.slice();
  marks[edge] = to;
  if (live) return { ...g, marks };
  return { ...g, marks, history: [...g.history, g.marks].slice(-HISTORY_LIMIT), done: solved(g, marks) };
}

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'add':
      return mark(g, action.edge, added(g.marks[action.edge]), action.live);
    case 'remove':
      return mark(g, action.edge, removed(g.marks[action.edge]), action.live);
    case 'commit':
      if (g.done || action.before.every((m, e) => m === g.marks[e])) return g;
      return { ...g, history: [...g.history, action.before].slice(-HISTORY_LIMIT), done: solved(g, g.marks) };
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, marks: last, history: g.history.slice(0, -1) };
    }
  }
}
