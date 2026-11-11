// Bridges: islands carry numbers; join them with horizontal or vertical bridges so each island has
// that many bridges, with at most two between any pair, no bridges crossing, and every island
// connected. Puzzles are grown as a random connected network (plus a few loops), numbered from it,
// and kept only if a solver confirms the answer is unique.

export const DIFFICULTIES = {
  easy: { label: 'Easy', cols: 7, rows: 7, islands: 12 },
  medium: { label: 'Medium', cols: 9, rows: 11, islands: 22 },
  hard: { label: 'Hard', cols: 11, rows: 14, islands: 34 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;

export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

export interface Island {
  r: number;
  c: number;
  n: number; // bridges it needs
}

/** A pair of islands that can see each other along a row or column (a possible bridge). */
export interface Edge {
  a: number; // island indices, a above / left of b
  b: number;
  horizontal: boolean;
  cells: number[]; // grid cells strictly between them (r * cols + c)
}

type Random = () => number;

const pick = <T>(a: readonly T[], random: Random): T => a[Math.floor(random() * a.length)];

/**
 * Every possible bridge: each island paired with the nearest island to its right and below,
 * plus which possible bridges cross each other.
 */
export function edgesOf(islands: readonly Island[], cols: number, rows: number): { edges: Edge[]; crosses: number[][] } {
  const at = new Map(islands.map((s, k) => [s.r * cols + s.c, k]));
  const edges: Edge[] = [];
  islands.forEach((s, a) => {
    for (const horizontal of [true, false]) {
      const cells: number[] = [];
      for (let step = 1; ; step++) {
        const r = horizontal ? s.r : s.r + step;
        const c = horizontal ? s.c + step : s.c;
        if (r >= rows || c >= cols) break;
        const b = at.get(r * cols + c);
        if (b !== undefined) {
          if (cells.length > 0) edges.push({ a, b, horizontal, cells });
          break;
        }
        cells.push(r * cols + c);
      }
    }
  });
  const crosses = edges.map((e) =>
    edges.flatMap((f, k) => (f.horizontal !== e.horizontal && f.cells.some((x) => e.cells.includes(x)) ? [k] : [])));
  return { edges, crosses };
}

// ---- Generation ----

const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;

export interface Puzzle {
  islands: Island[];
  solution: number[]; // bridges per edge of edgesOf(islands)
}

const SEARCH_BUDGET = 20000;

export function generate(difficulty: Difficulty, random: Random = Math.random): Puzzle {
  const { cols, rows, islands: target } = DIFFICULTIES[difficulty];
  for (;;) {
    const puzzle = grow(cols, rows, target, random);
    if (!puzzle) continue;
    const { edges, crosses } = edgesOf(puzzle.islands, cols, rows);
    const found = solve(puzzle.islands, edges, crosses, 2, SEARCH_BUDGET);
    if (found?.length === 1) return { islands: puzzle.islands, solution: found[0] };
  }
}

/** A random connected network of about `target` islands, or null if it came out too small. */
function grow(cols: number, rows: number, target: number, random: Random): { islands: Island[] } | null {
  const ISLAND = -1;
  // Per cell: 0 empty, ISLAND, or 1 / 2 for a horizontal / vertical bridge passing through.
  const grid = new Array<number>(cols * rows).fill(0);
  const islands: Island[] = [];
  const index = new Map<number, number>();
  const links = new Map<string, number>(); // "a,b" (a < b) → bridges
  const inside = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols;
  const nearIsland = (r: number, c: number) =>
    DIRS.some(([dr, dc]) => inside(r + dr, c + dc) && grid[(r + dr) * cols + c + dc] === ISLAND);

  const addIsland = (r: number, c: number) => {
    grid[r * cols + c] = ISLAND;
    index.set(r * cols + c, islands.length);
    islands.push({ r, c, n: 0 });
  };
  const addBridge = (a: number, b: number, path: number[], horizontal: boolean, count: number) => {
    for (const x of path) grid[x] = horizontal ? 1 : 2;
    links.set(`${Math.min(a, b)},${Math.max(a, b)}`, count);
    islands[a].n += count;
    islands[b].n += count;
  };

  addIsland(Math.floor(random() * rows), Math.floor(random() * cols));
  for (let tries = 0; islands.length < target && tries < target * 60; tries++) {
    // From a random island, a random direction: walk over empty cells and drop a new island
    // somewhere along the way (not next to another island), bridged back to where we started.
    const a = Math.floor(random() * islands.length);
    const [dr, dc] = pick(DIRS, random);
    const path: number[] = [];
    const spots: number[] = [];
    for (let step = 1; ; step++) {
      const r = islands[a].r + dr * step;
      const c = islands[a].c + dc * step;
      if (!inside(r, c) || grid[r * cols + c] !== 0) break;
      if (step >= 2 && !nearIsland(r, c)) spots.push(step);
      path.push(r * cols + c);
    }
    if (spots.length === 0) continue;
    const step = pick(spots, random);
    const r = islands[a].r + dr * step;
    const c = islands[a].c + dc * step;
    addIsland(r, c);
    addBridge(a, islands.length - 1, path.slice(0, step - 1), dr === 0, random() < 0.6 ? 1 : 2);
  }
  if (islands.length < target * 0.8) return null;

  // A few loops: bridge some neighboring islands the tree left unconnected.
  const { edges } = edgesOf(islands, cols, rows);
  for (const e of edges) {
    if (random() > 0.25 || links.has(`${e.a},${e.b}`)) continue;
    if (e.cells.some((x) => grid[x] !== 0)) continue;
    if (islands[e.a].n >= 8 || islands[e.b].n >= 8) continue;
    addBridge(e.a, e.b, e.cells, e.horizontal, 1);
  }
  return { islands };
}

// ---- Solver ----

/**
 * Finds up to `limit` solutions (bridge counts per edge), or gives up (null) after `budget`
 * search steps. Propagates island counts, crossings and connectivity before each guess.
 */
export function solve(
  islands: readonly Island[],
  edges: readonly Edge[],
  crosses: readonly (readonly number[])[],
  limit: number,
  budget = Infinity,
): number[][] | null {
  const of: number[][] = islands.map(() => []);
  edges.forEach((e, k) => {
    of[e.a].push(k);
    of[e.b].push(k);
  });
  const found: number[][] = [];
  let steps = 0;

  /** Tightens [lo, hi] per edge; false on a contradiction. */
  const propagate = (lo: number[], hi: number[]): boolean => {
    for (let changed = true; changed; ) {
      changed = false;
      for (let i = 0; i < islands.length; i++) {
        const n = islands[i].n;
        let sumLo = 0;
        let sumHi = 0;
        for (const k of of[i]) {
          sumLo += lo[k];
          sumHi += hi[k];
        }
        if (sumLo > n || sumHi < n) return false;
        for (const k of of[i]) {
          const newLo = Math.max(lo[k], n - (sumHi - hi[k]));
          const newHi = Math.min(hi[k], n - (sumLo - lo[k]));
          if (newLo > newHi) return false;
          if (newLo !== lo[k] || newHi !== hi[k]) {
            lo[k] = newLo;
            hi[k] = newHi;
            changed = true;
          }
        }
      }
      for (let k = 0; k < edges.length; k++) {
        if (lo[k] === 0) continue;
        for (const x of crosses[k]) {
          if (lo[x] > 0) return false;
          if (hi[x] > 0) {
            hi[x] = 0;
            changed = true;
          }
        }
      }
    }
    // Every island must still be reachable over edges that may hold bridges.
    if (component(0, (k) => hi[k] > 0).size !== islands.length) return false;
    // A group joined by certain bridges, all of whose islands are full, is cut off for good.
    const seen = new Set<number>();
    for (let i = 0; i < islands.length; i++) {
      if (seen.has(i)) continue;
      const group = component(i, (k) => lo[k] > 0);
      group.forEach((j) => seen.add(j));
      if (group.size === islands.length) continue;
      if ([...group].every((j) => of[j].every((k) => lo[k] === hi[k]))) return false;
    }
    return true;
  };

  const component = (start: number, usable: (k: number) => boolean): Set<number> => {
    const seen = new Set([start]);
    const queue = [start];
    for (let q = 0; q < queue.length; q++) {
      for (const k of of[queue[q]]) {
        if (!usable(k)) continue;
        const j = edges[k].a === queue[q] ? edges[k].b : edges[k].a;
        if (!seen.has(j)) {
          seen.add(j);
          queue.push(j);
        }
      }
    }
    return seen;
  };

  const search = (lo: number[], hi: number[]) => {
    if (++steps > budget || found.length >= limit) return;
    if (!propagate(lo, hi)) return;
    // Branch on an open edge at the island with the fewest open edges.
    let best = -1;
    let bestOpen = Infinity;
    for (let i = 0; i < islands.length; i++) {
      const open = of[i].filter((k) => lo[k] !== hi[k]);
      if (open.length > 0 && open.length < bestOpen) {
        best = open[0];
        bestOpen = open.length;
      }
    }
    if (best === -1) {
      found.push(lo.slice());
      return;
    }
    for (let v = hi[best]; v >= lo[best]; v--) {
      const lo2 = lo.slice();
      const hi2 = hi.slice();
      lo2[best] = hi2[best] = v;
      search(lo2, hi2);
    }
  };

  search(
    edges.map(() => 0),
    edges.map((e) => Math.min(2, islands[e.a].n, islands[e.b].n)),
  );
  return steps > budget ? null : found;
}

/** Whether `bridges` (per edge) meets every rule: numbers, at most two, no crossings, connected. */
export function isSolved(islands: readonly Island[], edges: readonly Edge[], crosses: readonly (readonly number[])[], bridges: readonly number[]): boolean {
  const counts = islands.map(() => 0);
  edges.forEach((e, k) => {
    counts[e.a] += bridges[k];
    counts[e.b] += bridges[k];
  });
  if (!counts.every((n, i) => n === islands[i].n)) return false;
  if (bridges.some((v, k) => v > 2 || (v > 0 && crosses[k].some((x) => bridges[x] > 0)))) return false;
  const seen = new Set([0]);
  const queue = [0];
  for (let q = 0; q < queue.length; q++) {
    edges.forEach((e, k) => {
      if (!bridges[k]) return;
      const j = e.a === queue[q] ? e.b : e.b === queue[q] ? e.a : -1;
      if (j >= 0 && !seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
    });
  }
  return seen.size === islands.length;
}
