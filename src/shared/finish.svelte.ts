// Announce the end of a game with a toast, once, at the moment it happens: not when a game that was
// already over is reopened. Call from a component's script:
//   toastOnFinish(() => game.done, () => 'Solved.');
//   toastOnFinish(() => game.lost, () => 'That one was a mine.', { tone: 'error' });
import { untrack } from 'svelte';
import { toast, type ToastOptions } from './toast';

export function toastOnFinish(isDone: () => boolean, message: () => string, options?: ToastOptions): void {
  let was = untrack(isDone);
  $effect(() => {
    const done = isDone();
    if (done && !was) untrack(() => toast(message(), options));
    was = done;
  });
}
