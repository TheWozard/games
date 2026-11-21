<!--
  A group of MenuItems in GameScreen2's menu, set apart from the next by a line; no heading.
  `tone: 'dev'` is the dev server's own section, its icons in orange.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { tone, children }: { tone?: 'dev'; children: Snippet } = $props();
</script>

<div class={['menu-section', tone]}>
  {@render children()}
</div>
