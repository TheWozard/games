// The marks the Grid tool can place: numbers, letters and symbols. A grid offers the ones picked in
// Customize (up to MAX_MARKS), on its pad in the order they're listed here. A mark is a short
// string: the character itself for numbers and letters ('7', 'K'), a name for a symbol ('star').

export type GroupId = 'letters' | 'numbers' | 'symbols';

export interface MarkGroup {
  id: GroupId;
  marks: readonly string[];
  name: string;
}

/**
 * How a group's marks act once written, set for each group in the Display dialog (settings.ts):
 * - `clears`: the notes of the same mark it takes away, in the cell's row and column (`lines`, as
 *   in Sudoku), on the whole grid (`grid`, for a mark that goes in one place), or none.
 * - `highlight`: cells holding it light up while it's the pad's pick.
 * - `notes`: it can go in as a note; if not, Notes writes it instead (a star in Star Battle).
 * - `faded`: it's always drawn dim, as a mark that only rules a cell out (a cross, a dot) is.
 */
export interface Behavior {
  clears: Clears;
  faded: boolean;
  highlight: boolean;
  notes: boolean;
}
export type Clears = 'grid' | 'lines' | 'none';

export const SYMBOL_NAMES: Readonly<Record<string, string>> = {
  check: 'Check',
  cross: 'Cross',
  dot: 'Dot',
  circle: 'Circle',
  star: 'Star',
  triangle: 'Triangle',
  heart: 'Heart',
  diamond: 'Diamond',
};

export const MARK_GROUPS: readonly MarkGroup[] = [
  { id: 'numbers', name: 'Numbers', marks: [...'1234567890'] },
  { id: 'letters', name: 'Letters', marks: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'] },
  { id: 'symbols', name: 'Symbols', marks: Object.keys(SYMBOL_NAMES) },
];

const GROUP_OF = new Map(MARK_GROUPS.flatMap((g) => g.marks.map((m) => [m, g.id] as const)));

const ORDER = MARK_GROUPS.flatMap((g) => g.marks);
const RANK = new Map(ORDER.map((m, k) => [m, k]));

/** At most this many on a grid's pad: two rows, and notes that still fit in a cell (4×4). */
export const MAX_MARKS = 16;

/** A new grid's marks: 1–9 and a check. */
export const DEFAULT_MARKS: readonly string[] = [...'123456789', 'check'];

export const isMark = (m: unknown): m is string => typeof m === 'string' && RANK.has(m);

/** Marks in pad order (numbers, letters, symbols), each once. */
export function sortMarks(marks: Iterable<string>): string[] {
  return [...new Set(marks)].filter(isMark).sort((a, b) => RANK.get(a)! - RANK.get(b)!);
}

/** A mark's name, for screen readers and tooltips. */
export const markName = (m: string) => SYMBOL_NAMES[m] ?? m;

/** The group a mark is in, for how it acts (`Behavior`). */
export const groupOf = (m: string): GroupId | undefined => GROUP_OF.get(m);
