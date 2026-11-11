import { describe, expect, it } from 'vitest';
import { CROSS, EMPTY, isGame, LINE, newGame, reducer, type Game } from './game';
import { DIFFICULTIES, generate } from './logic';

describe('reducer', () => {
  it('cycles a side through empty, line and cross, one undo step each', () => {
    let g = newGame('easy');
    g = reducer(g, { type: 'cycle', edge: 0 });
    expect(g.marks[0]).toBe(LINE);
    g = reducer(g, { type: 'cycle', edge: 0 });
    expect(g.marks[0]).toBe(CROSS);
    g = reducer(g, { type: 'cycle', edge: 0 });
    expect(g.marks[0]).toBe(EMPTY);
    expect(g.history).toHaveLength(3);
    g = reducer(g, { type: 'undo' });
    expect(g.marks[0]).toBe(CROSS);
    expect(reducer(g, { type: 'cycle', edge: -1 })).toBe(g); // no such side
  });

  it('rejects saves with marks it doesn’t know', () => {
    const g = newGame('easy');
    expect(isGame({ ...g, marks: g.marks.map((m, e) => (e === 0 ? 3 : m)) })).toBe(false);
    expect(isGame({ ...g, marks: g.marks.map((m, e) => (e === 0 ? CROSS : m)) })).toBe(true);
  });

  it('still loads a save from before squares and rings', () => {
    const { squares: _s, rings: _r, ...old } = newGame('easy');
    const save = JSON.parse(JSON.stringify(old));
    expect(isGame(save)).toBe(true);
    expect(save.squares.every((k: unknown) => k === null)).toBe(true);
    expect(save.rings.every((x: unknown) => x === false)).toBe(true);
    expect(isGame({ ...newGame('easy'), squares: [2] })).toBe(false);
  });

  it('is done when the loop is drawn, and round-trips through JSON', () => {
    const { rows, cols } = DIFFICULTIES.medium;
    const { clues, squares, rings, solution } = generate('medium');
    let g: Game = { difficulty: 'medium', rows, cols, clues, squares, rings, marks: solution.map(() => EMPTY), history: [], done: false };
    solution.forEach((on, e) => { if (on) g = reducer(g, { type: 'cycle', edge: e }); });
    expect(g.done).toBe(true);
    expect(reducer(g, { type: 'cycle', edge: 0 })).toBe(g);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });
});
