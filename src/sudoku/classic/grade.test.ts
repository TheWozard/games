import { describe, expect, it } from 'vitest';
import { grade, MAX_TIER, solve } from './grade';
import { countSolutions, solvedGrid } from './logic';

/** A puzzle with as few givens as uniqueness allows, judged by brute force (not by the grader). */
function minimal(): { puzzle: number[]; solution: number[] } {
  const solution = solvedGrid();
  const puzzle = solution.slice();
  const order = [...Array(81).keys()].sort(() => Math.random() - 0.5);
  for (const i of order) {
    const v = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle, 2) !== 1) puzzle[i] = v;
  }
  return { puzzle, solution };
}

describe('solve', () => {
  it('only ever reaches the real solution, and grades by the hardest tier it needs', () => {
    expect.hasAssertions();
    // Minimal puzzles are the hardest kind, so these exercise every tier, and some go beyond them.
    // Only about one in 25 needs tier 3, so keep going until every tier has come up.
    const seen = new Set<number>();
    for (let run = 0; run < 40 || seen.size < MAX_TIER; run++) {
      const { puzzle, solution } = minimal();
      const result = solve(puzzle);
      if (!result) continue;
      expect(result.grid).toEqual(solution);
      seen.add(result.tier);
      // Fewer techniques than it needs can't solve it; more give the same answer.
      for (let t = 1; t < result.tier; t++) expect(solve(puzzle, t)).toBeNull();
      expect(grade(puzzle, result.tier)).toBe(result.tier);
    }
  });

  it('rates a grid missing one digit as singles, and never guesses', () => {
    const grid = solvedGrid();
    const one = grid.slice();
    one[40] = 0;
    expect(solve(one)).toEqual({ tier: 1, grid });
    expect(grade(new Array(81).fill(0))).toBe(0);
    // One given fewer than a minimal puzzle: more than one solution, so no sound technique finishes it.
    for (let run = 0; run < 10; run++) {
      const { puzzle } = minimal();
      const under = puzzle.slice();
      under[under.findIndex(Boolean)] = 0;
      expect(countSolutions(under.slice(), 2)).toBe(2);
      expect(grade(under)).toBe(0);
    }
  });
});
