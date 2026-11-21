<!--
  A round icon button (base.css .icon-btn), as in the header bar: Undo, the menu, the back link.
  The icon is a Lucide component; `label` names the button (aria-label and title). With `href` it's
  a link instead. Anything else (aria-expanded, aria-haspopup...) goes on the element.
-->
<script lang="ts">
  import type { Component } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  interface Props extends HTMLAttributes<HTMLElement> {
    class?: string;
    disabled?: boolean;
    href?: string;
    icon: Component<{ 'aria-hidden'?: 'true'; strokeWidth?: number }>;
    label: string;
    strokeWidth?: number;
  }

  let {
    icon: Icon,
    label,
    href,
    disabled = false,
    strokeWidth = 2.4,
    class: className,
    ...rest
  }: Props = $props();
</script>

{#if href}
  <a class={['icon-btn', className]} aria-label={label} {href} title={label} {...rest}>
    <Icon aria-hidden="true" {strokeWidth} />
  </a>
{:else}
  <button
    class={['icon-btn', className]}
    aria-label={label}
    {disabled}
    title={label}
    type="button"
    {...rest}
  >
    <Icon aria-hidden="true" {strokeWidth} />
  </button>
{/if}
