// Deals a Mahjong game off the main thread, so the page stays responsive (and its spinner turns)
// while a deal is made and graded. Message in: a Deal; out: the Game it makes.
import { dealt, type Deal } from './game';

self.onmessage = (e: MessageEvent<Deal>) => {
  self.postMessage(dealt(e.data));
};
