// A Flow puzzle made in a Web Worker (worker.ts), for settings that are slow to make. Where a
// worker can't run, it's made here instead (the page just waits).
import { generate, type Difficulty, type Puzzle, type Rules } from './logic';

export function generateInBackground(difficulty: Difficulty, rules: Rules): Promise<Puzzle> {
  const here = () => generate(difficulty, rules);
  if (typeof Worker === 'undefined') return Promise.resolve().then(here);
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(here());
      return;
    }
    worker.onmessage = (e: MessageEvent<Puzzle>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(here());
    };
    worker.postMessage({ difficulty, rules: { ...rules } });
  });
}
