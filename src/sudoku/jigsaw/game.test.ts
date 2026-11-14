import { describe, expect, it } from 'vitest';
import { gridReducer } from '../../shared/grid';
import { isGame, layout, newGame } from './game';

describe('layout', () => {
  it('outlines the regions, untinted, and treats region-mates as peers', () => {
    const g = newGame('easy');
    const shape = layout(g);
    expect(shape.zone).toBeUndefined();
    for (let i = 0; i < 81; i++) {
      if (i % 9 < 8) expect(shape.wallRight!(i)).toBe(g.regions[i] !== g.regions[i + 1]);
      if (i < 72) expect(shape.wallBottom!(i)).toBe(g.regions[i] !== g.regions[i + 9]);
      expect(shape.wallRight!(i) && i % 9 === 8).toBe(false);
      const mates = g.regions.flatMap((r, j) => (r === g.regions[i] && j !== i ? [j] : []));
      for (const j of mates) expect(shape.peers[i]).toContain(j);
    }
  });
});

describe('game', () => {
  it('finishes when the last cell is filled correctly, and round-trips through JSON', () => {
    let g = newGame('medium');
    expect(isGame(JSON.parse(JSON.stringify(g)))).toBe(true);
    for (let i = 0; i < 81; i++) {
      if (g.puzzle[i]) continue;
      g = gridReducer(g, { type: 'place', index: i, digit: g.solution[i] }, layout(g));
    }
    expect(g.done).toBe(true);
    expect(isGame({ ...g, regions: g.regions.slice(1) })).toBe(false);
    expect(isGame({ ...g, regions: g.regions.map(() => 0) })).toBe(false);
    expect(isGame({ ...g, difficulty: 'expert' })).toBe(false);
  });
});
