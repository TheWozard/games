// Bridges game state and moves, as a pure reducer.
import { DIFFICULTIES, edgesOf, generate, isDifficulty, isSolved, type Difficulty, type Edge, type Island } from './logic';

export const STORAGE_KEY = 'games.bridges.v1';
const HISTORY_LIMIT = 500;

export interface Game {
  difficulty: Difficulty;
  cols: number;
  rows: number;
  islands: Island[];
  bridges: number[]; // per edge of edgesOf(islands): 0, 1 or 2
  solution: number[];
  selected: number | null; // island picked as the start of a bridge
  brush: Brush; // how many bridges a tap sets
  history: number[][]; // earlier `bridges`, for undo
  done: boolean;
}

export type Brush = 0 | 1 | 2;

export type Action =
  | { type: 'tapIsland'; island: number } // select it, or set the bridges to the selected island
  | { type: 'tapEdge'; edge: number } // set this pair's bridges to the brush
  | { type: 'brush'; brush: Brush }
  | { type: 'undo' }
  | { type: 'clear' };

export function newGame(difficulty: Difficulty): Game {
  const { cols, rows } = DIFFICULTIES[difficulty];
  const { islands, solution } = generate(difficulty);
  return {
    difficulty,
    cols,
    rows,
    islands,
    bridges: solution.map(() => 0),
    solution,
    selected: null,
    brush: 1,
    history: [],
    done: false,
  };
}

/** Possible bridges for a game's islands (cached: islands never change during a game). */
const cache = new WeakMap<Island[], { edges: Edge[]; crosses: number[][] }>();
export function edgesFor(g: Pick<Game, 'islands' | 'cols' | 'rows'>) {
  let found = cache.get(g.islands);
  if (!found) {
    found = edgesOf(g.islands, g.cols, g.rows);
    cache.set(g.islands, found);
  }
  return found;
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isDifficulty(g?.difficulty) || !Array.isArray(g.islands) || !Array.isArray(g.history)) return false;
  const { cols, rows } = DIFFICULTIES[g.difficulty];
  if (g.cols !== cols || g.rows !== rows) return false;
  const edges = edgesOf(g.islands, cols, rows).edges.length;
  return g.bridges?.length === edges && g.solution?.length === edges && [0, 1, 2].includes(g.brush as number);
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

/** Whether tapping `edge` with the current brush would change anything. */
export const settable = (g: Game, edge: number) =>
  g.bridges[edge] !== g.brush && !(g.brush > 0 && g.bridges[edge] === 0 && blocked(g, edge));

function set(g: Game, edge: number): Game {
  if (g.done) return g;
  if (!settable(g, edge)) return g.selected === null ? g : { ...g, selected: null };
  const bridges = g.bridges.slice();
  bridges[edge] = g.brush;
  const { edges, crosses } = edgesFor(g);
  return {
    ...g,
    bridges,
    selected: null,
    history: [...g.history, g.bridges].slice(-HISTORY_LIMIT),
    done: isSolved(g.islands, edges, crosses, bridges),
  };
}

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'tapIsland': {
      if (g.done) return g;
      const i = action.island;
      if (g.selected === null) return { ...g, selected: i };
      if (g.selected === i) return { ...g, selected: null };
      const from = g.selected;
      const edge = edgesFor(g).edges.findIndex((e) => (e.a === from && e.b === i) || (e.a === i && e.b === from));
      // Not in line of sight: start again from the island just tapped.
      return edge === -1 ? { ...g, selected: i } : set(g, edge);
    }
    case 'tapEdge':
      return set(g, action.edge);
    case 'brush':
      return action.brush === g.brush ? g : { ...g, brush: action.brush };
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, bridges: last, selected: null, history: g.history.slice(0, -1) };
    }
    case 'clear':
      if (g.done || g.bridges.every((v) => v === 0)) return g;
      return { ...g, bridges: g.bridges.map(() => 0), selected: null, history: [...g.history, g.bridges].slice(-HISTORY_LIMIT) };
  }
}
