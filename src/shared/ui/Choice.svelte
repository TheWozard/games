<!--
  A tile in a New Game dialog's row of choices, one of which is picked (aria-pressed): a name in
  <strong> and an optional short detail beneath ("10 mines"). Content passed in (Gradient's
  previews) goes above the name. Anything else (aria-label...) goes on the button.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    label: string;
    detail?: string;
    pressed: boolean;
    children?: Snippet;
  }

  let { label, detail, pressed, children, ...rest }: Props = $props();
</script>

<button type="button" class="btn" aria-pressed={pressed} {...rest}>
  {@render children?.()}
  <strong>{label}</strong>{#if detail}<span>{detail}</span>{/if}
</button>
