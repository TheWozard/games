import { describe, expect, it } from 'vitest';
import { edgesFor, newGame, reducer, type Game } from './game';
import { center, dragEdge, islandAt, swipedEdges } from './gesture';

describe('islandAt', () => {
  it('finds the island under a point, and nothing between islands', () => {
    const g = newGame('medium');
    g.islands.forEach((_, i) => expect(islandAt(g, center(g, i))).toBe(i));
    const c = center(g, 0);
    expect(islandAt(g, { x: c.x + 0.3, y: c.y })).toBe(0);
    expect(islandAt(g, { x: c.x + 0.6, y: c.y + 0.6 })).toBeNull();
  });
});

describe('dragEdge', () => {
  for (const diagonals of [false, true]) {
    it(`follows the drag toward the neighbor in its direction${diagonals ? ', diagonals included' : ''}`, () => {
      const g = newGame('hard', { colors: false, blocks: false, diagonals });
      const { edges } = edgesFor(g);
      if (diagonals) expect(edges.some((e) => e.dr !== 0 && e.dc !== 0)).toBe(true);
      edges.forEach((e, k) => {
        const a = center(g, e.a);
        const b = center(g, e.b);
        // From either end, dragging most of a cell toward the other end (a little off) picks this edge.
        const toward = (p: typeof a, q: typeof a) => ({ x: p.x + Math.sign(q.x - p.x) * 0.8 + 0.08, y: p.y + Math.sign(q.y - p.y) * 0.8 + 0.08 });
        expect(dragEdge(g, e.a, toward(a, b))).toBe(k);
        expect(dragEdge(g, e.b, toward(b, a))).toBe(k);
      });
    });
  }

  it('needs a real drag, and finds nothing where there is no neighbor', () => {
    const g = newGame('easy');
    const c = center(g, 0);
    expect(dragEdge(g, 0, { x: c.x + 0.2, y: c.y })).toBe(-1);
    // Some direction from some island leads nowhere (the board edge, at least).
    const dead = g.islands.some((_, i) => {
      const p = center(g, i);
      return [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => dragEdge(g, i, { x: p.x + dx, y: p.y + dy }) === -1);
    });
    expect(dead).toBe(true);
  });
});

describe('swipedEdges', () => {
  it('reports built bridges a swipe passes across, and only those', () => {
    let g: Game = newGame('medium');
    const { edges } = edgesFor(g);
    const k = 0;
    const e = edges[k];
    const a = center(g, e.a);
    const b = center(g, e.b);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // A short stroke straight across the middle of the bridge.
    const across = e.dr === 0
      ? [{ x: mid.x, y: mid.y - 0.3 }, { x: mid.x, y: mid.y + 0.3 }]
      : [{ x: mid.x - 0.3, y: mid.y }, { x: mid.x + 0.3, y: mid.y }];
    expect(swipedEdges(g, across[0], across[1])).toEqual([]); // nothing built yet
    g = reducer(g, { type: 'build', edge: k });
    expect(swipedEdges(g, across[0], across[1])).toEqual([k]);
    // Moving along the bridge doesn't cross it.
    expect(swipedEdges(g, a, mid)).toEqual([]);
  });
});
