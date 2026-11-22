<!--
  Every Mahjong face, in either set of tile art (TileFaces.svelte), on a real tile (the game's .mj-tile), large for detail and
  at phone size in each state it takes in play. Names live here, not in the game, which shows none.
-->
<script lang="ts">
  import { facesFor, KINDS } from '../../mahjong/logic';
  import TileBody from '../../mahjong/TileBody.svelte';
  import TileFaces from '../../mahjong/TileFaces.svelte';
  import { CHOICES, loadSettings } from '../../shared/settings';

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

  // Kinds are numbered in GROUPS' order, as in the game.
  const starts = GROUPS.map((_, g) =>
    GROUPS.slice(0, g).reduce((n, { names }) => n + names.length, 0),
  );
  const named = GROUPS.reduce((n, { names }) => n + names.length, 0);
  const sections = GROUPS.map(({ title, names }, g) => {
    const kinds = names.map((name, i) => ({ kind: starts[g] + i, name }));
    const counts = new Set(kinds.map(({ kind }) => copies[kind]));
    const each = counts.size === 1 ? `${[...counts][0]} of each` : 'mixed counts';
    return { title, each, kinds };
  });
  // Names must cover every face the game draws; say so on the page if they drift apart.
  const mismatch = named !== KINDS;

  // Which tile art to show; starts as picked in Mahjong's Settings (its menu), not saved from here.
  let art = $state(loadSettings().mahjongArt);
  const ART_NAMES = { classic: 'Classic', riichi: 'Riichi' };

  // The guide tile, in the picked art's own coordinates; keep these in step with its faces.
  // Classic's are <symbol viewBox="1.5 1.5 27 37"> in a 30 × 40 face (ClassicFaces.svelte);
  // Riichi's are <symbol viewBox="0 0 300 400"> (faces.svg, made by scripts/mahjong-tiles.ts).
  // Riichi is Classic's coordinates times ten, so the guide is drawn once and scaled by S. Where
  // the face's shape differs from the viewBox's, the face is centered with spare room at the
  // sides; past the face, it's cut off.
  const S = $derived(art === 'riichi' ? 10 : 1);
  const VIEW = $derived(
    art === 'riichi' ? { x: 0, y: 0, w: 300, h: 400 } : { x: 1.5, y: 1.5, w: 27, h: 37 },
  );
  const BOX = $derived({ w: 30 * S, h: 40 * S });
  const fit = $derived(Math.min(BOX.w / VIEW.w, BOX.h / VIEW.h));
  const spareX = $derived((BOX.w / fit - VIEW.w) / 2);
  const spareY = $derived((BOX.h / fit - VIEW.h) / 2);
  const SHOWN = $derived({
    x0: VIEW.x - spareX,
    x1: VIEW.x + VIEW.w + spareX,
    y0: VIEW.y - spareY,
    y1: VIEW.y + VIEW.h + spareY,
  });
  const fmt = (n: number) => String(Math.round(n * 100) / 100);
  const GRID_X = $derived([0, 5, 10, 15, 20, 25, 30].map((v) => v * S));
  const GRID_Y = $derived([0, 5, 10, 15, 20, 25, 30, 35, 40].map((v) => v * S));

  const STATES = [
    { label: 'Normal', cls: '' },
    { label: 'Blocked', cls: 'blocked' },
    { label: 'Selected', cls: 'selected' },
  ];
  // The face shown large in every state (States, below the guide): East Wind to start, whose blue
  // Riichi symbol is the hardest to read on a picked tile's tint.
  let stateKind = $state(sections.find((s) => s.title === 'Winds')?.kinds[0].kind ?? 0);

  // The drawing area to try: how much of the tile, across and down, a face's box fills. It sets
  // every tile's padding here. Presets are the game's (mahjong.css): Full's 5% margin each side,
  // Inset's 10%.
  const PRESETS = [
    { label: 'Full', percent: 90 },
    { label: 'Inset', percent: 80 },
  ];
  let percent = $state(90);
  const margin = $derived((100 - percent) / 200);
  const padding = $derived(
    `calc(var(--u) * ${fmt(margin * 4)}) calc(var(--u) * ${fmt(margin * 3)})`,
  );
</script>

<TileFaces {art} />

<!-- The guide, made like a face (a symbol with the same viewBox, drawn with <use>) so it's cut off
     exactly where a face is: the hatch runs far past every edge, and what's left of it is the area
     that shows. Labels are a second symbol, laid over the large guide only. -->
<svg class="defs" aria-hidden="true" height="0" width="0">
  <defs>
    <pattern
      id="mj-guide-hatch"
      height={1.6 * S}
      patternTransform="rotate(45)"
      patternUnits="userSpaceOnUse"
      width={1.6 * S}
    >
      <rect fill="#dfe8fb" height={1.6 * S} width={1.6 * S} />
      <path d="M0 0v{1.6 * S}" stroke="#9db8ef" stroke-width={0.7 * S} />
    </pattern>
    <symbol id="mj-guide" viewBox="{VIEW.x} {VIEW.y} {VIEW.w} {VIEW.h}">
      <rect fill="url(#mj-guide-hatch)" height={140 * S} width={130 * S} x={-50 * S} y={-50 * S} />
      {#each GRID_X as x (x)}
        <path
          d="M{x} {-50 * S}V{90 * S}"
          stroke="#8b909b"
          stroke-opacity={x === 15 * S ? 1 : 0.5}
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
      {/each}
      {#each GRID_Y as y (y)}
        <path
          d="M{-50 * S} {y}H{80 * S}"
          stroke="#8b909b"
          stroke-opacity={y === 20 * S ? 1 : 0.5}
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
      {/each}
      <rect
        fill="none"
        height={VIEW.h}
        stroke="#c8372d"
        stroke-dasharray="5 4"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
        width={VIEW.w}
        x={VIEW.x}
        y={VIEW.y}
      />
      <circle cx={15 * S} cy={20 * S} fill="#c8372d" r={0.8 * S} />
    </symbol>
    <symbol id="mj-guide-labels" viewBox="{VIEW.x} {VIEW.y} {VIEW.w} {VIEW.h}">
      {#each GRID_X.slice(1, -1) as x (x)}
        <text
          fill="#4a4f5a"
          font-family="system-ui, sans-serif"
          font-size={2.3 * S}
          text-anchor="end"
          x={x - 0.4 * S}
          y={38 * S}
        >
          {x}
        </text>
      {/each}
      {#each GRID_Y.slice(1, -1) as y (y)}
        <text
          fill="#4a4f5a"
          font-family="system-ui, sans-serif"
          font-size={2.3 * S}
          x={VIEW.x + 0.4 * S}
          y={y - 0.5 * S}
        >
          {y}
        </text>
      {/each}
    </symbol>
  </defs>
</svg>

{#snippet tile(href: string, u: number, cls = '', overlay = '')}
  <div style:--u="{u}px" style:width="{3 * u}px" style:height="{4 * u}px" class="mj-tile {cls}">
    <TileBody {href} {overlay} />
  </div>
{/snippet}

<main style:--face-margin={margin} class="viewer">
  <h1>Mahjong Tiles</h1>
  <div class="scale">
    <label>
      <span>Drawing area <strong>{percent}%</strong></span>
      <input max="100" min="50" step="1" type="range" bind:value={percent} />
    </label>
    <div class="presets">
      {#each PRESETS as preset (preset.label)}
        <button
          class="btn"
          aria-pressed={percent === preset.percent}
          onclick={() => (percent = preset.percent)}
          type="button"
        >
          {preset.label}
          {preset.percent}%
        </button>
      {/each}
    </div>
    <div class="presets">
      {#each CHOICES.mahjongArt as choice (choice)}
        <button
          class="btn"
          aria-pressed={art === choice}
          onclick={() => (art = choice)}
          type="button"
        >
          {ART_NAMES[choice]}
        </button>
      {/each}
    </div>
    <code>padding: {padding};</code>
  </div>
  {#if mismatch}
    <p class="warn">
      The viewer names {named} faces, but the game has {KINDS}. Update GROUPS in TileViewer.svelte.
    </p>
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
        <dd>
          x {fmt(SHOWN.x0)} to {fmt(SHOWN.x1)}, y {fmt(SHOWN.y0)} to {fmt(SHOWN.y1)}. Anything
          outside is cut off.
        </dd>
        <dt><span class="swatch dashed"></span>The symbol's viewBox</dt>
        <dd>
          <code>viewBox="{VIEW.x} {VIEW.y} {VIEW.w} {VIEW.h}"</code>: x {VIEW.x} to {VIEW.x +
            VIEW.w}, y {VIEW.y} to {VIEW.y + VIEW.h}. This is scaled to fit the tile's padding box{(
            spareX || spareY
          ) ?
            `, with ${fmt(spareX)} spare at the left and right and ${fmt(spareY)} at the top and bottom`
          : ''}.
        </dd>
        <dt><span class="swatch dot"></span>Center</dt>
        <dd>x {15 * S}, y {20 * S}. The darker lines cross there.</dd>
        <dt><span class="swatch grid"></span>Grid</dt>
        <dd>
          Every {5 * S} units, in the symbol's own coordinates: x across, y down, as in
          <code>{art === 'riichi' ? 'faces.svg' : 'ClassicFaces.svelte'}</code>.
        </dd>
        <dt><span class="swatch plain"></span>Plain tile</dt>
        <dd>
          The cream margin around the hatch is the tile's padding. Nothing drawn in a face reaches
          it.
        </dd>
      </dl>
    </article>
  </section>

  <section>
    <h2>States</h2>
    <article class="card states-large">
      <label class="state-face">
        <span>Face</span>
        <select bind:value={stateKind}>
          {#each sections as { title, kinds } (title)}
            <optgroup label={title}>
              {#each kinds as { kind, name } (kind)}<option value={kind}>{name}</option>{/each}
            </optgroup>
          {/each}
        </select>
      </label>
      <div class="faces">
        {#each STATES as { label, cls } (label)}
          <figure>
            {@render tile(`mj-k${stateKind}`, 40, cls)}
            <figcaption>{label}</figcaption>
          </figure>
        {/each}
      </div>
    </article>
  </section>

  {#each sections as { title, each, kinds } (title)}
    <section>
      <h2>{title} <span>{each}</span></h2>
      <div class="cards">
        {#each kinds as { kind, name } (kind)}
          <article class="card">
            <header>
              <strong>{name}</strong><span>{kind} · mj-k{kind} · ×{copies[kind]}</span>
            </header>
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
  .viewer {
    max-width: 1100px;
    padding: 16px 16px calc(var(--safe-bottom) + 16px);
    margin: 0 auto;
  }
  h1 {
    margin: 8px 0 4px;
    font-size: 1.4rem;
  }
  h2 {
    margin: 24px 0 10px;
    font-size: 1.1rem;
  }
  h2 span {
    margin-left: 6px;
    font-size: 0.85rem;
    font-weight: 400;
    color: var(--muted);
  }
  .warn {
    color: var(--danger);
  }

  /* Wide enough for the large tile, its shadow, and the three small ones beside it. */
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
    gap: 12px;
  }
  .card {
    padding: 12px 14px 14px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .card header {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-bottom: 12px;
  }
  .card header span {
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }

  /* The gap leaves room for the large tile's side and shadow, which fall to its right. */
  .faces {
    display: flex;
    flex-wrap: wrap;
    gap: 20px 34px;
    align-items: flex-start;
  }
  .states {
    display: flex;
    gap: 12px;
    padding-top: 4px;
  }
  figure {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    margin: 0;
  }
  figcaption {
    font-size: 0.7rem;
    color: var(--muted);
  }

  /* The game positions tiles absolutely on its board; here they sit in the flow. */
  .mj-tile {
    position: relative;
    flex: none;
  }
  /* The slider's drawing area, for every tile. */
  .viewer .mj-tile {
    padding: calc(var(--u) * 4 * var(--face-margin)) calc(var(--u) * 3 * var(--face-margin));
  }

  /* The slider stays in reach while scrolling through the faces. */
  .scale {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: center;
    padding: 10px 16px;
    margin: 8px -16px 0;
    background: var(--bg);
    border-bottom: 1px solid var(--line);
  }
  .scale label {
    display: flex;
    flex: 1 1 260px;
    gap: 10px;
    align-items: center;
    font-size: 0.9rem;
  }
  .scale label span {
    flex: none;
    min-width: 9.5em;
  }
  .scale input {
    flex: 1;
    min-width: 0;
    accent-color: var(--accent);
  }
  .presets {
    display: flex;
    gap: 6px;
  }
  .presets .btn {
    padding: 4px 10px;
    font-size: 0.8rem;
  }
  .scale code {
    flex: 1 1 100%;
    color: var(--muted);
  }

  .defs {
    position: absolute;
    width: 0;
    height: 0;
    overflow: hidden;
  }

  /* Extra room below for the large tile's side and shadow. */
  .guide {
    display: flex;
    flex-wrap: wrap;
    gap: 24px 40px;
    align-items: flex-start;
    padding-bottom: 50px;
  }
  .guide .faces {
    gap: 20px 46px;
  }
  dl {
    flex: 1 1 280px;
    margin: 0;
    font-size: 0.9rem;
  }
  dt {
    display: flex;
    gap: 8px;
    align-items: center;
    font-weight: 600;
  }
  dd {
    margin: 2px 0 12px 26px;
    color: var(--muted);
  }
  code {
    font-size: 0.85em;
    color: var(--text);
  }
  .swatch {
    flex: none;
    width: 18px;
    height: 14px;
    border-radius: 3px;
  }
  .swatch.hatch {
    background: repeating-linear-gradient(45deg, #dfe8fb 0 3px, #9db8ef 3px 4.5px);
  }
  .swatch.dashed {
    border: 2px dashed #c8372d;
  }
  .swatch.dot {
    width: 8px;
    height: 8px;
    margin: 0 5px;
    background: #c8372d;
    border-radius: 50%;
  }
  .swatch.grid {
    background:
      linear-gradient(90deg, transparent 8px, #8b909b 8px 9px, transparent 9px),
      linear-gradient(transparent 6px, #8b909b 6px 7px, transparent 7px), #dfe8fb;
  }
  .swatch.plain {
    background: linear-gradient(160deg, #fbf7ec, #ece3cc);
  }

  /* Room below and between for each large tile's side and shadow. */
  .states-large {
    padding-bottom: 16px;
  }
  .states-large figure {
    gap: 30px;
  }
  .state-face {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 16px;
    font-size: 0.9rem;
  }
  .state-face select {
    padding: 4px 8px;
    font: inherit;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 8px;
  }

  footer {
    margin-top: 28px;
    font-size: 0.85rem;
    color: var(--muted);
  }
</style>
