import { describe, expect, it } from 'vitest';
import { isRed, shuffledDeck } from '../../shared/cards';
import { DEALS } from './deals';
import { dealDeck, decodeDeck, encodeDeck, renameSuits, solvable, storedDeal, SUIT_RENAMES, winnableDeal } from './logic';

describe('stored deals', () => {
  it('reads back what it wrote', () => {
    for (let run = 0; run < 20; run++) {
      const deck = shuffledDeck();
      expect(decodeDeck(encodeDeck(deck))).toEqual(deck);
    }
    expect(encodeDeck([...Array(52).keys()])).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz');
  });

  it('are full decks', () => {
    expect(DEALS.length).toBeGreaterThanOrEqual(100);
    for (const code of DEALS) expect(decodeDeck(code).toSorted((a, b) => a - b)).toEqual([...Array(52).keys()]);
    expect(new Set(DEALS).size).toBe(DEALS.length);
  });

  it('rename suits the eight ways that keep colors together', () => {
    expect(new Set(SUIT_RENAMES.map(String)).size).toBe(8);
    for (const rename of SUIT_RENAMES) {
      expect(rename.toSorted()).toEqual([0, 1, 2, 3]);
      // Same-colored suits stay the same color as each other.
      expect(isRed(rename[0] * 13)).toBe(isRed(rename[3] * 13));
      expect(isRed(rename[1] * 13)).toBe(isRed(rename[2] * 13));
      expect(isRed(rename[0] * 13)).not.toBe(isRed(rename[1] * 13));
    }
  });

  it('can all be won drawing one or three, under every renaming of suits', { timeout: 120000 }, () => {
    for (const code of DEALS) {
      for (const rename of SUIT_RENAMES) {
        const table = dealDeck(renameSuits(decodeDeck(code), rename));
        expect(solvable(table, 1)).toBe(true);
        expect(solvable(table, 3)).toBe(true);
      }
    }
  });

  it('are what a new game falls back on when random deals keep missing', () => {
    const fallback = winnableDeal(1, Math.random, 0);
    const deck = [...fallback.tableau.flatMap((c) => [...c.down, ...c.up]), ...fallback.stock];
    expect(deck.toSorted((a, b) => a - b)).toEqual([...Array(52).keys()]);
    for (let run = 0; run < 10; run++) {
      for (const n of [1, 3] as const) expect(solvable(storedDeal(), n)).toBe(true);
    }
  });
});
