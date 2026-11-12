// Small helpers the shading games share: square grids, cells numbered row by row.

export type Random = () => number;

export function shuffle<T>(a: T[], random: Random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The cells beside cell i (up, down, left, right). */
export function sides(n: number, i: number): number[] {
  const r = Math.floor(i / n);
  const c = i % n;
  const out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

/** The cells around cell i, diagonals too. */
export function around(n: number, i: number): number[] {
  const r = Math.floor(i / n);
  const c = i % n;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if ((dr || dc) && r + dr >= 0 && r + dr < n && c + dc >= 0 && c + dc < n) out.push(i + dr * n + dc);
    }
  }
  return out;
}

/** Whether the cells where `inside` holds form one connected group (true if there are none). */
export function connected(n: number, inside: (i: number) => boolean): boolean {
  let start = -1;
  let total = 0;
  for (let i = 0; i < n * n; i++) {
    if (inside(i)) {
      total++;
      if (start < 0) start = i;
    }
  }
  if (total === 0) return true;
  const seen = new Uint8Array(n * n);
  seen[start] = 1;
  const stack = [start];
  let count = 1;
  while (stack.length) {
    const i = stack.pop()!;
    for (const j of sides(n, i)) {
      if (!seen[j] && inside(j)) {
        seen[j] = 1;
        count++;
        stack.push(j);
      }
    }
  }
  return count === total;
}

/** The top-left cells of every 2×2 block. */
export function blocks(n: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) out.push(r * n + c);
  return out;
}

export const block4 = (n: number, i: number) => [i, i + 1, i + n, i + n + 1];
