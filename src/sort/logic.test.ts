import { describe, expect, it } from 'vitest';
import { CAPACITY, DIFFICULTIES, generate, isSorted, pour, pourAmount, solve, TALL, type Difficulty } from './logic';

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`deals a ${difficulty} game that can be sorted`, () => {
      const { colors, spare } = DIFFICULTIES[difficulty];
      for (let run = 0; run < 5; run++) {
        const tubes = generate(difficulty);
        expect(tubes).toHaveLength(colors + spare);
        expect(tubes.filter((t) => t.length === 0)).toHaveLength(spare);
        for (let c = 0; c < colors; c++) expect(tubes.flat().filter((x) => x === c)).toHaveLength(CAPACITY);
        expect(isSorted(tubes)).toBe(false);
        // Follow the solver's pours: they must all be legal and end sorted.
        let t = tubes;
        for (const [from, to] of solve(tubes)!) {
          expect(pourAmount(t, from, to)).toBeGreaterThan(0);
          t = pour(t, from, to);
        }
        expect(isSorted(t)).toBe(true);
      }
    });
  }
});

describe('generate, tall tubes', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`deals a ${difficulty} game of ${TALL}-layer tubes that can be sorted`, () => {
      const { colors } = DIFFICULTIES[difficulty];
      for (let run = 0; run < 3; run++) {
        const tubes = generate(difficulty, TALL);
        for (let c = 0; c < colors; c++) expect(tubes.flat().filter((x) => x === c)).toHaveLength(TALL);
        let t = tubes;
        for (const [from, to] of solve(tubes, Infinity, TALL)!) {
          expect(pourAmount(t, from, to, TALL)).toBeGreaterThan(0);
          t = pour(t, from, to, TALL);
        }
        expect(isSorted(t, TALL)).toBe(true);
      }
    });
  }
});

describe('pour', () => {
  it('moves the top run, as much as fits, onto empty or matching tubes only', () => {
    expect(pourAmount([[0, 1, 1], []], 0, 1)).toBe(2);
    expect(pour([[0, 1, 1], []], 0, 1)).toEqual([[0], [1, 1]]);
    expect(pour([[0, 1, 1], [2, 2, 1]], 0, 1)).toEqual([[0, 1], [2, 2, 1, 1]]); // only room for one
    expect(pourAmount([[0, 1], [2]], 0, 1)).toBe(0); // color mismatch
    expect(pourAmount([[], [1]], 0, 1)).toBe(0); // nothing to pour
    expect(pourAmount([[1], [1, 1, 1, 1]], 0, 1)).toBe(0); // full
  });

  it('knows when it’s sorted', () => {
    expect(isSorted([[0, 0, 0, 0], [], [1, 1, 1, 1]])).toBe(true);
    expect(isSorted([[0, 0, 0], [0], [1, 1, 1, 1]])).toBe(false);
  });
});
