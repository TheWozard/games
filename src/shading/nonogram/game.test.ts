import { describe, expect, it } from 'vitest';
import { CROSS, EMPTY, gameOf, isGame, newGame, reducer, type Game } from './game';
import { generate, NO_RULES } from './logic';

describe('reducer', () => {
  it('paints a stroke as one undo step', () => {
    let g = newGame('easy');
    g = reducer(g, { type: 'paint', indices: [0, 1, 2], value: 1 });
    expect(g.cells.slice(0, 4)).toEqual([1, 1, 1, EMPTY]);
    expect(g.history).toHaveLength(1);
    g = reducer(g, { type: 'paint', indices: [3], value: CROSS });
    expect(g.cells[3]).toBe(CROSS);
    g = reducer(g, { type: 'undo' });
    expect(g.cells.slice(0, 4)).toEqual([1, 1, 1, EMPTY]);
    g = reducer(g, { type: 'undo' });
    expect(g.cells.every((v) => v === EMPTY)).toBe(true);
    expect(reducer(g, { type: 'undo' })).toBe(g);
  });

  it('changes nothing for a stroke that changes nothing', () => {
    const g = reducer(newGame('easy'), { type: 'paint', indices: [0], value: 1 });
    expect(reducer(g, { type: 'paint', indices: [0], value: 1 })).toBe(g);
    expect(reducer(g, { type: 'paint', indices: [], value: CROSS })).toBe(g);
    expect(reducer(g, { type: 'paint', indices: [-1, 999], value: CROSS })).toBe(g);
    expect(reducer(g, { type: 'paint', indices: [1], value: 2 })).toBe(g); // no second color
  });

  it('is done when the solution is shaded, crosses or not, and then stays', () => {
    for (const rules of [NO_RULES, { colors: true, mystery: true }]) {
      const p = generate('medium', rules);
      let g: Game = gameOf('medium', rules, p);
      p.solution.forEach((v, i) => {
        g = reducer(g, { type: 'paint', indices: [i], value: v === 0 ? CROSS : v });
      });
      expect(g.done).toBe(true);
      expect(reducer(g, { type: 'paint', indices: [0], value: EMPTY })).toBe(g);
      expect(reducer(g, { type: 'undo' })).toBe(g);
    }
  });

  it('round-trips through JSON, and rejects saves that don’t fit', () => {
    const g = reducer(newGame('hard', { colors: true, mystery: true }), { type: 'paint', indices: [0], value: 3 });
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
    expect(isGame({ ...g, cells: g.cells.map((v, i) => (i === 0 ? 4 : v)) })).toBe(false);
    expect(isGame({ ...g, size: 10 })).toBe(false);
    expect(isGame({ ...g, rows: g.rows.slice(1) })).toBe(false);
    expect(isGame({ ...g, rules: { colors: false, mystery: true } })).toBe(false); // 3 colors without the rule
    expect(isGame({ ...g, rows: [[{ color: 1, length: 0 }], ...g.rows.slice(1)] })).toBe(false);
    expect(isGame(null)).toBe(false);
  });
});
