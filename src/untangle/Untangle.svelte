<script lang="ts">
  import Dialog from '../shared/Dialog.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { isGame, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import { crossings, DIFFICULTIES, HEIGHT, isDifficulty, WIDTH, type Point } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('easy'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const tangle = $derived(crossings(game.points, game.edges));
  const label = $derived(DIFFICULTIES[game.difficulty].label);

  let askingNew = $state(false);
  let svg: SVGSVGElement;

  // The dot being dragged, where it started, and the layout before the drag (for undo).
  let dragging = $state<number | null>(null);
  let grab: Point = [0, 0];
  let before: Point[] = [];

  const neighbours = $derived(
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
    navigator.vibrate?.(8);
  }

  function pointerMove(e: PointerEvent) {
    if (dragging === null) return;
    const [x, y] = toBoard(e);
    dispatch({ type: 'drag', index: dragging, to: [x + grab[0], y + grab[1]] });
  }

  function pointerUp() {
    if (dragging === null) return;
    dragging = null;
    dispatch({ type: 'drop', before });
  }

  function start(difficulty: string) {
    if (isDifficulty(difficulty)) game = newGame(difficulty);
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
  <a class="back" href="../">‹ Games</a>
  <h1>Untangle <small>{label}</small></h1>
  {#if !game.done}<span class="tangle-count" aria-live="polite">{tangle.count} {tangle.count === 1 ? 'crossing' : 'crossings'}</span>{/if}
</header>

<main class="play">
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
        class={['dot', { held: dragging === i, near: neighbours.has(i) }]}
        role="button"
        tabindex="-1"
        aria-label="Dot {i + 1}"
        onpointerdown={(e) => pointerDown(e, i)}
      >
        <circle class="hit" cx={x} cy={y} r="7" />
        <circle class="mark" cx={x} cy={y} r={dragging === i ? 3.6 : 2.8} />
      </g>
    {/each}
  </svg>

  <div class="tools">
    <button type="button" class="btn" disabled={game.done || game.history.length === 0} onclick={() => dispatch({ type: 'undo' })}>Undo</button>
    <button type="button" class="btn" onclick={() => (askingNew = true)}>New</button>
  </div>

  {#if game.done}
    <div class="settled">
      <p>Untangled in {game.moves} {game.moves === 1 ? 'move' : 'moves'}.</p>
      <button type="button" class="btn primary" onclick={() => start(game.difficulty)}>Next</button>
    </div>
  {:else}
    <p class="hint">Drag the dots until no lines cross.</p>
  {/if}
</main>

<Dialog open={askingNew} onclose={(value) => { askingNew = false; start(value); }}>
  <h2>New game</h2>
  {#each Object.entries(DIFFICULTIES) as [key, d] (key)}
    <button class="btn" value={key}>{d.label} · {(d.lines * (d.lines - 1)) / 2} dots</button>
  {/each}
  <button class="btn" value="">Cancel</button>
</Dialog>
