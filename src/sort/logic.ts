// Color Sort: tubes hold stacked layers of color. Pour from one tube into another: the run of
// same-colored layers on top moves across, as much as fits, onto an empty tube or a matching top
// color. Done when every tube is empty or full of one color. Deals are random, and kept only if
// a solver finds a way to finish.
//
// Optional rules: tall tubes (6 layers instead of 4), and mystery (only each tube's top layer
// shows its color; game.ts tracks which are hidden, since pouring works the same either way).

export const DIFFICULTIES = {
  easy: { label: 'Easy', colors: 4, spare: 2 },
  medium: { label: 'Medium', colors: 7, spare: 2 },
  hard: { label: 'Hard', colors: 10, spare: 2 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;

export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

/** Layers per tube, normally; TALL with the tall tubes rule. */
export const CAPACITY = 4;
export const TALL = 6;

export const RULES = {
  mystery: { label: 'Mystery', info: 'Only each tube’s top layer shows its color until the layers under it come to the top.' },
  tall: { label: 'Tall Tubes', info: `Tubes hold ${TALL} layers instead of ${CAPACITY}.` },
} as const;

export type Rule = keyof typeof RULES;
export type Rules = Record<Rule, boolean>;
export const NO_RULES: Rules = { mystery: false, tall: false };

export const isRules = (value: unknown): value is Rules =>
  typeof value === 'object' && value !== null &&
  (Object.keys(RULES) as Rule[]).every((k) => typeof (value as Rules)[k] === 'boolean');

export const capacityOf = (rules: Rules) => (rules.tall ? TALL : CAPACITY);

/** Each tube's layers, bottom to top, as color numbers. */
export type Tubes = number[][];

type Random = () => number;

function shuffle<T>(a: T[], random: Random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** How many layers a pour from `from` into `to` would move (0 if it can't). */
export function pourAmount(tubes: Tubes, from: number, to: number, capacity = CAPACITY): number {
  const a = tubes[from];
  const b = tubes[to];
  if (from === to || a.length === 0 || b.length >= capacity) return 0;
  const color = a[a.length - 1];
  if (b.length > 0 && b[b.length - 1] !== color) return 0;
  let run = 0;
  for (let k = a.length - 1; k >= 0 && a[k] === color; k--) run++;
  return Math.min(run, capacity - b.length);
}

export function pour(tubes: Tubes, from: number, to: number, capacity = CAPACITY): Tubes {
  const n = pourAmount(tubes, from, to, capacity);
  if (n === 0) return tubes;
  const out = tubes.map((t) => t.slice());
  out[to].push(...out[from].splice(out[from].length - n, n));
  return out;
}

export const isSorted = (tubes: Tubes, capacity = CAPACITY) =>
  tubes.every((t) => t.length === 0 || (t.length === capacity && t.every((c) => c === t[0])));

/** Pours that change something worth changing (not just moving a one-color tube into an empty one). */
export function usefulPours(tubes: Tubes, capacity = CAPACITY): [number, number][] {
  const out: [number, number][] = [];
  tubes.forEach((a, from) => {
    if (a.length === 0) return;
    const uniform = a.every((c) => c === a[0]);
    tubes.forEach((b, to) => {
      if (pourAmount(tubes, from, to, capacity) === 0) return;
      if (uniform && b.length === 0) return;
      out.push([from, to]);
    });
  });
  return out;
}

// ---- Generation ----

export function generate(difficulty: Difficulty, capacity = CAPACITY, random: Random = Math.random): Tubes {
  const { colors, spare } = DIFFICULTIES[difficulty];
  for (;;) {
    const layers = shuffle(Array.from({ length: colors * capacity }, (_, k) => Math.floor(k / capacity)), random);
    const tubes: Tubes = Array.from({ length: colors }, (_, t) => layers.slice(t * capacity, (t + 1) * capacity));
    for (let s = 0; s < spare; s++) tubes.push([]);
    if (tubes.some((t) => t.length > 0 && t.every((c) => c === t[0]))) continue; // no tube starts done
    if (solve(tubes, 30000, capacity)) return tubes;
  }
}

/** A sequence of pours that sorts the tubes, or null if none is found within `budget` states. */
export function solve(start: Tubes, budget = Infinity, capacity = CAPACITY): [number, number][] | null {
  return search(start, budget, capacity).path;
}

function search(start: Tubes, budget: number, capacity: number): { path: [number, number][] | null; ranOut: boolean } {
  const key = (t: Tubes) => t.map((x) => x.join(',')).sort().join('|');
  const seen = new Set<string>();
  const path: [number, number][] = [];
  let ranOut = false;
  const search = (t: Tubes): boolean => {
    if (isSorted(t, capacity)) return true;
    if (seen.size >= budget) {
      ranOut = true;
      return false;
    }
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);
    // Try pours onto a matching color before pours into an empty tube: they make progress.
    const moves = usefulPours(t, capacity).sort(([, a], [, b]) => (t[a].length === 0 ? 1 : 0) - (t[b].length === 0 ? 1 : 0));
    for (const [from, to] of moves) {
      path.push([from, to]);
      if (search(pour(t, from, to, capacity))) return true;
      path.pop();
    }
    return false;
  };
  return { path: search(start) ? path : null, ranOut };
}
