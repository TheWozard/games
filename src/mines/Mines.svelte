<script lang="ts">
  import GameScreen from '../shared/GameScreen.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { flagsLeft, isGame, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import { counts, DENSITIES, isDensity, isSize, mineCount, SIZES, type Density, type Size } from './logic';

  const LONG_PRESS_MS = 350;

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('small', 'few'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  const near = $derived(game.mines ? counts(game.mines, game) : null);
  const label = $derived(`${SIZES[game.size].label} · ${DENSITIES[game.density].label}`);

  $effect(() => saveJSON(STORAGE_KEY, game));

  // The New Game picks, starting from the current game's; Play starts them.
  let choice = $state<{ size: Size; density: Density }>({ size: 'small', density: 'few' });
  function start(value: string) {
    if (value === 'start' && isSize(choice.size) && isDensity(choice.density)) game = newGame(choice.size, choice.density);
  }

  // Long-press flags (touch has no right-click). The press that flagged must not also reveal, so
  // the click that follows it is swallowed, as is the contextmenu event Android fires for it.
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let pressFlagged = false;
  let pressAt = { x: 0, y: 0 };

  const flag = (i: number) => dispatch({ type: 'flag', index: i });

  function pointerDown(e: PointerEvent, i: number) {
    pressFlagged = false;
    clearTimeout(pressTimer);
    if (e.button !== 0) return;
    pressAt = { x: e.clientX, y: e.clientY };
    pressTimer = setTimeout(() => {
      pressFlagged = true;
      flag(i);
    }, LONG_PRESS_MS);
  }

  function pointerMove(e: PointerEvent) {
    if (Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) > 10) clearTimeout(pressTimer);
  }

  const cancelPress = () => clearTimeout(pressTimer);

  function click(i: number) {
    clearTimeout(pressTimer);
    if (pressFlagged) {
      pressFlagged = false;
      return;
    }
    dispatch({ type: 'tap', index: i });
  }

  function contextMenu(e: MouseEvent, i: number) {
    e.preventDefault();
    clearTimeout(pressTimer);
    if (pressFlagged) return;
    // A touch long-press may still send a click afterwards; a mouse right-click doesn't.
    const type = (e as PointerEvent).pointerType;
    pressFlagged = type === 'touch' || type === 'pen';
    flag(i);
  }
</script>

{#snippet flagIcon()}
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4.8 2.5h7.4l-2 3 2 3H4.8z" fill="currentColor"/></svg>
{/snippet}

{#snippet mineIcon()}
  <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4.2" fill="currentColor"/><path d="M8 1.5v13M1.5 8h13M3.4 3.4l9.2 9.2M12.6 3.4l-9.2 9.2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
{/snippet}

<GameScreen
  title="Mines"
  subtitle={label}
  onopennew={() => (choice = { size: game.size, density: game.density })}
  onstart={start}
  finished={game.status !== 'playing'}
  onnext={() => (game = newGame(game.size, game.density))}
>
  {#snippet picker()}
    <h3 class="pick-title">Board</h3>
    <div class="pick">
      {#each Object.entries(SIZES) as [key, s] (key)}
        <button type="button" class="btn" aria-pressed={choice.size === key} onclick={() => (choice.size = key as Size)}>
          <strong>{s.label}</strong><span>{s.cols}×{s.rows}</span>
        </button>
      {/each}
    </div>
    <h3 class="pick-title">Mines</h3>
    <div class="pick">
      {#each Object.entries(DENSITIES) as [key, d] (key)}
        <button type="button" class="btn" aria-pressed={choice.density === key} onclick={() => (choice.density = key as Density)}>
          <strong>{d.label}</strong><span>{mineCount(choice.size, key as Density)} mines</span>
        </button>
      {/each}
    </div>
  {/snippet}

  {#snippet status()}
    <span class="mines-left" aria-label="Mines left to flag">{@render flagIcon()} {flagsLeft(game)}</span>
  {/snippet}

  <div class="board-area">
    <div class="mine-board" style:--rows={game.rows} style:--cols={game.cols} aria-label="Mine field">
      {#each game.revealed as open, i (i)}
        {@const flagged = game.flagged[i]}
        {@const mine = game.mines?.[i] ?? false}
        {@const lost = game.status === 'lost'}
        {@const n = near?.[i] ?? 0}
        <button
          type="button"
          class={['tile', {
            open,
            flagged,
            exploded: game.exploded === i,
            'show-mine': lost && mine && !flagged,
            'wrong-flag': lost && flagged && !mine,
          }]}
          data-n={open && !mine ? n : undefined}
          aria-label={open ? (mine ? 'Mine' : n ? `${n}` : 'Empty') : flagged ? 'Flagged' : 'Hidden'}
          onpointerdown={(e) => pointerDown(e, i)}
          onpointermove={pointerMove}
          onpointerup={cancelPress}
          onpointerleave={cancelPress}
          onpointercancel={cancelPress}
          onclick={() => click(i)}
          oncontextmenu={(e) => contextMenu(e, i)}
        >
          {#if open && mine}{@render mineIcon()}
          {:else if open}{n || ''}
          {:else if flagged}{@render flagIcon()}
          {:else if lost && mine}{@render mineIcon()}
          {/if}
        </button>
      {/each}
    </div>
  </div>
</GameScreen>
