// Untangle game state and moves, as a pure reducer. A drag moves a dot live ('drag'), and letting
// go ('drop') nudges it clear of any dot it landed on, records the move for undo, and checks
// whether the tangle is gone.
import {
  clamp, crossings, generate, isSize, isStart, isStyle, nudge, SIZES, STARTS, STYLES,
  type Edge, type Point, type Settings,
} from './logic';

export const STORAGE_KEY = 'games.untangle.v1';
const HISTORY_LIMIT = 300;

export interface Game extends Settings {
  points: Point[];
  edges: Edge[];
  history: Point[][]; // layouts before each move, for undo
  moves: number;
  done: boolean;
}

export type Action =
  | { type: 'drag'; index: number; to: Point }
  | { type: 'drop'; index: number; before: Point[] }
  | { type: 'undo' };

export const DEFAULT: Settings = { size: 'd10', style: 'lines', start: 'circle' };

export const describe = ({ size, style, start }: Settings) =>
  `${SIZES[size].dots} dots · ${STYLES[style].label} · ${STARTS[start].label}`;

export function newGame(settings: Settings): Game {
  const { points, edges } = generate(settings);
  return { ...settings, points, edges, history: [], moves: 0, done: false };
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  return (
    isSize(g?.size) && isStyle(g.style) && isStart(g.start) &&
    Array.isArray(g.points) && g.points.length === SIZES[g.size].dots &&
    g.points.every((p) => Array.isArray(p) && p.length === 2) &&
    Array.isArray(g.edges) && g.edges.every(([a, b]) => a < g.points!.length && b < g.points!.length) &&
    Array.isArray(g.history) && typeof g.moves === 'number'
  );
}

/** What earlier versions (three fixed levels, all Lines from a circle) saved, mapped to settings. */
const OLD_LEVELS: Record<string, Settings> = {
  easy: { size: 'd10', style: 'lines', start: 'circle' },
  medium: { size: 'd15', style: 'lines', start: 'circle' },
  hard: { size: 'd21', style: 'lines', start: 'circle' },
};

/** A saved game in the current shape, upgrading one saved by an earlier version; else null. */
export function fromSaved(value: unknown): Game | null {
  if (isGame(value)) return value;
  const old = value as { difficulty?: unknown } | null;
  if (typeof old?.difficulty !== 'string' || !Object.hasOwn(OLD_LEVELS, old.difficulty)) return null;
  const { difficulty, ...rest } = old as { difficulty: string };
  const upgraded = { ...rest, ...OLD_LEVELS[difficulty] };
  // Re-check under today's rules (a dot on a line now counts), so an old "done" stays honest.
  if (!isGame(upgraded)) return null;
  return { ...upgraded, done: crossings(upgraded.points, upgraded.edges).count === 0 };
}

export function reducer(g: Game, action: Action, random: () => number = Math.random): Game {
  switch (action.type) {
    case 'drag': {
      if (g.done) return g;
      const points = g.points.slice();
      points[action.index] = clamp(action.to);
      return { ...g, points };
    }
    case 'drop': {
      if (g.done) return g;
      const nudged = nudge(g.points, action.index, random);
      const points = nudged === g.points ? g.points : nudged.slice();
      const moved = action.before.some((p, i) => p[0] !== points[i][0] || p[1] !== points[i][1]);
      if (!moved) return points === g.points ? g : { ...g, points };
      return {
        ...g,
        points,
        history: [...g.history, action.before].slice(-HISTORY_LIMIT),
        moves: g.moves + 1,
        done: crossings(points, g.edges).count === 0,
      };
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, points: last, history: g.history.slice(0, -1), moves: g.moves + 1 };
    }
  }
}
