<!--
  A native modal <dialog>. Buttons inside close it, and `onclose` gets the clicked button's value;
  a tap on the dimmed area outside the box closes it with no value (as Escape does). The dialog is
  a full-screen layer that scrolls as one; the box is the form (base.css).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  let { open, onclose, children }: { open: boolean; onclose: (value: string) => void; children: Snippet } = $props();

  let dialog: HTMLDialogElement;

  $effect(() => {
    if (open && !dialog.open) {
      dialog.returnValue = '';
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });
</script>

<!-- The keyboard way out is Escape, built into the dialog. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} onclose={() => onclose(dialog.returnValue)} onclick={(e) => { if (e.target === dialog) dialog.close(''); }}>
  <form method="dialog">{@render children()}</form>
</dialog>
