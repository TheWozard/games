<!--
  A native modal <dialog>. Buttons inside close it, and `onclose` gets the clicked button's value;
  a tap on the dimmed area outside the box closes it with no value (as Escape does). The dialog is
  a full-screen layer that scrolls as one; the box is the form (base.css). While `locked`, Escape
  and the dimmed area don't close it.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    open,
    locked = false,
    onclose,
    class: className,
    label,
    children,
  }: {
    open: boolean;
    locked?: boolean;
    onclose: (value: string) => void;
    /** A class for the dialog, for one placed or drawn differently (GameScreen2's menu). */
    class?: string;
    /** A name for a dialog with no heading to name it. */
    label?: string;
    children: Snippet;
  } = $props();

  let dialog: HTMLDialogElement;

  $effect(() => {
    if (open && !dialog.open) {
      dialog.returnValue = '';
      dialog.showModal();
      // Focus the dialog itself, not its first button: otherwise that button (often a New Game
      // choice) wears a focus ring before anything's been touched. Tab goes on from here.
      dialog.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });
</script>

<!-- The keyboard way out is Escape, built into the dialog. -->
<dialog
  bind:this={dialog}
  tabindex="-1"
  class={className}
  aria-label={label}
  onclose={() => onclose(dialog.returnValue)}
  oncancel={(e) => {
    if (locked) e.preventDefault();
  }}
  onclick={(e) => {
    if (e.target === dialog && !locked) dialog.close('');
  }}
>
  <form method="dialog">{@render children()}</form>
</dialog>
