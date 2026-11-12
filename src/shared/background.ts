// Makes something slow (a puzzle for a slow setting) in a Web Worker, so the page stays responsive
// and its spinner turns. Where a worker can't start, or fails, it's made on the page instead (the
// page just waits). Each game has its own worker.ts that answers one message with the result.
//
// Write `start` at the call site exactly as
//   () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
// so Vite finds the worker and bundles it.
export function inBackground<T>(start: () => Worker, message: unknown, here: () => T): Promise<T> {
  if (typeof Worker === 'undefined') return Promise.resolve().then(here);
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = start();
    } catch {
      resolve(here());
      return;
    }
    worker.onmessage = (e: MessageEvent<T>) => {
      worker.terminate();
      resolve(e.data);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve(here());
    };
    worker.postMessage(message);
  });
}
