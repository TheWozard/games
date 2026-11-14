import { describe, expect, it } from 'vitest';
import { isGame, newGame, reducer, type Game } from './game';
import { PEERS } from './logic';

const emptyCells = (g: Game) => g.puzzle.flatMap((v, i) => (v ? [] : [i]));
const emptyCell = (g: Game) => g.puzzle.indexOf(0);

describe('reducer', () => {
  it('places a digit, clears it from peer notes, and undoes both', () => {
    let g = newGame('easy');
    const i = emptyCell(g);
    const d = g.solution[i];
    const peer = PEERS[i].find((p) => !g.puzzle[p])!;
    g = reducer(g, { type: 'note', indices: [peer], digit: d, on: true });
    expect(g.notes[peer]).toBe(1 << d);
    g = reducer(g, { type: 'place', index: i, digit: d });
    expect(g.values[i]).toBe(d);
    expect(g.notes[peer]).toBe(0);
    g = reducer(g, { type: 'undo' });
    expect(g.values[i]).toBe(0);
    expect(g.notes[peer]).toBe(1 << d);
  });

  it('places over notes or another digit, takes away the same digit, and leaves givens alone', () => {
    let g = newGame('easy');
    const i = emptyCell(g);
    g = reducer(g, { type: 'note', indices: [i], digit: 4, on: true });
    g = reducer(g, { type: 'place', index: i, digit: 5 });
    expect([g.values[i], g.notes[i]]).toEqual([5, 0]);
    g = reducer(g, { type: 'place', index: i, digit: 6 });
    expect(g.values[i]).toBe(6);
    g = reducer(g, { type: 'place', index: i, digit: 6 });
    expect(g.values[i]).toBe(0);
    g = reducer(g, { type: 'undo' });
    expect(g.values[i]).toBe(6);
    const given = g.puzzle.findIndex(Boolean);
    expect(reducer(g, { type: 'place', index: given, digit: 1 })).toBe(g);
  });

  it('adds or takes away a note across a drag, as one undo step, skipping placed digits and givens', () => {
    let g = newGame('easy');
    const [a, b, c] = emptyCells(g);
    const given = g.puzzle.findIndex(Boolean);
    g = reducer(g, { type: 'place', index: c, digit: 9 });
    const before = g;
    g = reducer(g, { type: 'note', indices: [a, b, c, given], digit: 3, on: true });
    expect([g.notes[a], g.notes[b], g.notes[c], g.notes[given]]).toEqual([1 << 3, 1 << 3, 0, 0]);
    expect(g.history.length).toBe(before.history.length + 1);
    expect(reducer(g, { type: 'note', indices: [a, b], digit: 3, on: true })).toBe(g);
    g = reducer(g, { type: 'note', indices: [a], digit: 3, on: false });
    expect([g.notes[a], g.notes[b]]).toEqual([0, 1 << 3]);
    g = reducer(reducer(g, { type: 'undo' }), { type: 'undo' });
    expect(g.notes).toEqual(before.notes);
  });

  it('erases digits and notes across a drag, leaving givens alone', () => {
    let g = newGame('easy');
    const [a, b, c] = emptyCells(g);
    const given = g.puzzle.findIndex(Boolean);
    g = reducer(g, { type: 'place', index: a, digit: 1 });
    g = reducer(g, { type: 'note', indices: [b], digit: 2, on: true });
    g = reducer(g, { type: 'erase', indices: [a, b, c, given] });
    expect([g.values[a], g.notes[b], g.values[given]]).toEqual([0, 0, g.puzzle[given]]);
    expect(reducer(g, { type: 'erase', indices: [a, b, c, given] })).toBe(g);
  });

  it('finishes when the last cell is filled correctly, then takes no more moves', () => {
    let g = newGame('easy');
    for (const i of emptyCells(g)) g = reducer(g, { type: 'place', index: i, digit: g.solution[i] });
    expect(g.done).toBe(true);
    expect(reducer(g, { type: 'erase', indices: emptyCells(g) })).toBe(g);
  });

  it('reads a save from before cells stopped being selected', () => {
    const g = { ...newGame('easy'), selected: 40, notesMode: true };
    const saved = JSON.parse(JSON.stringify(g));
    expect(isGame(saved)).toBe(true);
    const i = emptyCell(saved);
    expect(reducer(saved, { type: 'place', index: i, digit: saved.solution[i] }).values[i]).toBe(saved.solution[i]);
  });
});
