import { describe, expect, it } from 'vitest';
import { describe as label, fromSaved, isGame, newGame, reducer, type Game } from './game';
import { generate } from './logic';

describe('reducer', () => {
  it('moves a dot live, records the drop, and undoes it', () => {
    let g = newGame({ size: 'd10', style: 'lines', start: 'circle' });
    const before = g.points;
    g = reducer(g, { type: 'drag', index: 0, to: [50, 60] });
    expect(g.points[0]).toEqual([50, 60]);
    expect(g.history).toHaveLength(0);
    g = reducer(g, { type: 'drop', index: 0, before });
    expect(g.history).toHaveLength(1);
    expect(g.moves).toBe(1);
    g = reducer(g, { type: 'undo' });
    expect(g.points).toEqual(before);
  });

  it('keeps dots on the board', () => {
    const g = reducer(newGame({ size: 'd10', style: 'loops', start: 'scatter' }), { type: 'drag', index: 0, to: [-50, 999] });
    expect(g.points[0][0]).toBeGreaterThan(0);
    expect(g.points[0][1]).toBeLessThan(130);
  });

  it('ignores a drop that moved nothing', () => {
    const g = newGame({ size: 'd10', style: 'mesh', start: 'scatter' });
    expect(reducer(g, { type: 'drop', index: 0, before: g.points })).toBe(g);
  });

  it('nudges a dot dropped on another', () => {
    let g = newGame({ size: 'd10', style: 'lines', start: 'circle' });
    const before = g.points;
    g = reducer(g, { type: 'drag', index: 0, to: g.points[1] });
    g = reducer(g, { type: 'drop', index: 0, before });
    expect(Math.hypot(g.points[0][0] - g.points[1][0], g.points[0][1] - g.points[1][1])).toBeGreaterThan(5);
  });

  it('is done when the last crossing goes, and round-trips through JSON', () => {
    const settings = { size: 'd15', style: 'mesh', start: 'circle' } as const;
    const { edges, solution } = generate(settings);
    // Every dot already home except one, which starts off to the side: dragging it home is the
    // move that untangles. (Moving dots home one by one could drop one next to a dot that hasn't
    // moved yet, and the nudge would push it off its spot.)
    const points = solution.map((p, i) => (i === 0 ? ([5, 5] as [number, number]) : p));
    let g: Game = { ...settings, points, edges, history: [], moves: 0, done: false };
    const before = g.points;
    g = reducer(g, { type: 'drag', index: 0, to: solution[0] });
    g = reducer(g, { type: 'drop', index: 0, before });
    expect(g.done).toBe(true);
    expect(reducer(g, { type: 'drag', index: 0, to: [1, 1] })).toBe(g);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });
});

describe('settings', () => {
  it('describes them', () => {
    expect(label({ size: 'd28', style: 'loops', start: 'scatter' })).toBe('28 dots · Loops · Scatter');
  });

  it('upgrades a game saved with the old three levels', () => {
    const { points, edges } = generate({ size: 'd15', style: 'lines', start: 'circle' });
    const old = { difficulty: 'medium', points, edges, history: [], moves: 3, done: false };
    const g = fromSaved(JSON.parse(JSON.stringify(old)));
    expect(g).toMatchObject({ size: 'd15', style: 'lines', start: 'circle', moves: 3 });
    expect(fromSaved({ ...old, difficulty: 'extreme' })).toBeNull();
    expect(fromSaved(null)).toBeNull();
  });
});
