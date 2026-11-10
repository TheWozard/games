import { describe, expect, it } from 'vitest';
import { isGame, newGame, reducer, type Game } from './game';

/** Puts each tile home with as few swaps as it takes. */
function solve(g: Game): Game {
  for (let pos = 0; pos < g.order.length; pos++) {
    if (g.order[pos] !== pos) g = reducer(g, { type: 'swap', from: pos, to: g.order.indexOf(pos) });
  }
  return g;
}

describe('reducer', () => {
  it('swaps two tapped tiles and undoes the swap', () => {
    let g = newGame('medium');
    const loose = g.fixed.flatMap((f, i) => (f ? [] : [i]));
    const [a, b] = loose;
    const before = g.order;
    g = reducer(g, { type: 'tap', pos: a });
    expect(g.selected).toBe(a);
    g = reducer(g, { type: 'tap', pos: b });
    expect(g.selected).toBeNull();
    expect(g.order[a]).toBe(before[b]);
    expect(g.order[b]).toBe(before[a]);
    g = reducer(g, { type: 'undo' });
    expect(g.order).toEqual(before);
  });

  it('never moves a fixed tile', () => {
    const g = newGame('easy');
    const fixed = g.fixed.indexOf(true);
    const loose = g.fixed.indexOf(false);
    expect(reducer(g, { type: 'tap', pos: fixed })).toBe(g);
    expect(reducer(g, { type: 'swap', from: fixed, to: loose })).toBe(g);
  });

  it('is done once every tile is home, and round-trips through JSON', () => {
    const g = solve(newGame('hard'));
    expect(g.done).toBe(true);
    expect(reducer(g, { type: 'undo' })).toBe(g);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });
});
