import { describe, expect, it } from 'vitest';
import { EMPTY, gameOf, isGame, MAIN, NOTE, reducer, type Game } from './board';
import * as hitori from './hitori/logic';
import * as lightup from './lightup/logic';
import * as nurikabe from './nurikabe/logic';
import * as stars from './stars/logic';

const none = () => false;

describe('reducer', () => {
  it('paints a stroke as one undo step, and changes nothing for a stroke that changes nothing', () => {
    let g = gameOf('easy', stars.generate('easy'));
    g = reducer(g, { type: 'paint', indices: [0, 1, 2], value: NOTE }, none);
    expect(g.marks.slice(0, 4)).toEqual([NOTE, NOTE, NOTE, EMPTY]);
    g = reducer(g, { type: 'paint', indices: [3], value: MAIN }, none);
    expect(g.history).toHaveLength(2);
    expect(reducer(g, { type: 'paint', indices: [3], value: MAIN }, none)).toBe(g);
    expect(reducer(g, { type: 'paint', indices: [-1, 999], value: MAIN }, none)).toBe(g);
    expect(reducer(g, { type: 'paint', indices: [4], value: 7 }, none)).toBe(g);
    g = reducer(g, { type: 'undo' }, none);
    expect(g.marks[3]).toBe(EMPTY);
    g = reducer(g, { type: 'undo' }, none);
    expect(g.marks.every((m) => m === EMPTY)).toBe(true);
    expect(reducer(g, { type: 'undo' }, none)).toBe(g);
  });

  it('leaves fixed cells alone', () => {
    const p = nurikabe.generate('easy');
    const fixed = (i: number) => p.clues[i] !== null;
    const clue = p.clues.findIndex((v) => v !== null);
    const g = gameOf('easy', p);
    expect(reducer(g, { type: 'paint', indices: [clue], value: MAIN }, fixed)).toBe(g);
  });

  it('is done when the marks are the answer, notes or not, and then stays', () => {
    const games: [Game<{ size: number; solution: boolean[] }>, (i: number) => boolean][] = [];
    const s = stars.generate('medium');
    games.push([gameOf('medium', s), none]);
    const k = nurikabe.generate('medium');
    games.push([gameOf('medium', k), (i) => k.clues[i] !== null]);
    const h = hitori.generate('medium');
    games.push([gameOf('medium', h), none]);
    const l = lightup.generate('medium');
    games.push([gameOf('medium', l), (i) => l.walls[i] !== null]);
    for (let [g, fixed] of games) {
      const answer = g.puzzle.solution;
      g = reducer(g, { type: 'paint', indices: answer.flatMap((a, i) => (a ? [] : [i])), value: NOTE }, fixed);
      expect(g.done).toBe(false);
      g = reducer(g, { type: 'paint', indices: answer.flatMap((a, i) => (a ? [i] : [])), value: MAIN }, fixed);
      expect(g.done).toBe(true);
      expect(reducer(g, { type: 'paint', indices: [0], value: EMPTY }, fixed)).toBe(g);
      expect(reducer(g, { type: 'undo' }, fixed)).toBe(g);
    }
  });
});

describe('isGame', () => {
  it('round-trips each game through JSON, and rejects saves that don’t fit', () => {
    const cases = [
      [stars.generate('easy'), stars.isDifficulty, stars.isPuzzle],
      [nurikabe.generate('easy'), nurikabe.isDifficulty, nurikabe.isPuzzle],
      [hitori.generate('easy'), hitori.isDifficulty, hitori.isPuzzle],
      [lightup.generate('easy'), lightup.isDifficulty, lightup.isPuzzle],
    ] as const;
    for (const [p, isDifficulty, isPuzzle] of cases) {
      const check = (v: unknown) => isGame(v, isDifficulty, (q, d) => isDifficulty(d) && (isPuzzle as (q: unknown, d: string) => boolean)(q, d));
      const g = reducer(gameOf('easy', p), { type: 'paint', indices: [1], value: NOTE }, none);
      expect(check(JSON.parse(JSON.stringify(g)))).toBe(true);
      expect(check({ ...g, marks: g.marks.map((m, i) => (i === 0 ? 3 : m)) })).toBe(false);
      expect(check({ ...g, difficulty: 'expert' })).toBe(false);
      expect(check({ ...g, difficulty: 'hard' })).toBe(false); // the puzzle is easy-sized
      expect(check({ ...g, marks: g.marks.slice(1) })).toBe(false);
      expect(check(null)).toBe(false);
    }
  });
});
