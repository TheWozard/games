// Sudoku on top of the shared grid mechanics (../shared/grid.ts). The saved shape matches what
// earlier versions saved under the same key, so games in progress carry over.
import { gridReducer, gridStart, isGridState, type GridAction, type GridShape, type GridState } from '../shared/grid';
import { colOf, generate, isDifficulty, PEERS, rowOf, type Difficulty } from './logic';

export const STORAGE_KEY = 'games.sudoku.v1';

export interface Game extends GridState {
  difficulty: Difficulty;
}

export const SHAPE: GridShape = { size: 9, peers: PEERS };

export function newGame(difficulty: Difficulty): Game {
  const { puzzle, solution } = generate(difficulty);
  return { ...gridStart(difficulty, puzzle, solution), difficulty };
}

export const isGame = (value: unknown): value is Game =>
  isGridState(value, 81) && isDifficulty(value.difficulty);

export const reducer = (g: Game, action: GridAction): Game => gridReducer(g, action, SHAPE);

/** Thick lines between the 3×3 boxes. */
export const LAYOUT = {
  ...SHAPE,
  wallRight: (i: number) => colOf(i) % 3 === 2,
  wallBottom: (i: number) => rowOf(i) % 3 === 2,
};

