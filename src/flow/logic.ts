// Flow: pairs of colored dots on a grid. Draw a path between each pair, through neighboring
// squares, so that paths never cross and every square is filled.
//
// Puzzles start from a real covering: every square begins as its own path, and neighboring path
// ends are joined at random until the right number of paths is left, each at least three squares
// long and never running alongside itself (which would allow an obvious shortcut). Each path's
// two ends become that color's dots.

export const DIFFICULTIES = {
  easy: { label: 'Easy', size: 5, colors: 5 },
  medium: { label: 'Medium', size: 7, colors: 7 },
  hard: { label: 'Hard', size: 9, colors: 10 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;

export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

/** Squares are numbered row by row: r * size + c. */
export type Path = number[];

type Random = () => number;

const pick = <T>(a: readonly T[], random: Random): T => a[Math.floor(random() * a.length)];

export function neighbors(i: number, size: number): number[] {
  const r = Math.floor(i / size);
  const c = i % size;
  const out: number[] = [];
  if (r > 0) out.push(i - size);
  if (r < size - 1) out.push(i + size);
  if (c > 0) out.push(i - 1);
  if (c < size - 1) out.push(i + 1);
  return out;
}

export const adjacent = (a: number, b: number, size: number) => neighbors(a, size).includes(b);

// ---- Generation ----

export interface Puzzle {
  dots: [number, number][]; // per color, the two squares to join
  solution: Path[];
}

/** Whether a path runs alongside itself: two squares adjacent on the grid but not on the path. */
function touchesItself(path: Path, size: number): boolean {
  const index = new Map(path.map((cell, k) => [cell, k]));
  return path.some((cell, k) => neighbors(cell, size).some((n) => {
    const j = index.get(n);
    return j !== undefined && Math.abs(j - k) > 1;
  }));
}

export function generate(difficulty: Difficulty, random: Random = Math.random): Puzzle {
  const { size, colors } = DIFFICULTIES[difficulty];
  for (;;) {
    const paths = merge(size, colors, random);
    if (paths) return { dots: paths.map((p) => [p[0], p[p.length - 1]]), solution: paths };
  }
}

function merge(size: number, target: number, random: Random): Path[] | null {
  let paths: Path[] = Array.from({ length: size * size }, (_, i) => [i]);
  const owner = new Array<number>(size * size); // path index for each path end, else -1
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
        for (const n of neighbors(end, size)) {
          const b = owner[n];
          if (b === -1 || b === a) continue; // not the end of another path
          const q = paths[b];
          const head = end === p[0] ? p.slice().reverse() : p; // ends with `end`
          const tail = n === q[0] ? q : q.slice().reverse(); // starts with `n`
          const path = [...head, ...tail];
          if (!touchesItself(path, size)) options.push({ a, b, path });
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

/** The color whose path covers `cell`, or -1. */
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
 * is cut back to end there. Returns the color being drawn (or -1) and the paths.
 */
export function startStroke(dots: readonly [number, number][], paths: readonly Path[], cell: number): { color: number; paths: Path[] } {
  const out = paths.map((p) => p.slice());
  const d = dotColor(dots, cell);
  if (d !== -1) {
    out[d] = [cell];
    return { color: d, paths: out };
  }
  const k = pathColor(paths, cell);
  if (k === -1) return { color: -1, paths: out };
  out[k] = out[k].slice(0, out[k].indexOf(cell) + 1);
  return { color: k, paths: out };
}

/**
 * Extends color k's path into neighboring `cell`. Going back over the path retraces it; another
 * color's dot or path blocks (move that one first); reaching the other dot completes the path
 * (it won't extend past that).
 */
export function extend(dots: readonly [number, number][], paths: readonly Path[], k: number, cell: number, size: number): Path[] {
  const p = paths[k];
  const last = p[p.length - 1];
  if (last === undefined || !adjacent(last, cell, size)) return paths as Path[];
  const at = p.indexOf(cell);
  if (at !== -1) return paths.map((q, j) => (j === k ? q.slice(0, at + 1) : q));
  if (connected(dots, paths, k)) return paths as Path[];
  const d = dotColor(dots, cell);
  if (d !== -1 && d !== k) return paths as Path[];
  if (pathColor(paths, cell) !== -1) return paths as Path[];
  return paths.map((q, j) => (j === k ? [...q, cell] : q));
}

/** Every pair joined and every square filled. */
export function isSolved(dots: readonly [number, number][], paths: readonly Path[], size: number): boolean {
  if (!dots.every((_, k) => connected(dots, paths, k))) return false;
  return paths.reduce((n, p) => n + p.length, 0) === size * size && new Set(paths.flat()).size === size * size;
}
