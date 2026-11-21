// The view onto a board that's panned and zoomed in GameScreen2's stage (ZoomStage.svelte): pure
// math, no DOM. A game draws its board at a size that's comfortable to play at (zoom 1); the stage
// shows it scaled by `z` with its top left corner at (`x`, `y`), in the stage's own pixels.
//
// - It opens at `start`, zoom 1: the board at its comfortable size, whatever its shape. A small
//   board isn't blown up to fill the space (its tiles stay the size of a big board's), and a board
//   too big for the space pans instead of shrinking.
// - It zooms out as far as `min`, the whole board in view (or 1, if that's smaller), and in as far
//   as `max`, ZOOM_IN.
// - It pans until an edge of the board has come `reach` of the way across the stage, whatever the
//   board's size, `reach.x` side to side and `reach.y` up and down: at 0.5 (the default) as far as
//   the middle, like a map, far enough to bring any tile at the edge into the middle; at 0 no
//   further than the stage's own edges. The same bound for every size, so zooming never makes it
//   jump. A board too small for the reach to move it (at 0.25, under half the stage) stays centered.

export interface Size {
  width: number;
  height: number;
}

export interface View {
  x: number;
  y: number;
  z: number;
}

/** How far in past the opening zoom a player can go. */
export const ZOOM_IN = 2;

export interface Limits {
  /** Zoom at which the whole board just fits the stage. */
  fit: number;
  min: number;
  start: number;
  max: number;
}

export function limits(stage: Size, board: Size): Limits {
  const fit =
    board.width > 0 && board.height > 0
      ? Math.min(stage.width / board.width, stage.height / board.height)
      : 1;
  return { fit, min: Math.min(fit, 1), start: 1, max: ZOOM_IN };
}

/** How far across the stage a board's edge may be panned, as a fraction of it: `x` side to side, `y` up and down. */
export interface Reach {
  x: number;
  y: number;
}

/** By default, to the middle both ways. */
export const REACH: Reach = { x: 0.5, y: 0.5 };

/** Where a board side of `size` (already scaled) may sit along a stage side of `room`, either end `reach` of the way across. */
function place(at: number, size: number, room: number, reach: number): number {
  const first = room * reach; // its near end, at most this far in
  const last = room * (1 - reach) - size; // its far end, at least this far in
  if (last > first) return (room - size) / 2; // too small for the reach to move it: centered
  return Math.min(first, Math.max(last, at));
}

/** The view, zoom kept within its limits and the board within its bounds. */
export function clampView(view: View, stage: Size, board: Size, reach: Reach = REACH): View {
  const { min, max } = limits(stage, board);
  const z = Math.min(max, Math.max(min, view.z));
  return {
    x: place(view.x, board.width * z, stage.width, reach.x),
    y: place(view.y, board.height * z, stage.height, reach.y),
    z,
  };
}

/** The opening view: zoomed to `start` and centered. */
export function startView(stage: Size, board: Size, reach: Reach = REACH): View {
  const z = limits(stage, board).start;
  return clampView(
    { x: (stage.width - board.width * z) / 2, y: (stage.height - board.height * z) / 2, z },
    stage,
    board,
    reach,
  );
}

/** Panned by (dx, dy) stage pixels. */
export const panBy = (
  view: View,
  dx: number,
  dy: number,
  stage: Size,
  board: Size,
  reach: Reach = REACH,
): View => clampView({ x: view.x + dx, y: view.y + dy, z: view.z }, stage, board, reach);

/** Zoomed by `factor`, keeping the board point under stage point (px, py) where it is. */
export function zoomAt(
  view: View,
  factor: number,
  px: number,
  py: number,
  stage: Size,
  board: Size,
  reach: Reach = REACH,
): View {
  const { min, max } = limits(stage, board);
  const z = Math.min(max, Math.max(min, view.z * factor));
  const k = z / view.z;
  return clampView(
    { x: px - (px - view.x) * k, y: py - (py - view.y) * k, z },
    stage,
    board,
    reach,
  );
}
