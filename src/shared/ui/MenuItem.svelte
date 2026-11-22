<!--
  One entry in GameScreen2's menu: an icon and a name, the width of the menu. Tapping it closes the
  menu; with `value`, the menu closes with that value (GameScreen2's Customize is 'new').
-->
<script lang="ts">
  import type { Component } from 'svelte';

  interface Props {
    disabled?: boolean;
    icon?: Component<{ 'aria-hidden'?: 'true'; strokeWidth?: number }>;
    label: string;
    onclick?: () => void;
    value?: string;
  }

  let { icon: Icon, label, value, disabled = false, onclick }: Props = $props();
</script>

<button class="menu-item" {disabled} {onclick} type="submit" {value}>
  {#if Icon}<Icon aria-hidden="true" strokeWidth={2.4} />{/if}
  {label}
</button>
