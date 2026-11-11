import { describe, expect, it } from 'vitest';
import {
  autoplay, bestTarget, canMove, capacity, deal, DIFFICULTIES, isWon, lifted, move, runStart, solve, winnableDeal,
  type Table,
} from './logic';

// Cards by name: rank then suit letter (S H D C), e.g. '7H', 'KS', 'AC'.
const SUIT = 'SHDC';
const RANK = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const c = (name: string) => SUIT.indexOf(name.at(-1)!) * 13 + RANK.indexOf(name.slice(0, -1));
const cards = (names: string) => (names ? names.split(' ').map(c) : []);

/** A table with only the cards given (the rest notionally elsewhere): enough for move rules. */
function table(columns: string[], cells: (string | null)[] = [null, null, null, null], foundations = [0, 0, 0, 0]): Table {
  return {
    columns: [...columns, ...Array(8 - columns.length).fill('')].map(cards),
    cells: cells.map((n) => (n === null ? null : c(n))),
    foundations,
  };
}

describe('deal', () => {
  it('deals all 52 cards face up into eight columns of 7 and 6', () => {
    const t = deal(4);
    expect(t.columns.map((col) => col.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]);
    expect(new Set(t.columns.flat()).size).toBe(52);
    expect(t.cells).toEqual([null, null, null, null]);
  });

  for (const [difficulty, { cells }] of Object.entries(DIFFICULTIES)) {
    it(`deals ${difficulty} games (${cells} free cells) that the solver's own moves win`, () => {
      for (let run = 0; run < 4; run++) {
        const start = winnableDeal(cells);
        expect(start.cells).toHaveLength(cells);
        const moves = solve(start)!;
        expect(moves).not.toBeNull();
        // Replay the solution under the game's own rules: every move legal, ending in a win.
        let t = autoplay(start);
        for (const [s, d] of moves) {
          expect(canMove(t, s, d)).toBe(true);
          t = autoplay(move(t, s, d));
        }
        expect(isWon(t)).toBe(true);
      }
    });
  }
});

describe('moves', () => {
  it('finds the run at the bottom of a column', () => {
    expect(runStart(cards('KS 9H 8S 7D'))).toBe(1);
    expect(runStart(cards('9H 9S'))).toBe(1);
    expect(runStart(cards('5C'))).toBe(0);
    expect(lifted(table(['KS 9H 8S 7D']), { from: 'column', col: 0, index: 0 })).toBeNull(); // not one run
    expect(lifted(table(['KS 9H 8S 7D']), { from: 'column', col: 0, index: 2 })).toEqual(cards('8S 7D'));
  });

  it('moves as many cards as the free cells and empty columns allow', () => {
    // 4 free cells, 2 empty columns besides the two used: (4 + 1) × 2² = 20.
    const t = table(['KS 9H 8S 7D', '10C', '2D', '3D', '4D', '5D'], [null, null, null, null]);
    expect(capacity(t, false)).toBe(20);
    expect(capacity(t, true)).toBe(10);
    const full = table(['10C', '9H 8S 7D 6H 5S', '2D', '3D', '4D', '5D', '6D', '7C'], ['AS', 'AH', 'AD', null]);
    expect(capacity(full, false)).toBe(2);
    expect(canMove(full, { from: 'column', col: 1, index: 0 }, { to: 'column', col: 0 })).toBe(false); // five cards, room for two
    expect(canMove(full, { from: 'column', col: 1, index: 3 }, { to: 'column', col: 7 })).toBe(true); // 6H 5S onto 7C
  });

  it('builds down in alternating colors, and anything goes in an empty column', () => {
    const t = table(['9S', '8H', '8C', 'KD']);
    expect(canMove(t, { from: 'column', col: 1, index: 0 }, { to: 'column', col: 0 })).toBe(true);
    expect(canMove(t, { from: 'column', col: 2, index: 0 }, { to: 'column', col: 0 })).toBe(false); // same color
    expect(canMove(t, { from: 'column', col: 3, index: 0 }, { to: 'column', col: 5 })).toBe(true);
    expect(canMove(t, { from: 'column', col: 3, index: 0 }, { to: 'cell', i: 0 })).toBe(true);
    expect(canMove(t, { from: 'column', col: 3, index: 0 }, { to: 'foundation' })).toBe(false);
  });

  it('sends a tapped card to the foundation, then a column, then a free cell, then an empty column', () => {
    const t = table(['AH', '9S', '8H', '5C', '4D', '3S', '2H', '6C'], ['QD', null, null, null]);
    expect(bestTarget(t, { from: 'column', col: 0, index: 0 })).toEqual({ to: 'foundation' });
    expect(bestTarget(t, { from: 'column', col: 2, index: 0 })).toEqual({ to: 'column', col: 1 });
    expect(bestTarget(t, { from: 'column', col: 1, index: 0 })).toEqual({ to: 'cell', i: 1 });
    // The Queen in a cell has no column to go to, and none is empty.
    expect(bestTarget(t, { from: 'cell', i: 0 })).toBeNull();
    const roomy = table(['9S', 'KD 7C'], ['QD', 'JD', '10D', '8D']);
    expect(bestTarget(roomy, { from: 'column', col: 1, index: 1 })).toEqual({ to: 'column', col: 2 });
    expect(bestTarget(roomy, { from: 'column', col: 0, index: 0 })).toBeNull(); // a whole column: nowhere better
  });

  it('puts up only the cards that are safe to', () => {
    // 2♠ is always safe, and so is the A♦ in a free cell; 3♥ isn't while the clubs haven't started.
    const t = autoplay(table(['3H', '2S'], ['AD', null, null, null], [1, 2, 0, 0]));
    expect(t.foundations).toEqual([2, 2, 1, 0]);
    expect(t.columns[0]).toEqual(cards('3H'));
    expect(t.cells).toEqual([null, null, null, null]);
  });
});
