<!--
  A tile that turns on and off by itself, not one of a set: a check box, then a name and an optional
  detail beneath (base.css .btn.toggle), and an optional `aside` at the far right (Mahjong's layouts
  show their shape there). Rules in RulesPicker, Mahjong's layouts.
-->
<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import type { Snippet } from 'svelte';

  let {
    label,
    detail,
    on,
    onclick,
    aside,
  }: { label: string; detail?: string; on: boolean; onclick: () => void; aside?: Snippet } =
    $props();
</script>

<button type="button" class="btn toggle" aria-pressed={on} {onclick}>
  <span class="check" aria-hidden="true">
    <Check strokeWidth={3.5} />
  </span>
  {#if detail}
    <span class="toggle-name"><strong>{label}</strong><span>{detail}</span></span>
  {:else}
    <strong>{label}</strong>
  {/if}
  {#if aside}<span class="toggle-aside">{@render aside()}</span>{/if}
</button>
