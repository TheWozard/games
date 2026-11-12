import { describe, expect, it } from 'vitest';
import { nurikabeValid, seeded, subsets } from '../rules.test-helpers';
import { conflicts, DIFFICULTIES, generate, isPuzzle, isUnique, solutions, type Difficulty } from './logic';

describe('solutions', () => {
  it('finds exactly the answers brute force does, on small boards', () => {
    const random = seeded(5);
    let checked = 0;
    for (let run = 0; run < 60; run++) {
      const n = 4;
      const clues = Array.from({ length: n * n }, () => (random() < 0.2 ? 1 + Math.floor(random() * 4) : null));
      if (clues.every((v) => v === null)) continue;
      const want = [...subsets(n, (i) => clues[i] === null)].filter((sea) => nurikabeValid(n, clues, sea));
      const got = solutions({ size: n, clues }, 1000)!;
      expect(got.length).toBe(want.length);
      for (const sea of got) expect(nurikabeValid(n, clues, sea)).toBe(true);
      checked += want.length;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`makes ${difficulty} puzzles with one answer`, () => {
      const { size, biggest } = DIFFICULTIES[difficulty];
      for (let run = 0; run < 8; run++) {
        const p = generate(difficulty);
        expect(isPuzzle(p, difficulty)).toBe(true);
        expect(nurikabeValid(size, p.clues, p.solution)).toBe(true);
        expect(Math.max(...p.clues.map((v) => v ?? 0))).toBeLessThanOrEqual(biggest);
        expect(isUnique(p)).toBe(true);
        expect(conflicts(p, p.solution).some(Boolean)).toBe(false);
      }
    });
  }
});

describe('conflicts', () => {
  it('flags a 2×2 block of shade', () => {
    const shaded = new Array<boolean>(25).fill(false);
    shaded[0] = shaded[1] = shaded[5] = shaded[6] = true;
    shaded[12] = true;
    expect(conflicts({ size: 5 }, shaded).flatMap((b, i) => (b ? [i] : []))).toEqual([0, 1, 5, 6]);
  });
});
