<!-- The Shading page: Star Battle, Nurikabe, Hitori or Light Up, whichever was played last, switched from the New Game dialog. -->
<script lang="ts">
  import { loadJSON, saveJSON } from '../shared/storage';
  import { parsePick } from '../shared/VariantPicker.svelte';
  import Hitori from './hitori/Hitori.svelte';
  import LightUp from './lightup/LightUp.svelte';
  import Nurikabe from './nurikabe/Nurikabe.svelte';
  import Stars from './stars/Stars.svelte';
  import { GAMES, isVariant, VARIANT_KEY, type Switcher, type Variant } from './variants';

  let variant = $state<Variant>(loadJSON(VARIANT_KEY, isVariant) ?? 'stars');
  let first = $state<string | undefined>(undefined);

  $effect(() => saveJSON(VARIANT_KEY, variant));

  function onswitch(pick: string) {
    const chosen = parsePick(GAMES, pick);
    if (!chosen || !isVariant(chosen.game)) return;
    first = chosen.setting;
    variant = chosen.game;
  }

  const variants: Switcher = $derived({ games: GAMES, current: variant, onswitch });
</script>

{#if variant === 'stars'}
  <Stars {first} {variants} />
{:else if variant === 'nurikabe'}
  <Nurikabe {first} {variants} />
{:else if variant === 'hitori'}
  <Hitori {first} {variants} />
{:else}
  <LightUp {first} {variants} />
{/if}
