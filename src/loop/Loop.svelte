<script lang="ts">
  import GameScreen from '../shared/GameScreen.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { CROSS, isGame, LINE, newGame, reducer, STORAGE_KEY, type Action, type Mark } from './game';
  import { strokeEdges, type Point } from './gesture';
  import { cellEdges, DIFFICULTIES, dotEdges, edgeEnds, isDifficulty } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('easy'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const label = $derived(DIFFICULTIES[game.difficulty].label);
  const edges = $derived(game.marks.map((_, e) => edgeEnds(game, e)));

  // Clue cells: how many of their sides are lines so far.
  const around = $derived(
    game.clues.map((_, i) => cellEdges(game, Math.floor(i / game.cols), i % game.cols).filter((e) => game.marks[e] === LINE).length),
  );
  // Dots where more than two lines meet: the loop would branch there.
  const branching = $derived.by(() => {
    const out: [number, number][] = [];
    for (let r = 0; r <= game.rows; r++) {
      for (let c = 0; c <= game.cols; c++) {
        if (dotEdges(game, r, c).filter((e) => game.marks[e] === LINE).length > 2) out.push([r, c]);
      }
    }
    return out;
  });

  let dragging = $state(false);

  $effect(() => {
    if (!dragging) saveJSON(STORAGE_KEY, game);
  });

  function start(difficulty: string) {
    if (isDifficulty(difficulty)) game = newGame(difficulty);
  }

  // Mouse: left-click a side to add a line (or clear a cross); right-click to remove a line, or to
  // cross out an empty side.
  function add(edge: number) {
    if (!swallowClick) dispatch({ type: 'add', edge });
  }

  function remove(e: MouseEvent, edge: number) {
    e.preventDefault();
    if (!swallowClick) dispatch({ type: 'remove', edge });
  }

  // Touch: drag along a side to add it, drag across a line to remove it (or cross out an empty
  // side). Each side reacts once per drag, and the whole drag is one undo step. The finger must
  // move a little between checks so small wobbles don't count.
  const STEP = 0.14;
  let svg: SVGSVGElement;
  let touch: { id: number; anchor: Point; seen: Set<number>; before: Mark[] } | null = null;
  let swallowClick = false;

  function toBoard(e: PointerEvent): Point {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  }

  function pointerDown(e: PointerEvent) {
    swallowClick = false;
    if (e.pointerType === 'mouse' || game.done || touch) return;
    touch = { id: e.pointerId, anchor: toBoard(e), seen: new Set(), before: game.marks };
  }

  function pointerMove(e: PointerEvent) {
    if (!touch || e.pointerId !== touch.id) return;
    const p = toBoard(e);
    if (Math.hypot(p.x - touch.anchor.x, p.y - touch.anchor.y) < STEP) return;
    if (!dragging) {
      svg.setPointerCapture?.(e.pointerId);
      dragging = true;
      swallowClick = true;
    }
    const { along, across } = strokeEdges(game, touch.anchor, p);
    for (const edge of along) {
      if (!touch.seen.has(edge)) dispatch({ type: 'add', edge, live: true });
      touch.seen.add(edge);
    }
    for (const edge of across) {
      if (!touch.seen.has(edge)) dispatch({ type: 'remove', edge, live: true });
      touch.seen.add(edge);
    }
    touch.anchor = p;
  }

  function pointerUp(e: PointerEvent) {
    if (!touch || e.pointerId !== touch.id) return;
    const before = touch.before;
    touch = null;
    if (dragging) {
      dragging = false;
      dispatch({ type: 'commit', before });
    }
  }
</script>

<GameScreen
  title="Loop"
  subtitle={label}
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  inProgress={!game.done && game.history.length > 0}
  options={Object.entries(DIFFICULTIES).map(([value, d]) => ({ value, label: `${d.label} · ${d.cols}×${d.rows}` }))}
  onstart={start}
  finished={game.done}
  onnext={() => (game = newGame(game.difficulty))}
>
  <div class="board-area">
    <svg
      bind:this={svg}
      class={['loop-board', { done: game.done }]}
      viewBox="-0.45 -0.45 {game.cols + 0.9} {game.rows + 0.9}"
      style:--cols={game.cols}
      style:--rows={game.rows}
      role="group"
      aria-label="Loop board"
      oncontextmenu={(e) => e.preventDefault()}
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerUp}
    >
      {#each game.clues as clue, i (i)}
        {#if clue !== null}
          <text
            class={['clue', { met: clue > 0 && around[i] === clue, over: around[i] > clue }]}
            x={(i % game.cols) + 0.5}
            y={Math.floor(i / game.cols) + 0.53}
          >{clue}</text>
        {/if}
      {/each}

      {#each edges as [[r1, c1], [r2, c2]], e (e)}
        {#if game.marks[e] === LINE}
          <line class="line" x1={c1} y1={r1} x2={c2} y2={r2} />
        {:else if game.marks[e] === CROSS}
          {@const x = (c1 + c2) / 2}
          {@const y = (r1 + r2) / 2}
          <path class="cross" d="M{x - 0.09} {y - 0.09}l0.18 0.18M{x + 0.09} {y - 0.09}l-0.18 0.18" />
        {/if}
        <!-- Wide invisible target: left-click adds a line, right-click removes it or crosses out. -->
        <line
          class="hit"
          x1={c1}
          y1={r1}
          x2={c2}
          y2={r2}
          role="button"
          tabindex="-1"
          aria-label="Side"
          onclick={() => add(e)}
          oncontextmenu={(event) => remove(event, e)}
          onkeydown={() => {}}
        />
      {/each}

      {#each { length: game.rows + 1 } as _, r (r)}
        {#each { length: game.cols + 1 } as _, c (c)}
          <circle class={['dot', { bad: branching.some(([y, x]) => y === r && x === c) }]} cx={c} cy={r} r="0.08" />
        {/each}
      {/each}
    </svg>
  </div>
</GameScreen>
