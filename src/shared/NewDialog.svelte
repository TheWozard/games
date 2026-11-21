<!--
  The New Game dialog every game has (GameScreen and GameScreen2 open it). It only sets things up;
  Play, at the bottom, starts the new game. It shows `options` as one group of tiles under the
  heading `optionsTitle` (one per setting, starting on `current`), and Play calls `onstart` with the
  one picked. Games with several settings render a `picker` snippet of their own groups instead
  (same look: .pick-title headings over .pick rows of aria-pressed tiles), and Play calls
  `onstart('start')`. The × in the top corner, Escape and the backdrop close it without starting
  anything. Conventions: AGENTS.md, "New Game dialog".

  A setting that takes a while to make (`wait`, see wait.ts) turns Play orange, or red if it's
  likely over a second. If `onstart` returns a promise, Play shows a spinner until it settles, and
  the dialog stays open (and can't be closed) meanwhile.
-->
<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import X from '@lucide/svelte/icons/x';
  import { untrack, type Snippet } from 'svelte';
  import Dialog from './Dialog.svelte';
  import Choice from './ui/Choice.svelte';
  import PickGroup from './ui/PickGroup.svelte';
  import type { Wait } from './wait';

  export interface NewOptions {
    /** New Game choices, one tile each (a name, and an optional detail line), starting on `current`... */
    options?: { value: string; label: string; detail?: string }[];
    current?: string;
    /** The heading over `options`. */
    optionsTitle?: string;
    /** ...or the dialog's own content, for games with several settings to pick. */
    picker?: Snippet;
    /** Whether the picks make a game: Play is disabled while not (Mahjong with no layout picked). */
    canPlay?: boolean;
    /** Starts the picked game; a returned promise means it's still being made. */
    onstart: (value: string) => unknown;
    /** How long the setting picked takes to make: Play turns orange or red. */
    wait?: Wait;
  }

  interface Props extends NewOptions {
    open: boolean;
    onclose: () => void;
    /** The dialog's title: GameScreen2 calls it Customize, since its menu's New starts one. */
    title?: string;
    /** Whether a new game is being made: true from Play until it's ready. */
    busy?: boolean;
  }

  let {
    open,
    onclose,
    title = 'New Game',
    busy = $bindable(false),
    options = [],
    current,
    optionsTitle = 'Difficulty',
    picker,
    canPlay = true,
    onstart,
    wait = 'quick',
  }: Props = $props();

  let picked = $state('');
  // Each time it opens, start on the current setting.
  $effect.pre(() => {
    if (!open) return;
    untrack(
      () =>
        (picked = options.some((o) => o.value === current) ? current! : (options[0]?.value ?? '')),
    );
  });

  function play(e: MouseEvent) {
    e.preventDefault(); // the dialog stays open until the game is ready
    if (busy || !canPlay) return;
    const made = onstart(picker ? 'start' : picked);
    if (!(made instanceof Promise)) return onclose();
    busy = true;
    void made.finally(() => {
      busy = false;
      onclose();
    });
  }
</script>

<Dialog {open} locked={busy} {onclose}>
  <h2>{title}</h2>
  {#if picker}
    {@render picker()}
  {:else}
    <PickGroup title={optionsTitle}>
      {#each options as { value, label, detail } (value)}
        <Choice {label} {detail} pressed={picked === value} onclick={() => (picked = value)} />
      {/each}
    </PickGroup>
  {/if}
  <!-- The form's first submit button, so Enter plays; it starts the game itself (see play). -->
  <button
    class={['btn primary new-start', wait]}
    aria-busy={busy}
    disabled={!canPlay}
    onclick={play}
  >
    Play
    {#if busy}
      <span class="spinner" aria-hidden="true"></span>
    {:else}
      <ChevronRight strokeWidth={2.4} aria-hidden="true" />
    {/if}
  </button>
  <!-- Drawn in the top corner. -->
  <button class="dialog-close" value="" aria-label="Close" disabled={busy}>
    <X strokeWidth={2.4} aria-hidden="true" />
  </button>
</Dialog>
