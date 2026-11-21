<!--
  What's inside a tile (.mj-tile): its body (face, ivory edge, green back; body.ts) and a face
  symbol from TileFaces.svelte, with an optional second symbol laid over it.
-->
<script lang="ts">
  import { DEPTH, H, R, SIDE, W } from './body';

  let { href, overlay = '' }: { href: string; overlay?: string } = $props();
</script>

<svg class="mj-body" viewBox="0 0 {W + DEPTH} {H + DEPTH}" aria-hidden="true">
  <path class="mj-back" d={SIDE.back} />
  <path class="mj-edge" d={SIDE.edge} />
  <rect class="mj-top" width={W} height={H} rx={R} />
</svg>
<svg class="mj-face" viewBox="0 0 300 400" aria-hidden="true">
  <use href="#{href}" />
  {#if overlay}<use href="#{overlay}" />{/if}
</svg>
