<script lang="ts">
  import GameScreen from '../shared/GameScreen.svelte';
  import RulesPicker from '../shared/RulesPicker.svelte';
  import { attachPan } from '../shared/pan';
  import { PALETTE } from '../shared/palette';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { CROSS, EMPTY, isGame, newGame, reducer, shading, STORAGE_KEY, type Action } from './game';
  import { colOf, DIFFICULTIES, fits, isDifficulty, NO_RULES, rowOf, RULES, solveLine, type Difficulty, type Rule, type Rules, type Run } from './logic';

  const LONG_PRESS_MS = 350;
  /** The smallest a cell gets, in pixels, so it stays easy to hit; a board that's then too wide pans. */
  const MIN_CELL = 30;
  const COLOR_NAMES = ['Red', 'Blue', 'Yellow', 'Green', 'Purple'];
  // Clue sizes, in cells: one number's width in a row clue, its height in a column clue.
  const CLUE_W = 0.62;
  const CLUE_W_WIDE = 0.9; // two digits
  const CLUE_H = 0.62;

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('easy'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  $effect(() => saveJSON(STORAGE_KEY, game));

  const label = $derived(
    [DIFFICULTIES[game.difficulty].label, ...(Object.keys(RULES) as Rule[]).filter((k) => game.rules[k]).map((k) => RULES[k].label)].join(' · '),
  );

  // The color a tap shades in (always 1 without the colors rule).
  let brush = $state(1);
  $effect(() => {
    if (brush > game.colors) brush = 1;
  });

  const sizes = Object.fromEntries(
    Object.entries(DIFFICULTIES).map(([k, d]) => [k, { label: d.label, detail: `${d.size}×${d.size}` }]),
  ) as Record<Difficulty, { label: string; detail: string }>;

  let choice = $state<{ difficulty: Difficulty; rules: Rules }>({ difficulty: 'easy', rules: { ...NO_RULES } });
  function start(value: string) {
    if (value === 'start' && isDifficulty(choice.difficulty)) deal(newGame(choice.difficulty, { ...choice.rules }));
  }

  function deal(next: typeof game) {
    game = next;
    scrollX = 0; // a new puzzle opens with its first columns beside the row clues
  }

  // ---- Layout, in cell units: row clues on the left, column clues on top. ----

  const runWidth = (run: Run) => (run.length !== null && run.length >= 10 ? CLUE_W_WIDE : CLUE_W);
  const left = $derived(Math.max(1, ...game.rows.map((clue) => clue.reduce((w, run) => w + runWidth(run), 0))) + 0.2);
  const top = $derived(Math.max(1, ...game.cols.map((clue) => clue.length)) * CLUE_H + 0.2);
  const n = $derived(game.size);
  const block = $derived(DIFFICULTIES[game.difficulty].block);
  const viewW = $derived(left + n + 0.1);
  const viewH = $derived(top + n + 0.1);

  // ---- Size and panning ----
  // u is pixels per cell: the board fits its space, but cells never get smaller than MIN_CELL
  // (unless the height can't take it). A board that's then wider than its space shows what fits
  // and pans sideways: the grid and its column clues slide under the row clues, which stay put.
  // A drag that starts on a cell paints, so a pan starts anywhere else: the column clues, the
  // margins. A sideways wheel pans too.
  let areaW = $state(360);
  let areaH = $state(560);
  const u = $derived(Math.min(areaH / viewH, Math.max(areaW / viewW, MIN_CELL)));
  const shownW = $derived(Math.min(viewW, areaW / u)); // in cells
  const maxScroll = $derived(Math.max(0, (viewW - shownW) * u)); // in pixels
  let scrollX = $state(0);
  const sx = $derived(Math.min(Math.max(0, scrollX), maxScroll) / u); // in cells
  let panning = $state(false);

  /** Where each number of a row clue sits: its center x, and its width. */
  const rowLayout = $derived(
    game.rows.map((clue) => {
      let x = left - 0.12;
      return clue.toReversed().map((run) => {
        const w = runWidth(run);
        x -= w;
        return { run, x: x + w / 2, w };
      }).toReversed();
    }),
  );

  const colorOf = (color: number) => (game.colors > 1 ? PALETTE[color - 1] : 'var(--accent)');
  // Clue numbers are in their run's color; plain ones in the text color (hidden ones muted, by CSS).
  const clueColor = (run: Run) => (game.colors > 1 ? PALETTE[run.color - 1] : undefined);

  // ---- Strokes ----
  // A press starts a stroke on a cell. Its value: a tap shades the cell in the brush color (or
  // clears it if it already is, or is crossed); a long-press or right-click crosses it (or clears
  // a cross). Dragging carries that value along the row or column the drag first moves in, to
  // every cell that started out like the first one. It's drawn as it goes and applied on release.

  interface Stroke {
    pointer: number;
    start: number;
    end: number;
    from: number; // the first cell's value
    value: number;
    axis: 'row' | 'col' | null;
  }

  let stroke = $state.raw<Stroke | null>(null);
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let svg = $state<SVGSVGElement>();

  const tapValue = (from: number) => (from === brush || from === CROSS ? EMPTY : brush);
  const crossValue = (from: number) => (from === CROSS ? EMPTY : CROSS);

  function strokeCells(s: Stroke): number[] {
    const r0 = Math.floor(s.start / n);
    const c0 = s.start % n;
    const r1 = Math.floor(s.end / n);
    const c1 = s.end % n;
    const line = s.axis === 'row'
      ? range(c0, c1).map((c) => r0 * n + c)
      : s.axis === 'col'
        ? range(r0, r1).map((r) => r * n + c0)
        : [s.start];
    return line.filter((i) => game.cells[i] === s.from);
  }

  const range = (a: number, b: number) => Array.from({ length: Math.abs(b - a) + 1 }, (_, k) => (a <= b ? a + k : a - k));

  /** The cell under a pointer, or null outside the grid. */
  function cellAt(e: PointerEvent): number | null {
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const x = (e.clientX - box.left) / u - 0.05;
    if (x < left) return null; // the row clues, over whatever's panned under them
    const c = Math.floor(x + sx - left);
    const r = Math.floor((e.clientY - box.top) / u - 0.05 - top);
    return r >= 0 && r < n && c >= 0 && c < n ? r * n + c : null;
  }

  function down(e: PointerEvent) {
    if (game.done || stroke || (e.button !== 0 && e.button !== 2)) return;
    const i = cellAt(e);
    if (i === null) return;
    e.preventDefault();
    svg?.setPointerCapture(e.pointerId);
    const from = game.cells[i];
    const cross = e.button === 2;
    stroke = { pointer: e.pointerId, start: i, end: i, from, value: cross ? crossValue(from) : tapValue(from), axis: null };
    clearTimeout(pressTimer);
    if (!cross) {
      pressTimer = setTimeout(() => {
        if (stroke && stroke.end === stroke.start) stroke = { ...stroke, value: crossValue(stroke.from) };
      }, LONG_PRESS_MS);
    }
  }

  function move(e: PointerEvent) {
    if (!stroke || e.pointerId !== stroke.pointer) return;
    const i = cellAt(e);
    if (i === null || i === stroke.end) return;
    clearTimeout(pressTimer);
    const dr = Math.floor(i / n) - Math.floor(stroke.start / n);
    const dc = (i % n) - (stroke.start % n);
    const axis = stroke.axis ?? (dr === 0 && dc === 0 ? null : Math.abs(dc) >= Math.abs(dr) ? 'row' : 'col');
    // Keep to the stroke's line: the nearest cell on it to the pointer.
    const end = axis === 'row'
      ? Math.floor(stroke.start / n) * n + (i % n)
      : axis === 'col'
        ? Math.floor(i / n) * n + (stroke.start % n)
        : stroke.start;
    stroke = { ...stroke, axis, end };
  }

  function up(e: PointerEvent) {
    if (!stroke || e.pointerId !== stroke.pointer) return;
    clearTimeout(pressTimer);
    const s = stroke;
    stroke = null;
    dispatch({ type: 'paint', indices: strokeCells(s), value: s.value });
  }

  function cancel(e: PointerEvent) {
    if (!stroke || e.pointerId !== stroke.pointer) return;
    clearTimeout(pressTimer);
    stroke = null;
  }

  // What's on screen: the game, with the stroke in progress drawn over it.
  const shown = $derived.by(() => {
    if (!stroke) return game.cells;
    const cells = game.cells.slice();
    for (const i of strokeCells(stroke)) cells[i] = stroke.value;
    return cells;
  });

  // Each line's clue dims once the line matches it, and turns red once its marks can't.
  type Fit = 'met' | 'bad' | null;
  function fitOf(line: number[], clue: Run[]): Fit {
    if (fits(shading(line), clue)) return 'met';
    const all = (1 << (game.colors + 1)) - 1;
    return solveLine(line.map((v) => (v === CROSS ? 1 : v === EMPTY ? all : 1 << v)), clue) ? null : 'bad';
  }
  const rowFit = $derived(game.rows.map((clue, r) => fitOf(rowOf(shown, n, r), clue)));
  const colFit = $derived(game.cols.map((clue, c) => fitOf(colOf(shown, n, c), clue)));

  // The row and column under a stroke get their clues lit, to find them on a big board.
  const focus = $derived(stroke ? { r: Math.floor(stroke.end / n), c: stroke.end % n } : null);

  $effect(() => {
    if (!svg) return;
    return attachPan(svg, {
      max: () => maxScroll,
      get: () => sx * u,
      set: (x) => (scrollX = x),
      onPanning: (on) => (panning = on),
      startsPan: (e) => !stroke && cellAt(e) === null,
    });
  });
</script>

<GameScreen
  title="Nonogram"
  subtitle={label}
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  onopennew={() => (choice = { difficulty: game.difficulty, rules: { ...game.rules } })}
  onstart={start}
  finished={game.done}
  onnext={() => deal(newGame(game.difficulty, game.rules))}
  wide
>
  {#snippet picker()}
    <RulesPicker {sizes} rules={RULES} bind:size={choice.difficulty} bind:on={choice.rules} />
  {/snippet}

  <div class="board-area nonogram-area" bind:clientWidth={areaW} bind:clientHeight={areaH}>
    <svg
      bind:this={svg}
      class={['nonogram', { done: game.done, pannable: maxScroll > 0, panning }]}
      width={shownW * u}
      height={viewH * u}
      viewBox="-0.05 -0.05 {shownW} {viewH}"
      role="group"
      aria-label="Nonogram board"
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={cancel}
      onlostpointercapture={cancel}
      oncontextmenu={(e) => e.preventDefault()}
    >
      <defs>
        <clipPath id="nonogram-pan">
          <rect x={left - 0.05} y="-0.05" width={shownW - left + 0.05} height={viewH} />
        </clipPath>
      </defs>

      <!-- The column clues and the grid, which pan sideways under the row clues. -->
      <g clip-path="url(#nonogram-pan)">
        <g transform="translate({-sx} 0)">
          {#if focus}
            <rect class="focus" x={left + focus.c} y="0" width="1" height={top - 0.04} rx="0.12" />
          {/if}

          {#each game.cols as clue, c (c)}
            <g class={['clue', colFit[c]]}>
              {#if colFit[c] === 'bad'}
                <rect class="over" x={left + c + 0.08} y={top - 0.1 - clue.length * CLUE_H - 0.04} width="0.84" height={clue.length * CLUE_H + 0.04} rx="0.14" />
              {/if}
              {#each clue as run, k (k)}
                <text x={left + c + 0.5} y={top - 0.1 - (clue.length - k - 0.5) * CLUE_H} style:fill={clueColor(run)} class={{ colored: game.colors > 1, mystery: run.length === null }}>{run.length ?? '?'}</text>
              {/each}
            </g>
          {/each}

          <rect class="grid" x={left} y={top} width={n} height={n} />
          {#each shown as v, i (i)}
            {@const x = left + (i % n)}
            {@const y = top + Math.floor(i / n)}
            {#if v > 0}
              <rect class="cell" x={x + (game.done ? 0 : 0.03)} y={y + (game.done ? 0 : 0.03)} width={game.done ? 1 : 0.94} height={game.done ? 1 : 0.94} rx={game.done ? 0 : 0.08} fill={colorOf(v)} />
            {:else}
              <rect class="cell empty" x={x + 0.03} y={y + 0.03} width="0.94" height="0.94" rx="0.08" />
              {#if v === CROSS && !game.done}
                <path class="cross" d="M{x + 0.33} {y + 0.33}l0.34 0.34M{x + 0.67} {y + 0.33}l-0.34 0.34" />
              {/if}
            {/if}
          {/each}
          <g class="blocks">
            {#each { length: Math.floor((n - 1) / block) } as _, k (k)}
              {@const at = (k + 1) * block}
              <line x1={left + at} y1={top} x2={left + at} y2={top + n} />
              <line x1={left} y1={top + at} x2={left + n} y2={top + at} />
            {/each}
            <rect x={left} y={top} width={n} height={n} />
          </g>
        </g>
      </g>

      {#if focus}
        <rect class="focus" x="0" y={top + focus.r} width={left - 0.04} height="1" rx="0.12" />
      {/if}
      {#each rowLayout as items, r (r)}
        <g class={['clue', rowFit[r]]}>
          {#if rowFit[r] === 'bad'}
            {@const from = items.length ? items[0].x - items[0].w / 2 : left - 1}
            <rect class="over" x={from - 0.04} y={top + r + 0.08} width={left - 0.08 - from} height="0.84" rx="0.14" />
          {/if}
          {#each items as { run, x }, k (k)}
            <text {x} y={top + r + 0.5} style:fill={clueColor(run)} class={{ colored: game.colors > 1, mystery: run.length === null }}>{run.length ?? '?'}</text>
          {/each}
        </g>
      {/each}
    </svg>
  </div>

  {#if game.colors > 1}
    <!-- The color a tap shades in, in front; the others stacked behind it in the order a tap
         brings them forward. -->
    <div class="brush-row">
      <button
        type="button"
        class="brush"
        style:--count={game.colors}
        aria-label="Shading with {COLOR_NAMES[brush - 1]}; tap for {COLOR_NAMES[brush % game.colors]}"
        onclick={() => (brush = (brush % game.colors) + 1)}
      >
        {#each { length: game.colors } as _, k (k)}
          <span class="dot" style:--at={(k + 1 - brush + game.colors) % game.colors} style:background={PALETTE[k]}></span>
        {/each}
      </button>
    </div>
  {/if}
</GameScreen>
