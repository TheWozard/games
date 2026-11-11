<script lang="ts">
  import GameScreen from '../shared/GameScreen.svelte';
  import { PALETTE } from '../shared/palette';
  import RulesPicker from '../shared/RulesPicker.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { generateInBackground } from './background';
  import { gameOf, isGame, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import {
    bridgeWay, connected, DIFFICULTIES, dirOf, dotColor, DIRS, extend, isBridge, isDifficulty, isHole, isSlow, NO_RULES, RULES,
    settle, startStroke, type Difficulty, type Path, type Rule, type Rules,
  } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('easy'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const label = $derived(
    [DIFFICULTIES[game.difficulty].label, ...(Object.keys(RULES) as Rule[]).filter((k) => game.rules[k]).map((k) => RULES[k].label)].join(' · '),
  );
  const board = $derived(game.board);
  const n = $derived(game.size);
  const center = (cell: number) => ({ x: (cell % n) + 0.5, y: Math.floor(cell / n) + 0.5 });
  /** For each square, the color filling it (or -1; bridges stay untinted, as two colors cross there). */
  const fill = $derived.by(() => {
    const out = new Array<number>(n * n).fill(-1);
    game.paths.forEach((p, k) => p.forEach((cell) => { if (!isBridge(cell, board)) out[cell] = k; }));
    return out;
  });

  /**
   * A path as SVG: straight between neighbors, and where it wraps across an edge, out to that edge
   * and back in from the opposite one.
   */
  function pathD(path: Path): string {
    let d = '';
    path.forEach((cell, k) => {
      const p = center(cell);
      if (k === 0) {
        d += `M${p.x} ${p.y}`;
        return;
      }
      const q = center(path[k - 1]);
      if (Math.abs(p.x - q.x) + Math.abs(p.y - q.y) === 1) {
        d += `L${p.x} ${p.y}`;
        return;
      }
      const [dr, dc] = DIRS[dirOf(path[k - 1], cell, board)];
      d += `L${q.x + dc / 2} ${q.y + dr / 2}M${p.x - dc / 2} ${p.y - dr / 2}L${p.x} ${p.y}`;
    });
    return d;
  }

  /**
   * The outer edge pieces a path can wrap across, as lines: one per square along each side, where
   * a path can leave that square over the edge into the square on the opposite side. Left out when
   * either square is a hole, or the one it would come into is a dot (only a dot's own path ends
   * there, and a dot is plain to see).
   */
  const wrapEdges = $derived.by(() => {
    if (!board.wrap) return [];
    const out: string[] = [];
    const i = 0.02; // inset, so the line sits just inside the board
    const into = (cell: number) => !isHole(cell, board) && dotColor(game.dots, cell) === -1;
    // Leaving `from` over its edge into `to`.
    const way = (from: number, to: number) => !isHole(from, board) && into(to);
    for (let k = 0; k < n; k++) {
      const [top, bottom] = [k, (n - 1) * n + k];
      const [left, right] = [k * n, k * n + n - 1];
      if (way(top, bottom)) out.push(`M${k} ${i}H${k + 1}`);
      if (way(bottom, top)) out.push(`M${k} ${n - i}H${k + 1}`);
      if (way(left, right)) out.push(`M${i} ${k}V${k + 1}`);
      if (way(right, left)) out.push(`M${n - i} ${k}V${k + 1}`);
    }
    return out;
  });

  /** Paths crossing each bridge left to right, redrawn over the one going down. */
  const overpasses = $derived(
    board.bridges.flatMap((b) => {
      const k = game.paths.findIndex((p) => p.includes(b) && bridgeWay(p, p.indexOf(b), board) === 'across');
      return k === -1 ? [] : [{ b, k }];
    }),
  );

  const sizes = Object.fromEntries(
    Object.entries(DIFFICULTIES).map(([k, d]) => [k, { label: d.label, detail: `${d.size}×${d.size} · ${d.colors} colors` }]),
  ) as Record<Difficulty, { label: string; detail: string }>;
  // The New Game picks, starting from the current game's; Play starts them.
  let choice = $state<{ difficulty: Difficulty; rules: Rules }>({ difficulty: 'easy', rules: { ...NO_RULES } });

  let drawing = $state(false);

  $effect(() => {
    if (!drawing) saveJSON(STORAGE_KEY, game);
  });

  /** A new game: made here, or for a slow setting in the background (GameScreen shows a spinner). */
  function make(difficulty: Difficulty, rules: Rules): void | Promise<void> {
    if (!isSlow(difficulty, rules)) {
      game = newGame(difficulty, rules);
      return;
    }
    const picked = { ...rules };
    return generateInBackground(difficulty, picked).then((puzzle) => {
      game = gameOf(difficulty, picked, puzzle);
    });
  }

  function start(value: string) {
    if (value === 'start' && isDifficulty(choice.difficulty)) return make(choice.difficulty, choice.rules);
  }

  // ---- Drawing ----
  // Press on a dot or a path and drag through neighboring squares. Fast drags are walked square
  // by square so nothing is skipped. Positions are kept unwrapped (row and column may run past
  // the edges), so on a wrapping board a drag off one side carries on from the opposite one.

  let svg: SVGSVGElement;
  type Spot = { r: number; c: number };
  let stroke: { id: number; color: number; at: Spot; before: Path[] } | null = null;

  function spotAt(e: PointerEvent): Spot {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { r: Math.floor(p.y), c: Math.floor(p.x) };
  }

  /** The square at a spot: wrapped onto the board if it wraps, else null off the edge. */
  function cellOf({ r, c }: Spot): number | null {
    if (board.wrap) return (((r % n) + n) % n) * n + (((c % n) + n) % n);
    return r >= 0 && r < n && c >= 0 && c < n ? r * n + c : null;
  }

  function pointerDown(e: PointerEvent) {
    if (game.done || stroke || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const at = spotAt(e);
    if (at.r < 0 || at.r >= n || at.c < 0 || at.c >= n) return;
    const cell = cellOf(at)!;
    const { color, paths } = startStroke(game.dots, game.paths, cell, board);
    if (color === -1) return;
    svg.setPointerCapture?.(e.pointerId);
    stroke = { id: e.pointerId, color, at, before: game.paths };
    drawing = true;
    dispatch({ type: 'draw', paths });
  }

  function pointerMove(e: PointerEvent) {
    if (!stroke || e.pointerId !== stroke.id) return;
    const target = spotAt(e);
    let paths = game.paths;
    let at = stroke.at;
    while (at.r !== target.r || at.c !== target.c) {
      const next = Math.abs(target.r - at.r) > Math.abs(target.c - at.c)
        ? { r: at.r + Math.sign(target.r - at.r), c: at.c }
        : { r: at.r, c: at.c + Math.sign(target.c - at.c) };
      const cell = cellOf(next);
      if (cell === null) break;
      const moved = extend(game.dots, paths, stroke.color, cell, board);
      if (moved === paths) break; // blocked (another color, a wall) or finished: stop here
      paths = moved;
      at = next;
    }
    // Carry on from the last square reached, so a blocked drag resumes when it comes back.
    stroke.at = at;
    if (paths !== game.paths) dispatch({ type: 'draw', paths });
  }

  function pointerUp(e: PointerEvent) {
    if (!stroke || e.pointerId !== stroke.id) return;
    const { before, color } = stroke;
    stroke = null;
    drawing = false;
    // One let go on a bridge carries on through it, or backs off it (see `settle`); then a stroke
    // left with nothing but its dot leaves no path behind (and, if nothing else changed, no undo step).
    const settled = settle(game.dots, game.paths, color, board);
    if (settled !== game.paths) dispatch({ type: 'draw', paths: settled });
    if (game.paths[color].length === 1) dispatch({ type: 'draw', paths: game.paths.map((p, k) => (k === color ? [] : p)) });
    dispatch({ type: 'commit', before });
  }
</script>

<GameScreen
  title="Flow"
  subtitle={label}
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  onopennew={() => (choice = { difficulty: game.difficulty, rules: { ...game.rules } })}
  onstart={start}
  finished={game.done}
  onnext={() => make(game.difficulty, game.rules)}
  slow={isSlow(choice.difficulty, choice.rules)}
  nextSlow={isSlow(game.difficulty, game.rules)}
>
  {#snippet picker()}
    <RulesPicker {sizes} rules={RULES} bind:size={choice.difficulty} bind:on={choice.rules} />
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
      <!-- Wrapping: the outer edge is dashed wherever a path can wrap to the opposite side. -->
      {#each wrapEdges as d (d)}
        <path class="wrap-edge" {d} />
      {/each}
      <!-- Holes are hatched, inside their usual grid lines, so they read as missing squares. -->
      {#if board.holes.length}
        <defs>
          <pattern id="flow-hatch" width="0.2" height="0.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line class="hatch" x1="0.1" y1="0" x2="0.1" y2="0.2" />
          </pattern>
        </defs>
      {/if}
      {#each board.holes as cell (cell)}
        <rect class="hole-hatch" x={(cell % n) + 0.08} y={Math.floor(cell / n) + 0.08} width="0.84" height="0.84" rx="0.12" fill="url(#flow-hatch)" />
      {/each}
      {#each game.paths as path, k (k)}
        {#if path.length > 1}
          <path class="path" stroke={PALETTE[k]} d={pathD(path)} />
        {/if}
      {/each}
      <!-- Bridges: a tube across the square, open at both ends. Drawn over the paths, its body
           hides a path going down (it passes under); a path going across is drawn again on top. -->
      {#each board.bridges as cell (cell)}
        {@const x = cell % n}
        {@const y = Math.floor(cell / n) + 0.5}
        <!-- Inset from the square's edges, like a hole's hatching, so it doesn't touch the grid lines. -->
        <rect class="bridge-body" x={x + 0.08} y={y - 0.3} width="0.84" height="0.6" />
        <path class="bridge-side" d="M{x + 0.08} {y - 0.3}h0.84M{x + 0.08} {y + 0.3}h0.84" />
      {/each}
      {#each overpasses as { b, k } (b)}
        {@const p = center(b)}
        <line class="path" stroke={PALETTE[k]} x1={p.x - 0.5} y1={p.y} x2={p.x + 0.5} y2={p.y} />
      {/each}

      {#each board.walls as [a, b] (`${a}-${b}`)}
        {@const vertical = b - a === 1}
        {@const x = vertical ? (b % n) : (a % n)}
        {@const y = vertical ? Math.floor(a / n) : Math.floor(b / n)}
        <line class="wall" x1={x} y1={y} x2={vertical ? x : x + 1} y2={vertical ? y + 1 : y} />
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
