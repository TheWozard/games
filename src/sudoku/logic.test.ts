import { describe, expect, it } from 'vitest';
import { countSolutions, DIFFICULTIES, formatTime, generate, PEERS, type Difficulty } from './logic';

function isValidSolution(grid: number[]): boolean {
  return grid.every((v, i) => v >= 1 && v <= 9 && PEERS[i].every((p) => grid[p] !== v));
}

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`makes a ${difficulty} puzzle with exactly one solution`, () => {
      const { puzzle, solution } = generate(difficulty);
      expect(isValidSolution(solution)).toBe(true);
      puzzle.forEach((v, i) => { if (v) expect(v).toBe(solution[i]); });
      expect(puzzle.filter(Boolean).length).toBeGreaterThanOrEqual(DIFFICULTIES[difficulty].clues);
      expect(countSolutions(puzzle.slice(), 2)).toBe(1);
    });
  }
});

describe('PEERS', () => {
  it('gives every cell 20 peers', () => {
    expect(PEERS.every((p) => p.length === 20)).toBe(true);
  });
});

describe('formatTime', () => {
  it('formats minutes and hours', () => {
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(125)).toBe('2:05');
    expect(formatTime(3725)).toBe('1:02:05');
  });
});
