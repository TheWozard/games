// Color Sort: tubes hold stacked layers of color. Pour from one tube into another: the run of
// same-colored layers on top moves across, as much as fits, onto an empty tube or a matching top
// color. Done when every tube is empty or full of one color. Deals are random, and kept only if
// a solver finds a way to finish.

export const DIFFICULTIES = {
  easy: { label: 'Easy', colors: 4, spare: 2 },
  medium: { label: 'Medium', colors: 7, spare: 2 },
  hard: { label: 'Hard', colors: 10, spare: 2 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;

export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

/** Layers per tube. */
export const CAPACITY = 4;

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
export function pourAmount(tubes: Tubes, from: number, to: number): number {
  const a = tubes[from];
  const b = tubes[to];
  if (from === to || a.length === 0 || b.length >= CAPACITY) return 0;
  const color = a[a.length - 1];
  if (b.length > 0 && b[b.length - 1] !== color) return 0;
  let run = 0;
  for (let k = a.length - 1; k >= 0 && a[k] === color; k--) run++;
  return Math.min(run, CAPACITY - b.length);
}

export function pour(tubes: Tubes, from: number, to: number): Tubes {
  const n = pourAmount(tubes, from, to);
  if (n === 0) return tubes;
  const out = tubes.map((t) => t.slice());
  out[to].push(...out[from].splice(out[from].length - n, n));
  return out;
}

export const isSorted = (tubes: Tubes) =>
  tubes.every((t) => t.length === 0 || (t.length === CAPACITY && t.every((c) => c === t[0])));

/** Pours that change something worth changing (not just moving a one-color tube into an empty one). */
export function usefulPours(tubes: Tubes): [number, number][] {
  const out: [number, number][] = [];
  tubes.forEach((a, from) => {
    if (a.length === 0) return;
    const uniform = a.every((c) => c === a[0]);
    tubes.forEach((b, to) => {
      if (pourAmount(tubes, from, to) === 0) return;
      if (uniform && b.length === 0) return;
      out.push([from, to]);
    });
  });
  return out;
}

// ---- Generation ----

export function generate(difficulty: Difficulty, random: Random = Math.random): Tubes {
  const { colors, spare } = DIFFICULTIES[difficulty];
  for (;;) {
    const layers = shuffle(Array.from({ length: colors * CAPACITY }, (_, k) => Math.floor(k / CAPACITY)), random);
    const tubes: Tubes = Array.from({ length: colors }, (_, t) => layers.slice(t * CAPACITY, (t + 1) * CAPACITY));
    for (let s = 0; s < spare; s++) tubes.push([]);
    if (tubes.some((t) => t.length > 0 && t.every((c) => c === t[0]))) continue; // no tube starts done
    if (solve(tubes, 30000)) return tubes;
  }
}

/** A sequence of pours that sorts the tubes, or null if none is found within `budget` states. */
export function solve(start: Tubes, budget = Infinity): [number, number][] | null {
  const key = (t: Tubes) => t.map((x) => x.join(',')).sort().join('|');
  const seen = new Set<string>();
  const path: [number, number][] = [];
  const search = (t: Tubes): boolean => {
    if (isSorted(t)) return true;
    if (seen.size >= budget) return false;
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);
    // Try pours onto a matching color before pours into an empty tube: they make progress.
    const moves = usefulPours(t).sort(([, a], [, b]) => (t[a].length === 0 ? 1 : 0) - (t[b].length === 0 ? 1 : 0));
    for (const [from, to] of moves) {
      path.push([from, to]);
      if (search(pour(t, from, to))) return true;
      path.pop();
    }
    return false;
  };
  return search(start) ? path : null;
}
