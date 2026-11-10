import { describe, expect, it } from 'vitest';
import {
  crossings, delaunay, distanceToSegment, dotGap, generate, HEIGHT, MARGIN, nudge, segmentsCross, SIZES, STARTS, STYLES,
  WIDTH, type Size, type Start, type Style,
} from './logic';

function isConnected(n: number, edges: [number, number][]): boolean {
  const seen = new Set([0]);
  const queue = [0];
  for (let q = 0; q < queue.length; q++) {
    for (const [a, b] of edges) {
      const j = a === queue[q] ? b : b === queue[q] ? a : -1;
      if (j >= 0 && !seen.has(j)) { seen.add(j); queue.push(j); }
    }
  }
  return seen.size === n;
}

describe('generate', () => {
  for (const style of Object.keys(STYLES) as Style[]) {
    for (const size of Object.keys(SIZES) as Size[]) {
      it(`makes a tangled ${style} puzzle with ${SIZES[size].dots} dots that can be untangled`, () => {
        for (const start of Object.keys(STARTS) as Start[]) {
          const { edges, solution, points } = generate({ size, style, start });
          const n = SIZES[size].dots;
          expect(points).toHaveLength(n);
          expect(solution).toHaveLength(n);
          // Untangled under the full rules (no crossings, no dot on another's line)...
          expect(crossings(solution, edges).count).toBe(0);
          // ...tangled to start with...
          expect(crossings(points, edges).count).toBeGreaterThan(0);
          // ...everything on the board, one connected network, no duplicate edges.
          for (const [x, y] of [...points, ...solution]) {
            expect(x).toBeGreaterThanOrEqual(MARGIN - 1e-9);
            expect(x).toBeLessThanOrEqual(WIDTH - MARGIN + 1e-9);
            expect(y).toBeGreaterThanOrEqual(MARGIN - 1e-9);
            expect(y).toBeLessThanOrEqual(HEIGHT - MARGIN + 1e-9);
          }
          expect(isConnected(n, edges)).toBe(true);
          expect(new Set(edges.map(([a, b]) => `${Math.min(a, b)},${Math.max(a, b)}`)).size).toBe(edges.length);
          const degree = points.map((_, i) => edges.filter(([a, b]) => a === i || b === i).length);
          if (style === 'lines') {
            expect(edges).toHaveLength(SIZES[size].lines * (SIZES[size].lines - 2));
            expect(degree.every((d) => d >= 2 && d <= 4)).toBe(true);
          } else {
            expect(Math.min(...degree)).toBeGreaterThanOrEqual(2); // no dangling dots
          }
        }
      });
    }
  }

  it('makes mesh denser than loops', () => {
    const mesh = generate({ size: 'd21', style: 'mesh', start: 'circle' }).edges.length;
    const loops = generate({ size: 'd21', style: 'loops', start: 'circle' }).edges.length;
    expect(mesh).toBeGreaterThan(loops);
  });
});

describe('crossings', () => {
  it('counts a dot sitting on a line it isn’t part of', () => {
    // A line from 0 to 1, and dot 2 (joined only to 3) right on top of it.
    const points: [number, number][] = [[10, 50], [90, 50], [50, 50.5], [50, 90]];
    const edges: [number, number][] = [[0, 1], [2, 3]];
    const t = crossings(points, edges);
    expect(t.count).toBe(1);
    expect(t.touching).toEqual([false, false, true, false]);
    expect(t.crossed).toEqual([true, false]);
    points[2] = [50, 60];
    expect(crossings(points, edges).count).toBe(0);
  });

  it('doesn’t count a dot touching its own lines', () => {
    const points: [number, number][] = [[10, 10], [50, 50], [90, 10]];
    expect(crossings(points, [[0, 1], [1, 2]]).count).toBe(0);
  });
});

describe('segmentsCross', () => {
  it('detects a proper crossing only', () => {
    expect(segmentsCross([0, 0], [10, 10], [0, 10], [10, 0])).toBe(true);
    expect(segmentsCross([0, 0], [10, 10], [20, 0], [30, 10])).toBe(false);
    expect(segmentsCross([0, 0], [10, 0], [10, 0], [10, 10])).toBe(false); // touching at an end
    // Two pieces of one straight line never cross, even with rounding in the coordinates
    // (this exact pair once came out of the generator and was counted as a crossing).
    expect(segmentsCross(
      [6.7115136673934135, 30.11355397154393], [25.996608724756022, 42.95188483922837],
      [31.14734732026596, 46.38079644715239], [62.72319729728594, 67.40123778942015],
    )).toBe(false);
  });

  it('measures distance to a segment', () => {
    expect(distanceToSegment([5, 3], [0, 0], [10, 0])).toBeCloseTo(3);
    expect(distanceToSegment([13, 4], [0, 0], [10, 0])).toBeCloseTo(5);
  });
});

describe('nudge', () => {
  it('moves a dropped dot clear of any dot it landed on', () => {
    const points: [number, number][] = Array.from({ length: 10 }, (_, i) => [10 + i * 8, 60]);
    points[3] = [...points[7]] as [number, number]; // exactly on top
    const out = nudge(points, 3);
    const gap = dotGap(10);
    out.forEach((p, j) => {
      if (j !== 3) expect(Math.hypot(p[0] - out[3][0], p[1] - out[3][1])).toBeGreaterThanOrEqual(gap - 1e-9);
    });
    out.forEach((p, j) => { if (j !== 3) expect(p).toEqual(points[j]); }); // nothing else moves
  });
});

describe('delaunay', () => {
  it('joins points into non-crossing triangles', () => {
    const pts: [number, number][] = [[10, 10], [90, 12], [50, 60], [15, 110], [85, 115], [45, 30]];
    const edges = delaunay(pts);
    expect(crossings(pts, edges).count).toBe(0);
    expect(edges.length).toBe(3 * pts.length - 3 - 4); // 3n − 3 − (points on the hull = 4)
  });
});
