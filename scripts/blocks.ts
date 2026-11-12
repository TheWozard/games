// Makes the Sliding Blocks puzzles the game ships with, and writes them to src/blocks/puzzles.ts.
// Run with `just blocks`, or `just blocks twoKeys big` to remake only those variants and keep the
// rest. Each variant is made in a thread of its own; Big takes longest, about a quarter of an hour.
// Much too slow for a phone, which is why the game uses this list instead.
//
// For each variant and difficulty it makes twice the puzzles needed and keeps the most
// interesting (logic.ts, `interest`), ordered easiest first.
import { writeFileSync } from 'node:fs';
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads';
import { DIFFICULTIES, encode, generate, isVariant, LEVELS, VARIANTS, type Difficulty, type Variant } from '../src/blocks/logic.ts';
import { PUZZLES } from '../src/blocks/puzzles.ts';

const PER_DIFFICULTY = 100;
const CANDIDATES = 2 * PER_DIFFICULTY;

type Found = Record<Difficulty, [fewest: number, code: string][]>;

if (isMainThread) {
  const asked = process.argv.slice(2);
  const unknown = asked.filter((v) => !isVariant(v));
  if (unknown.length) throw new Error(`Not a variant: ${unknown.join(', ')} (variants: ${Object.keys(VARIANTS).join(', ')})`);
  const variants = (asked.length ? asked : Object.keys(VARIANTS)) as Variant[];
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
    const seen = new Map<string, { fewest: number; interest: number }>();
    while (seen.size < CANDIDATES) {
      const { blocks, fewest, interest } = generate(variant, difficulty);
      seen.set(encode(blocks), { fewest, interest });
      parentPort!.postMessage({ progress: `${difficulty} ${seen.size}/${CANDIDATES}` });
    }
    // The most interesting half (ties: more moves), then easiest first so each difficulty gets
    // gradually harder as it's played through.
    const kept = [...seen].sort((a, b) => b[1].interest - a[1].interest || b[1].fewest - a[1].fewest).slice(0, PER_DIFFICULTY);
    found[difficulty] = kept
      .sort((a, b) => a[1].fewest - b[1].fewest || a[0].localeCompare(b[0]))
      .map(([code, { fewest }]) => [fewest, code]);
  }
  parentPort!.postMessage({ done: found });
}
