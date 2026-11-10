// Untangle: dots joined by lines; drag the dots until no two lines cross. Puzzles come from
// random straight lines in general position: every crossing of two lines is a dot, and the
// stretches of each line between neighbouring crossings are the edges. Putting the dots back at
// those crossings has no edges crossing, so every puzzle is solvable; the dots are then scattered
// round a circle in random order.

export const DIFFICULTIES = {
  easy: { label: 'Easy', lines: 5 },
  medium: { label: 'Medium', lines: 6 },
  hard: { label: 'Hard', lines: 7 },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;

export const isDifficulty = (value: unknown): value is Difficulty =>
  typeof value === 'string' && Object.hasOwn(DIFFICULTIES, value);

export type Point = [x: number, y: number];
export type Edge = [a: number, b: number];

/** The board, in SVG units: portrait, to suit phones. */
export const WIDTH = 100;
export const HEIGHT = 130;
export const MARGIN = 5;

type Random = () => number;

// ---- Geometry ----

const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Whether segments p1–p2 and p3–p4 properly cross (touching at an end doesn't count). */
export function segmentsCross(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** For each edge, whether it crosses any other edge (edges sharing a dot never count). */
export function crossings(points: readonly Point[], edges: readonly Edge[]): { crossed: boolean[]; count: number } {
  const crossed = edges.map(() => false);
  let count = 0;
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    for (let j = i + 1; j < edges.length; j++) {
      const [c, d] = edges[j];
      if (a === c || a === d || b === c || b === d) continue;
      if (segmentsCross(points[a], points[b], points[c], points[d])) {
        crossed[i] = crossed[j] = true;
        count++;
      }
    }
  }
  return { crossed, count };
}

// ---- Generation ----

export interface Puzzle {
  edges: Edge[];
  solution: Point[]; // a crossing-free layout, fitted to the board
  points: Point[]; // the scrambled start
}

export function generate(difficulty: Difficulty, random: Random = Math.random): Puzzle {
  const n = DIFFICULTIES[difficulty].lines;
  for (;;) {
    const puzzle = attempt(n, random);
    if (puzzle) return puzzle;
  }
}

function attempt(n: number, random: Random): Puzzle | null {
  // Random lines: a point and a direction each, no two nearly parallel.
  const lines: { p: Point; d: Point }[] = [];
  const angles: number[] = [];
  while (lines.length < n) {
    const angle = random() * Math.PI;
    if (angles.some((a) => Math.abs(Math.sin(a - angle)) < 0.2)) continue;
    angles.push(angle);
    lines.push({ p: [random(), random()], d: [Math.cos(angle), Math.sin(angle)] });
  }

  // Each pair of lines meets once: that's a dot, at parameter t along each line.
  const dots: Point[] = [];
  const along: { t: number; dot: number }[][] = lines.map(() => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const { p: p1, d: d1 } = lines[i];
      const { p: p2, d: d2 } = lines[j];
      const det = d1[0] * d2[1] - d1[1] * d2[0];
      const t = ((p2[0] - p1[0]) * d2[1] - (p2[1] - p1[1]) * d2[0]) / det;
      const u = ((p2[0] - p1[0]) * d1[1] - (p2[1] - p1[1]) * d1[0]) / det;
      const dot = dots.length;
      dots.push([p1[0] + d1[0] * t, p1[1] + d1[1] * t]);
      along[i].push({ t, dot });
      along[j].push({ t: u, dot });
    }
  }
  // No three lines through one point: every dot must stand clear of the others.
  const span = Math.max(...dots.flat()) - Math.min(...dots.flat());
  for (let a = 0; a < dots.length; a++) {
    for (let b = a + 1; b < dots.length; b++) {
      if (Math.hypot(dots[a][0] - dots[b][0], dots[a][1] - dots[b][1]) < span * 0.02) return null;
    }
  }

  const edges: Edge[] = [];
  for (const list of along) {
    list.sort((x, y) => x.t - y.t);
    for (let k = 1; k < list.length; k++) edges.push([list[k - 1].dot, list[k].dot]);
  }

  const solution = fit(dots);
  const points = scatter(dots.length, random);
  if (crossings(points, edges).count === 0) return null;
  return { edges, solution, points };
}

/** Scales and centres points to fill the board inside the margin, keeping their shape. */
function fit(points: Point[]): Point[] {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((WIDTH - 2 * MARGIN) / (x1 - x0 || 1), (HEIGHT - 2 * MARGIN) / (y1 - y0 || 1));
  const ox = (WIDTH - (x1 - x0) * scale) / 2;
  const oy = (HEIGHT - (y1 - y0) * scale) / 2;
  return points.map(([x, y]) => [ox + (x - x0) * scale, oy + (y - y0) * scale]);
}

/** Dots spaced round an oval in random order: the classic tangled start. */
function scatter(count: number, random: Random): Point[] {
  const slots = [...Array(count).keys()];
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const rx = WIDTH / 2 - MARGIN * 2;
  const ry = Math.min(HEIGHT / 2 - MARGIN * 2, rx * 1.25);
  const turn = random() * Math.PI * 2;
  return slots.map((s) => {
    const angle = turn + (s / count) * Math.PI * 2;
    return [WIDTH / 2 + rx * Math.cos(angle), HEIGHT / 2 + ry * Math.sin(angle)];
  });
}

export const clamp = ([x, y]: Point): Point => [
  Math.min(WIDTH - MARGIN, Math.max(MARGIN, x)),
  Math.min(HEIGHT - MARGIN, Math.max(MARGIN, y)),
];
