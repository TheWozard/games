<script lang="ts">
  import { scale } from 'svelte/transition';
  import Dialog from '../shared/Dialog.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import TileFaces from './TileFaces.svelte';
  import { free, isGame, newGame, pairsLeft, reducer, STORAGE_KEY, type Action } from './game';
  import { isLayout, LAYOUTS } from './logic';

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

  // Draw back to front: lower layers first, then top to bottom, left to right.
  const order = $derived(
    layout.slots
      .map((s, i) => ({ ...s, i }))
      .sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x),
  );

  let askingNew = $state(false);

  $effect(() => saveJSON(STORAGE_KEY, { ...game, hint: null }));

  function start(name: string) {
    if (isLayout(name)) game = newGame(name);
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
    const before = game;
    dispatch({ type: 'tap', slot: i });
    if (game.gone.filter(Boolean).length > before.gone.filter(Boolean).length) navigator.vibrate?.(12);
  }

  function onKey(e: KeyboardEvent) {
    if (document.querySelector('dialog[open]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      dispatch({ type: 'undo' });
    } else if (e.key === 'h' || e.key === 'H') {
      dispatch({ type: 'hint' });
    }
  }
</script>

<svelte:document onkeydown={onKey} />

<TileFaces />

<header class="bar">
  <a class="back" href="../">‹ Games</a>
  <h1>Mahjong <small>{layout.name}</small></h1>
  {#if !game.done}<span class="mj-count">{tilesLeft} left</span>{/if}
</header>

<main class="play">
  <div class="mj-board" style:--w={box.w} style:--h={box.h} role="group" aria-label="Mahjong tiles">
    {#each order as s (s.i)}
      {#if !game.gone[s.i]}
        <button
          type="button"
          class={['mj-tile', {
            blocked: !free(game, s.i),
            selected: game.selected === s.i,
            hint: game.hint?.includes(s.i),
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

  <div class="tools">
    <button type="button" class="btn" disabled={game.done || game.history.length === 0} onclick={() => dispatch({ type: 'undo' })}>Undo</button>
    <button type="button" class="btn" disabled={game.done || moves === 0} onclick={() => dispatch({ type: 'hint' })}>Hint</button>
    <button type="button" class={['btn', { primary: !game.done && moves === 0 }]} disabled={game.done} onclick={() => dispatch({ type: 'shuffle' })}>Shuffle</button>
    <button type="button" class="btn" onclick={() => (askingNew = true)}>New</button>
  </div>

  {#if game.done}
    <div class="settled">
      <p>Cleared.</p>
      <button type="button" class="btn primary" onclick={() => start(game.layout)}>Next</button>
    </div>
  {:else if moves === 0}
    <p class="hint">No matching pairs are free. Shuffle to mix up the tiles that are left.</p>
  {:else}
    <p class="hint">Match pairs of free tiles: nothing on top, and open on the left or right. {moves} {moves === 1 ? 'match' : 'matches'} available.</p>
  {/if}
</main>

<Dialog open={askingNew} onclose={(value) => { askingNew = false; start(value); }}>
  <h2>New game</h2>
  <div class="mj-layouts">
    {#each Object.entries(LAYOUTS) as [key, l] (key)}
      <button class={['btn', { current: key === game.layout }]} value={key}>
        <strong>{l.name}</strong><span>{l.slots.length} tiles</span>
      </button>
    {/each}
  </div>
  <button class="btn" value="">Cancel</button>
</Dialog>
