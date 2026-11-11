import { describe, expect, it } from 'vitest';
import { free, isGame, newGame, pairsLeft, reducer, type Game } from './game';

/** A game played with random free pairs until no match is left (common in Mahjong). */
function stuck(): Game {
  for (let tries = 0; tries < 500; tries++) {
    let g = newGame('pyramid');
    for (;;) {
      const pairs = pairsLeft(g);
      if (g.done || pairs.length === 0) break;
      const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
      g = reducer(reducer(g, { type: 'tap', slot: a }), { type: 'tap', slot: b });
    }
    if (!g.done) return g;
  }
  throw new Error('never got stuck');
}
import { deal, FLOWERS, matches, SEASONS } from './logic';

describe('reducer', () => {
  it('removes a free matching pair, and undoes it', () => {
    let g = newGame('pyramid');
    const [a, b] = pairsLeft(g)[0];
    g = reducer(g, { type: 'tap', slot: a });
    expect(g.selected).toBe(a);
    g = reducer(g, { type: 'tap', slot: b });
    expect(g.gone[a] && g.gone[b]).toBe(true);
    expect(g.selected).toBeNull();
    g = reducer(g, { type: 'undo' });
    expect(g.gone[a] || g.gone[b]).toBe(false);
  });

  it('takes two different flowers (or seasons) as a pair', () => {
    for (const [first, second] of [[FLOWERS, FLOWERS + 2], [SEASONS + 3, SEASONS]]) {
      const g = newGame('pyramid');
      const [a, b] = g.kinds.flatMap((_, i) => (free(g, i) ? [i] : []));
      const kinds = g.kinds.slice();
      kinds[a] = first;
      kinds[b] = second;
      const after = reducer(reducer({ ...g, kinds }, { type: 'tap', slot: a }), { type: 'tap', slot: b });
      expect(after.gone[a] && after.gone[b]).toBe(true);
    }
  });

  it('ignores blocked tiles, and switches selection on a non-match', () => {
    let g = newGame('fortress');
    const blocked = g.kinds.findIndex((_, i) => !free(g, i));
    expect(reducer(g, { type: 'tap', slot: blocked })).toBe(g);
    const freeTiles = g.kinds.flatMap((_, i) => (free(g, i) ? [i] : []));
    const a = freeTiles[0];
    const b = freeTiles.find((i) => !matches(g.kinds[i], g.kinds[a]))!;
    g = reducer(reducer(g, { type: 'tap', slot: a }), { type: 'tap', slot: b });
    expect(g.selected).toBe(b);
    expect(g.gone.some(Boolean)).toBe(false);
  });

  it('only shuffles when stuck, keeping the same faces, undoably', () => {
    const fresh = newGame('pyramid');
    expect(reducer(fresh, { type: 'shuffle' })).toBe(fresh); // matches available: no shuffle
    let g = stuck();
    const before = g.kinds;
    g = reducer(g, { type: 'shuffle' });
    const left = (k: number[]) => k.filter((_, i) => !g.gone[i]).sort((x, y) => x - y);
    expect(left(g.kinds)).toEqual(left(before));
    g = reducer(g, { type: 'undo' });
    expect(g.kinds).toEqual(before);
  });

  it('is done when the board is clear, following the dealer’s order', () => {
    const { kinds, order } = deal('fortress');
    let g: Game = { layout: 'fortress', kinds, gone: kinds.map(() => false), selected: null, history: [], done: false };
    for (const [a, b] of order) g = reducer(reducer(g, { type: 'tap', slot: a }), { type: 'tap', slot: b });
    expect(g.done).toBe(true);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });

  it('loads games saved with the old Hint button', () => {
    const g = newGame('pyramid');
    expect(isGame(JSON.parse(JSON.stringify({ ...g, hint: [0, 1] })))).toBe(true);
  });
});
