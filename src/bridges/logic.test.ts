import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, edgesOf, generate, isSolved, solve, type Difficulty, type Island } from './logic';

const valid = (islands: Island[], solution: number[], cols: number, rows: number) => {
  const { edges, crosses } = edgesOf(islands, cols, rows);
  return isSolved(islands, edges, crosses, solution);
};

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`makes a valid ${difficulty} puzzle with exactly one solution`, () => {
      const { cols, rows, islands: target } = DIFFICULTIES[difficulty];
      for (let run = 0; run < 10; run++) {
        const { islands, solution } = generate(difficulty);
        expect(islands.length).toBeGreaterThanOrEqual(Math.ceil(target * 0.8));
        for (const s of islands) {
          expect(s.r).toBeLessThan(rows);
          expect(s.c).toBeLessThan(cols);
          expect(s.n).toBeGreaterThanOrEqual(1);
          expect(s.n).toBeLessThanOrEqual(8);
        }
        // No two islands side by side.
        for (const s of islands) for (const t of islands) {
          if (s !== t) expect(Math.abs(s.r - t.r) + Math.abs(s.c - t.c)).toBeGreaterThan(1);
        }
        expect(valid(islands, solution, cols, rows)).toBe(true);
        const { edges, crosses } = edgesOf(islands, cols, rows);
        expect(solve(islands, edges, crosses, 2)).toEqual([solution]);
      }
    });
  }
});

describe('solve', () => {
  it('finds both answers to an ambiguous square', () => {
    // 3 . 3
    // . . .
    // 3 . 3   each side 1 or 2 bridges, alternating: two valid answers.
    const islands = [{ r: 0, c: 0, n: 3 }, { r: 0, c: 2, n: 3 }, { r: 2, c: 0, n: 3 }, { r: 2, c: 2, n: 3 }];
    const { edges, crosses } = edgesOf(islands, 3, 3);
    expect(solve(islands, edges, crosses, 5)).toHaveLength(2);
  });

  it('rejects answers that leave islands cut off', () => {
    // 2 . 2      two double bridges would satisfy the numbers but split the islands in two;
    // . . .      only the ring of single bridges keeps everything connected.
    // 2 . 2
    const islands = [{ r: 0, c: 0, n: 2 }, { r: 0, c: 2, n: 2 }, { r: 2, c: 0, n: 2 }, { r: 2, c: 2, n: 2 }];
    const { edges, crosses } = edgesOf(islands, 3, 3);
    expect(solve(islands, edges, crosses, 5)).toEqual([[1, 1, 1, 1]]);
  });

  it('never lets bridges cross', () => {
    //   . 1 .
    //   1 . 1    the only bridges available cross in the middle, so there is no answer.
    //   . 1 .
    const islands = [{ r: 0, c: 1, n: 1 }, { r: 1, c: 0, n: 1 }, { r: 1, c: 2, n: 1 }, { r: 2, c: 1, n: 1 }];
    const { edges, crosses } = edgesOf(islands, 3, 3);
    expect(crosses.some((x) => x.length > 0)).toBe(true);
    expect(solve(islands, edges, crosses, 5)).toEqual([]);
  });
});
