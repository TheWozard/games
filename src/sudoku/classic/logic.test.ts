import { describe, expect, it } from 'vitest';
import { grade } from './grade';
import { countSolutions, DIFFICULTIES, generate, PEERS, type Difficulty } from './logic';

function isValidSolution(grid: number[]): boolean {
  return grid.every((v, i) => v >= 1 && v <= 9 && PEERS[i].every((p) => grid[p] !== v));
}

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`makes ${difficulty} puzzles with exactly one solution, needing ${difficulty}'s techniques`, () => {
      const { tier, clues } = DIFFICULTIES[difficulty];
      for (let run = 0; run < 5; run++) {
        const { puzzle, solution } = generate(difficulty);
        expect(isValidSolution(solution)).toBe(true);
        puzzle.forEach((v, i) => { if (v) expect(v).toBe(solution[i]); });
        expect(puzzle.filter(Boolean).length).toBeGreaterThanOrEqual(clues);
        expect(countSolutions(puzzle.slice(), 2)).toBe(1);
        expect(grade(puzzle)).toBe(tier);
      }
    });
  }
});

describe('PEERS', () => {
  it('gives every cell 20 peers', () => {
    expect(PEERS.every((p) => p.length === 20)).toBe(true);
  });
});
