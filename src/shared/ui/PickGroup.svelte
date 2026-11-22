<!--
  One group of choices in a New Game or Settings dialog: a .pick-title heading over a .pick row of
  Choice tiles, one darker segmented strip with the picked one lit up in it (the highlight slides
  between them: slide.ts) (AGENTS.md, "New Game
  dialog"). `class` goes on the row, for a game's own columns.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { slidePick } from './slide';

  let {
    title,
    class: className,
    children,
  }: { children: Snippet; class?: string; title: string } = $props();
</script>

<h3 class="pick-title">{title}</h3>
<div class={['pick', className]} {@attach slidePick}>{@render children()}</div>
