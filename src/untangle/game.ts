// Untangle game state and moves, as a pure reducer. A drag moves a dot live ('drag'), and letting
// go ('drop') records the move for undo and checks whether the tangle is gone.
import { clamp, crossings, generate, isDifficulty, type Difficulty, type Edge, type Point } from './logic';

export const STORAGE_KEY = 'games.untangle.v1';
const HISTORY_LIMIT = 300;

export interface Game {
  difficulty: Difficulty;
  points: Point[];
  edges: Edge[];
  history: Point[][]; // layouts before each move, for undo
  moves: number;
  done: boolean;
}

export type Action =
  | { type: 'drag'; index: number; to: Point }
  | { type: 'drop'; before: Point[] }
  | { type: 'undo' };

export function newGame(difficulty: Difficulty): Game {
  const { points, edges } = generate(difficulty);
  return { difficulty, points, edges, history: [], moves: 0, done: false };
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  return (
    isDifficulty(g?.difficulty) &&
    Array.isArray(g.points) && g.points.every((p) => Array.isArray(p) && p.length === 2) &&
    Array.isArray(g.edges) && g.edges.every(([a, b]) => a < g.points!.length && b < g.points!.length) &&
    Array.isArray(g.history) && typeof g.moves === 'number'
  );
}

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'drag': {
      if (g.done) return g;
      const points = g.points.slice();
      points[action.index] = clamp(action.to);
      return { ...g, points };
    }
    case 'drop': {
      if (g.done) return g;
      const moved = action.before.some((p, i) => p[0] !== g.points[i][0] || p[1] !== g.points[i][1]);
      if (!moved) return g;
      return {
        ...g,
        history: [...g.history, action.before].slice(-HISTORY_LIMIT),
        moves: g.moves + 1,
        done: crossings(g.points, g.edges).count === 0,
      };
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, points: last, history: g.history.slice(0, -1), moves: g.moves + 1 };
    }
  }
}
