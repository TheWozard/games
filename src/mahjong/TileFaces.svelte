<!--
  Every tile face as an SVG <symbol> (mj-k<kind>), defined once and drawn with <use>, in one of
  two sets (the menu's Settings, Tile Art), which share their ids:
  - Classic (ClassicFaces.svelte), drawn here after a traditional Chinese set; the default.
  - Riichi (faces.svg, viewBox 300×400), made by scripts/mahjong-tiles.ts (`just mahjong-tiles`):
    FluffyStuff's riichi tiles (CC0), with xhokir's flowers and seasons (CC BY 4.0). Loaded only
    when picked, so Classic players don't download it.
  A face fills its tile's padding box whatever its viewBox, so either set fits the same tile.
-->
<script lang="ts">
  import type { Settings } from '../shared/settings';
  import ClassicFaces from './ClassicFaces.svelte';

  let { art }: { art: Settings['mahjongArt'] } = $props();
</script>

{#if art === 'riichi'}
  {#await import('./faces.svg?raw') then { default: faces }}
    {@html faces}
  {/await}
{:else}
  <ClassicFaces />
{/if}

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
