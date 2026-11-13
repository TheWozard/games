<script lang="ts">
  import { scale } from 'svelte/transition';
  import GameScreen from '../shared/GameScreen.svelte';
  import { attachPan } from '../shared/pan';
  import { createShake } from '../shared/shake.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import TileFaces from './TileFaces.svelte';
  import { dealFrom, free, fromSaved, newGame, pairsLeft, poolOf, reducer, STORAGE_KEY, type Action } from './game';
  import { DIFFICULTIES, drawOrder, LAYOUTS, SLIM, type Difficulty, type LayoutName } from './logic';

  const anything = (_value: unknown): _value is unknown => true;
  let game = $state.raw(fromSaved(loadJSON(STORAGE_KEY, anything)) ?? newGame('pyramid'));
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

  // How hard a deal is: how often taking any free pair at random would still clear it (logic.ts).
  const LEVELS: Record<Difficulty, { label: string; detail: string }> = {
    easy: { label: 'Easy', detail: 'forgiving' },
    medium: { label: 'Medium', detail: 'a few traps' },
    hard: { label: 'Hard', detail: 'plan ahead' },
  };

  // The New dialog's picks, starting on the current game's: a difficulty, and any number of
  // layouts, a pool each deal takes one from at random (Play needs at least one). Play deals them.
  let chosen = $state<LayoutName[]>([]);
  let level = $state<Difficulty>('medium');
  function toggle(key: LayoutName) {
    if (!chosen.includes(key)) chosen = (Object.keys(LAYOUTS) as LayoutName[]).filter((k) => k === key || chosen.includes(k));
    else chosen = chosen.filter((k) => k !== key);
  }
  function start(value: string) {
    if (value === 'start' && chosen.length) deal(dealFrom(chosen, level, game.layout));
  }

  function deal(next: typeof game) {
    game = next;
    scrollX = null; // a new deal opens centered
  }

  // A tap on a blocked tile gives it a little shake instead of doing nothing at all.
  const shake = createShake<number>();
  function tap(i: number) {
    if (!free(game, i)) return shake.start(i);
    dispatch({ type: 'tap', slot: i });
  }
</script>

<TileFaces />

<GameScreen
  wide
  title="Mahjong"
  subtitle="{LEVELS[game.difficulty].label} · {layout.name}"
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  onopennew={() => ((chosen = poolOf(game)), (level = game.difficulty))}
  onstart={start}
  canPlay={chosen.length > 0}
  finished={game.done}
  onnext={() => deal(dealFrom(poolOf(game), game.difficulty, game.layout))}
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
    <h3 class="pick-title">Difficulty</h3>
    <div class="pick">
      {#each DIFFICULTIES as d (d)}
        <button type="button" class="btn" aria-pressed={level === d} onclick={() => (level = d)}>
          <strong>{LEVELS[d].label}</strong><span>{LEVELS[d].detail}</span>
        </button>
      {/each}
    </div>
    <div class="mj-layouts-head">
      <h3 class="pick-title">Layouts</h3>
      <button type="button" class="btn" onclick={() => (chosen = Object.keys(LAYOUTS) as LayoutName[])}>All</button>
      <!-- Just the ones that fit a phone upright, with no panning. -->
      <button type="button" class="btn" onclick={() => (chosen = [...SLIM])}>Slim</button>
      <button type="button" class="btn" onclick={() => (chosen = [])}>None</button>
    </div>
    <div class="mj-layouts">
      {#each Object.entries(LAYOUTS) as [key, l] (key)}
        <!-- Any number can be on, so each shows a check box (like the rules in other games). -->
        <button type="button" class="btn toggle" aria-pressed={chosen.includes(key as LayoutName)} onclick={() => toggle(key as LayoutName)}>
          <span class="check" aria-hidden="true">
            <svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </span>
          <span class="mj-layout-name"><strong>{l.name}</strong><span>{l.slots.length} tiles</span></span>
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
              shake: shake.current === s.i,
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
