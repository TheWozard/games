import { describe, expect, it } from 'vitest';
import { clampView, limits, panBy, startView, ZOOM_IN, zoomAt } from './zoom';

const phone = { width: 390, height: 700 };

describe('zoom', () => {
  it('opens a board smaller than the stage at its own size, centered, not blown up to fill it', () => {
    const board = { width: 195, height: 200 }; // would fit twice across
    const v = startView(phone, board);
    expect(v).toEqual({ x: (390 - 195) / 2, y: (700 - 200) / 2, z: 1 });
  });

  it('opens a board too big for the stage at its own size, centered, never shrunk', () => {
    const board = { width: 900, height: 500 }; // a wide layout on an upright phone
    const v = startView(phone, board);
    expect(v.z).toBe(1);
    expect(v.x).toBe((390 - 900) / 2);
    expect(v.y).toBe(100);
  });

  it('zooms out no further than the whole board, and in no further than ZOOM_IN', () => {
    const board = { width: 900, height: 500 };
    const { fit, min, start, max } = limits(phone, board);
    expect(fit).toBeCloseTo(390 / 900);
    expect(min).toBe(fit);
    expect(start).toBe(1);
    expect(max).toBe(ZOOM_IN);
    expect(zoomAt(startView(phone, board), 0.01, 195, 350, phone, board).z).toBeCloseTo(fit);
    expect(zoomAt(startView(phone, board), 100, 195, 350, phone, board).z).toBe(ZOOM_IN);
  });

  it('keeps the point under the fingers in place as it zooms', () => {
    const board = { width: 900, height: 1400 };
    const v = startView(phone, board);
    const [px, py] = [120, 300];
    const under = { x: (px - v.x) / v.z, y: (py - v.y) / v.z }; // board point at (px, py)
    const z = zoomAt(v, 1.5, px, py, phone, board);
    expect(z.x + under.x * z.z).toBeCloseTo(px);
    expect(z.y + under.y * z.z).toBeCloseTo(py);
  });

  it('pans any way until an edge of the board reaches the middle of the stage', () => {
    const board = { width: 900, height: 1400 };
    const v = startView(phone, board);
    const moved = panBy(v, -50, 80, phone, board);
    expect(moved.x).toBe(v.x - 50);
    expect(moved.y).toBe(v.y + 80);
    // Dragged right and down as far as it goes: its left and top edges in the middle.
    expect(panBy(v, 10_000, 10_000, phone, board)).toEqual({ x: 195, y: 350, z: 1 });
    // Left and up: its right and bottom edges in the middle.
    expect(panBy(v, -10_000, -10_000, phone, board)).toEqual({ x: 195 - 900, y: 350 - 1400, z: 1 });
  });

  it('lets a board that fits pan too, edge to the middle, and opens it centered', () => {
    const board = { width: 100, height: 100 };
    const v = startView(phone, board);
    expect(v).toEqual({ x: 145, y: 300, z: 1 });
    expect(panBy(v, 10_000, 0, phone, board).x).toBe(195);
    expect(panBy(v, -10_000, 0, phone, board).x).toBe(195 - 100);
    // Too small for a quarter reach to move it (under half the stage): centered.
    const quarter = { x: 0.25, y: 0.25 };
    expect(panBy(startView(phone, board, quarter), 10_000, 10_000, phone, board, quarter)).toEqual(
      v,
    );
    // Zoomed out past the whole board: held at it.
    expect(clampView({ x: 0, y: 0, z: 0.01 }, phone, board).z).toBe(1);
  });

  it('reaches as far as asked: 0 stops at the stage edges, and keeps a board that fits centered', () => {
    const none = { x: 0, y: 0 };
    const big = { width: 900, height: 1400 };
    const v = startView(phone, big, none);
    expect(panBy(v, 10_000, 10_000, phone, big, none)).toEqual({ x: 0, y: 0, z: 1 });
    expect(panBy(v, -10_000, -10_000, phone, big, none)).toEqual({
      x: 390 - 900,
      y: 700 - 1400,
      z: 1,
    });
  });

  it('reaches side to side and up and down apart', () => {
    const big = { width: 900, height: 1400 };
    const reach = { x: 0.25, y: 0.1 };
    const v = startView(phone, big, reach);
    const far = panBy(v, 10_000, 10_000, phone, big, reach);
    expect(far.x).toBe(390 * 0.25);
    expect(far.y).toBe(700 * 0.1);
    const back = panBy(v, -10_000, -10_000, phone, big, reach);
    expect(back.x).toBe(390 * 0.75 - 900);
    expect(back.y).toBe(700 * 0.9 - 1400);
  });

  it('keeps the same bound whatever the size, so zooming never makes it jump', () => {
    const reach = { x: 0.25, y: 0.25 };
    // The furthest a board can be pushed down, for a height `h` on the 700 tall stage.
    const furthest = (h: number) => {
      const board = { width: 100, height: h };
      return panBy(startView(phone, board, reach), 0, 10_000, phone, board, reach).y;
    };
    expect(furthest(600)).toBe(175);
    expect(furthest(700)).toBe(175);
    expect(furthest(1400)).toBe(175);
    for (let h = 300; h < 1000; h++)
      expect(Math.abs(furthest(h + 1) - furthest(h))).toBeLessThan(1);
  });
});
