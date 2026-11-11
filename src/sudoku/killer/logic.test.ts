import { describe, expect, it } from 'vitest';
import { PEERS, solvedGrid } from '../classic/logic';
import { cageSatisfied, combinations, DIFFICULTIES, generate, solve, type Difficulty } from './logic';

const orthogonal = (a: number, b: number) =>
  (Math.abs(a - b) === 9) || (Math.abs(a - b) === 1 && Math.floor(a / 9) === Math.floor(b / 9));

function connected(cells: number[]): boolean {
  const seen = new Set([cells[0]]);
  const queue = [cells[0]];
  for (let k = 0; k < queue.length; k++) {
    for (const j of cells) if (!seen.has(j) && orthogonal(queue[k], j)) { seen.add(j); queue.push(j); }
  }
  return seen.size === cells.length;
}

describe('generate', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`makes a valid ${difficulty} puzzle with exactly one solution`, () => {
      for (let run = 0; run < 5; run++) {
        const { cages, puzzle, solution } = generate(difficulty);
        expect(solution.every((v, i) => v >= 1 && v <= 9 && PEERS[i].every((p) => solution[p] !== v))).toBe(true);
        expect(cages.flatMap((c) => c.cells).sort((a, b) => a - b)).toEqual([...Array(81).keys()]);
        for (const c of cages) {
          expect(connected(c.cells)).toBe(true);
          expect(cageSatisfied(c.sum, c.cells.map((i) => solution[i]))).toBe(true);
          if (c.cells.length === 1) expect(puzzle[c.cells[0]]).toBe(c.sum);
        }
        puzzle.forEach((v, i) => { if (v) expect(v).toBe(solution[i]); });
        expect(puzzle.filter(Boolean).length).toBeGreaterThanOrEqual(DIFFICULTIES[difficulty].extra);
        expect(solve(cages, puzzle, 2)).toEqual([solution]);
      }
    });
  }
});

describe('solve', () => {
  it('finds both solutions when cages leave it ambiguous', () => {
    // In a solved grid, find a rectangle (two rows of one band, two columns) holding x y / y x:
    // swapping it gives another valid grid. Cage each row's pair together and everything else
    // alone, and the sums can't tell the two grids apart.
    expect.hasAssertions();
    for (let attempt = 0; attempt < 50; attempt++) {
      const solution = solvedGrid();
      for (let r1 = 0; r1 < 9; r1++) for (let r2 = r1 + 1; r2 < 9; r2++) {
        if (Math.floor(r1 / 3) !== Math.floor(r2 / 3)) continue;
        for (let c1 = 0; c1 < 9; c1++) for (let c2 = c1 + 1; c2 < 9; c2++) {
          const [a, b, c, d] = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
          if (solution[a] !== solution[d] || solution[b] !== solution[c]) continue;
          const rect = new Set([a, b, c, d]);
          const cages = [
            { cells: [a, b], sum: solution[a] + solution[b] },
            { cells: [c, d], sum: solution[c] + solution[d] },
            ...[...Array(81).keys()].filter((i) => !rect.has(i)).map((i) => ({ cells: [i], sum: solution[i] })),
          ];
          expect(solve(cages, new Array(81).fill(0), 2)?.length).toBe(2);
          return;
        }
      }
    }
  });
});

describe('combinations', () => {
  it('lists the digit sets for a cage', () => {
    expect(combinations(2, 3)).toEqual([[1, 2]]);
    expect(combinations(3, 24)).toEqual([[7, 8, 9]]);
    expect(combinations(2, 10)).toHaveLength(4);
    expect(combinations(9, 45)).toEqual([[1, 2, 3, 4, 5, 6, 7, 8, 9]]);
  });

  it('cageSatisfied needs the sum and no repeats', () => {
    expect(cageSatisfied(10, [1, 9])).toBe(true);
    expect(cageSatisfied(10, [5, 5])).toBe(false);
    expect(cageSatisfied(10, [2, 9])).toBe(false);
  });
});
