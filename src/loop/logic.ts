// Loop: draw a single closed loop along the grid lines between dots. The loop never branches or
// crosses itself. A number in a cell says how many of that cell's four sides the loop uses.
// Optional rules add two more kinds of clue:
// - squares: a square in a cell, light or dark; every light square ends up on one side of the loop
//   (inside or outside) and every dark square on the other;
// - rings: a ringed dot, which the loop passes through.
//
// Puzzles start from a real loop: the outline of a random blob of cells with no holes and no
// pinches. With the rules on, a few cells get squares and a few of the loop's dots get rings; every
// other cell gets its count, then counts are taken away in random order for as long as a solver
// still finds exactly one loop.

import type { Wait } from '../shared/wait';

export const DIFFICULTIES = {
  easy: { label: 'Easy', rows: 5, cols: 5, keep: 0.7, squares: 0.12, rings: 0.12 },
  medium: { label: 'Medium', rows: 7, cols: 6, keep: 0.5, squares: 0.12, rings: 0.12 },
  hard: { label: 'Hard', rows: 9, cols: 7, keep: 0, squares: 0.1, rings: 0.1 },
} as const;

/** Squares and rings do some of the numbers' work, so with either on a puzzle keeps fewer numbers. */
const KEEP_WITH_RULES = 0.1;

export const RULES = {
  squares: { label: 'Squares', info: 'Solid squares end up on one side of the loop, hollow squares on the other.' },
  rings: { label: 'Rings', info: 'The loop passes through every ringed dot.' },
} as const;

export type Rule = keyof typeof RULES;
export type Rules = Record<Rule, boolean>;
export const NO_RULES: Rules = { squares: false, rings: false };

export const isRules = (value: unknown): value is Rules =>
  typeof value === 'object' && value !== null &&
  (Object.keys(RULES) as Rule[]).every((k) => typeof (value as Rules)[k] === 'boolean');

export type Difficulty = keyof typeof DIFFICULTIES;

export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

type Random = () => number;

function shuffle<T>(a: T[], random: Random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Geometry ----
// Edges are numbered horizontals first: h(r, c) joins dot (r, c) to (r, c + 1), for r in 0..rows,
// c in 0..cols-1; then verticals: v(r, c) joins dot (r, c) to (r + 1, c), r in 0..rows-1, c in 0..cols.

export interface Grid {
  rows: number;
  cols: number;
}

export const edgeCount = ({ rows, cols }: Grid) => (rows + 1) * cols + rows * (cols + 1);
export const hEdge = ({ cols }: Grid, r: number, c: number) => r * cols + c;
export const vEdge = ({ rows, cols }: Grid, r: number, c: number) => (rows + 1) * cols + r * (cols + 1) + c;

/** The two dots an edge joins, as [row, col] pairs. */
export function edgeEnds(g: Grid, e: number): [[number, number], [number, number]] {
  const hCount = (g.rows + 1) * g.cols;
  if (e < hCount) {
    const r = Math.floor(e / g.cols);
    const c = e % g.cols;
    return [[r, c], [r, c + 1]];
  }
  const k = e - hCount;
  const r = Math.floor(k / (g.cols + 1));
  const c = k % (g.cols + 1);
  return [[r, c], [r + 1, c]];
}

/** The four edges around a cell: top, bottom, left, right. */
export const cellEdges = (g: Grid, r: number, c: number) => [hEdge(g, r, c), hEdge(g, r + 1, c), vEdge(g, r, c), vEdge(g, r, c + 1)];

/** The edges meeting at a dot (2 to 4 of them). */
export function dotEdges(g: Grid, r: number, c: number): number[] {
  const out: number[] = [];
  if (c > 0) out.push(hEdge(g, r, c - 1));
  if (c < g.cols) out.push(hEdge(g, r, c));
  if (r > 0) out.push(vEdge(g, r - 1, c));
  if (r < g.rows) out.push(vEdge(g, r, c));
  return out;
}

/** The edge between two neighboring dots, or -1. */
export function edgeBetween(g: Grid, [r1, c1]: [number, number], [r2, c2]: [number, number]): number {
  if (r1 === r2 && Math.abs(c1 - c2) === 1) return hEdge(g, r1, Math.min(c1, c2));
  if (c1 === c2 && Math.abs(r1 - r2) === 1) return vEdge(g, Math.min(r1, r2), c1);
  return -1;
}

/** The two kinds of square. */
export const LIGHT = 0;
export const DARK = 1;
export type Square = typeof LIGHT | typeof DARK;

/** Everything a puzzle shows. `squares` is per cell; `rings` is per dot, row by row (rows + 1 by cols + 1). */
export interface Clues {
  clues: readonly (number | null)[];
  squares: readonly (Square | null)[];
  rings: readonly boolean[];
}

export const dotIndex = (g: Grid, r: number, c: number) => r * (g.cols + 1) + c;

/** Per cell, whether it's inside the loop drawn by `on` (by counting the sides crossed from the left). */
export function insideCells(g: Grid, on: readonly boolean[]): boolean[] {
  const out: boolean[] = [];
  for (let r = 0; r < g.rows; r++) {
    let inside = false;
    for (let c = 0; c < g.cols; c++) {
      if (on[vEdge(g, r, c)]) inside = !inside;
      out.push(inside);
    }
  }
  return out;
}

/** Whether no light square shares a side of the loop with a dark one. */
export function squaresSorted(g: Grid, squares: readonly (Square | null)[], on: readonly boolean[]): boolean {
  const inside = insideCells(g, on);
  const side: (boolean | undefined)[] = [undefined, undefined];
  for (let i = 0; i < squares.length; i++) {
    const k = squares[i];
    if (k === null) continue;
    side[k] ??= inside[i];
    if (side[k] !== inside[i]) return false;
  }
  return side[LIGHT] === undefined || side[DARK] === undefined || side[LIGHT] !== side[DARK];
}

const ON = 1;
const OFF = 0;
const UNKNOWN = -1;

/** Whether `on` (true per edge) is exactly one closed loop matching every clue. */
export function isSolved(g: Grid, { clues, squares, rings }: Clues, on: readonly boolean[]): boolean {
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const clue = clues[r * g.cols + c];
      if (clue !== null && cellEdges(g, r, c).filter((e) => on[e]).length !== clue) return false;
    }
  }
  // Every dot has 0 or 2 lines, and the lines form one connected cycle.
  let start = -1;
  for (let r = 0; r <= g.rows; r++) {
    for (let c = 0; c <= g.cols; c++) {
      const d = dotEdges(g, r, c).filter((e) => on[e]).length;
      if ((d !== 0 && d !== 2) || (rings[dotIndex(g, r, c)] && d !== 2)) return false;
      if (d === 2 && start === -1) start = dotEdges(g, r, c).find((e) => on[e])!;
    }
  }
  if (start === -1) return false;
  const total = on.filter(Boolean).length;
  const seen = new Set([start]);
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    for (const [r, c] of edgeEnds(g, queue[q])) {
      for (const e of dotEdges(g, r, c)) {
        if (on[e] && !seen.has(e)) {
          seen.add(e);
          queue.push(e);
        }
      }
    }
  }
  return seen.size === total && squaresSorted(g, squares, on);
}

// ---- Generation ----

export interface Puzzle extends Clues {
  clues: (number | null)[]; // per cell, row by row
  squares: (Square | null)[];
  rings: boolean[];
  solution: boolean[]; // per edge
}

/** A random blob of cells: connected, no holes, and no two cells touching only at a corner. */
function blob(g: Grid, random: Random): boolean[] {
  const { rows, cols } = g;
  const n = rows * cols;
  const inside = new Array<boolean>(n).fill(false);
  const at = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols && inside[r * cols + c];
  const near = (i: number) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([y, x]) => y >= 0 && y < rows && x >= 0 && x < cols).map(([y, x]) => y * cols + x);
  };
  // No dot may have its four surrounding cells in a checkerboard (the loop would touch itself).
  const pinchFree = () => {
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const a = at(r - 1, c - 1);
        const b = at(r - 1, c);
        const d = at(r, c - 1);
        const e = at(r, c);
        if (a === e && b === d && a !== b) return false;
      }
    }
    return true;
  };
  // Every outside cell must reach the edge of the grid through outside cells (no holes).
  const holeFree = () => {
    const seen = new Set<number>();
    const queue: number[] = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      if (!inside[i] && (r === 0 || c === 0 || r === rows - 1 || c === cols - 1)) {
        seen.add(i);
        queue.push(i);
      }
    }
    for (let q = 0; q < queue.length; q++) {
      for (const j of near(queue[q])) {
        if (!inside[j] && !seen.has(j)) {
          seen.add(j);
          queue.push(j);
        }
      }
    }
    return inside.filter((x) => !x).length === seen.size;
  };

  const target = Math.round(n * (0.42 + random() * 0.16));
  inside[Math.floor(random() * n)] = true;
  let size = 1;
  for (let tries = 0; size < target && tries < n * 30; tries++) {
    const edge = shuffle(inside.flatMap((x, i) => (x ? near(i).filter((j) => !inside[j]) : [])), random);
    if (edge.length === 0) break;
    const j = edge[0];
    inside[j] = true;
    if (pinchFree() && holeFree()) size++;
    else inside[j] = false;
  }
  return inside;
}

const SOLVE_BUDGET = 1000;

/**
 * How long a setting takes to make (see shared/wait.ts). Hard, with no clue kept but those the
 * solver needs, checks for a single loop after every count it takes away: about 100–190 ms
 * (median) on a laptop and up to about half a second, so likely most of a second on a phone. It's
 * slow, made in the background behind an orange Play or Next. Easy and Medium take a few
 * milliseconds.
 */
export const wait = (difficulty: Difficulty): Wait => (difficulty === 'hard' ? 'slow' : 'quick');

export const isSlow = (difficulty: Difficulty): boolean => wait(difficulty) !== 'quick';

export function generate(difficulty: Difficulty, rules: Rules = NO_RULES, random: Random = Math.random): Puzzle {
  const { rows, cols, squares: squareShare, rings: ringShare } = DIFFICULTIES[difficulty];
  const keep = Math.max(0, DIFFICULTIES[difficulty].keep - (rules.squares || rules.rings ? KEEP_WITH_RULES : 0));
  const g = { rows, cols };
  for (;;) {
    const inside = blob(g, random);
    const solution = new Array<boolean>(edgeCount(g)).fill(false);
    const at = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols && inside[r * cols + c];
    for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) solution[hEdge(g, r, c)] = at(r - 1, c) !== at(r, c);
    for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) solution[vEdge(g, r, c)] = at(r, c - 1) !== at(r, c);

    // Squares: light inside and dark outside, or the other way round; at least one of each.
    const lightInside = random() < 0.5;
    const squares = new Array<Square | null>(rows * cols).fill(null);
    const want = rules.squares ? Math.max(2, Math.round(rows * cols * squareShare)) : 0;
    const pickIn = shuffle([...inside.keys()].filter((i) => inside[i]), random);
    const pickOut = shuffle([...inside.keys()].filter((i) => !inside[i]), random);
    if (want > 0) {
      const inCount = Math.max(1, Math.min(pickIn.length, Math.round(want * pickIn.length / (rows * cols))));
      for (const i of pickIn.slice(0, inCount)) squares[i] = lightInside ? LIGHT : DARK;
      for (const i of pickOut.slice(0, Math.max(1, want - inCount))) squares[i] = lightInside ? DARK : LIGHT;
    }

    // Rings on a few of the dots the loop passes through.
    const rings = new Array<boolean>((rows + 1) * (cols + 1)).fill(false);
    const onLoop: number[] = [];
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c <= cols; c++) if (dotEdges(g, r, c).some((e) => solution[e])) onLoop.push(dotIndex(g, r, c));
    }
    const ringCount = rules.rings ? Math.max(1, Math.round(onLoop.length * ringShare)) : 0;
    for (const d of shuffle(onLoop, random).slice(0, ringCount)) rings[d] = true;

    const clues: (number | null)[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) clues.push(squares[r * cols + c] === null ? cellEdges(g, r, c).filter((e) => solution[e]).length : null);
    }
    const puzzle = { clues, squares, rings };
    if (solve(g, puzzle, 2, SOLVE_BUDGET)?.length !== 1) continue;
    // Take numbers away while the answer stays unique, down to the difficulty's share of cells.
    const floor = Math.round(rows * cols * keep);
    let shown = clues.filter((x) => x !== null).length;
    for (const i of shuffle([...clues.keys()], random)) {
      if (shown <= floor) break;
      const value = clues[i];
      if (value === null) continue;
      clues[i] = null;
      if (solve(g, puzzle, 2, SOLVE_BUDGET)?.length === 1) shown--;
      else clues[i] = value;
    }
    return { clues, squares, rings, solution };
  }
}

// ---- Solver ----

/**
 * Finds up to `limit` loops matching the clues (each as on/off per edge), or null if the search
 * runs past `budget` steps. Propagates clue counts, dot degrees (0 or 2) and "no early loop",
 * then guesses an edge that extends an open path.
 */
export function solve(g: Grid, puzzle: Clues, limit: number, budget = Infinity): boolean[][] | null {
  const { clues, squares, rings } = puzzle;
  const E = edgeCount(g);
  const n = g.rows * g.cols;
  // The two cells each edge separates (n stands for everything outside the grid).
  const sides = Array.from({ length: E }, (_, e) => {
    const [[r1, c1], [r2]] = edgeEnds(g, e);
    const cell = (r: number, c: number) => (r >= 0 && r < g.rows && c >= 0 && c < g.cols ? r * g.cols + c : n);
    return r1 === r2 ? [cell(r1 - 1, c1), cell(r1, c1)] : [cell(r1, c1 - 1), cell(r1, c1)];
  });
  const squareCells = [...squares.keys()].filter((i) => squares[i] !== null);
  const cells: { edges: number[]; clue: number }[] = [];
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const clue = clues[r * g.cols + c];
      if (clue !== null) cells.push({ edges: cellEdges(g, r, c), clue });
    }
  }
  const dots: number[][] = [];
  for (let r = 0; r <= g.rows; r++) for (let c = 0; c <= g.cols; c++) dots.push(dotEdges(g, r, c));
  const ringed = dots.filter((_, d) => rings[d]);
  const ends = Array.from({ length: E }, (_, e) => edgeEnds(g, e).map(([r, c]) => r * (g.cols + 1) + c));
  const found: boolean[][] = [];
  let steps = 0;

  /** Applies the local rules until nothing changes; false on a contradiction. */
  const propagate = (s: number[]): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      const set = (e: number, v: number) => {
        if (s[e] === UNKNOWN) {
          s[e] = v;
          changed = true;
        }
      };
      for (const { edges, clue } of cells) {
        let on = 0;
        let unknown = 0;
        for (const e of edges) {
          if (s[e] === ON) on++;
          else if (s[e] === UNKNOWN) unknown++;
        }
        if (on > clue || on + unknown < clue) return false;
        if (unknown && on === clue) edges.forEach((e) => set(e, OFF));
        else if (unknown && on + unknown === clue) edges.forEach((e) => set(e, ON));
      }
      for (const edges of dots) {
        let on = 0;
        let unknown = 0;
        for (const e of edges) {
          if (s[e] === ON) on++;
          else if (s[e] === UNKNOWN) unknown++;
        }
        if (on > 2 || (on === 1 && unknown === 0)) return false;
        if (unknown === 0) continue;
        if (on === 2 || (on === 0 && unknown === 1)) edges.forEach((e) => set(e, OFF));
        else if (on === 1 && unknown === 1) edges.forEach((e) => set(e, ON));
      }
      for (const edges of ringed) {
        let on = 0;
        let unknown = 0;
        for (const e of edges) {
          if (s[e] === ON) on++;
          else if (s[e] === UNKNOWN) unknown++;
        }
        if (on + unknown < 2) return false;
        if (unknown && on + unknown === 2) edges.forEach((e) => set(e, ON));
      }
      if (!changed) {
        // Inside and outside: a line between two cells puts them on different sides, no line on the
        // same side; squares of one kind share a side, the two kinds differ. Whenever that already
        // ties two neighboring cells together, the side between them follows.
        const parent = Array.from({ length: n + 1 }, (_, i) => i);
        const flip = new Array<number>(n + 1).fill(0); // parity relative to parent
        const find = (x: number): [number, number] => {
          if (parent[x] === x) return [x, 0];
          const [root, p] = find(parent[x]);
          flip[x] ^= p;
          parent[x] = root;
          return [root, flip[x]];
        };
        const relate = (a: number, b: number, differ: number): boolean => {
          const [ra, pa] = find(a);
          const [rb, pb] = find(b);
          if (ra === rb) return (pa ^ pb) === differ;
          parent[ra] = rb;
          flip[ra] = pa ^ pb ^ differ;
          return true;
        };
        for (let e = 0; e < E; e++) if (s[e] !== UNKNOWN && !relate(sides[e][0], sides[e][1], s[e] === ON ? 1 : 0)) return false;
        for (let k = 1; k < squareCells.length; k++) {
          const a = squareCells[0];
          const b = squareCells[k];
          if (!relate(a, b, squares[a] === squares[b] ? 0 : 1)) return false;
        }
        for (let e = 0; e < E; e++) {
          if (s[e] !== UNKNOWN) continue;
          const [ra, pa] = find(sides[e][0]);
          const [rb, pb] = find(sides[e][1]);
          if (ra === rb) set(e, pa ^ pb ? ON : OFF);
        }
      }
      if (!changed) {
        // An edge joining the two ends of one path would close a loop. That's only allowed if the
        // loop would then be the whole answer; otherwise the edge must be off.
        const comp = components(s);
        for (let e = 0; e < E; e++) {
          if (s[e] !== UNKNOWN) continue;
          const [a, b] = ends[e];
          if (comp[a] === -1 || comp[a] !== comp[b]) continue;
          const trial = s.slice();
          trial[e] = ON;
          for (let k = 0; k < E; k++) if (trial[k] === UNKNOWN) trial[k] = OFF;
          if (!isSolved(g, puzzle, trial.map((v) => v === ON))) set(e, OFF);
        }
      }
    }
    return true;
  };

  /** For each dot, an id shared by dots joined by lines that are on (-1 for dots with none). */
  const components = (s: number[]): number[] => {
    const comp = new Array<number>(dots.length).fill(-1);
    let id = 0;
    for (let d = 0; d < dots.length; d++) {
      if (comp[d] !== -1 || !dots[d].some((e) => s[e] === ON)) continue;
      comp[d] = id;
      const queue = [d];
      for (let q = 0; q < queue.length; q++) {
        for (const e of dots[queue[q]]) {
          if (s[e] !== ON) continue;
          for (const x of ends[e]) {
            if (comp[x] === -1) {
              comp[x] = id;
              queue.push(x);
            }
          }
        }
      }
      id++;
    }
    return comp;
  };

  const search = (s: number[]) => {
    if (++steps > budget || found.length >= limit) return;
    if (!propagate(s)) return;
    // If the lines already drawn make a complete, valid loop, that's this branch's only answer:
    // any further line would be a second piece.
    const closed = s.map((v) => v === ON);
    if (closed.includes(true) && isSolved(g, puzzle, closed)) {
      found.push(closed);
      return;
    }
    // Guess: an unknown edge at the open end of a path, else next to a clue, else any.
    let pick = -1;
    for (const edges of dots) {
      if (edges.filter((e) => s[e] === ON).length === 1) {
        pick = edges.find((e) => s[e] === UNKNOWN) ?? -1;
        if (pick !== -1) break;
      }
    }
    if (pick === -1) {
      for (const { edges } of cells) {
        pick = edges.find((e) => s[e] === UNKNOWN) ?? -1;
        if (pick !== -1) break;
      }
    }
    if (pick === -1) pick = s.indexOf(UNKNOWN);
    if (pick === -1) return;
    for (const v of [ON, OFF]) {
      const next = s.slice();
      next[pick] = v;
      search(next);
    }
  };

  search(new Array<number>(E).fill(UNKNOWN));
  return steps > budget ? null : found;
}
