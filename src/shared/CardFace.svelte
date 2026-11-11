<!-- The face of a playing card: rank and suit in the corner, a large suit at the bottom right.
     Goes inside a `.card` on a `.card-table` (see cards.css). -->
<script lang="ts">
  import { rankOf, RANKS, suitOf, SUITS, type Card } from './cards';

  let { card }: { card: Card } = $props();
</script>

<span class="corner">{RANKS[rankOf(card) - 1]}<span>{SUITS[suitOf(card)]}</span></span>
<span class="pip">{SUITS[suitOf(card)]}</span>
