<!--
  The page: the saved game, or, on a first visit (or after a save that no longer fits), a new one
  dealt in the background. The screen (Mahjong.svelte) starts once there's a game to show.
-->
<script lang="ts">
  import { loadJSON } from '../shared/storage';
  import { dealInBackground } from './background';
  import { isGame, nextDeal, STORAGE_KEY } from './game';
  import Mahjong from './Mahjong.svelte';

  const saved = loadJSON(STORAGE_KEY, isGame);
  let first = $state.raw(saved);
  if (!saved) dealInBackground(nextDeal(['pyramid'], 'medium')).then((g) => (first = g));
</script>

{#if first}<Mahjong initial={first} />{/if}
