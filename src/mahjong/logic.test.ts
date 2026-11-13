import { describe, expect, it } from 'vitest';
import { deal, DIFFICULTIES, drawOrder, facesFor, FLOWERS, freePairs, grader, group, isFree, LAYOUTS, matches, neighbors, reshuffle, SEASONS, TIERS, type LayoutName } from './logic';

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
      arrow: 78, diamond: 80, pyramid: 82, hourglass: 92, crown: 96, rings: 98, heart: 100, butterfly: 104,
      twinPeaks: 106, cross: 108, bridge: 112, pine: 116, steps: 122, fortress: 136, fish: 136,
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
      const wide = ['lanterns', 'rampart', 'turtle', 'gate', 'fish'].includes(name);
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
    it(`deals ${layout} in pairs that can be cleared, at every difficulty`, () => {
      const { slots } = LAYOUTS[layout];
      const near = neighbors(slots);
      for (const difficulty of DIFFICULTIES) {
        for (let run = 0; run < 2; run++) {
          const { kinds, order } = deal(layout, difficulty);
          expect(kinds).toHaveLength(slots.length);
          // Every group comes in pairs; no face more than four times, no flower or season twice.
          const counts = new Map<number, number>();
          for (const k of kinds) counts.set(group(k), (counts.get(group(k)) ?? 0) + 1);
          for (const n of counts.values()) expect(n % 2).toBe(0);
          for (const k of new Set(kinds)) expect(kinds.filter((x) => x === k).length).toBeLessThanOrEqual(k >= FLOWERS ? 1 : 4);
          expect(freePairs(kinds, near, slots.map(() => false)).length).toBeGreaterThan(0);
          expect(replays(kinds, near, slots.map(() => false), order)).toBe(true);
        }
      }
    });
  }
});

/** The share of `runs` games won taking any free matching pair at random: slow, but plainly right. */
function carelessWins(kinds: number[], near: ReturnType<typeof neighbors>, runs: number): number {
  let won = 0;
  for (let run = 0; run < runs; run++) {
    const gone = kinds.map(() => false);
    for (let pairs = freePairs(kinds, near, gone); pairs.length; pairs = freePairs(kinds, near, gone)) {
      const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
      gone[a] = gone[b] = true;
    }
    if (gone.every(Boolean)) won++;
  }
  return won / runs;
}

describe('difficulty', () => {
  it('grades a deal as plain careless play does', () => {
    const near = neighbors(LAYOUTS.pyramid.slots);
    const grade = grader(near);
    for (const difficulty of DIFFICULTIES) {
      const { kinds } = deal('pyramid', difficulty);
      expect(Math.abs(grade(kinds, 1000) - carelessWins(kinds, near, 1000))).toBeLessThan(0.08);
    }
  });

  it('grades a board that cannot go wrong as always won, and a dead one as never', () => {
    // One layer, one row: every free pair is safe to take when the row is all one face per end.
    const slots = Array.from({ length: 4 }, (_, i) => ({ x: i * 2, y: 0, z: 0 }));
    const grade = grader(neighbors(slots));
    expect(grade([0, 1, 1, 0])).toBe(1); // the ends match, then the middle pair
    expect(grade([0, 1, 0, 1])).toBe(0); // the ends don't match: nothing to take
  });

  it('deals each difficulty inside its tier of careless wins', () => {
    let inside = 0;
    let dealt = 0;
    for (const layout of Object.keys(LAYOUTS) as LayoutName[]) {
      const grade = grader(neighbors(LAYOUTS[layout].slots));
      for (const difficulty of DIFFICULTIES) {
        const [from, to] = TIERS[difficulty];
        for (let run = 0; run < 2; run++) {
          const share = grade(deal(layout, difficulty).kinds, 400);
          // Grades are estimates, so allow a little either side, and a rare miss a little further.
          expect(share).toBeGreaterThanOrEqual(from - 0.15);
          expect(share).toBeLessThanOrEqual(to + 0.15);
          if (share >= from - 0.05 && share <= to + 0.05) inside++;
          dealt++;
        }
      }
    }
    expect(inside / dealt).toBeGreaterThanOrEqual(0.85);
  });

  it('can be driven by a seeded random source', () => {
    const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    expect(deal('diamond', 'hard', seeded(7))).toEqual(deal('diamond', 'hard', seeded(7)));
  });
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
