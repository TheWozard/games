// Mahjong solitaire game state and moves, as a pure reducer (apart from Shuffle, which uses
// Math.random unless a source is passed in).
import { isSeed, newSeed, seeded } from '../shared/seed';
import { isLayoutId, layoutOf, type LayoutId } from './layouts';
import {
  deal,
  freePairs,
  isDifficulty,
  isFree,
  matches,
  neighbors,
  reshuffle,
  type Difficulty,
  type Neighbors,
} from './logic';

export const STORAGE_KEY = 'games.mahjong.v1';

type Move = { pair: [number, number] } | { shuffled: number[] }; // what to restore on undo

export interface Game {
  /** An own layout's key or an archive layout's id (layouts.ts). */
  layout: LayoutId;
  /** The layouts picked in the Customize dialog: each deal takes one at random. */
  pool: LayoutId[];
  difficulty: Difficulty;
  /** What the deal was made from: the same layout, difficulty and seed deal the same tiles. */
  seed: number;
  kinds: number[]; // face per slot of slotsOf(game)
  gone: boolean[];
  selected: number | null;
  history: Move[];
  done: boolean;
}

export type Action = { type: 'tap'; slot: number } | { type: 'shuffle' } | { type: 'undo' };

/** A game's slots: its layout's. */
export const slotsOf = (g: Game) => layoutOf(g.layout).slots;

const NEAR = new Map<LayoutId, Neighbors>();
const near = (g: Game) =>
  NEAR.get(g.layout) ?? NEAR.set(g.layout, neighbors(slotsOf(g))).get(g.layout)!;

/** A new game; the same layout, difficulty and seed always deal the same tiles. */
export function newGame(
  layout: LayoutId,
  difficulty: Difficulty = 'medium',
  pool: readonly LayoutId[] = [layout],
  seed = newSeed(),
): Game {
  const { kinds } = deal(layoutOf(layout).slots, difficulty, seeded(seed));
  return {
    layout,
    pool: [...pool],
    difficulty,
    seed,
    kinds,
    gone: kinds.map(() => false),
    selected: null,
    history: [],
    done: false,
  };
}

/** One of the pool's layouts at random: not the one just played, when there's another to pick. */
export function pickLayout(
  pool: readonly LayoutId[],
  last?: LayoutId,
  random: () => number = Math.random,
): LayoutId {
  const others = pool.length > 1 ? pool.filter((l) => l !== last) : pool;
  return others[Math.floor(random() * others.length)];
}

/**
 * What a new game is dealt from. Picked on the page (cheap), then dealt in a worker (background.ts):
 * the same deal always gives the same tiles, wherever it's dealt.
 */
export interface Deal {
  layout: LayoutId;
  difficulty: Difficulty;
  pool: LayoutId[];
  seed: number;
}

/** The next deal from a pool of layouts (at least one), at a difficulty: not `last` again if there's another. */
export const nextDeal = (
  pool: readonly LayoutId[],
  difficulty: Difficulty,
  last?: LayoutId,
): Deal => ({ layout: pickLayout(pool, last), difficulty, pool: [...pool], seed: newSeed() });

/** The same deal again, from its start. */
export const replayOf = (g: Game): Deal => ({
  layout: g.layout,
  difficulty: g.difficulty,
  pool: g.pool,
  seed: g.seed,
});

/** The game a deal makes: the slow part (logic.ts's `deal`), so it runs in the worker. */
export const dealt = ({ layout, difficulty, pool, seed }: Deal): Game =>
  newGame(layout, difficulty, pool, seed);

const isPool = (pool: unknown) =>
  Array.isArray(pool) &&
  pool.length > 0 &&
  pool.every(isLayoutId) &&
  new Set(pool).size === pool.length;

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isLayoutId(g?.layout) || !isDifficulty(g.difficulty)) return false;
  const n = layoutOf(g.layout).slots.length;
  return (
    g.kinds?.length === n &&
    g.gone?.length === n &&
    Array.isArray(g.history) &&
    isPool(g.pool) &&
    isSeed(g.seed)
  );
}

export const free = (g: Game, i: number) => !g.gone[i] && isFree(i, near(g), g.gone);
export const pairsLeft = (g: Game) => freePairs(g.kinds, near(g), g.gone);

export function reducer(g: Game, action: Action, random: () => number = Math.random): Game {
  switch (action.type) {
    case 'tap': {
      const i = action.slot;
      if (g.done || !free(g, i)) return g;
      if (g.selected === null || g.selected === i)
        return { ...g, selected: g.selected === i ? null : i };
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
        kinds: reshuffle(g.kinds, near(g), g.gone, random),
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
