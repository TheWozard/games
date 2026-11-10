import { describe, expect, it } from 'vitest';
import { crossings, DIFFICULTIES, generate, HEIGHT, MARGIN, segmentsCross, WIDTH, type Difficulty } from './logic';

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`makes a tangled ${difficulty} puzzle that can be untangled`, () => {
      const n = DIFFICULTIES[difficulty].lines;
      for (let run = 0; run < 20; run++) {
        const { edges, solution, points } = generate(difficulty);
        expect(points).toHaveLength((n * (n - 1)) / 2);
        expect(edges).toHaveLength(n * (n - 2));
        expect(crossings(points, edges).count).toBeGreaterThan(0);
        expect(crossings(solution, edges).count).toBe(0);
        for (const [x, y] of [...points, ...solution]) {
          expect(x).toBeGreaterThanOrEqual(MARGIN - 1e-9);
          expect(x).toBeLessThanOrEqual(WIDTH - MARGIN + 1e-9);
          expect(y).toBeGreaterThanOrEqual(MARGIN - 1e-9);
          expect(y).toBeLessThanOrEqual(HEIGHT - MARGIN + 1e-9);
        }
        // Every dot is on two lines, so it has 2 to 4 edges.
        const degree = points.map((_, i) => edges.filter(([a, b]) => a === i || b === i).length);
        expect(degree.every((d) => d >= 2 && d <= 4)).toBe(true);
      }
    });
  }
});

describe('segmentsCross', () => {
  it('detects a proper crossing only', () => {
    expect(segmentsCross([0, 0], [10, 10], [0, 10], [10, 0])).toBe(true);
    expect(segmentsCross([0, 0], [10, 10], [20, 0], [30, 10])).toBe(false);
    expect(segmentsCross([0, 0], [10, 0], [10, 0], [10, 10])).toBe(false); // touching at an end
    // Two pieces of one straight line never cross, even with rounding in the coordinates
    // (this exact pair once came out of the generator and was counted as a crossing).
    expect(segmentsCross(
      [6.7115136673934135, 30.11355397154393], [25.996608724756022, 42.95188483922837],
      [31.14734732026596, 46.38079644715239], [62.72319729728594, 67.40123778942015],
    )).toBe(false);
  });
});
