<!--
  What a tap places (Nonogram's colors and X; the shading games' mark and note): one circle at the
  bottom right showing the current pick, the others stacked behind it, smaller, in the order a tap
  brings them forward. Each one behind shows the same share of its own width past the one in front,
  so nearer ones show more than farther ones. A stop is a colored circle or a plain one, with an
  optional icon (`icon` draws it). Styles: brush.css.
-->
<script lang="ts" generics="T extends string | number">
  import type { Snippet } from 'svelte';

  interface Props {
    stops: { value: T; name: string; color?: string }[];
    value: T;
    /** Draws a stop's icon (it may draw nothing for a colored one). */
    icon?: Snippet<[T]>;
  }

  let { stops, value = $bindable(), icon }: Props = $props();

  const SIZE = 52; // the front circle, in pixels
  const SHRINK = 0.18; // each circle back is this much smaller
  const SHOWS = 0.4; // the share of its width each one behind shows

  const index = $derived(Math.max(0, stops.findIndex((s) => s.value === value)));
  const next = $derived(stops[(index + 1) % stops.length]);
  const stack = $derived.by(() => {
    let edge = 0; // how far the stack reaches left of the front circle's left edge
    return stops.map((_, at) => {
      const scale = 1 - at * SHRINK;
      if (at > 0) edge += SHOWS * SIZE * scale;
      // Its shift left, center to center, that puts its left edge `edge` past the front one's.
      return { scale, shift: edge + (SIZE / 2) * (1 - scale), edge };
    });
  });
</script>

<div class="brush-row">
  <button
    type="button"
    class="brush"
    style:--count={stops.length}
    style:--size="{SIZE}px"
    style:width="{SIZE + stack[stack.length - 1].edge}px"
    aria-label="Placing {stops[index].name}; tap for {next.name}"
    onclick={() => (value = next.value)}
  >
    {#each stops as stop, k (stop.value)}
      {@const at = (k - index + stops.length) % stops.length}
      <span
        class={['dot', { plain: !stop.color }]}
        style:--at={at}
        style:transform="translateX({-stack[at].shift}px) scale({stack[at].scale})"
        style:background={stop.color}
      >
        {@render icon?.(stop.value)}
      </span>
    {/each}
  </button>
</div>
