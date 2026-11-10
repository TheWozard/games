<script lang="ts">
  import { untrack } from 'svelte';
  import Dialog from '../shared/Dialog.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { isGame, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import { colOf, DIFFICULTIES, hasConflict, isDifficulty, PEERS, rowOf } from './logic';

  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const ARROWS: Record<string, [number, number]> = {
    ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
  };

  // The whole game is one immutable value; every move replaces it via the reducer in game.ts.
  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('easy'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  let askingNew = $state(false);
  let won = $state(false);

  const selValue = $derived(game.selected === null ? 0 : game.values[game.selected]);
  const remaining = $derived(DIGITS.map((d) => 9 - game.values.filter((v) => v === d).length));

  // Save after every change (the reducer returns a new object only when something changed).
  $effect(() => saveJSON(STORAGE_KEY, game));

  // Celebrate when a game becomes solved (not when a finished game is reloaded).
  let wasDone = untrack(() => game.done);
  $effect(() => {
    if (game.done && !wasDone) won = true;
    wasDone = game.done;
  });

  const dialogOpen = () => document.querySelector('dialog[open]') !== null;

  function start(difficulty: string) {
    if (isDifficulty(difficulty)) game = newGame(difficulty);
  }

  function onKey(e: KeyboardEvent) {
    if (dialogOpen()) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      dispatch({ type: 'undo' });
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const arrow = ARROWS[e.key];
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      dispatch({ type: 'enter', digit: Number(e.key) });
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      e.preventDefault();
      dispatch({ type: 'erase' });
    } else if (e.key === 'n' || e.key === 'N') {
      dispatch({ type: 'toggleNotes' });
    } else if (arrow) {
      e.preventDefault();
      dispatch({ type: 'move', dr: arrow[0], dc: arrow[1] });
    }
  }
</script>

<svelte:document onkeydown={onKey} />

<header class="bar">
  <a class="back" href="../">‹ Games</a>
  <h1>Sudoku <small>{DIFFICULTIES[game.difficulty].label}</small></h1>
</header>

<main class="sudoku">
  <div class="board" aria-label="Sudoku board">
    {#each game.values as v, i (i)}
      {@const r = rowOf(i)}
      {@const c = colOf(i)}
      {@const given = game.puzzle[i] !== 0}
      {@const mask = v ? 0 : game.notes[i]}
      <button
        type="button"
        class={['cell', {
          'box-r': c === 2 || c === 5,
          'box-b': r === 2 || r === 5,
          'edge-r': c === 8,
          'edge-b': r === 8,
          given,
          selected: i === game.selected,
          peer: game.selected !== null && PEERS[game.selected].includes(i),
          same: v !== 0 && v === selValue && i !== game.selected,
          conflict: !given && hasConflict(game.values, i),
        }]}
        aria-label="Row {r + 1}, column {c + 1}: {v || 'empty'}"
        onclick={() => dispatch({ type: 'select', index: i })}
      >
        <span>{v || ''}</span>
        <span class="notes">
          {#each DIGITS as d (d)}<span>{mask & (1 << d) ? d : ''}</span>{/each}
        </span>
      </button>
    {/each}
  </div>

  <div class="tools">
    <button type="button" class="btn" disabled={game.done || game.history.length === 0} onclick={() => dispatch({ type: 'undo' })}>Undo</button>
    <button type="button" class="btn" disabled={game.done} onclick={() => dispatch({ type: 'erase' })}>Erase</button>
    <button type="button" class="btn" aria-pressed={game.notesMode} onclick={() => dispatch({ type: 'toggleNotes' })}>Notes</button>
    <button type="button" class="btn" onclick={() => (askingNew = true)}>New</button>
  </div>

  <div class={['pad', { 'notes-mode': game.notesMode }]}>
    {#each DIGITS as d, k (d)}
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
  {#each Object.entries(DIFFICULTIES) as [key, { label }] (key)}
    <button class="btn" value={key}>{label}</button>
  {/each}
  <button class="btn" value="">Cancel</button>
</Dialog>

<Dialog open={won} onclose={(value) => { won = false; if (value === 'new') askingNew = true; }}>
  <h2>Solved!</h2>
  <p>{DIFFICULTIES[game.difficulty].label} puzzle complete.</p>
  <button class="btn primary" value="new">New game</button>
  <button class="btn" value="">Close</button>
</Dialog>
