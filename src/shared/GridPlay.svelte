<!--
  The whole screen for a digit-grid game: header, board, Undo/Erase/Notes/New, number pad, the
  new-game and solved dialogs, keyboard controls and saving. A game supplies how to make and
  validate its state and how its board looks (`layout`); the moves come from grid.ts.
-->
<script lang="ts" module>
  import type { GridShape } from './grid';

  export interface GridLayout extends GridShape {
    /** Thick line on the cell's right / bottom edge (box or cage boundaries). */
    wallRight?: (i: number) => boolean;
    wallBottom?: (i: number) => boolean;
    /** A faint texture (0–4) marking the cell's zone, e.g. its cage. Touching zones should differ. */
    zone?: (i: number) => number;
    /** Small text in the cell's top-left corner (cage clues). */
    label?: (i: number) => string;
    /** Extra error highlighting beyond repeated digits (e.g. a full cage that doesn't add up). */
    error?: (i: number) => boolean;
  }
</script>

<script lang="ts" generics="G extends GridState">
  import { untrack } from 'svelte';
  import Dialog from './Dialog.svelte';
  import BackButton from './BackButton.svelte';
  import NewButton from './NewButton.svelte';
  import { toastOnFinish } from './finish.svelte';
  import UndoButton from './UndoButton.svelte';
  import { gridKeyAction, gridReducer, hasConflict, type GridAction, type GridState } from './grid';
  import { loadJSON, saveJSON } from './storage';
  import './grid.css';

  interface Props {
    title: string;
    storageKey: string;
    difficulties: Record<string, { label: string }>;
    isValid: (value: unknown) => value is G;
    create: (difficulty: string) => G;
    layout: (game: G) => GridLayout;
  }

  let { title, storageKey, difficulties, isValid, create, layout }: Props = $props();

  // The whole game is one immutable value; every move replaces it via the reducer in grid.ts.
  let game = $state.raw(untrack(() => loadJSON(storageKey, isValid) ?? create(Object.keys(difficulties)[0])));
  const shape = $derived(layout(game));
  const dispatch = (action: GridAction) => (game = gridReducer(game, action, shape));

  let askingNew = $state(false);

  const digits = $derived(Array.from({ length: shape.size }, (_, k) => k + 1));
  const selValue = $derived(game.selected === null ? 0 : game.values[game.selected]);
  const remaining = $derived(digits.map((d) => shape.size - game.values.filter((v) => v === d).length));

  // Save after every change (the reducer returns a new object only when something changed).
  $effect(() => saveJSON(storageKey, game));
  toastOnFinish(() => game.done, () => 'Solved.');

  function start(difficulty: string) {
    if (Object.hasOwn(difficulties, difficulty)) game = create(difficulty);
  }

  function onKey(e: KeyboardEvent) {
    if (document.querySelector('dialog[open]')) return;
    const action = gridKeyAction(e);
    if (!action) return;
    if (action.type !== 'toggleNotes') e.preventDefault();
    dispatch(action);
  }
</script>

<svelte:document onkeydown={onKey} />

<header class="bar">
  <BackButton />
  <h1>{title} <small>{difficulties[game.difficulty]?.label}</small></h1>
  <UndoButton disabled={game.done || game.history.length === 0} onclick={() => dispatch({ type: 'undo' })} />
  <NewButton onclick={() => (askingNew = true)} />
</header>

<main class="play">
  <div class="board-area">
    <div class="board grid-board" style:--n={shape.size} style:--note-cols={shape.size <= 4 ? 2 : 3} aria-label="{title} board">
      {#each game.values as v, i (i)}
        {@const r = Math.floor(i / shape.size)}
        {@const c = i % shape.size}
        {@const given = game.puzzle[i] !== 0}
        {@const mask = v ? 0 : game.notes[i]}
        {@const label = shape.label?.(i)}
        <button
          type="button"
          class={['cell', {
            'wall-r': shape.wallRight?.(i),
            'wall-b': shape.wallBottom?.(i),
            [`zone-${shape.zone?.(i)}`]: shape.zone !== undefined,
            given,
            selected: i === game.selected,
            peer: game.selected !== null && shape.peers[game.selected].includes(i),
            same: v !== 0 && v === selValue && i !== game.selected,
            conflict: !given && (hasConflict(game.values, shape.peers, i) || shape.error?.(i)),
          }]}
          aria-label="{label ? `${label}, ` : ''}row {r + 1}, column {c + 1}: {v || 'empty'}"
          onclick={() => dispatch({ type: 'select', index: i })}
        >
          {#if label}<span class="label">{label}</span>{/if}
          <span class="value">{v || ''}</span>
          <span class="notes">
            {#each digits as d (d)}<span>{mask & (1 << d) ? d : ''}</span>{/each}
          </span>
        </button>
      {/each}
    </div>
  </div>

  <div class="tools">
    <button type="button" class="btn" disabled={game.done} onclick={() => dispatch({ type: 'erase' })}>Erase</button>
    <button type="button" class="btn" aria-pressed={game.notesMode} onclick={() => dispatch({ type: 'toggleNotes' })}>Notes</button>
  </div>

  <div class={['pad', { 'notes-mode': game.notesMode }]} style:--n={shape.size}>
    {#each digits as d, k (d)}
      <button type="button" class={['digit', { complete: remaining[k] <= 0 }]} onclick={() => dispatch({ type: 'enter', digit: d })}>
        <span class="digit-n">{d}</span>
        <span class="digit-left">{remaining[k] > 0 ? remaining[k] : ''}</span>
      </button>
    {/each}
  </div>
</main>

<Dialog open={askingNew} onclose={(value) => { askingNew = false; start(value); }}>
  <h2>New game</h2>
  {#if !game.done && game.history.length > 0}<p>This replaces the game in progress.</p>{/if}
  {#each Object.entries(difficulties) as [key, { label }] (key)}
    <button class="btn" value={key}>{label}</button>
  {/each}
  <button class="btn" value="">Cancel</button>
</Dialog>
