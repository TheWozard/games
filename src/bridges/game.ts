// Bridges game state and moves, as a pure reducer.
import { DIFFICULTIES, edgesOf, generate, isDifficulty, isRules, isSolved, NO_RULES, type Difficulty, type Edge, type Island, type Rules } from './logic';

export const STORAGE_KEY = 'games.bridges.v1';
const HISTORY_LIMIT = 500;

export interface Game {
  difficulty: Difficulty;
  cols: number;
  rows: number;
  rules: Rules;
  islands: Island[];
  blocks: number[]; // cells
  bridges: number[]; // per edge of edgesFor(game): 0, 1 or 2
  solution: number[];
  history: number[][]; // earlier `bridges`, for undo
  done: boolean;
}

export type Action =
  | { type: 'build'; edge: number } // one more bridge (a drag from island to island), at most 2
  | { type: 'remove'; edge: number } // one fewer (a swipe across the bridge)
  | { type: 'cycle'; edge: number } // a tap on the gap: 0 → 1 → 2 → 0
  | { type: 'undo' };

export function newGame(difficulty: Difficulty, rules: Rules = NO_RULES): Game {
  const { cols, rows } = DIFFICULTIES[difficulty];
  const { islands, blocks, solution } = generate(difficulty, rules);
  return { difficulty, rules: { ...rules }, cols, rows, islands, blocks, bridges: solution.map(() => 0), solution, history: [], done: false };
}

/** Possible bridges for a game's islands (cached: islands never change during a game). */
const cache = new WeakMap<Island[], { edges: Edge[]; crosses: number[][] }>();
export function edgesFor(g: Pick<Game, 'islands' | 'cols' | 'rows' | 'blocks' | 'rules'>) {
  let found = cache.get(g.islands);
  if (!found) {
    found = edgesOf(g.islands, g.cols, g.rows, { blocks: g.blocks, diagonals: g.rules.diagonals });
    cache.set(g.islands, found);
  }
  return found;
}

/** Validates a save. Saves from before the optional rules play with none. */
export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isDifficulty(g?.difficulty) || !Array.isArray(g.islands) || !Array.isArray(g.history)) return false;
  const { cols, rows } = DIFFICULTIES[g.difficulty];
  if (g.cols !== cols || g.rows !== rows) return false;
  g.rules ??= { ...NO_RULES };
  g.blocks ??= [];
  if (!isRules(g.rules) || !g.blocks.every((x) => Number.isInteger(x) && x >= 0 && x < cols * rows)) return false;
  const edges = edgesOf(g.islands, cols, rows, { blocks: g.blocks, diagonals: g.rules.diagonals }).edges.length;
  return g.bridges?.length === edges && g.solution?.length === edges;
}

/** Bridges at each island so far. */
export const counts = (g: Game): number[] => {
  const { edges } = edgesFor(g);
  const out = g.islands.map(() => 0);
  edges.forEach((e, k) => {
    out[e.a] += g.bridges[k];
    out[e.b] += g.bridges[k];
  });
  return out;
};

/** Whether bridges on `edge` would cross one already built. */
export const blocked = (g: Game, edge: number) => edgesFor(g).crosses[edge].some((x) => g.bridges[x] > 0);

/** Whether a drag along `edge` would add a bridge: fewer than two, and not crossing another. */
export const buildable = (g: Game, edge: number) =>
  g.bridges[edge] < 2 && !(g.bridges[edge] === 0 && blocked(g, edge));

/** Sets one pair's bridge count, recording it for undo and checking for a win. */
function put(g: Game, edge: number, count: number): Game {
  if (g.done || count === g.bridges[edge]) return g;
  const bridges = g.bridges.slice();
  bridges[edge] = count;
  const { edges, crosses } = edgesFor(g);
  return {
    ...g,
    bridges,
    history: [...g.history, g.bridges].slice(-HISTORY_LIMIT),
    done: isSolved(g.islands, edges, crosses, bridges),
  };
}

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'build':
      return buildable(g, action.edge) ? put(g, action.edge, g.bridges[action.edge] + 1) : g;
    case 'remove':
      return g.bridges[action.edge] > 0 ? put(g, action.edge, g.bridges[action.edge] - 1) : g;
    case 'cycle':
      return buildable(g, action.edge) ? put(g, action.edge, g.bridges[action.edge] + 1) : put(g, action.edge, 0);
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, bridges: last, history: g.history.slice(0, -1) };
    }
  }
}
