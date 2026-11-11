<!--
  A floating "Next" button at the bottom of the screen, shown once a game is over (won, completed
  or lost). It starts a new puzzle with the same settings. Fixed, so it never makes the page scroll.
  Orange when that setting is slow to make, with a spinner while it's being made.
-->
<script lang="ts">
  import { fly } from 'svelte/transition';

  let { show, onclick, slow = false, busy = false }: { show: boolean; onclick: () => void; slow?: boolean; busy?: boolean } = $props();
</script>

{#if show}
  <button type="button" class={['btn primary next-fab', { slow }]} aria-busy={busy} {onclick} transition:fly={{ y: 24, duration: 200 }}>
    Next
    {#if busy}
      <span class="spinner" aria-hidden="true"></span>
    {:else}
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5L15.5 12 9 18.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
    {/if}
  </button>
{/if}
