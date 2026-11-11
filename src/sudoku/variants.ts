// Sudoku is three games on one page: Classic, Killer and Jigsaw. The New Game dialog shows them
// as tabs (src/shared/VariantPicker.svelte), each with its difficulties, as
// "<variant>:<difficulty>"; the page remembers which one was played last, and each keeps its own
// saved game (games.sudoku.v1, games.killer.v1 and games.jigsaw.v1).
import type { Games } from '../shared/VariantPicker.svelte';
import { DIFFICULTIES as CLASSIC } from './classic/logic';
import { DIFFICULTIES as JIGSAW } from './jigsaw/logic';
import { DIFFICULTIES as KILLER } from './killer/logic';

export const VARIANT_KEY = 'games.sudoku.variant.v1';

export const VARIANTS = ['classic', 'killer', 'jigsaw'] as const;
export type Variant = (typeof VARIANTS)[number];
export const isVariant = (value: unknown): value is Variant => VARIANTS.includes(value as Variant);

const options = (variant: Variant, difficulties: Record<string, { label: string }>) =>
  Object.entries(difficulties).map(([key, d]) => ({ value: `${variant}:${key}`, label: d.label }));

export const GAMES: Games = {
  classic: { label: 'Classic', title: 'Difficulty', options: options('classic', CLASSIC) },
  killer: { label: 'Killer', title: 'Difficulty', options: options('killer', KILLER) },
  jigsaw: { label: 'Jigsaw', title: 'Difficulty', options: options('jigsaw', JIGSAW) },
};
