import { describe, expect, it } from 'vitest';
import { isGame, newGame, reducer, type Game } from './game';
import type { Table } from './logic';

const card = (rank: number, suit: number) => suit * 13 + rank - 1;

describe('reducer', () => {
  it('draws from the stock and undoes', () => {
    let g = newGame(1);
    const before = g.table;
    g = reducer(g, { type: 'stock' });
    expect(g.table.waste).toHaveLength(1);
    expect(g.table.stock).toHaveLength(before.stock.length - 1);
    g = reducer(g, { type: 'undo' });
    expect(g.table).toEqual(before);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });

  it('ignores a tap with nowhere to go', () => {
    const g = newGame(3);
    const stuck = g.table.tableau.findIndex((c, col) => {
      const top = c.up.at(-1)!;
      return top % 13 !== 0 && !g.table.tableau.some((d, k) => k !== col && d.up.length && Math.floor(d.up.at(-1)! % 13) === (top % 13) + 1);
    });
    if (stuck >= 0) {
      const index = g.table.tableau[stuck].up.length - 1;
      expect(reducer(g, { type: 'tap', source: { from: 'tableau', col: stuck, index } })).toBe(g);
    }
  });

  it('finishes by itself and is done when everything is up', () => {
    const tableau: Table['tableau'] = Array.from({ length: 7 }, () => ({ down: [], up: [] }));
    for (let s = 0; s < 4; s++) tableau[s].up = Array.from({ length: 12 }, (_, k) => card(13 - k, s)); // K..2
    const table: Table = { stock: [], waste: [], foundations: [0, 0, 0, 0], tableau };
    tableau[4].up = [card(1, 0)];
    tableau[5].up = [card(1, 1)];
    tableau[6].up = [card(1, 2)];
    table.foundations[3] = 1; // ♣ Ace already home
    let g: Game = { draw: 1, table, history: [], moves: 0, done: false };
    expect(isGame(g)).toBe(true);
    g = reducer(g, { type: 'tap', source: { from: 'tableau', col: 4, index: 0 } });
    expect(g.done).toBe(true);
    expect(g.table.foundations).toEqual([13, 13, 13, 13]);
  });
});
