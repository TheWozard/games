// Mahjong solitaire game state and moves, as a pure reducer (apart from Shuffle, which uses
// Math.random unless a source is passed in).
import { isSeed, newSeed, seeded } from '../shared/seed';
import { isLayoutId, layoutOf, type LayoutId } from './layouts';
import { deal, freePairs, isDifficulty, isFree, isWide, matches, neighbors, reshuffle, turn, type Difficulty, type Neighbors, type Slot } from './logic';

export const STORAGE_KEY = 'games.mahjong.v1';

type Move = { pair: [number, number] } | { shuffled: number[] }; // what to restore on undo

export interface Game {
  /** An own layout's key or an archive layout's id (layouts.ts). */
  layout: LayoutId;
  /** The layouts picked in the New dialog: each deal takes one at random (missing in older saves: just `layout`). */
  pool?: LayoutId[];
  /**
   * Dealt a quarter turn round (logic.ts, `turn`) to suit an upright screen; it stays that way to
   * the end, since turning changes which tiles are free (missing in older saves: not turned).
   */
  turned?: boolean;
  difficulty: Difficulty;
  /** What the deal was made from: the same layout, turn, difficulty and seed deal the same tiles (missing in older saves). */
  seed?: number;
  kinds: number[]; // face per slot of slotsOf(game)
  gone: boolean[];
  selected: number | null;
  history: Move[];
  done: boolean;
}

export type Action =
  | { type: 'tap'; slot: number }
  | { type: 'shuffle' }
  | { type: 'undo' };

const TURNED = new Map<LayoutId, Slot[]>();
/** A layout's slots, turned or not. */
export function slotsFor(layout: LayoutId, turned = false): readonly Slot[] {
  const { slots } = layoutOf(layout);
  if (!turned) return slots;
  return TURNED.get(layout) ?? TURNED.set(layout, turn(slots)).get(layout)!;
}
export const slotsOf = (g: Game) => slotsFor(g.layout, g.turned);

const NEAR = new Map<string, Neighbors>();
const near = (g: Game) => {
  const key = `${g.layout}${g.turned ? ' turned' : ''}`;
  return NEAR.get(key) ?? NEAR.set(key, neighbors(slotsOf(g))).get(key)!;
};

/**
 * A new game. On an `upright` board area (taller than wide), a layout drawn wider than tall is
 * dealt a quarter turn round, so it fills the screen instead of panning.
 */
export function newGame(layout: LayoutId, difficulty: Difficulty = 'medium', pool: readonly LayoutId[] = [layout], upright = false, seed = newSeed()): Game {
  const turned = upright && isWide(layoutOf(layout).slots);
  const { kinds } = deal(slotsFor(layout, turned), difficulty, seeded(seed));
  return { layout, pool: [...pool], ...(turned && { turned }), difficulty, seed, kinds, gone: kinds.map(() => false), selected: null, history: [], done: false };
}

/** The layouts a game's deals are drawn from. */
export const poolOf = (g: Game): LayoutId[] => g.pool ?? [g.layout];

/** One of the pool's layouts at random: not the one just played, when there's another to pick. */
export function pickLayout(pool: readonly LayoutId[], last?: LayoutId, random: () => number = Math.random): LayoutId {
  const others = pool.length > 1 ? pool.filter((l) => l !== last) : pool;
  return others[Math.floor(random() * others.length)];
}

/** A new game from a pool of layouts (at least one), at a difficulty; `upright` as for newGame. */
export const dealFrom = (pool: readonly LayoutId[], difficulty: Difficulty, last?: LayoutId, upright = false): Game =>
  newGame(pickLayout(pool, last), difficulty, pool, upright);

const isPool = (pool: unknown) =>
  pool === undefined || (Array.isArray(pool) && pool.length > 0 && pool.every(isLayoutId) && new Set(pool).size === pool.length);

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (!isLayoutId(g?.layout) || !isDifficulty(g.difficulty)) return false;
  const n = layoutOf(g.layout).slots.length;
  return g.kinds?.length === n && g.gone?.length === n && Array.isArray(g.history) && isPool(g.pool) && (g.turned === undefined || typeof g.turned === 'boolean') && (g.seed === undefined || isSeed(g.seed));
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

export const free = (g: Game, i: number) => !g.gone[i] && isFree(i, near(g), g.gone);
export const pairsLeft = (g: Game) => freePairs(g.kinds, near(g), g.gone);

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
