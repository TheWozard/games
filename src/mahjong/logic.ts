// Mahjong solitaire: tiles stacked in layers; remove matching pairs of free tiles until the board
// is clear. A tile is free when nothing lies on it and its left or right side is open.
//
// Positions use half-tile units: a tile at (x, y, z) covers x..x+2 across and y..y+2 down on layer
// z, so layers can sit half a tile offset. Deals are made by simulating play backwards: keep
// picking two tiles that are free on what's left and give them the same face. Removing those
// pairs in that order clears the board, so every deal can be won.

export interface Slot {
  x: number;
  y: number;
  z: number;
}

/** A block of tiles: layer, top-left in whole tiles (halves allowed), size in tiles. */
type Block = [z: number, x: number, y: number, w: number, h: number];

/** Tiles drawn as text: each '#' is a tile, rows top to bottom, placed with its top-left at x, y. */
type Mask = [z: number, x: number, y: number, rows: string[]];

function build(parts: (Block | Mask)[]): Slot[] {
  const slots: Slot[] = [];
  for (const part of parts) {
    if (part.length === 4) {
      const [z, x, y, rows] = part;
      rows.forEach((row, r) => [...row].forEach((ch, c) => ch === '#' && slots.push({ x: (x + c) * 2, y: (y + r) * 2, z })));
    } else {
      const [z, x, y, w, h] = part;
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) slots.push({ x: (x + c) * 2, y: (y + r) * 2, z });
    }
  }
  return slots;
}

// Original layouts, portrait to suit phones (at most 8 tiles across, 10 down), in order of size.
export const LAYOUTS = {
  diamond: {
    name: 'Diamond',
    slots: build([
      [0, 0, 0, ['...##...', '..####..', '.######.', '########', '########', '.######.', '..####..', '...##...']],
      [1, 1, 1, ['..##..', '.####.', '######', '######', '.####.', '..##..']],
      [2, 2, 2, ['.##.', '####', '####', '.##.']],
      [3, 3, 3, 2, 2],
    ]),
  },
  pyramid: {
    name: 'Pyramid',
    slots: build([[0, 0, 0, 6, 8], [1, 1, 1, 4, 6], [2, 2, 2, 2, 4], [3, 2.5, 3, 1, 2]]),
  },
  hourglass: {
    name: 'Hourglass',
    slots: build([
      [0, 0, 0, ['########', '########', '.######.', '..####..', '...##...', '...##...', '..####..', '.######.', '########', '########']],
      [1, 1, 1, ['######', '.####.', '..##..', '......', '......', '..##..', '.####.', '######']],
      [2, 2, 1.5, ['####', '.##.', '....', '....', '....', '.##.', '####']],
    ]),
  },
  rings: {
    name: 'Rings',
    slots: build([
      [0, 0, 0, ['########', '#......#', '#.####.#', '#.#..#.#', '#.#..#.#', '#.#..#.#', '#.#..#.#', '#.####.#', '#......#', '########']],
      [0, 3, 4, 2, 2],
      [1, 0.5, 0.5, ['#######', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#######']],
      [1, 2.5, 2.5, ['###', '#.#', '#.#', '#.#', '###']],
      [2, 0, 0, ['#......#', '........', '........', '........', '........', '........', '........', '........', '........', '#......#']],
      [2, 3, 4, 2, 2],
    ]),
  },
  butterfly: {
    name: 'Butterfly',
    slots: build([
      [0, 0, 0, ['##....##', '###..###', '########', '.######.', '..####..', '.######.', '########', '###..###', '##....##']],
      [1, 0.5, 1, 2, 2], [1, 5.5, 1, 2, 2], [1, 0.5, 6, 2, 2], [1, 5.5, 6, 2, 2], [1, 3, 1, 2, 7],
      [2, 1, 1.5, 1, 1], [2, 6, 1.5, 1, 1], [2, 1, 6.5, 1, 1], [2, 6, 6.5, 1, 1], [2, 3, 2, 2, 5],
      [3, 3, 3.5, 2, 2],
    ]),
  },
  twinPeaks: {
    name: 'Twin Peaks',
    slots: build([
      [0, 0, 0, 8, 8],
      [1, 0.5, 2, 3, 4], [1, 4.5, 2, 3, 4],
      [2, 1, 2.5, 2, 3], [2, 5, 2.5, 2, 3],
      [3, 1.5, 3, 1, 2], [3, 5.5, 3, 1, 2],
      [4, 1.5, 3.5, 1, 1], [4, 5.5, 3.5, 1, 1],
    ]),
  },
  cross: {
    name: 'Cross',
    slots: build([
      [0, 2, 0, 4, 10], [0, 0, 3, 2, 4], [0, 6, 3, 2, 4],
      [1, 2.5, 1, 3, 8], [1, 0.5, 3.5, 2, 3], [1, 5.5, 3.5, 2, 3],
      [2, 3, 2, 2, 6],
      [3, 3, 4, 2, 2],
    ]),
  },
  bridge: {
    name: 'Bridge',
    slots: build([
      [0, 0, 0, ['##....##', '##....##', '##....##', '########', '########', '########', '##....##', '##....##', '##....##']],
      [1, 0, 0, 2, 9], [1, 6, 0, 2, 9], [1, 2, 3.5, 4, 2],
      [2, 0.5, 1, 1, 7], [2, 6.5, 1, 1, 7], [2, 3, 4, 2, 1],
      [3, 0.5, 3.5, 1, 2], [3, 6.5, 3.5, 1, 2],
    ]),
  },
  steps: {
    name: 'Steps',
    // Each layer half a tile in from the last.
    slots: build([[0, 0, 0, 7, 8], [1, 0.5, 0.5, 6, 7], [2, 1.5, 1.5, 4, 5], [3, 2.5, 3, 2, 2]]),
  },
  fortress: {
    name: 'Fortress',
    // Corner towers round a central keep: 136 tiles, the full set.
    slots: build([
      [0, 0, 0, 8, 10],
      [1, 0, 0, 2, 2], [1, 6, 0, 2, 2], [1, 0, 8, 2, 2], [1, 6, 8, 2, 2], [1, 2, 2, 4, 6],
      [2, 0.5, 0.5, 1, 1], [2, 6.5, 0.5, 1, 1], [2, 0.5, 8.5, 1, 1], [2, 6.5, 8.5, 1, 1], [2, 3, 3, 2, 4],
      [3, 3, 4, 2, 2],
    ]),
  },
} as const;

export type LayoutName = keyof typeof LAYOUTS;

export const isLayout = (value: unknown): value is LayoutName =>
  typeof value === 'string' && Object.hasOwn(LAYOUTS, value);

/**
 * Tile faces: 0–8 dots 1–9, 9–17 bamboo 1–9, 18–26 characters 1–9, 27–30 winds (E S W N),
 * 31–33 dragons (red, green, white). A full set has four of each.
 */
export const KINDS = 34;

type Random = () => number;

function shuffle<T>(a: T[], random: Random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Rules ----

/** For each slot, the slots lying on it and the slots touching its left and right sides. */
export function neighbours(slots: readonly Slot[]) {
  const overlapY = (a: Slot, b: Slot) => Math.abs(a.y - b.y) < 2;
  return slots.map((s) => ({
    above: slots.flatMap((t, j) => (t.z === s.z + 1 && Math.abs(t.x - s.x) < 2 && overlapY(s, t) ? [j] : [])),
    left: slots.flatMap((t, j) => (t.z === s.z && t.x === s.x - 2 && overlapY(s, t) ? [j] : [])),
    right: slots.flatMap((t, j) => (t.z === s.z && t.x === s.x + 2 && overlapY(s, t) ? [j] : [])),
  }));
}

export type Neighbours = ReturnType<typeof neighbours>;

/** Whether the tile in slot `i` can be taken, given which slots are already empty. */
export function isFree(i: number, near: Neighbours, gone: readonly boolean[]): boolean {
  const { above, left, right } = near[i];
  if (above.some((j) => !gone[j])) return false;
  return left.every((j) => gone[j]) || right.every((j) => gone[j]);
}

/** Pairs of free tiles with the same face, as slot indices. */
export function freePairs(kinds: readonly number[], near: Neighbours, gone: readonly boolean[]): [number, number][] {
  const free = kinds.flatMap((_, i) => (!gone[i] && isFree(i, near, gone) ? [i] : []));
  const pairs: [number, number][] = [];
  for (let a = 0; a < free.length; a++) {
    for (let b = a + 1; b < free.length; b++) {
      if (kinds[free[a]] === kinds[free[b]]) pairs.push([free[a], free[b]]);
    }
  }
  return pairs;
}

// ---- Dealing ----

/**
 * Faces for the slots not yet `gone`, using `faces` (an even count of each kind), such that the
 * board can be cleared: or null if this ordering hit a dead end (try again).
 */
function assign(near: Neighbours, gone: readonly boolean[], faces: number[], random: Random): Dealt | null {
  // Pair up the faces at random, then deal pairs onto tiles that would be free together.
  const byKind = new Map<number, number>();
  for (const f of faces) byKind.set(f, (byKind.get(f) ?? 0) + 1);
  const pairs = shuffle([...byKind].flatMap(([k, n]) => Array(n / 2).fill(k) as number[]), random);
  const left = gone.slice();
  const kinds = new Array<number>(gone.length).fill(-1);
  const order: [number, number][] = [];
  for (const kind of pairs) {
    const free = shuffle(left.flatMap((g, i) => (!g && isFree(i, near, left) ? [i] : [])), random);
    if (free.length < 2) return null;
    // Prefer taking from the top, so deep tiles aren't left stranded with no partner.
    free.sort((a, b) => near[b].above.length - near[a].above.length);
    const [a, b] = free;
    kinds[a] = kinds[b] = kind;
    left[a] = left[b] = true;
    order.push([a, b]);
  }
  return { kinds, order };
}

/** Faces per slot, and the order of pairs the dealer took: one way to clear the board. */
export interface Dealt {
  kinds: number[];
  order: [number, number][];
}

/** The faces for a layout's slot count: kinds picked at random, four of each, two of the last. */
function facesFor(count: number, random: Random): number[] {
  const kinds = shuffle([...Array(KINDS).keys()], random);
  const faces: number[] = [];
  for (let k = 0; faces.length < count; k = (k + 1) % KINDS) {
    const take = Math.min(4, count - faces.length);
    for (let n = 0; n < take; n++) faces.push(kinds[k]);
  }
  return faces;
}

export function deal(layout: LayoutName, random: Random = Math.random): Dealt {
  const { slots } = LAYOUTS[layout];
  const near = neighbours(slots);
  const gone = slots.map(() => false);
  for (;;) {
    const dealt = assign(near, gone, facesFor(slots.length, random), random);
    if (dealt) return dealt;
  }
}

/**
 * New faces for the tiles still on the board, keeping the same set of faces and, where the
 * remaining stack allows it, a way to clear the board.
 */
export function reshuffle(kinds: readonly number[], near: Neighbours, gone: readonly boolean[], random: Random = Math.random): number[] {
  const faces = kinds.filter((_, i) => !gone[i]);
  for (let attempt = 0; attempt < 200; attempt++) {
    const next = assign(near, gone, faces, random);
    if (next) return next.kinds.map((k, i) => (gone[i] ? kinds[i] : k));
  }
  // Some stacks can't be cleared whatever the faces (e.g. two tiles left on top of each other):
  // just shuffle them.
  const mixed = shuffle(faces.slice(), random);
  let k = 0;
  return kinds.map((kind, i) => (gone[i] ? kind : mixed[k++]));
}
