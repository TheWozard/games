<!-- The Sudoku page: Classic or Killer, whichever was played last, switched from the New Game dialog. -->
<script lang="ts">
  import GridPlay from '../shared/GridPlay.svelte';
  import { parsePick } from '../shared/VariantPicker.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import * as classic from './classic/game';
  import { DIFFICULTIES as CLASSIC, isDifficulty as isClassic } from './classic/logic';
  import * as killer from './killer/game';
  import { DIFFICULTIES as KILLER, isDifficulty as isKiller } from './killer/logic';
  import { GAMES, isVariant, VARIANT_KEY, type Variant } from './variants';

  let variant = $state<Variant>(loadJSON(VARIANT_KEY, isVariant) ?? 'classic');
  let first = $state<string | undefined>(undefined);

  $effect(() => saveJSON(VARIANT_KEY, variant));

  function onswitch(pick: string) {
    const chosen = parsePick(GAMES, pick);
    if (!chosen || !isVariant(chosen.game)) return;
    first = chosen.setting;
    variant = chosen.game;
  }
</script>

{#if variant === 'classic'}
  <GridPlay
    title="Sudoku"
    storageKey={classic.STORAGE_KEY}
    difficulties={CLASSIC}
    isValid={classic.isGame}
    create={(d) => classic.newGame(isClassic(d) ? d : 'easy')}
    layout={() => classic.LAYOUT}
    variants={{ games: GAMES, current: 'classic', onswitch }}
    {first}
  />
{:else}
  <GridPlay
    title="Sudoku"
    storageKey={killer.STORAGE_KEY}
    difficulties={KILLER}
    isValid={killer.isGame}
    create={(d) => killer.newGame(isKiller(d) ? d : 'easy')}
    layout={killer.layout}
    variants={{ games: GAMES, current: 'killer', onswitch }}
    {first}
  />
{/if}
