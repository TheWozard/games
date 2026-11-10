// localStorage that never throws: in private mode or over quota the game still works, it just
// isn't kept. Keys are namespaced `games.<name>.`.
export function loadJSON<T>(key: string, isValid: (value: unknown) => value is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
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
