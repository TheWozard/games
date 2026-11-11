// Solitaire (Klondike rules): build the four foundations up by suit from Ace to King. Seven
// tableau columns build down in alternating colors; only a King (or a run starting with one) can
// go into an empty column. The stock deals one or three cards at a time onto the waste and can be
// turned over again when it runs out.
//
// Deals are random, and kept only if a solver finds a way to win, so every game can be won.

import { isRed, rankOf, safeToFoundation, shuffledDeck, suitOf, type Card } from '../../shared/cards';

export { isRed, rankOf, suitOf, type Card };

export interface Column {
  down: Card[]; // face down, bottom first
  up: Card[]; // face up, bottom first
}

export interface Table {
  stock: Card[]; // top is last
  waste: Card[]; // top is last
  foundations: number[]; // per suit: how many cards are up (0 = empty, 13 = complete)
  tableau: Column[];
}

export type Draw = 1 | 3;

type Random = () => number;

export function deal(random: Random = Math.random): Table {
  const deck = shuffledDeck(random);
  const tableau: Column[] = [];
  let k = 0;
  for (let col = 0; col < 7; col++) {
    const cards = deck.slice(k, k + col + 1);
    k += col + 1;
    tableau.push({ down: cards.slice(0, -1), up: cards.slice(-1) });
  }
  return { stock: deck.slice(k), waste: [], foundations: [0, 0, 0, 0], tableau };
}

export const isWon = (t: Table) => t.foundations.every((n) => n === 13);

/** Whether card c can go onto its foundation now. */
export const toFoundation = (t: Table, c: Card) => t.foundations[suitOf(c)] === rankOf(c) - 1;

/** Whether a run starting with card c can go onto column `col`. */
export function fitsColumn(t: Table, c: Card, col: number): boolean {
  const { down, up } = t.tableau[col];
  if (up.length === 0) return down.length === 0 && rankOf(c) === 13;
  const top = up[up.length - 1];
  return rankOf(top) === rankOf(c) + 1 && isRed(top) !== isRed(c);
}

// ---- Moves ----

/** Where cards can be taken from. */
export type Source =
  | { from: 'waste' }
  | { from: 'foundation'; suit: number }
  | { from: 'tableau'; col: number; index: number }; // index into that column's face-up cards

/** Where they can go. */
export type Target = { to: 'foundation' } | { to: 'tableau'; col: number };

const clone = (t: Table): Table => ({
  stock: t.stock.slice(),
  waste: t.waste.slice(),
  foundations: t.foundations.slice(),
  tableau: t.tableau.map((c) => ({ down: c.down.slice(), up: c.up.slice() })),
});

/** The cards a source would lift, or null if it's empty. */
export function lifted(t: Table, s: Source): Card[] | null {
  if (s.from === 'waste') return t.waste.length ? [t.waste[t.waste.length - 1]] : null;
  if (s.from === 'foundation') {
    const n = t.foundations[s.suit];
    return n ? [s.suit * 13 + n - 1] : null;
  }
  const up = t.tableau[s.col].up;
  return s.index < up.length ? up.slice(s.index) : null;
}

export function canMove(t: Table, s: Source, d: Target): boolean {
  const cards = lifted(t, s);
  if (!cards) return false;
  if (d.to === 'foundation') return cards.length === 1 && s.from !== 'foundation' && toFoundation(t, cards[0]);
  if (s.from === 'tableau' && s.col === d.col) return false;
  return fitsColumn(t, cards[0], d.col);
}

/** Applies a move (assumed legal), flipping a newly uncovered tableau card. */
export function move(t: Table, s: Source, d: Target): Table {
  const out = clone(t);
  const cards = lifted(t, s)!;
  if (s.from === 'waste') out.waste.pop();
  else if (s.from === 'foundation') out.foundations[s.suit]--;
  else {
    const col = out.tableau[s.col];
    col.up.splice(s.index);
    if (col.up.length === 0 && col.down.length) col.up.push(col.down.pop()!);
  }
  if (d.to === 'foundation') out.foundations[suitOf(cards[0])]++;
  else out.tableau[d.col].up.push(...cards);
  return out;
}

/** Turns over stock cards onto the waste, or the waste back over as the stock when it's empty. */
export function draw(t: Table, n: Draw): Table {
  // Only the stock and waste change, so the rest of the table is shared, not copied.
  if (t.stock.length === 0) return { ...t, stock: t.waste.slice().reverse(), waste: [] };
  const stock = t.stock.slice(0, -n);
  const drawn = t.stock.slice(-n).reverse();
  return { ...t, stock, waste: [...t.waste, ...drawn] };
}

/** Every card is face up and the stock is used up: the rest can go to the foundations by itself. */
export const finishable = (t: Table) => t.stock.length === 0 && t.waste.length === 0 && t.tableau.every((c) => c.down.length === 0);

/** Plays every card up to the foundations (for a finishable table). */
export function finish(t: Table): Table {
  let out = t;
  for (let progress = true; progress; ) {
    progress = false;
    for (let col = 0; col < 7; col++) {
      const up = out.tableau[col].up;
      if (up.length && toFoundation(out, up[up.length - 1])) {
        out = move(out, { from: 'tableau', col, index: up.length - 1 }, { to: 'foundation' });
        progress = true;
      }
    }
  }
  return out;
}

/**
 * The best place to send the cards a tap picks up: the foundation if a single card fits there,
 * else a column (preferring one with cards to an empty one), else null.
 */
export function bestTarget(t: Table, s: Source): Target | null {
  if (canMove(t, s, { to: 'foundation' })) return { to: 'foundation' };
  const columns = [...Array(7).keys()].filter((col) => canMove(t, s, { to: 'tableau', col }));
  // A King already heading an otherwise empty column has nowhere better to go.
  if (s.from === 'tableau' && s.index === 0 && t.tableau[s.col].down.length === 0) {
    const nonEmpty = columns.filter((col) => t.tableau[col].up.length);
    return nonEmpty.length ? { to: 'tableau', col: nonEmpty[0] } : null;
  }
  const best = columns.find((col) => t.tableau[col].up.length) ?? columns[0];
  return best === undefined ? null : { to: 'tableau', col: best };
}

// ---- Solver ----

// Positions the solver may look at per deal. Small on purpose: a deal it can't win quickly is
// swapped for another, which keeps a new game fast on a phone (and favors deals with a clear
// path to a win, which suits a calm game).
const SOLVE_BUDGET = 3000;

/**
 * Whether the table can be won, searching up to `budget` positions. Cards that are safe to send to
 * the foundations go there straight away; otherwise moves that uncover cards come first. Moves of
 * part of a run between columns, and from the foundations back down, are skipped (rarely needed).
 */
export function solvable(start: Table, drawCount: Draw, budget = SOLVE_BUDGET): boolean {
  const seen = new Set<string>();
  const key = (t: Table) =>
    t.tableau.map((c) => `${c.down.length}:${c.up.join('.')}`).join('|') + '/' + t.stock.join('.') + '/' + t.waste.join('.') + '/' + t.foundations.join('.');

  const safe = (t: Table, c: Card) => safeToFoundation(t.foundations, c);
  const autoplay = (t: Table): Table => {
    for (let progress = true; progress; ) {
      progress = false;
      const sources: Source[] = [{ from: 'waste' }, ...[...Array(7).keys()].map((col) => ({ from: 'tableau' as const, col, index: t.tableau[col].up.length - 1 }))];
      for (const s of sources) {
        const cards = lifted(t, s);
        if (cards?.length === 1 && toFoundation(t, cards[0]) && safe(t, cards[0])) {
          t = move(t, s, { to: 'foundation' });
          progress = true;
        }
      }
    }
    return t;
  };

  const search = (t0: Table): boolean => {
    const t = autoplay(t0);
    if (isWon(t) || finishable(t)) return true;
    if (seen.size >= budget) return false;
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);

    const next: Table[] = [];
    // Tableau to foundation, then waste to foundation.
    for (let col = 0; col < 7; col++) {
      const s: Source = { from: 'tableau', col, index: t.tableau[col].up.length - 1 };
      if (canMove(t, s, { to: 'foundation' })) next.push(move(t, s, { to: 'foundation' }));
    }
    if (canMove(t, { from: 'waste' }, { to: 'foundation' })) next.push(move(t, { from: 'waste' }, { to: 'foundation' }));
    // Whole face-up runs between columns, when that uncovers a card (or clears a column for a King).
    for (let col = 0; col < 7; col++) {
      const c = t.tableau[col];
      if (c.up.length === 0 || c.down.length === 0) continue;
      for (let to = 0; to < 7; to++) {
        if (canMove(t, { from: 'tableau', col, index: 0 }, { to: 'tableau', col: to })) next.push(move(t, { from: 'tableau', col, index: 0 }, { to: 'tableau', col: to }));
      }
    }
    // Any card the stock can bring to the top of the waste, played onto a foundation or column:
    // one move each, rather than one per draw (which multiplies near-identical positions).
    for (const r of reachable(t, drawCount)) {
      if (canMove(r, { from: 'waste' }, { to: 'foundation' })) next.push(move(r, { from: 'waste' }, { to: 'foundation' }));
      for (let to = 0; to < 7; to++) {
        if (canMove(r, { from: 'waste' }, { to: 'tableau', col: to })) next.push(move(r, { from: 'waste' }, { to: 'tableau', col: to }));
      }
    }

    return next.some(search);
  };

  return search(start);
}

/**
 * Tables reached by drawing until each different card shows on top of the waste (the current top
 * included), through at most one full turn of the stock and back.
 */
export function reachable(t: Table, n: Draw): Table[] {
  const out: Table[] = [];
  const tops = new Set<Card>();
  const size = t.stock.length + t.waste.length;
  let s = t;
  for (let k = 0; k <= size + 2; k++) {
    const top = s.waste[s.waste.length - 1];
    if (top !== undefined && !tops.has(top)) {
      tops.add(top);
      out.push(s);
    }
    if (size === 0) break;
    s = draw(s, n);
  }
  return out;
}

/** A random deal the solver can win. */
export function winnableDeal(drawCount: Draw, random: Random = Math.random): Table {
  for (;;) {
    const t = deal(random);
    if (solvable(t, drawCount)) return t;
  }
}
