// The mechanics shared by "fill a square grid with digits" games (Classic, Killer and Jigsaw Sudoku):
// placing digits and pencil marks, erasing, undo, and winning. Each game supplies its grid size and which
// cells constrain each other (peers); the state is plain data so it can be saved as JSON.

/** One cell's value and pencil marks, as they were before a move (for undo). */
export type Change = [index: number, value: number, notes: number];

export interface GridState {
  difficulty: string;
  puzzle: number[]; // givens; 0 = player fills it
  solution: number[];
  values: number[];
  notes: number[]; // bitmask of pencil marks per cell (bit d = digit d)
  history: Change[][];
  done: boolean;
}

export interface GridShape {
  size: number; // digits run 1..size, the grid is size × size
  peers: readonly (readonly number[])[]; // cells that may not share a digit with each cell
}

/**
 * Moves name the cells they act on: there's no selected cell. A tap places a digit, a drag adds or
 * takes away a pencil mark across the cells it passes, and erasing clears what a cell holds.
 */
export type GridAction =
  | { type: 'place'; index: number; digit: number }
  | { type: 'note'; indices: number[]; digit: number; on: boolean }
  | { type: 'erase'; indices: number[] }
  | { type: 'undo' };

const HISTORY_LIMIT = 500;

/** A fresh game state for a puzzle and its solution. */
export function gridStart(difficulty: string, puzzle: number[], solution: number[]): GridState {
  return {
    difficulty,
    puzzle,
    solution,
    values: puzzle.slice(),
    notes: new Array(puzzle.length).fill(0),
    history: [],
    done: false,
  };
}

/** Peers that share a row or column, for a size × size grid. */
export function linePeers(size: number): number[][] {
  return Array.from({ length: size * size }, (_, i) => {
    const peers: number[] = [];
    for (let j = 0; j < size * size; j++) {
      if (j !== i && (Math.floor(j / size) === Math.floor(i / size) || j % size === i % size)) peers.push(j);
    }
    return peers;
  });
}

/** Whether saved JSON has the shape of a grid game with `cells` cells. */
export function isGridState(value: unknown, cells: number): value is GridState {
  const g = value as Partial<GridState> | null;
  return (
    typeof g === 'object' && g !== null &&
    typeof g.difficulty === 'string' &&
    g.values?.length === cells && g.solution?.length === cells && g.puzzle?.length === cells && g.notes?.length === cells &&
    Array.isArray(g.history)
  );
}

export function hasConflict(values: readonly number[], peers: GridShape['peers'], i: number): boolean {
  const v = values[i];
  return v !== 0 && peers[i].some((p) => values[p] === v);
}

function apply<G extends GridState>(g: G, changes: Change[]): G {
  if (changes.length === 0) return g;
  const undo = changes.map(([i]): Change => [i, g.values[i], g.notes[i]]);
  const values = g.values.slice();
  const notes = g.notes.slice();
  for (const [i, v, n] of changes) {
    values[i] = v;
    notes[i] = n;
  }
  const history = [...g.history, undo].slice(-HISTORY_LIMIT);
  const solved = values.every((v, i) => v === g.solution[i]);
  return { ...g, values, notes, history, ...(solved && { done: true }) };
}

/** A cell on the board that the player fills (not a given). */
const open = (g: GridState, i: number, size: number) => Number.isInteger(i) && i >= 0 && i < size * size && g.puzzle[i] === 0;
const unique = (indices: number[]) => [...new Set(indices)];

/** Applies one move. Returns the same object when the move changes nothing. */
export function gridReducer<G extends GridState>(g: G, action: GridAction, { size, peers }: GridShape): G {
  switch (action.type) {
    case 'place': {
      const { index: i, digit: d } = action;
      if (g.done || !open(g, i, size) || d < 1 || d > size) return g;
      // The same digit again takes it away; any other replaces what the cell holds.
      if (g.values[i] === d) return apply(g, [[i, 0, 0]]);
      const bit = 1 << d;
      // Place the digit and clear it from the pencil marks it rules out.
      const changes: Change[] = [[i, d, 0]];
      for (const p of peers[i]) {
        if (g.notes[p] & bit) changes.push([p, g.values[p], g.notes[p] & ~bit]);
      }
      return apply(g, changes);
    }

    case 'note': {
      const { digit: d, on } = action;
      if (g.done || d < 1 || d > size) return g;
      const bit = 1 << d;
      const changes = unique(action.indices)
        .filter((i) => open(g, i, size) && g.values[i] === 0 && Boolean(g.notes[i] & bit) !== on)
        .map((i): Change => [i, 0, g.notes[i] ^ bit]);
      return apply(g, changes);
    }

    case 'erase': {
      if (g.done) return g;
      const changes = unique(action.indices)
        .filter((i) => open(g, i, size) && (g.values[i] !== 0 || g.notes[i] !== 0))
        .map((i): Change => [i, 0, 0]);
      return apply(g, changes);
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
  }
}

/** What a tap on the board does: set the pad's digit, add or take away its note, or erase. */
export type Mode = 'set' | 'notes' | 'erase';

/** What a key picks: a digit for the pad, or a mode (S to set, N for notes, Backspace/Delete/0 to erase). (GameScreen does Ctrl/Cmd+Z.) */
export function gridKey(e: KeyboardEvent): { digit: number } | { mode: Mode } | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (/^[1-9]$/.test(e.key)) return { digit: Number(e.key) };
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') return { mode: 'erase' };
  if (e.key === 'n' || e.key === 'N') return { mode: 'notes' };
  if (e.key === 's' || e.key === 'S') return { mode: 'set' };
  return null;
}
