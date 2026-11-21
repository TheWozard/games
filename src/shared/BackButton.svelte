<!-- Back to the launcher, at the left of every game's header bar. The game's folder rides along
     as the hash (../#sudoku), so the launcher can scroll to that game's card. -->
<script lang="ts">
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import IconButton from './ui/IconButton.svelte';

  const game = location.pathname.split('/').filter(Boolean).at(-1) ?? '';
</script>

<IconButton class="back" href="../#{game}" icon={ChevronLeft} label="All games" />
