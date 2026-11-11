// Makes a Flow puzzle off the main thread, so the page stays responsive (and its spinner turns)
// while a slow setting is generated. Message in: { difficulty, rules }; out: the Puzzle.
import { generate, type Difficulty, type Rules } from './logic';

self.onmessage = (e: MessageEvent<{ difficulty: Difficulty; rules: Rules }>) => {
  self.postMessage(generate(e.data.difficulty, e.data.rules));
};
