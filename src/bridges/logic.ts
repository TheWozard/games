// Bridges: islands carry numbers; join them with horizontal or vertical bridges so each island has
// that many bridges, with at most two between any pair, no bridges crossing, and every island
// connected. Puzzles are grown as a random connected network (plus a few loops), numbered from it,
// and kept only if a solver confirms the answer is unique.
//
// Optional rules, any mix:
// - colors: islands are red, blue or gray; a bridge joins two islands of the same color, or a gray
//   island to any island;
// - blocks: some empty spots hold a block that no bridge may pass;
// - diagonals: islands can also be bridged diagonally.

export const DIFFICULTIES = {
  easy: { label: 'Easy', cols: 7, rows: 7, islands: 12 },
  medium: { label: 'Medium', cols: 9, rows: 11, islands: 22 },
  hard: { label: 'Hard', cols: 11, rows: 14, islands: 34 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;

export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

export const RULES = {
  colors: { label: 'Colors', info: 'Bridges join red to red and blue to blue; plain islands join any.' },
  blocks: { label: 'Blocks', info: 'No bridge may pass over a block.' },
  diagonals: { label: 'Diagonals', info: 'Bridges can also run diagonally, even between islands that touch at a corner.' },
} as const;

export type Rule = keyof typeof RULES;
export type Rules = Record<Rule, boolean>;
export const NO_RULES: Rules = { colors: false, blocks: false, diagonals: false };

export const isRules = (value: unknown): value is Rules =>
  typeof value === 'object' && value !== null &&
  (Object.keys(RULES) as Rule[]).every((k) => typeof (value as Rules)[k] === 'boolean');

/** Island colors under the colors rule. Gray joins any color. */
export const GRAY = 0;

export interface Island {
  r: number;
  c: number;
  n: number; // bridges it needs
  color?: number; // with the colors rule: GRAY, 1 or 2
}

/** Whether two islands' colors let a bridge join them. */
export const colorsMatch = (s: Island, t: Island) => !s.color || !t.color || s.color === t.color;

/** What besides the islands shapes the possible bridges. */
export interface Terrain {
  blocks: readonly number[]; // cells (r * cols + c) no bridge may pass
  diagonals: boolean;
}

export const OPEN: Terrain = { blocks: [], diagonals: false };

/** A pair of islands that can see each other along a row, column or diagonal (a possible bridge). */
export interface Edge {
  a: number; // island indices: b is a step of (dr, dc) at a time from a, with dr > 0, or dr = 0 and dc > 0
  b: number;
  dr: number;
  dc: number;
  cells: number[]; // grid cells strictly between them (r * cols + c)
}

type Random = () => number;

const pick = <T>(a: readonly T[], random: Random): T => a[Math.floor(random() * a.length)];

/** Directions a bridge can run, each once (right, down, then the two diagonals going down). */
const FORWARD = [[0, 1], [1, 0], [1, 1], [1, -1]] as const;

type P = { x: number; y: number };
const orient = (a: P, b: P, c: P) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
/** Whether segments p–q and r–s cross at a point inside both. */
export const segmentsCross = (p: P, q: P, r: P, s: P) =>
  orient(r, s, p) * orient(r, s, q) < 0 && orient(p, q, r) * orient(p, q, s) < 0;

/**
 * Every possible bridge: each island paired with the nearest island in each forward direction, if
 * no block is in the way and their colors allow it; plus which possible bridges cross each other.
 */
export function edgesOf(islands: readonly Island[], cols: number, rows: number, terrain: Terrain = OPEN): { edges: Edge[]; crosses: number[][] } {
  const at = new Map(islands.map((s, k) => [s.r * cols + s.c, k]));
  const blocks = new Set(terrain.blocks);
  const edges: Edge[] = [];
  islands.forEach((s, a) => {
    for (const [dr, dc] of terrain.diagonals ? FORWARD : FORWARD.slice(0, 2)) {
      const cells: number[] = [];
      for (let step = 1; ; step++) {
        const r = s.r + dr * step;
        const c = s.c + dc * step;
        if (r >= rows || c < 0 || c >= cols || blocks.has(r * cols + c)) break;
        const b = at.get(r * cols + c);
        if (b !== undefined) {
          // Straight neighbors need a gap for the bridge; diagonal ones may touch at a corner.
          if ((cells.length > 0 || (dr !== 0 && dc !== 0)) && colorsMatch(s, islands[b])) edges.push({ a, b, dr, dc, cells });
          break;
        }
        cells.push(r * cols + c);
      }
    }
  });
  const ends = edges.map((e) => [islands[e.a], islands[e.b]].map((s) => ({ x: s.c, y: s.r })));
  const crosses = edges.map((_, k) =>
    edges.flatMap((_, j) => (j !== k && segmentsCross(ends[k][0], ends[k][1], ends[j][0], ends[j][1]) ? [j] : [])));
  return { edges, crosses };
}

// ---- Generation ----

const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;
const DIAGONAL_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

export interface Puzzle {
  islands: Island[];
  blocks: number[];
  solution: number[]; // bridges per edge of edgesOf(islands, cols, rows, { blocks, diagonals })
}

const SEARCH_BUDGET = 20000;

export function generate(difficulty: Difficulty, rules: Rules = NO_RULES, random: Random = Math.random): Puzzle {
  const { cols, rows, islands: count } = DIFFICULTIES[difficulty];
  // Diagonal bridges give each island more neighbors, so fewer islands keep it about as hard (and
  // keep ambiguous layouts rare enough to generate quickly).
  const target = Math.round(count * (rules.diagonals ? 0.8 : 1));
  for (;;) {
    const grown = grow(cols, rows, target, rules.diagonals, random);
    if (!grown) continue;
    const { islands, links, used } = grown;
    if (rules.colors && !paint(islands, links, random)) continue;
    const blocks = rules.blocks ? placeBlocks(islands, links, used, cols, rows, rules.diagonals, random) : [];
    const { edges, crosses } = edgesOf(islands, cols, rows, { blocks, diagonals: rules.diagonals });
    const answer = edges.map((e) => links.get(pair(e.a, e.b)) ?? 0);
    // When another answer also fits, nudge ours toward it on one pair (add a bridge it has, or drop
    // one it lacks, keeping ours valid) and renumber: the new numbers usually rule the other answer
    // out. A few rounds, then start over.
    for (let round = 0; round < 12; round++) {
      const found = solve(islands, edges, crosses, 2, SEARCH_BUDGET);
      if (found?.length === 1) return { islands, blocks, solution: found[0] };
      const other = found?.find((f) => f.some((v, k) => v !== answer[k]));
      if (!other) break;
      const moves = edges.flatMap((e, k) => {
        const { a, b } = e;
        if (other[k] > answer[k]) {
          return islands[a].n < 8 && islands[b].n < 8 && !crosses[k].some((j) => answer[j] > 0) ? [{ k, by: 1 }] : [];
        }
        if (other[k] < answer[k] && islands[a].n > 1 && islands[b].n > 1) {
          const less = answer.slice();
          less[k]--;
          return isSolved(islands, edges, crosses, less, false) ? [{ k, by: -1 }] : [];
        }
        return [];
      });
      if (moves.length === 0) break;
      const { k, by } = pick(moves, random);
      answer[k] += by;
      islands[edges[k].a].n += by;
      islands[edges[k].b].n += by;
    }
  }
}

/** Key for a pair of islands. */
const pair = (a: number, b: number) => `${Math.min(a, b)},${Math.max(a, b)}`;

/**
 * Colors the islands so every bridge in `links` is allowed: about a third go gray, and each group
 * the rest form over bridges between non-gray islands gets red or blue. False if it came out all
 * one color.
 */
function paint(islands: Island[], links: Map<string, number>, random: Random): boolean {
  for (const s of islands) s.color = random() < 0.3 ? GRAY : -1;
  const near = islands.map(() => [] as number[]);
  for (const key of links.keys()) {
    const [a, b] = key.split(',').map(Number);
    near[a].push(b);
    near[b].push(a);
  }
  for (let i = 0; i < islands.length; i++) {
    if (islands[i].color !== -1) continue;
    const color = random() < 0.5 ? 1 : 2;
    const queue = [i];
    islands[i].color = color;
    for (let q = 0; q < queue.length; q++) {
      for (const j of near[queue[q]]) {
        if (islands[j].color === -1) {
          islands[j].color = color;
          queue.push(j);
        }
      }
    }
  }
  return islands.some((s) => s.color === 1) && islands.some((s) => s.color === 2);
}

/**
 * Blocks on empty spots, mostly where they rule out a bridge the answer doesn't use (so they matter),
 * about one for every four islands.
 */
function placeBlocks(islands: Island[], links: Map<string, number>, used: Set<number>, cols: number, rows: number, diagonals: boolean, random: Random): number[] {
  const want = Math.max(2, Math.round(islands.length / 4));
  const { edges } = edgesOf(islands, cols, rows, { blocks: [], diagonals });
  const useful = edges.filter((e) => !links.has(pair(e.a, e.b))).flatMap((e) => e.cells).filter((x) => !used.has(x));
  const blocks = new Set<number>();
  for (let tries = 0; blocks.size < want && tries < want * 10 && useful.length > 0; tries++) blocks.add(pick(useful, random));
  // Top up with any empty spots.
  const islandCells = new Set(islands.map((s) => s.r * cols + s.c));
  for (let tries = 0; blocks.size < want && tries < want * 20; tries++) {
    const x = Math.floor(random() * cols * rows);
    if (!used.has(x) && !islandCells.has(x)) blocks.add(x);
  }
  return [...blocks];
}

/**
 * A random connected network of about `target` islands, or null if it came out too small. Gives
 * the islands (numbered from the network), its bridges (pair → count) and the cells they pass.
 */
function grow(cols: number, rows: number, target: number, diagonals: boolean, random: Random):
  { islands: Island[]; links: Map<string, number>; used: Set<number> } | null {
  const ISLAND = -1;
  // Per cell: 0 empty, ISLAND, or 1 for a bridge passing through.
  const grid = new Array<number>(cols * rows).fill(0);
  const islands: Island[] = [];
  const links = new Map<string, number>();
  const built: [P, P][] = [];
  const dirs = diagonals ? [...DIRS, ...DIAGONAL_DIRS] : DIRS;
  const inside = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols;
  // A new island never sits beside another; with diagonal bridges, not corner to corner either
  // (except the island it's bridged to), since every such pair is a possible bridge and too many
  // make the answer ambiguous.
  const nearIsland = (r: number, c: number, from: number) =>
    dirs.some(([dr, dc]) => {
      const x = (r + dr) * cols + c + dc;
      return inside(r + dr, c + dc) && grid[x] === ISLAND && x !== islands[from].r * cols + islands[from].c;
    }) || DIRS.some(([dr, dc]) => inside(r + dr, c + dc) && grid[(r + dr) * cols + c + dc] === ISLAND);
  const crossesBuilt = (p: P, q: P) => built.some(([r, s]) => segmentsCross(p, q, r, s));

  const addIsland = (r: number, c: number) => {
    grid[r * cols + c] = ISLAND;
    islands.push({ r, c, n: 0 });
  };
  const addBridge = (a: number, b: number, path: number[], count: number) => {
    for (const x of path) grid[x] = 1;
    links.set(pair(a, b), count);
    built.push([{ x: islands[a].c, y: islands[a].r }, { x: islands[b].c, y: islands[b].r }]);
    islands[a].n += count;
    islands[b].n += count;
  };

  addIsland(Math.floor(random() * rows), Math.floor(random() * cols));
  for (let tries = 0; islands.length < target && tries < target * 60; tries++) {
    // From a random island, a random direction: walk over empty cells and drop a new island
    // somewhere along the way (not next to another island), bridged back to where we started.
    const a = Math.floor(random() * islands.length);
    if (islands[a].n >= 7) continue;
    const [dr, dc] = pick(dirs, random);
    const path: number[] = [];
    const spots: number[] = [];
    for (let step = 1; ; step++) {
      const r = islands[a].r + dr * step;
      const c = islands[a].c + dc * step;
      if (!inside(r, c) || grid[r * cols + c] !== 0) break;
      if ((step >= 2 || (dr !== 0 && dc !== 0)) && !nearIsland(r, c, a) && !crossesBuilt({ x: islands[a].c, y: islands[a].r }, { x: c, y: r })) spots.push(step);
      path.push(r * cols + c);
    }
    if (spots.length === 0) continue;
    const step = pick(spots, random);
    addIsland(islands[a].r + dr * step, islands[a].c + dc * step);
    const count = islands[a].n <= 6 && random() < 0.4 ? 2 : 1;
    addBridge(a, islands.length - 1, path.slice(0, step - 1), count);
  }
  if (islands.length < target * 0.8) return null;

  // A few loops: bridge some neighboring islands the tree left unconnected.
  const { edges } = edgesOf(islands, cols, rows, { blocks: [], diagonals });
  for (const e of edges) {
    if (random() > (diagonals ? 0.08 : 0.25) || links.has(pair(e.a, e.b))) continue;
    if (e.cells.some((x) => grid[x] !== 0)) continue;
    if (islands[e.a].n >= 8 || islands[e.b].n >= 8) continue;
    const p = { x: islands[e.a].c, y: islands[e.a].r };
    const q = { x: islands[e.b].c, y: islands[e.b].r };
    if (crossesBuilt(p, q)) continue;
    addBridge(e.a, e.b, e.cells, 1);
  }
  const used = new Set<number>();
  grid.forEach((v, x) => { if (v !== 0) used.add(x); });
  return { islands, links, used };
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

/**
 * Whether `bridges` (per edge) meets every rule: numbers, at most two, no crossings, connected.
 * `checkNumbers` false skips the numbers (the generator checks a network before renumbering it).
 */
export function isSolved(
  islands: readonly Island[],
  edges: readonly Edge[],
  crosses: readonly (readonly number[])[],
  bridges: readonly number[],
  checkNumbers = true,
): boolean {
  if (checkNumbers) {
    const counts = islands.map(() => 0);
    edges.forEach((e, k) => {
      counts[e.a] += bridges[k];
      counts[e.b] += bridges[k];
    });
    if (!counts.every((n, i) => n === islands[i].n)) return false;
  }
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
