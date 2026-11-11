import { describe, expect, it } from 'vitest';
import { decode, DIFFICULTIES, encode, explore, generate, isLayout, isSolved, range, slide, type Block, type Difficulty } from './logic';
import { PUZZLES } from './puzzles';

/** The fewest moves from `blocks`, by searching everything reachable. */
function fewest(blocks: Block[]): number {
  const all = explore(blocks, Infinity)!;
  return all.find((p) => encode(p.blocks) === encode(blocks))!.moves;
}

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
    expect(isLayout(blocks)).toBe(true);
    expect(isLayout(decode('202-212|'))).toBe(false); // overlapping
    expect(isLayout(decode('302-'))).toBe(false); // key block off the exit row
    expect(isLayout(decode('202-462|'))).toBe(false); // off the board
  });

  it('slides each block along its line as far as it’s free', () => {
    expect(range(blocks, 0)).toEqual([0, 0]); // blocked on the right by the block down
    expect(range(blocks, 1)).toEqual([1, 3]); // under the block across row 0, down to the bottom
    expect(range(blocks, 2)).toEqual([0, 4]); // the top row is otherwise empty
    const moved = slide(slide(blocks, 1, 3), 0, 4);
    expect(range(moved, 0)).toEqual([0, 4]);
    expect(isSolved(moved)).toBe(true);
    expect(fewest(blocks)).toBe(2);
  });
});

describe('puzzles', () => {
  it('generates puzzles of the fewest moves asked for', () => {
    const p = generate('easy');
    expect(isLayout(p.blocks)).toBe(true);
    expect(p.fewest).toBeGreaterThanOrEqual(DIFFICULTIES.easy.moves[0]);
    expect(p.fewest).toBeLessThanOrEqual(DIFFICULTIES.easy.moves[1]);
    expect(fewest(p.blocks)).toBe(p.fewest);
  });

  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`ships ${difficulty} puzzles that are sound, different, and take exactly the moves stated`, () => {
      const list = PUZZLES[difficulty];
      const [lo, hi] = DIFFICULTIES[difficulty].moves;
      expect(list.length).toBeGreaterThanOrEqual(50);
      expect(new Set(list.map(([, code]) => code)).size).toBe(list.length);
      for (const [moves, code] of list) {
        const blocks = decode(code);
        expect(isLayout(blocks)).toBe(true);
        expect(moves).toBeGreaterThanOrEqual(lo);
        expect(moves).toBeLessThanOrEqual(hi);
        expect(fewest(blocks)).toBe(moves);
      }
    }, 60000);
  }
});
