import { describe, expect, it } from 'vitest';
import { ARCHIVE, decode } from './archive';
import { deal, isFree, layoutProblems, LAYOUTS, matches, neighbors } from './logic';

describe('archive layouts', () => {
  it('has layouts from both sources, each with its own id', () => {
    expect(ARCHIVE.length).toBeGreaterThan(50);
    expect(new Set(ARCHIVE.map((l) => l.source))).toEqual(new Set(['KMahjongg', 'GNOME Mahjongg']));
    expect(new Set(ARCHIVE.map((l) => l.id)).size).toBe(ARCHIVE.length);
    for (const { name } of ARCHIVE) expect(name).not.toBe('');
  });

  it('keeps the rules every layout keeps, on a board that pans no more than 16 × 10 tiles', () => {
    for (const { id, tiles } of ARCHIVE) {
      expect(tiles.length % 3, id).toBe(0);
      const slots = decode(tiles);
      expect(layoutProblems(slots), id).toEqual([]);
      expect(Math.min(...slots.map((s) => s.x)), id).toBe(0);
      expect(Math.min(...slots.map((s) => s.y)), id).toBe(0);
      expect(Math.max(...slots.map((s) => s.x)) + 2, id).toBeLessThanOrEqual(32);
      expect(Math.max(...slots.map((s) => s.y)) + 2, id).toBeLessThanOrEqual(20);
    }
  });

  it("agrees with the game's own layouts on the rules", () => {
    for (const { slots } of Object.values(LAYOUTS)) expect(layoutProblems(slots)).toEqual([]);
    expect(layoutProblems([{ x: 0, y: 0, z: 0 }])).toEqual(['an odd number of tiles (1)']);
    expect(layoutProblems([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }])).toEqual(['tiles overlap at (0, 0, 0)']);
    // A bridge, a tile with nothing under it, is allowed.
    expect(layoutProblems([{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 1 }])).toEqual([]);
  });

  it('counts a tile as covered by a bridge over it, even with a gap between', () => {
    // A tile on the floor, nothing over it on layer 1, and a bridge over it on layer 2.
    const slots = [{ x: 2, y: 0, z: 0 }, { x: 1, y: 0, z: 2 }];
    const near = neighbors(slots);
    expect(near[0].above).toEqual([1]);
    expect(isFree(0, near, [false, false])).toBe(false);
    expect(isFree(0, near, [false, true])).toBe(true);
  });

  it('has bridges: layouts with tiles over a gap', () => {
    const bridged = ARCHIVE.filter(({ tiles }) => {
      const slots = decode(tiles);
      return slots.some((s) => s.z > 0 && !slots.some((t) => t.z === s.z - 1 && Math.abs(t.x - s.x) < 2 && Math.abs(t.y - s.y) < 2));
    });
    expect(bridged.map((l) => l.id)).toEqual(expect.arrayContaining(['gnome-mahjongg/overpass', 'gnome-mahjongg/the_ziggurat']));
  });

  it('deals every layout in pairs that can be cleared', () => {
    for (const { id, tiles } of ARCHIVE) {
      const slots = decode(tiles);
      const near = neighbors(slots);
      const { kinds, order } = deal(slots, 'easy');
      expect(kinds, id).toHaveLength(slots.length);
      // Play the dealer's order of pairs: each pair matches and is free when taken, and it clears the board.
      const gone = slots.map(() => false);
      for (const [a, b] of order) {
        expect(matches(kinds[a], kinds[b]), id).toBe(true);
        expect(isFree(a, near, gone) && isFree(b, near, gone), id).toBe(true);
        gone[a] = gone[b] = true;
      }
      expect(gone.every(Boolean), id).toBe(true);
    }
  });
});
