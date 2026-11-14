<!-- Back to the launcher, at the left of every game's header bar. The game's folder rides along
     as the hash (../#sudoku), so the launcher can scroll to that game's card. -->
<script lang="ts">
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';

  const game = location.pathname.split('/').filter(Boolean).at(-1) ?? '';
</script>

<a class="icon-btn back" href="../#{game}" aria-label="All games" title="All games">
  <ChevronLeft strokeWidth={2.4} aria-hidden="true" />
</a>
