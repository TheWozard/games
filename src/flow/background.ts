// A Flow puzzle made in a Web Worker (worker.ts), for settings that are slow to make.
import { inBackground } from '../shared/background';
import { generate, type Difficulty, type Puzzle, type Rules } from './logic';

export const generateInBackground = (difficulty: Difficulty, rules: Rules): Promise<Puzzle> =>
  inBackground(
    () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
    { difficulty, rules: { ...rules } },
    () => generate(difficulty, rules),
  );
