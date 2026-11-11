import { describe, expect, it } from 'vitest';
import { BOXES, geometry, grade } from '../classic/grade';
import { countSolutions } from '../classic/logic';
import { connected, DIFFICULTIES, fill, generate, hasStraightRegion, randomRegions, type Difficulty } from './logic';

/** Every row, column and region holds 1–9 once. */
function fits(grid: readonly number[], regions: readonly number[]): boolean {
  return geometry(regions).units.every((u) => new Set(u.map((i) => grid[i])).size === 9 && u.every((i) => grid[i] >= 1 && grid[i] <= 9));
}

describe('randomRegions', () => {
  it('makes nine connected regions of nine cells, well away from the boxes', () => {
    for (let run = 0; run < 20; run++) {
      const regions = randomRegions();
      for (let k = 0; k < 9; k++) {
        expect(regions.filter((r) => r === k)).toHaveLength(9);
        expect(connected(regions, k)).toBe(true);
      }
      expect(regions.filter((r, i) => r !== BOXES[i]).length).toBeGreaterThanOrEqual(12);
    }
  });

  it('spots a region that is just a row or a column', () => {
    expect(hasStraightRegion(BOXES)).toBe(false);
    expect(hasStraightRegion(Array.from({ length: 81 }, (_, i) => Math.floor(i / 9)))).toBe(true);
    expect(hasStraightRegion(Array.from({ length: 81 }, (_, i) => i % 9))).toBe(true);
  });
});

describe('fill', () => {
  it('fills a layout completely and correctly, or gives up', () => {
    expect.hasAssertions();
    let filled = 0;
    for (let run = 0; run < 40 || filled === 0; run++) {
      const regions = randomRegions();
      const grid = fill(geometry(regions), Math.random, 200);
      if (!grid) continue;
      filled++;
      expect(fits(grid, regions)).toBe(true);
    }
    expect(fits(fill(geometry(BOXES), Math.random, Infinity)!, BOXES)).toBe(true);
  });
});

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`makes ${difficulty} puzzles with exactly one solution, needing ${difficulty}'s techniques`, () => {
      const { tier, clues } = DIFFICULTIES[difficulty];
      for (let run = 0; run < 4; run++) {
        const { regions, puzzle, solution } = generate(difficulty);
        expect(hasStraightRegion(regions)).toBe(false);
        expect(fits(solution, regions)).toBe(true);
        puzzle.forEach((v, i) => { if (v) expect(v).toBe(solution[i]); });
        expect(puzzle.filter(Boolean).length).toBeGreaterThanOrEqual(clues);
        expect(countSolutions(puzzle.slice(), 2, geometry(regions).peers)).toBe(1);
        expect(grade(puzzle, 3, regions)).toBe(tier);
      }
    });
  }
});
