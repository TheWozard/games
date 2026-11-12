// Sliding Blocks game state and moves, as a pure reducer. Puzzles come from the pre-made list in
// puzzles.ts, per variant and difficulty, played in order: each remembers which one is next and
// wraps round to the first after the last. Any puzzle can also be picked by number, and play
// carries on in order from there.
import {
  decode, isDifficulty, isLayout, isSolved, isVariant, LEVELS, range, shape, slide, VARIANTS,
  type Block, type Difficulty, type Variant,
} from './logic';
import { PUZZLES } from './puzzles';

export const STORAGE_KEY = 'games.blocks.v1';
const HISTORY_LIMIT = 500;

/** Per variant and difficulty, the puzzle to play next. */
export type Progress = Record<Variant, Record<Difficulty, number>>;

export interface Game {
  variant: Variant;
  difficulty: Difficulty;
  number: number; // which puzzle of the list (from 0)
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

const VARIANT_KEYS = Object.keys(VARIANTS) as Variant[];
const LEVEL_KEYS = Object.keys(LEVELS) as Difficulty[];

export const FIRST: Progress = Object.fromEntries(
  VARIANT_KEYS.map((v) => [v, Object.fromEntries(LEVEL_KEYS.map((d) => [d, 0]))]),
) as Progress;

/**
 * A puzzle of a variant and difficulty: the next one, or the one numbered `pick`. That list moves
 * on to the puzzle after it.
 */
export function newGame(variant: Variant, difficulty: Difficulty, upNext: Progress = FIRST, pick = upNext[variant][difficulty]): Game {
  const list = PUZZLES[variant][difficulty];
  const number = ((pick % list.length) + list.length) % list.length;
  const [fewest, code] = list[number];
  return {
    variant,
    difficulty,
    number,
    blocks: decode(code),
    fewest,
    history: [],
    moves: 0,
    done: false,
    upNext: { ...upNext, [variant]: { ...upNext[variant], [difficulty]: (number + 1) % list.length } },
  };
}

const isProgress = (value: unknown): value is Progress =>
  typeof value === 'object' && value !== null &&
  VARIANT_KEYS.every((v) => {
    const p = (value as Record<string, unknown>)[v] as Record<string, unknown> | undefined;
    return typeof p === 'object' && p !== null && LEVEL_KEYS.every((d) => Number.isInteger(p[d]));
  });

/**
 * Validates a save. Saves from before the variants were Classic games, with one count of what's
 * next per difficulty: they carry on as Classic, keeping those counts.
 */
export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  if (typeof g !== 'object' || g === null) return false;
  if (g.variant === undefined && typeof g.upNext === 'object' && g.upNext !== null && LEVEL_KEYS.every((d) => Number.isInteger((g.upNext as Record<string, unknown>)[d]))) {
    g.variant = 'classic';
    g.upNext = { ...FIRST, classic: g.upNext as unknown as Record<Difficulty, number> };
  }
  return (
    isVariant(g.variant) && isDifficulty(g.difficulty) &&
    Number.isInteger(g.number) && typeof g.fewest === 'number' && typeof g.moves === 'number' &&
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
