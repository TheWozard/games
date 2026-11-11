<script lang="ts">
  import GameScreen from '../shared/GameScreen.svelte';
  import RulesPicker from '../shared/RulesPicker.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { CROSS, isGame, LINE, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import { cellEdges, DARK, DIFFICULTIES, dotEdges, dotIndex, edgeEnds, isDifficulty, NO_RULES, RULES, type Difficulty, type Rule, type Rules } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('easy'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const label = $derived(
    [DIFFICULTIES[game.difficulty].label, ...(Object.keys(RULES) as Rule[]).filter((k) => game.rules[k]).map((k) => RULES[k].label)].join(' · '),
  );
  const edges = $derived(game.marks.map((_, e) => edgeEnds(game, e)));

  // Clue cells: how many of their sides are lines so far.
  const around = $derived(
    game.clues.map((_, i) => cellEdges(game, Math.floor(i / game.cols), i % game.cols).filter((e) => game.marks[e] === LINE).length),
  );
  // Lines meeting at each dot: more than two would branch; a ring is met at exactly two.
  const degree = $derived(
    Array.from({ length: (game.rows + 1) * (game.cols + 1) }, (_, d) =>
      dotEdges(game, Math.floor(d / (game.cols + 1)), d % (game.cols + 1)).filter((e) => game.marks[e] === LINE).length,
    ),
  );

  $effect(() => saveJSON(STORAGE_KEY, game));

  const sizes = Object.fromEntries(
    Object.entries(DIFFICULTIES).map(([k, d]) => [k, { label: d.label, detail: `${d.cols}×${d.rows}` }]),
  ) as Record<Difficulty, { label: string; detail: string }>;

  // The New dialog's picks, starting from the current game's settings.
  let choice = $state<{ difficulty: Difficulty; rules: Rules }>({ difficulty: 'easy', rules: { ...NO_RULES } });
  function askNew() {
    choice = { difficulty: game.difficulty, rules: { ...game.rules } };
  }

  function start(value: string) {
    if (value === 'start' && isDifficulty(choice.difficulty)) game = newGame(choice.difficulty, choice.rules);
  }
</script>

<GameScreen
  title="Loop"
  subtitle={label}
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  inProgress={!game.done && game.history.length > 0}
  onopennew={askNew}
  onstart={start}
  finished={game.done}
  onnext={() => (game = newGame(game.difficulty, game.rules))}
>
  {#snippet picker()}
    <RulesPicker {sizes} rules={RULES} bind:size={choice.difficulty} bind:on={choice.rules} />
  {/snippet}

  <div class="board-area">
    <svg
      class={['loop-board', { done: game.done }]}
      viewBox="-0.45 -0.45 {game.cols + 0.9} {game.rows + 0.9}"
      style:--cols={game.cols}
      style:--rows={game.rows}
      role="group"
      aria-label="Loop board"
      oncontextmenu={(e) => e.preventDefault()}
    >
      {#each game.clues as clue, i (i)}
        {#if clue !== null}
          {#if around[i] > clue}
            <rect class="over" x={(i % game.cols) + 0.2} y={Math.floor(i / game.cols) + 0.2} width="0.6" height="0.6" rx="0.12" />
          {/if}
          <text
            class={['clue', { met: clue > 0 && around[i] === clue }]}
            data-n={clue}
            x={(i % game.cols) + 0.5}
            y={Math.floor(i / game.cols) + 0.53}
          >{clue}</text>
        {/if}
      {/each}

      {#each game.squares as kind, i (i)}
        {#if kind !== null}
          <rect
            class={['square', { dark: kind === DARK }]}
            x={(i % game.cols) + 0.32}
            y={Math.floor(i / game.cols) + 0.32}
            width="0.36"
            height="0.36"
            rx="0.07"
          />
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
        <!-- Wide invisible target: a tap cycles the side through empty, line and cross. -->
        <line
          class="hit"
          x1={c1}
          y1={r1}
          x2={c2}
          y2={r2}
          role="button"
          tabindex="-1"
          aria-label="Side"
          onclick={() => dispatch({ type: 'cycle', edge: e })}
          onkeydown={() => {}}
        />
      {/each}

      {#each { length: game.rows + 1 } as _, r (r)}
        {#each { length: game.cols + 1 } as _, c (c)}
          {@const d = dotIndex(game, r, c)}
          {#if game.rings[d]}
            <circle class={['ring', { met: degree[d] === 2 }]} cx={c} cy={r} r="0.17" />
          {/if}
          <circle class={['dot', { bad: degree[d] > 2 }]} cx={c} cy={r} r="0.035" />
        {/each}
      {/each}
    </svg>
  </div>
</GameScreen>
