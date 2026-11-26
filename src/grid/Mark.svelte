<!--
  One of the Grid tool's marks (marks.ts), drawn in the current font size and color: a number or a
  letter as text, a symbol as a Lucide icon one em high. The same in a cell, a note, the pad and
  Customize.
-->
<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import Circle from '@lucide/svelte/icons/circle';
  import Diamond from '@lucide/svelte/icons/diamond';
  import Heart from '@lucide/svelte/icons/heart';
  import Star from '@lucide/svelte/icons/star';
  import Triangle from '@lucide/svelte/icons/triangle';
  import X from '@lucide/svelte/icons/x';
  import type { Component } from 'svelte';

  type Icon = Component<{
    'aria-hidden'?: 'true';
    class?: string;
    fill?: string;
    strokeWidth?: number;
  }>;

  // Each symbol's icon, and whether it's filled (the dot is a filled circle).
  const ICONS: Record<string, [Icon, boolean]> = {
    check: [Check, false],
    cross: [X, false],
    dot: [Circle, true],
    circle: [Circle, false],
    star: [Star, false],
    triangle: [Triangle, false],
    heart: [Heart, false],
    diamond: [Diamond, false],
  };

  let { mark }: { mark: string } = $props();
  const icon = $derived(ICONS[mark]);
</script>

{#if icon}
  {@const [Icon, filled] = icon}
  <Icon
    class="mark-icon"
    aria-hidden="true"
    fill={filled ? 'currentColor' : 'none'}
    strokeWidth={mark === 'check' || mark === 'cross' ? 3 : 2.25}
  />
{:else}{mark}{/if}

<style>
  :global(.mark-icon) {
    width: 1em;
    height: 1em;
    vertical-align: -0.125em;
  }
</style>
