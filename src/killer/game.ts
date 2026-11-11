// Killer Sudoku on top of the shared grid mechanics (../shared/grid.ts). Cells can't repeat a
// digit with their row, column, box or cage; each cage is a textured zone with its sum in the
// corner, and boxes are thick lines.
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
const cache = new WeakMap<Cage[], { cageOf: number[]; peers: number[][]; sumAt: Map<number, number>; colourOf: number[] }>();

export const ZONES = 5;

/**
 * A zone texture (0..ZONES-1) per cage such that cages that touch never share one. Any map can be
 * coloured with four, so five always works: a small backtracking search, most-constrained cage
 * first. Deterministic, so a puzzle keeps its colours across reloads.
 */
export function cageColours(cages: readonly Cage[], cageOf: readonly number[]): number[] {
  const touching = cages.map(() => new Set<number>());
  for (let i = 0; i < 81; i++) {
    for (const j of [i % 9 < 8 ? i + 1 : -1, i < 72 ? i + 9 : -1]) {
      if (j >= 0 && cageOf[i] !== cageOf[j]) {
        touching[cageOf[i]].add(cageOf[j]);
        touching[cageOf[j]].add(cageOf[i]);
      }
    }
  }
  const colourOf = cages.map(() => -1);
  const colour = (left: number): boolean => {
    if (left === 0) return true;
    // The uncoloured cage with the fewest colours still open to it (ties: most neighbours).
    let k = -1;
    let bestFree = Infinity;
    for (let c = 0; c < cages.length; c++) {
      if (colourOf[c] !== -1) continue;
      const used = new Set([...touching[c]].map((n) => colourOf[n]));
      const free = ZONES - [...used].filter((x) => x >= 0).length;
      if (free < bestFree || (free === bestFree && touching[c].size > touching[k].size)) {
        k = c;
        bestFree = free;
      }
    }
    const taken = new Set([...touching[k]].map((n) => colourOf[n]));
    // Start each search at a different texture, so they spread across the board.
    for (let n = 0; n < ZONES; n++) {
      const c = (k + n) % ZONES;
      if (taken.has(c)) continue;
      colourOf[k] = c;
      if (colour(left - 1)) return true;
    }
    colourOf[k] = -1;
    return false;
  };
  colour(cages.length);
  return colourOf;
}

function cageInfo(cages: Cage[]) {
  let info = cache.get(cages);
  if (!info) {
    const cageOf = new Array<number>(81);
    cages.forEach((c, k) => c.cells.forEach((i) => (cageOf[i] = k)));
    const peers = PEERS.map((p, i) => [...new Set([...p, ...cages[cageOf[i]].cells])].filter((j) => j !== i));
    const sumAt = new Map(cages.filter((c) => c.cells.length > 1).map((c) => [c.cells[0], c.sum]));
    info = { cageOf, peers, sumAt, colourOf: cageColours(cages, cageOf) };
    cache.set(cages, info);
  }
  return info;
}

export function layout(g: Game): GridLayout {
  const { cageOf, peers, sumAt, colourOf } = cageInfo(g.cages);
  const wrong = new Set<number>();
  for (const c of g.cages) {
    const vals = c.cells.map((i) => g.values[i]);
    if (vals.every(Boolean) && !cageSatisfied(c.sum, vals)) c.cells.forEach((i) => wrong.add(i));
  }
  return {
    size: 9,
    peers,
    wallRight: (i) => colOf(i) % 3 === 2 && colOf(i) < 8,
    wallBottom: (i) => rowOf(i) % 3 === 2 && rowOf(i) < 8,
    label: (i) => (sumAt.has(i) ? String(sumAt.get(i)) : ''),
    zone: (i) => colourOf[cageOf[i]],
    error: (i) => wrong.has(i),
  };
}
