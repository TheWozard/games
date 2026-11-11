<!--
  The frame every game screen shares: the header bar (back, title and setting, an optional status,
  Undo, New), `<main class="play">` holding the game's own board and controls, the floating Next
  button once the game is over, and the New dialog. Ctrl/Cmd+Z undoes when the game has undo.

  The New dialog lists `options` (one button per setting), or renders a `picker` snippet for games
  with several settings to choose (its buttons close the dialog with their `value`). Either way,
  `onstart` gets the chosen value; Cancel and dismissing the dialog don't call it.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Dialog from './Dialog.svelte';
  import BackButton from './BackButton.svelte';
  import NewButton from './NewButton.svelte';
  import NextButton from './NextButton.svelte';
  import UndoButton from './UndoButton.svelte';

  interface Props {
    title: string;
    /** The current setting, shown small under the title (the difficulty, layout...). */
    subtitle: string;
    /** Header extras between the title and Undo, like a count of what's left. */
    status?: Snippet;
    /** Shows the Undo button (and Ctrl/Cmd+Z) for games that have undo. */
    onundo?: () => void;
    canUndo?: boolean;
    /** The New dialog warns that starting over replaces this game. */
    inProgress: boolean;
    /** New dialog choices, one button each... */
    options?: { value: string; label: string }[];
    /** ...or the dialog's own content, for games with several settings to pick. */
    picker?: Snippet;
    /** Called as the New dialog opens, e.g. to start its picks from the current settings. */
    onopennew?: () => void;
    onstart: (value: string) => void;
    /** Won, completed or lost: show Next. */
    finished: boolean;
    onnext: () => void;
    /** Let the board use the full width of a big screen, not the usual centered column. */
    wide?: boolean;
    children: Snippet;
  }

  let {
    title, subtitle, status, onundo, canUndo = false, inProgress, options = [], picker,
    onopennew, onstart, finished, onnext, wide = false, children,
  }: Props = $props();

  let askingNew = $state(false);

  function askNew() {
    onopennew?.();
    askingNew = true;
  }

  function onKey(e: KeyboardEvent) {
    if (!onundo || document.querySelector('dialog[open]')) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      onundo();
    }
  }
</script>

<svelte:document onkeydown={onKey} />

<header class="bar">
  <BackButton />
  <h1>{title} <small>{subtitle}</small></h1>
  {@render status?.()}
  {#if onundo}<UndoButton disabled={!canUndo} onclick={onundo} />{/if}
  <NewButton onclick={askNew} />
</header>

<main class={['play', { wide }]}>
  {@render children()}
</main>

<NextButton show={finished} onclick={onnext} />

<Dialog open={askingNew} onclose={(value) => { askingNew = false; if (value) onstart(value); }}>
  <h2>New game</h2>
  {#if inProgress}<p>This replaces the game in progress.</p>{/if}
  {#if picker}
    {@render picker()}
  {:else}
    {#each options as { value, label } (value)}
      <button class="btn" {value}>{label}</button>
    {/each}
  {/if}
  <button class="btn" value="">Cancel</button>
</Dialog>
