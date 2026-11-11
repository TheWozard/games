import { describe, expect, it } from 'vitest';
import {
  bestTarget, canMove, deal, draw, finish, finishable, fitsColumn, isWon, move, rankOf, reachable, solvable, suitOf, toFoundation,
  winnableDeal, type Table,
} from './logic';

const card = (rank: number, suit: number) => suit * 13 + rank - 1; // suit: 0 ♠, 1 ♥, 2 ♦, 3 ♣
const empty = (): Table => ({ stock: [], waste: [], foundations: [0, 0, 0, 0], tableau: Array.from({ length: 7 }, () => ({ down: [], up: [] })) });

describe('deal', () => {
  it('lays out all 52 cards: columns of 1 to 7 with the top card up, the rest in the stock', () => {
    const t = deal();
    const all = [...t.stock, ...t.tableau.flatMap((c) => [...c.down, ...c.up])];
    expect(new Set(all).size).toBe(52);
    t.tableau.forEach((c, k) => {
      expect(c.down).toHaveLength(k);
      expect(c.up).toHaveLength(1);
    });
    expect(t.stock).toHaveLength(24);
  });

  // Finding a winnable deal can take a few tries, so this gets more time than the default when
  // the machine is busy.
  it('only gives deals the solver can win', { timeout: 30000 }, () => {
    for (const n of [1, 3] as const) {
      for (let run = 0; run < 2; run++) expect(solvable(winnableDeal(n), n)).toBe(true);
    }
  });
});

describe('rules', () => {
  it('builds foundations up by suit from the Ace', () => {
    const t = empty();
    expect(toFoundation(t, card(1, 2))).toBe(true);
    expect(toFoundation(t, card(2, 2))).toBe(false);
    t.foundations[2] = 1;
    expect(toFoundation(t, card(2, 2))).toBe(true);
  });

  it('builds columns down in alternating colors, Kings only into empty columns', () => {
    const t = empty();
    t.tableau[0].up = [card(8, 0)]; // black 8
    expect(fitsColumn(t, card(7, 1), 0)).toBe(true); // red 7
    expect(fitsColumn(t, card(7, 3), 0)).toBe(false); // black 7
    expect(fitsColumn(t, card(6, 1), 0)).toBe(false);
    expect(fitsColumn(t, card(13, 1), 1)).toBe(true); // King into empty
    expect(fitsColumn(t, card(12, 1), 1)).toBe(false);
  });

  it('moves runs and flips the card underneath', () => {
    const t = empty();
    t.tableau[0] = { down: [card(2, 3)], up: [card(7, 1), card(6, 0)] };
    t.tableau[1].up = [card(8, 3)];
    expect(canMove(t, { from: 'tableau', col: 0, index: 0 }, { to: 'tableau', col: 1 })).toBe(true);
    const after = move(t, { from: 'tableau', col: 0, index: 0 }, { to: 'tableau', col: 1 });
    expect(after.tableau[1].up).toEqual([card(8, 3), card(7, 1), card(6, 0)]);
    expect(after.tableau[0]).toEqual({ down: [], up: [card(2, 3)] });
    expect(t.tableau[0].up).toHaveLength(2); // the original is untouched
  });

  it('draws one or three, and turns the waste back over in order', () => {
    const t = { ...empty(), stock: [1, 2, 3, 4, 5] }; // top is 5
    expect(draw(t, 1).waste).toEqual([5]);
    const three = draw(t, 3);
    expect(three.waste).toEqual([5, 4, 3]);
    expect(three.stock).toEqual([1, 2]);
    const all = draw(draw(three, 3), 3); // stock empty → turn over
    expect(all.stock).toEqual([1, 2, 3, 4, 5].reverse().reverse());
    expect(all.waste).toEqual([]);
  });

  it('lists the cards the stock can bring up', () => {
    const t = { ...empty(), stock: [1, 2, 3, 4, 5, 6] };
    expect(reachable(t, 1).map((r) => r.waste.at(-1))).toEqual([6, 5, 4, 3, 2, 1]);
    expect(reachable(t, 3).map((r) => r.waste.at(-1))).toEqual([4, 1]); // every third card
  });

  it('prefers the foundation, then a column with cards', () => {
    const t = empty();
    t.waste = [card(1, 0)];
    expect(bestTarget(t, { from: 'waste' })).toEqual({ to: 'foundation' });
    t.waste = [card(7, 1)];
    t.tableau[3].up = [card(8, 0)];
    expect(bestTarget(t, { from: 'waste' })).toEqual({ to: 'tableau', col: 3 });
    t.waste = [card(5, 1)];
    expect(bestTarget(t, { from: 'waste' })).toBeNull();
  });

  it('plays everything home once nothing is hidden', () => {
    const t = empty();
    // Each suit's cards in one column, King at the bottom.
    for (let s = 0; s < 4; s++) t.tableau[s].up = Array.from({ length: 13 }, (_, k) => card(13 - k, s));
    expect(finishable(t)).toBe(true);
    const done = finish(t);
    expect(isWon(done)).toBe(true);
    expect(done.foundations.every((n) => n === 13)).toBe(true);
  });

  it('names cards by suit and rank', () => {
    expect([rankOf(card(1, 0)), suitOf(card(1, 0))]).toEqual([1, 0]);
    expect([rankOf(card(13, 3)), suitOf(card(13, 3))]).toEqual([13, 3]);
  });
});
