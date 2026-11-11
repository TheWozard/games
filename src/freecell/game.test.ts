import { describe, expect, it } from 'vitest';
import { isGame, newGame, reducer, type Game } from './game';
import { bestTarget, solve, type Source } from './logic';

/** Some move a tap would make, if any. */
function someTap(g: Game): Source | null {
  for (let col = 0; col < 8; col++) {
    const n = g.table.columns[col].length;
    const s: Source = { from: 'column', col, index: n - 1 };
    if (n && bestTarget(g.table, s)) return s;
  }
  return null;
}

describe('reducer', () => {
  it('taps, undoes, and returns the same game when nothing moves', () => {
    let g = newGame('classic');
    const s = someTap(g)!;
    expect(s).not.toBeNull();
    const before = g.table;
    g = reducer(g, { type: 'tap', source: s });
    expect(g.table).not.toBe(before);
    expect(g.history).toHaveLength(1);
    g = reducer(g, { type: 'undo' });
    expect(g.table).toBe(before);
    expect(reducer(g, { type: 'undo' })).toBe(g);
    expect(reducer(g, { type: 'move', source: { from: 'cell', i: 0 }, target: { to: 'foundation' } })).toBe(g); // empty cell
  });

  it('plays a whole game to a win with the solver’s moves, then ignores moves', () => {
    let g = newGame('harder');
    expect(g.table.cells).toHaveLength(3);
    for (const [source, target] of solve(g.table)!) g = reducer(g, { type: 'move', source, target });
    expect(g.done).toBe(true);
    expect(g.table.foundations).toEqual([13, 13, 13, 13]);
    expect(reducer(g, { type: 'undo' })).toBe(g);
  });

  it('round-trips through JSON, and rejects other shapes', () => {
    const g = newGame('expert');
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
    expect(isGame({ ...g, difficulty: 'easy' })).toBe(false);
    expect(isGame({ ...g, table: { ...g.table, cells: [null, null, null, null] } })).toBe(false); // expert has two
    expect(isGame({ ...g, table: { ...g.table, columns: g.table.columns.slice(1) } })).toBe(false);
    expect(isGame(null)).toBe(false);
  });
});
