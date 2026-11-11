import { describe, expect, it } from 'vitest';
import { FIRST, isGame, newGame, reducer, type Game } from './game';
import { encode, explore, range } from './logic';
import { PUZZLES } from './puzzles';

describe('puzzle order', () => {
  it('plays each difficulty’s puzzles in order, wrapping round, each remembered separately', () => {
    let g = newGame('medium');
    expect(g.number).toBe(0);
    expect(g.upNext).toEqual({ ...FIRST, medium: 1 });
    g = newGame('medium', g.upNext);
    expect(g.number).toBe(1);
    g = newGame('hard', g.upNext);
    expect(g.number).toBe(0);
    g = newGame('medium', g.upNext);
    expect(g.number).toBe(2);
    const last = PUZZLES.easy.length - 1;
    g = newGame('easy', { ...FIRST, easy: last });
    expect(g.number).toBe(last);
    expect(g.upNext.easy).toBe(0);
    expect(newGame('easy', g.upNext).number).toBe(0);
  });

  it('starts a picked puzzle and carries on in order after it', () => {
    let g = newGame('hard', undefined, 41);
    expect(g.number).toBe(41);
    expect(g.upNext).toEqual({ ...FIRST, hard: 42 });
    g = newGame('hard', g.upNext);
    expect(g.number).toBe(42);
    const last = PUZZLES.hard.length - 1;
    expect(newGame('hard', g.upNext, last).upNext.hard).toBe(0);
  });
});

describe('reducer', () => {
  it('slides, refuses blocked or empty slides, and undoes', () => {
    let g = newGame('easy');
    const i = g.blocks.findIndex((_, k) => range(g.blocks, k)[0] !== range(g.blocks, k)[1]);
    const [lo, hi] = range(g.blocks, i);
    const b = g.blocks[i];
    const at = b.across ? b.c : b.r;
    const to = at === lo ? hi : lo;
    expect(reducer(g, { type: 'slide', index: i, to: at })).toBe(g); // didn't move
    expect(reducer(g, { type: 'slide', index: i, to: -1 })).toBe(g); // off the board
    const before = g.blocks;
    g = reducer(g, { type: 'slide', index: i, to });
    expect(g.moves).toBe(1);
    g = reducer(g, { type: 'undo' });
    expect(g.blocks).toBe(before);
    expect(g.moves).toBe(0);
    expect(reducer(g, { type: 'undo' })).toBe(g);
  });

  it('is done in the fewest moves when each move gets closer, and round-trips through JSON', () => {
    let g: Game = newGame('hard');
    const moves = new Map(explore(g.blocks)!.map((p) => [encode(p.blocks), p.moves]));
    while (!g.done) {
      // Of all the slides from here, take one that brings the solution a move closer.
      const left = moves.get(encode(g.blocks))!;
      const step = g.blocks.flatMap((_, i) => {
        const [lo, hi] = range(g.blocks, i);
        return Array.from({ length: hi - lo + 1 }, (_, k) => reducer(g, { type: 'slide', index: i, to: lo + k }));
      }).find((n) => moves.get(encode(n.blocks)) === left - 1)!;
      g = step;
    }
    expect(g.moves).toBe(g.fewest);
    expect(reducer(g, { type: 'undo' })).toBe(g);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
    expect(isGame({ ...g, upNext: { easy: 0 } })).toBe(false);
    expect(isGame({ ...g, blocks: [] })).toBe(false);
  });
});
