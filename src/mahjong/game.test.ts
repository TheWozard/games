import { describe, expect, it } from 'vitest';
import { dealFrom, free, fromSaved, isGame, newGame, pairsLeft, pickLayout, poolOf, reducer, slotsOf, type Game } from './game';
import { isWide, layoutProblems, turn } from './logic';
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
    let g: Game = { layout: 'fortress', difficulty: 'medium', kinds, gone: kinds.map(() => false), selected: null, history: [], done: false };
    for (const [a, b] of order) g = reducer(reducer(g, { type: 'tap', slot: a }), { type: 'tap', slot: b });
    expect(g.done).toBe(true);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });

  it('keeps its difficulty, and loads saves from before there was one as Medium', () => {
    const g = newGame('pyramid', 'hard');
    expect(g.difficulty).toBe('hard');
    expect(fromSaved(JSON.parse(JSON.stringify(g)))).toEqual(g);
    const { difficulty: _, ...old } = g;
    expect(isGame(old)).toBe(false);
    expect(fromSaved(JSON.parse(JSON.stringify(old)))).toEqual({ ...g, difficulty: 'medium' });
    expect(fromSaved({ ...g, difficulty: 'expert' })).toBeNull();
    expect(fromSaved(null)).toBeNull();
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
    const g = dealFrom(['arrow', 'diamond'], 'easy', 'arrow');
    expect(g.layout).toBe('diamond');
    expect(poolOf(g)).toEqual(['arrow', 'diamond']);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });

  it('reads saves from before pools as a pool of their own layout, and rejects a bad pool', () => {
    const { pool: _, ...old } = newGame('pyramid');
    expect(isGame(old)).toBe(true);
    expect(poolOf(old)).toEqual(['pyramid']);
    expect(isGame({ ...old, pool: [] })).toBe(false);
    expect(isGame({ ...old, pool: ['pyramid', 'pyramid'] })).toBe(false);
    expect(isGame({ ...old, pool: ['moon'] })).toBe(false);
  });

  it('plays archive layouts, alone or in a pool with its own', () => {
    const g = newGame('gnome-mahjongg/overpass', 'easy');
    expect(g.kinds).toHaveLength(layoutOf('gnome-mahjongg/overpass').slots.length);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
    // A bridge covers the tiles under it: some tiles start out blocked from two layers up.
    expect(g.kinds.some((_, i) => !free(g, i))).toBe(true);
    const mixed = dealFrom(['pyramid', 'kmahjongg/arena'], 'easy', 'pyramid');
    expect(mixed.layout).toBe('kmahjongg/arena');
    expect(isGame(JSON.parse(JSON.stringify(mixed)))).toBe(true);
    expect(isGame({ ...mixed, layout: 'kmahjongg/cat' })).toBe(false); // left out of the archive
    expect(isGame({ ...mixed, pool: ['pyramid', 'kmahjongg/nope'] })).toBe(false);
  });

  it('deals a layout wider than tall turned on an upright screen, and keeps the turn', () => {
    expect(isWide(layoutOf('turtle').slots)).toBe(true);
    expect(isWide(layoutOf('pyramid').slots)).toBe(false);
    // Upright: the wide one is turned, the tall one isn't; sideways, neither is.
    const turned = newGame('turtle', 'easy', ['turtle'], true);
    expect(turned.turned).toBe(true);
    expect(isWide(slotsOf(turned))).toBe(false);
    expect(newGame('pyramid', 'easy', ['pyramid'], true).turned).toBeUndefined();
    expect(newGame('turtle', 'easy', ['turtle'], false).turned).toBeUndefined();
    expect(dealFrom(['kmahjongg/arena'], 'easy', undefined, true).turned).toBe(true);
    // It saves and loads turned, and a turned deal plays out like any other.
    expect(isGame(JSON.parse(JSON.stringify(turned)))).toBe(true);
    expect(isGame({ ...turned, turned: 'yes' })).toBe(false);
    expect(pairsLeft(turned).length).toBeGreaterThan(0);
  });

  it('turns a layout a quarter turn clockwise, keeping its rules', () => {
    // An L of three tiles on the floor and one on top: the left column becomes the top row.
    const slots = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 2, y: 2, z: 0 }, { x: 1, y: 1, z: 1 }];
    expect(turn(slots)).toEqual([{ x: 2, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 1, y: 1, z: 1 }]);
    for (const id of [...OWN_IDS, ...ARCHIVE_IDS]) {
      const t = turn(layoutOf(id).slots);
      expect(layoutProblems(t), id).toEqual([]);
      expect(Math.min(...t.map((s) => s.x)), id).toBe(0);
      expect(Math.min(...t.map((s) => s.y)), id).toBe(0);
    }
  });

  it('names every layout, numbering archive names that repeat', () => {
    const archive = ARCHIVE_IDS.map((id) => layoutOf(id).name);
    expect(new Set(archive).size).toBe(archive.length);
    expect(archive).toEqual(expect.arrayContaining(['Crab', 'Crab 2']));
    expect(OWN_IDS.map((id) => layoutOf(id).name)).toContain('Pyramid');
    expect(OWN_IDS.every((id) => !isArchive(id)) && ARCHIVE_IDS.every(isArchive)).toBe(true);
  });

  it('loads games saved with the old Hint button', () => {
    const g = newGame('pyramid');
    expect(isGame(JSON.parse(JSON.stringify({ ...g, hint: [0, 1] })))).toBe(true);
  });
});
