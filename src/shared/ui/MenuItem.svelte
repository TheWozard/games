<!--
  One entry in GameScreen2's menu: an icon and a name, the width of the menu. Tapping it closes the
  menu; with `value`, the menu closes with that value (GameScreen2's Customize is 'new').
-->
<script lang="ts">
  import type { Component } from 'svelte';

  interface Props {
    icon?: Component<{ strokeWidth?: number; 'aria-hidden'?: 'true' }>;
    label: string;
    value?: string;
    disabled?: boolean;
    onclick?: () => void;
  }

  let { icon: Icon, label, value, disabled = false, onclick }: Props = $props();
</script>

<button class="menu-item" {value} {disabled} {onclick}>
  {#if Icon}<Icon strokeWidth={2.4} aria-hidden="true" />{/if}
  {label}
</button>
