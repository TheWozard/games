// Flow game state and moves, as a pure reducer. A drag updates the paths live ('draw') and is
// recorded as one move when it ends ('commit').
import {
  DIFFICULTIES, generate, isDifficulty, isRules, isSolved, NO_RULES, plainBoard,
  type Board, type Difficulty, type Path, type Rules,
} from './logic';

export const STORAGE_KEY = 'games.flow.v1';
const HISTORY_LIMIT = 300;

export interface Game {
  difficulty: Difficulty;
  rules: Rules;
  size: number;
  board: Board;
  dots: [number, number][];
  paths: Path[]; // per color, from one of its dots
  history: Path[][];
  done: boolean;
}

export type Action =
  | { type: 'draw'; paths: Path[] } // live, during a drag
  | { type: 'commit'; before: Path[] } // end of a drag: one undo step
  | { type: 'undo' };

export function newGame(difficulty: Difficulty, rules: Rules = NO_RULES): Game {
  const { size } = DIFFICULTIES[difficulty];
  const { dots, board } = generate(difficulty, rules);
  return { difficulty, rules: { ...rules }, size, board, dots, paths: dots.map(() => []), history: [], done: false };
}

const cells = (value: unknown, n: number) => Array.isArray(value) && value.every((x) => Number.isInteger(x) && x >= 0 && x < n);

/** Validates a save. Saves from before the rules carry on on a plain board. */
export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isDifficulty(g?.difficulty)) return false;
  const size = DIFFICULTIES[g.difficulty].size;
  g.rules ??= { ...NO_RULES };
  g.board ??= plainBoard(size);
  const b = g.board;
  const n = size * size;
  return (
    isRules(g.rules) && g.size === size &&
    b.size === size && typeof b.wrap === 'boolean' && cells(b.holes, n) && cells(b.bridges, n) &&
    Array.isArray(b.walls) && b.walls.every((w) => cells(w, n) && w.length === 2) &&
    Array.isArray(g.dots) && Array.isArray(g.paths) && g.paths.length === g.dots.length &&
    Array.isArray(g.history)
  );
}

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'draw':
      return g.done ? g : { ...g, paths: action.paths };
    case 'commit': {
      if (g.done || JSON.stringify(action.before) === JSON.stringify(g.paths)) return g;
      return { ...g, history: [...g.history, action.before].slice(-HISTORY_LIMIT), done: isSolved(g.dots, g.paths, g.board) };
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, paths: last, history: g.history.slice(0, -1) };
    }
  }
}
