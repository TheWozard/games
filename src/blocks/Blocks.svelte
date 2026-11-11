<script lang="ts">
  import GameScreen from '../shared/GameScreen.svelte';
  import { PALETTE } from '../shared/palette';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { isGame, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import { DIFFICULTIES, EXIT_ROW, isDifficulty, range, SIZE, type Difficulty } from './logic';
  import { PUZZLES } from './puzzles';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('easy'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  $effect(() => saveJSON(STORAGE_KEY, game));

  function start(value: string) {
    if (isDifficulty(value)) game = newGame(value, game.upNext);
  }

  // ---- Dragging ----
  // Press a block and drag it along its length; it follows the finger as far as it's free to go,
  // then settles on the nearest square when let go. With its way clear, the key block can be
  // dragged on out through the exit; let go at or past the edge and it's free.

  let svg: SVGSVGElement;
  // How far past the edge the key block was let go, so it carries on out from there.
  let pastEdge = $state(0);
  let held = $state<{ id: number; index: number; from: number; at: number; lo: number; hi: number; offset: number } | null>(null);

  function along(e: PointerEvent, across: boolean): number {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return across ? p.x : p.y;
  }

  function pointerDown(e: PointerEvent, index: number) {
    if (game.done || held || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const b = game.blocks[index];
    let [lo, hi] = range(game.blocks, index);
    if (index === 0 && hi === SIZE - b.len) hi = SIZE;
    svg.setPointerCapture?.(e.pointerId);
    held = { id: e.pointerId, index, from: along(e, b.across), at: b.across ? b.c : b.r, lo, hi, offset: 0 };
  }

  function pointerMove(e: PointerEvent) {
    if (!held || e.pointerId !== held.id) return;
    const b = game.blocks[held.index];
    const to = Math.min(held.hi, Math.max(held.lo, held.at + along(e, b.across) - held.from));
    held = { ...held, offset: to - held.at };
  }

  function pointerUp(e: PointerEvent) {
    if (!held || e.pointerId !== held.id) return;
    const { index, at, offset } = held;
    held = null;
    const b = game.blocks[index];
    pastEdge = index === 0 ? Math.max(0, at + offset - (SIZE - b.len)) : 0;
    dispatch({ type: 'slide', index, to: Math.min(Math.round(at + offset), SIZE - b.len) });
  }

  const INSET = 0.07;

  // The exit arrow sits just past the right-hand edge, level with the key block's row.
  const EDGE = 0.15;

  /** The New Game choices, with the range of moves each difficulty's puzzles take. */
  const options = (Object.keys(DIFFICULTIES) as Difficulty[]).map((value) => {
    const fewest = PUZZLES[value].map(([n]) => n);
    return { value, label: DIFFICULTIES[value].label, detail: `${Math.min(...fewest)}–${Math.max(...fewest)} moves` };
  });
</script>

<GameScreen
  title="Sliding Blocks"
  subtitle="{DIFFICULTIES[game.difficulty].label} · No. {game.number + 1}"
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  {options}
  current={game.difficulty}
  onstart={start}
  finished={game.done}
  onnext={() => (game = newGame(game.difficulty, game.upNext))}
>
  {#snippet status()}
    <span class="blocks-count" aria-label="{game.moves} moves; it can be done in {game.fewest}">{game.moves}<small>/{game.fewest}</small></span>
  {/snippet}

  <div class="board-area">
    <svg
      bind:this={svg}
      class={['blocks-board', { done: game.done, holding: held !== null }]}
      viewBox="-0.3 -0.3 {SIZE + 0.6} {SIZE + 0.6}"
      role="group"
      aria-label="Sliding blocks board"
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerUp}
    >
      {#each { length: SIZE * SIZE } as _, sq (sq)}
        <circle class="spot" cx={(sq % SIZE) + 0.5} cy={Math.floor(sq / SIZE) + 0.5} r="0.05" />
      {/each}
      <path class="exit-mark" d="M{SIZE + EDGE + 0.1} {EXIT_ROW + 0.36}l0.14 0.14l-0.14 0.14" />

      {#each game.blocks as b, i (i)}
        {@const moving = held?.index === i}
        {@const shift = moving ? held!.offset : i === 0 && game.done ? pastEdge : 0}
        <g
          class={['block', { key: i === 0, moving }]}
          style:transform="translate({b.c + (b.across ? shift : 0)}px, {b.r + (b.across ? 0 : shift)}px)"
          role="button"
          tabindex="-1"
          aria-label={i === 0 ? 'Key block' : `Block ${b.across ? 'across' : 'down'}`}
          onpointerdown={(e) => pointerDown(e, i)}
        >
          <rect
            x={INSET}
            y={INSET}
            width={(b.across ? b.len : 1) - INSET * 2}
            height={(b.across ? 1 : b.len) - INSET * 2}
            rx="0.2"
            style:fill={i === 0 ? PALETTE[0] : undefined}
          />
        </g>
      {/each}
    </svg>
  </div>
</GameScreen>
