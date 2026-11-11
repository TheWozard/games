// Makes the Sliding Blocks puzzles the game ships with, and writes them to src/blocks/puzzles.ts.
// Run with `just blocks`. Hard puzzles are rare among random layouts, so this takes a minute or
// two: much too slow for a phone, which is why the game uses this list instead.
import { writeFileSync } from 'node:fs';
import { DIFFICULTIES, encode, generate, type Difficulty } from '../src/blocks/logic.ts';

const PER_DIFFICULTY = 100;

const lines: string[] = [];
for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
  const found = new Map<string, number>();
  while (found.size < PER_DIFFICULTY) {
    const { blocks, fewest } = generate(difficulty);
    found.set(encode(blocks), fewest);
    process.stdout.write(`\r${difficulty}: ${found.size}/${PER_DIFFICULTY}`);
  }
  process.stdout.write('\n');
  // Easiest first, so each difficulty gets gradually harder as it's played through.
  const sorted = [...found].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
  lines.push(`  ${difficulty}: [\n${sorted.map(([code, fewest]) => `    [${fewest}, '${code}'],`).join('\n')}\n  ],`);
}

writeFileSync(
  new URL('../src/blocks/puzzles.ts', import.meta.url),
  `// Made by scripts/blocks.ts (\`just blocks\`): don't edit by hand. Each puzzle is the fewest moves
// that solve it and its blocks (see encode in logic.ts), easiest first.
export const PUZZLES: Record<'easy' | 'medium' | 'hard', [fewest: number, code: string][]> = {
${lines.join('\n')}
};
`,
);
