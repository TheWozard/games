import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, generate, isSlow, NO_RULES, plainBoard, RULES, type Board, type Difficulty, type Rules } from './logic';
import { countSolutions } from './solve';

const board = (size: number, extra: Partial<Board> = {}): Board => ({ ...plainBoard(size), ...extra });

describe('countSolutions', () => {
  it('counts small puzzles exactly', () => {
    // 2×2, one color from corner to neighboring corner: only round the other two squares.
    expect(countSolutions([[0, 1]], board(2), 10)).toBe(1);
    expect(countSolutions([[0, 1], [2, 3]], board(2), 10)).toBe(1);
    // 3×3, corner to opposite corner: two ways to snake through all nine squares.
    expect(countSolutions([[0, 8]], board(3), 10)).toBe(2);
    // Corner to a neighbor of the opposite corner: an even/odd coloring rules it out.
    expect(countSolutions([[0, 7]], board(3), 10)).toBe(0);
    // Not every square can be reached: no solution.
    expect(countSolutions([[0, 1], [3, 4]], board(3), 10)).toBe(0);
  });

  it('stops at the limit', () => {
    // 4×4, corner to corner along one edge: many ways (opposite corners have none: same checkerboard color).
    expect(countSolutions([[0, 3]], board(4), 2)).toBe(2);
    expect(countSolutions([[0, 3]], board(4), 1)).toBe(1);
    expect(countSolutions([[0, 15]], board(4), 2)).toBe(0);
  });

  it('gives up (null) when the budget runs out', () => {
    expect(countSolutions([[0, 3]], board(4), 1000, 3)).toBeNull();
  });

  it('respects walls, holes and wrapping', () => {
    // 3×3 corner to corner with the wall that one snake needs: one way left.
    expect(countSolutions([[0, 8]], board(3, { walls: [[0, 1]] }), 10)).toBe(1);
    // A hole in the middle of 3×3: the ring, one way round from 0 to its neighbor 1.
    expect(countSolutions([[0, 1]], board(3, { holes: [4] }), 10)).toBe(1);
    // Wrapping joins the edges, so the same dots can be joined more ways.
    const flat = countSolutions([[0, 2]], board(3), 100)!;
    const wrapped = countSolutions([[0, 2]], board(3, { wrap: true }), 100)!;
    expect(wrapped).toBeGreaterThan(flat);
  });

  it('crosses a bridge straight, each way by a different color', () => {
    // A plus shape: corners are holes, the center a bridge.
    const plus = board(3, { holes: [0, 2, 6, 8], bridges: [4] });
    expect(countSolutions([[3, 5], [1, 7]], plus, 10)).toBe(1);
    // Turning on the bridge isn't allowed.
    expect(countSolutions([[3, 1], [5, 7]], plus, 10)).toBe(0);
    // One color can't use both ways.
    expect(countSolutions([[3, 5]], board(3, { holes: [0, 2, 6, 8], bridges: [4] }), 10)).toBe(0);
  });

  it('finds exactly one answer for generated puzzles', () => {
    const combos: Rules[] = [NO_RULES, ...(Object.keys(RULES) as (keyof Rules)[]).map((r) => ({ ...NO_RULES, [r]: true }))];
    for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
      for (const rules of combos) {
        if (isSlow(difficulty, rules)) continue; // covered by logic.test.ts
        const { dots, board } = generate(difficulty, rules);
        expect(countSolutions(dots, board, 2)).toBe(1);
      }
    }
  });
});
