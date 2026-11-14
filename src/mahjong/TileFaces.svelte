<!--
  Every tile face as an SVG <symbol> (mj-k<kind>, viewBox 300×400), defined once and drawn with
  <use>. The faces are made by scripts/mahjong-tiles.ts (`just mahjong-tiles`) into faces.svg:
  FluffyStuff's riichi tiles (CC0), with xhokir's flowers and seasons (CC BY 4.0).
-->
<script lang="ts">
  import faces from './faces.svg?raw';
</script>

{@html faces}

<!-- The tile's top, plain and picked (as CSS's 160deg: down and a little right). -->
<svg class="mj-faces" aria-hidden="true" width="0" height="0">
  <defs>
    <linearGradient id="mj-top" x1="0.33" y1="0" x2="0.67" y2="1">
      <stop offset="0" stop-color="#fbf7ec" />
      <stop offset="1" stop-color="#ece3cc" />
    </linearGradient>
    <linearGradient id="mj-top-picked" x1="0.33" y1="0" x2="0.67" y2="1">
      <stop offset="0" stop-color="#e3ecff" />
      <stop offset="1" stop-color="#c4d5fb" />
    </linearGradient>
  </defs>
</svg>

<style>
  :global(.mj-faces) { position: absolute; width: 0; height: 0; overflow: hidden; }
</style>
