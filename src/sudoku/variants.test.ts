import { describe, expect, it } from 'vitest';
import { parsePick } from '../shared/VariantPicker.svelte';
import { GAMES, isVariant } from './variants';

describe('variants', () => {
  it('lists both games with their difficulties, and parses each pick', () => {
    expect(GAMES.classic.options.map((o) => o.value)).toEqual(['classic:easy', 'classic:medium', 'classic:hard']);
    expect(GAMES.killer.options.map((o) => o.value)).toEqual(['killer:easy', 'killer:medium', 'killer:hard']);
    expect(parsePick(GAMES, 'killer:hard')).toEqual({ game: 'killer', setting: 'hard' });
    expect(parsePick(GAMES, 'killer:expert')).toBeNull();
    expect(isVariant('killer')).toBe(true);
    expect(isVariant('samurai')).toBe(false);
  });
});
