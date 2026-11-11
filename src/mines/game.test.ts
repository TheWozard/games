import { describe, expect, it } from 'vitest';
import { flagsLeft, isGame, newGame, reducer, type Game } from './game';

function playToEnd(g: Game, pick: (g: Game) => number): Game {
  for (let k = 0; k < 1000 && g.status === 'playing'; k++) g = reducer(g, { type: 'tap', index: pick(g) });
  return g;
}

describe('reducer', () => {
  it('places mines on the first tap, never under it', () => {
    let g = newGame('large', 'many');
    g = reducer(g, { type: 'tap', index: 0 });
    expect(g.mines).not.toBeNull();
    expect(g.mines![0]).toBe(false);
    expect(g.revealed[0]).toBe(true);
    expect(g.status).toBe('playing');
  });

  it('wins once every safe cell is revealed, flagging the mines', () => {
    let g = reducer(newGame('small', 'few'), { type: 'tap', index: 40 });
    g = playToEnd(g, (s) => s.mines!.findIndex((m, i) => !m && !s.revealed[i]));
    expect(g.status).toBe('won');
    expect(g.flagged).toEqual(g.mines);
    expect(flagsLeft(g)).toBe(0);
  });

  it('loses on a mine and records which one', () => {
    let g = reducer(newGame('small', 'few'), { type: 'tap', index: 40 });
    const mine = g.mines!.indexOf(true);
    g = reducer(g, { type: 'tap', index: mine });
    expect(g.status).toBe('lost');
    expect(g.exploded).toBe(mine);
    expect(reducer(g, { type: 'tap', index: 0 })).toBe(g);
  });

  it('flags with a long-press, and flagged cells ignore taps', () => {
    let g = reducer(newGame('small', 'few'), { type: 'tap', index: 40 });
    const hidden = g.revealed.indexOf(false);
    g = reducer(g, { type: 'flag', index: hidden });
    expect(g.flagged[hidden]).toBe(true);
    expect(reducer(g, { type: 'tap', index: hidden })).toBe(g);
    g = reducer(g, { type: 'flag', index: hidden });
    expect(g.flagged[hidden]).toBe(false);
  });

  it('opens the neighbors of a number whose mines are flagged', () => {
    let g = reducer(newGame('small', 'few'), { type: 'tap', index: 40 });
    // Find a revealed number touching exactly its mines, flag them, then tap it.
    const cell = g.revealed.findIndex((r, i) => r && g.mines!.some((m, j) => m && Math.abs(Math.floor(j / 9) - Math.floor(i / 9)) <= 1 && Math.abs((j % 9) - (i % 9)) <= 1));
    expect(cell).toBeGreaterThanOrEqual(0);
    for (let j = 0; j < 81; j++) {
      const near = Math.abs(Math.floor(j / 9) - Math.floor(cell / 9)) <= 1 && Math.abs((j % 9) - (cell % 9)) <= 1;
      if (near && g.mines![j]) g = reducer(g, { type: 'flag', index: j });
    }
    const before = g.revealed.filter(Boolean).length;
    g = reducer(g, { type: 'tap', index: cell });
    expect(g.status).not.toBe('lost');
    expect(g.revealed.filter(Boolean).length).toBeGreaterThanOrEqual(before);
  });

  it('loads games saved with one difficulty, as its size and density', () => {
    const { size: _s, density: _d, ...rest } = reducer(newGame('medium', 'some'), { type: 'tap', index: 40 });
    const save = JSON.parse(JSON.stringify({ ...rest, difficulty: 'medium' }));
    expect(isGame(save)).toBe(true);
    expect([save.size, save.density, save.mineCount]).toEqual(['medium', 'some', 22]);
    expect(isGame({ ...rest, difficulty: 'impossible' })).toBe(false);
  });

  it('loads games saved with the old flag-mode button', () => {
    const g = reducer(newGame('small', 'few'), { type: 'tap', index: 40 });
    expect(isGame(JSON.parse(JSON.stringify({ ...g, flagMode: true })))).toBe(true);
  });
});
