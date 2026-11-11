// Touch gestures for Loop, in board units (dots at whole numbers). A finger moving from p to q is
// compared with each side: mostly parallel and passing over the side's midpoint means "along"
// (like a left-click); mostly at an angle and passing through the side itself means "across" (like
// a right-click).
import { edgeCount, edgeEnds, type Grid } from './logic';

export type Point = { x: number; y: number };

const orient = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
/**
 * Whether the finger's step p → q passes through segment r–s. A step that starts or ends exactly on
 * it still counts (fingers do land right on a line); each side reacts once per drag anyway.
 */
function crosses(p: Point, q: Point, r: Point, s: Point): boolean {
  const d1 = orient(r, s, p);
  const d2 = orient(r, s, q);
  if (d1 === 0 && d2 === 0) return false; // moving along it, not through it
  return d1 * d2 <= 0 && orient(p, q, r) * orient(p, q, s) < 0;
}

/** How far either side of a side's midpoint a finger counts as running along it. */
const ALONG_REACH = 0.32;
/** The ends of a side a finger may cut through without it counting as across (that's a corner). */
const CORNER = 0.15;

export function strokeEdges(g: Grid, p: Point, q: Point): { along: number[]; across: number[] } {
  const along: number[] = [];
  const across: number[] = [];
  const mx = q.x - p.x;
  const my = q.y - p.y;
  const len = Math.hypot(mx, my);
  if (len === 0) return { along, across };
  for (let e = 0; e < edgeCount(g); e++) {
    const [[r1, c1], [r2, c2]] = edgeEnds(g, e);
    const a = { x: c1, y: r1 };
    const b = { x: c2, y: r2 };
    // Sides are one unit long and axis-aligned: cos of the angle between finger and side.
    const parallel = Math.abs(mx * (b.x - a.x) + my * (b.y - a.y)) / len > 0.7;
    if (parallel) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const nx = -(b.y - a.y) * ALONG_REACH;
      const ny = (b.x - a.x) * ALONG_REACH;
      if (crosses(p, q, { x: mid.x - nx, y: mid.y - ny }, { x: mid.x + nx, y: mid.y + ny })) along.push(e);
    } else {
      const from = { x: a.x + (b.x - a.x) * CORNER, y: a.y + (b.y - a.y) * CORNER };
      const to = { x: b.x - (b.x - a.x) * CORNER, y: b.y - (b.y - a.y) * CORNER };
      if (crosses(p, q, from, to)) across.push(e);
    }
  }
  return { along, across };
}
