// Geometry for Bridges' drag and swipe gestures, in board units (island centers at c + 0.5,
// r + 0.5). Pure, so it can be tested without a browser.
import { edgesFor, type Game } from './game';

export type Point = { x: number; y: number };

export const center = (g: Game, i: number): Point => ({ x: g.islands[i].c + 0.5, y: g.islands[i].r + 0.5 });

/** The island under a point, if it's within `reach` of an island's center. */
export function islandAt(g: Game, p: Point, reach = 0.5): number | null {
  let best: number | null = null;
  let bestD = reach;
  g.islands.forEach((_, i) => {
    const c = center(g, i);
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/**
 * The possible bridge a drag from island `from` is heading along: the neighbor in the drag's
 * direction (the nearest of four, or of eight with diagonal bridges), once it has moved at least
 * `min` that way. -1 when there isn't one.
 */
export function dragEdge(g: Game, from: number, to: Point, min = 0.5): number {
  const c = center(g, from);
  const dx = to.x - c.x;
  const dy = to.y - c.y;
  const sectors = g.rules.diagonals ? 8 : 4;
  const angle = Math.round((Math.atan2(dy, dx) / (2 * Math.PI)) * sectors) * ((2 * Math.PI) / sectors);
  const ux = Math.round(Math.cos(angle));
  const uy = Math.round(Math.sin(angle));
  if (dx * ux + dy * uy < min * Math.hypot(ux, uy)) return -1;
  const { edges } = edgesFor(g);
  // Edges run from a to b in the direction (dc, dr).
  return edges.findIndex((e) =>
    (e.a === from && e.dc === ux && e.dr === uy) || (e.b === from && e.dc === -ux && e.dr === -uy));
}

const orient = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** Whether segments p–q and r–s cross (properly, not just touching). */
function cross(p: Point, q: Point, r: Point, s: Point): boolean {
  const d1 = orient(r, s, p);
  const d2 = orient(r, s, q);
  const d3 = orient(p, q, r);
  const d4 = orient(p, q, s);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Built bridges that the swipe step p → q passes across. */
export function swipedEdges(g: Game, p: Point, q: Point): number[] {
  const { edges } = edgesFor(g);
  return edges.flatMap((e, k) => (g.bridges[k] > 0 && cross(p, q, center(g, e.a), center(g, e.b)) ? [k] : []));
}
