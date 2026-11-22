<!--
  A tile in a New Game dialog's row of choices, one of which is picked (aria-pressed): a name in
  <strong> and an optional short detail beneath ("10 mines"). Content passed in (Gradient's
  previews) goes above the name. Anything else (aria-label...) goes on the button.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    children?: Snippet;
    detail?: string;
    label: string;
    pressed: boolean;
  }

  let { label, detail, pressed, children, ...rest }: Props = $props();
</script>

<button class="btn" aria-pressed={pressed} type="button" {...rest}>
  {@render children?.()}
  <strong>{label}</strong>{#if detail}<span>{detail}</span>{/if}
</button>
