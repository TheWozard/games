<!--
  The frame every game screen shares: the header bar (back, title and setting, an optional status,
  Undo, New), `<main class="play">` holding the game's own board and controls, the floating Next
  button once the game is over, and the New dialog (NewDialog.svelte). Ctrl/Cmd+Z undoes when the
  game has undo. GameScreen2.svelte is the next version, with the controls floating over the board
  and a menu in place of New; games are moving to it one at a time.

  A setting that takes a while to make (`nextWait` for the current one; see wait.ts) turns Next
  orange, or red if it's likely over a second. If `onnext` returns a promise, Next shows a spinner
  until it settles.
-->
<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import Undo2 from '@lucide/svelte/icons/undo-2';
  import type { Snippet } from 'svelte';
  import BackButton from './BackButton.svelte';
  import NewDialog, { type NewOptions } from './NewDialog.svelte';
  import NextButton from './NextButton.svelte';
  import IconButton from './ui/IconButton.svelte';
  import type { Wait } from './wait';

  interface Props extends NewOptions {
    canUndo?: boolean;
    children: Snippet;
    /** Won, completed or lost: show Next. */
    finished: boolean;
    /** How long the current setting takes to make: Next turns orange or red. */
    nextWait?: Wait;
    onnext: () => unknown;
    /** Called as the New dialog opens, e.g. to start its picks from the current settings. */
    onopennew?: () => void;
    /** Shows the Undo button (and Ctrl/Cmd+Z) for games that have undo. */
    onundo?: () => void;
    /** Header extras between the title and Undo, like a count of what's left. */
    status?: Snippet;
    /** The current setting, shown small under the title (the difficulty, layout...). */
    subtitle: string;
    title: string;
    /** Let the board use the full width of a big screen, not the usual centered column. */
    wide?: boolean;
  }

  let {
    title,
    subtitle,
    status,
    onundo,
    canUndo = false,
    onopennew,
    finished,
    onnext,
    nextWait = 'quick',
    wide = false,
    children,
    ...newOptions
  }: Props = $props();

  let askingNew = $state(false);
  let starting = $state(false); // Play is waiting on a new game being made
  let nexting = $state(false); // Next is

  function next() {
    if (nexting || starting) return;
    const made = onnext();
    if (made instanceof Promise) {
      nexting = true;
      void made.finally(() => (nexting = false));
    }
  }

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
  {#if onundo}<IconButton
      disabled={!canUndo}
      icon={Undo2}
      label="Undo"
      onclick={onundo}
      strokeWidth={2.2}
    />{/if}
  <IconButton icon={Plus} label="New Game" onclick={askNew} />
</header>

<main class={['play', { wide }]}>
  {@render children()}
</main>

<NextButton busy={nexting} onclick={next} show={finished} wait={nextWait} />

<NewDialog
  onclose={() => (askingNew = false)}
  open={askingNew}
  bind:busy={starting}
  {...newOptions}
/>
