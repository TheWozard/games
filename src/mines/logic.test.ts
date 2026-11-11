import { describe, expect, it } from 'vitest';
import { counts, DENSITIES, mineCount, neighbors, placeMines, SIZES, solvable, type Density, type Size } from './logic';

describe('placeMines', () => {
  for (const size of Object.keys(SIZES) as Size[]) {
    for (const density of Object.keys(DENSITIES) as Density[]) {
      it(`lays out a ${size} board with ${density} mines, clear around the first tap and needing no guessing`, () => {
        const board = SIZES[size];
        const count = mineCount(size, density);
        for (let run = 0; run < 8; run++) {
          const first = Math.floor(Math.random() * board.rows * board.cols);
          const mines = placeMines(board, count, first);
          expect(mines.filter(Boolean).length).toBe(count);
          for (const i of [first, ...neighbors(first, board)]) expect(mines[i]).toBe(false);
          expect(solvable(mines, board, first)).toBe(true);
        }
      });
    }
  }

  it('keeps the old Easy, Medium and Hard mine counts', () => {
    expect([mineCount('small', 'few'), mineCount('medium', 'some'), mineCount('large', 'many')]).toEqual([10, 22, 40]);
  });
});

describe('solvable', () => {
  it('rejects a forced 50/50', () => {
    // 2×4 board, first tap at 4. The clues prove 2 and 6 are mines, but nothing touches 3 or 7,
    // so the last mine could be in either.
    //   . . M M
    //   S . M .
    const board = { rows: 2, cols: 4 };
    const mines = new Array(8).fill(false);
    mines[2] = mines[3] = mines[6] = true;
    expect(solvable(mines, board, 4)).toBe(false);
  });

  it('accepts a board that deduction clears', () => {
    const board = { rows: 3, cols: 3 };
    const mines = new Array(9).fill(false);
    mines[2] = true;
    expect(solvable(mines, board, 6)).toBe(true);
  });
});

describe('counts', () => {
  it('counts neighboring mines', () => {
    const board = { rows: 2, cols: 3 };
    expect(counts([true, false, false, false, false, true], board)).toEqual([0, 2, 1, 1, 2, 0]);
  });
});
