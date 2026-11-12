// Nonogram: shade cells so that each row's and column's runs of shaded cells match its clue, the
// lengths of its runs in order. Optional rules:
// - colors: cells take one of a few colors; each clue number has its run's color, and two runs of
//   the same color need a gap between them, while runs of different colors may touch;
// - mystery: some clue numbers are hidden ("?"): the run is there, its length isn't given.
//
// Puzzles start from a random picture: noise smoothed into blobs, sometimes mirrored so it looks
// drawn. A line solver (each line on its own, exactly, again and again) must work the whole
// picture out; where it gets stuck, a cell it couldn't decide is flipped and it tries again. A
// puzzle the line solver finishes has one solution and never needs a guess. Difficulty is the
// size and how much a first look at each line gives away (firstLook). With mystery on,
// numbers are then hidden in random order for as long as the line solver still finishes.

export const DIFFICULTIES = {
  // look: the share of cells a first look at each line decides (firstLook), kept within [min, max].
  easy: { label: 'Easy', size: 8, block: 4, colors: 2, look: [0.2, 0.6] },
  medium: { label: 'Medium', size: 10, block: 5, colors: 3, look: [0.08, 0.4] },
  hard: { label: 'Hard', size: 15, block: 5, colors: 3, look: [0.02, 0.25] },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;

export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

export const RULES = {
  colors: { label: 'Colors', info: 'Cells come in colors, shown on the clues. Runs of the same color need a gap; different colors may touch.' },
  mystery: { label: 'Mystery', info: 'Some numbers are hidden as ?: the run is there, but its length isn’t given.' },
} as const;

export type Rule = keyof typeof RULES;
export type Rules = Record<Rule, boolean>;
export const NO_RULES: Rules = { colors: false, mystery: false };

export const isRules = (value: unknown): value is Rules =>
  typeof value === 'object' && value !== null &&
  (Object.keys(RULES) as Rule[]).every((k) => typeof (value as Rules)[k] === 'boolean');

/** The share of a mystery puzzle's numbers that may be hidden, at most. */
const MYSTERY_SHARE = 0.3;

type Random = () => number;

/** One clue number: the run's color (1 when there are no colors) and its length, or null if hidden. */
export interface Run {
  color: number;
  length: number | null;
}

export interface Puzzle {
  size: number;
  colors: number; // 1 without the colors rule
  rows: Run[][];
  cols: Run[][];
  solution: number[]; // per cell, row by row: 0 empty, 1..colors a color
}

// ---- Clues ----

/** The runs along one line of cells (0 empty, else a color). */
export function runsOf(line: number[]): Run[] {
  const runs: Run[] = [];
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === 0) continue;
    const last = runs.at(-1);
    if (last && line[i - 1] === c) last.length!++;
    else runs.push({ color: c, length: 1 });
  }
  return runs;
}

export const rowOf = (cells: number[], size: number, r: number) => cells.slice(r * size, r * size + size);
export const colOf = (cells: number[], size: number, c: number) => Array.from({ length: size }, (_, r) => cells[r * size + c]);

export function cluesOf(solution: number[], size: number): { rows: Run[][]; cols: Run[][] } {
  return {
    rows: Array.from({ length: size }, (_, r) => runsOf(rowOf(solution, size, r))),
    cols: Array.from({ length: size }, (_, c) => runsOf(colOf(solution, size, c))),
  };
}

/** Whether a line of cells fits its clue (hidden lengths match any length). */
export function fits(line: number[], clue: Run[]): boolean {
  const runs = runsOf(line);
  return runs.length === clue.length &&
    runs.every((run, i) => run.color === clue[i].color && (clue[i].length === null || clue[i].length === run.length));
}

/** Whether every line fits its clue. With the line solver's uniqueness, that's the solution. */
export const isSolved = (p: Pick<Puzzle, 'size' | 'rows' | 'cols'>, cells: number[]) =>
  p.rows.every((clue, r) => fits(rowOf(cells, p.size, r), clue)) &&
  p.cols.every((clue, c) => fits(colOf(cells, p.size, c), clue));

// ---- Line solver ----
// A cell's possibilities are a bit mask: bit 0 empty, bit k color k. solveLine narrows a line's
// masks to exactly the values some arrangement of its runs allows, or returns null if none fits.
//
// It walks the line left to right through states (j, i, end): j runs placed in the first i cells,
// `end` if cell i - 1 is the end of run j - 1 (so run j may not start at i if it has the same
// color). From a state, cell i is empty, or run j starts at i. Forward marks the states reachable
// from the start, backward those that can still reach the end; the moves between two such states
// are the ones some arrangement makes, and they say what each cell can be.

export function solveLine(masks: number[], clue: Run[]): number[] | null {
  const n = masks.length;
  const k = clue.length;
  const W = n + 1;
  const at = (j: number, i: number, end: number) => (j * W + i) * 2 + end;
  // How far color c can run from cell i: the longest stretch of cells allowing it.
  const reach: number[][] = [];
  const colorsUsed = [...new Set(clue.map((r) => r.color))];
  for (const c of colorsUsed) {
    const bit = 1 << c;
    const row = new Array<number>(n + 1).fill(0);
    for (let i = n - 1; i >= 0; i--) row[i] = masks[i] & bit ? row[i + 1] + 1 : 0;
    reach[c] = row;
  }

  // Each move from (j, i, end): its lengths, and whether it's allowed.
  const lengths = (j: number, i: number, end: number): [number, number] | null => {
    if (j >= k) return null;
    const run = clue[j];
    if (end && j > 0 && clue[j - 1].color === run.color) return null;
    const most = reach[run.color][i];
    if (run.length === null) return most >= 1 ? [1, most] : null;
    return run.length <= most ? [run.length, run.length] : null;
  };

  const back = new Uint8Array((k + 1) * W * 2);
  for (let i = n; i >= 0; i--) {
    for (let j = k; j >= 0; j--) {
      for (let end = 0; end < 2; end++) {
        let ok = false;
        if (i === n) ok = j === k;
        else {
          if (masks[i] & 1 && back[at(j, i + 1, 0)]) ok = true;
          const len = ok ? null : lengths(j, i, end);
          if (len) for (let L = len[0]; L <= len[1] && !ok; L++) if (back[at(j + 1, i + L, 1)]) ok = true;
        }
        back[at(j, i, end)] = ok ? 1 : 0;
      }
    }
  }
  if (!back[at(0, 0, 0)]) return null;

  const fwd = new Uint8Array((k + 1) * W * 2);
  fwd[at(0, 0, 0)] = 1;
  const out = new Array<number>(n).fill(0);
  // A run of color c over cells [i, i + L): marked with a difference array per color, so a long
  // run of unknown length costs no more than a short one.
  const cover = new Map<number, Int32Array>();
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= k; j++) {
      for (let end = 0; end < 2; end++) {
        if (!fwd[at(j, i, end)]) continue;
        if (masks[i] & 1 && back[at(j, i + 1, 0)]) {
          fwd[at(j, i + 1, 0)] = 1;
          out[i] |= 1;
        }
        const len = lengths(j, i, end);
        if (!len) continue;
        const c = clue[j].color;
        for (let L = len[0]; L <= len[1]; L++) {
          if (!back[at(j + 1, i + L, 1)]) continue;
          fwd[at(j + 1, i + L, 1)] = 1;
          let d = cover.get(c);
          if (!d) cover.set(c, (d = new Int32Array(n + 1)));
          d[i]++;
          d[i + L]--;
        }
      }
    }
  }
  for (const [c, d] of cover) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += d[i];
      if (sum > 0) out[i] |= 1 << c;
    }
  }
  return out;
}

/**
 * Solves a puzzle line by line. Returns the cells when that decides every one, or null when the
 * lines leave some undecided (`stuck` then gets the undecided cells) or contradict each other.
 * `budget` caps the line solves, so a check can't run long.
 */
export function solve(
  p: Pick<Puzzle, 'size' | 'colors' | 'rows' | 'cols'>,
  stuck?: number[],
  budget = 20_000,
): number[] | null {
  const { size } = p;
  const all = (1 << (p.colors + 1)) - 1;
  const masks = new Array<number>(size * size).fill(all);
  // Lines waiting to be solved again: 0..size-1 rows, size..2size-1 columns.
  const queued = new Array<boolean>(2 * size).fill(true);
  const queue = Array.from({ length: 2 * size }, (_, i) => i);
  while (queue.length) {
    if (--budget < 0) return null;
    const line = queue.shift()!;
    queued[line] = false;
    const isRow = line < size;
    const idx = line % size;
    const cells = Array.from({ length: size }, (_, t) => (isRow ? idx * size + t : t * size + idx));
    const got = solveLine(cells.map((x) => masks[x]), isRow ? p.rows[idx] : p.cols[idx]);
    if (!got) return null;
    cells.forEach((x, t) => {
      if (got[t] === masks[x]) return;
      masks[x] = got[t];
      const other = isRow ? size + t : t; // the crossing line
      if (!queued[other]) {
        queued[other] = true;
        queue.push(other);
      }
    });
  }
  const undecided = masks.flatMap((m, x) => (m & (m - 1) ? [x] : []));
  if (undecided.length) {
    if (stuck) stuck.push(...undecided);
    return null;
  }
  return masks.map((m) => 31 - Math.clz32(m));
}

// ---- Generator ----

/** Smooths a field of values by majority vote over each cell's 3×3 block (the cell itself counts `self`). */
function smooth(cells: number[], size: number, values: number, self: number): number[] {
  return cells.map((v, x) => {
    const r = Math.floor(x / size);
    const c = x % size;
    const votes = new Array<number>(values).fill(0);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) votes[cells[rr * size + cc]] += dr === 0 && dc === 0 ? self : 1;
      }
    }
    let best = v;
    votes.forEach((n, k) => { if (n > votes[best]) best = k; });
    return best;
  });
}

/**
 * A random picture: a shape from noise, smoothed once into blobs, and, with colors, painted from a
 * second field smoothed into broader patches, so each color gets areas of its own. Half are
 * mirrored left to right, which makes them look drawn.
 */
export function picture(size: number, colors: number, random: Random = Math.random): number[] {
  const noise = (values: number) => Array.from({ length: size * size }, () => Math.floor(random() * values));
  let shape = smooth(noise(2), size, 2, 2);
  let paint = colors > 1 ? smooth(smooth(noise(colors), size, colors, 1), size, colors, 1) : null;
  if (random() < 0.5) {
    const mirror = (a: number[]) => a.map((v, x) => (x % size < size / 2 ? v : a[x - (x % size) + size - 1 - (x % size)]));
    shape = mirror(shape);
    if (paint) paint = mirror(paint);
  }
  return shape.map((on, x) => (on ? 1 + (paint ? paint[x] : 0) : 0));
}

/** Whether a picture makes a fair puzzle: neither sparse nor crowded, and no blank line. */
function fair(cells: number[], size: number): boolean {
  const filled = cells.filter((v) => v !== 0).length / cells.length;
  if (filled < 0.35 || filled > 0.65) return false;
  // No line left entirely blank: an empty clue makes a dull line.
  for (let t = 0; t < size; t++) {
    if (rowOf(cells, size, t).every((v) => v === 0) || colOf(cells, size, t).every((v) => v === 0)) return false;
  }
  return true;
}

/** Hides clue numbers, in random order, for as long as the line solver still finishes. */
function hideNumbers(p: Puzzle, random: Random): void {
  const all = [...p.rows, ...p.cols].flatMap((clue) => clue.map((run) => run));
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  let left = Math.floor(all.length * MYSTERY_SHARE);
  for (const run of all) {
    if (left === 0) break;
    const length = run.length;
    run.length = null;
    if (solve(p)) left--;
    else run.length = length;
  }
}

/** A puzzle the line solver can finish, so it has one solution and needs no guessing. */
export function generate(difficulty: Difficulty, rules: Rules = NO_RULES, random: Random = Math.random): Puzzle {
  const { size, colors: many, look } = DIFFICULTIES[difficulty];
  const colors = rules.colors ? many : 1;
  for (;;) {
    let cells = picture(size, colors, random);
    // Flip cells the solver can't decide, a few at a time, until it can.
    for (let tries = 0; tries < 30; tries++) {
      if (!fair(cells, size)) break;
      const { rows, cols } = cluesOf(cells, size);
      const stuck: number[] = [];
      const p: Puzzle = { size, colors, rows, cols, solution: cells };
      if (solve(p, stuck)) {
        const given = firstLook(p);
        if (given < look[0] || given > look[1]) break;
        if (rules.mystery) hideNumbers(p, random);
        return p;
      }
      if (!stuck.length) break; // a contradiction can't happen with true clues; the budget ran out
      cells = cells.slice();
      const x = stuck[Math.floor(random() * stuck.length)];
      cells[x] = cells[x] === 0 ? 1 + Math.floor(random() * colors) : 0;
    }
  }
}

/** The share of cells that one look at each line, on its own and from blank, decides. Lower is harder. */
export function firstLook(p: Pick<Puzzle, 'size' | 'colors' | 'rows' | 'cols'>): number {
  const { size } = p;
  const blank = new Array<number>(size).fill((1 << (p.colors + 1)) - 1);
  const known = new Array<boolean>(size * size).fill(false);
  const single = (m: number) => (m & (m - 1)) === 0;
  for (let t = 0; t < size; t++) {
    solveLine(blank, p.rows[t])!.forEach((m, c) => { if (single(m)) known[t * size + c] = true; });
    solveLine(blank, p.cols[t])!.forEach((m, r) => { if (single(m)) known[r * size + t] = true; });
  }
  return known.filter(Boolean).length / known.length;
}
