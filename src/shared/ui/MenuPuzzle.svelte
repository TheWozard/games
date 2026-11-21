<!--
  The last entry in GameScreen2's menu: Details. A tap copies `puzzle`, what the puzzle being
  played is (a seed, an id, an index, a version: whatever makes it again), with a toast; unlike the
  other entries, the menu stays open.
-->
<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import { toast } from "../toast";
  import MenuSection from "./MenuSection.svelte";

  /** `oncopy` runs once it's copied (the dev gallery logs it). */
  let { puzzle, oncopy }: { puzzle: string; oncopy?: () => void } = $props();

  const failed = () => toast("Couldn't copy", { tone: "error" });

  function copy() {
    if (!navigator.clipboard) return failed();
    navigator.clipboard.writeText(puzzle).then(() => {
      toast("Copied");
      oncopy?.();
    }, failed);
  }
</script>

<!-- A menu entry like the others (its own section, the icon at the left), but a tap doesn't close the menu. -->
<MenuSection>
  <button type="button" class="menu-item" title={puzzle} onclick={copy}>
    <Copy strokeWidth={2.4} aria-hidden="true" />
    Details
  </button>
</MenuSection>
