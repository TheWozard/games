<!--
  Every tile face as an SVG <symbol> (mj-k<kind>), defined once and drawn with <use>, in one of
  two sets (the menu's Display, Tile Art), which share their ids:
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

<!-- The tile's top (as CSS's 160deg: down and a little right), and the picked tile's tint. -->
<svg class="mj-faces" aria-hidden="true" width="0" height="0">
  <defs>
    <linearGradient id="mj-top" x1="0.33" y1="0" x2="0.67" y2="1">
      <stop offset="0" stop-color="#fbf7ec" />
      <stop offset="1" stop-color="#ece3cc" />
    </linearGradient>
    <!-- A picked tile (mahjong.css): each channel multiplied by the accent (#7aa5f5) at 85%,
         1 - 0.85 × (1 - accent) = (0.556, 0.7, 0.967). Alpha is left alone, so the rounded edges
         stay clean. The symbol takes mj-pick; the body takes mj-pick-outline, the same inside a
         pale accent border (half white): its outline grown 2px. -->
    <filter id="mj-pick" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="0.556 0 0 0 0  0 0.700 0 0 0  0 0 0.967 0 0  0 0 0 1 0" />
    </filter>
    <filter id="mj-pick-outline" color-interpolation-filters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values="0.556 0 0 0 0  0 0.700 0 0 0  0 0 0.967 0 0  0 0 0 1 0" result="tint" />
      <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="grown" />
      <feFlood style="flood-color: color-mix(in srgb, var(--accent), white 50%)" />
      <feComposite in2="grown" operator="in" result="ring" />
      <feMerge><feMergeNode in="ring" /><feMergeNode in="tint" /></feMerge>
    </filter>
  </defs>
</svg>

<style>
  :global(.mj-faces) { position: absolute; width: 0; height: 0; overflow: hidden; }
</style>
