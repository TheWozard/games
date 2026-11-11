import { describe, expect, it } from 'vitest';
import { adjacent, connected, DIFFICULTIES, extend, generate, isSolved, startStroke, type Difficulty } from './logic';

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`makes a ${difficulty} puzzle whose own paths solve it`, () => {
      const { size, colors } = DIFFICULTIES[difficulty];
      for (let run = 0; run < 8; run++) {
        const { dots, solution } = generate(difficulty);
        expect(dots).toHaveLength(colors);
        expect(new Set(dots.flat()).size).toBe(colors * 2);
        for (const p of solution) {
          expect(p.length).toBeGreaterThanOrEqual(3);
          for (let k = 1; k < p.length; k++) expect(adjacent(p[k - 1], p[k], size)).toBe(true);
        }
        expect(isSolved(dots, solution, size)).toBe(true);
      }
    });
  }
});

describe('drawing', () => {
  // 3×3: red joins 0 → 2 along the top, blue joins 6 → 8 along the bottom.
  const size = 3;
  const dots: [number, number][] = [[0, 2], [6, 8]];

  it('starts from a dot, extends, retraces, and stops at the other dot', () => {
    let { color, paths } = startStroke(dots, [[], []], 0);
    expect(color).toBe(0);
    paths = extend(dots, paths, 0, 1, size);
    paths = extend(dots, paths, 0, 4, size);
    expect(paths[0]).toEqual([0, 1, 4]);
    paths = extend(dots, paths, 0, 1, size); // back over itself
    expect(paths[0]).toEqual([0, 1]);
    paths = extend(dots, paths, 0, 2, size);
    expect(connected(dots, paths, 0)).toBe(true);
    expect(extend(dots, paths, 0, 5, size)).toBe(paths); // finished: won't go past
    expect(extend(dots, [[0], []], 0, 4, size)).toEqual([[0], []]); // not adjacent: ignored
  });

  it('is blocked by another color’s dot or path, leaving that color alone', () => {
    let paths = [[0, 3], []];
    expect(extend(dots, paths, 0, 6, size)).toBe(paths); // blue's dot
    paths = extend(dots, [[0], [6, 7, 4, 5, 8]], 0, 1, size);
    const blocked = extend(dots, paths, 0, 4, size); // blue's path at 4
    expect(blocked).toBe(paths);
    expect(blocked[1]).toEqual([6, 7, 4, 5, 8]);
  });

  it('restarts from a dot, or cuts back to a tapped point on a path', () => {
    const paths = [[0, 1, 4], []];
    expect(startStroke(dots, paths, 0)).toEqual({ color: 0, paths: [[0], []] });
    expect(startStroke(dots, paths, 1)).toEqual({ color: 0, paths: [[0, 1], []] });
    expect(startStroke(dots, paths, 5).color).toBe(-1);
  });

  it('needs every square filled to be solved', () => {
    expect(isSolved(dots, [[0, 1, 2], [6, 7, 8]], size)).toBe(false); // middle row empty
    expect(isSolved(dots, [[0, 1, 2], [6, 3, 4, 5, 8]], size)).toBe(false); // 7 empty
    expect(isSolved(dots, [[0, 1, 2], [6, 3, 4, 7, 8]], size)).toBe(false); // 5 empty
  });
});
