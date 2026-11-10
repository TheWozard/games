import { describe, expect, it } from 'vitest';
import { isGame, newGame, reducer, type Game } from './game';
import { generate } from './logic';

describe('reducer', () => {
  it('moves a dot live, records the drop, and undoes it', () => {
    let g = newGame('easy');
    const before = g.points;
    g = reducer(g, { type: 'drag', index: 0, to: [50, 60] });
    expect(g.points[0]).toEqual([50, 60]);
    expect(g.history).toHaveLength(0);
    g = reducer(g, { type: 'drop', before });
    expect(g.history).toHaveLength(1);
    expect(g.moves).toBe(1);
    g = reducer(g, { type: 'undo' });
    expect(g.points).toEqual(before);
  });

  it('keeps dots on the board', () => {
    const g = reducer(newGame('easy'), { type: 'drag', index: 0, to: [-50, 999] });
    expect(g.points[0][0]).toBeGreaterThan(0);
    expect(g.points[0][1]).toBeLessThan(130);
  });

  it('ignores a drop that moved nothing', () => {
    const g = newGame('easy');
    expect(reducer(g, { type: 'drop', before: g.points })).toBe(g);
  });

  it('is done when the last crossing goes, and round-trips through JSON', () => {
    const { edges, solution, points } = generate('medium');
    let g: Game = { difficulty: 'medium', points, edges, history: [], moves: 0, done: false };
    for (let i = 0; i < solution.length; i++) {
      const before = g.points;
      g = reducer(g, { type: 'drag', index: i, to: solution[i] });
      g = reducer(g, { type: 'drop', before });
    }
    expect(g.done).toBe(true);
    expect(reducer(g, { type: 'drag', index: 0, to: [1, 1] })).toBe(g);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });
});
