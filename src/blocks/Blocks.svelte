<script lang="ts">
  import GameScreen from '../shared/GameScreen.svelte';
  import { PALETTE } from '../shared/palette';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { isGame, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import { isDifficulty, isOut, isVariant, LEVELS, range, shape, VARIANTS, type Difficulty, type Variant } from './logic';
  import { PUZZLES } from './puzzles';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('classic', 'easy'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  $effect(() => saveJSON(STORAGE_KEY, game));

  const s = $derived(shape(game.variant));
  const size = $derived(s.size);

  // The New Game picks: a variant (tabs), a difficulty, and which of its puzzles (the next one
  // unless another is picked). Play starts them.
  let choice = $state<{ variant: Variant; difficulty: Difficulty; number: number }>({ variant: 'classic', difficulty: 'easy', number: 0 });

  function pick(variant: Variant, difficulty: Difficulty) {
    choice = { variant, difficulty, number: game.upNext[variant][difficulty] % PUZZLES[variant][difficulty].length };
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
    if (value === 'start' && isVariant(choice.variant) && isDifficulty(choice.difficulty)) {
      begin(newGame(choice.variant, choice.difficulty, game.upNext, choice.number));
    }
  }

  // ---- Dragging ----
  // Press a block and drag it along its length; it follows the finger as far as it's free to go,
  // then settles on the nearest square when let go. With its way clear, a key block can be
  // dragged on out through its exit; let go at or past the edge and it's out.

  let svg: SVGSVGElement;
  // Per key block, how far past the edge it was let go, so it carries on out from there.
  let pastEdge = $state<Record<number, number>>({});
  let held = $state<{ id: number; index: number; from: number; at: number; lo: number; hi: number; offset: number } | null>(null);

  function along(e: PointerEvent, across: boolean): number {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return across ? p.x : p.y;
  }

  function pointerDown(e: PointerEvent, index: number) {
    const b = game.blocks[index];
    if (game.done || held || b.fixed || isOut(game.blocks, index, s) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    let [lo, hi] = range(game.blocks, index, s);
    if (index < s.keys && hi === size - b.len) hi = size;
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
    if (index < s.keys) pastEdge = { ...pastEdge, [index]: Math.max(0, at + offset - (size - b.len)) };
    dispatch({ type: 'slide', index, to: Math.min(Math.round(at + offset), size - b.len) });
  }

  const INSET = 0.07;

  // Each exit arrow sits just past its edge, level with its key block's line.
  const EDGE = 0.15;
  /** A key block's color: red, and blue for the second. */
  const keyColor = (i: number) => PALETTE[i];
  /** Each other block's tint of blue (0–4): steps of 3 through five, so blocks listed together differ. */
  const tint = (i: number) => (i * 3) % 5;

  /** The New Game difficulties for a variant, with the range of moves its puzzles take. */
  const options = (variant: Variant) => (Object.keys(LEVELS) as Difficulty[]).map((value) => {
    const fewest = PUZZLES[variant][value].map(([n]) => n);
    return { value, label: LEVELS[value].label, detail: `${Math.min(...fewest)}–${Math.max(...fewest)} moves` };
  });
</script>

<GameScreen
  title="Sliding Blocks"
  subtitle="{VARIANTS[game.variant].label} · {LEVELS[game.difficulty].label} · No. {game.number + 1}"
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  onopennew={() => pick(game.variant, game.difficulty)}
  onstart={start}
  finished={game.done}
  onnext={() => begin(newGame(game.variant, game.difficulty, game.upNext))}
>
  {#snippet picker()}
    <div class="pick-tabs" role="tablist" aria-label="Variant">
      {#each Object.entries(VARIANTS) as [key, v] (key)}
        <button type="button" role="tab" aria-selected={choice.variant === key} onclick={() => pick(key as Variant, choice.difficulty)}>{v.label}</button>
      {/each}
    </div>
    <h3 class="pick-title">Difficulty</h3>
    <div class="pick">
      {#each options(choice.variant) as { value, label, detail } (value)}
        <button type="button" class="btn" aria-pressed={choice.difficulty === value} onclick={() => pick(choice.variant, value)}>
          <strong>{label}</strong><span>{detail}</span>
        </button>
      {/each}
    </div>
    <h3 class="pick-title">Puzzle</h3>
    <div class="blocks-levels">
      {#each PUZZLES[choice.variant][choice.difficulty] as _, n (n)}
        <button
          type="button"
          class="btn"
          aria-pressed={choice.number === n}
          aria-label="No. {n + 1}"
          onclick={() => (choice = { ...choice, number: n })}
        >{n + 1}</button>
      {/each}
    </div>
  {/snippet}
  {#snippet status()}
    <!-- Just the fewest moves it can be done in (a flag: the mark to aim for), no count of the player's own. -->
    <span class="blocks-count" aria-label="It can be done in {game.fewest} moves">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 14V2.5M4 3h8l-2 3 2 3H4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      {game.fewest}
    </span>
  {/snippet}

  <div class="board-area">
    <svg
      bind:this={svg}
      class={['blocks-board', { done: game.done, holding: held !== null }]}
      viewBox="-0.3 -0.3 {size + 0.6} {size + 0.6}"
      role="group"
      aria-label="Sliding blocks board"
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerUp}
    >
      {#each { length: size * size } as _, sq (sq)}
        <circle class="spot" cx={(sq % size) + 0.5} cy={Math.floor(sq / size) + 0.5} r="0.05" />
      {/each}
      <!-- Exits: an arrow past the right-hand edge on the first key block's row, and (Two Keys) one
           under the bottom edge in the second's column, each in its key block's color. -->
      <path
        class="exit-mark"
        d="M{size + EDGE + 0.1} {s.exitRow + 0.36}l0.14 0.14l-0.14 0.14"
        style:stroke={s.keys > 1 ? keyColor(0) : undefined}
      />
      {#if s.keys > 1}
        <path class="exit-mark" d="M{s.exitCol + 0.36} {size + EDGE + 0.1}l0.14 0.14l0.14 -0.14" style:stroke={keyColor(1)} />
      {/if}

      {#key round}
        {#each game.blocks as b, i (i)}
          {@const moving = held?.index === i}
          {@const out = !moving && isOut(game.blocks, i, s)}
          {@const shift = moving ? held!.offset : out ? (pastEdge[i] ?? 0) : 0}
          {#if b.fixed}
            <rect class="pillar" x={b.c + 0.2} y={b.r + 0.2} width="0.6" height="0.6" rx="0.12" />
          {:else}
            <g
              class={['block', { key: i < s.keys, moving, out }]}
              style:transform="translate({b.c + (b.across ? shift : 0)}px, {b.r + (b.across ? 0 : shift)}px)"
              style:--away={b.across ? '2.4px 0' : '0 2.4px'}
              style:--tint={tint(i)}
              role="button"
              tabindex="-1"
              aria-label={i < s.keys ? 'Key block' : `Block ${b.across ? 'across' : 'down'}`}
              onpointerdown={(e) => pointerDown(e, i)}
            >
              <rect
                x={INSET}
                y={INSET}
                width={(b.across ? b.len : 1) - INSET * 2}
                height={(b.across ? 1 : b.len) - INSET * 2}
                rx="0.2"
                style:fill={i < s.keys ? keyColor(i) : undefined}
              />
            </g>
          {/if}
        {/each}
      {/key}
    </svg>
  </div>
</GameScreen>
