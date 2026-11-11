// FreeCell: all 52 cards are dealt face up into eight columns. Build the four foundations up by
// suit from Ace to King. Columns build down in alternating colors (a red 7 on a black 8), and any
// card or run can go into an empty column. Each free cell holds one card. A run moves as a unit
// when there's room to move it card by card through the free cells and empty columns.
//
// Nearly every deal can be won with four free cells, fewer with two or three; a solver checks
// each deal, so every game can be won.
import { isRed, rankOf, safeToFoundation, shuffledDeck, suitOf, type Card } from '../../shared/cards';

export const DIFFICULTIES = {
  classic: { label: 'Classic', cells: 4 },
  harder: { label: 'Harder', cells: 3 },
  expert: { label: 'Expert', cells: 2 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;
export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

export const COLUMNS = 8;

export interface Table {
  cells: (Card | null)[];
  foundations: number[]; // per suit: how many cards are up (0 = empty, 13 = complete)
  columns: Card[][]; // bottom first
}

/** Where cards can be taken from: a free cell, or a column from `index` to its end. */
export type Source = { from: 'cell'; i: number } | { from: 'column'; col: number; index: number };
/** Where they can go. */
export type Target = { to: 'foundation' } | { to: 'cell'; i: number } | { to: 'column'; col: number };

type Random = () => number;

export function deal(cells: number, random: Random = Math.random): Table {
  const columns: Card[][] = Array.from({ length: COLUMNS }, () => []);
  shuffledDeck(random).forEach((c, k) => columns[k % COLUMNS].push(c));
  return { cells: new Array<Card | null>(cells).fill(null), foundations: [0, 0, 0, 0], columns };
}

export const isWon = (t: Table) => t.foundations.every((n) => n === 13);

const toFoundation = (t: Table, c: Card) => t.foundations[suitOf(c)] === rankOf(c) - 1;
/** Whether card c can go on top of card `onto` in a column. */
const fits = (c: Card, onto: Card) => rankOf(onto) === rankOf(c) + 1 && isRed(onto) !== isRed(c);

/** Where the run at the bottom of a column starts: col[start..] builds down in alternating colors. */
export function runStart(col: readonly Card[]): number {
  let i = col.length - 1;
  while (i > 0 && fits(col[i], col[i - 1])) i--;
  return Math.max(0, i);
}

/** How many cards can move at once onto a column: one per free cell plus one, doubled per spare empty column. */
export function capacity(t: Table, toEmpty: boolean): number {
  const free = t.cells.filter((c) => c === null).length;
  const empty = t.columns.filter((c) => c.length === 0).length - (toEmpty ? 1 : 0);
  return (free + 1) * 2 ** Math.max(0, empty);
}

/** The cards a source would lift, or null if there are none there (or they aren't one run). */
export function lifted(t: Table, s: Source): Card[] | null {
  if (s.from === 'cell') {
    const c = t.cells[s.i];
    return c === null || c === undefined ? null : [c];
  }
  const col = t.columns[s.col];
  if (!col || s.index < 0 || s.index >= col.length || s.index < runStart(col)) return null;
  return col.slice(s.index);
}

export function canMove(t: Table, s: Source, d: Target): boolean {
  const cards = lifted(t, s);
  if (!cards) return false;
  switch (d.to) {
    case 'foundation':
      return cards.length === 1 && toFoundation(t, cards[0]);
    case 'cell':
      return cards.length === 1 && s.from === 'column' && t.cells[d.i] === null;
    case 'column': {
      const onto = t.columns[d.col];
      if (!onto || (s.from === 'column' && s.col === d.col)) return false;
      if (onto.length === 0) return cards.length <= capacity(t, true);
      return fits(cards[0], onto[onto.length - 1]) && cards.length <= capacity(t, false);
    }
  }
}

/** Applies a move (assumed legal). */
export function move(t: Table, s: Source, d: Target): Table {
  const cards = lifted(t, s)!;
  const cells = t.cells.slice();
  const foundations = t.foundations.slice();
  const columns = t.columns.slice();
  if (s.from === 'cell') cells[s.i] = null;
  else columns[s.col] = columns[s.col].slice(0, s.index);
  if (d.to === 'foundation') foundations[suitOf(cards[0])]++;
  else if (d.to === 'cell') cells[d.i] = cards[0];
  else columns[d.col] = [...columns[d.col], ...cards];
  return { cells, foundations, columns };
}

/** Sends every card that's safe to put up (see safeToFoundation) to its foundation. */
export function autoplay(t: Table): Table {
  for (let progress = true; progress; ) {
    progress = false;
    const sources: Source[] = [
      ...t.cells.map((_, i): Source => ({ from: 'cell', i })),
      ...t.columns.map((c, col): Source => ({ from: 'column', col, index: c.length - 1 })),
    ];
    for (const s of sources) {
      const cards = lifted(t, s);
      if (cards?.length === 1 && toFoundation(t, cards[0]) && safeToFoundation(t.foundations, cards[0])) {
        t = move(t, s, { to: 'foundation' });
        progress = true;
      }
    }
  }
  return t;
}

/**
 * The best place for the cards a tap picks up: the foundation for a single card that fits, else
 * a column with cards, else (one card) a free cell, else an empty column; null if none will do.
 */
export function bestTarget(t: Table, s: Source): Target | null {
  if (canMove(t, s, { to: 'foundation' })) return { to: 'foundation' };
  const cols = [...Array(COLUMNS).keys()];
  const onto = cols.find((col) => t.columns[col].length > 0 && canMove(t, s, { to: 'column', col }));
  if (onto !== undefined) return { to: 'column', col: onto };
  const cell = t.cells.indexOf(null);
  if (cell !== -1 && canMove(t, s, { to: 'cell', i: cell })) return { to: 'cell', i: cell };
  // Moving a whole column into an empty one changes nothing.
  if (s.from === 'column' && s.index === 0) return null;
  const empty = cols.find((col) => t.columns[col].length === 0 && canMove(t, s, { to: 'column', col }));
  return empty === undefined ? null : { to: 'column', col: empty };
}

// ---- Solver ----

// Positions the solver may look at per deal. A deal it can't win within this is swapped for
// another: a deal that can't be won uses up the whole budget, so a small one keeps a new game
// quick on a phone (worst case about a quarter second on a laptop with two free cells).
const SOLVE_BUDGET = 1500;

/**
 * A way to win from this table (moves to play, each followed by autoplay), looking at up to
 * `budget` positions; null if none is found. Safe cards go up straight away. The search always
 * continues from the position that looks closest to a win (see score), and finds a win for
 * nearly every four-cell deal within a few hundred positions.
 */
export function solve(start: Table, budget = SOLVE_BUDGET): [Source, Target][] | null {
  const seen = new Set<string>();
  // Column order and which cell holds which card don't matter, so they're sorted.
  const key = (t: Table) =>
    t.columns.map((c) => c.join('.')).sort().join('|') + '/' + t.cells.filter((c) => c !== null).sort((a, b) => a - b).join('.');

  // Best first: always carry on from the most promising position seen so far. Each position
  // remembers the one it came from and the move, to read the winning line back at the end.
  interface Node { t: Table; parent: Node | null; move: [Source, Target] | null }
  const path = (n: Node) => {
    const out: [Source, Target][] = [];
    for (let at: Node | null = n; at?.move; at = at.parent) out.push(at.move);
    return out.reverse();
  };
  const open = new Heap<Node>();
  const visit = (t0: Table, parent: Node | null, m: [Source, Target] | null): Node | null => {
    const node = { t: autoplay(t0), parent, move: m };
    if (isWon(node.t)) return node;
    const k = key(node.t);
    if (!seen.has(k)) {
      seen.add(k);
      open.push(node, score(node.t));
    }
    return null;
  };
  const won = visit(start, null, null);
  if (won) return path(won);
  while (open.size && seen.size < budget) {
    const n = open.pop()!;
    for (const m of candidates(n.t)) {
      const end = visit(move(n.t, m[0], m[1]), n, m);
      if (end) return path(end);
    }
  }
  return null;
}

export const solvable = (start: Table, budget = SOLVE_BUDGET) => solve(start, budget) !== null;

/**
 * How far a position seems from a win (lower is better): cards still to go up, how deeply the
 * next card each foundation needs is buried, and a little for full cells and no empty columns.
 */
function score(t: Table): number {
  let buried = 0;
  for (let suit = 0; suit < 4; suit++) {
    if (t.foundations[suit] === 13) continue;
    const want = suit * 13 + t.foundations[suit];
    for (const col of t.columns) {
      const i = col.indexOf(want);
      if (i !== -1) buried += col.length - 1 - i;
    }
  }
  // Cards sitting on top of a lower card in their column: each must move before that one can.
  let blocking = 0;
  for (const col of t.columns) {
    let low = 14;
    for (const c of col) {
      if (rankOf(c) > low) blocking++;
      low = Math.min(low, rankOf(c));
    }
  }
  const out = t.foundations.reduce((a, n) => a + n, 0);
  const free = t.cells.filter((c) => c === null).length;
  const empty = t.columns.filter((c) => c.length === 0).length;
  return (52 - out) * 5 + blocking * 3 + buried - free * 2 - empty * 5;
}

/** A small binary min-heap of items by priority. */
class Heap<T> {
  private items: { item: T; p: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(item: T, p: number) {
    const a = this.items;
    a.push({ item, p });
    for (let i = a.length - 1; i > 0; ) {
      const up = (i - 1) >> 1;
      if (a[up].p <= a[i].p) break;
      [a[up], a[i]] = [a[i], a[up]];
      i = up;
    }
  }
  pop(): T | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const top = a[0].item;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].p < a[m].p) m = l;
        if (r < a.length && a[r].p < a[m].p) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

function candidates(t: Table): [Source, Target][] {
  const out: [Source, Target][] = [];
  const cols = [...Array(COLUMNS).keys()];
  const cellSources = t.cells.flatMap((c, i): Source[] => (c === null ? [] : [{ from: 'cell', i }]));
  const tops = cols.flatMap((col): Source[] => (t.columns[col].length ? [{ from: 'column', col, index: t.columns[col].length - 1 }] : []));
  const firstEmpty = cols.find((col) => t.columns[col].length === 0);
  const firstCell = t.cells.indexOf(null);

  // To the foundations.
  for (const s of [...tops, ...cellSources]) if (canMove(t, s, { to: 'foundation' })) out.push([s, { to: 'foundation' }]);
  // Runs onto columns with cards: the part of each run whose head fits there. Whole runs first.
  const runMoves: [number, [Source, Target]][] = [];
  for (const from of cols) {
    const col = t.columns[from];
    if (!col.length) continue;
    const start = runStart(col);
    for (const to of cols) {
      const onto = t.columns[to];
      if (to === from || !onto.length) continue;
      const head = onto[onto.length - 1];
      for (let i = start; i < col.length; i++) {
        if (fits(col[i], head)) {
          const s: Source = { from: 'column', col: from, index: i };
          if (canMove(t, s, { to: 'column', col: to })) runMoves.push([i === start ? 0 : 1, [s, { to: 'column', col: to }]]);
          break;
        }
      }
    }
  }
  runMoves.sort((a, b) => a[0] - b[0]);
  out.push(...runMoves.map(([, m]) => m));
  // Free cells onto columns with cards.
  for (const s of cellSources) {
    for (const col of cols) if (t.columns[col].length && canMove(t, s, { to: 'column', col })) out.push([s, { to: 'column', col }]);
  }
  if (firstEmpty !== undefined) {
    // The longest movable run into an empty column (not a whole column: that changes nothing).
    for (const from of cols) {
      const col = t.columns[from];
      if (!col.length) continue;
      const index = Math.max(runStart(col), col.length - capacity(t, true));
      if (index > 0) out.push([{ from: 'column', col: from, index }, { to: 'column', col: firstEmpty }]);
    }
    for (const s of cellSources) out.push([s, { to: 'column', col: firstEmpty }]);
  }
  if (firstCell !== -1) for (const s of tops) out.push([s, { to: 'cell', i: firstCell }]);
  return out;
}

/** A random deal the solver can win. */
export function winnableDeal(cells: number, random: Random = Math.random): Table {
  for (;;) {
    const t = deal(cells, random);
    if (solvable(t)) return t;
  }
}
