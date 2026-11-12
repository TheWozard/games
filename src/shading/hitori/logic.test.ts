import { describe, expect, it } from 'vitest';
import { hitoriValid, seeded, subsets } from '../rules.test-helpers';
import { conflicts, DIFFICULTIES, generate, isPuzzle, isUnique, solutions, type Difficulty } from './logic';

describe('solutions', () => {
  it('counts answers the way brute force does, on small boards', () => {
    const random = seeded(7);
    for (let run = 0; run < 40; run++) {
      const n = 4;
      const numbers = Array.from({ length: n * n }, () => 1 + Math.floor(random() * n));
      const want = [...subsets(n)].filter((s) => hitoriValid(n, numbers, s)).length;
      const got = solutions({ size: n, numbers }, 2)!;
      // Up to two: none, one, or more than one.
      expect(got.length).toBe(Math.min(want, 2));
      for (const s of got) expect(hitoriValid(n, numbers, s)).toBe(true);
    }
  });
});

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`makes ${difficulty} puzzles with one answer`, () => {
      const { size } = DIFFICULTIES[difficulty];
      for (let run = 0; run < 8; run++) {
        const p = generate(difficulty);
        expect(isPuzzle(p, difficulty)).toBe(true);
        expect(hitoriValid(size, p.numbers, p.solution)).toBe(true);
        expect(isUnique(p)).toBe(true);
        expect(conflicts(p, p.solution, p.solution.map((s) => !s)).some(Boolean)).toBe(false);
      }
    });
  }
});

describe('conflicts', () => {
  it('flags shaded neighbors and circled repeats', () => {
    const p = { size: 3, numbers: [1, 2, 3, 2, 3, 1, 1, 3, 2] };
    const shaded = [true, true, false, false, false, false, false, false, false];
    const kept = [false, false, false, false, true, false, false, true, false]; // two 3s in column 1
    expect(conflicts(p, shaded, kept).flatMap((b, i) => (b ? [i] : []))).toEqual([0, 1, 4, 7]);
  });
});
