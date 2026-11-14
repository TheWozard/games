<!--
  A floating "Next" button at the bottom of the screen, shown once a game is over (won, completed
  or lost). It starts a new puzzle with the same settings. Fixed, so it never makes the page scroll.
  Orange or red when that setting is slow to make (wait.ts), with a spinner while it's being made.
-->
<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { fly } from 'svelte/transition';

  import type { Wait } from './wait';

  let { show, onclick, wait = 'quick', busy = false }: { show: boolean; onclick: () => void; wait?: Wait; busy?: boolean } = $props();
</script>

{#if show}
  <button type="button" class={['btn primary next-fab', wait]} aria-busy={busy} {onclick} transition:fly={{ y: 24, duration: 200 }}>
    Next
    {#if busy}
      <span class="spinner" aria-hidden="true"></span>
    {:else}
      <ChevronRight strokeWidth={2.4} aria-hidden="true" />
    {/if}
  </button>
{/if}
