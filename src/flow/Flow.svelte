<script lang="ts">
  import GameScreen from '../shared/GameScreen.svelte';
  import { toastOnFinish } from '../shared/finish.svelte';
  import { PALETTE } from '../shared/palette';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { allJoined, isGame, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import { connected, DIFFICULTIES, extend, isDifficulty, startStroke, type Path } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('easy'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const label = $derived(DIFFICULTIES[game.difficulty].label);
  const n = $derived(game.size);
  const center = (cell: number) => ({ x: (cell % n) + 0.5, y: Math.floor(cell / n) + 0.5 });
  /** For each square, the color filling it (or -1). */
  const fill = $derived.by(() => {
    const out = new Array<number>(n * n).fill(-1);
    game.paths.forEach((p, k) => p.forEach((cell) => (out[cell] = k)));
    return out;
  });
  const filled = $derived(fill.filter((k) => k !== -1).length);

  let drawing = $state(false);

  $effect(() => {
    if (!drawing) saveJSON(STORAGE_KEY, game);
  });
  toastOnFinish(() => !drawing && allJoined(game), () => 'Every pair is joined. Now fill every square.');

  function start(difficulty: string) {
    if (isDifficulty(difficulty)) game = newGame(difficulty);
  }

  // ---- Drawing ----
  // Press on a dot or a path and drag through neighboring squares. Fast drags are walked square
  // by square so nothing is skipped.

  let svg: SVGSVGElement;
  let stroke: { id: number; color: number; at: number; before: Path[] } | null = null;

  function cellAt(e: PointerEvent): number | null {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    const c = Math.floor(p.x);
    const r = Math.floor(p.y);
    return r >= 0 && r < n && c >= 0 && c < n ? r * n + c : null;
  }

  function pointerDown(e: PointerEvent) {
    if (game.done || stroke || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const cell = cellAt(e);
    if (cell === null) return;
    const { color, paths } = startStroke(game.dots, game.paths, cell);
    if (color === -1) return;
    svg.setPointerCapture?.(e.pointerId);
    stroke = { id: e.pointerId, color, at: cell, before: game.paths };
    drawing = true;
    dispatch({ type: 'draw', paths });
  }

  function pointerMove(e: PointerEvent) {
    if (!stroke || e.pointerId !== stroke.id) return;
    const target = cellAt(e);
    if (target === null || target === stroke.at) return;
    let paths = game.paths;
    let at = stroke.at;
    while (at !== target) {
      const [r, c] = [Math.floor(at / n), at % n];
      const [tr, tc] = [Math.floor(target / n), target % n];
      const next = Math.abs(tr - r) > Math.abs(tc - c) ? at + Math.sign(tr - r) * n : at + Math.sign(tc - c);
      const moved = extend(game.dots, paths, stroke.color, next, n);
      if (moved === paths) break; // blocked (another color) or finished: stop here
      paths = moved;
      at = next;
    }
    // Carry on from wherever the path really ends, so a blocked drag resumes when it comes back.
    stroke.at = paths[stroke.color].at(-1) ?? at;
    if (paths !== game.paths) dispatch({ type: 'draw', paths });
  }

  function pointerUp(e: PointerEvent) {
    if (!stroke || e.pointerId !== stroke.id) return;
    const before = stroke.before;
    stroke = null;
    drawing = false;
    dispatch({ type: 'commit', before });
  }
</script>

<GameScreen
  title="Flow"
  subtitle={label}
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  inProgress={!game.done && game.history.length > 0}
  options={Object.entries(DIFFICULTIES).map(([value, d]) => ({ value, label: `${d.label} · ${d.size}×${d.size}, ${d.colors} colors` }))}
  onstart={start}
  finished={game.done}
  onnext={() => (game = newGame(game.difficulty))}
>
  {#snippet status()}
    <span class="flow-count" aria-label="{filled} of {n * n} squares filled">{Math.round((filled / (n * n)) * 100)}%</span>
  {/snippet}

  <div class="board-area">
    <svg
      bind:this={svg}
      class={['flow-board', { done: game.done }]}
      viewBox="0 0 {n} {n}"
      role="group"
      aria-label="Flow board"
      onpointerdown={pointerDown}
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerUp}
    >
      {#each fill as k, cell (cell)}
        <rect class="square" x={cell % n} y={Math.floor(cell / n)} width="1" height="1" fill={k === -1 ? undefined : PALETTE[k]} fill-opacity={k === -1 ? undefined : 0.16} />
      {/each}
      {#each { length: n - 1 } as _, i (i)}
        <line class="grid" x1={i + 1} y1="0" x2={i + 1} y2={n} />
        <line class="grid" x1="0" y1={i + 1} x2={n} y2={i + 1} />
      {/each}

      {#each game.paths as path, k (k)}
        {#if path.length > 1}
          <polyline class="path" stroke={PALETTE[k]} points={path.map((cell) => `${center(cell).x},${center(cell).y}`).join(' ')} />
        {/if}
      {/each}

      {#each game.dots as pair, k (k)}
        {#each pair as cell (cell)}
          {@const p = center(cell)}
          <circle class={['dot', { joined: connected(game.dots, game.paths, k) }]} cx={p.x} cy={p.y} r="0.32" fill={PALETTE[k]} />
        {/each}
      {/each}
    </svg>
  </div>
</GameScreen>
