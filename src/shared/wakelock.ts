// Keeps the screen on while someone is playing: a game page holds a screen wake lock until an hour
// passes without a touch, key or wheel, then lets the phone dim as usual; the next one takes it again.
// The browser drops the lock whenever the page is hidden, so it's taken again when it shows. Where
// the API is missing (or refused, e.g. in battery saver), nothing happens.

const IDLE_MS = 60 * 60 * 1000;

export function keepScreenOn(): void {
  if (!('wakeLock' in navigator)) return;
  let lock: WakeLockSentinel | null = null;
  let asking = false;
  let idle: ReturnType<typeof setTimeout> | undefined;

  const take = async () => {
    if (lock || asking || document.visibilityState !== 'visible') return;
    asking = true;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => (lock = null));
    } catch {
      // Refused (no user activation yet, battery saver...): the next touch tries again.
    } finally {
      asking = false;
    }
  };

  const release = () => {
    lock?.release().catch(() => {});
    lock = null;
  };

  const active = () => {
    clearTimeout(idle);
    idle = setTimeout(release, IDLE_MS);
    void take();
  };

  for (const type of ['pointerdown', 'keydown', 'wheel'] as const) {
    addEventListener(type, active, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') active();
  });
  active();
}
