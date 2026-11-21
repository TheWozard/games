<!--
  A layout's shape from above, small, for the Customize dialog's list: every tile a block, each
  layer a little up and to the left of the one below and lighter, so the height shows. One path a
  layer. Drawn in the text color, or the accent in a picked Toggle.
-->
<script lang="ts">
  import type { Slot } from './logic';

  let { slots }: { slots: readonly Slot[] } = $props();

  // A half tile is 3 across and 4 down (a tile is 3 × 4); each layer up shifts 0.6 up and left.
  const HX = 3;
  const HY = 4;
  const LIFT = 0.6;
  const GAP = 0.5;

  const drawn = $derived.by(() => {
    const top = Math.max(...slots.map((s) => s.z));
    const layers = Array.from({ length: top + 1 }, () => '');
    for (const { x, y, z } of slots) {
      const left = x * HX - z * LIFT + GAP / 2;
      const up = y * HY - z * LIFT + GAP / 2;
      layers[z] += `M${left} ${up}h${2 * HX - GAP}v${2 * HY - GAP}h${-(2 * HX - GAP)}z`;
    }
    const minX = Math.min(...slots.map((s) => s.x * HX - s.z * LIFT));
    const minY = Math.min(...slots.map((s) => s.y * HY - s.z * LIFT));
    const maxX = Math.max(...slots.map((s) => (s.x + 2) * HX));
    const maxY = Math.max(...slots.map((s) => (s.y + 2) * HY));
    return {
      view: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
      // From 40% of the ink on the bottom layer to all of it on the top.
      layers: layers.map((d, z) => ({ d, ink: top ? 40 + (60 * z) / top : 100 })),
    };
  });
</script>

<svg class="mj-thumb" viewBox={drawn.view} aria-hidden="true">
  {#each drawn.layers as { d, ink }, z (z)}
    <path {d} style:fill="color-mix(in srgb, var(--thumb) {ink}%, var(--surface))" />
  {/each}
</svg>

<style>
  .mj-thumb { --thumb: var(--text); width: 84px; height: 48px; }
  :global(.btn.toggle[aria-pressed='true']) .mj-thumb { --thumb: var(--accent); }
</style>
