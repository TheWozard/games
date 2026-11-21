<!--
  One group of choices in a New Game dialog: a .pick-title heading over a .pick row of Choice tiles
  (AGENTS.md, "New Game dialog"). `class` goes on the row, for a game's own columns.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, class: className, children }: { title: string; class?: string; children: Snippet } = $props();
</script>

<h3 class="pick-title">{title}</h3>
<div class={['pick', className]}>{@render children()}</div>
