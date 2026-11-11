import { describe, expect, it } from 'vitest';
import { cellEdges, DARK, DIFFICULTIES, dotEdges, dotIndex, edgeBetween, edgeCount, edgeEnds, generate, insideCells, isSolved, LIGHT, NO_RULES, solve, type Difficulty, type Rules } from './logic';

const RULE_SETS: Rules[] = [NO_RULES, { squares: true, rings: false }, { squares: false, rings: true }, { squares: true, rings: true }];
const named = (rules: Rules) => Object.entries(rules).filter(([, on]) => on).map(([k]) => k).join(' + ') || 'no rules';

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    for (const rules of RULE_SETS) {
      it(`makes a ${difficulty} puzzle with exactly one loop, ${named(rules)}`, () => {
        const { rows, cols, keep } = DIFFICULTIES[difficulty];
        const g = { rows, cols };
        for (let run = 0; run < 4; run++) {
          const puzzle = generate(difficulty, rules);
          const { clues, squares, rings, solution } = puzzle;
          expect(clues).toHaveLength(rows * cols);
          expect(solution).toHaveLength(edgeCount(g));
          expect(isSolved(g, puzzle, solution)).toBe(true);
          // Squares only with the rule: both kinds, each kind all on one side of the loop, in cells
          // without a number.
          expect(squares.some((x) => x !== null)).toBe(rules.squares);
          if (rules.squares) {
            const inside = insideCells(g, solution);
            const sideOf = (k: number) => new Set(squares.flatMap((x, i) => (x === k ? [inside[i]] : [])));
            expect(sideOf(LIGHT).size).toBe(1);
            expect(sideOf(DARK).size).toBe(1);
            expect([...sideOf(LIGHT)][0]).not.toBe([...sideOf(DARK)][0]);
            squares.forEach((x, i) => { if (x !== null) expect(clues[i]).toBeNull(); });
          }
          // Rings only with the rule, on dots the loop passes through.
          expect(rings.some(Boolean)).toBe(rules.rings);
          for (let r = 0; r <= rows; r++) {
            for (let c = 0; c <= cols; c++) if (rings[dotIndex(g, r, c)]) expect(dotEdges(g, r, c).filter((e) => solution[e])).toHaveLength(2);
          }
          // Clues match the loop where shown...
          clues.forEach((c, i) => {
            if (c !== null) expect(cellEdges(g, Math.floor(i / cols), i % cols).filter((e) => solution[e]).length).toBe(c);
          });
          // ...enough of them are shown...
          const share = Math.max(0, keep - (rules.squares || rules.rings ? 0.1 : 0));
          const open = rows * cols - squares.filter((x) => x !== null).length;
          expect(clues.filter((c) => c !== null).length).toBeGreaterThanOrEqual(Math.min(Math.round(rows * cols * share), open));
          // ...and they allow only this loop.
          expect(solve(g, puzzle, 2)).toEqual([solution]);
        }
      });
    }
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
  const none = { squares: [null, null, null, null], rings: new Array(9).fill(false) };
  const just = (clues: (number | null)[]) => ({ ...none, clues });
  it('accepts one loop matching the clues', () => {
    expect(isSolved(g, just([2, 2, 2, 2]), lines(ring))).toBe(true);
    expect(isSolved(g, just([2, null, null, 3]), lines(ring))).toBe(false); // clue mismatch
  });
  // A loop around the top-left cell only.
  const small = lines([[[0, 0], [0, 1]], [[0, 1], [1, 1]], [[1, 1], [1, 0]], [[1, 0], [0, 0]]]);
  it('keeps the two kinds of square on opposite sides', () => {
    const clues = [null, null, null, null];
    expect(isSolved(g, { ...none, clues, squares: [LIGHT, DARK, DARK, null] }, small)).toBe(true);
    expect(isSolved(g, { ...none, clues, squares: [LIGHT, LIGHT, null, null] }, small)).toBe(false);
    expect(isSolved(g, { ...none, clues, squares: [LIGHT, null, null, LIGHT] }, small)).toBe(false);
    expect(isSolved(g, { ...none, clues, squares: [null, DARK, LIGHT, null] }, small)).toBe(false);
  });
  it('passes through every ringed dot', () => {
    const clues = [null, null, null, null];
    const rings = none.rings.map((_, d) => d === dotIndex(g, 1, 1));
    expect(isSolved(g, { ...none, clues, rings }, small)).toBe(true);
    expect(isSolved(g, { ...none, clues, rings: none.rings.map((_, d) => d === dotIndex(g, 2, 2)) }, small)).toBe(false);
  });
  it('rejects two loops, and branches', () => {
    const two = lines([[[0, 0], [0, 1]], [[0, 1], [1, 1]], [[1, 1], [1, 0]], [[1, 0], [0, 0]],
      [[1, 1], [1, 2]], [[1, 2], [2, 2]], [[2, 2], [2, 1]], [[2, 1], [1, 1]]]);
    expect(isSolved(g, just([null, null, null, null]), two)).toBe(false);
    const branch = lines([...ring, [[0, 1], [1, 1]]]);
    expect(isSolved(g, just([null, null, null, null]), branch)).toBe(false);
  });
});
