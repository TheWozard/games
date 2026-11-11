// Flow game state and moves, as a pure reducer. A drag updates the paths live ('draw') and is
// recorded as one move when it ends ('commit').
import { connected, DIFFICULTIES, generate, isDifficulty, isSolved, type Difficulty, type Path } from './logic';

export const STORAGE_KEY = 'games.flow.v1';
const HISTORY_LIMIT = 300;

export interface Game {
  difficulty: Difficulty;
  size: number;
  dots: [number, number][];
  paths: Path[]; // per color, from one of its dots
  history: Path[][];
  done: boolean;
}

export type Action =
  | { type: 'draw'; paths: Path[] } // live, during a drag
  | { type: 'commit'; before: Path[] } // end of a drag: one undo step
  | { type: 'undo' };

export function newGame(difficulty: Difficulty): Game {
  const { size } = DIFFICULTIES[difficulty];
  const { dots } = generate(difficulty);
  return { difficulty, size, dots, paths: dots.map(() => []), history: [], done: false };
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isDifficulty(g?.difficulty)) return false;
  return (
    g.size === DIFFICULTIES[g.difficulty].size &&
    Array.isArray(g.dots) && Array.isArray(g.paths) && g.paths.length === g.dots.length &&
    Array.isArray(g.history)
  );
}

/** Every pair joined, but squares still empty. */
export const allJoined = (g: Game) => !g.done && g.dots.every((_, k) => connected(g.dots, g.paths, k));

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'draw':
      return g.done ? g : { ...g, paths: action.paths };
    case 'commit': {
      if (g.done || JSON.stringify(action.before) === JSON.stringify(g.paths)) return g;
      return { ...g, history: [...g.history, action.before].slice(-HISTORY_LIMIT), done: isSolved(g.dots, g.paths, g.size) };
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, paths: last, history: g.history.slice(0, -1) };
    }
  }
}
