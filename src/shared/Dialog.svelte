<!-- A native modal <dialog>. Buttons inside close it, and `onclose` gets the clicked button's value. -->
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

<dialog bind:this={dialog} onclose={() => onclose(dialog.returnValue)}>
  <form method="dialog">{@render children()}</form>
</dialog>
