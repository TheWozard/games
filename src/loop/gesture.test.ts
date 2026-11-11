import { describe, expect, it } from 'vitest';
import { strokeEdges } from './gesture';
import { edgeBetween } from './logic';

const g = { rows: 3, cols: 3 };
const e = (a: [number, number], b: [number, number]) => edgeBetween(g, a, b);
const at = (x: number, y: number) => ({ x, y });

describe('strokeEdges', () => {
  it('counts a finger moving along a side over its middle as along', () => {
    // Along the top of the board, from x 0.3 to 0.7: over the middle of side (0,0)–(0,1).
    expect(strokeEdges(g, at(0.3, 0.05), at(0.7, -0.05))).toEqual({ along: [e([0, 0], [0, 1])], across: [] });
    // A long run along row 1 passes the middles of three sides.
    expect(strokeEdges(g, at(0.1, 1), at(2.9, 1.1)).along).toEqual([e([1, 0], [1, 1]), e([1, 1], [1, 2]), e([1, 2], [1, 3])]);
    // Down a column.
    expect(strokeEdges(g, at(2, 1.3), at(2.05, 1.7)).along).toEqual([e([1, 2], [2, 2])]);
  });

  it('counts a finger moving through a side at an angle as across', () => {
    // Straight down through the middle of side (1,1)–(1,2).
    expect(strokeEdges(g, at(1.5, 0.8), at(1.5, 1.2))).toEqual({ along: [], across: [e([1, 1], [1, 2])] });
    // A sweep across a column cuts every side it passes through.
    expect(strokeEdges(g, at(0.5, 0.5), at(2.5, 0.5)).across).toEqual([e([0, 1], [1, 1]), e([0, 2], [1, 2])]);
  });

  it('ignores clipping a corner, and staying in one square', () => {
    // Through dot (1,1) diagonally: within the corner allowance of every side there.
    expect(strokeEdges(g, at(0.95, 0.95), at(1.05, 1.05))).toEqual({ along: [], across: [] });
    expect(strokeEdges(g, at(0.4, 0.4), at(0.6, 0.6))).toEqual({ along: [], across: [] });
    expect(strokeEdges(g, at(0.5, 0.5), at(0.5, 0.5))).toEqual({ along: [], across: [] });
  });
});

describe('exact landings', () => {
  it('counts a finger step that ends or starts exactly on a side’s midpoint', () => {
    expect(strokeEdges(g, at(0.3, 0), at(0.5, 0)).along).toEqual([e([0, 0], [0, 1])]);
    expect(strokeEdges(g, at(0.5, 0), at(0.7, 0)).along).toEqual([e([0, 0], [0, 1])]);
  });
});
