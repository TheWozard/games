// Sideways panning for card tables whose columns are wider than the screen (Solitaire, FreeCell).
// A press that moves more than a few pixels sideways pans; anything less is still a tap, and the
// click that ends a pan is swallowed so it doesn't also play a card. A horizontal wheel (or
// Shift + wheel) pans too. Call from an $effect and return what it returns, to clean up.

export interface PanOptions {
  /** How far the content can pan, in pixels (0: it fits, nothing pans). */
  max: () => number;
  /** The current pan offset. */
  get: () => number;
  /** Sets the pan offset (already clamped to 0..max). */
  set: (x: number) => void;
  /** Told when a pan starts and ends, e.g. to turn card transitions off while it follows the finger. */
  onPanning?: (panning: boolean) => void;
  /** Whether a press may start a pan (FreeCell: not on a card that can be dragged). */
  startsPan?: (e: PointerEvent) => boolean;
}

export function attachPan(el: HTMLElement, { max, get, set, onPanning, startsPan }: PanOptions): () => void {
  const clamp = (x: number) => Math.min(Math.max(0, x), max());
  let pan: { id: number; x0: number; start: number; moved: boolean } | null = null;
  let justPanned = false;

  const down = (e: PointerEvent) => {
    justPanned = false;
    if (max() > 0 && e.isPrimary && (startsPan?.(e) ?? true)) pan = { id: e.pointerId, x0: e.clientX, start: get(), moved: false };
  };
  const move = (e: PointerEvent) => {
    if (!pan || e.pointerId !== pan.id) return;
    const dx = e.clientX - pan.x0;
    if (!pan.moved && Math.abs(dx) > 8) {
      pan.moved = true;
      onPanning?.(true);
      el.setPointerCapture?.(e.pointerId);
    }
    if (pan.moved) set(clamp(pan.start - dx));
  };
  const up = (e: PointerEvent) => {
    if (!pan || e.pointerId !== pan.id) return;
    justPanned = pan.moved;
    if (pan.moved) onPanning?.(false);
    pan = null;
  };
  const click = (e: MouseEvent) => {
    if (!justPanned) return;
    justPanned = false;
    e.stopPropagation();
    e.preventDefault();
  };
  const wheel = (e: WheelEvent) => {
    const d = e.deltaX || (e.shiftKey ? e.deltaY : 0);
    if (!d || max() === 0) return;
    e.preventDefault();
    set(clamp(get() + d));
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('click', click, true);
  el.addEventListener('wheel', wheel, { passive: false });
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', up);
    el.removeEventListener('click', click, true);
    el.removeEventListener('wheel', wheel);
  };
}
