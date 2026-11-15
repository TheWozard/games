// Every layout a game can deal: the game's own (LAYOUTS in logic.ts, keyed by name) and the
// archive's (archive.ts, keyed by the museum's folder and file, so ids never clash: those have a
// '/'). A game saves a layout's id; saves from before the archive hold own layouts' keys, which
// are still ids.
import { ARCHIVE, decode, type ArchiveLayout } from './archive';
import { LAYOUTS, SLIM, type LayoutName, type Slot } from './logic';

export type LayoutId = string;

export interface Layout {
  id: LayoutId;
  name: string;
  slots: readonly Slot[];
  /** Where an archive layout comes from; missing on the game's own. */
  archive?: Pick<ArchiveLayout, 'by' | 'source'>;
}

/** The game's own layouts' ids, in their order (by tile count). */
export const OWN_IDS: readonly LayoutId[] = Object.keys(LAYOUTS);
/** The archive's ids, by name. */
export const ARCHIVE_IDS: readonly LayoutId[] = ARCHIVE.toSorted((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)).map((l) => l.id);
/** Own layouts that fit a phone upright; no archive layout does. */
export const SLIM_IDS: readonly LayoutId[] = SLIM;

const BY_ID = new Map(ARCHIVE.map((l) => [l.id, l]));

// Archive names that repeat (two Crabs) get a number, in id order: Crab, Crab 2.
const NAMES = new Map<LayoutId, string>();
for (const l of ARCHIVE.toSorted((a, b) => a.id.localeCompare(b.id))) {
  const taken = [...NAMES.values()].filter((n) => n === l.name || n.startsWith(`${l.name} `)).length;
  NAMES.set(l.id, taken ? `${l.name} ${taken + 1}` : l.name);
}

export const isLayoutId = (value: unknown): value is LayoutId =>
  typeof value === 'string' && (Object.hasOwn(LAYOUTS, value) || BY_ID.has(value));

export const isArchive = (id: LayoutId) => BY_ID.has(id);

const CACHE = new Map<LayoutId, Layout>();

/** The layout with that id (decoded once, then kept). */
export function layoutOf(id: LayoutId): Layout {
  let layout = CACHE.get(id);
  if (!layout) {
    const own = Object.hasOwn(LAYOUTS, id) ? LAYOUTS[id as LayoutName] : null;
    const archived = BY_ID.get(id);
    if (own) layout = { id, name: own.name, slots: own.slots };
    else if (archived) layout = { id, name: NAMES.get(id)!, slots: decode(archived.tiles), archive: { by: archived.by, source: archived.source } };
    else throw new Error(`No layout ${id}`);
    CACHE.set(id, layout);
  }
  return layout;
}
