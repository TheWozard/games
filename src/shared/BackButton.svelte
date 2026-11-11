<!-- Back to the launcher, at the left of every game's header bar. The game's folder rides along
     as the hash (../#sudoku), so the launcher can scroll to that game's card. -->
<script lang="ts">
  const game = location.pathname.split('/').filter(Boolean).at(-1) ?? '';
</script>

<a class="icon-btn back" href="../#{game}" aria-label="All games" title="All games">
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14.5 5.5L8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</a>
