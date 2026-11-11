// Playing cards, shared by the card games (Solitaire, FreeCell). A card is a number 0–51:
// suit = floor(card / 13) (♠ ♥ ♦ ♣), rank = card % 13 + 1 (Ace = 1, King = 13).
export type Card = number;

export const suitOf = (c: Card) => Math.floor(c / 13);
export const rankOf = (c: Card) => (c % 13) + 1;
export const isRed = (c: Card) => suitOf(c) === 1 || suitOf(c) === 2;
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANK_NAMES = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];

/** "Queen of hearts", for screen readers. */
export const cardName = (c: Card) => `${RANK_NAMES[rankOf(c) - 1]} of ${SUIT_NAMES[suitOf(c)]}`;

/** A full deck in random order. */
export function shuffledDeck(random: () => number = Math.random): Card[] {
  const deck = [...Array(52).keys()];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/**
 * Whether card c can safely go up to its foundation: nothing still in play could need it to build
 * on. That's when both opposite-colored foundations have reached at least rank − 1 (Aces and 2s
 * are always safe). `foundations[suit]` is how many of that suit are up.
 */
export function safeToFoundation(foundations: readonly number[], c: Card): boolean {
  const r = rankOf(c);
  if (r <= 2) return true;
  const opposite = isRed(c) ? [0, 3] : [1, 2];
  return opposite.every((s) => foundations[s] >= r - 1);
}
