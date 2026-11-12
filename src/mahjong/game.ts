// Mahjong solitaire game state and moves, as a pure reducer (apart from Shuffle, which uses
// Math.random unless a source is passed in).
import { deal, freePairs, isDifficulty, isFree, isLayout, LAYOUTS, matches, neighbors, reshuffle, type Difficulty, type LayoutName, type Neighbors } from './logic';

export const STORAGE_KEY = 'games.mahjong.v1';

type Move = { pair: [number, number] } | { shuffled: number[] }; // what to restore on undo

export interface Game {
  layout: LayoutName;
  difficulty: Difficulty;
  kinds: number[]; // face per slot of LAYOUTS[layout]
  gone: boolean[];
  selected: number | null;
  history: Move[];
  done: boolean;
}

export type Action =
  | { type: 'tap'; slot: number }
  | { type: 'shuffle' }
  | { type: 'undo' };

const NEAR = new Map<LayoutName, Neighbors>();
export const near = (d: LayoutName) => NEAR.get(d) ?? NEAR.set(d, neighbors(LAYOUTS[d].slots)).get(d)!;

export function newGame(layout: LayoutName, difficulty: Difficulty = 'medium'): Game {
  const { kinds } = deal(layout, difficulty);
  return { layout, difficulty, kinds, gone: kinds.map(() => false), selected: null, history: [], done: false };
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isLayout(g?.layout) || !isDifficulty(g.difficulty)) return false;
  const n = LAYOUTS[g.layout].slots.length;
  return g.kinds?.length === n && g.gone?.length === n && Array.isArray(g.history);
}

/**
 * A saved game in the current shape, or one saved before deals had a difficulty (it plays on as
 * Medium, the old deals' middle ground); else null.
 */
export function fromSaved(value: unknown): Game | null {
  if (isGame(value)) return value;
  const old = value as Partial<Game> | null;
  if (typeof old !== 'object' || old === null || 'difficulty' in old) return null;
  const upgraded = { ...old, difficulty: 'medium' };
  return isGame(upgraded) ? upgraded : null;
}

export const free = (g: Game, i: number) => !g.gone[i] && isFree(i, near(g.layout), g.gone);
export const pairsLeft = (g: Game) => freePairs(g.kinds, near(g.layout), g.gone);

export function reducer(g: Game, action: Action, random: () => number = Math.random): Game {
  switch (action.type) {
    case 'tap': {
      const i = action.slot;
      if (g.done || !free(g, i)) return g;
      if (g.selected === null || g.selected === i) return { ...g, selected: g.selected === i ? null : i };
      if (!matches(g.kinds[g.selected], g.kinds[i])) return { ...g, selected: i };
      const gone = g.gone.slice();
      gone[g.selected] = gone[i] = true;
      return {
        ...g,
        gone,
        selected: null,
        history: [...g.history, { pair: [g.selected, i] }],
        done: gone.every(Boolean),
      };
    }
    case 'shuffle': {
      // Only offered when stuck: no free matching pairs left.
      if (g.done || pairsLeft(g).length > 0) return g;
      return {
        ...g,
        kinds: reshuffle(g.kinds, near(g.layout), g.gone, random),
        selected: null,
        history: [...g.history, { shuffled: g.kinds }],
      };
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      const history = g.history.slice(0, -1);
      if ('shuffled' in last) return { ...g, kinds: last.shuffled, selected: null, history };
      const gone = g.gone.slice();
      gone[last.pair[0]] = gone[last.pair[1]] = false;
      return { ...g, gone, selected: null, history };
    }
  }
}
