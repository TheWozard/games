// Shading is four games on one page: Star Battle, Nurikabe, Hitori and Light Up. The New Game dialog
// shows them as tabs (src/shared/VariantPicker.svelte), each with its difficulties, as
// "<variant>:<difficulty>"; the page remembers which one was played last, and each keeps its own
// saved game (games.shading.<variant>.v1). Nonogram was a fifth until it got its own page again
// (src/nonogram/); a page last left on it opens on Star Battle.
import type { Games } from '../shared/VariantPicker.svelte';
import { DIFFICULTIES as HITORI } from './hitori/logic';
import { DIFFICULTIES as LIGHTUP } from './lightup/logic';
import { DIFFICULTIES as NURIKABE } from './nurikabe/logic';
import { DIFFICULTIES as STARS } from './stars/logic';

export const VARIANT_KEY = 'games.shading.variant.v1';

export const VARIANTS = ['stars', 'nurikabe', 'hitori', 'lightup'] as const;
export type Variant = (typeof VARIANTS)[number];
export const isVariant = (value: unknown): value is Variant => VARIANTS.includes(value as Variant);

export const storageKey = (variant: Variant) => `games.shading.${variant}.v1`;

/** What each game's screen gets to show the other games' tabs and switch to one. */
export interface Switcher {
  games: Games;
  current: Variant;
  onswitch: (pick: string) => void;
}

const options = (variant: Variant, difficulties: Record<string, { label: string; size: number }>, more?: (d: string) => string) =>
  Object.entries(difficulties).map(([key, d]) => ({
    value: `${variant}:${key}`,
    label: d.label,
    detail: [`${d.size}×${d.size}`, more?.(key)].filter(Boolean).join(' · '),
  }));

export const GAMES: Games = {
  stars: {
    label: 'Star Battle',
    title: 'Difficulty',
    options: options('stars', STARS, (d) => (STARS[d as keyof typeof STARS].stars === 1 ? '1 star' : `${STARS[d as keyof typeof STARS].stars} stars`)),
  },
  nurikabe: { label: 'Nurikabe', title: 'Difficulty', options: options('nurikabe', NURIKABE) },
  hitori: { label: 'Hitori', title: 'Difficulty', options: options('hitori', HITORI) },
  lightup: { label: 'Light Up', title: 'Difficulty', options: options('lightup', LIGHTUP) },
};
