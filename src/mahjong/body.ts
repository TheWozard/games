// The tile's body, in units where a face is 3 × 4: its rounded face, and that face swept down and
// right by its side's depth. Joined by straight lines from corner to corner, like a real tile, not
// the notches two offset rounded boxes leave at the top right and bottom left.

export const W = 3;
export const H = 4;
export const R = 0.45;
/** How much of its side a tile shows, below and to the right. */
export const DEPTH = 0.42;

const C = R * Math.SQRT1_2;
const n = (v: number) => +v.toFixed(3);

/** The face's outline swept `t` down and right: an SVG path. */
export function swept(t: number): string {
  // Where the top-right and bottom-left corners face along the sweep (at 45°).
  const tr = [W - R + C, R - C];
  const bl = [R - C, H - R + C];
  return [
    `M0 ${R}A${R} ${R} 0 0 1 ${R} 0H${W - R}`,
    `A${R} ${R} 0 0 1 ${n(tr[0])} ${n(tr[1])}L${n(tr[0] + t)} ${n(tr[1] + t)}`,
    `A${R} ${R} 0 0 1 ${W + t} ${n(R + t)}V${n(H - R + t)}`,
    `A${R} ${R} 0 0 1 ${n(W - R + t)} ${n(H + t)}H${n(R + t)}`,
    `A${R} ${R} 0 0 1 ${n(bl[0] + t)} ${n(bl[1] + t)}L${n(bl[0])} ${n(bl[1])}`,
    `A${R} ${R} 0 0 1 0 ${H - R}Z`,
  ].join('');
}

/** The side: a thin ivory edge to the face over the traditional green back. */
export const SIDE = { back: swept(DEPTH), edge: swept(0.2) };
