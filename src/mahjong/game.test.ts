import { describe, expect, it } from 'vitest';
import { free, isGame, newGame, pairsLeft, reducer, type Game } from './game';
import { deal } from './logic';

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

  it('ignores blocked tiles, and switches selection on a non-match', () => {
    let g = newGame('fortress');
    const blocked = g.kinds.findIndex((_, i) => !free(g, i));
    expect(reducer(g, { type: 'tap', slot: blocked })).toBe(g);
    const freeTiles = g.kinds.flatMap((_, i) => (free(g, i) ? [i] : []));
    const a = freeTiles[0];
    const b = freeTiles.find((i) => g.kinds[i] !== g.kinds[a])!;
    g = reducer(reducer(g, { type: 'tap', slot: a }), { type: 'tap', slot: b });
    expect(g.selected).toBe(b);
    expect(g.gone.some(Boolean)).toBe(false);
  });

  it('hints at free pairs, stepping through them', () => {
    let g = newGame('steps');
    g = reducer(g, { type: 'hint' });
    const first = g.hint!;
    expect(g.kinds[first[0]]).toBe(g.kinds[first[1]]);
    if (pairsLeft(g).length > 1) expect(reducer(g, { type: 'hint' }).hint).not.toEqual(first);
  });

  it('shuffles the remaining faces, undoably', () => {
    let g = newGame('pyramid');
    const before = g.kinds;
    g = reducer(g, { type: 'shuffle' });
    expect([...g.kinds].sort()).toEqual([...before].sort());
    g = reducer(g, { type: 'undo' });
    expect(g.kinds).toEqual(before);
  });

  it('is done when the board is clear, following the dealer’s order', () => {
    const { kinds, order } = deal('fortress');
    let g: Game = { layout: 'fortress', kinds, gone: kinds.map(() => false), selected: null, hint: null, history: [], done: false };
    for (const [a, b] of order) g = reducer(reducer(g, { type: 'tap', slot: a }), { type: 'tap', slot: b });
    expect(g.done).toBe(true);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });
});
