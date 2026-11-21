<script lang="ts">
  import { flip } from 'svelte/animate';
  import GameScreen from '../shared/GameScreen.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import Choice from '../shared/ui/Choice.svelte';
  import PickGroup from '../shared/ui/PickGroup.svelte';
  import { slidePick } from '../shared/ui/slide';
  import {
    DEFAULT,
    describe,
    fromSaved,
    lines,
    newGame,
    reducer,
    STORAGE_KEY,
    type Action,
    type Settings,
  } from './game';
  import { fixedTiles, palette, PATTERNS, SIZES, toCss, type Pattern, type Size } from './logic';

  const anything = (_value: unknown): _value is unknown => true;
  let game = $state.raw(fromSaved(loadJSON(STORAGE_KEY, anything)) ?? newGame(DEFAULT));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const colors = $derived(palette(game.cols, game.rows, game.corners).map(toCss));
  const label = $derived(describe(game));
  const marks = $derived(lines(game));

  // What the New dialog has picked so far; it opens on the current game's settings.
  let choice = $state<Settings>({ ...DEFAULT });

  $effect(() => saveJSON(STORAGE_KEY, game));

  const start = (settings: Settings) => (game = newGame(settings));

  function askNew() {
    choice = { size: game.size, pattern: game.pattern };
  }

  // Tiny previews of each pattern in the dialog (Scattered uses a fixed example).
  const PREVIEW = { cols: 4, rows: 5 };
  let seed = 7;
  const example = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const previews = Object.fromEntries(
    (Object.keys(PATTERNS) as Pattern[]).map((p) => [
      p,
      fixedTiles(PREVIEW.cols, PREVIEW.rows, p, example),
    ]),
  ) as Record<Pattern, boolean[]>;

  // Drag a tile onto another to swap them; a press that doesn't move is an ordinary tap.
  let dragFrom: null | number = null;
  let dragged = false;

  function pointerDown(e: PointerEvent, pos: number) {
    dragFrom = game.fixed[pos] ? null : pos;
    dragged = false;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  }

  function pointerUp(e: PointerEvent) {
    if (dragFrom === null) return;
    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-pos]');
    const to = target ? Number(target.dataset.pos) : null;
    if (to !== null && to !== dragFrom && !game.fixed[to]) {
      dragged = true;
      dispatch({ type: 'swap', from: dragFrom, to });
    }
    dragFrom = null;
  }

  function click(pos: number) {
    if (dragged) {
      dragged = false;
      return;
    }
    dispatch({ type: 'tap', pos });
  }
</script>

<svelte:document onpointerup={pointerUp} />

<GameScreen
  canUndo={!game.done && game.history.length > 0}
  finished={game.done}
  onnext={() => (game = newGame({ size: game.size, pattern: game.pattern }))}
  onopennew={askNew}
  onstart={(value) => {
    if (value === 'start') start(choice);
  }}
  onundo={() => dispatch({ type: 'undo' })}
  subtitle={label}
  title="Gradient"
>
  {#snippet picker()}
    <PickGroup class="sizes" title="Size">
      {#each Object.entries(SIZES) as [key, s] (key)}
        <Choice
          detail="{s.cols}×{s.rows}"
          label={s.label}
          onclick={() => (choice.size = key as Size)}
          pressed={choice.size === key}
        />
      {/each}
    </PickGroup>

    <!-- A preview over each name, which is small: its own tiles, not Choice's. -->
    <h3 class="pick-title">Fixed Tiles</h3>
    <div class="pick patterns" {@attach slidePick}>
      {#each Object.entries(PATTERNS) as [key, p] (key)}
        <button
          class="btn"
          aria-pressed={choice.pattern === key}
          onclick={() => (choice.pattern = key as Pattern)}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 {PREVIEW.cols * 5} {PREVIEW.rows * 5}">
            {#each previews[key as Pattern] as fixed, i (i)}
              <rect
                class={fixed ? 'fixed' : 'loose'}
                height="4"
                rx="1"
                width="4"
                x={(i % PREVIEW.cols) * 5 + 0.5}
                y={Math.floor(i / PREVIEW.cols) * 5 + 0.5}
              />
            {/each}
          </svg>
          <span>{p.label}</span>
        </button>
      {/each}
    </div>
  {/snippet}

  <!-- The board, with a marker beside each row and under each column that lights up when that
       line is all in place. Lines made only of fixed tiles are always right, so they get none. -->
  <div class="board-area">
    <div
      style:--cols={game.cols}
      style:--rows={game.rows}
      class={['gradient-wrap', { done: game.done }]}
    >
      <div class="gradient-board" aria-label="Gradient tiles" role="group">
        {#each game.order as id, pos (id)}
          <button
            style:background={colors[id]}
            class={['tile', { fixed: game.fixed[pos], selected: game.selected === pos }]}
            aria-label={game.fixed[pos] ? 'Fixed tile' : 'Tile'}
            aria-pressed={game.selected === pos}
            data-pos={pos}
            onclick={() => click(pos)}
            onpointerdown={(e) => pointerDown(e, pos)}
            type="button"
            animate:flip={{ duration: 260 }}
          ></button>
        {/each}
      </div>
      <div class="marks rows" aria-hidden="true">
        {#each marks.rows as line, r (r)}<span
            class={['mark', { on: line.correct, none: line.fixed }]}
          ></span>{/each}
      </div>
      <div class="marks cols" aria-hidden="true">
        {#each marks.cols as line, c (c)}<span
            class={['mark', { on: line.correct, none: line.fixed }]}
          ></span>{/each}
      </div>
    </div>
  </div>
</GameScreen>
