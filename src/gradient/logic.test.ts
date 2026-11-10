import { describe, expect, it } from 'vitest';
import { corners, DIFFICULTIES, fixedTiles, palette, shuffled, toCss, type Difficulty } from './logic';

describe('palette', () => {
  it('blends from the four corners, in sRGB range', () => {
    const c = corners();
    const p = palette(5, 7, c);
    expect(p).toHaveLength(35);
    const near = (x: number[], y: number[]) => x.forEach((v, k) => expect(v).toBeCloseTo(y[k], 9));
    near(p[0], c[0]);
    near(p[4], c[1]);
    near(p[30], c[2]);
    near(p[34], c[3]);
    for (const lab of p) expect(toCss(lab)).toMatch(/^rgb\(\d{1,3} \d{1,3} \d{1,3}\)$/);
  });

  it('keeps neighbouring tiles distinguishable', () => {
    for (let run = 0; run < 50; run++) {
      const { cols, rows } = DIFFICULTIES.hard;
      const p = palette(cols, rows, corners());
      const dist = (i: number, j: number) => Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1], p[i][2] - p[j][2]);
      for (let i = 0; i < p.length; i++) {
        if (i % cols < cols - 1) expect(dist(i, i + 1)).toBeGreaterThan(0.01);
        if (i + cols < p.length) expect(dist(i, i + cols)).toBeGreaterThan(0.01);
      }
    }
  });
});

describe('shuffled', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`keeps ${difficulty} fixed tiles home and moves every other tile`, () => {
      const { cols, rows, fixed: pattern } = DIFFICULTIES[difficulty];
      const fixed = fixedTiles(cols, rows, pattern);
      expect(fixed[0] && fixed[cols - 1] && fixed[cols * (rows - 1)] && fixed[cols * rows - 1]).toBe(true);
      const order = shuffled(fixed);
      expect([...order].sort((a, b) => a - b)).toEqual([...Array(cols * rows).keys()]);
      order.forEach((id, pos) => expect(id === pos).toBe(fixed[pos]));
    });
  }
});
