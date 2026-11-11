import { describe, expect, it } from 'vitest';
import { isGame, newGame, reducer, type Game } from './game';
import { DIFFICULTIES, generate, NO_RULES, plainBoard } from './logic';

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
    const { dots, solution, board } = generate('medium');
    let g: Game = { difficulty: 'medium', rules: { ...NO_RULES }, size, board, dots, paths: dots.map(() => []), history: [], done: false };
    const before = g.paths;
    g = reducer(g, { type: 'draw', paths: solution });
    g = reducer(g, { type: 'commit', before });
    expect(g.done).toBe(true);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });

  it('round-trips a game with every rule, and loads saves from before the rules', () => {
    const g0 = newGame('easy', { walls: true, holes: true, wrap: true, bridges: true });
    expect(isGame(JSON.parse(JSON.stringify(g0)))).toBe(true);
    const { rules: _r, board: _b, ...old } = newGame('easy');
    const save = JSON.parse(JSON.stringify(old));
    expect(isGame(save)).toBe(true);
    expect(save.board).toEqual(plainBoard(5));
  });
});
