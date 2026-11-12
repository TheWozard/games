<!-- The note marks the shading games share, drawn in cell units at a cell's top left: an X or a dot. -->
<script lang="ts">
  let { kind, x, y }: { kind: 'x' | 'dot'; x: number; y: number } = $props();
</script>

{#if kind === 'x'}
  <path class="note-x" d="M{x + 0.36} {y + 0.36}l0.28 0.28M{x + 0.64} {y + 0.36}l-0.28 0.28" />
{:else}
  <circle class="note-dot" cx={x + 0.5} cy={y + 0.5} r="0.09" />
{/if}
