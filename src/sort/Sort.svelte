<script lang="ts">
  import GameScreen from '../shared/GameScreen.svelte';
  import { PALETTE } from '../shared/palette';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { isGame, newGame, reducer, STORAGE_KEY, stuck, type Action } from './game';
  import { CAPACITY, DIFFICULTIES, isDifficulty, pourAmount } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('easy'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const label = $derived(DIFFICULTIES[game.difficulty].label);

  // Layout, in tube widths: up to six tubes a row; a little headroom above each row for lifting.
  // A tube is a solid capsule exactly four layers tall, with an inset where the color sits.
  const INSET = 0.12;
  const LAYER = 0.8;
  const TUBE_H = CAPACITY * LAYER + INSET * 2;
  const GAP = 0.32;
  const ROW_GAP = 0.8;

  /** A tube's layers as runs of one color, bottom first: [color, from layer, count]. */
  const runs = (tube: number[]) => {
    const out: [number, number, number][] = [];
    tube.forEach((c, k) => {
      const last = out[out.length - 1];
      if (last && last[0] === c) last[2]++;
      else out.push([c, k, 1]);
    });
    return out;
  };
  // Tubes per row: whichever arrangement makes them biggest in the space available, up to a
  // comfortable size; among equally good ones, more per row. Worked out from the window (known
  // before the first paint, unlike a measurement) less the header and margins; the board's CSS
  // still fits whatever this picks into the real space.
  const MAX_TUBE_PX = 72;
  let viewW = $state(window.innerWidth);
  let viewH = $state(window.innerHeight);
  const areaW = $derived(Math.min(viewW, 520) - 32);
  const areaH = $derived(viewH - 110);
  const perRow = $derived.by(() => {
    const n = game.tubes.length;
    let best = n;
    let bestScale = 0;
    for (let k = Math.min(n, 7); k >= Math.ceil(n / 4); k--) {
      const r = Math.ceil(n / k);
      const scale = Math.min(MAX_TUBE_PX, areaW / (k + (k - 1) * GAP + 0.4), areaH / (r * (TUBE_H + ROW_GAP) + 0.2));
      if (scale > bestScale * 1.02) {
        best = k;
        bestScale = scale;
      }
    }
    return best;
  });
  const rows = $derived(Math.ceil(game.tubes.length / perRow));
  const box = $derived({ w: perRow + (perRow - 1) * GAP + 0.4, h: rows * (TUBE_H + ROW_GAP) + 0.2 });
  const place = (t: number) => {
    const row = Math.floor(t / perRow);
    const inRow = row === rows - 1 ? game.tubes.length - row * perRow : perRow;
    const indent = ((perRow - inRow) * (1 + GAP)) / 2; // center a shorter last row
    return { x: 0.2 + indent + (t % perRow) * (1 + GAP), y: ROW_GAP + row * (TUBE_H + ROW_GAP) };
  };

  let shaking = $state<number | null>(null);
  let shakeTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => saveJSON(STORAGE_KEY, game));

  function start(difficulty: string) {
    if (isDifficulty(difficulty)) game = newGame(difficulty);
  }

  function tap(t: number) {
    const from = game.selected;
    // A pour that isn't allowed onto a tube that's full or empty: give it a little shake.
    if (from !== null && from !== t && pourAmount(game.tubes, from, t) === 0 && !game.tubes[t].length) {
      clearTimeout(shakeTimer);
      shaking = t;
      shakeTimer = setTimeout(() => (shaking = null), 300);
    }
    dispatch({ type: 'tap', tube: t });
  }
</script>

<svelte:window bind:innerWidth={viewW} bind:innerHeight={viewH} />

<!-- Next once sorted, or once stuck with no useful pour left (Undo still backs out of it). -->
<GameScreen
  title="Color Sort"
  subtitle={label}
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  options={Object.entries(DIFFICULTIES).map(([value, d]) => ({ value, label: d.label, detail: `${d.colors} colors` }))}
  current={game.difficulty}
  onstart={start}
  finished={game.done || stuck(game)}
  onnext={() => (game = newGame(game.difficulty))}
>
  <div class="board-area">
    <svg class={['sort-board', { done: game.done }]} viewBox="0 0 {box.w} {box.h}" style:--w={box.w} style:--h={box.h} role="group" aria-label="Tubes">
      {#each game.tubes as tube, t (t)}
        {@const p = place(t)}
        <g
          class={['tube', { selected: game.selected === t, shake: shaking === t, full: tube.length === CAPACITY && tube.every((c) => c === tube[0]) }]}
          style:transform="translate({p.x}px, {p.y}px)"
          role="button"
          tabindex="-1"
          aria-label="Tube {t + 1}: {tube.length} layers"
          onclick={() => tap(t)}
          onkeydown={() => {}}
        >
          <g class="lift">
            <rect class="hit" x={-GAP / 2} y="-0.5" width={1 + GAP} height={TUBE_H + 0.8} />
            <rect class="body" x="0" y="0" width="1" height={TUBE_H} rx="0.5" />
            <!-- Each run of one color is a single rounded block, with a small gap between runs. -->
            {#each runs(tube) as [color, from, count] (from)}
              <rect
                class="run"
                x={INSET}
                y={TUBE_H - INSET - (from + count) * LAYER + 0.04}
                width={1 - INSET * 2}
                height={count * LAYER - 0.08}
                rx={(1 - INSET * 2) / 2}
                fill={PALETTE[color]}
              />
            {/each}
          </g>
        </g>
      {/each}
    </svg>
  </div>
</GameScreen>
