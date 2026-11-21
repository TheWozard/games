import { describe, expect, it } from 'vitest';
import { formatSeed, isSeed, newSeed, seeded } from './seed';

describe('seeds', () => {
  it('runs the same way from the same seed, and differently from another', () => {
    const run = (seed: number) => Array.from({ length: 20 }, seeded(seed));
    expect(run(42)).toEqual(run(42));
    expect(run(42)).not.toEqual(run(43));
    for (const x of run(7)) expect(x >= 0 && x < 1).toBe(true);
  });

  it('makes seeds in range, and shows them as eight hex digits', () => {
    for (let i = 0; i < 50; i++) expect(isSeed(newSeed())).toBe(true);
    expect(isSeed(newSeed(() => 0.999999999999))).toBe(true);
    expect(formatSeed(0)).toBe('00000000');
    expect(formatSeed(0xdeadbeef)).toBe('deadbeef');
    expect(isSeed(2 ** 32)).toBe(false);
    expect(isSeed(-1)).toBe(false);
  });
});
