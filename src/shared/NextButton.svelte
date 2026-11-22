<!--
  A floating "Next" button at the bottom of the screen, shown once a game is over (won, completed
  or lost). It starts a new puzzle with the same settings. Fixed, so it never makes the page scroll.
  Orange or red when that setting is slow to make (wait.ts), with a spinner while it's being made.
-->
<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { fly } from 'svelte/transition';
  import type { Wait } from './wait';

  let {
    show,
    onclick,
    wait = 'quick',
    busy = false,
  }: { busy?: boolean; onclick: () => void; show: boolean; wait?: Wait } = $props();
</script>

{#if show}
  <button
    class={['btn primary next-fab', wait]}
    aria-busy={busy}
    {onclick}
    type="button"
    transition:fly={{ y: 24, duration: 200 }}
  >
    Next
    {#if busy}
      <span class="spinner" aria-hidden="true"></span>
    {:else}
      <ChevronRight aria-hidden="true" strokeWidth={2.4} />
    {/if}
  </button>
{/if}
