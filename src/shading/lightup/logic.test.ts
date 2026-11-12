import { describe, expect, it } from 'vitest';
import { lightupValid, seeded, subsets } from '../rules.test-helpers';
import { conflicts, DIFFICULTIES, generate, isPuzzle, isUnique, lit, solutions, WALL, type Difficulty } from './logic';

describe('solutions', () => {
  it('finds exactly the answers brute force does, on small boards', () => {
    const random = seeded(11);
    for (let run = 0; run < 60; run++) {
      const n = 4;
      const walls = Array.from({ length: n * n }, () => (random() < 0.25 ? (random() < 0.5 ? WALL : Math.floor(random() * 3)) : null));
      const want = [...subsets(n, (i) => walls[i] === null)].filter((l) => lightupValid(n, walls, l));
      const got = solutions({ size: n, walls }, 1000)!;
      expect(got.length).toBe(want.length);
      for (const l of got) expect(lightupValid(n, walls, l)).toBe(true);
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
        expect(lightupValid(size, p.walls, p.solution)).toBe(true);
        expect(isUnique(p)).toBe(true);
        expect(conflicts(p, p.solution).some(Boolean)).toBe(false);
        expect(lit(p, p.solution).every((on, i) => on || p.walls[i] !== null)).toBe(true);
        const share = p.walls.filter((w) => w !== null).length / (size * size);
        expect(share).toBeGreaterThanOrEqual(DIFFICULTIES[difficulty].walls[0]);
        expect(share).toBeLessThanOrEqual(DIFFICULTIES[difficulty].walls[1]);
      }
    });
  }

  it('keeps more numbers on Easy than on Hard', () => {
    const share = (d: Difficulty) => {
      const ps = Array.from({ length: 6 }, () => generate(d));
      return ps.reduce((t, p) => t + p.walls.filter((w) => w !== null && w >= 0).length / p.walls.filter((w) => w !== null).length, 0) / ps.length;
    };
    expect(share('easy')).toBeGreaterThan(share('hard'));
  });
});

describe('conflicts', () => {
  it('flags lamps that see each other and walls with too many lamps', () => {
    // 2×2: three white cells and a wall "0" at the bottom right.
    const p = { size: 2, walls: [null, null, null, 0] as (number | null)[] };
    // Two lamps in the top row see each other, and the right one is beside the "0".
    expect(conflicts(p, [true, true, false, false]).flatMap((b, i) => (b ? [i] : []))).toEqual([0, 1, 3]);
    expect(conflicts(p, [false, true, false, false]).flatMap((b, i) => (b ? [i] : []))).toEqual([3]);
  });
});
