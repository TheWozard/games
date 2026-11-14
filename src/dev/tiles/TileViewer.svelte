<!--
  Every Mahjong face from TileFaces.svelte on a real tile (the game's .mj-tile), large for detail and
  at phone size in each state it takes in play. Names live here, not in the game, which shows none.
-->
<script lang="ts">
  import TileFaces from '../../mahjong/TileFaces.svelte';
  import { facesFor, KINDS } from '../../mahjong/logic';

  const NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const GROUPS = [
    { title: 'Dots', names: NUMBERS.map((n) => `Dots ${n}`) },
    { title: 'Bamboo', names: NUMBERS.map((n) => `Bamboo ${n}`) },
    { title: 'Characters', names: NUMBERS.map((n) => `Characters ${n}`) },
    { title: 'Winds', names: ['East Wind', 'South Wind', 'West Wind', 'North Wind'] },
    { title: 'Dragons', names: ['Red Dragon', 'Green Dragon', 'White Dragon'] },
    { title: 'Flowers', names: ['Plum Blossom', 'Orchid', 'Chrysanthemum', 'Bamboo Flower'] },
    { title: 'Seasons', names: ['Spring', 'Summer', 'Autumn', 'Winter'] },
  ];

  // A full set, from the game's own dealer: how many copies of each face it has.
  const FULL = facesFor(144);
  const copies = Array.from({ length: KINDS }, (_, k) => FULL.filter((f) => f === k).length);

  let next = 0;
  const sections = GROUPS.map(({ title, names }) => {
    const kinds = names.map((name) => ({ kind: next++, name }));
    const counts = new Set(kinds.map(({ kind }) => copies[kind]));
    const each = counts.size === 1 ? `${[...counts][0]} of each` : 'mixed counts';
    return { title, each, kinds };
  });
  // Names must cover every face the game draws; say so on the page if they drift apart.
  const mismatch = next !== KINDS;

  // The guide tile. Every face is a <symbol viewBox="1.5 1.5 27 37"> (TileFaces.svelte), drawn into
  // a 30 × 40 box; keep these in step with it. The box is a little wider than the viewBox's shape,
  // so the face is centered with a sliver more room left and right; past the box, it's cut off.
  const VIEW = { x: 1.5, y: 1.5, w: 27, h: 37 };
  const BOX = { w: 30, h: 40 };
  const fit = Math.min(BOX.w / VIEW.w, BOX.h / VIEW.h);
  const spareX = (BOX.w / fit - VIEW.w) / 2;
  const spareY = (BOX.h / fit - VIEW.h) / 2;
  const SHOWN = { x0: VIEW.x - spareX, x1: VIEW.x + VIEW.w + spareX, y0: VIEW.y - spareY, y1: VIEW.y + VIEW.h + spareY };
  const fmt = (n: number) => String(Math.round(n * 100) / 100);
  const GRID_X = [0, 5, 10, 15, 20, 25, 30];
  const GRID_Y = [0, 5, 10, 15, 20, 25, 30, 35, 40];

  const STATES = [
    { label: 'Normal', cls: '' },
    { label: 'Blocked', cls: 'blocked' },
    { label: 'Selected', cls: 'selected' },
  ];
</script>

<TileFaces />

<!-- The guide, made like a face (a symbol with the same viewBox, drawn with <use>) so it's cut off
     exactly where a face is: the hatch runs far past every edge, and what's left of it is the area
     that shows. Labels are a second symbol, laid over the large guide only. -->
<svg class="defs" aria-hidden="true" width="0" height="0">
  <defs>
    <pattern id="mj-guide-hatch" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="1.6" height="1.6" fill="#dfe8fb" />
      <path d="M0 0v1.6" stroke="#9db8ef" stroke-width="0.7" />
    </pattern>
    <symbol id="mj-guide" viewBox="{VIEW.x} {VIEW.y} {VIEW.w} {VIEW.h}">
      <rect x="-50" y="-50" width="130" height="140" fill="url(#mj-guide-hatch)" />
      {#each GRID_X as x (x)}
        <path d="M{x} -50V90" stroke="#8b909b" stroke-width="1" vector-effect="non-scaling-stroke" stroke-opacity={x === 15 ? 1 : 0.5} />
      {/each}
      {#each GRID_Y as y (y)}
        <path d="M-50 {y}H80" stroke="#8b909b" stroke-width="1" vector-effect="non-scaling-stroke" stroke-opacity={y === 20 ? 1 : 0.5} />
      {/each}
      <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill="none" stroke="#c8372d" stroke-width="1.5" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" />
      <circle cx="15" cy="20" r="0.8" fill="#c8372d" />
    </symbol>
    <symbol id="mj-guide-labels" viewBox="{VIEW.x} {VIEW.y} {VIEW.w} {VIEW.h}">
      {#each GRID_X.slice(1, -1) as x (x)}
        <text x={x - 0.4} y="38" text-anchor="end" font-size="2.3" font-family="system-ui, sans-serif" fill="#4a4f5a">{x}</text>
      {/each}
      {#each GRID_Y.slice(1, -1) as y (y)}
        <text x="1.9" y={y - 0.5} font-size="2.3" font-family="system-ui, sans-serif" fill="#4a4f5a">{y}</text>
      {/each}
    </symbol>
  </defs>
</svg>

{#snippet tile(href: string, u: number, cls = '', overlay = '')}
  <div class="mj-tile {cls}" style:--u="{u}px" style:width="{3 * u}px" style:height="{4 * u}px">
    <svg viewBox="0 0 30 40" aria-hidden="true">
      <use href="#{href}" />
      {#if overlay}<use href="#{overlay}" />{/if}
    </svg>
  </div>
{/snippet}

<main class="viewer">
  <h1>Mahjong Tiles</h1>
  {#if mismatch}
    <p class="warn">The viewer names {next} faces, but the game has {KINDS}. Update GROUPS in TileViewer.svelte.</p>
  {/if}

  <section>
    <h2>Drawing Area</h2>
    <article class="card guide">
      <div class="faces">
        {@render tile('mj-guide', 80, '', 'mj-guide-labels')}
        <figure>
          {@render tile('mj-guide', 40 / 3)}
          <figcaption>Phone size</figcaption>
        </figure>
      </div>
      <dl>
        <dt><span class="swatch hatch"></span>Shows on the tile</dt>
        <dd>x {fmt(SHOWN.x0)} to {fmt(SHOWN.x1)}, y {fmt(SHOWN.y0)} to {fmt(SHOWN.y1)}. Anything outside is cut off.</dd>
        <dt><span class="swatch dashed"></span>The symbol's viewBox</dt>
        <dd><code>viewBox="{VIEW.x} {VIEW.y} {VIEW.w} {VIEW.h}"</code>: x {VIEW.x} to {VIEW.x + VIEW.w}, y {VIEW.y} to {VIEW.y + VIEW.h}. This is scaled to fill the tile's height, with {fmt(spareX)} spare on the left and right.</dd>
        <dt><span class="swatch dot"></span>Center</dt>
        <dd>x 15, y 20. The darker lines cross there.</dd>
        <dt><span class="swatch grid"></span>Grid</dt>
        <dd>Every 5 units, in the symbol's own coordinates: x across, y down, as in <code>TileFaces.svelte</code>.</dd>
        <dt><span class="swatch plain"></span>Plain tile</dt>
        <dd>The cream margin around the hatch is the tile's padding. Nothing drawn in a face reaches it.</dd>
      </dl>
    </article>
  </section>

  {#each sections as { title, each, kinds } (title)}
    <section>
      <h2>{title} <span>{each}</span></h2>
      <div class="cards">
        {#each kinds as { kind, name } (kind)}
          <article class="card">
            <header><strong>{name}</strong><span>{kind} · mj-k{kind} · ×{copies[kind]}</span></header>
            <div class="faces">
              {@render tile(`mj-k${kind}`, 40)}
              <div class="states">
                {#each STATES as { label, cls } (label)}
                  <figure>
                    {@render tile(`mj-k${kind}`, 40 / 3, cls)}
                    <figcaption>{label}</figcaption>
                  </figure>
                {/each}
              </div>
            </div>
          </article>
        {/each}
      </div>
    </section>
  {/each}

  <footer>{KINDS} kinds · {FULL.length} tiles in a full set</footer>
</main>

<style>
  .viewer { max-width: 1100px; margin: 0 auto; padding: 16px 16px calc(var(--safe-bottom) + 16px); }
  h1 { margin: 8px 0 4px; font-size: 1.4rem; }
  h2 { margin: 24px 0 10px; font-size: 1.1rem; }
  h2 span { color: var(--muted); font-size: 0.85rem; font-weight: 400; margin-left: 6px; }
  .warn { color: var(--danger); }

  /* Wide enough for the large tile, its shadow, and the three small ones beside it. */
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr)); gap: 12px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px 14px; }
  .card header { display: flex; flex-direction: column; gap: 1px; margin-bottom: 12px; }
  .card header span { color: var(--muted); font-size: 0.75rem; font-variant-numeric: tabular-nums; }

  /* The gap leaves room for the large tile's side and shadow, which fall to its right. */
  .faces { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 20px 34px; }
  .states { display: flex; gap: 12px; padding-top: 4px; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  figcaption { color: var(--muted); font-size: 0.7rem; }

  /* The game positions tiles absolutely on its board; here they sit in the flow. */
  .mj-tile { position: relative; flex: none; }

  .defs { position: absolute; width: 0; height: 0; overflow: hidden; }

  /* Extra room below for the large tile's side and shadow. */
  .guide { display: flex; flex-wrap: wrap; gap: 24px 40px; align-items: flex-start; padding-bottom: 50px; }
  .guide .faces { gap: 20px 46px; }
  dl { flex: 1 1 280px; margin: 0; font-size: 0.9rem; }
  dt { display: flex; align-items: center; gap: 8px; font-weight: 600; }
  dd { margin: 2px 0 12px 26px; color: var(--muted); }
  code { font-size: 0.85em; color: var(--text); }
  .swatch { flex: none; width: 18px; height: 14px; border-radius: 3px; }
  .swatch.hatch { background: repeating-linear-gradient(45deg, #dfe8fb 0 3px, #9db8ef 3px 4.5px); }
  .swatch.dashed { border: 2px dashed #c8372d; }
  .swatch.dot { width: 8px; height: 8px; margin: 0 5px; border-radius: 50%; background: #c8372d; }
  .swatch.grid { background: linear-gradient(90deg, transparent 8px, #8b909b 8px 9px, transparent 9px), linear-gradient(transparent 6px, #8b909b 6px 7px, transparent 7px), #dfe8fb; }
  .swatch.plain { background: linear-gradient(160deg, #fbf7ec, #ece3cc); }

  footer { margin-top: 28px; color: var(--muted); font-size: 0.85rem; }
</style>
