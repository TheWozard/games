// localStorage that never throws: in private mode or over quota the game still works, it just
// isn't kept. Keys are namespaced `games.<name>.`.
//
// It notes every save a page loads, so if the page can't open with them (mount.ts), they can be
// dropped and the page started afresh.
const loaded = new Set<string>();

export function loadJSON<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    loaded.add(key);
    const value: unknown = JSON.parse(raw);
    return isValid(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable; ignore.
  }
}

/** Removes every save this page has loaded. Returns how many there were. */
export function forgetLoaded(): number {
  const count = loaded.size;
  for (const key of loaded) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage unavailable; nothing to remove.
    }
  }
  loaded.clear();
  return count;
}
