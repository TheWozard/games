<!-- The Shading page: Nonogram, Star Battle, Nurikabe, Hitori or Light Up, whichever was played last, switched from the New Game dialog. -->
<script lang="ts">
  import RulesPicker from '../shared/RulesPicker.svelte';
  import { parsePick } from '../shared/VariantPicker.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import Hitori from './hitori/Hitori.svelte';
  import LightUp from './lightup/LightUp.svelte';
  import Nonogram from './nonogram/Nonogram.svelte';
  import { NO_RULES, RULES, type Rules } from './nonogram/logic';
  import Nurikabe from './nurikabe/Nurikabe.svelte';
  import Stars from './stars/Stars.svelte';
  import { GAMES, isVariant, VARIANT_KEY, type Switcher, type Variant } from './variants';

  let variant = $state<Variant>(loadJSON(VARIANT_KEY, isVariant) ?? 'nonogram');
  let first = $state<string | undefined>(undefined);

  $effect(() => saveJSON(VARIANT_KEY, variant));

  function onswitch(pick: string) {
    const chosen = parsePick(GAMES, pick);
    if (!chosen || !isVariant(chosen.game)) return;
    first = chosen.setting;
    variant = chosen.game;
  }

  // Nonogram's rules, picked under its tab in any game's New Game dialog; Nonogram starts them from
  // its own game's rules as the dialog opens.
  let rules = $state<Rules>({ ...NO_RULES });

  const variants: Switcher = $derived({ games: GAMES, current: variant, onswitch, extras: { nonogram: nonogramRules } });
</script>

{#snippet nonogramRules()}
  <RulesPicker rules={RULES} bind:on={rules} />
{/snippet}

{#if variant === 'nonogram'}
  <Nonogram {variants} {first} bind:rules />
{:else if variant === 'stars'}
  <Stars {variants} {first} />
{:else if variant === 'nurikabe'}
  <Nurikabe {variants} {first} />
{:else if variant === 'hitori'}
  <Hitori {variants} {first} />
{:else}
  <LightUp {variants} {first} />
{/if}
