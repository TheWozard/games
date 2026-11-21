<!--
  A round icon button (base.css .icon-btn), as in the header bar: Undo, the menu, the back link.
  The icon is a Lucide component; `label` names the button (aria-label and title). With `href` it's
  a link instead. Anything else (aria-expanded, aria-haspopup...) goes on the element.
-->
<script lang="ts">
  import type { Component } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLElement> {
    icon: Component<{ strokeWidth?: number; 'aria-hidden'?: 'true' }>;
    label: string;
    href?: string;
    disabled?: boolean;
    strokeWidth?: number;
    class?: string;
  }

  let { icon: Icon, label, href, disabled = false, strokeWidth = 2.4, class: className, ...rest }: Props = $props();
</script>

{#if href}
  <a class={['icon-btn', className]} {href} aria-label={label} title={label} {...rest}>
    <Icon {strokeWidth} aria-hidden="true" />
  </a>
{:else}
  <button type="button" class={['icon-btn', className]} aria-label={label} title={label} {disabled} {...rest}>
    <Icon {strokeWidth} aria-hidden="true" />
  </button>
{/if}
