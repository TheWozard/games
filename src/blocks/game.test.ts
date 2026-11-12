import { describe, expect, it } from 'vitest';
import { difficultyOf, FIRST, isGame, LEVEL_LIST, newGame, reducer, type Game } from './game';
import { explore, isOut, positionKey, range, shape } from './logic';
import { PUZZLES } from './puzzles';

/** Plays a game to the end in the fewest moves, each slide bringing the finish one move closer. */
function solve(g: Game): Game {
  const s = shape(g.variant);
  const found = explore(g.blocks, s, Infinity)!;
  const moves = new Map(found.keys.map((k, id) => [k, found.moves[id]]));
  while (!g.done) {
    const left = moves.get(positionKey(g.blocks))!;
    g = g.blocks.flatMap((_, i) => {
      const [lo, hi] = range(g.blocks, i, s);
      return Array.from({ length: hi - lo + 1 }, (_, k) => reducer(g, { type: 'slide', index: i, to: lo + k }));
    }).find((n) => moves.get(positionKey(n.blocks)) === left - 1)!;
  }
  return g;
}

describe('levels', () => {
  it('list each variant’s Easy, then Medium, then Hard puzzles', () => {
    for (const variant of ['classic', 'pillars', 'big', 'twoKeys'] as const) {
      const list = LEVEL_LIST[variant];
      expect(list.map((l) => l.code)).toEqual((['easy', 'medium', 'hard'] as const).flatMap((d) => PUZZLES[variant][d].map(([, code]) => code)));
      expect(list.length).toBe(100);
    }
  });

  it('play in order through the difficulties, wrapping round, each variant remembered separately', () => {
    let g = newGame('classic');
    expect(g.level).toBe(0);
    expect(g.upNext.classic).toBe(1);
    g = newGame('classic', g.upNext);
    expect(g.level).toBe(1);
    g = newGame('big', g.upNext);
    expect(g.level).toBe(0);
    g = newGame('classic', g.upNext);
    expect(g.level).toBe(2);
    const lastEasy = PUZZLES.classic.easy.length - 1;
    g = newGame('classic', FIRST, lastEasy);
    expect(difficultyOf(g)).toBe('easy');
    g = newGame('classic', g.upNext);
    expect(g.level).toBe(lastEasy + 1);
    expect(difficultyOf(g)).toBe('medium');
    g = newGame('pillars', FIRST, LEVEL_LIST.pillars.length - 1);
    expect(difficultyOf(g)).toBe('hard');
    expect(g.upNext.pillars).toBe(0);
  });

  it('start a picked level and carry on in order after it', () => {
    let g = newGame('twoKeys', undefined, 41);
    expect(g.level).toBe(41);
    expect(g.upNext.twoKeys).toBe(42);
    g = newGame('twoKeys', g.upNext);
    expect(g.level).toBe(42);
    expect(g.blocks).toEqual(newGame('twoKeys', FIRST, 42).blocks);
  });
});

describe('reducer', () => {
  it('slides, refuses blocked or empty slides, and undoes', () => {
    let g = newGame('classic');
    const s = shape('classic');
    const i = g.blocks.findIndex((_, k) => range(g.blocks, k, s)[0] !== range(g.blocks, k, s)[1]);
    const [lo, hi] = range(g.blocks, i, s);
    const b = g.blocks[i];
    const at = b.across ? b.c : b.r;
    const to = at === lo ? hi : lo;
    expect(reducer(g, { type: 'slide', index: i, to: at })).toBe(g); // didn't move
    expect(reducer(g, { type: 'slide', index: i, to: -1 })).toBe(g); // off the board
    const before = g.blocks;
    g = reducer(g, { type: 'slide', index: i, to });
    expect(g.moves).toBe(1);
    g = reducer(g, { type: 'undo' });
    expect(g.blocks).toBe(before);
    expect(g.moves).toBe(0);
    expect(reducer(g, { type: 'undo' })).toBe(g);
  });

  it('never moves a pillar', () => {
    const g = newGame('pillars');
    const p = g.blocks.findIndex((b) => b.fixed);
    expect(p).toBeGreaterThan(0);
    expect(reducer(g, { type: 'slide', index: p, to: (g.blocks[p].c + 1) % 6 })).toBe(g);
  });

  for (const variant of ['classic', 'pillars', 'big', 'twoKeys'] as const) {
    it(`finishes ${variant} in the fewest moves when each move gets closer, and round-trips through JSON`, () => {
      const g = solve(newGame(variant, FIRST, LEVEL_LIST[variant].length - 1));
      expect(g.moves).toBe(g.fewest);
      expect(reducer(g, { type: 'undo' })).toBe(g);
      expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
      expect(isGame({ ...g, upNext: { ...g.upNext, big: 'x' } })).toBe(false);
      expect(isGame({ ...g, level: 100 })).toBe(false);
      expect(isGame({ ...g, blocks: [] })).toBe(false);
      expect(isGame({ ...g, variant: 'huge' })).toBe(false);
    }, 60000);
  }

  it('needs both key blocks out in Two Keys', () => {
    // Play the fewest moves, and check the game isn't done when only one key block is out.
    let g = newGame('twoKeys');
    const s = shape('twoKeys');
    const found = explore(g.blocks, s, Infinity)!;
    const moves = new Map(found.keys.map((k, id) => [k, found.moves[id]]));
    while (!g.done) {
      const left = moves.get(positionKey(g.blocks))!;
      g = g.blocks.flatMap((_, i) => {
        const [lo, hi] = range(g.blocks, i, s);
        return Array.from({ length: hi - lo + 1 }, (_, k) => reducer(g, { type: 'slide', index: i, to: lo + k }));
      }).find((n) => moves.get(positionKey(n.blocks)) === left - 1)!;
      const out = [0, 1].filter((k) => isOut(g.blocks, k, s));
      if (out.length === 1) expect(g.done).toBe(false);
    }
    expect(g.done).toBe(true);
  });
});

describe('saves', () => {
  /** A save as it was before each variant was one list: a difficulty and a number in it. */
  const oldSave = (variant: 'classic' | 'big', difficulty: 'easy' | 'medium' | 'hard', number: number) => {
    const { level: _, upNext: __, ...rest } = newGame(variant, FIRST, LEVEL_LIST[variant].findIndex((l) => l.difficulty === difficulty) + number);
    return { ...rest, difficulty, number };
  };

  it('carries a save from before the lists on: the same puzzle, and the level after the furthest played', () => {
    const empty = { easy: 0, medium: 0, hard: 0 };
    const save = JSON.parse(JSON.stringify({
      ...oldSave('big', 'medium', 5),
      upNext: { classic: { easy: 3, medium: 0, hard: 0 }, pillars: empty, big: { easy: 4, medium: 6, hard: 0 }, twoKeys: { easy: 95, medium: 0, hard: 0 } },
    }));
    const blocks = save.blocks;
    expect(isGame(save)).toBe(true);
    expect(save.level).toBe(PUZZLES.big.easy.length + 5);
    expect(LEVEL_LIST.big[save.level].code).toBe(PUZZLES.big.medium[5][1]);
    expect(save.blocks).toEqual(blocks);
    expect(save.difficulty).toBeUndefined();
    expect(save.upNext).toEqual({
      classic: 3,
      pillars: 0,
      big: PUZZLES.big.easy.length + 6,
      twoKeys: PUZZLES.twoKeys.easy.length, // past the end of a longer Easy list: on to Medium
    });
  });

  it('carries a save from before the variants on as Classic, keeping what’s next', () => {
    const old = JSON.parse(JSON.stringify({ ...oldSave('classic', 'easy', 2), variant: undefined, upNext: { easy: 3, medium: 6, hard: 0 } }));
    delete old.variant;
    expect(isGame(old)).toBe(true);
    expect(old.variant).toBe('classic');
    expect(old.level).toBe(2);
    expect(old.upNext).toEqual({ ...FIRST, classic: PUZZLES.classic.easy.length + 6 });
  });
});
