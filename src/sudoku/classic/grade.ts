// Rates a Sudoku by the techniques a person needs to solve it, by solving it the way a person
// would: always with the easiest technique that makes progress. Its tier is the hardest one used.
//
//   1 (Easy)    naked and hidden singles
//   2 (Medium)  pointing and claiming; naked and hidden pairs
//   3 (Hard)    naked and hidden triples, X-Wing, XY-Wing, Swordfish; naked and hidden quads
//
// Every technique only rules out candidates that can't be right, so a puzzle these solve has
// exactly one solution, found without guessing.
//
// Units are rows, columns and regions (the 3×3 boxes, or Jigsaw's irregular shapes); techniques
// only rely on rows and columns being straight lines where they say so (fish).
//
// Candidates are bitmasks (bit d set = digit d possible). Where a digit can go within a unit is a
// 9-bit mask too (bit k set = the unit's k-th cell), which keeps the searches allocation-light:
// grading runs dozens of times for every puzzle made.

/**
 * Where the digits must not repeat: the 27 units (rows 0–8, columns 9–17, then the nine regions,
 * each listing its 9 cells in order) and each cell's peers. Classic's regions are the 3×3 boxes;
 * Jigsaw's are irregular.
 */
export interface Geometry {
  units: readonly (readonly number[])[];
  peers: readonly (readonly number[])[];
  isPeer: readonly (readonly boolean[])[];
  /** Each cell's three units: its row, column and region. */
  unitsOf: readonly (readonly number[])[];
}

/** The 3×3 boxes, as a region number (0–8) per cell. */
export const BOXES: readonly number[] = Array.from({ length: 81 }, (_, i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3));

const geometries = new WeakMap<readonly number[], Geometry>();

/** The geometry for `regions` (a region number 0–8 per cell, 9 cells each), cached per array. */
export function geometry(regions: readonly number[] = BOXES): Geometry {
  let g = geometries.get(regions);
  if (!g) {
    const units = [
      ...Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c)),
      ...Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c)),
      ...Array.from({ length: 9 }, (_, k) => [...Array(81).keys()].filter((i) => regions[i] === k)),
    ];
    const unitsOf = Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), 9 + (i % 9), 18 + regions[i]]);
    const peers = Array.from({ length: 81 }, (_, i) => {
      const out = new Set<number>();
      for (const u of unitsOf[i]) for (const j of units[u]) if (j !== i) out.add(j);
      return [...out];
    });
    const isPeer = peers.map((ps) => {
      const row = new Array<boolean>(81).fill(false);
      for (const p of ps) row[p] = true;
      return row;
    });
    g = { units, peers, isPeer, unitsOf };
    geometries.set(regions, g);
  }
  return g;
}

const ALL = 0x3fe; // bits 1..9

const bitCount = (m: number) => { let n = 0; for (; m; n++) m &= m - 1; return n; };
const lowBit = (m: number) => 31 - Math.clz32(m & -m);

/** Every k-bit subset of the set bits of `mask`. */
function subsets(mask: number, k: number): number[] {
  const bits: number[] = [];
  for (let m = mask; m; m &= m - 1) bits.push(m & -m);
  const out: number[] = [];
  const pick = (from: number, acc: number, left: number) => {
    if (!left) { out.push(acc); return; }
    for (let i = from; i <= bits.length - left; i++) pick(i + 1, acc | bits[i], left - 1);
  };
  pick(0, 0, k);
  return out;
}

class Board {
  readonly values: number[];
  readonly cand: number[];
  empty = 0;

  constructor(puzzle: readonly number[], readonly g: Geometry) {
    this.values = puzzle.slice();
    this.cand = new Array<number>(81);
    for (let i = 0; i < 81; i++) {
      let used = 0;
      for (const p of g.peers[i]) used |= 1 << this.values[p];
      this.cand[i] = this.values[i] ? 0 : ALL & ~used;
      if (!this.values[i]) this.empty++;
    }
  }

  place(i: number, d: number) {
    this.values[i] = d;
    this.cand[i] = 0;
    this.empty--;
    const bit = ~(1 << d);
    for (const p of this.g.peers[i]) this.cand[p] &= bit;
  }

  /** Where digit d can go in unit u, as a mask of the unit's cells. */
  where(u: number, d: number): number {
    const cells = this.g.units[u];
    const bit = 1 << d;
    let m = 0;
    for (let k = 0; k < 9; k++) if (this.cand[cells[k]] & bit) m |= 1 << k;
    return m;
  }

  /** Rules the digits of `digits` out of unit u's cells in `at` (a cell mask). True if any went. */
  remove(u: number, at: number, digits: number): boolean {
    const cells = this.g.units[u];
    let did = false;
    for (; at; at &= at - 1) {
      const i = cells[lowBit(at)];
      if (this.cand[i] & digits) { this.cand[i] &= ~digits; did = true; }
    }
    return did;
  }
}

// ---- Tier 1 ----

function nakedSingle(b: Board): boolean {
  for (let i = 0; i < 81; i++) {
    const m = b.cand[i];
    if (m && !(m & (m - 1))) { b.place(i, lowBit(m)); return true; }
  }
  return false;
}

function hiddenSingle(b: Board): boolean {
  for (let u = 0; u < 27; u++) {
    for (let d = 1; d <= 9; d++) {
      const m = b.where(u, d);
      if (m && !(m & (m - 1))) { b.place(b.g.units[u][lowBit(m)], d); return true; }
    }
  }
  return false;
}

// ---- Tier 2 (and the bigger subsets in tier 3) ----

/**
 * Pointing and claiming: when a digit's places in one unit all lie in another unit too (a box's
 * row, a row's stretch through one region), it leaves the rest of that other unit.
 */
function lockedCandidates(b: Board): boolean {
  const { units, unitsOf } = b.g;
  for (let u = 0; u < 27; u++) {
    for (let d = 1; d <= 9; d++) {
      const m = b.where(u, d);
      if (bitCount(m) < 2) continue;
      const at: number[] = [];
      for (let s = m; s; s &= s - 1) at.push(units[u][lowBit(s)]);
      for (const w of unitsOf[at[0]]) {
        if (w === u || !at.every((i) => unitsOf[i].includes(w))) continue;
        let others = 0;
        units[w].forEach((i, k) => { if (!at.includes(i)) others |= 1 << k; });
        if (b.remove(w, others, 1 << d)) return true;
      }
    }
  }
  return false;
}

/** n cells of a unit whose candidates are only n digits: those digits leave the unit's other cells. */
function nakedSubset(b: Board, n: number): boolean {
  for (let u = 0; u < 27; u++) {
    const cells = b.g.units[u];
    let open = 0;
    let unsolved = 0;
    for (let k = 0; k < 9; k++) {
      const c = bitCount(b.cand[cells[k]]);
      if (c) unsolved++;
      if (c >= 2 && c <= n) open |= 1 << k;
    }
    if (bitCount(open) < n || unsolved <= n) continue;
    for (const set of subsets(open, n)) {
      let digits = 0;
      for (let s = set; s; s &= s - 1) digits |= b.cand[cells[lowBit(s)]];
      if (bitCount(digits) === n && b.remove(u, ~set & 0x1ff, digits)) return true;
    }
  }
  return false;
}

/** n digits of a unit that fit only in the same n cells: those cells hold nothing else. */
function hiddenSubset(b: Board, n: number): boolean {
  for (let u = 0; u < 27; u++) {
    const where = new Array<number>(10).fill(0);
    let digits = 0;
    for (let d = 1; d <= 9; d++) {
      where[d] = b.where(u, d);
      const c = bitCount(where[d]);
      if (c >= 2 && c <= n) digits |= 1 << d;
    }
    if (bitCount(digits) < n) continue;
    for (const set of subsets(digits, n)) {
      let at = 0;
      for (let s = set; s; s &= s - 1) at |= where[lowBit(s)];
      if (bitCount(at) === n && b.remove(u, at, ALL & ~set)) return true;
    }
  }
  return false;
}

// ---- Tier 3 ----

/**
 * X-Wing (n = 2) and Swordfish (n = 3): when a digit's places in n rows all lie in the same n
 * columns, those rows fill the digit's spots in those columns, so it leaves the columns' other
 * cells (and the same with rows and columns swapped).
 */
function fish(b: Board, n: number): boolean {
  for (const base of [0, 9]) {
    const cover = 9 - base; // rows 0–8 are crossed by columns 9–17, and the other way round
    for (let d = 1; d <= 9; d++) {
      // A row's places for d, as a mask, are the columns it can go in (and vice versa).
      const spots: number[] = [];
      let lines = 0;
      for (let k = 0; k < 9; k++) {
        spots.push(b.where(base + k, d));
        const c = bitCount(spots[k]);
        if (c >= 2 && c <= n) lines |= 1 << k;
      }
      if (bitCount(lines) < n) continue;
      for (const set of subsets(lines, n)) {
        let across = 0;
        for (let s = set; s; s &= s - 1) across |= spots[lowBit(s)];
        if (bitCount(across) !== n) continue;
        let did = false;
        for (let a = across; a; a &= a - 1) did = b.remove(cover + lowBit(a), ~set & 0x1ff, 1 << d) || did;
        if (did) return true;
      }
    }
  }
  return false;
}

/**
 * XY-Wing: a cell with candidates {x, y} sees one with {x, z} and one with {y, z}. Whichever the
 * pivot is, one of the wings is z, so z leaves every cell that sees both wings.
 */
function xyWing(b: Board): boolean {
  const { peers, isPeer } = b.g;
  const pairs: number[] = [];
  for (let i = 0; i < 81; i++) if (bitCount(b.cand[i]) === 2) pairs.push(i);
  for (const pivot of pairs) {
    const pm = b.cand[pivot];
    const wings = pairs.filter((w) => isPeer[pivot][w] && bitCount(b.cand[w] & pm) === 1);
    for (let a = 0; a < wings.length; a++) {
      for (let c = a + 1; c < wings.length; c++) {
        const wa = b.cand[wings[a]];
        const wc = b.cand[wings[c]];
        const z = wa & wc & ~pm;
        if (!z || (wa & pm) === (wc & pm)) continue;
        let did = false;
        for (const i of peers[wings[a]]) {
          if (i !== pivot && isPeer[wings[c]][i] && b.cand[i] & z) { b.cand[i] &= ~z; did = true; }
        }
        if (did) return true;
      }
    }
  }
  return false;
}

/** The techniques, easiest first, each with its tier. */
const TECHNIQUES: readonly [tier: number, step: (b: Board) => boolean][] = [
  [1, nakedSingle],
  [1, hiddenSingle],
  [2, lockedCandidates],
  [2, (b) => nakedSubset(b, 2)],
  [2, (b) => hiddenSubset(b, 2)],
  [3, (b) => nakedSubset(b, 3)],
  [3, (b) => hiddenSubset(b, 3)],
  [3, (b) => fish(b, 2)],
  [3, xyWing],
  [3, (b) => fish(b, 3)],
  [3, (b) => nakedSubset(b, 4)],
  [3, (b) => hiddenSubset(b, 4)],
];

export const MAX_TIER = 3;

/**
 * Solves `puzzle` (81 cells, 0 for empty) like a person, with techniques up to tier `upTo`: the
 * tier of the hardest technique it needed and the solved grid, or null if those aren't enough.
 * `regions`: a region number per cell (default: the 3×3 boxes).
 */
export function solve(
  puzzle: readonly number[],
  upTo = MAX_TIER,
  regions: readonly number[] = BOXES,
): { tier: number; grid: number[] } | null {
  const b = new Board(puzzle, geometry(regions));
  let tier = 1;
  while (b.empty) {
    const used = TECHNIQUES.find(([t, step]) => t <= upTo && step(b));
    if (!used) return null;
    tier = Math.max(tier, used[0]);
  }
  return { tier, grid: b.values };
}

/** The tier of the hardest technique needed to solve `puzzle`, using tiers up to `upTo`; 0 if they can't. */
export const grade = (puzzle: readonly number[], upTo = MAX_TIER, regions: readonly number[] = BOXES): number =>
  solve(puzzle, upTo, regions)?.tier ?? 0;
