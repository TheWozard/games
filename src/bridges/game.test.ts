import { describe, expect, it } from 'vitest';
import { blocked, counts, edgesFor, isGame, newGame, reducer, type Brush, type Game } from './game';

/** Builds the answer by setting each pair with the matching brush. */
const solveAll = (g: Game) =>
  g.solution.reduce((s, v, k) => (v ? reducer(reducer(s, { type: 'brush', brush: v as Brush }), { type: 'tapEdge', edge: k }) : s), g);

describe('reducer', () => {
  it('sets a pair to the brush count, and undoes each step', () => {
    let g = newGame('easy');
    expect(g.brush).toBe(1);
    g = reducer(g, { type: 'tapEdge', edge: 0 });
    expect(g.bridges[0]).toBe(1);
    expect(reducer(g, { type: 'tapEdge', edge: 0 })).toBe(g); // already 1: nothing to do
    g = reducer(reducer(g, { type: 'brush', brush: 2 }), { type: 'tapEdge', edge: 0 });
    expect(g.bridges[0]).toBe(2);
    g = reducer(reducer(g, { type: 'brush', brush: 0 }), { type: 'tapEdge', edge: 0 });
    expect(g.bridges[0]).toBe(0);
    g = reducer(g, { type: 'undo' });
    expect(g.bridges[0]).toBe(2);
    g = reducer(g, { type: 'undo' });
    expect(g.bridges[0]).toBe(1);
    expect(g.brush).toBe(0); // undo restores bridges, not the brush
  });

  it('bridges two islands tapped one after the other, in either order', () => {
    for (let run = 0; run < 20; run++) {
      const start = newGame('easy');
      edgesFor(start).edges.forEach((e, k) => {
        for (const [x, y] of [[e.a, e.b], [e.b, e.a]]) {
          let g = reducer(start, { type: 'tapIsland', island: x });
          expect(g.selected).toBe(x);
          g = reducer(g, { type: 'tapIsland', island: y });
          expect(g.selected).toBeNull();
          expect(g.bridges[k]).toBe(1);
          expect(counts(g)[x]).toBe(1);
        }
      });
    }
  });

  it('refuses a bridge that would cross another', () => {
    // Find a pair of crossing edges in some puzzle.
    for (let tries = 0; tries < 50; tries++) {
      let g = newGame('hard');
      const { crosses } = edgesFor(g);
      const k = crosses.findIndex((x) => x.length > 0);
      if (k === -1) continue;
      g = reducer(g, { type: 'tapEdge', edge: k });
      const other = crosses[k][0];
      expect(blocked(g, other)).toBe(true);
      expect(reducer(g, { type: 'tapEdge', edge: other }).bridges[other]).toBe(0);
      // Setting it to none is always allowed (and here does nothing).
      expect(reducer(reducer(g, { type: 'brush', brush: 0 }), { type: 'tapEdge', edge: other }).bridges[other]).toBe(0);
      return;
    }
    throw new Error('no crossing edges found');
  });

  it('finishes when the answer is built, then ignores moves', () => {
    const g = solveAll(newGame('medium'));
    expect(g.done).toBe(true);
    expect(reducer(g, { type: 'tapEdge', edge: 0 })).toBe(g);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });

  it('clears everything in one undoable step', () => {
    let g = newGame('easy');
    const { edges, crosses } = edgesFor(g);
    const k = edges.findIndex((_, j) => j > 0 && !crosses[0].includes(j));
    g = reducer(reducer(g, { type: 'tapEdge', edge: 0 }), { type: 'tapEdge', edge: k });
    g = reducer(g, { type: 'clear' });
    expect(g.bridges.every((v) => v === 0)).toBe(true);
    g = reducer(g, { type: 'undo' });
    expect(g.bridges[0] + g.bridges[k]).toBe(2);
  });
});
