import { describe, expect, it } from 'vitest';
import { deal, drawOrder, facesFor, FLOWERS, freePairs, group, isFree, LAYOUTS, matches, neighbors, reshuffle, SEASONS, type LayoutName } from './logic';

/** Replays an order of pairs: each must be free, matching, and together they clear the board. */
function replays(kinds: number[], near: ReturnType<typeof neighbors>, gone: boolean[], order: [number, number][]): boolean {
  const g = gone.slice();
  for (const [a, b] of order) {
    if (g[a] || g[b] || !matches(kinds[a], kinds[b])) return false;
    if (!isFree(a, near, g) || !isFree(b, near, g)) return false;
    g[a] = g[b] = true;
  }
  return g.every(Boolean);
}

describe('layouts', () => {
  it('have the expected tile counts and no two tiles in one place', () => {
    const sizes = Object.fromEntries(Object.entries(LAYOUTS).map(([k, l]) => [k, l.slots.length]));
    expect(sizes).toEqual({
      diamond: 80, pyramid: 82, hourglass: 92, rings: 98, butterfly: 104,
      twinPeaks: 106, cross: 108, bridge: 112, steps: 122, fortress: 136,
      lanterns: 134, rampart: 124, turtle: 124, gate: 118, dragon: 144,
    });
    // Listed (and so offered in the New dialog) smallest first.
    const counts = Object.values(sizes);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    for (const [name, { slots }] of Object.entries(LAYOUTS)) {
      // An even count, and no more than the full set of 144 tiles.
      expect(slots.length % 2).toBe(0);
      expect(slots.length).toBeLessThanOrEqual(144);
      // Fits a phone: at most 10 tiles down, and 8 across unless it's one of the wide ones (14).
      const wide = ['lanterns', 'rampart', 'turtle', 'gate'].includes(name);
      expect(Math.max(...slots.map((s) => s.x)) + 2).toBeLessThanOrEqual(wide ? 28 : 16);
      expect(Math.max(...slots.map((s) => s.y)) + 2).toBeLessThanOrEqual(20);
      for (const s of slots) for (const t of slots) {
        if (s !== t && s.z === t.z) expect(Math.abs(s.x - t.x) >= 2 || Math.abs(s.y - t.y) >= 2).toBe(true);
      }
    }
  });
});

describe('stacking', () => {
  it('rests every raised tile fully on tiles below, as real tiles must', () => {
    for (const [name, { slots }] of Object.entries(LAYOUTS)) {
      for (const s of slots) {
        if (s.z === 0) continue;
        // How much of the tile's 2 × 2 footprint the layer below covers.
        let area = 0;
        for (const t of slots) {
          if (t.z !== s.z - 1) continue;
          area += Math.max(0, Math.min(s.x, t.x) + 2 - Math.max(s.x, t.x)) * Math.max(0, Math.min(s.y, t.y) + 2 - Math.max(s.y, t.y));
        }
        expect(area, `${name}: tile at (${s.x}, ${s.y}) on layer ${s.z}`).toBe(4);
      }
    }
  });
});

describe('drawOrder', () => {
  it('draws every tile before the neighbors that cover its side and shadow', () => {
    for (const { slots } of Object.values(LAYOUTS)) {
      const order = drawOrder(slots);
      expect([...order].sort((a, b) => a - b)).toEqual(slots.map((_, i) => i));
      const at = new Map(order.map((slot, k) => [slot, k]));
      slots.forEach((a, i) => slots.forEach((b, j) => {
        // Lower layers first: a higher tile always covers a lower one.
        if (b.z > a.z) expect(at.get(j)!).toBeGreaterThan(at.get(i)!);
        if (b.z !== a.z) return;
        // On one layer: the tile touching its right side, or its bottom, even half a tile offset.
        const right = b.x === a.x + 2 && Math.abs(b.y - a.y) < 2;
        const below = b.y === a.y + 2 && Math.abs(b.x - a.x) < 2;
        if (right || below) expect(at.get(j)!).toBeGreaterThan(at.get(i)!);
      }));
    }
  });
});

describe('deal', () => {
  for (const layout of Object.keys(LAYOUTS) as LayoutName[]) {
    it(`deals ${layout} in pairs that can be cleared`, () => {
      const { slots } = LAYOUTS[layout];
      const near = neighbors(slots);
      for (let run = 0; run < 3; run++) {
        const { kinds, order } = deal(layout);
        expect(kinds).toHaveLength(slots.length);
        // Every group comes in pairs; no face more than four times, no flower or season twice.
        const counts = new Map<number, number>();
        for (const k of kinds) counts.set(group(k), (counts.get(group(k)) ?? 0) + 1);
        for (const n of counts.values()) expect(n % 2).toBe(0);
        for (const k of new Set(kinds)) expect(kinds.filter((x) => x === k).length).toBeLessThanOrEqual(k >= FLOWERS ? 1 : 4);
        expect(freePairs(kinds, near, slots.map(() => false)).length).toBeGreaterThan(0);
        expect(replays(kinds, near, slots.map(() => false), order)).toBe(true);
      }
    });
  }
});

describe('the full set', () => {
  it('matches any flower with any flower and any season with any season, nothing across', () => {
    expect(matches(5, 5)).toBe(true);
    expect(matches(5, 6)).toBe(false);
    expect(matches(FLOWERS, FLOWERS + 3)).toBe(true);
    expect(matches(SEASONS + 1, SEASONS + 2)).toBe(true);
    expect(matches(FLOWERS + 3, SEASONS)).toBe(false);
    expect(matches(33, FLOWERS)).toBe(false);
  });

  it('has 144 tiles: four of each of 34 faces, and each flower and season once', () => {
    const faces = facesFor(144);
    expect(faces).toHaveLength(144);
    for (let k = 0; k < FLOWERS; k++) expect(faces.filter((f) => f === k)).toHaveLength(4);
    for (let k = FLOWERS; k < SEASONS + 4; k++) expect(faces.filter((f) => f === k)).toHaveLength(1);
  });

  it('gives smaller layouts whole groups, so every group pairs up', () => {
    for (let run = 0; run < 50; run++) {
      const faces = facesFor(82);
      const counts = new Map<number, number>();
      for (const f of faces) counts.set(group(f), (counts.get(group(f)) ?? 0) + 1);
      expect([...counts.values()].every((n) => n === 4 || n === 2)).toBe(true);
      expect([...counts.values()].filter((n) => n === 2).length).toBeLessThanOrEqual(1);
    }
  });
});

describe('isFree', () => {
  it('needs nothing on top and one side open', () => {
    // Three in a row, one on top of the middle.
    const slots = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 2, y: 0, z: 1 }];
    const near = neighbors(slots);
    const gone = [false, false, false, false];
    expect([0, 1, 2, 3].map((i) => isFree(i, near, gone))).toEqual([true, false, true, true]);
    expect(isFree(1, near, [true, false, false, true])).toBe(true);
    expect(isFree(1, near, [false, false, false, true])).toBe(false);
  });
});

describe('reshuffle', () => {
  it('keeps the same faces on the remaining tiles', () => {
    const { slots } = LAYOUTS.pyramid;
    const near = neighbors(slots);
    const { kinds } = deal('pyramid');
    const gone = slots.map(() => false);
    for (let n = 0; n < 10; n++) {
      const [a, b] = freePairs(kinds, near, gone)[0];
      gone[a] = gone[b] = true;
    }
    const next = reshuffle(kinds, near, gone);
    const left = (k: number[]) => k.filter((_, i) => !gone[i]).sort((a, b) => a - b);
    expect(left(next)).toEqual(left(kinds));
    next.forEach((k, i) => { if (gone[i]) expect(k).toBe(kinds[i]); });
    expect(freePairs(next, near, gone).length).toBeGreaterThan(0);
  });
});
