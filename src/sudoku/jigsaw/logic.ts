// Jigsaw Sudoku: Sudoku's rules with the 3×3 boxes swapped for nine irregular regions of nine
// cells. Rows, columns and regions each hold 1–9 once.
//
// Regions start as the boxes and are reshaped by swapping two cells across a border (so each
// keeps nine cells), only when both regions stay in one piece. Not every layout has a complete
// grid, so a filler with a step budget tries it and, if it gives up, new regions are drawn
// (about half fill). Then the grid is dug out like Classic's, rated by the same techniques, until
// a dig needs the difficulty's own tier.
import { BOXES, geometry, type Geometry } from '../classic/grade';
import { dig, DIFFICULTIES, MAX_TRIES, shuffle, type Difficulty, type Grid } from '../classic/logic';

export { DIFFICULTIES, isDifficulty, type Difficulty } from '../classic/logic';

type Random = () => number;

const pick = <T>(a: readonly T[], random: Random): T => a[Math.floor(random() * a.length)];

/** The up-to-four cells beside cell i. */
export function orthogonal(i: number): number[] {
  const out: number[] = [];
  if (i >= 9) out.push(i - 9);
  if (i < 72) out.push(i + 9);
  if (i % 9) out.push(i - 1);
  if (i % 9 < 8) out.push(i + 1);
  return out;
}

/** Whether region k's cells form one piece. */
export function connected(regions: readonly number[], k: number): boolean {
  const cells = regions.flatMap((r, i) => (r === k ? [i] : []));
  const seen = new Set([cells[0]]);
  const queue = [cells[0]];
  for (let q = 0; q < queue.length; q++) {
    for (const j of orthogonal(queue[q])) {
      if (regions[j] === k && !seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return seen.size === cells.length;
}

// Swaps made per layout: enough to leave few traces of the boxes (at least a fifth of the cells
// end up outside their box, a third typically).
const SWAPS = 150;

/** Nine random connected regions of nine cells: a region number (0–8) per cell. */
export function randomRegions(random: Random = Math.random): number[] {
  const regions = BOXES.slice();
  for (let done = 0, tries = 0; done < SWAPS && tries < SWAPS * 40; tries++) {
    const a = Math.floor(random() * 81);
    const A = regions[a];
    const across = orthogonal(a).filter((j) => regions[j] !== A);
    if (!across.length) continue;
    const B = regions[pick(across, random)];
    // A cell of B that borders A (other than through a) goes the other way.
    const back = regions.flatMap((r, c) => (r === B && orthogonal(c).some((j) => j !== a && regions[j] === A) ? [c] : []));
    if (!back.length) continue;
    const c = pick(back, random);
    regions[a] = B;
    regions[c] = A;
    if (connected(regions, A) && connected(regions, B)) done++;
    else [regions[a], regions[c]] = [A, B];
  }
  return regions;
}

const ALL = 0x3fe; // bits 1..9
const bitCount = (m: number) => { let n = 0; for (; m; n++) m &= m - 1; return n; };
const lowBit = (m: number) => 31 - Math.clz32(m & -m);

/**
 * A random complete grid for the geometry's units, or null after `budget` guesses. Before each
 * guess it places every naked and hidden single, which irregular regions make plentiful, so most
 * layouts that have a grid fill within a few dozen guesses.
 */
export function fill(g: Geometry, random: Random, budget: number): Grid | null {
  let guesses = 0;
  const place = (values: number[], cand: number[], i: number, d: number) => {
    values[i] = d;
    cand[i] = 0;
    for (const p of g.peers[i]) cand[p] &= ~(1 << d);
  };
  const search = (values: number[], cand: number[]): Grid | null => {
    if (++guesses > budget) return null;
    for (let changed = true; changed; ) {
      changed = false;
      for (let i = 0; i < 81; i++) {
        if (values[i]) continue;
        const m = cand[i];
        if (!m) return null;
        if (!(m & (m - 1))) {
          place(values, cand, i, lowBit(m));
          changed = true;
        }
      }
      for (const unit of g.units) {
        for (let d = 1; d <= 9; d++) {
          let at = -1;
          let n = 0;
          for (const i of unit) {
            if (values[i] === d) { n = -1; break; }
            if (cand[i] & (1 << d)) { at = i; n++; }
          }
          if (n === 0) return null;
          if (n === 1) {
            place(values, cand, at, d);
            changed = true;
          }
        }
      }
    }
    // Guess at the open cell with the fewest candidates.
    let best = -1;
    for (let i = 0; i < 81; i++) {
      if (!values[i] && (best < 0 || bitCount(cand[i]) < bitCount(cand[best]))) best = i;
    }
    if (best < 0) return values;
    const digits: number[] = [];
    for (let m = cand[best]; m; m &= m - 1) digits.push(lowBit(m));
    for (const d of shuffle(digits, random)) {
      const v = values.slice();
      const c = cand.slice();
      place(v, c, best, d);
      const found = search(v, c);
      if (found || guesses > budget) return found;
    }
    return null;
  };
  return search(new Array<number>(81).fill(0), new Array<number>(81).fill(ALL));
}

/** Whether some region is a whole row or column, which would only repeat that line's rule. */
export function hasStraightRegion(regions: readonly number[]): boolean {
  for (let k = 0; k < 9; k++) {
    const cells = regions.flatMap((r, i) => (r === k ? [i] : []));
    if (cells.every((i) => Math.floor(i / 9) === Math.floor(cells[0] / 9)) || cells.every((i) => i % 9 === cells[0] % 9)) return true;
  }
  return false;
}

// Guesses allowed when filling a layout (about 1 ms; just over half of layouts fill within it).
const FILL_BUDGET = 200;
// Digs tried on each grid and its regions before making new ones.
const DIGS = 5;

export interface Puzzle {
  regions: number[];
  puzzle: Grid;
  solution: Grid;
}

export function generate(difficulty: Difficulty, random: Random = Math.random): Puzzle {
  for (let tries = 1; ; ) {
    const regions = randomRegions(random);
    if (hasStraightRegion(regions)) continue;
    const solution = fill(geometry(regions), random, FILL_BUDGET);
    if (!solution) continue;
    for (let k = 0; k < DIGS; k++, tries++) {
      const { puzzle, needs } = dig(solution, difficulty, random, regions);
      if (needs === DIFFICULTIES[difficulty].tier || tries >= MAX_TRIES) return { regions, puzzle, solution };
    }
  }
}
