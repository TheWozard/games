<!--
  Mahjong's dev menu entries (GameScreen2's `dev`): shortcuts to the screens that are slow to reach
  by playing. Loaded by the dev server only (Mahjong.svelte), so a build leaves this file out.
-->
<script lang="ts">
  import Lock from '@lucide/svelte/icons/lock';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Trophy from '@lucide/svelte/icons/trophy';
  import MenuItem from '../shared/ui/MenuItem.svelte';
  import { pairsLeft, reducer, replayOf, type Deal, type Game } from './game';

  let {
    game,
    set,
    deal,
  }: { game: Game; set: (game: Game) => void; deal: (deal: Deal) => unknown } = $props();

  const win = () => set({ ...game, gone: game.gone.map(() => true), selected: null, done: true });

  /** Takes random free pairs from here until none match (Shuffle's state); retries if one clears the board. */
  function stuck() {
    for (let tries = 0; tries < 200; tries++) {
      let g: Game = { ...game, selected: null };
      for (let pairs = pairsLeft(g); !g.done && pairs.length; pairs = pairsLeft(g)) {
        const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
        g = reducer(reducer(g, { type: 'tap', slot: a }), { type: 'tap', slot: b });
      }
      if (!g.done) return set(g);
    }
  }

  /** The same deal again from the start, from its seed. */
  const replay = () => deal(replayOf(game));
</script>

<MenuItem icon={Trophy} label="Win" onclick={win} />
<MenuItem icon={Lock} label="Get Stuck" onclick={stuck} />
<MenuItem icon={RotateCcw} label="Replay Deal" onclick={replay} />
