<script lang="ts">
  import { untrack } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { Tween } from 'svelte/motion';
  import GameScreen from '../shared/GameScreen.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { DEFAULT, describe, fromSaved, newGame, reducer, settingsOf, STORAGE_KEY, type Action } from './game';
  import { boardFor, crossings, dotRadius, SIZES, STARTS, STYLES, type Point, type Settings, type Size, type Start, type Style } from './logic';

  const anything = (_value: unknown): _value is unknown => true;
  let game = $state.raw(fromSaved(loadJSON(STORAGE_KEY, anything)) ?? newGame(DEFAULT));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const tangle = $derived(crossings(game.points, game.edges));
  const label = $derived(describe(game));
  const r = $derived(dotRadius(game.points.length));

  let svg: SVGSVGElement;

  // Where the dots are drawn: right where the game has them, except that after a drop, dots the
  // game nudged off lines (or clear of each other) glide there.
  const shown = new Tween<Point[]>(untrack(() => game.points), { easing: cubicOut });
  let glide = false;
  // Before drawing, so a drag follows the finger in the same frame.
  $effect.pre(() => {
    const points = game.points;
    shown.set(points, { duration: untrack(() => glide) ? 260 : 0 });
    glide = false;
  });
  // A new puzzle may have more dots than the last: until the tween has caught up, its own.
  const view = $derived(shown.current.length === game.points.length ? shown.current : game.points);

  // The dot being dragged, where it started, and the layout before the drag (for undo).
  let dragging = $state<number | null>(null);
  let grab: Point = [0, 0];
  let before: Point[] = [];

  /** The lines in drawing order: the held dot's last, so nothing covers them. */
  const edgeOrder = $derived.by(() => {
    const ks = game.edges.map((_, k) => k);
    if (dragging === null) return ks;
    const held = (k: number) => game.edges[k][0] === dragging || game.edges[k][1] === dragging;
    return [...ks.filter((k) => !held(k)), ...ks.filter(held)];
  });
  const neighbors = $derived(
    dragging === null ? new Set<number>() : new Set(game.edges.flatMap(([a, b]) => (a === dragging ? [b] : b === dragging ? [a] : []))),
  );

  // The board fills all the space it's given; when that changes shape (rotation, another
  // device), the dots stretch to fit. Never mid-drag: the drop would land in the wrong place.
  let areaW = $state(0);
  let areaH = $state(0);
  const board = $derived(boardFor(areaW, areaH));
  $effect(() => {
    const to = board;
    if (areaW > 0 && areaH > 0 && dragging === null) untrack(() => dispatch({ type: 'resize', board: to }));
  });

  // Save whenever the game changes, except mid-drag (a drop saves the result).
  $effect(() => {
    if (dragging === null) saveJSON(STORAGE_KEY, game);
  });

  function toBoard(e: PointerEvent): Point {
    const m = svg.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return [p.x, p.y];
  }

  function pointerDown(e: PointerEvent, i: number) {
    if (game.done || dragging !== null) return;
    e.preventDefault();
    svg.setPointerCapture?.(e.pointerId);
    dragging = i;
    before = game.points;
    const [x, y] = toBoard(e);
    grab = [game.points[i][0] - x, game.points[i][1] - y];
  }

  function pointerMove(e: PointerEvent) {
    if (dragging === null) return;
    const [x, y] = toBoard(e);
    dispatch({ type: 'drag', index: dragging, to: [x + grab[0], y + grab[1]] });
  }

  function pointerUp() {
    if (dragging === null) return;
    const index = dragging;
    dragging = null;
    glide = true;
    dispatch({ type: 'drop', index, before });
  }

  // The New dialog's picks, starting from the current game's settings.
  let choice = $state<Settings>({ ...DEFAULT });
  function askNew() {
    choice = settingsOf(game);
  }
</script>

<GameScreen
  title="Untangle"
  wide
  subtitle={label}
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  onopennew={askNew}
  onstart={(value) => { if (value === 'start') game = newGame(choice, game); }}
  finished={game.done}
  onnext={() => (game = newGame(game, game))}
>
  {#snippet status()}
    {#if !game.done}
      <span class="tangle-count" aria-live="polite" aria-label="{tangle.count} {tangle.count === 1 ? 'crossing' : 'crossings'} left">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        {tangle.count}
      </span>
    {/if}
  {/snippet}
  {#snippet picker()}
    <h3 class="pick-title">Dots</h3>
    <div class="pick">
      {#each Object.entries(SIZES) as [key, s] (key)}
        <button type="button" class="btn" aria-pressed={choice.size === key} onclick={() => (choice.size = key as Size)}>
          <strong>{s.label}</strong>
        </button>
      {/each}
    </div>

    <h3 class="pick-title">Style</h3>
    <div class="pick">
      {#each Object.entries(STYLES) as [key, s] (key)}
        <button type="button" class="btn" aria-pressed={choice.style === key} onclick={() => (choice.style = key as Style)}>
          <strong>{s.label}</strong>
          <span>{key === 'lines' ? 'straight lines' : key === 'mesh' ? 'dense' : 'sparse'}</span>
        </button>
      {/each}
    </div>

    <h3 class="pick-title">Layout</h3>
    <div class="pick starts">
      {#each Object.entries(STARTS) as [key, s] (key)}
        <button type="button" class="btn" aria-pressed={choice.start === key} onclick={() => (choice.start = key as Start)}>
          <strong>{s.label}</strong>
        </button>
      {/each}
    </div>
  {/snippet}

  <div class="board-area" bind:clientWidth={areaW} bind:clientHeight={areaH}>
    <svg
      bind:this={svg}
      class={['untangle-board', { done: game.done, dragging: dragging !== null }]}
      viewBox="0 0 {game.width} {game.height}"
      role="group"
      aria-label="Untangle board"
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerUp}
    >
      <!-- Each line over a casing in the background color, so where lines cross the later one cuts a
           small gap in the earlier and they read as separate strands. -->
      {#each edgeOrder as k (k)}
        {@const [a, b] = game.edges[k]}
        <g class={['edge', { crossed: tangle.crossed[k], active: dragging === a || dragging === b }]}>
          <line class="casing" x1={view[a][0]} y1={view[a][1]} x2={view[b][0]} y2={view[b][1]} />
          <line class="strand" x1={view[a][0]} y1={view[a][1]} x2={view[b][0]} y2={view[b][1]} />
        </g>
      {/each}
      {#each view as [x, y], i (i)}
        <g
          class={['dot', { held: dragging === i, near: neighbors.has(i), touching: tangle.touching[i] }]}
          role="button"
          tabindex="-1"
          aria-label="Dot {i + 1}"
          onpointerdown={(e) => pointerDown(e, i)}
        >
          <circle class="hit" cx={x} cy={y} r="7" />
          <circle class="mark" cx={x} cy={y} r={dragging === i ? r * 1.3 : r} />
        </g>
      {/each}
    </svg>
  </div>
</GameScreen>
