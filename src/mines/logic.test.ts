import { describe, expect, it } from 'vitest';
import { counts, DIFFICULTIES, neighbors, placeMines, solvable, type Difficulty } from './logic';

describe('placeMines', () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`lays out a ${difficulty} board that is clear around the first tap and needs no guessing`, () => {
      const board = DIFFICULTIES[difficulty];
      for (let run = 0; run < 20; run++) {
        const first = Math.floor(Math.random() * board.rows * board.cols);
        const mines = placeMines(board, board.mines, first);
        expect(mines.filter(Boolean).length).toBe(board.mines);
        for (const i of [first, ...neighbors(first, board)]) expect(mines[i]).toBe(false);
        expect(solvable(mines, board, first)).toBe(true);
      }
    });
  }
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
