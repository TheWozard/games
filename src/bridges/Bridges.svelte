<script lang="ts">
  import { untrack } from 'svelte';
  import Dialog from '../shared/Dialog.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { counts, edgesFor, isGame, newGame, reducer, settable, STORAGE_KEY, type Action, type Brush } from './game';
  import { DIFFICULTIES, isDifficulty } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('easy'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const edges = $derived(edgesFor(game).edges);
  const have = $derived(counts(game));
  const label = $derived(DIFFICULTIES[game.difficulty].label);
  const at = (i: number) => ({ x: game.islands[i].c + 0.5, y: game.islands[i].r + 0.5 });

  let askingNew = $state(false);
  let won = $state(false);

  $effect(() => saveJSON(STORAGE_KEY, game));

  let wasDone = untrack(() => game.done);
  $effect(() => {
    if (game.done && !wasDone) won = true;
    wasDone = game.done;
  });

  function start(difficulty: string) {
    if (isDifficulty(difficulty)) game = newGame(difficulty);
  }

  function onKey(e: KeyboardEvent) {
    if (document.querySelector('dialog[open]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      dispatch({ type: 'undo' });
    } else if (e.key === '0' || e.key === '1' || e.key === '2') {
      dispatch({ type: 'brush', brush: Number(e.key) as Brush });
    } else if (e.key === 'Escape' && game.selected !== null) {
      dispatch({ type: 'tapIsland', island: game.selected });
    }
  }
</script>

<svelte:document onkeydown={onKey} />

<header class="bar">
  <a class="back" href="../">‹ Games</a>
  <h1>Bridges <small>{label}</small></h1>
</header>

<main class="play">
  <svg
    class="bridges-board"
    viewBox="-0.25 -0.25 {game.cols + 0.5} {game.rows + 0.5}"
    style:--cols={game.cols}
    style:--rows={game.rows}
    role="group"
    aria-label="Bridges board"
  >
    <!-- Faint dots on every cell, to make rows and columns easy to follow. -->
    {#each { length: game.rows } as _, r (r)}
      {#each { length: game.cols } as _, c (c)}
        <circle class="dot" cx={c + 0.5} cy={r + 0.5} r="0.035" />
      {/each}
    {/each}

    <!-- Guides from the selected island to the islands a tap would change. -->
    {#if game.selected !== null}
      {#each edges as e, k (k)}
        {#if (e.a === game.selected || e.b === game.selected) && settable(game, k)}
          <line class="guide" x1={at(e.a).x} y1={at(e.a).y} x2={at(e.b).x} y2={at(e.b).y} />
        {/if}
      {/each}
    {/if}

    {#each edges as e, k (k)}
      {@const a = at(e.a)}
      {@const b = at(e.b)}
      {@const n = game.bridges[k]}
      {#if n === 1}
        <line class="bridge" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      {:else if n === 2}
        {@const dx = e.horizontal ? 0 : 0.1}
        {@const dy = e.horizontal ? 0.1 : 0}
        <line class="bridge" x1={a.x - dx} y1={a.y - dy} x2={b.x - dx} y2={b.y - dy} />
        <line class="bridge" x1={a.x + dx} y1={a.y + dy} x2={b.x + dx} y2={b.y + dy} />
      {/if}
      <!-- Wide invisible target: tap the gap between two islands to set its bridges. -->
      <line
        class="hit"
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        role="button"
        tabindex="-1"
        aria-label="Bridge between islands, {n} built"
        onclick={() => dispatch({ type: 'tapEdge', edge: k })}
        onkeydown={() => {}}
      />
    {/each}

    {#each game.islands as s, i (i)}
      <g
        class={['island', {
          selected: game.selected === i,
          full: have[i] === s.n,
          over: have[i] > s.n,
        }]}
        role="button"
        tabindex="-1"
        aria-label="Island {s.n}, {have[i]} bridges"
        onclick={() => dispatch({ type: 'tapIsland', island: i })}
        onkeydown={() => {}}
      >
        <circle class="hit-island" cx={s.c + 0.5} cy={s.r + 0.5} r="0.5" />
        <circle class="ring" cx={s.c + 0.5} cy={s.r + 0.5} r="0.37" />
        <text x={s.c + 0.5} y={s.r + 0.53}>{s.n}</text>
      </g>
    {/each}
  </svg>

  <div class="tools">
    <button type="button" class="btn" disabled={game.done || game.history.length === 0} onclick={() => dispatch({ type: 'undo' })}>Undo</button>
    <button type="button" class="btn" disabled={game.done || game.bridges.every((v) => v === 0)} onclick={() => dispatch({ type: 'clear' })}>Clear</button>
    <button type="button" class="btn" onclick={() => (askingNew = true)}>New</button>
  </div>
  <div class="tools choices" role="group" aria-label="Bridges a tap sets">
    {#each [0, 1, 2] as const as n (n)}
      <button
        type="button"
        class="btn choice"
        aria-pressed={game.brush === n}
        disabled={game.done}
        onclick={() => dispatch({ type: 'brush', brush: n })}
      >
        <svg viewBox="0 0 32 12" aria-hidden="true">
          {#if n === 0}
            <path d="M3 6h26" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" opacity="0.6" />
          {:else if n === 1}
            <path d="M3 6h26" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
          {:else}
            <path d="M3 3.5h26M3 8.5h26" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
          {/if}
        </svg>
        <span>{n === 0 ? 'None' : n === 1 ? 'Single' : 'Double'}</span>
      </button>
    {/each}
  </div>
  <p class="hint">Pick a bridge count, then tap between two islands (or one island, then another) to set it.</p>
</main>

<Dialog open={askingNew} onclose={(value) => { askingNew = false; start(value); }}>
  <h2>New game</h2>
  {#if !game.done && game.history.length > 0}<p>This replaces the game in progress.</p>{/if}
  {#each Object.entries(DIFFICULTIES) as [key, d] (key)}
    <button class="btn" value={key}>{d.label} · {d.cols}×{d.rows}</button>
  {/each}
  <button class="btn" value="">Cancel</button>
</Dialog>

<Dialog open={won} onclose={(value) => { won = false; if (value === 'new') askingNew = true; }}>
  <h2>Connected!</h2>
  <p>{label} puzzle complete.</p>
  <button class="btn primary" value="new">New game</button>
  <button class="btn" value="">Close</button>
</Dialog>
