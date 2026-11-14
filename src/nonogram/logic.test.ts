import { describe, expect, it } from 'vitest';
import {
  cluesOf, DIFFICULTIES, firstLook, fits, generate, isSolved, NO_RULES, pattern, runsOf, solve, solveLine,
  type Difficulty, type Rules, type Run,
} from './logic';

const plain = (...lengths: number[]): Run[] => lengths.map((length) => ({ color: 1, length }));
const ALL1 = 0b11; // empty or shaded, one color

/** Every way to fill a line that fits the clue: the brute-force answer solveLine must match. */
function arrangements(n: number, colors: number, clue: Run[], masks: number[]): number[][] {
  const out: number[][] = [];
  const line = new Array<number>(n).fill(0);
  const walk = (i: number) => {
    if (i === n) {
      if (fits(line, clue)) out.push(line.slice());
      return;
    }
    for (let v = 0; v <= colors; v++) {
      if (!(masks[i] & (1 << v))) continue;
      line[i] = v;
      walk(i + 1);
    }
  };
  walk(0);
  return out;
}

describe('clues', () => {
  it('reads runs, with colors touching', () => {
    expect(runsOf([1, 1, 0, 1, 0, 0, 1, 1, 1])).toEqual(plain(2, 1, 3));
    expect(runsOf([1, 2, 2, 0, 1])).toEqual([{ color: 1, length: 1 }, { color: 2, length: 2 }, { color: 1, length: 1 }]);
    expect(runsOf([0, 0])).toEqual([]);
  });

  it('matches hidden lengths to any length', () => {
    expect(fits([1, 1, 0, 1], [{ color: 1, length: null }, { color: 1, length: 1 }])).toBe(true);
    expect(fits([1, 1, 0, 1], [{ color: 1, length: null }])).toBe(false);
    expect(fits([1, 1, 0, 1], plain(1, 2))).toBe(false);
  });
});

describe('solveLine', () => {
  it('finds the overlap', () => {
    // 8 in 10: the middle six are shaded.
    const got = solveLine(new Array(10).fill(ALL1), plain(8))!;
    expect(got.map((m) => (m === 0b10 ? '#' : m === 0b01 ? '.' : '?')).join('')).toBe('??######??');
  });

  it('says when nothing fits', () => {
    expect(solveLine(new Array(5).fill(ALL1), plain(3, 2))).toBeNull();
    expect(solveLine([ALL1, 0b01, ALL1], plain(2))).toBeNull();
  });

  it('agrees with brute force, with colors and hidden lengths', () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let run = 0; run < 400; run++) {
      const n = 3 + Math.floor(random() * 6);
      const colors = 1 + Math.floor(random() * 3);
      const all = (1 << (colors + 1)) - 1;
      const truth = Array.from({ length: n }, () => (random() < 0.5 ? 0 : 1 + Math.floor(random() * colors)));
      const clue = runsOf(truth).map((r) => (random() < 0.3 ? { ...r, length: null } : r));
      // Some cells already narrowed (always still allowing the truth).
      const masks = truth.map((v) => (random() < 0.3 ? (1 << v) | (random() < 0.5 ? 1 : 0) : all));
      const ways = arrangements(n, colors, clue, masks);
      const want = Array.from({ length: n }, (_, i) => ways.reduce((m, w) => m | (1 << w[i]), 0));
      expect(solveLine(masks, clue)).toEqual(want);
    }
  });
});

describe('solve', () => {
  it('solves a plain pattern, and gives up on an ambiguous one', () => {
    const cells = [1, 1, 0, 0, 1, 0, 1, 1, 1];
    const p = { size: 3, colors: 1, ...cluesOf(cells, 3) };
    expect(solve(p)).toEqual(cells);
    // A diagonal pair could be either diagonal.
    const stuck: number[] = [];
    expect(solve({ size: 2, colors: 1, ...cluesOf([1, 0, 0, 1], 2) }, stuck)).toBeNull();
    expect(stuck).toHaveLength(4);
  });
});

describe('generate', () => {
  const settings: Rules[] = [NO_RULES, { colors: true, mystery: false }, { colors: false, mystery: true }, { colors: true, mystery: true }];

  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    it(`makes ${difficulty} puzzles the line solver finishes, within the difficulty's band`, () => {
      const { size, colors, look } = DIFFICULTIES[difficulty];
      for (const rules of settings) {
        for (let run = 0; run < 5; run++) {
          const p = generate(difficulty, rules);
          expect(p.size).toBe(size);
          expect(p.colors).toBe(rules.colors ? colors : 1);
          // Its clues are the solution's, but for hidden lengths, which only mystery hides.
          const truth = cluesOf(p.solution, size);
          const hidden = [...p.rows, ...p.cols].flat().filter((r) => r.length === null).length;
          if (!rules.mystery) {
            expect(p.rows).toEqual(truth.rows);
            expect(p.cols).toEqual(truth.cols);
            expect(hidden).toBe(0);
          }
          expect(isSolved(p, p.solution)).toBe(true);
          // Solved line by line: so one solution, and no guessing.
          expect(solve(p)).toEqual(p.solution);
          const given = firstLook({ ...p, ...truth });
          expect(given).toBeGreaterThanOrEqual(look[0]);
          expect(given).toBeLessThanOrEqual(look[1]);
        }
      }
    });
  }

  it('hides some numbers with mystery on', () => {
    const hidden = Array.from({ length: 5 }, () => generate('medium', { colors: false, mystery: true }))
      .map((p) => [...p.rows, ...p.cols].flat().filter((r) => r.length === null).length);
    expect(Math.max(...hidden)).toBeGreaterThan(0);
  });

  it('uses every color across a few colored puzzles', () => {
    const used = new Set(Array.from({ length: 5 }, () => generate('hard', { colors: true, mystery: false }).solution).flat());
    expect([...used].sort()).toEqual([0, 1, 2, 3]);
  });

  it('makes patterns in range', () => {
    const cells = pattern(10, 3, () => 0.3);
    expect(cells).toHaveLength(100);
    expect(cells.every((v) => v >= 0 && v <= 3)).toBe(true);
  });
});
