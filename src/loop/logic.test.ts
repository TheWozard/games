import { describe, expect, it } from 'vitest';
import { cellEdges, DIFFICULTIES, dotEdges, edgeBetween, edgeCount, edgeEnds, generate, isSolved, solve, type Difficulty } from './logic';

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`makes a ${difficulty} puzzle with exactly one loop`, () => {
      const { rows, cols, keep } = DIFFICULTIES[difficulty];
      const g = { rows, cols };
      for (let run = 0; run < 4; run++) {
        const { clues, solution } = generate(difficulty);
        expect(clues).toHaveLength(rows * cols);
        expect(solution).toHaveLength(edgeCount(g));
        expect(isSolved(g, clues, solution)).toBe(true);
        // Clues match the loop where shown...
        clues.forEach((c, i) => {
          if (c !== null) expect(cellEdges(g, Math.floor(i / cols), i % cols).filter((e) => solution[e]).length).toBe(c);
        });
        // ...enough of them are shown...
        expect(clues.filter((c) => c !== null).length).toBeGreaterThanOrEqual(Math.round(rows * cols * keep));
        // ...and they allow only this loop.
        expect(solve(g, clues, 2)).toEqual([solution]);
      }
    });
  }
});

describe('geometry', () => {
  const g = { rows: 3, cols: 4 };
  it('numbers edges consistently', () => {
    expect(edgeCount(g)).toBe(4 * 4 + 3 * 5);
    for (let e = 0; e < edgeCount(g); e++) {
      const [a, b] = edgeEnds(g, e);
      expect(edgeBetween(g, a, b)).toBe(e);
      expect(dotEdges(g, ...a)).toContain(e);
      expect(dotEdges(g, ...b)).toContain(e);
    }
  });
});

describe('isSolved', () => {
  const g = { rows: 2, cols: 2 };
  const lines = (pairs: [[number, number], [number, number]][]) => {
    const on = new Array(edgeCount(g)).fill(false);
    for (const [a, b] of pairs) on[edgeBetween(g, a, b)] = true;
    return on;
  };
  const ring: [[number, number], [number, number]][] = [
    [[0, 0], [0, 1]], [[0, 1], [0, 2]], [[0, 2], [1, 2]], [[1, 2], [2, 2]],
    [[2, 2], [2, 1]], [[2, 1], [2, 0]], [[2, 0], [1, 0]], [[1, 0], [0, 0]],
  ];
  it('accepts one loop matching the clues', () => {
    expect(isSolved(g, [2, 2, 2, 2], lines(ring))).toBe(true);
    expect(isSolved(g, [2, null, null, 3], lines(ring))).toBe(false); // clue mismatch
  });
  it('rejects two loops, and branches', () => {
    const two = lines([[[0, 0], [0, 1]], [[0, 1], [1, 1]], [[1, 1], [1, 0]], [[1, 0], [0, 0]],
      [[1, 1], [1, 2]], [[1, 2], [2, 2]], [[2, 2], [2, 1]], [[2, 1], [1, 1]]]);
    expect(isSolved(g, [null, null, null, null], two)).toBe(false);
    const branch = lines([...ring, [[0, 1], [1, 1]]]);
    expect(isSolved(g, [null, null, null, null], branch)).toBe(false);
  });
});
