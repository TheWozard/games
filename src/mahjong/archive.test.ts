import { describe, expect, it } from 'vitest';
import { seeded } from '../shared/seed';
import { ARCHIVE, decode } from './archive';
import { reaches } from './layouts';
import {
  deal,
  DIFFICULTIES,
  grader,
  isFree,
  layoutProblems,
  LAYOUTS,
  matches,
  neighbors,
  TIERS,
} from './logic';

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
    expect(
      layoutProblems([
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
      ]),
    ).toEqual(['tiles overlap at (0, 0, 0)']);
    // A bridge, a tile with nothing under it, is allowed.
    expect(
      layoutProblems([
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 0, z: 1 },
      ]),
    ).toEqual([]);
  });

  it('counts a tile as covered by a bridge over it, even with a gap between', () => {
    // A tile on the floor, nothing over it on layer 1, and a bridge over it on layer 2.
    const slots = [
      { x: 2, y: 0, z: 0 },
      { x: 1, y: 0, z: 2 },
    ];
    const near = neighbors(slots);
    expect(near[0].above).toEqual([1]);
    expect(isFree(0, near, [false, false])).toBe(false);
    expect(isFree(0, near, [false, true])).toBe(true);
  });

  it('has bridges: layouts with tiles over a gap', () => {
    const bridged = ARCHIVE.filter(({ tiles }) => {
      const slots = decode(tiles);
      return slots.some(
        (s) =>
          s.z > 0 &&
          !slots.some((t) => t.z === s.z - 1 && Math.abs(t.x - s.x) < 2 && Math.abs(t.y - s.y) < 2),
      );
    });
    expect(bridged.map((l) => l.id)).toEqual(
      expect.arrayContaining(['gnome-mahjongg/overpass', 'gnome-mahjongg/the_ziggurat']),
    );
  });

  // One test per layout, as for the game's own (logic.test.ts): all of them in one can outlast the
  // test timeout on a slow machine. Seeded, so a deal near a tier's edge can't fail it now and then.
  for (const { id, tiles } of ARCHIVE) {
    it(`deals ${id} in pairs that can be cleared, at each difficulty it's offered at`, () => {
      const slots = decode(tiles);
      const near = neighbors(slots);
      const grade = grader(near);
      for (const difficulty of DIFFICULTIES.filter((d) => reaches(id, d))) {
        const { kinds, order } = deal(slots, difficulty, seeded(1));
        expect(kinds, id).toHaveLength(slots.length);
        // Play the dealer's order of pairs: each pair matches and is free when taken, and it clears the board.
        const gone = slots.map(() => false);
        for (const [a, b] of order) {
          expect(matches(kinds[a], kinds[b]), id).toBe(true);
          expect(isFree(a, near, gone) && isFree(b, near, gone), id).toBe(true);
          gone[a] = gone[b] = true;
        }
        expect(gone.every(Boolean), id).toBe(true);
        // About as hard as asked: inside its tier, give or take what a grade can be off by (as for the game's own).
        const [from, to] = TIERS[difficulty];
        const share = grade(kinds, 400, seeded(2));
        expect(share, `${id} ${difficulty}`).toBeGreaterThanOrEqual(from - 0.15);
        expect(share, `${id} ${difficulty}`).toBeLessThanOrEqual(to + 0.15);
      }
    }, 10_000);
  }

  it("leaves out only the difficulties a layout really can't reach", () => {
    // Clubs: most of its deals are too easy for Balance (some land in it), and all for Focus.
    const slots = decode(ARCHIVE.find((l) => l.id === 'kmahjongg/clubs')!.tiles);
    const grade = grader(neighbors(slots));
    for (const difficulty of ['medium', 'hard'] as const) {
      expect(reaches('kmahjongg/clubs', difficulty)).toBe(false);
      const shares = Array.from({ length: 10 }, (_, k) =>
        grade(deal(slots, difficulty, seeded(k + 1)).kinds, 400, seeded(k + 1)),
      );
      expect(
        shares.filter((share) => share > TIERS[difficulty][1]).length,
        difficulty,
      ).toBeGreaterThan(5);
    }
    expect(reaches('kmahjongg/clubs', 'easy')).toBe(true);
    expect(Object.keys(LAYOUTS).every((id) => DIFFICULTIES.every((d) => reaches(id, d)))).toBe(
      true,
    );
  }, 20_000);
});
