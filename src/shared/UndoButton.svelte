<!-- Undo, for games that have it: in the header bar, just left of the New button. -->
<script lang="ts">
  let { onclick, disabled = false }: { onclick: () => void; disabled?: boolean } = $props();
</script>

<button type="button" class="icon-btn" aria-label="Undo" title="Undo" {disabled} {onclick}>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 6L4.5 10.5 9 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M5 10.5h8.5a5.5 5.5 0 0 1 0 11H11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
  </svg>
</button>
