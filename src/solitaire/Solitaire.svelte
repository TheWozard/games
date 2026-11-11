<script lang="ts">
  import Dialog from '../shared/Dialog.svelte';
  import BackButton from '../shared/BackButton.svelte';
  import NewButton from '../shared/NewButton.svelte';
  import NextButton from '../shared/NextButton.svelte';
  import UndoButton from '../shared/UndoButton.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { isGame, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import { bestTarget, isRed, rankOf, RANKS, suitOf, SUITS, type Card, type Draw, type Source } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame(1));
  const dispatch = (action: Action) => (game = reducer(game, action));

  let askingNew = $state(false);

  $effect(() => saveJSON(STORAGE_KEY, game));

  // ---- Layout, in pixels, from the space the board has ----

  let width = $state(360);
  let height = $state(560);
  const gap = $derived(Math.max(4, width * 0.014));
  const cw = $derived((width - gap * 6) / 7);
  const ch = $derived(cw * 1.4);
  const colX = (col: number) => col * (cw + gap);
  // The stock, waste and foundations along the top, the columns fanning down below. The table is
  // centered on the screen as a fixed-size block (about what a game usually needs), rather than
  // on the cards out, so it doesn't jump about as columns grow; long columns use the space below.
  const TABLE_H = 5.5; // in card heights
  const rowY = $derived(Math.max(0, (height - ch * TABLE_H) / 2));
  const tableauY = $derived(rowY + ch + gap * 2.5);

  interface Placed {
    card: Card;
    x: number;
    y: number;
    z: number;
    up: boolean;
    source: Source | 'stock' | null;
  }

  const placed = $derived.by(() => {
    const t = game.table;
    const out: Placed[] = [];
    // Stock: face down in the first slot.
    t.stock.forEach((card, k) => out.push({ card, x: colX(0), y: rowY, z: k, up: false, source: 'stock' }));
    // Waste: the top one (or three, fanned) in the second slot.
    const fan = game.draw === 3 ? 3 : 1;
    t.waste.forEach((card, k) => {
      const fromTop = t.waste.length - 1 - k;
      const shift = fromTop < fan ? (Math.min(fan, t.waste.length) - 1 - fromTop) * cw * 0.42 : 0;
      out.push({ card, x: colX(1) + shift, y: rowY, z: 100 + k, up: true, source: fromTop === 0 ? { from: 'waste' } : null });
    });
    // Foundations: one slot per suit, in the last four columns.
    t.foundations.forEach((n, suit) => {
      for (let r = 0; r < n; r++) {
        out.push({ card: suit * 13 + r, x: colX(3 + suit), y: rowY, z: 200 + r, up: true, source: r === n - 1 ? { from: 'foundation', suit } : null });
      }
    });
    // Tableau: face-down cards tightly stacked, face-up ones fanned; squeezed to fit if long.
    const room = Math.max(0, height - tableauY - ch);
    t.tableau.forEach(({ down, up }, col) => {
      let downStep = ch * 0.13;
      let upStep = ch * 0.3;
      const need = down.length * downStep + Math.max(0, up.length - 1) * upStep;
      if (need > room && need > 0) {
        downStep *= room / need;
        upStep *= room / need;
      }
      down.forEach((card, k) => out.push({ card, x: colX(col), y: tableauY + k * downStep, z: 300 + k, up: false, source: null }));
      up.forEach((card, k) => out.push({
        card, x: colX(col), y: tableauY + down.length * downStep + k * upStep, z: 330 + k, up: true,
        source: { from: 'tableau', col, index: k },
      }));
    });
    return out.sort((a, b) => a.card - b.card);
  });

  // ---- Taps ----

  let shaking = $state<Card | null>(null);
  let shakeTimer: ReturnType<typeof setTimeout> | undefined;

  function tap(p: Placed) {
    if (p.source === 'stock') return dispatch({ type: 'stock' });
    if (!p.source) return;
    if (!bestTarget(game.table, p.source)) {
      clearTimeout(shakeTimer);
      shaking = p.card;
      shakeTimer = setTimeout(() => (shaking = null), 300);
      return;
    }
    dispatch({ type: 'tap', source: p.source });
  }

  function start(value: string) {
    if (value === '1' || value === '3') game = newGame(Number(value) as Draw);
  }

  function onKey(e: KeyboardEvent) {
    if (document.querySelector('dialog[open]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      dispatch({ type: 'undo' });
    } else if (e.key === ' ' || e.key === 'd') {
      e.preventDefault();
      dispatch({ type: 'stock' });
    }
  }
</script>

<svelte:document onkeydown={onKey} />

<header class="bar">
  <BackButton />
  <h1>Solitaire <small>Draw {game.draw}</small></h1>
  <UndoButton disabled={game.done || game.history.length === 0} onclick={() => dispatch({ type: 'undo' })} />
  <NewButton onclick={() => (askingNew = true)} />
</header>

<main class="play">
  <div class="board-area">
    <div class="sol-board" bind:clientWidth={width} bind:clientHeight={height} style:--cw="{cw}px" style:--ch="{ch}px">
      <!-- Empty slots: the stock (tap to turn the waste over), foundations, and columns. -->
      <button
        type="button"
        class="slot stock"
        style:transform="translate({colX(0)}px, {rowY}px)"
        aria-label={game.table.stock.length ? 'Draw' : 'Turn the waste over'}
        onclick={() => dispatch({ type: 'stock' })}
      >
        {#if !game.table.stock.length && game.table.waste.length}↻{/if}
      </button>
      {#each SUITS as suit, s (s)}
        <div class="slot" style:transform="translate({colX(3 + s)}px, {rowY}px)" aria-hidden="true">{suit}</div>
      {/each}
      {#each { length: 7 } as _, col (col)}
        <div class="slot" style:transform="translate({colX(col)}px, {tableauY}px)" aria-hidden="true"></div>
      {/each}

      {#each placed as p (p.card)}
        <button
          type="button"
          class={['card', { down: !p.up, red: isRed(p.card), shake: shaking === p.card, live: p.source !== null }]}
          style:transform="translate({p.x}px, {p.y}px)"
          style:z-index={p.z}
          aria-label={p.up ? `${RANKS[rankOf(p.card) - 1]} of ${['spades', 'hearts', 'diamonds', 'clubs'][suitOf(p.card)]}` : 'Face-down card'}
          onclick={() => tap(p)}
        >
          {#if p.up}
            <span class="corner">{RANKS[rankOf(p.card) - 1]}<span>{SUITS[suitOf(p.card)]}</span></span>
            <span class="pip">{SUITS[suitOf(p.card)]}</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</main>

<NextButton show={game.done} onclick={() => (game = newGame(game.draw))} />

<Dialog open={askingNew} onclose={(value) => { askingNew = false; start(value); }}>
  <h2>New game</h2>
  {#if !game.done && game.history.length > 0}<p>This replaces the game in progress.</p>{/if}
  <button class="btn" value="1">Draw 1 · easier</button>
  <button class="btn" value="3">Draw 3 · classic</button>
  <button class="btn" value="">Cancel</button>
</Dialog>
