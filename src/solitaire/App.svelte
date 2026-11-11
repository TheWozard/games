<!-- The Solitaire page: Klondike or FreeCell, whichever was played last, switched from the New dialog. -->
<script lang="ts">
  import { loadJSON, saveJSON } from '../shared/storage';
  import FreeCell from './freecell/FreeCell.svelte';
  import Klondike from './klondike/Solitaire.svelte';
  import { isVariant, parse, VARIANT_KEY, type Variant } from './variants';

  let variant = $state<Variant>(loadJSON(VARIANT_KEY, isVariant) ?? 'klondike');
  let start = $state<string | undefined>(undefined);

  $effect(() => saveJSON(VARIANT_KEY, variant));

  function onswitch(value: string) {
    const choice = parse(value);
    if (!choice) return;
    start = choice.setting;
    variant = choice.variant;
  }
</script>

{#if variant === 'klondike'}
  <Klondike {start} {onswitch} />
{:else}
  <FreeCell {start} {onswitch} />
{/if}
