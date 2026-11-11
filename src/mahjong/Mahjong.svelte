<script lang="ts">
  import { scale } from 'svelte/transition';
  import GameScreen from '../shared/GameScreen.svelte';
  import { attachPan } from '../shared/pan';
  import { loadJSON, saveJSON } from '../shared/storage';
  import TileFaces from './TileFaces.svelte';
  import { free, isGame, newGame, pairsLeft, reducer, STORAGE_KEY, type Action } from './game';
  import { drawOrder, isLayout, LAYOUTS } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('pyramid'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const layout = $derived(LAYOUTS[game.layout]);
  const moves = $derived(pairsLeft(game).length);
  const tilesLeft = $derived(game.gone.filter((g) => !g).length);

  // Geometry, in units where a tile is 3 × 4: half-tile steps of 1.5 across and 2 down, each layer
  // raised up and left by LIFT, and every tile showing DEPTH of its side below and to the right.
  const LIFT = 0.42;
  const DEPTH = 0.42;
  const box = $derived.by(() => {
    const maxX = Math.max(...layout.slots.map((s) => s.x)) + 2;
    const maxY = Math.max(...layout.slots.map((s) => s.y)) + 2;
    const maxZ = Math.max(...layout.slots.map((s) => s.z));
    return { w: maxX * 1.5 + DEPTH + maxZ * LIFT, h: maxY * 2 + DEPTH + maxZ * LIFT, maxZ };
  });

  // Size, in pixels per unit: fit the board to the space, but never smaller than an 8-wide layout
  // gets on an upright phone (PHONE_W). Wide layouts keep that tile size and pan sideways
  // (scrollX, null: centered) when they don't fit; a wider screen (a tablet, a desktop) uses its
  // extra width and only pans if it must.
  const NARROW_W = 8 * 3 + DEPTH + 3 * LIFT; // about the widest layout that fits a phone upright
  const PHONE_W = 400;
  let areaW = $state(360);
  let areaH = $state(560);
  const u = $derived(Math.min(areaH / box.h, Math.max(areaW / box.w, Math.min(areaW, PHONE_W) / NARROW_W)));
  const maxScroll = $derived(Math.max(0, box.w * u - areaW));
  let scrollX = $state<number | null>(null);
  const sx = $derived(scrollX === null ? maxScroll / 2 : Math.min(Math.max(0, scrollX), maxScroll));

  let area = $state<HTMLElement>();
  let panning = $state(false);
  $effect(() => {
    if (!area) return;
    return attachPan(area, {
      max: () => maxScroll,
      get: () => sx,
      set: (x) => (scrollX = x),
      onPanning: (on) => (panning = on),
    });
  });

  // Back to front, so each tile's side and shadow land under the neighbors that should cover them.
  const order = $derived(drawOrder(layout.slots).map((i) => ({ ...layout.slots[i], i })));

  $effect(() => saveJSON(STORAGE_KEY, game));

  function start(name: string) {
    if (isLayout(name)) deal(newGame(name));
  }

  function deal(next: typeof game) {
    game = next;
    scrollX = null; // a new deal opens centered
  }

  // A tap on a blocked tile gives it a little shake instead of doing nothing at all.
  let shaking = $state<number | null>(null);
  let shakeTimer: ReturnType<typeof setTimeout> | undefined;
  function tap(i: number) {
    if (!free(game, i)) {
      clearTimeout(shakeTimer);
      shaking = i;
      shakeTimer = setTimeout(() => (shaking = null), 300);
      return;
    }
    dispatch({ type: 'tap', slot: i });
  }
</script>

<TileFaces />

<GameScreen
  wide
  title="Mahjong"
  subtitle={layout.name}
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  inProgress={!game.done && game.history.length > 0}
  onstart={start}
  finished={game.done}
  onnext={() => deal(newGame(game.layout))}
>
  {#snippet status()}
    {#if !game.done}
      <span class="mj-count" aria-label="{tilesLeft} tiles left">
        <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2" width="9" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
        {tilesLeft}
      </span>
    {/if}
  {/snippet}
  {#snippet picker()}
    <div class="mj-layouts">
      {#each Object.entries(LAYOUTS) as [key, l] (key)}
        <button class={['btn', { current: key === game.layout }]} value={key}>
          <strong>{l.name}</strong><span>{l.slots.length} tiles</span>
        </button>
      {/each}
    </div>
  {/snippet}

  <div class={['board-area mj-area', { pannable: maxScroll > 0, panning }]} bind:this={area} bind:clientWidth={areaW} bind:clientHeight={areaH}>
    <div
      class="mj-board"
      style:width="{box.w * u}px"
      style:height="{box.h * u}px"
      style:--u="{u}px"
      style:translate="{maxScroll / 2 - sx}px 0"
      role="group"
      aria-label="Mahjong tiles"
    >
      {#each order as s (s.i)}
        {#if !game.gone[s.i]}
          <button
            type="button"
            class={['mj-tile', {
              blocked: !free(game, s.i),
              selected: game.selected === s.i,
              shake: shaking === s.i,
            }]}
            style:left="{((s.x * 1.5 + (box.maxZ - s.z) * LIFT) / box.w) * 100}%"
            style:top="{((s.y * 2 + (box.maxZ - s.z) * LIFT) / box.h) * 100}%"
            style:width="{(3 / box.w) * 100}%"
            style:height="{(4 / box.h) * 100}%"
            data-slot={s.i}
            aria-label="Tile"
            onclick={() => tap(s.i)}
            transition:scale={{ duration: 180, start: 0.7 }}
          >
            <svg viewBox="0 0 30 40" aria-hidden="true"><use href="#mj-k{game.kinds[s.i]}" /></svg>
          </button>
        {/if}
      {/each}
    </div>
  </div>

  {#if !game.done && moves === 0}
    <!-- Stuck: the only time Shuffle appears. -->
    <p class="status">No matching pairs are free.</p>
    <div class="tools">
      <button type="button" class="btn primary" onclick={() => dispatch({ type: 'shuffle' })}>Shuffle</button>
    </div>
  {/if}
</GameScreen>
