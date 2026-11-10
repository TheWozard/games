<!-- The "new game" button every game has, at the right of the header bar. -->
<script lang="ts">
  let { onclick }: { onclick: () => void } = $props();
</script>

<button type="button" class="icon-btn" aria-label="New game" title="New game" {onclick}>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
  </svg>
</button>
