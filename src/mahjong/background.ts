// A Mahjong game dealt in a Web Worker (worker.ts). Every deal is made there, whatever its
// layout or difficulty: grading one can take a moment on a big layout (GameScreen2's games never
// make a puzzle on the main thread).
import { inBackground } from '../shared/background';
import { dealt, type Deal, type Game } from './game';

export const dealInBackground = (deal: Deal): Promise<Game> =>
  inBackground(
    () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
    deal,
    () => dealt(deal),
  );
