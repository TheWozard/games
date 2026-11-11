<script lang="ts">
  import Dialog from '../shared/Dialog.svelte';
  import BackButton from '../shared/BackButton.svelte';
  import NewButton from '../shared/NewButton.svelte';
  import NextButton from '../shared/NextButton.svelte';
  import UndoButton from '../shared/UndoButton.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { buildable, counts, edgesFor, isGame, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import { center, dragEdge, islandAt, swipedEdges, type Point } from './gesture';
  import { DIFFICULTIES, isDifficulty } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('easy'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const edges = $derived(edgesFor(game).edges);
  const have = $derived(counts(game));
  const label = $derived(DIFFICULTIES[game.difficulty].label);
  const at = (i: number) => ({ x: game.islands[i].c + 0.5, y: game.islands[i].r + 0.5 });

  let askingNew = $state(false);

  $effect(() => saveJSON(STORAGE_KEY, game));

  function start(difficulty: string) {
    if (isDifficulty(difficulty)) game = newGame(difficulty);
  }

  // ---- Gestures ----
  // Drag from an island toward another to build one more bridge; swipe across a bridge (starting
  // away from an island) to remove one. A press that barely moves stays an ordinary tap (a tap on
  // the gap between islands cycles 0 → 1 → 2 → 0); once a gesture starts, the click that follows
  // is ignored.

  const START = 0.3; // board units a press must travel before it counts as a gesture
  let svg: SVGSVGElement;
  let press: { id: number; start: Point; from: number | null } | null = null;
  let gesture = $state<
    | { kind: 'build'; from: number; to: Point; edge: number }
    | { kind: 'swipe'; last: Point; trail: Point[]; cut: Set<number> }
    | null
  >(null);
  let swallowClick = false;

  function toBoard(e: PointerEvent): Point {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  }

  function pointerDown(e: PointerEvent) {
    swallowClick = false;
    if (game.done || press || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const start = toBoard(e);
    press = { id: e.pointerId, start, from: islandAt(game, start) };
  }

  function pointerMove(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    const p = toBoard(e);
    if (!gesture) {
      if (Math.hypot(p.x - press.start.x, p.y - press.start.y) < START) return;
      svg.setPointerCapture?.(e.pointerId);
      swallowClick = true;
      gesture = press.from !== null
        ? { kind: 'build', from: press.from, to: p, edge: -1 }
        : { kind: 'swipe', last: press.start, trail: [press.start], cut: new Set() };
    }
    if (gesture.kind === 'build') {
      const edge = dragEdge(game, gesture.from, p);
      gesture = { ...gesture, to: p, edge: edge >= 0 && buildable(game, edge) ? edge : -1 };
    } else {
      // Each bridge crossed loses one, once per swipe.
      for (const k of swipedEdges(game, gesture.last, p)) {
        if (gesture.cut.has(k)) continue;
        gesture.cut.add(k);
        dispatch({ type: 'remove', edge: k });
      }
      gesture = { ...gesture, last: p, trail: [...gesture.trail, p].slice(-24) };
    }
  }

  function pointerUp(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    if (gesture?.kind === 'build' && gesture.edge >= 0) dispatch({ type: 'build', edge: gesture.edge });
    press = null;
    gesture = null;
  }

  function pointerCancel() {
    press = null;
    gesture = null;
  }

  function tapEdge(k: number) {
    if (!swallowClick) dispatch({ type: 'cycle', edge: k });
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
  <h1>Bridges <small>{label}</small></h1>
  <UndoButton disabled={game.done || game.history.length === 0} onclick={() => dispatch({ type: 'undo' })} />
  <NewButton onclick={() => (askingNew = true)} />
</header>

<main class="play">
  <div class="board-area">
    <svg
      bind:this={svg}
      class="bridges-board"
      viewBox="-0.25 -0.25 {game.cols + 0.5} {game.rows + 0.5}"
      style:--cols={game.cols}
      style:--rows={game.rows}
      role="group"
      aria-label="Bridges board"
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerCancel}
    >
      <!-- Faint dots on every cell, to make rows and columns easy to follow. -->
      {#each { length: game.rows } as _, r (r)}
        {#each { length: game.cols } as _, c (c)}
          <circle class="dot" cx={c + 0.5} cy={r + 0.5} r="0.035" />
        {/each}
      {/each}

      {#each edges as e, k (k)}
        {@const a = at(e.a)}
        {@const b = at(e.b)}
        {@const n = game.bridges[k]}
        {#if n === 1}
          <line class="bridge" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
        {:else if n === 2}
          {@const dx = e.horizontal ? 0 : 0.1}
          {@const dy = e.horizontal ? 0.1 : 0}
          <line class="bridge" x1={a.x - dx} y1={a.y - dy} x2={b.x - dx} y2={b.y - dy} />
          <line class="bridge" x1={a.x + dx} y1={a.y + dy} x2={b.x + dx} y2={b.y + dy} />
        {/if}
        <!-- Wide invisible target: tap the gap between two islands to cycle its bridges. -->
        <line
          class="hit"
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          role="button"
          tabindex="-1"
          aria-label="Bridge between islands, {n} built"
          onclick={() => tapEdge(k)}
          onkeydown={() => {}}
        />
      {/each}

      <!-- Gesture feedback: where a drag will build, or the trail of a swipe. -->
      {#if gesture?.kind === 'build'}
        {@const from = center(game, gesture.from)}
        {@const e = edges[gesture.edge]}
        {#if e}
          {@const to = center(game, e.a === gesture.from ? e.b : e.a)}
          <line class="preview" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
        {:else}
          <line class="preview loose" x1={from.x} y1={from.y} x2={gesture.to.x} y2={gesture.to.y} />
        {/if}
      {:else if gesture?.kind === 'swipe'}
        <polyline class="trail" points={gesture.trail.map((p) => `${p.x},${p.y}`).join(' ')} />
      {/if}

      {#each game.islands as s, i (i)}
        <g
          class={['island', { full: have[i] === s.n, over: have[i] > s.n }]}
          role="img"
          aria-label="Island {s.n}, {have[i]} bridges"
        >
          <circle class="hit-island" cx={s.c + 0.5} cy={s.r + 0.5} r="0.5" />
          <circle class="ring" cx={s.c + 0.5} cy={s.r + 0.5} r="0.37" />
          <text x={s.c + 0.5} y={s.r + 0.53}>{s.n}</text>
        </g>
      {/each}
    </svg>
  </div>

</main>

<NextButton show={game.done} onclick={() => (game = newGame(game.difficulty))} />

<Dialog open={askingNew} onclose={(value) => { askingNew = false; start(value); }}>
  <h2>New game</h2>
  {#if !game.done && game.history.length > 0}<p>This replaces the game in progress.</p>{/if}
  {#each Object.entries(DIFFICULTIES) as [key, d] (key)}
    <button class="btn" value={key}>{d.label} · {d.cols}×{d.rows}</button>
  {/each}
  <button class="btn" value="">Cancel</button>
</Dialog>
