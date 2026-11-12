import { describe, expect, it } from 'vitest';
import { FIRST, isGame, newGame, reducer, type Game } from './game';
import { explore, isOut, positionKey, range, shape } from './logic';
import { PUZZLES } from './puzzles';

/** Plays a game to the end in the fewest moves, each slide bringing the finish one move closer. */
function solve(g: Game): Game {
  const s = shape(g.variant);
  const found = explore(g.blocks, s, Infinity)!;
  const moves = new Map(found.keys.map((k, id) => [k, found.moves[id]]));
  while (!g.done) {
    const left = moves.get(positionKey(g.blocks))!;
    g = g.blocks.flatMap((_, i) => {
      const [lo, hi] = range(g.blocks, i, s);
      return Array.from({ length: hi - lo + 1 }, (_, k) => reducer(g, { type: 'slide', index: i, to: lo + k }));
    }).find((n) => moves.get(positionKey(n.blocks)) === left - 1)!;
  }
  return g;
}

describe('puzzle order', () => {
  it('plays each variant and difficulty’s puzzles in order, wrapping round, each remembered separately', () => {
    let g = newGame('classic', 'medium');
    expect(g.number).toBe(0);
    expect(g.upNext.classic.medium).toBe(1);
    g = newGame('classic', 'medium', g.upNext);
    expect(g.number).toBe(1);
    g = newGame('big', 'medium', g.upNext);
    expect(g.number).toBe(0);
    g = newGame('classic', 'medium', g.upNext);
    expect(g.number).toBe(2);
    const last = PUZZLES.pillars.easy.length - 1;
    g = newGame('pillars', 'easy', { ...FIRST, pillars: { ...FIRST.pillars, easy: last } });
    expect(g.number).toBe(last);
    expect(g.upNext.pillars.easy).toBe(0);
  });

  it('starts a picked puzzle and carries on in order after it', () => {
    let g = newGame('twoKeys', 'hard', undefined, 41);
    expect(g.number).toBe(41);
    expect(g.upNext.twoKeys.hard).toBe(42);
    g = newGame('twoKeys', 'hard', g.upNext);
    expect(g.number).toBe(42);
  });
});

describe('reducer', () => {
  it('slides, refuses blocked or empty slides, and undoes', () => {
    let g = newGame('classic', 'easy');
    const s = shape('classic');
    const i = g.blocks.findIndex((_, k) => range(g.blocks, k, s)[0] !== range(g.blocks, k, s)[1]);
    const [lo, hi] = range(g.blocks, i, s);
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

  it('never moves a pillar', () => {
    const g = newGame('pillars', 'easy');
    const p = g.blocks.findIndex((b) => b.fixed);
    expect(p).toBeGreaterThan(0);
    expect(reducer(g, { type: 'slide', index: p, to: (g.blocks[p].c + 1) % 6 })).toBe(g);
  });

  for (const variant of ['classic', 'pillars', 'big', 'twoKeys'] as const) {
    it(`finishes ${variant} in the fewest moves when each move gets closer, and round-trips through JSON`, () => {
      const g = solve(newGame(variant, 'hard'));
      expect(g.moves).toBe(g.fewest);
      expect(reducer(g, { type: 'undo' })).toBe(g);
      expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
      expect(isGame({ ...g, upNext: { ...g.upNext, big: { easy: 0 } } })).toBe(false);
      expect(isGame({ ...g, blocks: [] })).toBe(false);
      expect(isGame({ ...g, variant: 'huge' })).toBe(false);
    }, 60000);
  }

  it('needs both key blocks out in Two Keys', () => {
    // Play the fewest moves, and check the game isn't done when only one key block is out.
    let g = newGame('twoKeys', 'easy');
    const s = shape('twoKeys');
    const found = explore(g.blocks, s, Infinity)!;
    const moves = new Map(found.keys.map((k, id) => [k, found.moves[id]]));
    while (!g.done) {
      const left = moves.get(positionKey(g.blocks))!;
      g = g.blocks.flatMap((_, i) => {
        const [lo, hi] = range(g.blocks, i, s);
        return Array.from({ length: hi - lo + 1 }, (_, k) => reducer(g, { type: 'slide', index: i, to: lo + k }));
      }).find((n) => moves.get(positionKey(n.blocks)) === left - 1)!;
      const out = [0, 1].filter((k) => isOut(g.blocks, k, s));
      if (out.length === 1) expect(g.done).toBe(false);
    }
    expect(g.done).toBe(true);
  });
});

describe('saves', () => {
  it('carries a save from before the variants on as Classic, keeping what’s next', () => {
    const { variant: _, upNext, ...rest } = newGame('classic', 'medium', undefined, 5);
    const old = JSON.parse(JSON.stringify({ ...rest, upNext: { easy: 3, medium: 6, hard: 9 } }));
    expect(isGame(old)).toBe(true);
    expect(old.variant).toBe('classic');
    expect(old.upNext.classic).toEqual({ easy: 3, medium: 6, hard: 9 });
    expect(old.upNext.big).toEqual(FIRST.big);
    void upNext;
  });
});
