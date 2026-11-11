// Jigsaw Sudoku on top of the shared grid mechanics (../shared/grid.ts). Cells can't repeat a
// digit with their row, column or region; regions are outlined with thick lines.
import type { GridLayout } from '../../shared/GridPlay.svelte';
import { gridStart, isGridState, type GridState } from '../../shared/grid';
import { geometry } from '../classic/grade';
import { generate, isDifficulty, type Difficulty } from './logic';

export const STORAGE_KEY = 'games.jigsaw.v1';

export interface Game extends GridState {
  difficulty: Difficulty;
  regions: number[]; // a region number (0–8) per cell
}

export function newGame(difficulty: Difficulty): Game {
  const { regions, puzzle, solution } = generate(difficulty);
  return { ...gridStart(difficulty, puzzle, solution), difficulty, regions };
}

/** Nine regions of nine cells each. */
export function isRegions(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== 81) return false;
  const counts = new Array<number>(9).fill(0);
  for (const k of value) {
    if (!Number.isInteger(k) || k < 0 || k > 8) return false;
    counts[k]++;
  }
  return counts.every((n) => n === 9);
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  return isDifficulty(g?.difficulty) && isRegions(g.regions) && isGridState(g, 81);
}

export function layout(g: Game): GridLayout {
  const { regions } = g;
  return {
    size: 9,
    peers: geometry(regions).peers, // cached per regions array
    wallRight: (i) => i % 9 < 8 && regions[i] !== regions[i + 1],
    wallBottom: (i) => i < 72 && regions[i] !== regions[i + 9],
  };
}
