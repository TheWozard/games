// Gradient: a grid of tiles blended between four corner colors. Some tiles are fixed in place
// (marked with a dot); the rest are shuffled, and the player swaps them back into a smooth blend.
// Colors are mixed in OKLab, where equal steps look equally different, so every row and column
// changes evenly and the puzzle can be solved by eye.

export const SIZES = {
  small: { label: 'Small', cols: 4, rows: 5 },
  medium: { label: 'Medium', cols: 5, rows: 7 },
  large: { label: 'Large', cols: 6, rows: 9 },
  huge: { label: 'Huge', cols: 7, rows: 11 },
} as const;

/** Which tiles stay put, easiest first. The four corners are always fixed: they anchor the blend. */
export const PATTERNS = {
  checker: { label: 'Checker' },
  stripes: { label: 'Stripes' },
  border: { label: 'Border' },
  scattered: { label: 'Scattered' },
  corners: { label: 'Corners' },
} as const;

export type Size = keyof typeof SIZES;
export type Pattern = keyof typeof PATTERNS;

export const isSize = (value: unknown): value is Size => typeof value === 'string' && Object.hasOwn(SIZES, value);
export const isPattern = (value: unknown): value is Pattern => typeof value === 'string' && Object.hasOwn(PATTERNS, value);

/** An OKLab color: lightness, then two opponent-color axes. */
export type Lab = [L: number, a: number, b: number];

type Random = () => number;

// ---- Color ----

const lerp = (x: Lab, y: Lab, t: number): Lab => [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];

function labToLinear([L, a, b]: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: number[]) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

/** CSS color for an OKLab color (sRGB, clamped). */
export function toCss(lab: Lab): string {
  const channel = (v: number) => {
    const x = Math.min(1, Math.max(0, v));
    const s = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(s * 255);
  };
  const [r, g, b] = labToLinear(lab).map(channel);
  return `rgb(${r} ${g} ${b})`;
}

/** An OKLab color from lightness, chroma and hue (degrees), pulled in until it fits sRGB. */
function fromLch(L: number, C: number, h: number): Lab {
  const rad = (h * Math.PI) / 180;
  for (let c = C; c > 0; c -= 0.005) {
    const lab: Lab = [L, c * Math.cos(rad), c * Math.sin(rad)];
    if (inGamut(labToLinear(lab))) return lab;
  }
  return [L, 0, 0];
}

/**
 * Four corner colors, top-left / top-right / bottom-left / bottom-right. The hues stay within
 * a ~150° arc so that no blend (least of all across a diagonal) passes through gray, and
 * lightness runs from one corner to the opposite one so neighboring tiles always differ.
 */
export function corners(random: Random = Math.random): [Lab, Lab, Lab, Lab] {
  const h = random() * 360;
  const left = 45 + random() * 30;
  const right = 45 + random() * 30;
  // TL in the middle of the arc, TR and BL either side, BR back near the middle but shifted.
  const hues = [h, h + right, h - left, h + (right - left) / 2 + (random() - 0.5) * 50];
  const lightness = [0.9, 0.74, 0.68, 0.5];
  const chroma = [0.09, 0.15, 0.15, 0.17].map((c) => c + random() * 0.04);
  const c = hues.map((hue, k) => fromLch(lightness[k], chroma[k], hue));
  // Random orientation, so the light corner isn't always top-left.
  const flips = [
    [0, 1, 2, 3], [1, 0, 3, 2], [2, 3, 0, 1], [3, 2, 1, 0],
  ][Math.floor(random() * 4)];
  return flips.map((k) => c[k]) as [Lab, Lab, Lab, Lab];
}

/** The color of every tile in its solved position, row by row. */
export function palette(cols: number, rows: number, [tl, tr, bl, br]: readonly Lab[]): Lab[] {
  const out: Lab[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      const v = r / (rows - 1);
      out.push(lerp(lerp(tl, tr, u), lerp(bl, br, u), v));
    }
  }
  return out;
}

// ---- Layout ----

export function fixedTiles(cols: number, rows: number, pattern: Pattern, random: Random = Math.random): boolean[] {
  return Array.from({ length: cols * rows }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const edgeR = r === 0 || r === rows - 1;
    const edgeC = c === 0 || c === cols - 1;
    if (edgeR && edgeC) return true;
    switch (pattern) {
      case 'checker': return (r + c) % 2 === 0;
      case 'stripes': return r % 2 === 0;
      case 'border': return edgeR || edgeC;
      case 'scattered': return random() < 0.3;
      case 'corners': return false;
    }
  });
}

/** Tile ids (their solved positions) in a shuffled order where no loose tile is home. */
export function shuffled(fixed: readonly boolean[], random: Random = Math.random): number[] {
  const loose = fixed.flatMap((f, i) => (f ? [] : [i]));
  const order = fixed.map((_, i) => i);
  if (loose.length < 2) return order;
  // A random derangement of the loose tiles (Sattolo's algorithm: one big cycle).
  const ids = loose.slice();
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * i);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  loose.forEach((pos, k) => (order[pos] = ids[k]));
  return order;
}
