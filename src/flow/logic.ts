// Flow: pairs of colored dots on a grid. Draw a path between each pair, through neighboring
// squares, so that paths never cross and every square is filled.
//
// Puzzles start from a real covering: every square begins as its own path, and neighboring path
// ends are joined at random until the right number of paths is left, each at least three squares
// long and never running alongside itself (which would allow an obvious shortcut). Each path's
// two ends become that color's dots. It's kept only if the solver (solve.ts) finds no other way
// to join the dots; otherwise another is made.
//
// Optional rules, any mix (all described by the `Board`):
// - walls: some edges between squares are closed; added on edges the answer doesn't use;
// - holes: some squares are missing and need no filling; taken out before the covering is made;
// - wrap: the edges join up, so a path leaving one side comes back on the opposite one;
// - bridges: a bridge square carries two paths, one straight across and one straight down, and is
//   filled once both cross it; each starts as two short straight paths crossing it.
import { countSolutions } from './solve';

export const DIFFICULTIES = {
  easy: { label: 'Easy', size: 5, colors: 5 },
  medium: { label: 'Medium', size: 7, colors: 7 },
  hard: { label: 'Hard', size: 9, colors: 10 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;

export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

export const RULES = {
  walls: { label: 'Walls', info: 'Paths can’t cross the thick walls between some squares.' },
  holes: { label: 'Holes', info: 'Some squares are missing; paths go around them, and they don’t need filling.' },
  wrap: { label: 'Wrapping', info: 'The edges join up: a path that leaves one side comes back on the opposite side.' },
  bridges: { label: 'Bridges', info: 'Two paths cross on a bridge, one straight across and one straight down; it’s filled once both do.' },
} as const;

export type Rule = keyof typeof RULES;
export type Rules = Record<Rule, boolean>;
export const NO_RULES: Rules = { walls: false, holes: false, wrap: false, bridges: false };

export const isRules = (value: unknown): value is Rules =>
  typeof value === 'object' && value !== null &&
  (Object.keys(RULES) as Rule[]).every((k) => typeof (value as Rules)[k] === 'boolean');

/** Squares are numbered row by row: r * size + c. */
export type Path = number[];

/** The grid and what the rules add to it. */
export interface Board {
  size: number;
  wrap: boolean;
  holes: number[];
  walls: [number, number][]; // pairs of neighboring squares with a wall between them
  bridges: number[];
}

export const plainBoard = (size: number): Board => ({ size, wrap: false, holes: [], walls: [], bridges: [] });

type Random = () => number;

const pick = <T>(a: readonly T[], random: Random): T => a[Math.floor(random() * a.length)];

function shuffle<T>(a: T[], random: Random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Geometry ----

/** Directions as [rows, columns]: up, down, left, right. */
export const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

/** The square one step from `i` in direction `d` (wrapping if the board does), or -1 off the edge. */
export function step(i: number, d: number, board: Board): number {
  const { size, wrap } = board;
  let r = Math.floor(i / size) + DIRS[d][0];
  let c = (i % size) + DIRS[d][1];
  if (wrap) {
    r = (r + size) % size;
    c = (c + size) % size;
  } else if (r < 0 || r >= size || c < 0 || c >= size) return -1;
  return r * size + c;
}

const edgeKey = (a: number, b: number) => (a < b ? `${a},${b}` : `${b},${a}`);

/** Per board: open neighbors of every square, and which squares are holes or bridges. */
const cache = new WeakMap<Board, { open: number[][]; hole: Set<number>; bridge: Set<number> }>();
function info(board: Board) {
  let found = cache.get(board);
  if (!found) {
    const hole = new Set(board.holes);
    const bridge = new Set(board.bridges);
    const walls = new Set(board.walls.map(([a, b]) => edgeKey(a, b)));
    const open = Array.from({ length: board.size * board.size }, (_, i) => {
      if (hole.has(i)) return [];
      const out: number[] = [];
      for (let d = 0; d < 4; d++) {
        const j = step(i, d, board);
        if (j !== -1 && j !== i && !hole.has(j) && !walls.has(edgeKey(i, j)) && !out.includes(j)) out.push(j);
      }
      return out;
    });
    found = { open, hole, bridge };
    cache.set(board, found);
  }
  return found;
}

/** Squares a path can step to from `i`: on the board, not a hole, no wall between. */
export const neighbors = (i: number, board: Board): number[] => info(board).open[i];
export const adjacent = (a: number, b: number, board: Board) => neighbors(a, board).includes(b);
export const isHole = (i: number, board: Board) => info(board).hole.has(i);
export const isBridge = (i: number, board: Board) => info(board).bridge.has(i);

/** The direction of the step from `a` to its neighbor `b`, or -1. */
export function dirOf(a: number, b: number, board: Board): number {
  for (let d = 0; d < 4; d++) if (step(a, d, board) === b) return d;
  return -1;
}

/** Whether a step in direction `d` runs across (left or right) rather than down. */
const across = (d: number) => d >= 2;

/** How `path` passes its square at `j`: 'across', 'down', or null if it doesn't go straight through. */
function passing(path: Path, j: number, board: Board): 'across' | 'down' | null {
  if (j <= 0 || j >= path.length - 1) return null;
  const d = dirOf(path[j - 1], path[j], board);
  if (d === -1 || step(path[j], d, board) !== path[j + 1]) return null;
  return across(d) ? 'across' : 'down';
}

/** How `path` uses the bridge at `j` so far: from the step into it, or out of it if it starts there. */
export function bridgeWay(path: Path, j: number, board: Board): 'across' | 'down' | null {
  const d = j > 0 ? dirOf(path[j - 1], path[j], board) : j + 1 < path.length ? dirOf(path[j], path[j + 1], board) : -1;
  return d === -1 ? null : across(d) ? 'across' : 'down';
}

// ---- Generation ----

export interface Puzzle {
  dots: [number, number][]; // per color, the two squares to join
  solution: Path[];
  board: Board;
}

/** Whether a path runs alongside itself: two squares adjacent on the grid but not on the path. */
function touchesItself(path: Path, board: Board): boolean {
  const index = new Map<number, number>();
  for (let k = 0; k < path.length; k++) {
    if (index.has(path[k])) return true; // through the same bridge twice
    index.set(path[k], k);
  }
  return path.some((cell, k) => neighbors(cell, board).some((n) => {
    const j = index.get(n);
    return j !== undefined && Math.abs(j - k) > 1;
  }));
}

/** Share of squares that are holes, walls per square, and bridges per board, with those rules on. */
const HOLES = 0.08;
const WALLS = 0.15;
const BRIDGES = { easy: 1, medium: 2, hard: 3 } as const;

/**
 * Settings whose puzzles can take a while to make: Hard with wrapping, where the uniqueness check
 * has no edges to box paths in, unless holes give it some back. On a laptop they take about half
 * a second to several seconds (the rest stay well under one); they're made in the background,
 * behind an orange Play or Next.
 */
export const isSlow = (difficulty: Difficulty, rules: Rules): boolean =>
  difficulty === 'hard' && rules.wrap && !rules.holes;

export function generate(difficulty: Difficulty, rules: Rules = NO_RULES, random: Random = Math.random): Puzzle {
  const { size, colors } = DIFFICULTIES[difficulty];
  for (;;) {
    // Each step makes a new board object: what's worked out per board (see `info`) is cached by
    // object, and must not outlive a change.
    let board: Board = { size, wrap: rules.wrap, holes: [], walls: [], bridges: [] };
    if (rules.holes) board = { ...board, holes: holes(board, random) };
    const start = rules.bridges ? bridges(board, BRIDGES[difficulty], random) : singles(board);
    if (!start) continue;
    board = { ...board, bridges: board.bridges.slice() };
    const paths = merge(board, start, colors, random);
    if (!paths) continue;
    if (rules.walls) board = { ...board, walls: walls(board, paths, random) };
    const dots = paths.map((p): [number, number] => [p[0], p[p.length - 1]]);
    if (countSolutions(dots, board, 2) !== 1) continue;
    return { dots, solution: paths, board };
  }
}

/** Every open square as a path of its own. */
const singles = (board: Board): Path[] =>
  Array.from({ length: board.size * board.size }, (_, i) => i).filter((i) => !isHole(i, board)).map((i) => [i]);

/** A few holes, keeping the rest in one piece and every square with at least two ways out. */
function holes(board: Board, random: Random): number[] {
  const n = board.size * board.size;
  const want = Math.max(2, Math.round(n * HOLES));
  const out: number[] = [];
  for (const i of shuffle([...Array(n).keys()], random)) {
    if (out.length >= want) break;
    const trial: Board = { ...board, holes: [...out, i] };
    const open = [...Array(n).keys()].filter((j) => !isHole(j, trial));
    if (open.some((j) => neighbors(j, trial).length < 2)) continue;
    // Still one piece?
    const seen = new Set([open[0]]);
    const queue = [open[0]];
    for (let q = 0; q < queue.length; q++) for (const j of neighbors(queue[q], trial)) if (!seen.has(j)) { seen.add(j); queue.push(j); }
    if (seen.size === open.length) out.push(i);
  }
  return out;
}

/**
 * Up to `count` bridges, each with all four neighbors open and not shared with another bridge. Each
 * starts as two straight three-square paths crossing it; every other open square is a path of its own.
 */
function bridges(board: Board, count: number, random: Random): Path[] | null {
  const used = new Set<number>();
  const start: Path[] = [];
  const n = board.size * board.size;
  for (const b of shuffle([...Array(n).keys()], random)) {
    if (board.bridges.length >= count) break;
    if (isHole(b, board) || used.has(b)) continue;
    const [up, down, left, right] = [0, 1, 2, 3].map((d) => step(b, d, board));
    const around = [up, down, left, right];
    if (around.some((j) => j === -1 || used.has(j) || isHole(j, board) || !adjacent(b, j, board))) continue;
    if (new Set([b, ...around]).size !== 5) continue;
    board.bridges.push(b);
    [b, ...around].forEach((j) => used.add(j));
    start.push([left, b, right], [up, b, down]);
  }
  if (board.bridges.length < count) return null;
  for (let i = 0; i < n; i++) if (!used.has(i) && !isHole(i, board)) start.push([i]);
  return start;
}

/** Walls on some edges the answer doesn't use (never at a bridge, never across a wrapped edge). */
function walls(board: Board, paths: Path[], random: Random): [number, number][] {
  const { size } = board;
  const used = new Set<string>();
  for (const p of paths) for (let k = 1; k < p.length; k++) used.add(edgeKey(p[k - 1], p[k]));
  const free: [number, number][] = [];
  for (let i = 0; i < size * size; i++) {
    if (isHole(i, board)) continue;
    const r = Math.floor(i / size);
    const c = i % size;
    for (const j of [c < size - 1 ? i + 1 : -1, r < size - 1 ? i + size : -1]) {
      if (j === -1 || isHole(j, board) || isBridge(i, board) || isBridge(j, board) || used.has(edgeKey(i, j))) continue;
      free.push([i, j]);
    }
  }
  return shuffle(free, random).slice(0, Math.round(size * size * WALLS));
}

function merge(board: Board, start: Path[], target: number, random: Random): Path[] | null {
  const n = board.size * board.size;
  let paths = start.map((p) => p.slice());
  const owner = new Array<number>(n); // path index for each path end, else -1
  const reindex = () => {
    owner.fill(-1);
    paths.forEach((p, k) => {
      owner[p[0]] = k;
      owner[p[p.length - 1]] = k;
    });
  };
  reindex();
  while (paths.length > target) {
    // Grow one of the shortest paths, so lengths stay even: try them in random order until one can
    // join a neighboring path end without running alongside itself.
    const order = paths.map((_, k) => k).sort((a, b) => paths[a].length - paths[b].length || random() - 0.5);
    let joined: { a: number; b: number; path: Path } | null = null;
    for (const a of order.slice(0, 12)) {
      const p = paths[a];
      const options: { a: number; b: number; path: Path }[] = [];
      for (const end of p.length === 1 ? [p[0]] : [p[0], p[p.length - 1]]) {
        for (const nb of neighbors(end, board)) {
          const b = owner[nb];
          if (b === -1 || b === a) continue; // not the end of another path
          const q = paths[b];
          const head = end === p[0] ? p.slice().reverse() : p; // ends with `end`
          const tail = nb === q[0] ? q : q.slice().reverse(); // starts with `nb`
          const path = [...head, ...tail];
          if (!touchesItself(path, board)) options.push({ a, b, path });
        }
      }
      if (options.length) {
        joined = pick(options, random);
        break;
      }
    }
    if (!joined) return null;
    const { a, b, path } = joined;
    paths = paths.filter((_, k) => k !== a && k !== b);
    paths.push(path);
    reindex();
  }
  if (paths.some((p) => p.length < 3)) return null;
  return paths;
}

// ---- Drawing ----

/** The color whose dot is at `cell`, or -1. */
export const dotColor = (dots: readonly [number, number][], cell: number) =>
  dots.findIndex(([a, b]) => a === cell || b === cell);

/** The color whose path covers `cell`, or -1 (the first one, on a bridge). */
export const pathColor = (paths: readonly Path[], cell: number) => paths.findIndex((p) => p.includes(cell));

/** Whether color k's path runs from one of its dots to the other. */
export function connected(dots: readonly [number, number][], paths: readonly Path[], k: number): boolean {
  const p = paths[k];
  if (p.length < 2) return false;
  const [a, b] = dots[k];
  return (p[0] === a && p[p.length - 1] === b) || (p[0] === b && p[p.length - 1] === a);
}

/**
 * Starting a stroke on `cell`: on a dot, that color's path restarts from it; on a path, the path
 * is cut back to end there (not on a bridge, where two paths meet). Returns the color being drawn
 * (or -1) and the paths.
 */
export function startStroke(dots: readonly [number, number][], paths: readonly Path[], cell: number, board: Board): { color: number; paths: Path[] } {
  const out = paths.map((p) => p.slice());
  const d = dotColor(dots, cell);
  if (d !== -1) {
    out[d] = [cell];
    return { color: d, paths: out };
  }
  const k = isBridge(cell, board) ? -1 : pathColor(paths, cell);
  if (k === -1) return { color: -1, paths: out };
  out[k] = out[k].slice(0, out[k].indexOf(cell) + 1);
  return { color: k, paths: out };
}

/**
 * Extends color k's path into neighboring `cell`. Going back over the path retraces it; another
 * color's dot or path blocks (move that one first); reaching the other dot completes the path
 * (it won't extend past that). A bridge is crossed straight: one path across and one down.
 */
export function extend(dots: readonly [number, number][], paths: readonly Path[], k: number, cell: number, board: Board): Path[] {
  const p = paths[k];
  const last = p[p.length - 1];
  if (last === undefined || !adjacent(last, cell, board)) return paths as Path[];
  const at = p.indexOf(cell);
  // Back onto its own path: cut back to there. Not onto a bridge it crosses from another side
  // (a path can't cross itself): only a step straight back onto it counts.
  if (at !== -1 && isBridge(cell, board) && at !== p.length - 2) return paths as Path[];
  if (at !== -1) return paths.map((q, j) => (j === k ? q.slice(0, at + 1) : q));
  if (connected(dots, paths, k)) return paths as Path[];
  // Leaving a bridge: straight on only.
  if (isBridge(last, board) && p.length >= 2) {
    const d = dirOf(p[p.length - 2], last, board);
    if (step(last, d, board) !== cell) return paths as Path[];
  }
  const d = dotColor(dots, cell);
  if (d !== -1 && d !== k) return paths as Path[];
  if (isBridge(cell, board)) {
    // Onto a bridge: only if no other path already crosses it this way.
    const way = across(dirOf(last, cell, board)) ? 'across' : 'down';
    const taken = paths.some((q, j) => j !== k && q.includes(cell) && bridgeWay(q, q.indexOf(cell), board) === way);
    if (taken) return paths as Path[];
  } else if (pathColor(paths, cell) !== -1) return paths as Path[];
  return paths.map((q, j) => (j === k ? [...q, cell] : q));
}

/**
 * A stroke let go with color k's path ending on a bridge would leave its end where it can't be
 * picked up again (a stroke can't start on a bridge). So it carries on one square, straight
 * through; if that square is taken, it goes back to just before the bridge instead.
 */
export function settle(dots: readonly [number, number][], paths: readonly Path[], k: number, board: Board): Path[] {
  const p = paths[k];
  const last = p[p.length - 1];
  if (p.length < 2 || !isBridge(last, board)) return paths as Path[];
  const on = extend(dots, paths, k, step(last, dirOf(p[p.length - 2], last, board), board), board);
  if (on !== paths) return on;
  return paths.map((q, j) => (j === k ? q.slice(0, -1) : q));
}

/**
 * Every pair joined and every square filled: each open square by exactly one path, each bridge by
 * two paths going straight through it, one across and one down.
 */
export function isSolved(dots: readonly [number, number][], paths: readonly Path[], board: Board): boolean {
  if (!dots.every((_, k) => connected(dots, paths, k))) return false;
  const n = board.size * board.size;
  const uses: { k: number; j: number }[][] = Array.from({ length: n }, () => []);
  paths.forEach((p, k) => p.forEach((cell, j) => uses[cell].push({ k, j })));
  for (let i = 0; i < n; i++) {
    if (isHole(i, board)) {
      if (uses[i].length) return false;
    } else if (isBridge(i, board)) {
      if (uses[i].length !== 2 || uses[i][0].k === uses[i][1].k) return false;
      const ways = uses[i].map(({ k, j }) => passing(paths[k], j, board));
      if (!ways.includes('across') || !ways.includes('down')) return false;
    } else if (uses[i].length !== 1) return false;
  }
  return true;
}
