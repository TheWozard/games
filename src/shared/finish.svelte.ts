// Show a toast once, at the moment a condition becomes true: not when a game already in that state
// is reopened. For in-game nudges (wins and losses just bring up the Next button). For example:
//   toastOnFinish(() => stuck(game), () => 'No moves left.', { tone: 'error' });
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
