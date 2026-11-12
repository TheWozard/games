import { describe, expect, it } from 'vitest';
import {
  decode, DIFFICULTIES, encode, explore, generate, isLayout, isOut, isSolved, LEVELS, range, shape, slide, VARIANTS,
  type Block, type Difficulty, type Shape, type Variant,
} from './logic';
import { PUZZLES } from './puzzles';

const CLASSIC = shape('classic');
const TWO = shape('twoKeys');

/** The fewest moves from `blocks`, by searching everything reachable (the start is the first position). */
const fewest = (blocks: Block[], s: Shape): number => explore(blocks, s, Infinity)!.moves[0];

describe('moves', () => {
  // Key block at the left of row 2; a block down column 2 across its path; one across the top
  // of column 2, so the block down can't go up.
  const blocks = decode('202-' + '123|' + '012-');

  it('round-trips through the stored form, and checks layouts', () => {
    expect(blocks).toEqual([
      { r: 2, c: 0, len: 2, across: true },
      { r: 1, c: 2, len: 3, across: false },
      { r: 0, c: 1, len: 2, across: true },
    ]);
    expect(encode(blocks)).toBe('202-123|012-');
    expect(isLayout(blocks, CLASSIC)).toBe(true);
    expect(isLayout(decode('202-212|'), CLASSIC)).toBe(false); // overlapping
    expect(isLayout(decode('302-'), CLASSIC)).toBe(false); // key block off the exit row
    expect(isLayout(decode('202-462|'), CLASSIC)).toBe(false); // off the board
  });

  it('slides each block along its line as far as it’s free', () => {
    expect(range(blocks, 0, CLASSIC)).toEqual([0, 0]); // blocked on the right by the block down
    expect(range(blocks, 1, CLASSIC)).toEqual([1, 3]); // under the block across row 0, down to the bottom
    expect(range(blocks, 2, CLASSIC)).toEqual([0, 4]); // the top row is otherwise empty
    const moved = slide(slide(blocks, 1, 3), 0, 4);
    expect(range(moved, 0, CLASSIC)).toEqual([4, 4]); // out: it doesn't move again
    expect(isSolved(moved, CLASSIC)).toBe(true);
    expect(fewest(blocks, CLASSIC)).toBe(2);
  });

  it('keeps pillars where they are, in the way of other blocks', () => {
    const withPillar = decode('202-' + '041+');
    expect(withPillar[1]).toEqual({ r: 0, c: 4, len: 1, across: true, fixed: true });
    expect(encode(withPillar)).toBe('202-041+');
    expect(isLayout(withPillar, CLASSIC)).toBe(true);
    expect(range(withPillar, 1, CLASSIC)).toEqual([4, 4]);
    const blocked = decode('202-' + '142|' + '341+');
    expect(range(blocked, 1, CLASSIC)).toEqual([0, 1]); // the pillar below stops it
  });
});

describe('two keys', () => {
  // First key across row 2 at the left; second key down column 3, covering rows 1 and 2, in the
  // first one's way.
  const blocks = decode('202-' + '132|');

  it('has the second key block stand in its exit column', () => {
    expect(isLayout(blocks, TWO)).toBe(true);
    expect(isLayout(decode('202-'), TWO)).toBe(false); // no second key block
    expect(isLayout(decode('202-' + '122|'), TWO)).toBe(false); // second key block off its column
  });

  it('lets a key block out at its exit, freeing its squares; finished once both are out', () => {
    expect(range(blocks, 0, TWO)).toEqual([0, 1]);
    const down = slide(blocks, 1, 4); // to the bottom edge: out
    expect(isOut(down, 1, TWO)).toBe(true);
    expect(isSolved(down, TWO)).toBe(false);
    expect(range(down, 0, TWO)).toEqual([0, 4]); // its squares are free now
    expect(range(down, 1, TWO)).toEqual([4, 4]); // and it's gone for good
    expect(isSolved(slide(down, 0, 4), TWO)).toBe(true);
    expect(fewest(blocks, TWO)).toBe(2);
  });

  it('counts moves forward even though a key block can’t come back', () => {
    // The second key can leave at once, but the first then needs it gone: still two moves.
    const found = explore(blocks, TWO, Infinity)!;
    const outFirst = found.keys.indexOf('04');
    expect(found.moves[outFirst]).toBe(1);
  });
});

describe('generate', () => {
  for (const variant of Object.keys(VARIANTS) as Variant[]) {
    it(`makes ${variant} puzzles of the fewest moves asked for`, () => {
      const s = shape(variant);
      const p = generate(variant, 'easy');
      expect(isLayout(p.blocks, s)).toBe(true);
      expect(p.blocks.filter((b) => b.fixed)).toHaveLength(VARIANTS[variant].pillars);
      const [lo, hi] = DIFFICULTIES[variant].easy.moves;
      expect(p.fewest).toBeGreaterThanOrEqual(lo);
      expect(p.fewest).toBeLessThanOrEqual(hi);
      expect(fewest(p.blocks, s)).toBe(p.fewest);
      expect(p.interest).toBeGreaterThan(0);
      expect(p.blocks.some((_, i) => isOut(p.blocks, i, s))).toBe(false);
    }, 60000);
  }
});

describe('shipped puzzles', () => {
  for (const variant of Object.keys(VARIANTS) as Variant[]) {
    for (const difficulty of Object.keys(LEVELS) as Difficulty[]) {
      it(`${variant} ${difficulty}: sound, different, and take exactly the moves stated`, () => {
        const s = shape(variant);
        const list = PUZZLES[variant][difficulty];
        const [lo, hi] = DIFFICULTIES[variant][difficulty].moves;
        expect(list.length).toBe({ easy: 10, medium: 30, hard: 60 }[difficulty]);
        expect(new Set(list.map(([, code]) => code)).size).toBe(list.length);
        for (const [moves, code] of list) {
          const blocks = decode(code);
          expect(isLayout(blocks, s)).toBe(true);
          expect(blocks.some((_, i) => isOut(blocks, i, s))).toBe(false); // every key block starts on the board
          expect(moves).toBeGreaterThanOrEqual(lo);
          expect(moves).toBeLessThanOrEqual(hi);
          expect(fewest(blocks, s)).toBe(moves);
        }
      }, 120000);
    }
  }
});
