import { describe, expect, it } from 'vitest';
import { isGame, newGame, reducer, stuck, type Game } from './game';
import { solve } from './logic';

describe('reducer', () => {
  it('picks up, pours, and undoes', () => {
    let g = newGame('easy');
    const [from, to] = solve(g.tubes)![0];
    g = reducer(g, { type: 'tap', tube: from });
    expect(g.selected).toBe(from);
    const before = g.tubes;
    g = reducer(g, { type: 'tap', tube: to });
    expect(g.selected).toBeNull();
    expect(g.tubes).not.toEqual(before);
    g = reducer(g, { type: 'undo' });
    expect(g.tubes).toEqual(before);
  });

  it('puts a tube down when tapped again, and ignores empty tubes', () => {
    let g = newGame('easy');
    const full = g.tubes.findIndex((t) => t.length);
    const empty = g.tubes.findIndex((t) => !t.length);
    expect(reducer(g, { type: 'tap', tube: empty })).toBe(g);
    g = reducer(reducer(g, { type: 'tap', tube: full }), { type: 'tap', tube: full });
    expect(g.selected).toBeNull();
  });

  it('is done when sorted, and round-trips through JSON', () => {
    let g = newGame('medium');
    for (const [from, to] of solve(g.tubes)!) g = reducer(reducer(g, { type: 'tap', tube: from }), { type: 'tap', tube: to });
    expect(g.done).toBe(true);
    expect(stuck(g)).toBe(false);
    expect(reducer(g, { type: 'tap', tube: 0 })).toBe(g);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });

  it('notices when no move helps', () => {
    const g: Game = { difficulty: 'easy', tubes: [[0, 1, 0, 1], [1, 0, 1, 0], [2, 3, 2, 3], [3, 2, 3, 2], [0], [1]], selected: null, history: [], done: false };
    expect(stuck(g)).toBe(false); // 0 can go onto 0? top of tube 0 is 1, tube 5 top is 1: yes
    const blocked: Game = { ...g, tubes: [[0, 1, 0, 1], [1, 0, 1, 0], [2, 3, 2, 3], [3, 2, 3, 2], [0, 2, 0, 2], [1, 3, 1, 3]] };
    expect(stuck(blocked)).toBe(true);
  });
});
