import { describe, expect, it } from 'vitest';
import { allJoined, isGame, newGame, reducer, type Game } from './game';
import { DIFFICULTIES, generate } from './logic';

describe('reducer', () => {
  it('records a stroke as one move, and undoes it', () => {
    let g = newGame('easy');
    const before = g.paths;
    g = reducer(g, { type: 'draw', paths: [[g.dots[0][0]], ...before.slice(1)] });
    expect(g.history).toHaveLength(0);
    g = reducer(g, { type: 'commit', before });
    expect(g.history).toHaveLength(1);
    g = reducer(g, { type: 'undo' });
    expect(g.paths).toEqual(before);
    expect(reducer(g, { type: 'commit', before: g.paths })).toBe(g);
  });

  it('is done when the puzzle’s own paths are drawn, and round-trips through JSON', () => {
    const { size } = DIFFICULTIES.medium;
    const { dots, solution } = generate('medium');
    let g: Game = { difficulty: 'medium', size, dots, paths: dots.map(() => []), history: [], done: false };
    const before = g.paths;
    g = reducer(g, { type: 'draw', paths: solution });
    g = reducer(g, { type: 'commit', before });
    expect(g.done).toBe(true);
    expect(allJoined(g)).toBe(false);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });

  it('notices when every pair is joined but squares are empty', () => {
    const g: Game = { difficulty: 'easy', size: 3, dots: [[0, 2], [6, 8]], paths: [[0, 1, 2], [6, 7, 8]], history: [], done: false };
    expect(allJoined(g)).toBe(true);
  });
});
