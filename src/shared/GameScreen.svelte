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

  A setting that takes a while to make (`wait` for the one picked in the dialog, `nextWait` for the
  current one; see wait.ts) turns Play or Next orange, or red if it's likely over a second. If `onstart` or `onnext` returns a promise, its button
  shows a spinner until it settles, and the dialog stays open (and can't be closed) meanwhile.
-->
<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import X from '@lucide/svelte/icons/x';
  import type { Snippet } from 'svelte';
  import Dialog from './Dialog.svelte';
  import BackButton from './BackButton.svelte';
  import NewButton from './NewButton.svelte';
  import NextButton from './NextButton.svelte';
  import UndoButton from './UndoButton.svelte';
  import type { Wait } from './wait';

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
    /** Whether the picks make a game: Play is disabled while not (Mahjong with no layout picked). */
    canPlay?: boolean;
    /** Called as the New dialog opens, e.g. to start its picks from the current settings. */
    onopennew?: () => void;
    /** Starts the picked game; a returned promise means it's still being made. */
    onstart: (value: string) => unknown;
    /** Won, completed or lost: show Next. */
    finished: boolean;
    onnext: () => unknown;
    /** How long the setting picked in the New dialog takes to make: Play turns orange or red. */
    wait?: Wait;
    /** How long the current setting takes to make: Next turns orange or red. */
    nextWait?: Wait;
    /** Let the board use the full width of a big screen, not the usual centered column. */
    wide?: boolean;
    children: Snippet;
  }

  let {
    title, subtitle, status, onundo, canUndo = false, options = [], current,
    optionsTitle = 'Difficulty', picker, canPlay = true, onopennew, onstart, finished, onnext, wait = 'quick', nextWait = 'quick',
    wide = false, children,
  }: Props = $props();

  // Which button is waiting on a new game being made, if any.
  let busy = $state<'play' | 'next' | null>(null);

  function play(e: MouseEvent) {
    e.preventDefault(); // the dialog stays open until the game is ready
    if (busy || !canPlay) return;
    const made = onstart(picker ? 'start' : picked);
    if (!(made instanceof Promise)) {
      askingNew = false;
      return;
    }
    busy = 'play';
    made.finally(() => {
      busy = null;
      askingNew = false;
    });
  }

  function next() {
    if (busy) return;
    const made = onnext();
    if (made instanceof Promise) {
      busy = 'next';
      made.finally(() => (busy = null));
    }
  }

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

<NextButton show={finished} onclick={next} wait={nextWait} busy={busy === 'next'} />

<Dialog open={askingNew} locked={busy === 'play'} onclose={() => (askingNew = false)}>
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
  <!-- The form's first submit button, so Enter plays; it starts the game itself (see play). -->
  <button class={['btn primary new-start', wait]} aria-busy={busy === 'play'} disabled={!canPlay} onclick={play}>
    Play
    {#if busy === 'play'}
      <span class="spinner" aria-hidden="true"></span>
    {:else}
      <ChevronRight strokeWidth={2.4} aria-hidden="true" />
    {/if}
  </button>
  <!-- Drawn in the top corner. -->
  <button class="dialog-close" value="" aria-label="Close" disabled={busy === 'play'}>
    <X strokeWidth={2.4} aria-hidden="true" />
  </button>
</Dialog>
