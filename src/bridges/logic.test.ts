import { describe, expect, it } from 'vitest';
import { colorsMatch, DIFFICULTIES, edgesOf, generate, GRAY, isSolved, NO_RULES, solve, type Difficulty, type Island, type Rules } from './logic';

const RULE_SETS: Rules[] = [
  NO_RULES,
  { ...NO_RULES, colors: true },
  { ...NO_RULES, blocks: true },
  { ...NO_RULES, diagonals: true },
  { colors: true, blocks: true, diagonals: true },
];
const named = (rules: Rules) => Object.entries(rules).filter(([, on]) => on).map(([k]) => k).join(' + ') || 'no rules';

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    for (const rules of RULE_SETS) {
      it(`makes a valid ${difficulty} puzzle with exactly one solution, ${named(rules)}`, () => {
        const { cols, rows, islands: target } = DIFFICULTIES[difficulty];
        for (let run = 0; run < 4; run++) {
          const { islands, blocks, solution } = generate(difficulty, rules);
          const terrain = { blocks, diagonals: rules.diagonals };
          const { edges, crosses } = edgesOf(islands, cols, rows, terrain);
          expect(islands.length).toBeGreaterThanOrEqual(Math.ceil(Math.round(target * (rules.diagonals ? 0.8 : 1)) * 0.8));
          for (const s of islands) {
            expect(s.r).toBeLessThan(rows);
            expect(s.c).toBeLessThan(cols);
            expect(s.n).toBeGreaterThanOrEqual(1);
            expect(s.n).toBeLessThanOrEqual(8);
          }
          // No two islands side by side.
          for (const s of islands) for (const t of islands) {
            if (s !== t) expect(Math.abs(s.r - t.r) + Math.abs(s.c - t.c)).toBeGreaterThan(1);
          }
          expect(isSolved(islands, edges, crosses, solution)).toBe(true);
          expect(solve(islands, edges, crosses, 2)).toEqual([solution]);

          // Colors: only with the rule, both colors used, and every bridge joins matching islands.
          expect(islands.some((s) => s.color !== undefined)).toBe(rules.colors);
          if (rules.colors) {
            expect(new Set(islands.map((s) => s.color))).toEqual(new Set([GRAY, 1, 2]));
            edges.forEach((e, k) => { if (solution[k]) expect(colorsMatch(islands[e.a], islands[e.b])).toBe(true); });
          }
          // Blocks: only with the rule, never on an island, never under a bridge.
          expect(blocks.length > 0).toBe(rules.blocks);
          const islandCells = new Set(islands.map((s) => s.r * cols + s.c));
          for (const x of blocks) expect(islandCells.has(x)).toBe(false);
          edges.forEach((e) => expect(e.cells.some((x) => blocks.includes(x))).toBe(false));
          // Diagonal bridges only with the rule.
          if (!rules.diagonals) expect(edges.every((e) => e.dr === 0 || e.dc === 0)).toBe(true);
        }
      });
    }
  }

  it('uses diagonal bridges in the answer when they are on, corner to corner and longer', () => {
    let touching = false;
    let longer = false;
    for (let run = 0; run < 20 && !(touching && longer); run++) {
      const { islands, blocks, solution } = generate('medium', { ...NO_RULES, diagonals: true });
      const { edges } = edgesOf(islands, 9, 11, { blocks, diagonals: true });
      edges.forEach((e, k) => {
        if (!solution[k] || e.dr === 0 || e.dc === 0) return;
        if (e.cells.length === 0) touching = true;
        else longer = true;
      });
    }
    expect(touching).toBe(true);
    expect(longer).toBe(true);
  });
});

describe('edgesOf', () => {
  it('stops at blocks, skips mismatched colors, and finds diagonal crossings', () => {
    // 1 . 1
    // . . .
    // 1 . 1
    const islands: Island[] = [{ r: 0, c: 0, n: 1 }, { r: 0, c: 2, n: 1 }, { r: 2, c: 0, n: 1 }, { r: 2, c: 2, n: 1 }];
    expect(edgesOf(islands, 3, 3).edges).toHaveLength(4);
    // A block at the top middle blocks the top pair.
    expect(edgesOf(islands, 3, 3, { blocks: [1], diagonals: false }).edges).toHaveLength(3);
    // Diagonals add the two crossing ones.
    const { edges, crosses } = edgesOf(islands, 3, 3, { blocks: [], diagonals: true });
    expect(edges).toHaveLength(6);
    const diagonal = edges.flatMap((e, k) => (e.dr && e.dc ? [k] : []));
    expect(crosses[diagonal[0]]).toEqual([diagonal[1]]);
    // Colors: red and blue can't join; gray joins either.
    const colored = islands.map((s, k) => ({ ...s, color: [1, 2, GRAY, 1][k] }));
    expect(edgesOf(colored, 3, 3).edges.map((e) => [e.a, e.b])).toEqual([[0, 2], [2, 3]]);
  });

  it('joins islands that touch at a corner diagonally, but never straight', () => {
    // 1 1 .     side by side: no bridge between (0,0) and (0,1)
    // . 1 .     corner to corner (0,0)–(1,1): a diagonal bridge; (0,1) and (1,1) are side by side
    const islands: Island[] = [{ r: 0, c: 0, n: 1 }, { r: 0, c: 1, n: 1 }, { r: 1, c: 1, n: 1 }];
    expect(edgesOf(islands, 3, 2).edges).toEqual([]);
    expect(edgesOf(islands, 3, 2, { blocks: [], diagonals: true }).edges.map((e) => [e.a, e.b])).toEqual([[0, 2]]);
    // Two corner-to-corner bridges in a 2×2 square cross.
    const square: Island[] = [{ r: 0, c: 0, n: 1 }, { r: 0, c: 1, n: 1 }, { r: 1, c: 0, n: 1 }, { r: 1, c: 1, n: 1 }];
    const { edges, crosses } = edgesOf(square, 2, 2, { blocks: [], diagonals: true });
    expect(edges.map((e) => [e.a, e.b])).toEqual([[0, 3], [1, 2]]);
    expect(crosses).toEqual([[1], [0]]);
  });

  it('counts diagonals crossing between cells', () => {
    // Two diagonal bridges that cross at a corner point, not on a cell.
    // 1 . . .      (0,0)→(2,2) and (0,3)→(3,0) cross at (1.5, 1.5)
    const islands: Island[] = [{ r: 0, c: 0, n: 1 }, { r: 2, c: 2, n: 1 }, { r: 0, c: 3, n: 1 }, { r: 3, c: 0, n: 1 }];
    const { edges, crosses } = edgesOf(islands, 4, 4, { blocks: [], diagonals: true });
    const k = edges.findIndex((e) => e.a === 0 && e.b === 1);
    const j = edges.findIndex((e) => e.a === 2 && e.b === 3);
    expect(crosses[k]).toContain(j);
  });
});

describe('solve', () => {
  it('finds both answers to an ambiguous square', () => {
    // 3 . 3
    // . . .
    // 3 . 3   each side 1 or 2 bridges, alternating: two valid answers.
    const islands = [{ r: 0, c: 0, n: 3 }, { r: 0, c: 2, n: 3 }, { r: 2, c: 0, n: 3 }, { r: 2, c: 2, n: 3 }];
    const { edges, crosses } = edgesOf(islands, 3, 3);
    expect(solve(islands, edges, crosses, 5)).toHaveLength(2);
  });

  it('rejects answers that leave islands cut off', () => {
    // 2 . 2      two double bridges would satisfy the numbers but split the islands in two;
    // . . .      only the ring of single bridges keeps everything connected.
    // 2 . 2
    const islands = [{ r: 0, c: 0, n: 2 }, { r: 0, c: 2, n: 2 }, { r: 2, c: 0, n: 2 }, { r: 2, c: 2, n: 2 }];
    const { edges, crosses } = edgesOf(islands, 3, 3);
    expect(solve(islands, edges, crosses, 5)).toEqual([[1, 1, 1, 1]]);
  });

  it('never lets bridges cross', () => {
    //   . 1 .
    //   1 . 1    the only bridges available cross in the middle, so there is no answer.
    //   . 1 .
    const islands = [{ r: 0, c: 1, n: 1 }, { r: 1, c: 0, n: 1 }, { r: 1, c: 2, n: 1 }, { r: 2, c: 1, n: 1 }];
    const { edges, crosses } = edgesOf(islands, 3, 3);
    expect(crosses.some((x) => x.length > 0)).toBe(true);
    expect(solve(islands, edges, crosses, 5)).toEqual([]);
  });
});
