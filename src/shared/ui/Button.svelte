<!--
  A plain button (base.css .btn): `primary` in the accent color (Shuffle), `small` for a little one
  beside a heading (Mahjong's All / None).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    children: Snippet;
    primary?: boolean;
    small?: boolean;
  }

  let { primary = false, small = false, class: className, children, ...rest }: Props = $props();
</script>

<button class={['btn', { primary, small }, className]} type="button" {...rest}>
  {@render children()}
</button>
