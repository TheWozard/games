import { describe, expect, it } from 'vitest';
import { blocked, counts, edgesFor, isGame, newGame, reducer, type Game } from './game';

/** Builds the answer one bridge at a time, as drags would. */
const solveAll = (g: Game) =>
  g.solution.reduce((s, v, k) => {
    for (let n = 0; n < v; n++) s = reducer(s, { type: 'build', edge: k });
    return s;
  }, g);

/** A puzzle with at least one pair of possible bridges that cross. */
function withCrossing(): { g: Game; k: number; other: number } {
  for (let tries = 0; tries < 50; tries++) {
    const g = newGame('hard');
    const k = edgesFor(g).crosses.findIndex((x) => x.length > 0);
    if (k >= 0) return { g, k, other: edgesFor(g).crosses[k][0] };
  }
  throw new Error('no crossing edges found');
}

describe('reducer', () => {
  it('builds one bridge per drag, up to two, and removes one per swipe', () => {
    let g = newGame('easy');
    g = reducer(g, { type: 'build', edge: 0 });
    expect(g.bridges[0]).toBe(1);
    expect(counts(g)[edgesFor(g).edges[0].a]).toBe(1);
    g = reducer(g, { type: 'build', edge: 0 });
    expect(g.bridges[0]).toBe(2);
    expect(reducer(g, { type: 'build', edge: 0 })).toBe(g);
    g = reducer(g, { type: 'remove', edge: 0 });
    expect(g.bridges[0]).toBe(1);
    g = reducer(reducer(g, { type: 'remove', edge: 0 }), { type: 'remove', edge: 0 });
    expect(g.bridges[0]).toBe(0);
  });

  it('cycles a tapped gap 0 → 1 → 2 → 0', () => {
    let g = newGame('easy');
    const seen = [];
    for (let n = 0; n < 4; n++) {
      g = reducer(g, { type: 'cycle', edge: 0 });
      seen.push(g.bridges[0]);
    }
    expect(seen).toEqual([1, 2, 0, 1]);
  });

  it('undoes each move', () => {
    let g = newGame('easy');
    g = reducer(reducer(g, { type: 'build', edge: 0 }), { type: 'build', edge: 0 });
    g = reducer(g, { type: 'remove', edge: 0 });
    g = reducer(g, { type: 'undo' });
    expect(g.bridges[0]).toBe(2);
    g = reducer(reducer(g, { type: 'undo' }), { type: 'undo' });
    expect(g.bridges[0]).toBe(0);
    expect(reducer(g, { type: 'undo' })).toBe(g);
  });

  it('won’t build or cycle across another bridge', () => {
    let { g, k, other } = withCrossing();
    g = reducer(g, { type: 'build', edge: k });
    expect(blocked(g, other)).toBe(true);
    expect(reducer(g, { type: 'build', edge: other })).toBe(g);
    expect(reducer(g, { type: 'cycle', edge: other })).toBe(g);
  });

  it('finishes when the answer is built, then ignores moves', () => {
    const g = solveAll(newGame('medium'));
    expect(g.done).toBe(true);
    expect(reducer(g, { type: 'build', edge: 0 })).toBe(g);
    expect(reducer(g, { type: 'remove', edge: g.bridges.findIndex((v) => v > 0) })).toBe(g);
    expect(reducer(g, { type: 'undo' })).toBe(g);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });

  it('loads games saved with the old tap controls', () => {
    const g = newGame('easy');
    expect(isGame(JSON.parse(JSON.stringify({ ...g, brush: 1, selected: null })))).toBe(true);
  });
});
