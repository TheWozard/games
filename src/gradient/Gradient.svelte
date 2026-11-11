<script lang="ts">
  import { flip } from 'svelte/animate';
  import GameScreen from '../shared/GameScreen.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { DEFAULT, describe, fromSaved, lines, newGame, reducer, STORAGE_KEY, type Action, type Settings } from './game';
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
  const example = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const previews = Object.fromEntries(
    (Object.keys(PATTERNS) as Pattern[]).map((p) => [p, fixedTiles(PREVIEW.cols, PREVIEW.rows, p, example)]),
  ) as Record<Pattern, boolean[]>;

  // Drag a tile onto another to swap them; a press that doesn't move is an ordinary tap.
  let dragFrom: number | null = null;
  let dragged = false;

  function pointerDown(e: PointerEvent, pos: number) {
    dragFrom = game.fixed[pos] ? null : pos;
    dragged = false;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  }

  function pointerUp(e: PointerEvent) {
    if (dragFrom === null) return;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-pos]');
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
  title="Gradient"
  subtitle={label}
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  onopennew={askNew}
  onstart={(value) => { if (value === 'start') start(choice); }}
  finished={game.done}
  onnext={() => (game = newGame({ size: game.size, pattern: game.pattern }))}
>
  {#snippet picker()}
    <h3 class="pick-title">Size</h3>
    <div class="pick sizes">
      {#each Object.entries(SIZES) as [key, s] (key)}
        <button type="button" class="btn" aria-pressed={choice.size === key} onclick={() => (choice.size = key as Size)}>
          <strong>{s.label}</strong><span>{s.cols}×{s.rows}</span>
        </button>
      {/each}
    </div>

    <h3 class="pick-title">Fixed Tiles</h3>
    <div class="pick patterns">
      {#each Object.entries(PATTERNS) as [key, p] (key)}
        <button type="button" class="btn" aria-pressed={choice.pattern === key} onclick={() => (choice.pattern = key as Pattern)}>
          <svg viewBox="0 0 {PREVIEW.cols * 5} {PREVIEW.rows * 5}" aria-hidden="true">
            {#each previews[key as Pattern] as fixed, i (i)}
              <rect
                x={(i % PREVIEW.cols) * 5 + 0.5}
                y={Math.floor(i / PREVIEW.cols) * 5 + 0.5}
                width="4"
                height="4"
                rx="1"
                class={fixed ? 'fixed' : 'loose'}
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
    <div class={['gradient-wrap', { done: game.done }]} style:--cols={game.cols} style:--rows={game.rows}>
    <div class="gradient-board" role="group" aria-label="Gradient tiles">
      {#each game.order as id, pos (id)}
        <button
          type="button"
          class={['tile', { fixed: game.fixed[pos], selected: game.selected === pos }]}
          style:background={colors[id]}
          data-pos={pos}
          aria-label={game.fixed[pos] ? 'Fixed tile' : 'Tile'}
          aria-pressed={game.selected === pos}
          onpointerdown={(e) => pointerDown(e, pos)}
          onclick={() => click(pos)}
          animate:flip={{ duration: 260 }}
        ></button>
      {/each}
    </div>
    <div class="marks rows" aria-hidden="true">
      {#each marks.rows as line, r (r)}<span class={['mark', { on: line.correct, none: line.fixed }]}></span>{/each}
    </div>
    <div class="marks cols" aria-hidden="true">
      {#each marks.cols as line, c (c)}<span class={['mark', { on: line.correct, none: line.fixed }]}></span>{/each}
    </div>
    </div>
  </div>
</GameScreen>
