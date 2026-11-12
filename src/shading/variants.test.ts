import { describe, expect, it } from 'vitest';
import { parsePick } from '../shared/VariantPicker.svelte';
import { GAMES, isVariant, storageKey } from './variants';

describe('variants', () => {
  it('lists the five games with their difficulties, Nonogram first, and parses each pick', () => {
    expect(Object.keys(GAMES)).toEqual(['nonogram', 'stars', 'nurikabe', 'hitori', 'lightup']);
    expect(GAMES.nonogram.options.map((o) => o.detail)).toEqual(['8×8', '10×10', '15×15']);
    expect(GAMES.stars.options.map((o) => o.detail)).toEqual(['6×6 · 1 star', '8×8 · 1 star', '9×9 · 2 stars']);
    expect(GAMES.lightup.options.map((o) => o.value)).toEqual(['lightup:easy', 'lightup:medium', 'lightup:hard']);
    expect(parsePick(GAMES, 'hitori:hard')).toEqual({ game: 'hitori', setting: 'hard' });
    expect(parsePick(GAMES, 'hitori:expert')).toBeNull();
    expect(isVariant('nurikabe')).toBe(true);
    expect(isVariant('sudoku')).toBe(false);
    expect(storageKey('lightup')).toBe('games.shading.lightup.v1');
  });
});
