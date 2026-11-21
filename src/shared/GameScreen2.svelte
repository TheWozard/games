<!--
  Version 2 of the frame a game screen sits in (games move to it from GameScreen one at a time;
  Mahjong first). Three layers:

  1. The header bar, a fixed height: back to the launcher, the title with its setting beneath,
     an optional status, Undo if the game has undo, and the menu (☰) last on the right.
  2. The stage (`<main class="stage">`): everything below the header, fixed and never scrolling,
     holding only the game board (`children`).
  3. The control layer, floating over the stage: the game's `controls`, at the bottom. Only the
     controls themselves take taps; the rest of the layer lets them through to the board.

  The menu opens under its button. It starts with New Game (the New dialog, NewDialog.svelte), then
  the game's own `menu` sections, then (in the dev server only, never in a build) its `dev`
  entries under a Dev heading: shortcuts for checking a screen, like winning at once. It ends with Copy Seed, which copies `puzzle`: what the puzzle
  being played is (a seed, an id, an index, a version: whatever makes it again).
  Buttons in the menu close it as they're tapped.

  Next floats at the bottom once the game is over. Ctrl/Cmd+Z undoes when the game has undo.
-->
<script lang="ts">
  import Undo2 from '@lucide/svelte/icons/undo-2';
  import MenuIcon from '@lucide/svelte/icons/menu';
  import Plus from '@lucide/svelte/icons/plus';
  import type { Snippet } from 'svelte';
  import BackButton from './BackButton.svelte';
  import Dialog from './Dialog.svelte';
  import NewDialog, { type NewOptions } from './NewDialog.svelte';
  import NextButton from './NextButton.svelte';
  import IconButton from './ui/IconButton.svelte';
  import MenuItem from './ui/MenuItem.svelte';
  import MenuPuzzle from './ui/MenuPuzzle.svelte';
  import MenuSection from './ui/MenuSection.svelte';
  import type { Wait } from './wait';

  interface Props extends NewOptions {
    title: string;
    /** The current setting, shown small under the title (the difficulty, layout...). */
    subtitle: string;
    /** Header extras between the title and Undo, like a count of what's left. */
    status?: Snippet;
    /** Shows the Undo button (and Ctrl/Cmd+Z) for games that have undo. */
    onundo?: () => void;
    canUndo?: boolean;
    /** The game's own sections of the menu, between New Game and Copy Seed. */
    menu?: Snippet;
    /** Menu entries for the dev server only (`just dev`), left out of a build: MenuItems (ui/MenuItem.svelte). */
    dev?: Snippet;
    /** What the puzzle being played is (seed, id, index, version): the menu's last entry, Copy Seed, copies it. */
    puzzle?: string;
    /** Called as the New dialog opens, e.g. to start its picks from the current settings. */
    onopennew?: () => void;
    /** Won, completed or lost: show Next. */
    finished: boolean;
    onnext: () => unknown;
    /** How long the current setting takes to make: Next turns orange or red. */
    nextWait?: Wait;
    /** The game's controls, floating over the bottom of the board. */
    controls?: Snippet;
    /** The game board: the stage's only content. */
    children: Snippet;
  }

  let {
    title, subtitle, status, onundo, canUndo = false, menu, dev, puzzle, onopennew, finished, onnext,
    nextWait = 'quick', controls, children, ...newOptions
  }: Props = $props();

  let menuOpen = $state(false);
  let askingNew = $state(false);
  let starting = $state(false); // Play is waiting on a new game being made
  let nexting = $state(false); // Next is

  function next() {
    if (nexting || starting) return;
    const made = onnext();
    if (made instanceof Promise) {
      nexting = true;
      made.finally(() => (nexting = false));
    }
  }

  function closeMenu(value: string) {
    menuOpen = false;
    if (value === 'new') {
      onopennew?.();
      askingNew = true;
    }
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

<header class="bar screen-bar">
  <BackButton />
  <h1>{title} <small>{subtitle}</small></h1>
  {@render status?.()}
  {#if onundo}<IconButton icon={Undo2} strokeWidth={2.2} label="Undo" disabled={!canUndo} onclick={onundo} />{/if}
  <IconButton icon={MenuIcon} label="Menu" aria-haspopup="dialog" aria-expanded={menuOpen} onclick={() => (menuOpen = true)} />
</header>

<main class="stage">
  {@render children()}
  <div class="control-layer">
    {@render controls?.()}
  </div>
</main>

<NextButton show={finished} onclick={next} wait={nextWait} busy={nexting} />

<Dialog class="game-menu" label="Menu" open={menuOpen} onclose={closeMenu}>
  <MenuSection>
    <MenuItem icon={Plus} label="New Game" value="new" />
  </MenuSection>
  {@render menu?.()}
  {#if import.meta.env.DEV && dev}
    <MenuSection title="Dev" tone="dev">{@render dev()}</MenuSection>
  {/if}
  {#if puzzle}
    <MenuPuzzle {puzzle} />
  {/if}
</Dialog>

<NewDialog open={askingNew} bind:busy={starting} onclose={() => (askingNew = false)} {...newOptions} />
