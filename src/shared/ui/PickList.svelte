<!--
  A long group of Toggles, any number on, drawn like a PickGroup (base.css .pick-list): a
  .pick-title heading, with how many are on and any `actions` ("Select" in a .pick-select, then small Buttons: All, None) at its
  right, over one darker strip (base.css: at most --pick-list-height) holding, from the top, an
  optional row of `chips` (Chips that filter the list; it scrolls sideways) and the Toggles, one a
  row, the ones on lit up inside it, which scroll by themselves under it. Mahjong's layouts.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    count = 0,
    actions,
    chips,
    children,
  }: {
    actions?: Snippet;
    children: Snippet;
    chips?: Snippet;
    /** How many are on, shown beside the heading (left out at 0). */
    count?: number;
    title: string;
  } = $props();
</script>

<div class="pick-head">
  <h3 class="pick-title">
    {title}{#if count}<span class="pick-count">{count}</span>{/if}
  </h3>
  {@render actions?.()}
</div>
<div class="pick pick-list">
  {#if chips}<div class="pick-chips">{@render chips()}</div>{/if}
  <div class="pick-list-rows">{@render children()}</div>
</div>
