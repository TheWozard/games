// Makes src/mahjong/archive.ts: Mahjong layouts from the Mahjong Solitaire Layout Museum
// (ffalt/mahseum, https://ffalt.github.io/mahseum/), fetched at a fixed commit.
// Run with `just mahjong-layouts`. Needs a network connection.
//
// Only sources whose layouts are GPL-licensed, like this repo (README.md, License), are taken:
// - KMahjongg (KDE, GPL-2.0-or-later): https://github.com/KDE/kmahjongg/tree/master/layouts/
// - GNOME Mahjongg (GPL-3.0-or-later): https://github.com/GNOME/gnome-mahjongg/tree/main/data/maps/
// The museum's other sources mostly carry no license, so they stay out.
//
// The museum has every layout in KMahjongg's text format: a grid of half-tile cells per layer, each
// tile marked by its four quarters, '1' at its top left. A layout is kept if it keeps the game's
// rules (layoutProblems in src/mahjong/logic.ts) and fits the board's limits below; the rest are
// listed with the reason, and left out.
import { writeFileSync } from 'node:fs';
import { layoutProblems, type Slot } from '../src/mahjong/logic.ts';

const COMMIT = '40721e17ea18a3543f0266ebd2566d4fe72b67a9';
const SOURCES = [
  { folder: 'kmahjongg', name: 'KMahjongg', license: 'GPL-2.0-or-later' },
  { folder: 'gnome-mahjongg', name: 'GNOME Mahjongg', license: 'GPL-3.0-or-later' },
] as const;

/** The most a board pans to: 16 tiles across (KMahjongg's own board) and 10 down, in half tiles. */
const MAX_W = 32;
const MAX_H = 20;

const raw = (path: string) => `https://raw.githubusercontent.com/ffalt/mahseum/${COMMIT}/${path}`;

async function get(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}

interface Parsed {
  by: string;
  name: string;
  slots: Slot[];
}

/** A KMahjongg layout (v1.0, a fixed 32 × 16 × 5 board, or v1.1, which gives its size). */
function parse(text: string): Parsed {
  const lines = text.split(/\r?\n/);
  if (!lines[0].startsWith('kmahjongg-layout-v1'))
    throw new Error(`not a KMahjongg layout: ${lines[0]}`);
  let [w, h, d] = [32, 16, 5];
  let name = '';
  let by = '';
  const rows: string[] = [];
  for (const line of lines.slice(1)) {
    const meta = /^#\s*(name|by):\s*(.*)$/.exec(line);
    if (meta) meta[1] === 'name' ? (name = meta[2].trim()) : (by = meta[2].trim());
    else if (line.startsWith('#') || !line.trim()) continue;
    else if (/^w\d+$/.test(line)) w = +line.slice(1);
    else if (/^h\d+$/.test(line)) h = +line.slice(1);
    else if (/^d\d+$/.test(line)) d = +line.slice(1);
    else rows.push(line);
  }
  if (rows.length !== h * d) throw new Error(`${rows.length} rows, expected ${h} × ${d}`);
  const slots: Slot[] = [];
  for (let z = 0; z < d; z++) {
    for (let y = 0; y < h; y++) {
      const row = rows[z * h + y];
      if (row.length > w) throw new Error(`row ${y} of layer ${z} is wider than ${w}`);
      for (let x = 0; x < row.length; x++) if (row[x] === '1') slots.push({ x, y, z });
    }
  }
  // Moved to the top left corner, as the game's own layouts are.
  const left = Math.min(...slots.map((s) => s.x));
  const top = Math.min(...slots.map((s) => s.y));
  return { name, by, slots: slots.map(({ x, y, z }) => ({ x: x - left, y: y - top, z })) };
}

/** Each tile as three base-36 digits, x y z (all under 36). Decoded by `decode` in archive.ts. */
const encode = (slots: Slot[]) =>
  slots.map(({ x, y, z }) => [x, y, z].map((n) => n.toString(36)).join('')).join('');

const listing = JSON.parse(
  await get(`https://api.github.com/repos/ffalt/mahseum/git/trees/${COMMIT}?recursive=1`),
) as { tree: { path: string }[] };

const kept: string[] = [];
const skipped: string[] = [];
for (const source of SOURCES) {
  const paths = listing.tree
    .map((t) => t.path)
    .filter((p) => p.startsWith(`public/boards/${source.folder}/`) && p.endsWith('.layout'))
    .sort();
  for (const path of paths) {
    const file = path
      .split('/')
      .pop()!
      .replace(/\.layout$/, '');
    const id = `${source.folder}/${file}`;
    const { name, by, slots } = parse(await get(raw(path)));
    const problems = layoutProblems(slots);
    const w = Math.max(...slots.map((s) => s.x)) + 2;
    const h = Math.max(...slots.map((s) => s.y)) + 2;
    if (w > MAX_W) problems.push(`${w / 2} tiles across`);
    if (h > MAX_H) problems.push(`${h / 2} tiles down`);
    if (problems.length) {
      skipped.push(
        `${id} (${name}): ${[...new Set(problems.map((p) => p.replace(/ at \(.*\)$/, '')))].join('; ')}`,
      );
      continue;
    }
    kept.push(
      `  { id: ${JSON.stringify(id)}, name: ${JSON.stringify(name || file)}, by: ${JSON.stringify(by)}, ` +
        `source: ${JSON.stringify(source.name)}, tiles: ${JSON.stringify(encode(slots))} },`,
    );
  }
}

writeFileSync(
  new URL('../src/mahjong/archive.ts', import.meta.url),
  `// Made by scripts/mahjong-layouts.ts (\`just mahjong-layouts\`); don't edit by hand.
// Layouts from the Mahjong Solitaire Layout Museum (https://ffalt.github.io/mahseum/), commit
// ${COMMIT.slice(0, 7)}, from two GPL sources: KMahjongg (KDE, GPL-2.0-or-later) and GNOME
// Mahjongg (GPL-3.0-or-later). Authors as each layout names them.
import type { Slot } from './logic';

export interface ArchiveLayout {
  /** The museum's folder and file name. */
  id: string;
  name: string;
  /** Its author, where the layout names one. */
  by: string;
  source: ${SOURCES.map((s) => JSON.stringify(s.name)).join(' | ')};
  /** Every tile as three base-36 digits, x y z, in half tiles from the top left; see \`decode\`. */
  tiles: string;
}

/** A layout's slots, from its \`tiles\`. */
export function decode(tiles: string): Slot[] {
  const slots: Slot[] = [];
  for (let i = 0; i < tiles.length; i += 3) {
    slots.push({ x: parseInt(tiles[i], 36), y: parseInt(tiles[i + 1], 36), z: parseInt(tiles[i + 2], 36) });
  }
  return slots;
}

export const ARCHIVE: readonly ArchiveLayout[] = [
${kept.join('\n')}
];
`,
);

console.log(`Kept ${kept.length} layouts in src/mahjong/archive.ts; left out ${skipped.length}:`);
for (const line of skipped) console.log(`  ${line}`);
