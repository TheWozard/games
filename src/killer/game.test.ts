import { describe, expect, it } from 'vitest';
import { gridReducer, type GridAction } from '../shared/grid';
import { isGame, layout, newGame, type Game } from './game';

const play = (g: Game, ...actions: GridAction[]) => actions.reduce((s, a) => gridReducer(s, a, layout(s)), g);

describe('layout', () => {
  it('labels each multi-cell cage once, on its first cell', () => {
    const g = newGame('hard');
    const shape = layout(g);
    for (const c of g.cages) {
      expect(c.cells.map((i) => shape.label!(i)).filter(Boolean)).toEqual(c.cells.length > 1 ? [String(c.sum)] : []);
    }
  });

  it('outlines exactly the sides between different cages (and the board edge)', () => {
    const g = newGame('medium');
    const shape = layout(g);
    const cageOf = (i: number) => g.cages.findIndex((c) => c.cells.includes(i));
    for (let i = 0; i < 81; i++) {
      const o = shape.outline!(i);
      expect(o.right).toBe(i % 9 === 8 || cageOf(i) !== cageOf(i + 1));
      expect(o.bottom).toBe(i >= 72 || cageOf(i) !== cageOf(i + 9));
    }
  });

  it('treats cage-mates as peers, so a repeat inside a cage is a conflict', () => {
    const g = newGame('hard');
    const shape = layout(g);
    const cage = g.cages.find((c) => c.cells.length >= 2)!;
    const [a, b] = cage.cells;
    expect(shape.peers[a]).toContain(b);
  });

  it('marks a full cage with the wrong sum, and only then', () => {
    let g = newGame('medium');
    const cage = g.cages.find((c) => c.cells.length >= 2 && c.cells.every((i) => !g.puzzle[i]))!;
    const [first, ...rest] = cage.cells;
    for (const i of rest) g = play(g, { type: 'select', index: i }, { type: 'enter', digit: g.solution[i] });
    expect(cage.cells.some((i) => layout(g).error!(i))).toBe(false);
    const used = new Set(cage.cells.map((i) => g.solution[i]));
    const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => !used.has(d))!;
    g = play(g, { type: 'select', index: first }, { type: 'enter', digit: wrong });
    expect(cage.cells.every((i) => layout(g).error!(i))).toBe(true);
    g = play(g, { type: 'enter', digit: g.solution[first] });
    expect(cage.cells.some((i) => layout(g).error!(i))).toBe(false);
  });
});

describe('game', () => {
  it('solves when every cell matches, and round-trips through JSON', () => {
    let g = newGame('easy');
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
    for (let i = 0; i < 81; i++) {
      if (!g.puzzle[i]) g = play(g, { type: 'select', index: i }, { type: 'enter', digit: g.solution[i] });
    }
    expect(g.done).toBe(true);
  });

  it('rejects saves that do not fit', () => {
    const g = newGame('easy');
    expect(isGame({ ...g, difficulty: 'extreme' })).toBe(false);
    expect(isGame({ ...g, values: [] })).toBe(false);
  });
});
