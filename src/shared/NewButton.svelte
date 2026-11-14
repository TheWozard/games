<!-- The "new game" button every game has, at the right of the header bar. -->
<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';

  let { onclick }: { onclick: () => void } = $props();
</script>

<button type="button" class="icon-btn" aria-label="New Game" title="New Game" {onclick}>
  <Plus strokeWidth={2.4} aria-hidden="true" />
</button>
