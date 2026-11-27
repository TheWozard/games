// The Grid tool: a blank square grid to work a puzzle out on, like a sheet of squared paper. Each
// cell holds one mark (from the grid's own set of numbers, letters and symbols: marks.ts), pencil
// marks of any of them, or is shaded solid, and the lines between cells can be drawn solid, to
// outline regions. There are no rules, no solution and no win: it only remembers what's drawn,
// with undo.
import { DEFAULT_MARKS, MAX_MARKS, sortMarks, type Clears } from './marks';

/** A cell shaded solid: not a mark on the pad, but drawn by its own tool. */
export const SOLID = 'solid';

/** Grid sizes offered: 4×4 up to 15×15. */
export const SIZES = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
export const DEFAULT_SIZE = 9;

/** A cell's solid edges, as bits: the line on its right and the one below it. */
export const RIGHT = 1;
export const BOTTOM = 2;

/** One cell's mark, pencil marks and edges, as they were before a move (for undo). */
export type Change = [index: number, value: string, notes: string[], edges: number];

export interface Sheet {
  edges: number[]; // RIGHT | BOTTOM per cell; the board's own border is always solid
  history: Change[][];
  marks: string[]; // what the pad offers, in pad order (marks.ts)
  notes: string[][]; // pencil marks per cell, in pad order
  size: number;
  values: string[]; // '' = empty, SOLID, or one of `marks`
}

/**
 * Moves name the cells (or edges) they act on, as a tap or a drag passes them. Write and Note put
 * the mark on (`on`) or take it away; Erase clears a cell's mark and notes; Edge draws or takes away
 * lines between cells (edge ids: `edgeId`). A write can also take away the same mark's notes
 * nearby (`clears`).
 */
export type SheetAction =
  | { clears?: Clears; indices: number[]; mark: string; on: boolean; type: 'write' }
  | { edges: number[]; on: boolean; type: 'edge' }
  | { indices: number[]; mark: string; on: boolean; type: 'note' }
  | { indices: number[]; type: 'erase' }
  | { type: 'undo' };

const HISTORY_LIMIT = 500;

/** A blank grid offering `marks` (sorted into pad order; the default set if none fit). */
export function newSheet(size: number, marks: readonly string[] = DEFAULT_MARKS): Sheet {
  const cells = size * size;
  const picked = sortMarks(marks).slice(0, MAX_MARKS);
  return {
    size,
    marks: picked.length ? picked : [...DEFAULT_MARKS],
    values: new Array<string>(cells).fill(''),
    notes: Array.from({ length: cells }, () => []),
    edges: new Array(cells).fill(0),
    history: [],
  };
}

// ---- Edges ----
// An edge is the line on a cell's right (RIGHT) or below it (BOTTOM), named by one number:
// cell * 2, plus 1 for the bottom. Only lines inside the board: its border is drawn already.
// Grid points (where lines cross) run 0..size each way: point (x, y) is the top-left corner of
// the cell in column x, row y.

export function edgeId(cell: number, side: typeof BOTTOM | typeof RIGHT): number {
  return cell * 2 + (side === BOTTOM ? 1 : 0);
}

/** The edge between two neighboring grid points, or null if it's on the border (or they aren't neighbors). */
export function edgeBetween(
  size: number,
  [x0, y0]: readonly [number, number],
  [x1, y1]: readonly [number, number],
): null | number {
  if (Math.abs(x1 - x0) + Math.abs(y1 - y0) !== 1) return null;
  if (y0 === y1) {
    // A line along the top of row y, between columns x and x + 1: the bottom of the cell above.
    const [x, y] = [Math.min(x0, x1), y0];
    return y >= 1 && y < size && x >= 0 && x < size ? edgeId((y - 1) * size + x, BOTTOM) : null;
  }
  // A line down the left of column x: the right of the cell before it.
  const [x, y] = [x0, Math.min(y0, y1)];
  return x >= 1 && x < size && y >= 0 && y < size ? edgeId(y * size + x - 1, RIGHT) : null;
}

/**
 * The grid points a drag passes on its way from one to another, one line at a time (a quick swipe
 * jumps several), not counting the first: the way with more to go is taken first, so a slant
 * comes out as a staircase.
 */
export function pointsBetween(
  [x0, y0]: readonly [number, number],
  [x1, y1]: readonly [number, number],
): [number, number][] {
  const points: [number, number][] = [];
  let [x, y] = [x0, y0];
  while (x !== x1 || y !== y1) {
    if (Math.abs(x1 - x) >= Math.abs(y1 - y)) x += Math.sign(x1 - x);
    else y += Math.sign(y1 - y);
    points.push([x, y]);
  }
  return points;
}

/** The edge nearest a point on the board (in cells: 0..size each way), for a tap; null for the border. */
export function nearestEdge(size: number, fx: number, fy: number): null | number {
  const col = Math.min(size - 1, Math.max(0, Math.floor(fx)));
  const row = Math.min(size - 1, Math.max(0, Math.floor(fy)));
  const [lx, ly] = [Math.round(fx), Math.round(fy)];
  // The closer of the vertical line (left or right of the cell) and the horizontal one.
  return Math.abs(fx - lx) <= Math.abs(fy - ly) ?
      edgeBetween(size, [lx, row], [lx, row + 1])
    : edgeBetween(size, [col, ly], [col + 1, ly]);
}

/** Whether an edge is drawn. */
export const hasEdge = (s: Sheet, edge: number) =>
  Boolean(s.edges[edge >> 1] & (edge & 1 ? BOTTOM : RIGHT));

/** Whether saved JSON has the shape of a sheet. */
export function isSheet(value: unknown): value is Sheet {
  const s = value as null | Partial<Sheet>;
  if (typeof s !== 'object' || s === null) return false;
  if (!(SIZES as readonly number[]).includes(s.size!)) return false;
  const cells = s.size! * s.size!;
  const marks = s.marks;
  if (
    !Array.isArray(marks) ||
    marks.length === 0 ||
    marks.length > MAX_MARKS ||
    sortMarks(marks).join() !== marks.join()
  )
    return false;
  const onPad = (m: unknown) => typeof m === 'string' && marks.includes(m);
  return (
    Array.isArray(s.values) &&
    s.values.length === cells &&
    s.values.every((v) => v === '' || v === SOLID || onPad(v)) &&
    Array.isArray(s.notes) &&
    s.notes.length === cells &&
    s.notes.every((n) => Array.isArray(n) && n.every(onPad) && new Set(n).size === n.length) &&
    Array.isArray(s.edges) &&
    s.edges.length === cells &&
    s.edges.every((e) => e === 0 || e === RIGHT || e === BOTTOM || e === (RIGHT | BOTTOM)) &&
    Array.isArray(s.history)
  );
}

function apply(s: Sheet, changes: Change[]): Sheet {
  if (changes.length === 0) return s;
  const undo = changes.map(([i]): Change => [i, s.values[i], s.notes[i], s.edges[i]]);
  return { ...set(s, changes), history: [...s.history, undo].slice(-HISTORY_LIMIT) };
}

function set(s: Sheet, changes: Change[]): Sheet {
  const values = s.values.slice();
  const notes = s.notes.slice();
  const edges = s.edges.slice();
  for (const [i, v, n, e] of changes) {
    values[i] = v;
    notes[i] = n;
    edges[i] = e;
  }
  return { ...s, values, notes, edges };
}

/** The cells named that are on the board, each once. */
function cells(s: Sheet, indices: number[]): number[] {
  const n = s.size * s.size;
  return [...new Set(indices)].filter((i) => Number.isInteger(i) && i >= 0 && i < n);
}

/**
 * Shades cells solid, and takes away the walls on their sides: a solid cell is drawn out to where
 * its walls would be, so they can't be seen any more. Its right and bottom walls are its own; its
 * left and top ones belong to the neighbors there.
 */
function fill(s: Sheet, cells: number[]): Change[] {
  const n = s.size;
  const changes = new Map<number, Change>();
  const change = (i: number) => {
    const c = changes.get(i) ?? [i, s.values[i], s.notes[i], s.edges[i]];
    changes.set(i, c);
    return c;
  };
  for (const i of cells) {
    const c = change(i);
    c[1] = SOLID;
    c[2] = [];
    c[3] = 0;
    if (i % n > 0) change(i - 1)[3] &= ~RIGHT;
    if (i >= n) change(i - n)[3] &= ~BOTTOM;
  }
  return [...changes.values()].filter(
    ([i, v, notes, e]) =>
      v !== s.values[i] || notes.length !== s.notes[i].length || e !== s.edges[i],
  );
}

/**
 * The notes of a mark just written that the write takes away (`clears`, its group's setting:
 * marks.ts `Behavior`): in the rows and columns of the cells it went in, or everywhere. The cells
 * written are left to the write.
 */
function clearNotes(s: Sheet, mark: string, written: number[], clears: Clears): Change[] {
  if (clears === 'none' || written.length === 0) return [];
  const n = s.size;
  const rows = new Set(written.map((i) => Math.floor(i / n)));
  const cols = new Set(written.map((i) => i % n));
  const skip = new Set(written);
  return s.notes.flatMap((notes, i): Change[] =>
    (
      !skip.has(i) &&
      notes.includes(mark) &&
      (clears === 'grid' || rows.has(Math.floor(i / n)) || cols.has(i % n))
    ) ?
      [[i, s.values[i], notes.filter((m) => m !== mark), s.edges[i]]]
    : [],
  );
}

/** Applies one move. Returns the same object when the move changes nothing. */
export function reducer(s: Sheet, action: SheetAction): Sheet {
  switch (action.type) {
    case 'write': {
      const { mark, on } = action;
      if (mark !== SOLID && !s.marks.includes(mark)) return s;
      // On: the mark replaces what the cell holds, notes included, except that only Solid itself
      // writes over a solid cell. Off: only where it's written.
      const written = cells(s, action.indices).filter((i) =>
        on ?
          (s.values[i] !== mark || s.notes[i].length > 0) &&
          (mark === SOLID || s.values[i] !== SOLID)
        : s.values[i] === mark,
      );
      if (mark === SOLID && on) return apply(s, fill(s, written));
      const changes = written.map((i): Change => [i, on ? mark : '', [], s.edges[i]]);
      if (on && action.clears) changes.push(...clearNotes(s, mark, written, action.clears));
      return apply(s, changes);
    }

    case 'note': {
      const { mark, on } = action;
      if (!s.marks.includes(mark)) return s;
      // Notes go in empty cells only: a written mark covers them. They're kept in pad order.
      const changes = cells(s, action.indices)
        .filter((i) => s.values[i] === '' && s.notes[i].includes(mark) !== on)
        .map((i): Change => {
          const notes =
            on ?
              s.marks.filter((m) => m === mark || s.notes[i].includes(m))
            : s.notes[i].filter((m) => m !== mark);
          return [i, '', notes, s.edges[i]];
        });
      return apply(s, changes);
    }

    case 'erase': {
      // A cell's mark and notes; solid cells and walls stay (Solid and Edge take those away).
      const changes = cells(s, action.indices)
        .filter((i) => s.values[i] !== SOLID && (s.values[i] !== '' || s.notes[i].length > 0))
        .map((i): Change => [i, '', [], s.edges[i]]);
      return apply(s, changes);
    }

    case 'edge': {
      const { on } = action;
      const n = s.size;
      // Each edge named once, inside the board, and not already as asked; then one change per cell.
      // No new wall beside a solid cell: it's drawn over its walls (see `fill`), so one there would
      // never be seen. Taking a wall away works anywhere.
      const edges = new Map<number, number>();
      for (const id of new Set(action.edges)) {
        const i = id >> 1;
        const bit = id & 1 ? BOTTOM : RIGHT;
        const inside =
          Number.isInteger(id) &&
          i >= 0 &&
          i < n * n &&
          (bit === RIGHT ? i % n < n - 1 : Math.floor(i / n) < n - 1);
        if (!inside || hasEdge(s, id) === on) continue;
        const beyond = bit === RIGHT ? i + 1 : i + n;
        if (on && (s.values[i] === SOLID || s.values[beyond] === SOLID)) continue;
        edges.set(i, (edges.get(i) ?? s.edges[i]) ^ bit);
      }
      return apply(
        s,
        [...edges].map(([i, e]): Change => [i, s.values[i], s.notes[i], e]),
      );
    }

    case 'undo': {
      const last = s.history.at(-1);
      if (!last) return s;
      return { ...set(s, last), history: s.history.slice(0, -1) };
    }
  }
}
