<!--
  A plain button (base.css .btn): `primary` in the accent color (Shuffle), `small` for a little one
  beside a heading (Mahjong's All / None).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    primary?: boolean;
    small?: boolean;
    children: Snippet;
  }

  let { primary = false, small = false, class: className, children, ...rest }: Props = $props();
</script>

<button type="button" class={['btn', { primary, small }, className]} {...rest}>{@render children()}</button>
