import { describe, expect, it } from 'vitest';
import { isGame, newGame, reducer } from './game';
import { NO_RULES, solve, TALL } from './logic';

describe('reducer', () => {
  it('picks up, pours, and undoes', () => {
    let g = newGame('easy');
    const [from, to] = solve(g.tubes)![0];
    g = reducer(g, { type: 'tap', tube: from });
    expect(g.selected).toBe(from);
    const before = g.tubes;
    g = reducer(g, { type: 'tap', tube: to });
    expect(g.selected).toBeNull();
    expect(g.tubes).not.toEqual(before);
    g = reducer(g, { type: 'undo' });
    expect(g.tubes).toEqual(before);
  });

  it('puts a tube down when tapped again, and ignores empty tubes', () => {
    let g = newGame('easy');
    const full = g.tubes.findIndex((t) => t.length);
    const empty = g.tubes.findIndex((t) => !t.length);
    expect(reducer(g, { type: 'tap', tube: empty })).toBe(g);
    g = reducer(reducer(g, { type: 'tap', tube: full }), { type: 'tap', tube: full });
    expect(g.selected).toBeNull();
  });

  it('is done when sorted, and round-trips through JSON', () => {
    let g = newGame('medium');
    for (const [from, to] of solve(g.tubes)!) g = reducer(reducer(g, { type: 'tap', tube: from }), { type: 'tap', tube: to });
    expect(g.done).toBe(true);
    expect(reducer(g, { type: 'tap', tube: 0 })).toBe(g);
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });
});

describe('tall tubes', () => {
  it('deals six-layer tubes and sorts them', () => {
    let g = newGame('easy', { mystery: false, tall: true });
    expect(g.tubes.filter((t) => t.length).every((t) => t.length === TALL)).toBe(true);
    for (const [from, to] of solve(g.tubes, Infinity, TALL)!) g = reducer(reducer(g, { type: 'tap', tube: from }), { type: 'tap', tube: to });
    expect(g.done).toBe(true);
  });
});

describe('mystery', () => {
  const rules = { mystery: true, tall: false };

  it('hides all but each tube’s top layer at the start', () => {
    const g = newGame('medium', rules);
    g.tubes.forEach((t, i) => expect(g.hidden[i]).toEqual(t.map((_, k) => k < t.length - 1)));
    expect(newGame('medium').hidden.flat().some(Boolean)).toBe(false);
  });

  it('shows poured layers and each new top, keeps others hidden, and undoes both', () => {
    let g = newGame('medium', rules);
    const [from, to] = solve(g.tubes)![0];
    const before = g;
    g = reducer(reducer(g, { type: 'tap', tube: from }), { type: 'tap', tube: to });
    // The tube poured from shows its new top; the one poured into shows everything it received.
    if (g.tubes[from].length) expect(g.hidden[from].at(-1)).toBe(false);
    expect(g.hidden[to].slice(before.tubes[to].length).every((h) => !h)).toBe(true);
    // Layers that didn't move or surface are still hidden.
    const stillHidden = g.hidden.flat().filter(Boolean).length;
    expect(stillHidden).toBeGreaterThan(0);
    expect(stillHidden).toBeLessThanOrEqual(before.hidden.flat().filter(Boolean).length);
    g = reducer(g, { type: 'undo' });
    expect(g.tubes).toEqual(before.tubes);
    expect(g.hidden).toEqual(before.hidden);
  });

  it('shows everything once sorted', () => {
    let g = newGame('easy', rules);
    for (const [from, to] of solve(g.tubes)!) g = reducer(reducer(g, { type: 'tap', tube: from }), { type: 'tap', tube: to });
    expect(g.done).toBe(true);
    expect(g.hidden.flat().some(Boolean)).toBe(false);
  });
});

describe('saves', () => {
  it('round-trips with rules', () => {
    const g = newGame('easy', { mystery: true, tall: true });
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
  });

  it('loads a save from before the rules, history included', () => {
    let g = newGame('easy');
    const [from, to] = solve(g.tubes)![0];
    g = reducer(reducer(g, { type: 'tap', tube: from }), { type: 'tap', tube: to });
    const old = { difficulty: g.difficulty, tubes: g.tubes, selected: null, done: false, history: g.history.map((h) => h.tubes) };
    const save = JSON.parse(JSON.stringify(old));
    expect(isGame(save)).toBe(true);
    expect(save.rules).toEqual(NO_RULES);
    expect(reducer(save, { type: 'undo' }).tubes).toEqual(g.history[0].tubes);
  });
});
