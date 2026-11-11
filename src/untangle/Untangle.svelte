<script lang="ts">
  import Dialog from '../shared/Dialog.svelte';
  import BackButton from '../shared/BackButton.svelte';
  import NewButton from '../shared/NewButton.svelte';
  import NextButton from '../shared/NextButton.svelte';
  import UndoButton from '../shared/UndoButton.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { DEFAULT, describe, fromSaved, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import { crossings, dotRadius, HEIGHT, SIZES, STARTS, STYLES, WIDTH, type Point, type Settings, type Size, type Start, type Style } from './logic';

  const anything = (_value: unknown): _value is unknown => true;
  let game = $state.raw(fromSaved(loadJSON(STORAGE_KEY, anything)) ?? newGame(DEFAULT));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const tangle = $derived(crossings(game.points, game.edges));
  const label = $derived(describe(game));
  const r = $derived(dotRadius(game.points.length));

  let askingNew = $state(false);
  let svg: SVGSVGElement;

  // The dot being dragged, where it started, and the layout before the drag (for undo).
  let dragging = $state<number | null>(null);
  let grab: Point = [0, 0];
  let before: Point[] = [];

  const neighbors = $derived(
    dragging === null ? new Set<number>() : new Set(game.edges.flatMap(([a, b]) => (a === dragging ? [b] : b === dragging ? [a] : []))),
  );

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
    dispatch({ type: 'drop', index, before });
  }

  // The New dialog's picks, starting from the current game's settings.
  let choice = $state<Settings>({ ...DEFAULT });
  function askNew() {
    choice = { size: game.size, style: game.style, start: game.start };
    askingNew = true;
  }

  function onKey(e: KeyboardEvent) {
    if (document.querySelector('dialog[open]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      dispatch({ type: 'undo' });
    }
  }
</script>

<svelte:document onkeydown={onKey} />

<header class="bar">
  <BackButton />
  <h1>Untangle <small>{label}</small></h1>
  {#if !game.done}
    <span class="tangle-count" aria-live="polite" aria-label="{tangle.count} {tangle.count === 1 ? 'crossing' : 'crossings'} left">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
      {tangle.count}
    </span>
  {/if}
  <UndoButton disabled={game.done || game.history.length === 0} onclick={() => dispatch({ type: 'undo' })} />
  <NewButton onclick={askNew} />
</header>

<main class="play">
  <div class="board-area">
    <svg
      bind:this={svg}
      class={['untangle-board', { done: game.done, dragging: dragging !== null }]}
      viewBox="0 0 {WIDTH} {HEIGHT}"
      role="group"
      aria-label="Untangle board"
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerUp}
    >
      {#each game.edges as [a, b], k (k)}
        <line
          class={['edge', { crossed: tangle.crossed[k], active: dragging === a || dragging === b }]}
          x1={game.points[a][0]}
          y1={game.points[a][1]}
          x2={game.points[b][0]}
          y2={game.points[b][1]}
        />
      {/each}
      {#each game.points as [x, y], i (i)}
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



</main>

<NextButton show={game.done} onclick={() => (game = newGame({ size: game.size, style: game.style, start: game.start }))} />

<Dialog open={askingNew} onclose={(value) => { askingNew = false; if (value === 'start') game = newGame(choice); }}>
  <h2>New game</h2>
  {#if !game.done && game.history.length > 0}<p>This replaces the game in progress.</p>{/if}

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

  <h3 class="pick-title">Start</h3>
  <div class="pick">
    {#each Object.entries(STARTS) as [key, s] (key)}
      <button type="button" class="btn" aria-pressed={choice.start === key} onclick={() => (choice.start = key as Start)}>
        <strong>{s.label}</strong>
      </button>
    {/each}
  </div>

  <button class="btn primary" value="start">Start · {describe(choice)}</button>
  <button class="btn" value="">Cancel</button>
</Dialog>
