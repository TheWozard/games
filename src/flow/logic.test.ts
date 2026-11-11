import { describe, expect, it } from 'vitest';
import {
  adjacent, connected, DIFFICULTIES, extend, generate, isBridge, isHole, isSolved, NO_RULES, plainBoard, settle, startStroke,
  type Board, type Difficulty, type Rules,
} from './logic';

const RULE_SETS: Rules[] = [
  NO_RULES,
  { ...NO_RULES, walls: true },
  { ...NO_RULES, holes: true },
  { ...NO_RULES, wrap: true },
  { ...NO_RULES, bridges: true },
  { walls: true, holes: true, wrap: true, bridges: true },
];
const named = (rules: Rules) => Object.entries(rules).filter(([, on]) => on).map(([k]) => k).join(' + ') || 'no rules';

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    for (const rules of RULE_SETS) {
      it(`makes a ${difficulty} puzzle whose own paths solve it, ${named(rules)}`, () => {
        const { size, colors } = DIFFICULTIES[difficulty];
        for (let run = 0; run < 4; run++) {
          const { dots, solution, board } = generate(difficulty, rules);
          expect(board.size).toBe(size);
          expect(dots).toHaveLength(colors);
          expect(new Set(dots.flat()).size).toBe(colors * 2);
          for (const p of solution) {
            expect(p.length).toBeGreaterThanOrEqual(3);
            for (let k = 1; k < p.length; k++) expect(adjacent(p[k - 1], p[k], board)).toBe(true);
          }
          expect(isSolved(dots, solution, board)).toBe(true);
          // Each rule's feature appears only with the rule.
          expect(board.wrap).toBe(rules.wrap);
          expect(board.holes.length > 0).toBe(rules.holes);
          expect(board.walls.length > 0).toBe(rules.walls);
          expect(board.bridges.length > 0).toBe(rules.bridges);
          // No dot on a hole or a bridge, and no wall on an edge the answer uses.
          for (const cell of dots.flat()) expect(isHole(cell, board) || isBridge(cell, board)).toBe(false);
          const used = new Set(solution.flatMap((p) => p.slice(1).map((c, k) => [p[k], c].sort((a, b) => a - b).join())));
          for (const [a, b] of board.walls) expect(used.has([a, b].sort((x, y) => x - y).join())).toBe(false);
        }
      });
    }
  }
});

describe('drawing', () => {
  // 3×3: red joins 0 → 2 along the top, blue joins 6 → 8 along the bottom.
  const board = plainBoard(3);
  const dots: [number, number][] = [[0, 2], [6, 8]];

  it('starts from a dot, extends, retraces, and stops at the other dot', () => {
    let { color, paths } = startStroke(dots, [[], []], 0, board);
    expect(color).toBe(0);
    paths = extend(dots, paths, 0, 1, board);
    paths = extend(dots, paths, 0, 4, board);
    expect(paths[0]).toEqual([0, 1, 4]);
    paths = extend(dots, paths, 0, 1, board); // back over itself
    expect(paths[0]).toEqual([0, 1]);
    paths = extend(dots, paths, 0, 2, board);
    expect(connected(dots, paths, 0)).toBe(true);
    expect(extend(dots, paths, 0, 5, board)).toBe(paths); // finished: won't go past
    expect(extend(dots, [[0], []], 0, 4, board)).toEqual([[0], []]); // not adjacent: ignored
  });

  it('is blocked by another color’s dot or path, leaving that color alone', () => {
    let paths = [[0, 3], []];
    expect(extend(dots, paths, 0, 6, board)).toBe(paths); // blue's dot
    paths = extend(dots, [[0], [6, 7, 4, 5, 8]], 0, 1, board);
    const blocked = extend(dots, paths, 0, 4, board); // blue's path at 4
    expect(blocked).toBe(paths);
    expect(blocked[1]).toEqual([6, 7, 4, 5, 8]);
  });

  it('restarts from a dot, or cuts back to a tapped point on a path', () => {
    const paths = [[0, 1, 4], []];
    expect(startStroke(dots, paths, 0, board)).toEqual({ color: 0, paths: [[0], []] });
    expect(startStroke(dots, paths, 1, board)).toEqual({ color: 0, paths: [[0, 1], []] });
    expect(startStroke(dots, paths, 5, board).color).toBe(-1);
  });

  it('needs every square filled to be solved', () => {
    expect(isSolved(dots, [[0, 1, 2], [6, 7, 8]], board)).toBe(false); // middle row empty
    expect(isSolved(dots, [[0, 1, 2], [6, 3, 4, 5, 8]], board)).toBe(false); // 7 empty
    expect(isSolved(dots, [[0, 1, 2], [6, 3, 4, 7, 8]], board)).toBe(false); // 5 empty
    expect(isSolved(dots, [[0, 1, 2], [6, 3, 4, 5, 8]], board)).toBe(false); // 7 still empty
    expect(isSolved(dots, [[0, 1, 2], [6, 7, 4, 3, 4]], board)).toBe(false); // not joined
  });
});

describe('rules', () => {
  it('walls block a step between two squares', () => {
    const board: Board = { ...plainBoard(3), walls: [[0, 1]] };
    expect(adjacent(0, 1, board)).toBe(false);
    expect(adjacent(1, 0, board)).toBe(false);
    expect(extend([[0, 2]], [[0]], 0, 1, board)).toEqual([[0]]);
    expect(extend([[0, 2]], [[0]], 0, 3, board)).toEqual([[0, 3]]);
  });

  it('holes are skipped and need no filling', () => {
    // 2×2 with a hole at 3: red runs 1 → 0 → 2 around it.
    const board: Board = { ...plainBoard(2), holes: [3] };
    expect(adjacent(1, 3, board)).toBe(false);
    expect(isSolved([[1, 2]], [[1, 0, 2]], board)).toBe(true);
    expect(isSolved([[1, 2]], [[1, 3, 2]], board)).toBe(false);
  });

  it('wrapping joins opposite edges', () => {
    const board: Board = { ...plainBoard(3), wrap: true };
    expect(adjacent(0, 2, board)).toBe(true); // left edge to right edge
    expect(adjacent(0, 6, board)).toBe(true); // top to bottom
    expect(adjacent(0, 2, plainBoard(3))).toBe(false);
    expect(extend([[0, 1]], [[0]], 0, 2, board)).toEqual([[0, 2]]);
  });

  it('bridges carry one path across and one down, straight through', () => {
    // 3×3 with a bridge in the middle: red 3 → 5 across it, blue 1 → 7 down it.
    const board: Board = { ...plainBoard(3), bridges: [4] };
    const dots: [number, number][] = [[3, 5], [1, 7]];
    let paths = [[3], [1]];
    paths = extend(dots, paths, 0, 4, board); // red onto the bridge, going across
    paths = extend(dots, paths, 1, 4, board); // blue onto it too, going down
    expect(paths).toEqual([[3, 4], [1, 4]]);
    expect(extend(dots, paths, 0, 7, board)).toBe(paths); // red can't turn on the bridge
    paths = extend(dots, paths, 0, 5, board);
    paths = extend(dots, paths, 1, 7, board);
    expect(paths).toEqual([[3, 4, 5], [1, 4, 7]]);
    // A second path the same way is blocked, and a stroke can't start on a bridge.
    expect(extend([[3, 5], [1, 7], [0, 2]], [[3, 4], [], [5]], 2, 4, board)).toEqual([[3, 4], [], [5]]);
    expect(startStroke(dots, paths, 4, board).color).toBe(-1);
  });

  it('carries a path let go on a bridge on through it, or back off it if the way on is taken', () => {
    const board: Board = { ...plainBoard(3), bridges: [4] };
    const dots: [number, number][] = [[3, 5], [1, 7], [2, 8]];
    expect(settle(dots, [[3, 4], [], []], 0, board)).toEqual([[3, 4, 5], [], []]); // on to red's own dot
    const blocked = [[3, 4], [], [8, 5]]; // yellow is in the way at 5
    expect(settle(dots, blocked, 0, board)).toEqual([[3], [], [8, 5]]);
    const off = [[3], [], []]; // not on a bridge: left alone
    expect(settle(dots, off, 0, board)).toBe(off);
  });

  it('counts a bridge filled only when one path crosses it each way', () => {
    // The same, with the corners as holes so the two paths fill the board.
    const board: Board = { ...plainBoard(3), bridges: [4], holes: [0, 2, 6, 8] };
    const dots: [number, number][] = [[3, 5], [1, 7]];
    expect(isSolved(dots, [[3, 4, 5], [1, 4, 7]], board)).toBe(true);
    expect(isSolved(dots, [[3, 4, 5], [1, 7]], board)).toBe(false); // crossed only once
  });
});
