// Twelve colors that stay easy to tell apart on the dark background, for games where color is
// the piece itself (Color Sort's layers, Flow's paths). Ordered so the first few are the most
// distinct: games with fewer colors use the start of the list.
export const PALETTE = [
  '#e5534b', // red
  '#4f8ef7', // blue
  '#e8c547', // yellow
  '#3fb67a', // green
  '#a371f7', // purple
  '#f0883e', // orange
  '#3cc8d0', // teal
  '#ec6cb9', // pink
  '#9bd45a', // lime
  '#b07a4f', // brown
  '#d6dae2', // white
  '#6d5be8', // indigo
] as const;

/** What each of PALETTE's colors is called, for screen readers. */
export const PALETTE_NAMES = [
  'Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange', 'Teal', 'Pink', 'Lime', 'Brown', 'White', 'Indigo',
] as const;
