import { describe, expect, it } from 'vitest';
import { newGame, reducer, type Game } from './game';

const emptyCell = (g: Game) => g.puzzle.indexOf(0);

describe('reducer', () => {
  it('places a digit, clears it from peer notes, and undoes both', () => {
    let g = newGame('easy');
    const i = emptyCell(g);
    const d = g.solution[i];
    const peer = (i + 9) % 81;
    g = { ...g, notes: g.notes.map((n, k) => (k === peer ? 1 << d : n)) };
    g = reducer(g, { type: 'select', index: i });
    g = reducer(g, { type: 'enter', digit: d });
    expect(g.values[i]).toBe(d);
    expect(g.notes[peer]).toBe(0);
    g = reducer(g, { type: 'undo' });
    expect(g.values[i]).toBe(0);
    expect(g.notes[peer]).toBe(1 << d);
  });

  it('ignores edits to given cells', () => {
    const g = newGame('easy');
    const given = g.puzzle.findIndex(Boolean);
    const selected = reducer(g, { type: 'select', index: given });
    expect(reducer(selected, { type: 'enter', digit: 1 })).toBe(selected);
  });

  it('finishes when the last cell is filled correctly', () => {
    let g = newGame('easy');
    for (let i = 0; i < 81; i++) {
      if (g.puzzle[i]) continue;
      g = reducer(reducer(g, { type: 'select', index: i }), { type: 'enter', digit: g.solution[i] });
    }
    expect(g.done).toBe(true);
    expect(reducer(g, { type: 'tick' })).toBe(g);
  });
});
