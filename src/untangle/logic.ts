// Untangle: dots joined by lines; drag the dots until no two lines cross and no dot sits on a line
// it isn't part of. Every puzzle is built from a layout that already satisfies that (its
// "solution"), then the dots are scattered, so every puzzle can be untangled.
//
// Styles:
//   lines  random straight lines; each crossing of two is a dot, the stretches between are edges
//   mesh   well-spaced random dots joined into triangles (Delaunay), thinned a little
//   loops  the same, thinned much further: sparse rings and chains

export const SIZES = {
  d10: { label: '10', dots: 10, lines: 5 },
  d15: { label: '15', dots: 15, lines: 6 },
  d21: { label: '21', dots: 21, lines: 7 },
  d28: { label: '28', dots: 28, lines: 8 },
  d36: { label: '36', dots: 36, lines: 9 },
} as const;

export const STYLES = {
  lines: { label: 'Lines' },
  mesh: { label: 'Mesh' },
  loops: { label: 'Loops' },
} as const;

export const STARTS = {
  circle: { label: 'Circle' },
  scatter: { label: 'Scatter' },
} as const;

export type Size = keyof typeof SIZES;
export type Style = keyof typeof STYLES;
export type Start = keyof typeof STARTS;

const has = <T extends object>(table: T) => (value: unknown): value is keyof T =>
  typeof value === 'string' && Object.hasOwn(table, value);
export const isSize = has(SIZES);
export const isStyle = has(STYLES);
export const isStart = has(STARTS);

export type Point = [x: number, y: number];
export type Edge = [a: number, b: number];

/** The board, in SVG units: portrait, to suit phones. */
export const WIDTH = 100;
export const HEIGHT = 130;
export const MARGIN = 5;

/** Drawn dot radius: a little smaller on the busiest boards. */
export const dotRadius = (dots: number) => (dots <= 15 ? 2.8 : dots <= 21 ? 2.5 : 2.1);
/** A dot this close to a line it isn't part of is "on" it, and counts as a crossing. */
export const touchDistance = (dots: number) => dotRadius(dots) * 0.8;
/** Dropped dots are nudged at least this far from any other dot. */
export const dotGap = (dots: number) => dotRadius(dots) * 2 + 1;

type Random = () => number;

function shuffle<T>(a: T[], random: Random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- Geometry ----

const cross = (o: Point, a: Point, b: Point) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/**
 * Whether segments p1–p2 and p3–p4 properly cross. Touching at an end, or lying along the same
 * line, doesn't count. Orientations within a tiny tolerance of zero count as "on the line":
 * otherwise rounding noise can make two pieces of one straight line look as if they cross.
 */
export function segmentsCross(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const eps = 1e-9 * Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * Math.hypot(p4[0] - p3[0], p4[1] - p3[1]);
  const side = (v: number) => (v > eps ? 1 : v < -eps ? -1 : 0);
  const d1 = side(cross(p3, p4, p1));
  const d2 = side(cross(p3, p4, p2));
  const d3 = side(cross(p1, p2, p3));
  const d4 = side(cross(p1, p2, p4));
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Distance from point p to segment a–b. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export interface Tangle {
  crossed: boolean[]; // per edge: crosses another edge, or has a dot sitting on it
  touching: boolean[]; // per dot: sits on a line it isn't part of
  count: number; // edge crossings plus dots on lines
}

/** Everything still tangled: pairs of edges that cross, and dots lying on others' lines. */
export function crossings(points: readonly Point[], edges: readonly Edge[]): Tangle {
  const crossed = edges.map(() => false);
  const touching = points.map(() => false);
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
  const touch = touchDistance(points.length);
  for (let k = 0; k < points.length; k++) {
    for (let i = 0; i < edges.length; i++) {
      const [a, b] = edges[i];
      if (a === k || b === k) continue;
      if (distanceToSegment(points[k], points[a], points[b]) < touch) {
        crossed[i] = true;
        touching[k] = true;
        count++;
      }
    }
  }
  return { crossed, touching, count };
}

export const clamp = ([x, y]: Point): Point => [
  Math.min(WIDTH - MARGIN, Math.max(MARGIN, x)),
  Math.min(HEIGHT - MARGIN, Math.max(MARGIN, y)),
];

/**
 * Moves dot `i` clear of any dot it was dropped on (staying on the board). Returns the same array
 * when nothing needed moving.
 */
export function nudge(points: readonly Point[], i: number, random: Random = Math.random): readonly Point[] {
  const gap = dotGap(points.length);
  const clear = points.every((p, j) => j === i || Math.hypot(p[0] - points[i][0], p[1] - points[i][1]) >= gap);
  if (clear) return points;
  const out = points.slice();
  for (let step = 0; step < 40; step++) {
    let near = -1;
    let nearD = gap;
    out.forEach((p, j) => {
      const d = Math.hypot(p[0] - out[i][0], p[1] - out[i][1]);
      if (j !== i && d < nearD) {
        near = j;
        nearD = d;
      }
    });
    if (near === -1) break;
    // Step directly away from it (any direction if they're exactly on top of each other).
    const angle = nearD > 1e-6
      ? Math.atan2(out[i][1] - out[near][1], out[i][0] - out[near][0])
      : random() * Math.PI * 2;
    out[i] = clamp([out[near][0] + Math.cos(angle) * gap * 1.05, out[near][1] + Math.sin(angle) * gap * 1.05]);
  }
  return out;
}

// ---- Generation ----

export interface Settings {
  size: Size;
  style: Style;
  start: Start;
}

export interface Puzzle {
  edges: Edge[];
  solution: Point[]; // an untangled layout, inside the board
  points: Point[]; // the scrambled start
}

export function generate({ size, style, start }: Settings, random: Random = Math.random): Puzzle {
  const { dots, lines } = SIZES[size];
  for (;;) {
    const built = style === 'lines' ? fromLines(lines, random) : fromMesh(dots, style, random);
    if (!built) continue;
    const solution = untouch(built.solution, built.edges);
    if (!solution) continue;
    built.solution = solution;
    const points = start === 'circle' ? circle(dots, random) : scatter(dots, random);
    if (crossings(points, built.edges).count === 0) continue;
    return { ...built, points };
  }
}

/**
 * Pushes dots off lines they're touching but aren't part of (near-misses where three lines almost
 * meet), one small step at a time, keeping only steps that leave the layout less tangled.
 * Returns the repaired layout, or null if it can't be untangled this way.
 */
function untouch(start: readonly Point[], edges: readonly Edge[]): Point[] | null {
  let points = start.slice();
  let tangle = crossings(points, edges);
  const touch = touchDistance(points.length);
  for (let step = 0; step < 200 && tangle.count > 0; step++) {
    const k = tangle.touching.indexOf(true);
    if (k === -1) return null; // real crossings: not a near-miss, give up
    const e = edges.find(([a, b]) => a !== k && b !== k && distanceToSegment(points[k], points[a], points[b]) < touch)!;
    const [a, b] = [points[e[0]], points[e[1]]];
    // Step away from the line, perpendicular to it.
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if ((points[k][0] - a[0]) * nx + (points[k][1] - a[1]) * ny < 0) [nx, ny] = [-nx, -ny];
    const move = touch - distanceToSegment(points[k], a, b) + 0.3;
    let improved = false;
    for (const sign of [1, -1]) {
      const trial = points.slice();
      trial[k] = clamp([points[k][0] + sign * nx * move, points[k][1] + sign * ny * move]);
      const next = crossings(trial, edges);
      if (next.count < tangle.count) {
        points = trial;
        tangle = next;
        improved = true;
        break;
      }
    }
    if (!improved) return null;
  }
  return tangle.count === 0 ? points : null;
}

/** Random lines in general position; each crossing is a dot, each stretch between is an edge. */
function fromLines(n: number, random: Random): { edges: Edge[]; solution: Point[] } {
  // Directions spread evenly round the half-turn (with a little jitter), so no two lines are
  // nearly parallel and the crossings spread out.
  const turn = random() * Math.PI;
  const lines = shuffle([...Array(n).keys()], random).map((k) => {
    const angle = turn + ((k + (random() - 0.5) * 0.5) / n) * Math.PI;
    return { p: [random(), random()] as Point, d: [Math.cos(angle), Math.sin(angle)] as Point };
  });

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

  const edges: Edge[] = [];
  for (const list of along) {
    list.sort((x, y) => x.t - y.t);
    for (let k = 1; k < list.length; k++) edges.push([list[k - 1].dot, list[k].dot]);
  }
  // Dots may sit close together here; generate() still rejects any layout where a dot lies on a
  // line it isn't part of (three lines nearly through one point).
  return { edges, solution: fit(dots) };
}

/** Well-spaced random dots joined into triangles, then thinned: a little for mesh, a lot for loops. */
function fromMesh(n: number, style: 'mesh' | 'loops', random: Random): { edges: Edge[]; solution: Point[] } | null {
  const solution = spread(n, random);
  if (!solution) return null;
  const edges = delaunay(solution);
  // Thin out: drop random edges while both ends keep enough links and everything stays joined.
  const minDegree = style === 'mesh' ? 3 : 2;
  const target = Math.round(n * (style === 'mesh' ? 2.2 : 1.35));
  const degree = solution.map(() => 0);
  for (const [a, b] of edges) {
    degree[a]++;
    degree[b]++;
  }
  let kept = edges.slice();
  for (const e of shuffle(edges.slice(), random)) {
    if (kept.length <= target) break;
    const [a, b] = e;
    if (degree[a] <= minDegree || degree[b] <= minDegree) continue;
    const without = kept.filter((f) => f !== e);
    if (!connected(n, without)) continue;
    kept = without;
    degree[a]--;
    degree[b]--;
  }
  return { edges: kept, solution };
}

function connected(n: number, edges: readonly Edge[]): boolean {
  const next: number[][] = Array.from({ length: n }, () => []);
  for (const [a, b] of edges) {
    next[a].push(b);
    next[b].push(a);
  }
  const seen = new Set([0]);
  const queue = [0];
  for (let q = 0; q < queue.length; q++) {
    for (const j of next[queue[q]]) {
      if (!seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return seen.size === n;
}

/** `n` random dots on the board, each at least a comfortable distance from the others. */
function spread(n: number, random: Random): Point[] | null {
  const area = (WIDTH - 2 * MARGIN) * (HEIGHT - 2 * MARGIN);
  const spacing = Math.sqrt(area / n) * 0.62;
  const out: Point[] = [];
  for (let tries = 0; out.length < n && tries < n * 400; tries++) {
    const p: Point = [MARGIN + random() * (WIDTH - 2 * MARGIN), MARGIN + random() * (HEIGHT - 2 * MARGIN)];
    if (out.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= spacing)) out.push(p);
  }
  return out.length === n ? out : null;
}

/** Delaunay triangulation (Bowyer–Watson), as a list of edges. Fine for a few dozen points. */
export function delaunay(points: readonly Point[]): Edge[] {
  type Tri = [number, number, number];
  const n = points.length;
  // A triangle big enough to hold every point; its corners are indices n, n+1, n+2.
  const big = 10 * Math.max(WIDTH, HEIGHT);
  const all: Point[] = [...points, [-big, -big], [big * 2, -big], [WIDTH / 2, big * 2]];
  let tris: Tri[] = [[n, n + 1, n + 2]];
  const inCircle = ([a, b, c]: Tri, p: Point) => {
    const [ax, ay] = all[a];
    const [bx, by] = all[b];
    const [cx, cy] = all[c];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    return Math.hypot(p[0] - ux, p[1] - uy) < Math.hypot(ax - ux, ay - uy);
  };
  for (let i = 0; i < n; i++) {
    const bad = tris.filter((t) => inCircle(t, points[i]));
    // The hole's boundary: edges of bad triangles that only one bad triangle has.
    const count = new Map<string, [number, number]>();
    const seen = new Map<string, number>();
    for (const [a, b, c] of bad) {
      for (const [u, v] of [[a, b], [b, c], [c, a]] as [number, number][]) {
        const key = u < v ? `${u},${v}` : `${v},${u}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
        count.set(key, [u, v]);
      }
    }
    tris = tris.filter((t) => !bad.includes(t));
    for (const [key, [u, v]] of count) if (seen.get(key) === 1) tris.push([u, v, i]);
  }
  const edges = new Map<string, Edge>();
  for (const [a, b, c] of tris) {
    for (const [u, v] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      if (u >= n || v >= n) continue;
      edges.set(u < v ? `${u},${v}` : `${v},${u}`, u < v ? [u, v] : [v, u]);
    }
  }
  return [...edges.values()];
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
function circle(count: number, random: Random): Point[] {
  const slots = shuffle([...Array(count).keys()], random);
  const rx = WIDTH / 2 - MARGIN * 2;
  const ry = Math.min(HEIGHT / 2 - MARGIN * 2, rx * 1.25);
  const turn = random() * Math.PI * 2;
  return slots.map((s) => {
    const angle = turn + (s / count) * Math.PI * 2;
    return [WIDTH / 2 + rx * Math.cos(angle), HEIGHT / 2 + ry * Math.sin(angle)];
  });
}

/** Dots spread randomly but evenly over the board. */
function scatter(count: number, random: Random): Point[] {
  for (;;) {
    const points = spread(count, random);
    if (points) return shuffle(points, random);
  }
}

