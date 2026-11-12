// Makes the Sliding Blocks puzzles the game ships with, and writes them to src/blocks/puzzles.ts.
// Run with `just blocks`, or `just blocks twoKeys big` to remake only those variants and keep the
// rest. Each variant is made in a thread of its own; Big takes longest, about a quarter of an hour.
// Much too slow for a phone, which is why the game uses this list instead.
//
// For each variant and difficulty it makes twice the puzzles needed (KEEP) and keeps the most
// interesting (logic.ts, `interest`), ordered easiest first.
//
// `just blocks --keep` makes nothing new: it scores the puzzles already in the list again and
// keeps the most interesting KEEP of each, in about a minute. For after KEEP has been lowered.
import { writeFileSync } from 'node:fs';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import {
  decode, DIFFICULTIES, encode, explore, generate, interest, isVariant, LEVELS, shape, VARIANTS, type Difficulty, type Variant,
} from '../src/blocks/logic.ts';
import { PUZZLES } from '../src/blocks/puzzles.ts';

/** Puzzles kept per difficulty, the same for every variant. */
const KEEP: Record<Difficulty, number> = { easy: 10, medium: 30, hard: 60 };

type Found = Record<Difficulty, [fewest: number, code: string][]>;
type Scored = [code: string, { fewest: number; interest: number }][];

/** The `keep` most interesting (ties: more moves), then easiest first, so each difficulty gets gradually harder as it's played through. */
const choose = (scored: Scored, keep: number): Found[Difficulty] =>
  scored
    .toSorted((a, b) => b[1].interest - a[1].interest || b[1].fewest - a[1].fewest)
    .slice(0, keep)
    .sort((a, b) => a[1].fewest - b[1].fewest || a[0].localeCompare(b[0]))
    .map(([code, { fewest }]) => [fewest, code]);

/** A stored puzzle's score again: its fewest moves and interest, from exploring every position. */
function score(variant: Variant, code: string): Scored[number] {
  const s = shape(variant);
  const start = decode(code);
  const found = explore(start, s, Infinity)!;
  const fewest = new Map(found.keys.map((k, id) => [k, found.moves[id]]));
  return [code, { fewest: found.moves[0], interest: interest(start, s, fewest) }];
}

/** Makes the puzzles of each variant in a thread of its own. */
async function makeAll(variants: Variant[]): Promise<[Variant, Found][]> {
  const progress: Record<string, string> = {};
  const show = () => process.stdout.write(`\r${variants.map((v) => `${v} ${progress[v] ?? ''}`).join('  ')}   `);
  const results = await Promise.all(variants.map((variant) => new Promise<[Variant, Found]>((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: variant, execArgv: ['--experimental-strip-types'] });
    worker.on('message', (m: { progress?: string; done?: Found }) => {
      if (m.progress) {
        progress[variant] = m.progress;
        show();
      }
      if (m.done) resolve([variant, m.done]);
    });
    worker.on('error', reject);
  })));
  process.stdout.write('\n');
  return results;
}

/** The stored puzzles of a variant, scored again and cut down to KEEP. */
const keepBest = (variant: Variant): Found =>
  Object.fromEntries((Object.keys(LEVELS) as Difficulty[]).map((d) =>
    [d, choose(PUZZLES[variant][d].map(([, code]) => score(variant, code)), KEEP[d])])) as Found;

if (isMainThread) {
  const args = process.argv.slice(2);
  const keepOnly = args.includes('--keep');
  const asked = args.filter((a) => a !== '--keep');
  const unknown = asked.filter((v) => !isVariant(v));
  if (unknown.length) throw new Error(`Not a variant: ${unknown.join(', ')} (variants: ${Object.keys(VARIANTS).join(', ')})`);
  const variants = (asked.length ? asked : Object.keys(VARIANTS)) as Variant[];
  const results = keepOnly ? variants.map((v): [Variant, Found] => [v, keepBest(v)]) : await makeAll(variants);
  // Every variant, in their usual order: the ones remade, and the rest as they were.
  const made = new Map(results);
  const all = (Object.keys(VARIANTS) as Variant[]).map((v): [Variant, Found] => [v, made.get(v) ?? PUZZLES[v]]);
  const body = all.map(([variant, found]) => `  ${variant}: {\n${(Object.keys(LEVELS) as Difficulty[]).map((d) =>
    `    ${d}: [\n${found[d].map(([fewest, code]) => `      [${fewest}, '${code}'],`).join('\n')}\n    ],`).join('\n')}\n  },`).join('\n');
  writeFileSync(
    new URL('../src/blocks/puzzles.ts', import.meta.url),
    `// Made by scripts/blocks.ts (\`just blocks\`): don't edit by hand. Per variant and difficulty, each
// puzzle is the fewest moves that finish it and its blocks (see encode in logic.ts), easiest first.
import type { Difficulty, Variant } from './logic';

export const PUZZLES: Record<Variant, Record<Difficulty, [fewest: number, code: string][]>> = {
${body}
};
`,
  );
} else {
  const variant = workerData as Variant;
  const found = {} as Found;
  for (const difficulty of Object.keys(DIFFICULTIES[variant]) as Difficulty[]) {
    const candidates = 2 * KEEP[difficulty];
    const seen = new Map<string, { fewest: number; interest: number }>();
    while (seen.size < candidates) {
      const { blocks, fewest, interest } = generate(variant, difficulty);
      seen.set(encode(blocks), { fewest, interest });
      parentPort!.postMessage({ progress: `${difficulty} ${seen.size}/${candidates}` });
    }
    found[difficulty] = choose([...seen], KEEP[difficulty]);
  }
  parentPort!.postMessage({ done: found });
}
