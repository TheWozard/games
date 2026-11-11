// Sliding Blocks game state and moves, as a pure reducer. Puzzles come from the pre-made list in
// puzzles.ts, played in order: each difficulty remembers which one is next and wraps round to
// the first after the last. Any puzzle can also be picked by number, and play carries on in order
// from there.
import { decode, DIFFICULTIES, isDifficulty, isLayout, isSolved, range, slide, type Block, type Difficulty } from './logic';
import { PUZZLES } from './puzzles';

export const STORAGE_KEY = 'games.blocks.v1';
const HISTORY_LIMIT = 500;

export type Progress = Record<Difficulty, number>;

export interface Game {
  difficulty: Difficulty;
  number: number; // which puzzle of the difficulty's list (from 0)
  blocks: Block[];
  fewest: number; // the fewest moves that solve it
  history: Block[][]; // layouts before each move, for undo
  moves: number;
  done: boolean;
  upNext: Progress; // per difficulty, the puzzle to play next
}

export type Action =
  | { type: 'slide'; index: number; to: number }
  | { type: 'undo' };

export const FIRST: Progress = { easy: 0, medium: 0, hard: 0 };

/**
 * A puzzle of a difficulty: the next one, or the one numbered `pick`. The difficulty moves on to
 * the puzzle after it.
 */
export function newGame(difficulty: Difficulty, upNext: Progress = FIRST, pick = upNext[difficulty]): Game {
  const list = PUZZLES[difficulty];
  const number = ((pick % list.length) + list.length) % list.length;
  const [fewest, code] = list[number];
  return {
    difficulty,
    number,
    blocks: decode(code),
    fewest,
    history: [],
    moves: 0,
    done: false,
    upNext: { ...upNext, [difficulty]: (number + 1) % list.length },
  };
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  return (
    isDifficulty(g?.difficulty) &&
    Number.isInteger(g.number) && typeof g.fewest === 'number' && typeof g.moves === 'number' &&
    Array.isArray(g.blocks) && isLayout(g.blocks) &&
    Array.isArray(g.history) && g.history.every((b) => Array.isArray(b) && b.length === g.blocks!.length) &&
    typeof g.upNext === 'object' && g.upNext !== null &&
    (Object.keys(DIFFICULTIES) as Difficulty[]).every((d) => Number.isInteger(g.upNext![d]))
  );
}

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'slide': {
      const { index, to } = action;
      if (g.done || !g.blocks[index]) return g;
      const b = g.blocks[index];
      const [lo, hi] = range(g.blocks, index);
      if (to === (b.across ? b.c : b.r) || to < lo || to > hi) return g;
      const blocks = slide(g.blocks, index, to);
      return {
        ...g,
        blocks,
        history: [...g.history, g.blocks].slice(-HISTORY_LIMIT),
        moves: g.moves + 1,
        done: isSolved(blocks),
      };
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, blocks: last, history: g.history.slice(0, -1), moves: g.moves - 1 };
    }
  }
}
