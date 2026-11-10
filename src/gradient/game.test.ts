import { describe, expect, it } from 'vitest';
import { describe as label, fromSaved, isGame, lines, newGame, reducer, type Game } from './game';

/** Puts each tile home with as few swaps as it takes. */
function solve(g: Game): Game {
  for (let pos = 0; pos < g.order.length; pos++) {
    if (g.order[pos] !== pos) g = reducer(g, { type: 'swap', from: pos, to: g.order.indexOf(pos) });
  }
  return g;
}

describe('reducer', () => {
  it('swaps two tapped tiles and undoes the swap', () => {
    let g = newGame({ size: 'medium', pattern: 'border' });
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
    const g = newGame({ size: 'small', pattern: 'checker' });
    const fixed = g.fixed.indexOf(true);
    const loose = g.fixed.indexOf(false);
    expect(reducer(g, { type: 'tap', pos: fixed })).toBe(g);
    expect(reducer(g, { type: 'swap', from: fixed, to: loose })).toBe(g);
  });

  it('is done once every tile is home, and round-trips through JSON', () => {
    const g = solve(newGame({ size: 'huge', pattern: 'corners' }));
    expect(g.done).toBe(true);
    expect(reducer(g, { type: 'undo' })).toBe(g);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });

  it('marks a row or column correct exactly when all its tiles are home', () => {
    let g = newGame({ size: 'small', pattern: 'checker' });
    const before = lines(g);
    // Shuffled: no line with a loose tile is correct; all-fixed lines (none on Easy) would be.
    before.rows.forEach((l) => expect(l.correct).toBe(l.fixed));
    // Put row 0 right.
    for (let c = 0; c < g.cols; c++) {
      if (g.order[c] !== c) g = reducer(g, { type: 'swap', from: c, to: g.order.indexOf(c) });
    }
    expect(lines(g).rows[0].correct).toBe(true);
    g = solve(g);
    const after = lines(g);
    expect(after.rows.every((l) => l.correct) && after.cols.every((l) => l.correct)).toBe(true);
  });

  it('flags lines made only of fixed tiles', () => {
    const g = newGame({ size: 'medium', pattern: 'border' });
    const { rows, cols } = lines(g);
    expect(rows.map((l) => l.fixed)).toEqual(rows.map((_, r) => r === 0 || r === g.rows - 1));
    expect(cols.map((l) => l.fixed)).toEqual(cols.map((_, c) => c === 0 || c === g.cols - 1));
  });

  it('describes its settings', () => {
    expect(label({ size: 'medium', pattern: 'border' })).toBe('5×7 · Border');
  });

  it('upgrades a game saved with the old three levels', () => {
    const g = newGame({ size: 'large', pattern: 'corners' });
    const { size: _s, pattern: _p, ...rest } = g;
    const old = JSON.parse(JSON.stringify({ ...rest, difficulty: 'hard' }));
    expect(fromSaved(old)).toEqual(g);
    expect(fromSaved({ ...old, difficulty: 'extreme' })).toBeNull();
    expect(fromSaved(null)).toBeNull();
    expect(fromSaved(JSON.parse(JSON.stringify(g)))).toEqual(g);
  });
});
