// A piece's little shake for a move the game won't make (a blocked Mahjong tile, a pour Color Sort
// refuses, a card with nowhere to go): visual feedback in place of vibration. `shake.start(id)`
// makes `shake.current` that piece for as long as the animation runs; give it the `shake` class
// meanwhile (base.css, which sets how far it moves with --shake). A new shake replaces the last.
const SHAKE_MS = 300;

export function createShake<T>() {
  let current = $state<T | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    /** The piece shaking now, if any. */
    get current() {
      return current;
    },
    start(piece: T) {
      clearTimeout(timer);
      current = piece;
      timer = setTimeout(() => (current = null), SHAKE_MS);
    },
  };
}
