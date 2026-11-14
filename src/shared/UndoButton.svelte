<!-- Undo, for games that have it: in the header bar, just left of the New button. -->
<script lang="ts">
  import Undo2 from '@lucide/svelte/icons/undo-2';

  let { onclick, disabled = false }: { onclick: () => void; disabled?: boolean } = $props();
</script>

<button type="button" class="icon-btn" aria-label="Undo" title="Undo" {disabled} {onclick}>
  <Undo2 strokeWidth={2.2} aria-hidden="true" />
</button>
