// Color Sort game state and moves, as a pure reducer.
import { CAPACITY, DIFFICULTIES, generate, isDifficulty, isSorted, pour, pourAmount, usefulPours, type Difficulty, type Tubes } from './logic';

export const STORAGE_KEY = 'games.sort.v1';
const HISTORY_LIMIT = 500;

export interface Game {
  difficulty: Difficulty;
  tubes: Tubes;
  selected: number | null; // the tube picked up to pour from
  history: Tubes[];
  done: boolean;
}

export type Action =
  | { type: 'tap'; tube: number } // pick up, put down, or pour into
  | { type: 'undo' };

export function newGame(difficulty: Difficulty): Game {
  return { difficulty, tubes: generate(difficulty), selected: null, history: [], done: false };
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isDifficulty(g?.difficulty) || !Array.isArray(g.tubes) || !Array.isArray(g.history)) return false;
  const { colors, spare } = DIFFICULTIES[g.difficulty];
  return g.tubes.length === colors + spare && g.tubes.every((t) => Array.isArray(t) && t.length <= CAPACITY);
}

/** No pour left that gets anywhere. */
export const stuck = (g: Game) => !g.done && usefulPours(g.tubes).length === 0;

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'tap': {
      if (g.done) return g;
      const t = action.tube;
      if (g.selected === null) return g.tubes[t].length ? { ...g, selected: t } : g;
      if (g.selected === t) return { ...g, selected: null };
      if (pourAmount(g.tubes, g.selected, t) === 0) {
        // Can't pour there: pick that tube up instead (if it has anything in it).
        return g.tubes[t].length ? { ...g, selected: t } : g;
      }
      const tubes = pour(g.tubes, g.selected, t);
      return { ...g, tubes, selected: null, history: [...g.history, g.tubes].slice(-HISTORY_LIMIT), done: isSorted(tubes) };
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, tubes: last, selected: null, history: g.history.slice(0, -1) };
    }
  }
}
