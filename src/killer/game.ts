// Killer Sudoku on top of the shared grid mechanics (../shared/grid.ts). Cells can't repeat a
// digit with their row, column, box or cage; cages draw as dashed outlines with their sum in the
// corner, boxes as thick lines.
import type { GridLayout } from '../shared/GridPlay.svelte';
import { gridStart, isGridState, type GridState } from '../shared/grid';
import { colOf, PEERS, rowOf } from '../sudoku/logic';
import { cageSatisfied, generate, isDifficulty, type Cage, type Difficulty } from './logic';

export const STORAGE_KEY = 'games.killer.v1';

export interface Game extends GridState {
  difficulty: Difficulty;
  cages: Cage[];
}

export function newGame(difficulty: Difficulty): Game {
  const { cages, puzzle, solution } = generate(difficulty);
  return { ...gridStart(difficulty, puzzle, solution), difficulty, cages };
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  return isDifficulty(g?.difficulty) && Array.isArray(g.cages) && isGridState(g, 81);
}

/** Layout derived from the cages, cached per game (cages never change during a game). */
const cache = new WeakMap<Cage[], { cageOf: number[]; peers: number[][]; sumAt: Map<number, number> }>();

function cageInfo(cages: Cage[]) {
  let info = cache.get(cages);
  if (!info) {
    const cageOf = new Array<number>(81);
    cages.forEach((c, k) => c.cells.forEach((i) => (cageOf[i] = k)));
    const peers = PEERS.map((p, i) => [...new Set([...p, ...cages[cageOf[i]].cells])].filter((j) => j !== i));
    const sumAt = new Map(cages.filter((c) => c.cells.length > 1).map((c) => [c.cells[0], c.sum]));
    info = { cageOf, peers, sumAt };
    cache.set(cages, info);
  }
  return info;
}

export function layout(g: Game): GridLayout {
  const { cageOf, peers, sumAt } = cageInfo(g.cages);
  const wrong = new Set<number>();
  for (const c of g.cages) {
    const vals = c.cells.map((i) => g.values[i]);
    if (vals.every(Boolean) && !cageSatisfied(c.sum, vals)) c.cells.forEach((i) => wrong.add(i));
  }
  const same = (i: number, j: number) => cageOf[i] === cageOf[j];
  return {
    size: 9,
    peers,
    wallRight: (i) => colOf(i) % 3 === 2 && colOf(i) < 8,
    wallBottom: (i) => rowOf(i) % 3 === 2 && rowOf(i) < 8,
    outline: (i) => ({
      top: rowOf(i) === 0 || !same(i, i - 9),
      right: colOf(i) === 8 || !same(i, i + 1),
      bottom: rowOf(i) === 8 || !same(i, i + 9),
      left: colOf(i) === 0 || !same(i, i - 1),
    }),
    label: (i) => (sumAt.has(i) ? String(sumAt.get(i)) : ''),
    error: (i) => wrong.has(i),
  };
}
