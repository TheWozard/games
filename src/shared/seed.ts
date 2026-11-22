// Seeds for puzzles a game can make again: the same seed always makes the same puzzle. A seed is
// a 32-bit unsigned integer, shown to the player as eight hex digits (the menu's puzzle line).

/** A new seed, at random. */
export const newSeed = (random: () => number = Math.random): number =>
  Math.floor(random() * 2 ** 32) >>> 0;

/** A source of numbers in [0, 1) that always runs the same way from the same seed (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

/** A seed as the player sees it: eight hex digits. */
export const formatSeed = (seed: number): string => (seed >>> 0).toString(16).padStart(8, '0');

export const isSeed = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 2 ** 32;
