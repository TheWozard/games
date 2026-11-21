<!--
  GameScreen2's stage when the game gives its board a `board` size: the board, drawn at that size
  (zoom 1, comfortable to play at), shown panned and zoomed in the space (the math: zoom.ts).

  - One finger (or the mouse) drags it any way, whatever its size, until an edge of the board has
    come REACH of the way across the space (zoom.ts): a quarter side to side, a bit over a third up
    and down. A press that moves less
    than a few pixels is still a tap, and the click that ends a drag is swallowed, so it doesn't
    also play a tile.
  - Two fingers pinch to zoom around the point between them, and pan as they move together.
  - A wheel or trackpad scrolls it both ways; with Ctrl or ⌘ held (a trackpad pinch sends that),
    it zooms around the pointer.
  - It's centered, and held, in the space above the screen's bottom inset (`--safe-bottom`: the
    home indicator), though it's drawn under that too.
  - It opens on the starting view for a new board: when the board changes size, or `key` changes
    (a new deal of the same size). When the space changes size, it goes back to the starting view
    too, until the player has moved it; after that, it keeps the same point in the middle.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { untrack } from 'svelte';
  import { clampView, panBy, startView, zoomAt, type Reach, type Size, type View } from './zoom';

  interface Props {
    board: Size;
    /** Changes for a new board, to open it on the starting view even if its size is the same. */
    key?: unknown;
    /** The space's size (all of it, bottom inset included), for a game that sizes its board from it. */
    width?: number;
    height?: number;
    children: Snippet;
  }

  let { board, key, width = $bindable(0), height = $bindable(0), children }: Props = $props();

  // How far across the space a board's edge may be dragged, as a fraction of it, `x` side to side and
  // `y` up and down: 0.5 is the middle (any edge tile can be brought there), 0 the space's own edges
  // (a board that fits stays put).
  const REACH: Reach = { x: 0.25, y: 0.35 };

  // The space the view is centered and held in: the stage above its bottom inset (`.zoom-frame`).
  let frameW = $state(0);
  let frameH = $state(0);
  const stage = $derived<Size>({ width: frameW, height: frameH });
  // What opens a new board, held as values, so the reset below runs only when one really changes. A
  // prop is read through the parent's expression (`"{game.layout} {game.seed}"`), so reading it
  // directly would rerun the reset for every change to whatever that reads: every move in the game.
  const deal = $derived(key);
  const boardW = $derived(board.width);
  const boardH = $derived(board.height);
  let view = $state<View>({ x: 0, y: 0, z: 1 });

  // A new board or deal: back to the starting view.
  // The space changing size (laid out late as the page loads, a browser bar sliding in or out, a
  // rotation): back to the starting view too, until the player has moved the view themselves; after
  // that, it keeps the same point of the board in the middle of the space, held inside its bounds
  // (`shown`), rather than throwing away their zoom and pan.
  let touched = false; // dragged, pinched or wheeled since this board opened
  let last = { width: 0, height: 0 };
  $effect(() => {
    void deal;
    const b = { width: boardW, height: boardH };
    untrack(() => {
      touched = false;
      view = startView(stage, b, REACH);
    });
  });
  $effect(() => {
    const now = { width: frameW, height: frameH };
    untrack(() => {
      if (!touched || last.width === 0 || last.height === 0) view = startView(now, board, REACH);
      else {
        const moved = { ...view, x: view.x + (now.width - last.width) / 2, y: view.y + (now.height - last.height) / 2 };
        view = clampView(moved, now, board, REACH);
      }
      last = now;
    });
  });

  let el: HTMLElement;
  const pointers = new Map<number, { x: number; y: number }>();
  // One finger: where it started and the view then. Two: their distance and midpoint at the start.
  let drag: { x: number; y: number; from: View; moved: boolean } | null = null;
  let pinch: { dist: number; mid: { x: number; y: number }; from: View } | null = null;
  let swallow = false; // the next click ends a drag or pinch
  // While the board moves under a finger or the wheel, it's its own layer (`.moving`: will-change),
  // so the phone's GPU moves and scales a picture of it rather than the browser redrawing every
  // tile's shadow each frame. It may look a little soft mid-pinch; it's drawn sharp again when the
  // gesture ends. Not set on a press until it moves, so a tap doesn't redraw the board twice.
  let moving = $state(false);
  let wheelEnd = 0; // the timer that ends a wheel's `moving`
  // The stage's place on the page, measured once per gesture: measuring on every move can make
  // the browser lay the page out again in the middle of one.
  let rect: DOMRect | null = null;
  // Pointer moves can come faster than the screen draws: they only note where the fingers are,
  // and the view follows once per frame.
  let frame = 0;

  function local(e: { clientX: number; clientY: number }) {
    const r = rect ?? el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function two() {
    const [a, b] = [...pointers.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }
  function startDrag(at: { x: number; y: number }, moved: boolean) {
    drag = { ...at, from: shown, moved };
  }

  function down(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swallow = false;
    if (pointers.size === 0) rect = el.getBoundingClientRect();
    flush();
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) {
      startDrag(local(e), false);
    } else if (pointers.size === 2) {
      // A second finger: a pinch, which is never a tap.
      for (const id of pointers.keys()) el.setPointerCapture?.(id);
      drag = null;
      pinch = { ...two(), from: shown };
      touched = true;
      moving = true;
      swallow = true;
    }
  }

  function move(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, local(e));
    if (!frame) frame = requestAnimationFrame(follow);
  }

  // A frame's worth of pointer moves still waiting: apply them now, before a finger is added or
  // lifted changes what the gesture is.
  function flush() {
    if (!frame) return;
    cancelAnimationFrame(frame);
    follow();
  }

  function follow() {
    frame = 0;
    if (pinch && pointers.size >= 2) {
      // The board point first under the fingers' midpoint stays under it: panned, then zoomed
      // around it, clamped once at the end (clamping the pan first made it stick at an edge).
      const { dist, mid } = two();
      const { from } = pinch;
      const moved = { ...from, x: from.x + mid.x - pinch.mid.x, y: from.y + mid.y - pinch.mid.y };
      view = zoomAt(moved, dist / pinch.dist, mid.x, mid.y, stage, board, REACH);
    } else if (drag && pointers.size === 1) {
      const [[id, at]] = [...pointers];
      const [dx, dy] = [at.x - drag.x, at.y - drag.y];
      if (!drag.moved && Math.hypot(dx, dy) > 8) {
        drag.moved = true;
        touched = true;
        moving = true;
        el.setPointerCapture?.(id);
      }
      if (drag.moved) view = panBy(drag.from, dx, dy, stage, board, REACH);
    }
  }

  function up(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    flush();
    pointers.delete(e.pointerId);
    if (drag?.moved) swallow = true;
    if (pointers.size === 1) {
      // One finger lifted from a pinch: the other carries on as a drag from here.
      pinch = null;
      startDrag([...pointers.values()][0], true);
    } else if (pointers.size === 0) {
      drag = null;
      pinch = null;
      rect = null;
      moving = false;
    }
  }

  function click(e: MouseEvent) {
    if (!swallow) return;
    swallow = false;
    e.stopPropagation();
    e.preventDefault();
  }

  // Attached here, not as attributes: the wheel must not be passive (Svelte's onwheel is), so it
  // can keep the page from scrolling or zooming, and the stage is no control of its own to give a
  // role (its tiles are the controls).
  $effect(() => {
    const on: [string, EventListener, AddEventListenerOptions?][] = [
      ['pointerdown', down as EventListener],
      ['pointermove', move as EventListener],
      ['pointerup', up as EventListener],
      ['pointercancel', up as EventListener],
      ['click', click as EventListener, { capture: true }],
      ['wheel', wheel as EventListener, { passive: false }],
    ];
    for (const [type, fn, options] of on) el.addEventListener(type, fn, options);
    return () => {
      for (const [type, fn, options] of on) el.removeEventListener(type, fn, options);
      cancelAnimationFrame(frame);
      clearTimeout(wheelEnd);
    };
  });
  function wheel(e: WheelEvent) {
    e.preventDefault();
    touched = true;
    moving = true;
    clearTimeout(wheelEnd);
    wheelEnd = window.setTimeout(() => { if (!pointers.size) moving = false; }, 150);
    // Deltas in pixels; some mice (Firefox) give lines or pages.
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.height : 1;
    const [dx, dy] = [e.deltaX * unit, e.deltaY * unit];
    if (e.ctrlKey || e.metaKey) {
      const at = local(e);
      view = zoomAt(shown, Math.exp(-dy * 0.01), at.x, at.y, stage, board, REACH);
    } else {
      view = panBy(shown, -dx, -dy, stage, board, REACH);
    }
  }

  // The view as shown: held inside its bounds, which move when the space changes size. Gestures
  // start from this, not from `view`, which may be out of bounds until the next one.
  const shown = $derived(clampView(view, stage, board, REACH));
</script>

<div
  class="zoom-stage"
  bind:this={el}
  bind:clientWidth={width}
  bind:clientHeight={height}
>
  <div class="zoom-frame" aria-hidden="true" bind:clientWidth={frameW} bind:clientHeight={frameH}></div>
  <div
    class="zoom-board"
    class:moving
    style:width="{board.width}px"
    style:height="{board.height}px"
    style:transform="translate({shown.x}px, {shown.y}px) scale({shown.z})"
  >
    {@render children()}
  </div>
</div>
