<script lang="ts">
  import { flip } from 'svelte/animate';
  import Dialog from '../shared/Dialog.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { isGame, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import { DIFFICULTIES, isDifficulty, palette, toCss } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('easy'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const colors = $derived(palette(game.cols, game.rows, game.corners).map(toCss));
  const label = $derived(DIFFICULTIES[game.difficulty].label);

  let askingNew = $state(false);

  $effect(() => saveJSON(STORAGE_KEY, game));

  function start(difficulty: string) {
    if (isDifficulty(difficulty)) game = newGame(difficulty);
  }

  // Drag a tile onto another to swap them; a press that doesn't move is an ordinary tap.
  let dragFrom: number | null = null;
  let dragged = false;

  function pointerDown(e: PointerEvent, pos: number) {
    dragFrom = game.fixed[pos] ? null : pos;
    dragged = false;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  }

  function pointerUp(e: PointerEvent) {
    if (dragFrom === null) return;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-pos]');
    const to = target ? Number(target.dataset.pos) : null;
    if (to !== null && to !== dragFrom && !game.fixed[to]) {
      dragged = true;
      dispatch({ type: 'swap', from: dragFrom, to });
    }
    dragFrom = null;
  }

  function click(pos: number) {
    if (dragged) {
      dragged = false;
      return;
    }
    dispatch({ type: 'tap', pos });
  }

  function onKey(e: KeyboardEvent) {
    if (document.querySelector('dialog[open]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      dispatch({ type: 'undo' });
    }
  }
</script>

<svelte:document onkeydown={onKey} onpointerup={pointerUp} />

<header class="bar">
  <a class="back" href="../">‹ Games</a>
  <h1>Gradient <small>{label}</small></h1>
</header>

<main class="play">
  <div
    class={['gradient-board', { done: game.done }]}
    style:--cols={game.cols}
    style:--rows={game.rows}
    role="group"
    aria-label="Gradient tiles"
  >
    {#each game.order as id, pos (id)}
      <button
        type="button"
        class={['tile', { fixed: game.fixed[pos], selected: game.selected === pos }]}
        style:background={colors[id]}
        data-pos={pos}
        aria-label={game.fixed[pos] ? 'Fixed tile' : 'Tile'}
        aria-pressed={game.selected === pos}
        onpointerdown={(e) => pointerDown(e, pos)}
        onclick={() => click(pos)}
        animate:flip={{ duration: 260 }}
      ></button>
    {/each}
  </div>

  <div class="tools">
    <button type="button" class="btn" disabled={game.done || game.history.length === 0} onclick={() => dispatch({ type: 'undo' })}>Undo</button>
    <button type="button" class="btn" onclick={() => (askingNew = true)}>New</button>
  </div>

  {#if game.done}
    <div class="settled">
      <p>Settled in {game.history.length} {game.history.length === 1 ? 'swap' : 'swaps'}.</p>
      <button type="button" class="btn primary" onclick={() => start(game.difficulty)}>Next</button>
    </div>
  {:else}
    <p class="hint">Swap tiles (tap two, or drag one onto another) until the colours flow smoothly. Dotted tiles stay put.</p>
  {/if}
</main>

<Dialog open={askingNew} onclose={(value) => { askingNew = false; start(value); }}>
  <h2>New game</h2>
  {#each Object.entries(DIFFICULTIES) as [key, d] (key)}
    <button class="btn" value={key}>{d.label} · {d.cols}×{d.rows}</button>
  {/each}
  <button class="btn" value="">Cancel</button>
</Dialog>
