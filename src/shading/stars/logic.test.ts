import { describe, expect, it } from 'vitest';
import { seeded, starsValid } from '../rules.test-helpers';
import { conflicts, DIFFICULTIES, generate, isPuzzle, isUnique, solutions, type Difficulty } from './logic';

const cells = (n: number, rows: number[]) => Array.from({ length: n * n }, (_, i) => (rows[Math.floor(i / n)] & (1 << (i % n))) !== 0);

describe('solutions', () => {
  it('finds exactly the placements brute force does, on small boards', () => {
    const random = seeded(3);
    let checked = 0;
    for (let run = 0; run < 300; run++) {
      const n = 5;
      const regions = Array.from({ length: n * n }, () => Math.floor(random() * n));
      // Every board with one star per row (n^n of them), checked against the rules.
      let want = 0;
      for (let code = 0; code < n ** n; code++) {
        const s = new Array<boolean>(n * n).fill(false);
        for (let r = 0, x = code; r < n; r++, x = Math.floor(x / n)) s[r * n + (x % n)] = true;
        if (starsValid(n, 1, regions, s)) want++;
      }
      const got = solutions(n, 1, regions, 1000)!;
      expect(got.length).toBe(want);
      for (const rows of got) expect(starsValid(n, 1, regions, cells(n, rows))).toBe(true);
      checked += want;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`makes ${difficulty} puzzles with one answer`, () => {
      const { size, stars } = DIFFICULTIES[difficulty];
      for (let run = 0; run < 8; run++) {
        const p = generate(difficulty);
        expect(isPuzzle(p, difficulty)).toBe(true);
        expect(new Set(p.regions).size).toBe(size);
        expect(starsValid(size, stars, p.regions, p.solution)).toBe(true);
        expect(isUnique(p)).toBe(true);
        expect(conflicts(p, p.solution).some(Boolean)).toBe(false);
      }
    });
  }
});

describe('conflicts', () => {
  it('flags touching stars and too many in a line', () => {
    const p = { size: 6, stars: 1, regions: Array.from({ length: 36 }, (_, i) => Math.floor(i / 6)) };
    const s = new Array<boolean>(36).fill(false);
    s[0] = s[7] = true; // diagonal neighbors
    s[3] = true; // a second star in row 0
    expect(conflicts(p, s).flatMap((b, i) => (b ? [i] : []))).toEqual([0, 3, 7]);
  });
});
