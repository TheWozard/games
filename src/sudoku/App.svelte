<!-- The Sudoku page: Classic, Killer or Jigsaw, whichever was played last, switched from the New Game dialog. -->
<script lang="ts">
  import GridPlay from '../shared/GridPlay.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { parsePick } from '../shared/VariantPicker.svelte';
  import * as classic from './classic/game';
  import { DIFFICULTIES as CLASSIC, isDifficulty as isClassic } from './classic/logic';
  import * as jigsaw from './jigsaw/game';
  import { isDifficulty as isJigsaw, DIFFICULTIES as JIGSAW } from './jigsaw/logic';
  import * as killer from './killer/game';
  import { isDifficulty as isKiller, DIFFICULTIES as KILLER } from './killer/logic';
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
    create={(d) => classic.newGame(isClassic(d) ? d : 'easy')}
    difficulties={CLASSIC}
    {first}
    isValid={classic.isGame}
    layout={() => classic.LAYOUT}
    storageKey={classic.STORAGE_KEY}
    title="Sudoku"
    variants={{ games: GAMES, current: 'classic', onswitch }}
  />
{:else if variant === 'jigsaw'}
  <GridPlay
    create={(d) => jigsaw.newGame(isJigsaw(d) ? d : 'easy')}
    difficulties={JIGSAW}
    {first}
    isValid={jigsaw.isGame}
    layout={jigsaw.layout}
    storageKey={jigsaw.STORAGE_KEY}
    title="Sudoku"
    variants={{ games: GAMES, current: 'jigsaw', onswitch }}
  />
{:else}
  <GridPlay
    create={(d) => killer.newGame(isKiller(d) ? d : 'easy')}
    difficulties={KILLER}
    {first}
    isValid={killer.isGame}
    layout={killer.layout}
    storageKey={killer.STORAGE_KEY}
    title="Sudoku"
    variants={{ games: GAMES, current: 'killer', onswitch }}
  />
{/if}
