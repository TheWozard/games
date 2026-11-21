<!--
  A group of MenuItems in GameScreen2's menu, set apart from the next by a line, under an optional
  small heading. `tone: 'dev'` is the dev server's own section, in orange.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { title, tone, children }: { title?: string; tone?: 'dev'; children: Snippet } = $props();
</script>

<div class={['menu-section', tone]}>
  {#if title}<h3>{title}</h3>{/if}
  {@render children()}
</div>
