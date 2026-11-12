// Plain rule checkers for the shading games' tests: written straight from each game's rules, with no
// cleverness, so the solvers can be checked against them.
import { around, connected, sides } from './grid';
import { sight } from './lightup/logic';

export function starsValid(n: number, k: number, regions: number[], stars: boolean[]): boolean {
  for (let t = 0; t < n; t++) {
    let row = 0;
    let col = 0;
    let reg = 0;
    for (let u = 0; u < n; u++) {
      if (stars[t * n + u]) row++;
      if (stars[u * n + t]) col++;
    }
    stars.forEach((s, i) => { if (s && regions[i] === t) reg++; });
    if (row !== k || col !== k || reg !== k) return false;
  }
  return stars.every((s, i) => !s || around(n, i).every((j) => !stars[j]));
}

export function nurikabeValid(n: number, clues: (number | null)[], sea: boolean[]): boolean {
  if (clues.some((v, i) => v !== null && sea[i])) return false;
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const i = r * n + c;
    if (sea[i] && sea[i + 1] && sea[i + n] && sea[i + n + 1]) return false;
  }
  if (!connected(n, (i) => sea[i])) return false;
  const seen = new Set<number>();
  for (let i = 0; i < n * n; i++) {
    if (sea[i] || seen.has(i)) continue;
    const island = [i];
    seen.add(i);
    for (let q = 0; q < island.length; q++) for (const j of sides(n, island[q])) if (!sea[j] && !seen.has(j)) { seen.add(j); island.push(j); }
    const numbers = island.filter((c) => clues[c] !== null);
    if (numbers.length !== 1 || clues[numbers[0]] !== island.length) return false;
  }
  return true;
}

export function hitoriValid(n: number, numbers: number[], shaded: boolean[]): boolean {
  if (shaded.some((s, i) => s && sides(n, i).some((j) => shaded[j]))) return false;
  if (!connected(n, (i) => !shaded[i])) return false;
  for (let t = 0; t < n; t++) {
    const row = new Set<number>();
    const col = new Set<number>();
    for (let u = 0; u < n; u++) {
      const a = t * n + u;
      const b = u * n + t;
      if (!shaded[a]) { if (row.has(numbers[a])) return false; row.add(numbers[a]); }
      if (!shaded[b]) { if (col.has(numbers[b])) return false; col.add(numbers[b]); }
    }
  }
  return true;
}

export function lightupValid(n: number, walls: (number | null)[], lamps: boolean[]): boolean {
  const p = { size: n, walls };
  for (let i = 0; i < n * n; i++) {
    if (walls[i] !== null) {
      if (lamps[i]) return false;
      const w = walls[i]!;
      if (w >= 0 && sides(n, i).filter((j) => lamps[j]).length !== w) return false;
      continue;
    }
    const seen = sight(p, i);
    if (lamps[i] && seen.some((j) => lamps[j])) return false;
    if (!lamps[i] && !seen.some((j) => lamps[j])) return false;
  }
  return true;
}

/** Every subset of the cells where `allowed` holds, as boolean arrays. */
export function* subsets(n: number, allowed: (i: number) => boolean = () => true): Generator<boolean[]> {
  const cells = Array.from({ length: n * n }, (_, i) => i).filter(allowed);
  for (let m = 0; m < 1 << cells.length; m++) {
    const out = new Array<boolean>(n * n).fill(false);
    cells.forEach((c, k) => { if (m & (1 << k)) out[c] = true; });
    yield out;
  }
}

/** A seeded random source, so failures repeat. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
