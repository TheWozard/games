import { describe, expect, it } from 'vitest';
import { CROSS, EMPTY, isGame, LINE, newGame, reducer, type Game } from './game';
import { DIFFICULTIES, generate } from './logic';

describe('reducer', () => {
  it('adds with a left-click, removes or crosses out with a right-click, one undo step each', () => {
    let g = newGame('easy');
    g = reducer(g, { type: 'add', edge: 0 });
    expect(g.marks[0]).toBe(LINE);
    expect(reducer(g, { type: 'add', edge: 0 })).toBe(g); // already a line
    g = reducer(g, { type: 'remove', edge: 0 });
    expect(g.marks[0]).toBe(EMPTY);
    g = reducer(g, { type: 'remove', edge: 0 });
    expect(g.marks[0]).toBe(CROSS);
    expect(reducer(g, { type: 'remove', edge: 0 })).toBe(g); // already crossed
    g = reducer(g, { type: 'add', edge: 0 });
    expect(g.marks[0]).toBe(EMPTY); // left-clicking a cross clears it
    g = reducer(g, { type: 'add', edge: 0 });
    expect(g.marks[0]).toBe(LINE);
    expect(g.history).toHaveLength(5);
    g = reducer(g, { type: 'undo' });
    expect(g.marks[0]).toBe(EMPTY);
  });

  it('records a touch drag as one undo step', () => {
    let g = newGame('easy');
    const before = g.marks;
    g = reducer(g, { type: 'add', edge: 0, live: true });
    g = reducer(g, { type: 'add', edge: 1, live: true });
    g = reducer(g, { type: 'remove', edge: 2, live: true });
    expect(g.history).toHaveLength(0);
    expect([g.marks[0], g.marks[1], g.marks[2]]).toEqual([LINE, LINE, CROSS]);
    g = reducer(g, { type: 'commit', before });
    expect(g.history).toHaveLength(1);
    g = reducer(g, { type: 'undo' });
    expect(g.marks).toEqual(before);
    expect(reducer(g, { type: 'commit', before: g.marks })).toBe(g); // nothing changed
  });

  it('rejects saves with marks it doesn’t know', () => {
    const g = newGame('easy');
    expect(isGame({ ...g, marks: g.marks.map((m, e) => (e === 0 ? 3 : m)) })).toBe(false);
    expect(isGame({ ...g, marks: g.marks.map((m, e) => (e === 0 ? CROSS : m)) })).toBe(true);
  });

  it('is done when the loop is drawn, and round-trips through JSON', () => {
    const { rows, cols } = DIFFICULTIES.medium;
    const { clues, solution } = generate('medium');
    let g: Game = { difficulty: 'medium', rows, cols, clues, marks: solution.map(() => EMPTY), history: [], done: false };
    solution.forEach((on, e) => { if (on) g = reducer(g, { type: 'add', edge: e }); });
    expect(g.done).toBe(true);
    expect(reducer(g, { type: 'remove', edge: 0 })).toBe(g);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });
});
