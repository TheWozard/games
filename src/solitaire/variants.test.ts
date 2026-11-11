import { describe, expect, it } from 'vitest';
import { isVariant, OPTIONS, parse } from './variants';

describe('variants', () => {
  it('lists both games, and parses each choice', () => {
    expect(OPTIONS.map((o) => o.value)).toEqual(['klondike:1', 'klondike:3', 'freecell:classic', 'freecell:harder', 'freecell:expert']);
    expect(parse('klondike:3')).toEqual({ variant: 'klondike', setting: '3' });
    expect(parse('freecell:expert')).toEqual({ variant: 'freecell', setting: 'expert' });
    expect(parse('freecell:3')).toBeNull();
    expect(parse('start')).toBeNull();
  });

  it('knows its variants', () => {
    expect(isVariant('klondike')).toBe(true);
    expect(isVariant('freecell')).toBe(true);
    expect(isVariant('spider')).toBe(false);
  });
});
