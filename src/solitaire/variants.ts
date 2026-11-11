// Solitaire is two games on one page: Klondike and FreeCell. The New dialog lists the settings of
// both, each as "<variant>:<setting>"; the page remembers which one was played last, and each keeps
// its own saved game (games.solitaire.v1 and games.freecell.v1).
import { DIFFICULTIES as FREECELL } from './freecell/logic';

/** Klondike's difficulty names, by how many cards a draw turns over. */
export const KLONDIKE = { 1: 'Easy', 3: 'Classic' } as const;

export const VARIANT_KEY = 'games.solitaire.variant.v1';

export const VARIANTS = ['klondike', 'freecell'] as const;
export type Variant = (typeof VARIANTS)[number];
export const isVariant = (value: unknown): value is Variant => VARIANTS.includes(value as Variant);

/** Each game's name, and its New Game choices under a heading. */
export const GAMES: Record<Variant, { label: string; title: string; options: { value: string; label: string; detail: string }[] }> = {
  klondike: {
    label: 'Klondike',
    title: 'Difficulty',
    options: [
      { value: 'klondike:1', label: KLONDIKE[1], detail: 'draw 1' },
      { value: 'klondike:3', label: KLONDIKE[3], detail: 'draw 3' },
    ],
  },
  freecell: {
    label: 'FreeCell',
    title: 'Difficulty',
    options: Object.entries(FREECELL).map(([key, d]) => ({ value: `freecell:${key}`, label: d.label, detail: `${d.cells} cells` })),
  },
};

/** Every New dialog choice, for both games. */
export const OPTIONS = VARIANTS.flatMap((v) => GAMES[v].options);

/** A choice's game and setting, or null if it isn't one of OPTIONS. */
export function parse(value: string): { variant: Variant; setting: string } | null {
  if (!OPTIONS.some((o) => o.value === value)) return null;
  const [variant, setting] = value.split(':');
  return { variant: variant as Variant, setting };
}

/** What a game screen is given by the page. */
export interface VariantProps {
  /** Deal a new game with this setting instead of resuming the saved one. */
  start?: string;
  /** Called with a New dialog choice for the other game. */
  onswitch: (value: string) => void;
}
