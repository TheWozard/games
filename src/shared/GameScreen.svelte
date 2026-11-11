<!--
  The frame every game screen shares: the header bar (back, title and setting, an optional status,
  Undo, New), `<main class="play">` holding the game's own board and controls, the floating Next
  button once the game is over, and the New dialog. Ctrl/Cmd+Z undoes when the game has undo.

  The New Game dialog only sets things up; Play, at the bottom, starts the new game. It shows
  `options` as one group of tiles under the heading `optionsTitle` (one per setting, starting on
  `current`), and Play calls `onstart` with the one picked. Games with several settings render a
  `picker` snippet of their own groups instead (same look: .pick-title headings over .pick rows of
  aria-pressed tiles), and Play calls `onstart('start')`. The × in the top corner, Escape and the
  backdrop close it without starting anything. Conventions: AGENTS.md, "New Game dialog".
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
    /** New Game choices, one tile each (a name, and an optional detail line), starting on `current`... */
    options?: { value: string; label: string; detail?: string }[];
    current?: string;
    /** The heading over `options`. */
    optionsTitle?: string;
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
    title, subtitle, status, onundo, canUndo = false, options = [], current,
    optionsTitle = 'Difficulty', picker, onopennew, onstart, finished, onnext, wide = false, children,
  }: Props = $props();

  let askingNew = $state(false);
  let picked = $state('');

  function askNew() {
    onopennew?.();
    picked = options.some((o) => o.value === current) ? current! : (options[0]?.value ?? '');
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
  <h2>New Game</h2>
  {#if picker}
    {@render picker()}
  {:else}
    <h3 class="pick-title">{optionsTitle}</h3>
    <div class="pick">
      {#each options as { value, label, detail } (value)}
        <button type="button" class="btn" aria-pressed={picked === value} onclick={() => (picked = value)}>
          <strong>{label}</strong>{#if detail}<span>{detail}</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
  <button class="btn primary new-start" value={picker ? 'start' : picked}>Play</button>
  <!-- Last in the form, so Enter starts rather than closes; drawn in the top corner. -->
  <button class="dialog-close" value="" aria-label="Close">
    <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
  </button>
</Dialog>
