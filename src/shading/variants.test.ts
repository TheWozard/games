import { describe, expect, it } from 'vitest';
import { parsePick } from '../shared/VariantPicker.svelte';
import { GAMES, isVariant, storageKey } from './variants';

describe('variants', () => {
  it('lists the four games with their difficulties, Star Battle first, and parses each pick', () => {
    expect(Object.keys(GAMES)).toEqual(['stars', 'nurikabe', 'hitori', 'lightup']);
    expect(GAMES.stars.options.map((o) => o.detail)).toEqual(['6×6 · 1 star', '8×8 · 1 star', '9×9 · 2 stars']);
    expect(GAMES.lightup.options.map((o) => o.value)).toEqual(['lightup:easy', 'lightup:medium', 'lightup:hard']);
    expect(parsePick(GAMES, 'hitori:hard')).toEqual({ game: 'hitori', setting: 'hard' });
    expect(parsePick(GAMES, 'hitori:expert')).toBeNull();
    expect(isVariant('nurikabe')).toBe(true);
    expect(isVariant('sudoku')).toBe(false);
    expect(isVariant('nonogram')).toBe(false); // its own page now: a page last left on it opens on Star Battle
    expect(storageKey('lightup')).toBe('games.shading.lightup.v1');
  });
});
