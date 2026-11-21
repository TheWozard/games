<!--
  Version 2 of the frame a game screen sits in (games move to it from GameScreen one at a time;
  Mahjong first). Three layers:

  1. The header bar, a fixed height: back to the launcher, the title with its setting beneath,
     an optional status, Undo if the game has undo, and the menu (☰) last on the right.
  2. The stage (`<main class="stage">`): everything below the header, fixed and never scrolling,
     holding only the game board (`children`). With a `board` size, the board is drawn at that
     size (zoom 1: comfortable to play at, never shrunk to start with) and the stage pans and zooms
     it (ZoomStage.svelte: drag, pinch, wheel); `stageWidth` / `stageHeight` give the space, for a
     game that sizes its board from it. Without one, the board lays itself out in the space.
  3. The control layer, floating over the stage: the game's `controls`, at the bottom. Only the
     controls themselves take taps; the rest of the layer lets them through to the board.

  The menu opens under its button, and its buttons close it as they're tapped. From the top:
  - New Game (the New dialog, NewDialog.svelte) and, if the game has `settings`, Settings: a dialog
    like New Game (PickGroups of Choices for how the game looks) but with no Play, since each tap
    is saved and shown at once; the × closes it.
  - The game's own `menu` sections.
  - In the dev server only (never in a build), its `dev` entries, with orange icons: shortcuts
    for checking a screen, like winning at once.
  - Last, Game Details, which copies `puzzle`: what the puzzle being played is (a seed, an id, an
    index, a version: whatever makes it again). It leaves the menu open.

  Next floats at the bottom once the game is over. Ctrl/Cmd+Z undoes when the game has undo.
-->
<script lang="ts">
  import Undo2 from '@lucide/svelte/icons/undo-2';
  import MenuIcon from '@lucide/svelte/icons/menu';
  import Plus from '@lucide/svelte/icons/plus';
  import X from '@lucide/svelte/icons/x';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import type { Snippet } from 'svelte';
  import BackButton from './BackButton.svelte';
  import Dialog from './Dialog.svelte';
  import NewDialog, { type NewOptions } from './NewDialog.svelte';
  import NextButton from './NextButton.svelte';
  import ZoomStage from './ZoomStage.svelte';
  import type { Size } from './zoom';
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
    /** The game's own sections of the menu, between New Game and Game Details. */
    menu?: Snippet;
    /** The Settings dialog's content: PickGroups of Choices for how the game looks, each taking effect as it's tapped. */
    settings?: Snippet;
    /** Menu entries for the dev server only (`just dev`), left out of a build: MenuItems (ui/MenuItem.svelte). */
    dev?: Snippet;
    /** What the puzzle being played is (seed, id, index, version): the menu's last entry, Game Details, copies it. */
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
    /** The board's size at zoom 1, in pixels: the stage then pans and zooms it. */
    board?: Size;
    /** Changes for a new board (a new deal), so it opens on the starting view even at the same size. */
    boardKey?: unknown;
    /** The stage's size (bindable), for a game that sizes its board from it. */
    stageWidth?: number;
    stageHeight?: number;
    /** The game board: the stage's only content. */
    children: Snippet;
  }

  let {
    title, subtitle, status, onundo, canUndo = false, menu, settings, dev, puzzle, onopennew, finished, onnext,
    nextWait = 'quick', controls, board, boardKey, stageWidth = $bindable(0), stageHeight = $bindable(0), children, ...newOptions
  }: Props = $props();

  let menuOpen = $state(false);
  let askingNew = $state(false);
  let showingSettings = $state(false);
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
    } else if (value === 'settings') {
      showingSettings = true;
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
  {#if board}
    <ZoomStage {board} key={boardKey} bind:width={stageWidth} bind:height={stageHeight}>{@render children()}</ZoomStage>
  {:else}
    {@render children()}
  {/if}
  <div class="control-layer">
    {@render controls?.()}
  </div>
</main>

<NextButton show={finished} onclick={next} wait={nextWait} busy={nexting} />

<Dialog class="game-menu" label="Menu" open={menuOpen} onclose={closeMenu}>
  <MenuSection>
    <MenuItem icon={Plus} label="New Game" value="new" />
    {#if settings}<MenuItem icon={SettingsIcon} label="Settings" value="settings" />{/if}
  </MenuSection>
  {@render menu?.()}
  {#if import.meta.env.DEV && dev}
    <MenuSection tone="dev">{@render dev()}</MenuSection>
  {/if}
  {#if puzzle}
    <MenuPuzzle {puzzle} />
  {/if}
</Dialog>

{#if settings}
  <Dialog open={showingSettings} onclose={() => (showingSettings = false)}>
    <h2>Settings</h2>
    {@render settings()}
    <!-- Drawn in the top corner. -->
    <button class="dialog-close" value="" aria-label="Close">
      <X strokeWidth={2.4} aria-hidden="true" />
    </button>
  </Dialog>
{/if}

<NewDialog open={askingNew} bind:busy={starting} onclose={() => (askingNew = false)} {...newOptions} />
