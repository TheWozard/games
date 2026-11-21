import { describe, expect, it } from 'vitest';
import {
  dealt,
  free,
  isGame,
  newGame,
  nextDeal,
  pairsLeft,
  pickLayout,
  reducer,
  replayOf,
  type Game,
} from './game';
import { ARCHIVE_IDS, isArchive, layoutOf, OWN_IDS } from './layouts';

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
    for (const [first, second] of [
      [FLOWERS, FLOWERS + 2],
      [SEASONS + 3, SEASONS],
    ]) {
      const g = newGame('pyramid');
      const [a, b] = g.kinds.flatMap((_, i) => (free(g, i) ? [i] : []));
      const kinds = g.kinds.slice();
      kinds[a] = first;
      kinds[b] = second;
      const after = reducer(reducer({ ...g, kinds }, { type: 'tap', slot: a }), {
        type: 'tap',
        slot: b,
      });
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
    let g: Game = {
      layout: 'fortress',
      pool: ['fortress'],
      difficulty: 'medium',
      seed: 1,
      kinds,
      gone: kinds.map(() => false),
      selected: null,
      history: [],
      done: false,
    };
    for (const [a, b] of order)
      g = reducer(reducer(g, { type: 'tap', slot: a }), { type: 'tap', slot: b });
    expect(g.done).toBe(true);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });

  it('keeps its difficulty, and rejects a save without one or with an unknown one', () => {
    const g = newGame('pyramid', 'hard');
    expect(g.difficulty).toBe('hard');
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
    const { difficulty: _, ...old } = g;
    expect(isGame(old)).toBe(false);
    expect(isGame({ ...g, difficulty: 'expert' })).toBe(false);
    expect(isGame(null)).toBe(false);
  });

  it('deals from a pool of layouts, not the last one again while there are others', () => {
    for (let run = 0; run < 30; run++) {
      expect(['heart', 'pine']).toContain(pickLayout(['heart', 'pine', 'arrow'], 'arrow'));
      expect(pickLayout(['heart', 'pine'], 'heart')).toBe('pine');
      expect(pickLayout(['heart'], 'heart')).toBe('heart');
    }
    const seen = new Set<string>();
    for (let run = 0; run < 30; run++) seen.add(pickLayout(['heart', 'pine', 'arrow']));
    expect(seen.size).toBe(3);
    const g = dealt(nextDeal(['arrow', 'diamond'], 'easy', 'arrow'));
    expect(g.layout).toBe('diamond');
    expect(g.pool).toEqual(['arrow', 'diamond']);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });

  it('rejects a save without a pool, or with a bad one', () => {
    const g = newGame('pyramid');
    const { pool: _, ...old } = g;
    expect(isGame(old)).toBe(false);
    expect(isGame({ ...g, pool: [] })).toBe(false);
    expect(isGame({ ...g, pool: ['pyramid', 'pyramid'] })).toBe(false);
    expect(isGame({ ...g, pool: ['moon'] })).toBe(false);
  });

  it('deals the same tiles again from the same seed, and saves the seed', () => {
    for (const difficulty of ['easy', 'hard'] as const) {
      const a = newGame('pyramid', difficulty, ['pyramid'], 0x1234abcd);
      expect(a.seed).toBe(0x1234abcd);
      expect(newGame('pyramid', difficulty, ['pyramid'], 0x1234abcd).kinds).toEqual(a.kinds);
      expect(isGame(JSON.parse(JSON.stringify(a)))).toBe(true);
    }
    expect(newGame('pyramid', 'medium', ['pyramid'], 1).kinds).not.toEqual(
      newGame('pyramid', 'medium', ['pyramid'], 2).kinds,
    );
    const g = newGame('pyramid');
    const { seed: _, ...old } = g;
    expect(isGame(old)).toBe(false);
    expect(isGame({ ...g, seed: -1 })).toBe(false);
    expect(isGame({ ...g, seed: 1.5 })).toBe(false);
    expect(isGame({ ...g, seed: '1' })).toBe(false);
  });

  it('makes a deal as plain JSON (what the worker is sent), dealing the same game wherever it runs', () => {
    const deal = nextDeal(['pyramid', 'heart'], 'hard');
    expect(JSON.parse(JSON.stringify(deal))).toEqual(deal);
    const g = dealt(deal);
    expect(dealt(structuredClone(deal))).toEqual(g);
    expect(dealt(replayOf(reducer(g, { type: 'tap', slot: pairsLeft(g)[0][0] })))).toEqual(g);
  });

  it('plays archive layouts, alone or in a pool with its own', () => {
    const g = newGame('gnome-mahjongg/overpass', 'easy');
    expect(g.kinds).toHaveLength(layoutOf('gnome-mahjongg/overpass').slots.length);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
    // A bridge covers the tiles under it: some tiles start out blocked from two layers up.
    expect(g.kinds.some((_, i) => !free(g, i))).toBe(true);
    const mixed = dealt(nextDeal(['pyramid', 'kmahjongg/arena'], 'easy', 'pyramid'));
    expect(mixed.layout).toBe('kmahjongg/arena');
    expect(isGame(JSON.parse(JSON.stringify(mixed)))).toBe(true);
    expect(isGame({ ...mixed, layout: 'kmahjongg/cat' })).toBe(false); // left out of the archive
    expect(isGame({ ...mixed, pool: ['pyramid', 'kmahjongg/nope'] })).toBe(false);
  });

  it('names every layout, numbering archive names that repeat', () => {
    const archive = ARCHIVE_IDS.map((id) => layoutOf(id).name);
    expect(new Set(archive).size).toBe(archive.length);
    expect(archive).toEqual(expect.arrayContaining(['Crab', 'Crab 2']));
    expect(OWN_IDS.map((id) => layoutOf(id).name)).toContain('Pyramid');
    expect(OWN_IDS.every((id) => !isArchive(id)) && ARCHIVE_IDS.every(isArchive)).toBe(true);
  });
});
