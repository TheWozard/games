// Sliding Blocks game state and moves, as a pure reducer. Each variant's puzzles are one list of
// levels, numbered from 1: its Easy puzzles from puzzles.ts, then Medium, then Hard. They're
// played in order: each variant remembers which level is next, and wraps round to the first after
// the last. Any level can also be picked, and play carries on in order from there.
import {
  decode, isDifficulty, isLayout, isSolved, isVariant, LEVELS, range, shape, slide, VARIANTS,
  type Block, type Difficulty, type Variant,
} from './logic';
import { PUZZLES } from './puzzles';

export const STORAGE_KEY = 'games.blocks.v1';
const HISTORY_LIMIT = 500;

const VARIANT_KEYS = Object.keys(VARIANTS) as Variant[];
const LEVEL_KEYS = Object.keys(LEVELS) as Difficulty[];

export interface Level {
  difficulty: Difficulty;
  fewest: number; // the fewest moves that finish it
  code: string; // its blocks (encode in logic.ts)
}

/** Per variant, every level in order: Easy, then Medium, then Hard. */
export const LEVEL_LIST: Record<Variant, Level[]> = Object.fromEntries(VARIANT_KEYS.map((v) => [
  v,
  LEVEL_KEYS.flatMap((difficulty) => PUZZLES[v][difficulty].map(([fewest, code]) => ({ difficulty, fewest, code }))),
])) as Record<Variant, Level[]>;

/** Per variant and difficulty, the index of its first level. */
const FIRST_OF = Object.fromEntries(VARIANT_KEYS.map((v) => [
  v,
  Object.fromEntries(LEVEL_KEYS.map((d) => [d, LEVEL_LIST[v].findIndex((l) => l.difficulty === d)])),
])) as Record<Variant, Record<Difficulty, number>>;

/** Per variant, the level to play next (an index into LEVEL_LIST). */
export type Progress = Record<Variant, number>;

export interface Game {
  variant: Variant;
  level: number; // which of LEVEL_LIST (from 0)
  blocks: Block[];
  fewest: number; // the fewest moves that finish it
  history: Block[][]; // layouts before each move, for undo
  moves: number;
  done: boolean;
  upNext: Progress;
}

export type Action =
  | { type: 'slide'; index: number; to: number }
  | { type: 'undo' };

export const FIRST: Progress = Object.fromEntries(VARIANT_KEYS.map((v) => [v, 0])) as Progress;

export const difficultyOf = (g: Pick<Game, 'variant' | 'level'>): Difficulty => LEVEL_LIST[g.variant][g.level].difficulty;

/** A level of a variant: the next one, or the one numbered `pick`. That variant moves on to the level after it. */
export function newGame(variant: Variant, upNext: Progress = FIRST, pick = upNext[variant]): Game {
  const list = LEVEL_LIST[variant];
  const level = ((pick % list.length) + list.length) % list.length;
  const { fewest, code } = list[level];
  return {
    variant,
    level,
    blocks: decode(code),
    fewest,
    history: [],
    moves: 0,
    done: false,
    upNext: { ...upNext, [variant]: (level + 1) % list.length },
  };
}

const isProgress = (value: unknown): value is Progress =>
  typeof value === 'object' && value !== null &&
  VARIANT_KEYS.every((v) => Number.isInteger((value as Record<string, unknown>)[v]));

/** What's next per difficulty, as saves had it before each variant was one list. */
type OldProgress = Record<Difficulty, number>;
const isOldProgress = (value: unknown): value is OldProgress =>
  typeof value === 'object' && value !== null && LEVEL_KEYS.every((d) => Number.isInteger((value as Record<string, unknown>)[d]));

/**
 * The level after the furthest one played in any difficulty. Lists were longer then, so a count
 * past a difficulty's end now means the start of the next.
 */
function fromOld(variant: Variant, old: OldProgress): number {
  let next = 0;
  for (const d of LEVEL_KEYS) {
    const count = PUZZLES[variant][d].length;
    if (old[d] > 0) next = Math.max(next, FIRST_OF[variant][d] + Math.min(old[d], count));
  }
  return next % LEVEL_LIST[variant].length;
}

/**
 * Validates a save, carrying older ones on:
 * - from before the variants: a Classic game, with one count of what's next per difficulty;
 * - from before each variant was one list (a difficulty and a number in it, and what's next per
 *   difficulty): the same puzzle, as the level it is now, and the level after the furthest played.
 */
export function isGame(value: unknown): value is Game {
  const g = value as (Partial<Game> & { difficulty?: unknown; number?: unknown; upNext?: unknown }) | null;
  if (typeof g !== 'object' || g === null) return false;
  if (g.variant === undefined && isOldProgress(g.upNext)) {
    g.variant = 'classic';
    const classic = g.upNext;
    (g as { upNext: unknown }).upNext = Object.fromEntries(VARIANT_KEYS.map((v) => [v, v === 'classic' ? classic : { easy: 0, medium: 0, hard: 0 }]));
  }
  if (g.level === undefined && isVariant(g.variant) && isDifficulty(g.difficulty) && Number.isInteger(g.number)) {
    const up = g.upNext as Record<string, unknown> | undefined;
    if (!up || !VARIANT_KEYS.every((v) => isOldProgress(up[v]))) return false;
    g.upNext = Object.fromEntries(VARIANT_KEYS.map((v) => [v, fromOld(v, up[v] as OldProgress)])) as Progress;
    g.level = FIRST_OF[g.variant][g.difficulty] + ((g.number as number) % PUZZLES[g.variant][g.difficulty].length);
    delete g.difficulty;
    delete g.number;
  }
  return (
    isVariant(g.variant) &&
    Number.isInteger(g.level) && g.level! >= 0 && g.level! < LEVEL_LIST[g.variant].length &&
    typeof g.fewest === 'number' && typeof g.moves === 'number' &&
    Array.isArray(g.blocks) && isLayout(g.blocks, shape(g.variant)) &&
    Array.isArray(g.history) && g.history.every((b) => Array.isArray(b) && b.length === g.blocks!.length) &&
    isProgress(g.upNext)
  );
}

export function reducer(g: Game, action: Action): Game {
  const s = shape(g.variant);
  switch (action.type) {
    case 'slide': {
      const { index, to } = action;
      if (g.done || !g.blocks[index]) return g;
      const b = g.blocks[index];
      const [lo, hi] = range(g.blocks, index, s);
      if (to === (b.across ? b.c : b.r) || to < lo || to > hi) return g;
      const blocks = slide(g.blocks, index, to);
      return {
        ...g,
        blocks,
        history: [...g.history, g.blocks].slice(-HISTORY_LIMIT),
        moves: g.moves + 1,
        done: isSolved(blocks, s),
      };
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, blocks: last, history: g.history.slice(0, -1), moves: g.moves - 1 };
    }
  }
}
