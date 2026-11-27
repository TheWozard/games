import { describe, expect, it } from 'vitest';
import {
  BOTTOM,
  edgeBetween,
  edgeId,
  hasEdge,
  isSheet,
  nearestEdge,
  newSheet,
  pointsBetween,
  reducer,
  RIGHT,
  SIZES,
  SOLID,
  type Sheet,
  type SheetAction,
} from './game';
import { DEFAULT_MARKS, MARK_GROUPS, MAX_MARKS, sortMarks, type Clears } from './marks';

describe('marks', () => {
  it('sorts any pick into pad order, each once, leaving out what is not a mark', () => {
    expect(sortMarks(['star', 'B', '0', '1', 'B', 'nope', 'check'])).toEqual([
      '1',
      '0',
      'B',
      'check',
      'star',
    ]);
  });

  it('offers numbers, letters and symbols, all different', () => {
    const all = MARK_GROUPS.flatMap((g) => g.marks);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toContain('5');
    expect(all).toContain('Q');
    expect(all).toContain('heart');
    expect(all).not.toContain(SOLID);
  });
});

describe('newSheet', () => {
  it('is blank at every size, with the default marks', () => {
    for (const size of SIZES) {
      const s = newSheet(size);
      expect(s.values).toHaveLength(size * size);
      expect(s.notes).toHaveLength(size * size);
      expect(s.values.every((v) => v === '') && s.notes.every((n) => n.length === 0)).toBe(true);
      expect(s.marks).toEqual(DEFAULT_MARKS);
      expect(isSheet(s)).toBe(true);
    }
  });

  it('takes the marks picked, in pad order, up to the most a pad holds', () => {
    expect(newSheet(5, ['x', 'heart', 'Z', 'A', '3']).marks).toEqual(['3', 'A', 'Z', 'heart']);
    const letters = MARK_GROUPS[1].marks;
    expect(newSheet(5, letters).marks).toHaveLength(MAX_MARKS);
    expect(newSheet(5, []).marks).toEqual(DEFAULT_MARKS);
  });
});

describe('write', () => {
  it('writes every mark on the pad, and Solid', () => {
    const s0 = newSheet(9, ['1', 'A', 'star']);
    for (const mark of [...s0.marks, SOLID]) {
      const s = reducer(s0, { type: 'write', indices: [4], mark, on: true });
      expect(s.values[4]).toBe(mark);
    }
  });

  it('writes nothing that is not on the pad', () => {
    const s = newSheet(9, ['1', '2']);
    expect(reducer(s, { type: 'write', indices: [0], mark: '3', on: true })).toBe(s);
    expect(reducer(s, { type: 'note', indices: [0], mark: 'A', on: true })).toBe(s);
  });

  it('writes across a drag, replacing other marks and clearing notes', () => {
    let s = reducer(newSheet(6), { type: 'write', indices: [1], mark: '3', on: true });
    s = reducer(s, { type: 'note', indices: [2], mark: '5', on: true });
    s = reducer(s, { type: 'write', indices: [0, 1, 2], mark: '7', on: true });
    expect(s.values.slice(0, 3)).toEqual(['7', '7', '7']);
    expect(s.notes[2]).toEqual([]);
  });

  it('takes the mark away only where it is written', () => {
    let s = reducer(newSheet(5), { type: 'write', indices: [0, 1], mark: 'check', on: true });
    s = reducer(s, { type: 'write', indices: [2], mark: '7', on: true });
    s = reducer(s, { type: 'write', indices: [0, 1, 2], mark: 'check', on: false });
    expect(s.values.slice(0, 3)).toEqual(['', '', '7']);
  });

  it('returns the same object when nothing changes', () => {
    const blank = newSheet(4);
    expect(reducer(blank, { type: 'write', indices: [0], mark: '2', on: false })).toBe(blank);
    expect(reducer(blank, { type: 'write', indices: [99, -1, 0.5], mark: '2', on: true })).toBe(
      blank,
    );
    const once = reducer(blank, { type: 'write', indices: [0], mark: '2', on: true });
    expect(reducer(once, { type: 'write', indices: [0], mark: '2', on: true })).toBe(once);
  });
});

describe('solid cells', () => {
  it('stay solid under Write, Notes and Erase, walls and all', () => {
    let s = reducer(newSheet(4), { type: 'edge', edges: [edgeId(0, RIGHT)], on: true });
    s = reducer(s, { type: 'write', indices: [5], mark: SOLID, on: true });
    const before = s;
    for (const action of [
      { type: 'write', indices: [5], mark: '3', on: true },
      { type: 'write', indices: [5], mark: 'check', on: true },
      { type: 'note', indices: [5], mark: '3', on: true },
      { type: 'erase', indices: [5, 0] },
    ] satisfies SheetAction[]) {
      expect(reducer(s, action)).toBe(before);
    }
  });

  it('let a drag write and erase around them', () => {
    let s = reducer(newSheet(4), { type: 'write', indices: [1], mark: SOLID, on: true });
    s = reducer(s, { type: 'write', indices: [0, 1, 2], mark: '7', on: true });
    expect(s.values.slice(0, 3)).toEqual(['7', SOLID, '7']);
    s = reducer(s, { type: 'erase', indices: [0, 1, 2] });
    expect(s.values.slice(0, 3)).toEqual(['', SOLID, '']);
  });

  it('are taken away by Solid alone', () => {
    let s = reducer(newSheet(4), { type: 'write', indices: [1], mark: SOLID, on: true });
    s = reducer(s, { type: 'write', indices: [1], mark: SOLID, on: false });
    expect(s.values[1]).toBe('');
  });
});

describe('note', () => {
  it('adds and takes away notes of any mark in empty cells, kept in pad order', () => {
    let s = newSheet(9, ['1', '9', 'K', 'star']);
    s = reducer(s, { type: 'note', indices: [0, 1], mark: 'star', on: true });
    s = reducer(s, { type: 'note', indices: [0], mark: '9', on: true });
    s = reducer(s, { type: 'note', indices: [1], mark: 'K', on: true });
    s = reducer(s, { type: 'note', indices: [1], mark: '1', on: true });
    expect(s.notes[0]).toEqual(['9', 'star']);
    expect(s.notes[1]).toEqual(['1', 'K', 'star']);
    s = reducer(s, { type: 'note', indices: [0, 1], mark: 'star', on: false });
    expect(s.notes[0]).toEqual(['9']);
    expect(s.notes[1]).toEqual(['1', 'K']);
  });

  it('leaves written cells alone', () => {
    const s = reducer(newSheet(9), { type: 'write', indices: [0], mark: '1', on: true });
    expect(reducer(s, { type: 'note', indices: [0], mark: '2', on: true })).toBe(s);
  });
});

describe('erase and undo', () => {
  it('erases marks and notes, and undoes one move at a time', () => {
    let s = reducer(newSheet(9), { type: 'write', indices: [0, 1], mark: '4', on: true });
    s = reducer(s, { type: 'note', indices: [2], mark: '4', on: true });
    const before = s;
    s = reducer(s, { type: 'erase', indices: [0, 1, 2, 3] });
    expect(s.values.slice(0, 3)).toEqual(['', '', '']);
    expect(s.notes[2]).toEqual([]);
    expect(s.history).toHaveLength(3);
    expect(reducer(s, { type: 'erase', indices: [0] })).toBe(s);

    s = reducer(s, { type: 'undo' });
    expect(s.values).toEqual(before.values);
    expect(s.notes).toEqual(before.notes);
    s = reducer(reducer(s, { type: 'undo' }), { type: 'undo' });
    expect(s.values).toEqual(newSheet(9).values);
    expect(s.notes).toEqual(newSheet(9).notes);
    expect(reducer(s, { type: 'undo' })).toBe(s);
  });
});

describe('edges', () => {
  it('names the line between two neighboring grid points, and nothing on the border', () => {
    // 4×4: point (1, 0)–(1, 1) is the line right of cell 0; (0, 1)–(1, 1) the line below it.
    expect(edgeBetween(4, [1, 0], [1, 1])).toBe(edgeId(0, RIGHT));
    expect(edgeBetween(4, [1, 1], [1, 0])).toBe(edgeId(0, RIGHT));
    expect(edgeBetween(4, [0, 1], [1, 1])).toBe(edgeId(0, BOTTOM));
    expect(edgeBetween(4, [3, 3], [3, 4])).toBe(edgeId(14, RIGHT));
    expect(edgeBetween(4, [0, 0], [1, 0])).toBeNull(); // top border
    expect(edgeBetween(4, [4, 1], [4, 2])).toBeNull(); // right border
    expect(edgeBetween(4, [0, 4], [1, 4])).toBeNull(); // bottom border
    expect(edgeBetween(4, [0, 0], [1, 1])).toBeNull(); // not neighbors
  });

  it('walks a drag one line at a time, as a staircase on a slant', () => {
    expect(pointsBetween([0, 0], [3, 0])).toEqual([
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
    expect(pointsBetween([1, 1], [2, 3])).toEqual([
      [1, 2],
      [2, 2],
      [2, 3],
    ]);
    expect(pointsBetween([2, 2], [2, 2])).toEqual([]);
  });

  it('finds the line nearest a tap', () => {
    // Cell 5 of a 4×4 (row 1, column 1) spans 1..2 each way.
    expect(nearestEdge(4, 1.95, 1.5)).toBe(edgeId(5, RIGHT));
    expect(nearestEdge(4, 1.05, 1.5)).toBe(edgeId(4, RIGHT));
    expect(nearestEdge(4, 1.5, 1.9)).toBe(edgeId(5, BOTTOM));
    expect(nearestEdge(4, 1.5, 1.1)).toBe(edgeId(1, BOTTOM));
    expect(nearestEdge(4, 0.05, 1.5)).toBeNull(); // the left border
  });

  it('draws and takes away edges across a drag, as one move', () => {
    let s = newSheet(4);
    const line = [edgeId(0, RIGHT), edgeId(4, RIGHT), edgeId(8, RIGHT)];
    s = reducer(s, { type: 'edge', edges: line, on: true });
    expect(line.every((e) => hasEdge(s, e))).toBe(true);
    expect(s.history).toHaveLength(1);
    s = reducer(s, { type: 'edge', edges: [edgeId(0, BOTTOM)], on: true });
    expect(s.edges[0]).toBe(RIGHT | BOTTOM);
    s = reducer(s, { type: 'edge', edges: [edgeId(0, RIGHT), edgeId(4, RIGHT)], on: false });
    expect(s.edges.slice(0, 9)).toEqual([BOTTOM, 0, 0, 0, 0, 0, 0, 0, RIGHT]);
    s = reducer(reducer(s, { type: 'undo' }), { type: 'undo' });
    expect(s.edges[0]).toBe(RIGHT);
    expect(s.edges[4]).toBe(RIGHT);
  });

  it('ignores edges on the border, off the board or already as asked', () => {
    const s = reducer(newSheet(4), { type: 'edge', edges: [edgeId(0, RIGHT)], on: true });
    const ignored = [edgeId(3, RIGHT), edgeId(12, BOTTOM), -2, 99, 0.5, edgeId(0, RIGHT)];
    expect(reducer(s, { type: 'edge', edges: ignored, on: true })).toBe(s);
  });

  it('keeps edges when cells are written (not Solid) or erased', () => {
    let s = reducer(newSheet(4), { type: 'edge', edges: [edgeId(5, BOTTOM)], on: true });
    s = reducer(s, { type: 'write', indices: [5], mark: '3', on: true });
    s = reducer(s, { type: 'write', indices: [5], mark: 'check', on: true });
    s = reducer(s, { type: 'erase', indices: [5] });
    expect(s.edges[5]).toBe(BOTTOM);
  });

  it('takes away the walls around a cell shaded solid, in the same move', () => {
    // Every wall around cell 5 of a 4×4 (row 1, column 1), and one that doesn't touch it.
    const around = [edgeId(5, RIGHT), edgeId(5, BOTTOM), edgeId(4, RIGHT), edgeId(1, BOTTOM)];
    const apart = edgeId(10, RIGHT);
    const walled = reducer(newSheet(4), { type: 'edge', edges: [...around, apart], on: true });
    const s = reducer(walled, { type: 'write', indices: [5], mark: SOLID, on: true });
    expect(s.values[5]).toBe(SOLID);
    expect(around.filter((e) => hasEdge(s, e))).toEqual([]);
    expect(hasEdge(s, apart)).toBe(true);
    expect(s.history).toHaveLength(walled.history.length + 1);

    const back = reducer(s, { type: 'undo' });
    expect(back.values).toEqual(walled.values);
    expect(back.edges).toEqual(walled.edges);
  });

  it('clears the walls inside and around a dragged block of solid cells', () => {
    // A 2×2 block (cells 5, 6, 9, 10 of a 4×4) with a wall through its middle and one on its edge.
    const inside = [edgeId(5, RIGHT), edgeId(9, RIGHT)];
    const edge = edgeId(2, BOTTOM);
    let s = reducer(newSheet(4), { type: 'edge', edges: [...inside, edge], on: true });
    s = reducer(s, { type: 'write', indices: [5, 6, 9, 10], mark: SOLID, on: true });
    expect(s.edges.every((e) => e === 0)).toBe(true);
  });

  it('draws no wall on the sides of a solid cell, but draws the rest of a drag', () => {
    // A line down the right of column 0 of a 4×4, past solid cell 4 (row 1): the wall on its side
    // (right of 4) is left out, and those above and below it are drawn.
    let s = reducer(newSheet(4), { type: 'write', indices: [4], mark: SOLID, on: true });
    const line = [edgeId(0, RIGHT), edgeId(4, RIGHT), edgeId(8, RIGHT)];
    s = reducer(s, { type: 'edge', edges: line, on: true });
    expect(line.map((e) => hasEdge(s, e))).toEqual([true, false, true]);
    // Each side of solid cell 5 (row 1, column 1), from both cells: nothing changes.
    const solid = reducer(newSheet(4), { type: 'write', indices: [5], mark: SOLID, on: true });
    const sides = [edgeId(5, RIGHT), edgeId(5, BOTTOM), edgeId(4, RIGHT), edgeId(1, BOTTOM)];
    expect(reducer(solid, { type: 'edge', edges: sides, on: true })).toBe(solid);
  });

  it('takes away a wall beside a solid cell, and draws them again once it is cleared', () => {
    let s = reducer(newSheet(4), { type: 'edge', edges: [edgeId(5, RIGHT)], on: true });
    // A wall that's somehow beside a solid cell (from a cell made solid some other way) can go.
    s = { ...s, values: s.values.map((v, i) => (i === 5 ? SOLID : v)) };
    s = reducer(s, { type: 'edge', edges: [edgeId(5, RIGHT)], on: false });
    expect(hasEdge(s, edgeId(5, RIGHT))).toBe(false);
    // Cleared, its sides take walls again; clearing it brings back none by itself.
    s = reducer(s, { type: 'write', indices: [5], mark: SOLID, on: false });
    expect(s.values[5]).toBe('');
    expect(s.edges[5]).toBe(0);
    s = reducer(s, { type: 'edge', edges: [edgeId(5, RIGHT)], on: true });
    expect(hasEdge(s, edgeId(5, RIGHT))).toBe(true);
  });
});

describe('clearing notes', () => {
  const all = [...Array(16).keys()];
  let noted = newSheet(4, ['1', '2', 'A']);
  for (const mark of ['1', '2', 'A'])
    noted = reducer(noted, { type: 'note', indices: all, mark, on: true });
  const withNote = (s: Sheet, m: string) => s.notes.flatMap((n, i) => (n.includes(m) ? [i] : []));
  const write = (s: Sheet, clears?: Clears, on = true) =>
    reducer(s, { type: 'write', indices: [5], mark: '1', on, clears });

  it('keeps notes unless asked', () => {
    expect(withNote(write(noted), '1')).toHaveLength(15);
    expect(withNote(write(noted, 'none'), '1')).toHaveLength(15);
  });

  it("clears the mark's notes in the row and column, as one move", () => {
    const s = write(noted, 'lines');
    // Row 1 is 4–7, column 1 is 1, 5, 9, 13.
    expect(withNote(s, '1')).toEqual([0, 2, 3, 8, 10, 11, 12, 14, 15]);
    expect(withNote(s, '2')).toHaveLength(15); // other marks keep theirs
    expect(reducer(s, { type: 'undo' })).toEqual(noted);
  });

  it("clears the mark's notes everywhere", () => {
    const s = write(noted, 'grid');
    expect(withNote(s, '1')).toEqual([]);
    expect(withNote(s, 'A')).toHaveLength(15);
  });

  it('clears nothing when a mark is taken away', () => {
    let s = write(noted, 'grid');
    s = reducer(s, { type: 'note', indices: [0], mark: '1', on: true });
    expect(withNote(write(s, 'grid', false), '1')).toEqual([0]);
  });
});

describe('isSheet', () => {
  it('round-trips through JSON', () => {
    let s = newSheet(12, ['1', 'A', 'B', 'check', 'star']);
    s = reducer(s, { type: 'write', indices: [0, 143], mark: 'check', on: true });
    s = reducer(s, { type: 'write', indices: [7], mark: SOLID, on: true });
    s = reducer(s, { type: 'note', indices: [5], mark: 'B', on: true });
    s = reducer(s, { type: 'note', indices: [5], mark: 'star', on: true });
    s = reducer(s, { type: 'edge', edges: [edgeId(5, RIGHT), edgeId(5, BOTTOM)], on: true });
    const back: unknown = JSON.parse(JSON.stringify(s));
    expect(isSheet(back)).toBe(true);
    expect(back).toEqual(s);
  });

  it('rejects anything that does not fit', () => {
    const good = newSheet(9);
    const bad: unknown[] = [
      null,
      42,
      {},
      { ...good, size: 3 },
      { ...good, size: 10 },
      { ...good, marks: [] },
      { ...good, marks: ['2', '1'] }, // not in pad order
      { ...good, marks: ['1', '1'] },
      { ...good, marks: ['1', 'nope'] },
      { ...good, marks: MARK_GROUPS[1].marks.slice(0, MAX_MARKS + 1) },
      { ...good, values: good.values.slice(1) },
      { ...good, values: ['A', ...good.values.slice(1)] }, // not on this pad
      { ...good, values: [0, ...good.values.slice(1)] },
      { ...good, notes: [['A'], ...good.notes.slice(1)] },
      { ...good, notes: [['1', '1'], ...good.notes.slice(1)] },
      { ...good, notes: [0, ...good.notes.slice(1)] },
      { ...good, history: undefined },
      { ...good, edges: undefined },
      { ...good, edges: good.edges.slice(1) },
      { ...good, edges: [4, ...good.edges.slice(1)] },
    ];
    for (const value of bad) expect(isSheet(value as Sheet)).toBe(false);
  });
});
