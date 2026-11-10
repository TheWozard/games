// Game state and every move as a pure reducer. The shape is what gets saved to localStorage, and
// matches what the pre-build version saved under the same key, so games in progress carry over.
import { colOf, generate, isDifficulty, PEERS, rowOf, type Difficulty, type Grid } from './logic';

export const STORAGE_KEY = 'games.sudoku.v1';
const HISTORY_LIMIT = 500;

/** One cell's value and pencil marks, as they were before a move (for undo). */
type Change = [index: number, value: number, notes: number];

export interface Game {
  difficulty: Difficulty;
  puzzle: Grid;
  solution: Grid;
  values: Grid;
  notes: number[]; // bitmask of pencil marks per cell
  selected: number | null;
  notesMode: boolean;
  history: Change[][];
  done: boolean;
}

export function newGame(difficulty: Difficulty): Game {
  const { puzzle, solution } = generate(difficulty);
  return {
    difficulty,
    puzzle,
    solution,
    values: puzzle.slice(),
    notes: new Array(81).fill(0),
    selected: null,
    notesMode: false,
    history: [],
    done: false,
  };
}

export function isGame(value: unknown): value is Game {
  const g = value as Partial<Game> | null;
  return (
    typeof g === 'object' && g !== null &&
    isDifficulty(g.difficulty) &&
    g.values?.length === 81 && g.solution?.length === 81 && g.puzzle?.length === 81 && g.notes?.length === 81 &&
    Array.isArray(g.history)
  );
}

export type Action =
  | { type: 'start'; game: Game }
  | { type: 'select'; index: number }
  | { type: 'move'; dr: number; dc: number }
  | { type: 'enter'; digit: number }
  | { type: 'erase' }
  | { type: 'undo' }
  | { type: 'toggleNotes' };

const editable = (g: Game) => !g.done && g.selected !== null && g.puzzle[g.selected] === 0;

function apply(g: Game, changes: Change[]): Game {
  const undo = changes.map(([i]): Change => [i, g.values[i], g.notes[i]]);
  const values = g.values.slice();
  const notes = g.notes.slice();
  for (const [i, v, n] of changes) {
    values[i] = v;
    notes[i] = n;
  }
  const history = [...g.history, undo].slice(-HISTORY_LIMIT);
  const solved = values.every((v, i) => v === g.solution[i]);
  return { ...g, values, notes, history, ...(solved && { done: true, selected: null }) };
}

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'start':
      return action.game;

    case 'select':
      return { ...g, selected: action.index };

    case 'move': {
      const i = g.selected ?? 40;
      const r = (rowOf(i) + action.dr + 9) % 9;
      const c = (colOf(i) + action.dc + 9) % 9;
      return { ...g, selected: r * 9 + c };
    }

    case 'enter': {
      if (!editable(g)) return g;
      const i = g.selected!;
      const d = action.digit;
      const bit = 1 << d;
      if (g.notesMode) return g.values[i] ? g : apply(g, [[i, 0, g.notes[i] ^ bit]]);
      if (g.values[i] === d) return apply(g, [[i, 0, 0]]);
      // Place the digit and clear it from the pencil marks it rules out.
      const changes: Change[] = [[i, d, 0]];
      for (const p of PEERS[i]) {
        if (g.notes[p] & bit) changes.push([p, g.values[p], g.notes[p] & ~bit]);
      }
      return apply(g, changes);
    }

    case 'erase': {
      if (!editable(g)) return g;
      const i = g.selected!;
      return g.values[i] || g.notes[i] ? apply(g, [[i, 0, 0]]) : g;
    }

    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      const values = g.values.slice();
      const notes = g.notes.slice();
      for (const [i, v, n] of last) {
        values[i] = v;
        notes[i] = n;
      }
      return { ...g, values, notes, history: g.history.slice(0, -1) };
    }

    case 'toggleNotes':
      return { ...g, notesMode: !g.notesMode };
  }
}
