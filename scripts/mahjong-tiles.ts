// Makes src/mahjong/faces.svg, every Mahjong tile face as an SVG <symbol> (id mj-k<kind>), from
// two sets of vector tiles, each fetched at a fixed commit and cleaned up with svgo.
// Run with `just mahjong-tiles`. Needs a network connection.
//
// - FluffyStuff/riichi-mahjong-tiles (public domain, CC0): the suits, winds and dragons.
// - xhokir/riichi-mahjong-tiles (CC BY 4.0, credited in README.md and the game's how-to): the
//   flowers and seasons, which the riichi set doesn't have.
//
// Their white dragon is blank, which reads as a missing face here, so it gets a blue frame
// instead (as on a Chinese set).
import { writeFileSync } from 'node:fs';
import { optimize } from 'svgo';

const FLUFFY =
  'https://raw.githubusercontent.com/FluffyStuff/riichi-mahjong-tiles/26e127ba2117f45cdce5ea0225748cc0cfad3169/Regular/';
const XHOKIR =
  'https://raw.githubusercontent.com/xhokir/riichi-mahjong-tiles/19d72ff5cf9ad9c401188734f80cef7e6c8c6140/Regular/';

const nine = (suit: string) => Array.from({ length: 9 }, (_, n) => FLUFFY + suit + (n + 1));
const four = (name: string) => Array.from({ length: 4 }, (_, n) => XHOKIR + name + (n + 1));

/** Source of each kind, in the order of src/mahjong/logic.ts: 0–8 dots, 9–17 bamboo,
 * 18–26 characters, 27–30 winds E S W N, 31–33 dragons red green white, 34–37 flowers
 * (plum, orchid, chrysanthemum, bamboo), 38–41 seasons (spring to winter). */
const SOURCES: (string | null)[] = [
  ...nine('Pin'),
  ...nine('Sou'),
  ...nine('Man'),
  ...['Ton', 'Nan', 'Shaa', 'Pei', 'Chun', 'Hatsu'].map((n) => FLUFFY + n),
  null, // white dragon, drawn below
  ...four('Flower'),
  ...four('Season'),
];

const WHITE_DRAGON =
  '<rect x="45" y="55" width="210" height="290" rx="22" fill="none" stroke="#142896" stroke-width="22"/>' +
  '<rect x="85" y="95" width="130" height="210" rx="10" fill="none" stroke="#142896" stroke-width="11"/>';

async function face(url: string, kind: number): Promise<string> {
  const res = await fetch(url + '.svg');
  if (!res.ok) throw new Error(`${url}.svg: ${res.status}`);
  const { data } = optimize(await res.text(), {
    multipass: true,
    floatPrecision: 1,
    plugins: [
      'preset-default',
      // Every face shares one document, so its ids (clip paths, gradients) get its own prefix.
      { name: 'prefixIds', params: { prefix: `mj${kind}` } },
      'removeDimensions',
    ],
  });
  const m = /^<svg([^>]*)>([\s\S]*)<\/svg>$/.exec(data);
  if (!m) throw new Error(`${url}.svg: not one <svg>`);
  const viewBox = /viewBox="([^"]*)"/.exec(m[1])?.[1];
  if (viewBox !== '0 0 300 400') throw new Error(`${url}.svg: viewBox ${viewBox}`);
  return m[2];
}

const symbols = await Promise.all(
  SOURCES.map(
    async (url, kind) =>
      `<symbol id="mj-k${kind}" viewBox="0 0 300 400">${url ? await face(url, kind) : WHITE_DRAGON}</symbol>`,
  ),
);

writeFileSync(
  new URL('../src/mahjong/faces.svg', import.meta.url),
  `<!-- Made by scripts/mahjong-tiles.ts. Tiles: FluffyStuff/riichi-mahjong-tiles (CC0); flowers and seasons: xhokir/riichi-mahjong-tiles (CC BY 4.0). -->\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" class="mj-faces" aria-hidden="true" width="0" height="0"><defs>\n${symbols.join('\n')}\n</defs></svg>\n`,
);
console.log(`Wrote ${symbols.length} faces.`);
