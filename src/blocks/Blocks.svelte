<script lang="ts">
  import GameScreen from '../shared/GameScreen.svelte';
  import { PALETTE } from '../shared/palette';
  import { loadJSON, saveJSON } from '../shared/storage';
  import {
    difficultyOf,
    isGame,
    LEVEL_LIST,
    newGame,
    reducer,
    STORAGE_KEY,
    type Action,
  } from './game';
  import {
    isOut,
    isVariant,
    LEVELS,
    range,
    shape,
    VARIANTS,
    type Difficulty,
    type Variant,
  } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('classic'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  $effect(() => saveJSON(STORAGE_KEY, game));

  const s = $derived(shape(game.variant));
  const size = $derived(s.size);

  // The New Game picks: a variant (tabs), and which of its levels (the next one unless another is
  // picked). Play starts them.
  let choice = $state<{ level: number; variant: Variant }>({ variant: 'classic', level: 0 });

  function pick(variant: Variant) {
    choice = { variant, level: game.upNext[variant] % LEVEL_LIST[variant].length };
  }

  // Counts puzzles started here: the board's blocks are drawn afresh for each one (see the {#key}
  // below), so they appear in place instead of sliding over from where the last puzzle left them.
  let round = $state(0);

  function begin(next: typeof game) {
    game = next;
    pastEdge = {};
    round++;
  }

  function start(value: string) {
    if (value === 'start' && isVariant(choice.variant))
      begin(newGame(choice.variant, game.upNext, choice.level));
  }

  // ---- Dragging ----
  // Press a block and drag it along its length; it follows the finger as far as it's free to go,
  // then settles on the nearest square when let go. With its way clear, a key block can be
  // dragged on out through its exit; let go at or past the edge and it's out.

  let svg: SVGSVGElement;
  // Per key block, how far past the edge it was let go, so it carries on out from there.
  let pastEdge = $state<Record<number, number>>({});
  let held = $state<null | {
    at: number;
    from: number;
    hi: number;
    id: number;
    index: number;
    lo: number;
    offset: number;
  }>(null);

  function along(e: PointerEvent, across: boolean): number {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return across ? p.x : p.y;
  }

  function pointerDown(e: PointerEvent, index: number) {
    const b = game.blocks[index];
    if (
      game.done ||
      held ||
      b.fixed ||
      isOut(game.blocks, index, s) ||
      (e.pointerType === 'mouse' && e.button !== 0)
    )
      return;
    let [lo, hi] = range(game.blocks, index, s);
    if (index < s.keys && hi === size - b.len) hi = size;
    svg.setPointerCapture?.(e.pointerId);
    held = {
      id: e.pointerId,
      index,
      from: along(e, b.across),
      at: b.across ? b.c : b.r,
      lo,
      hi,
      offset: 0,
    };
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
    if (index < s.keys)
      pastEdge = { ...pastEdge, [index]: Math.max(0, at + offset - (size - b.len)) };
    dispatch({ type: 'slide', index, to: Math.min(Math.round(at + offset), size - b.len) });
  }

  const INSET = 0.07;

  // Each exit arrow sits just past its edge, level with its key block's line.
  const EDGE = 0.15;
  /** A key block's color: red, and blue for the second. */
  const keyColor = (i: number) => PALETTE[i];
  /** Each other block's tint of blue (0–4): steps of 3 through five, so blocks listed together differ. */
  const tint = (i: number) => (i * 3) % 5;

  /** A variant's levels in sections, one per difficulty, each with the range of moves its levels take. */
  const sections = (variant: Variant) =>
    (Object.keys(LEVELS) as Difficulty[]).map((difficulty) => {
      const levels = LEVEL_LIST[variant].flatMap((l, level) =>
        l.difficulty === difficulty ? [level] : [],
      );
      const fewest = levels.map((level) => LEVEL_LIST[variant][level].fewest);
      const [lo, hi] = [Math.min(...fewest), Math.max(...fewest)];
      return {
        difficulty,
        label: LEVELS[difficulty].label,
        moves: lo === hi ? `${lo} moves` : `${lo}–${hi} moves`,
        levels,
      };
    });
</script>

<GameScreen
  canUndo={!game.done && game.history.length > 0}
  finished={game.done}
  onnext={() => begin(newGame(game.variant, game.upNext))}
  onopennew={() => pick(game.variant)}
  onstart={start}
  onundo={() => dispatch({ type: 'undo' })}
  subtitle="{VARIANTS[game.variant].label} · {LEVELS[difficultyOf(game)].label} · No. {game.level +
    1}"
  title="Sliding Blocks"
>
  {#snippet picker()}
    <div class="pick-tabs" aria-label="Variant" role="tablist">
      {#each Object.entries(VARIANTS) as [key, v] (key)}
        <button
          aria-selected={choice.variant === key}
          onclick={() => pick(key as Variant)}
          role="tab"
          type="button"
        >
          {v.label}
        </button>
      {/each}
    </div>
    {#each sections(choice.variant) as { difficulty, label, moves, levels } (difficulty)}
      <h3 class="pick-title blocks-section">{label} <span>{moves}</span></h3>
      <div class="blocks-levels">
        {#each levels as level (level)}
          <button
            class="btn"
            aria-label="No. {level + 1}, {label}"
            aria-pressed={choice.level === level}
            onclick={() => (choice = { ...choice, level })}
            type="button"
          >
            {level + 1}
          </button>
        {/each}
      </div>
    {/each}
  {/snippet}
  {#snippet status()}
    <!-- Just the fewest moves it can be done in (a flag: the mark to aim for), no count of the player's own. -->
    <span class="blocks-count" aria-label="It can be done in {game.fewest} moves">
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <path
          d="M4 14V2.5M4 3h8l-2 3 2 3H4"
          fill="none"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.6"
        />
      </svg>
      {game.fewest}
    </span>
  {/snippet}

  <div class="board-area">
    <svg
      bind:this={svg}
      class={['blocks-board', { done: game.done, holding: held !== null }]}
      aria-label="Sliding blocks board"
      onpointercancel={pointerUp}
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      role="group"
      viewBox="-0.3 -0.3 {size + 0.6} {size + 0.6}"
    >
      {#each { length: size * size } as _, sq (sq)}
        <circle class="spot" cx={(sq % size) + 0.5} cy={Math.floor(sq / size) + 0.5} r="0.05" />
      {/each}
      <!-- Exits: an arrow past the right-hand edge on the first key block's row, and (Two Keys) one
           under the bottom edge in the second's column, each in its key block's color. -->
      <path
        style:stroke={s.keys > 1 ? keyColor(0) : undefined}
        class="exit-mark"
        d="M{size + EDGE + 0.1} {s.exitRow + 0.36}l0.14 0.14l-0.14 0.14"
      />
      {#if s.keys > 1}
        <path
          style:stroke={keyColor(1)}
          class="exit-mark"
          d="M{s.exitCol + 0.36} {size + EDGE + 0.1}l0.14 0.14l0.14 -0.14"
        />
      {/if}

      {#key round}
        {#each game.blocks as b, i (i)}
          {@const moving = held?.index === i}
          {@const out = !moving && isOut(game.blocks, i, s)}
          {@const shift =
            moving ? held!.offset
            : out ? (pastEdge[i] ?? 0)
            : 0}
          {#if b.fixed}
            <rect class="pillar" height="0.6" rx="0.12" width="0.6" x={b.c + 0.2} y={b.r + 0.2} />
          {:else}
            <g
              style:transform="translate({b.c + (b.across ? shift : 0)}px, {b.r +
                (b.across ? 0 : shift)}px)"
              style:--away={b.across ? '2.4px 0' : '0 2.4px'}
              style:--tint={tint(i)}
              class={['block', { key: i < s.keys, moving, out }]}
              aria-label={i < s.keys ? 'Key block' : `Block ${b.across ? 'across' : 'down'}`}
              onpointerdown={(e) => pointerDown(e, i)}
              role="button"
              tabindex="-1"
            >
              <rect
                style:fill={i < s.keys ? keyColor(i) : undefined}
                height={(b.across ? 1 : b.len) - INSET * 2}
                rx="0.2"
                width={(b.across ? b.len : 1) - INSET * 2}
                x={INSET}
                y={INSET}
              />
            </g>
          {/if}
        {/each}
      {/key}
    </svg>
  </div>
</GameScreen>
