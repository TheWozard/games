// The mechanics shared by "fill a square grid with digits" games (Sudoku, Cages): selecting cells,
// placing digits and pencil marks, undo, and winning. Each game supplies its grid size and which
// cells constrain each other (peers); the state is plain data so it can be saved as JSON.

/** One cell's value and pencil marks, as they were before a move (for undo). */
export type Change = [index: number, value: number, notes: number];

export interface GridState {
  difficulty: string;
  puzzle: number[]; // givens; 0 = player fills it
  solution: number[];
  values: number[];
  notes: number[]; // bitmask of pencil marks per cell (bit d = digit d)
  selected: number | null;
  notesMode: boolean;
  history: Change[][];
  done: boolean;
}

export interface GridShape {
  size: number; // digits run 1..size, the grid is size × size
  peers: readonly (readonly number[])[]; // cells that may not share a digit with each cell
}

export type GridAction =
  | { type: 'select'; index: number }
  | { type: 'move'; dr: number; dc: number }
  | { type: 'enter'; digit: number }
  | { type: 'erase' }
  | { type: 'undo' }
  | { type: 'toggleNotes' };

const HISTORY_LIMIT = 500;

/** A fresh game state for a puzzle and its solution. */
export function gridStart(difficulty: string, puzzle: number[], solution: number[]): GridState {
  return {
    difficulty,
    puzzle,
    solution,
    values: puzzle.slice(),
    notes: new Array(puzzle.length).fill(0),
    selected: null,
    notesMode: false,
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

const editable = (g: GridState) => !g.done && g.selected !== null && g.puzzle[g.selected] === 0;

function apply<G extends GridState>(g: G, changes: Change[]): G {
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

/** Applies one move. Returns the same object when the move changes nothing. */
export function gridReducer<G extends GridState>(g: G, action: GridAction, { size, peers }: GridShape): G {
  switch (action.type) {
    case 'select':
      return { ...g, selected: action.index };

    case 'move': {
      const i = g.selected ?? Math.floor((size * size) / 2);
      const r = (Math.floor(i / size) + action.dr + size) % size;
      const c = ((i % size) + action.dc + size) % size;
      return { ...g, selected: r * size + c };
    }

    case 'enter': {
      const d = action.digit;
      if (!editable(g) || d < 1 || d > size) return g;
      const i = g.selected!;
      const bit = 1 << d;
      if (g.notesMode) return g.values[i] ? g : apply(g, [[i, 0, g.notes[i] ^ bit]]);
      if (g.values[i] === d) return apply(g, [[i, 0, 0]]);
      // Place the digit and clear it from the pencil marks it rules out.
      const changes: Change[] = [[i, d, 0]];
      for (const p of peers[i]) {
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

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
};

/** Keyboard controls: digits, Backspace/Delete/0 to erase, N for notes, arrows, Ctrl/Cmd+Z. */
export function gridKeyAction(e: KeyboardEvent): GridAction | null {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') return { type: 'undo' };
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (/^[1-9]$/.test(e.key)) return { type: 'enter', digit: Number(e.key) };
  if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') return { type: 'erase' };
  if (e.key === 'n' || e.key === 'N') return { type: 'toggleNotes' };
  const arrow = ARROWS[e.key];
  return arrow ? { type: 'move', dr: arrow[0], dc: arrow[1] } : null;
}
