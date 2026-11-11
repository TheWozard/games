<script lang="ts">
  import GameScreen from '../shared/GameScreen.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { isGame, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import CardFace from '../shared/CardFace.svelte';
  import { cardName, isRed, SUITS } from '../shared/cards';
  import { attachPan } from '../shared/pan';
  import { bestTarget, type Card, type Draw, type Source } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame(1));
  // Cards glide between places only once the player has moved: not while the page lays out.
  let animate = $state(false);
  const dispatch = (action: Action) => {
    animate = true;
    game = reducer(game, action);
  };

  $effect(() => saveJSON(STORAGE_KEY, game));

  // ---- Layout, in pixels, from the space the board has ----

  let width = $state(360);
  let height = $state(560);
  const gap = $derived(Math.max(4, width * 0.014));
  // Cards are sized for five columns across the screen, so they're big enough to read and tap;
  // the seven columns then come out wider than the screen and pan sideways under a finger
  // (scrollX), while the foundations, stock and waste stay put. On a short screen the cards
  // shrink so the columns still have room to grow, but never below seven across.
  const across = (n: number) => (width - gap * (n - 1)) / n;
  const cw = $derived(Math.max(across(7), Math.min(across(5), height / (5.5 * 1.4))));
  const ch = $derived(cw * 1.4);
  const maxScroll = $derived(Math.max(0, 7 * cw + 6 * gap - width));
  // null: not panned since the deal, so the columns sit centered.
  let scrollX = $state<number | null>(null);
  const sx = $derived(scrollX === null ? maxScroll / 2 : Math.min(Math.max(0, scrollX), maxScroll));
  const colX = (col: number) => col * (cw + gap) - sx;
  // Laid out for a phone held upright: the four foundations centered along the top, the columns
  // fanning down below them, and the stock in the bottom-right corner with the waste just left of
  // it, where a thumb reaches. Long columns squeeze to stay clear of the bottom row.
  // On a tall screen the table is centered as a block: the top row, room for columns about as
  // long as a game usually gets (COLUMNS_H card heights), and the bottom row. It's a fixed size
  // rather than fitted to the cards, so it doesn't jump about as columns grow.
  const COLUMNS_H = 4;
  const blockH = $derived(ch * (2 + COLUMNS_H) + gap * 5);
  const topY = $derived(Math.max(0, (height - blockH) / 2));
  const bottomY = $derived(Math.max(0, height - topY - ch));
  const tableauY = $derived(topY + ch + gap * 2.5);
  const foundationX = (suit: number) => (width - (4 * cw + 3 * gap)) / 2 + suit * (cw + gap);
  const stockX = $derived(width - cw);
  const wasteX = $derived(stockX - cw - gap);

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
    // Stock: face down in the bottom-right corner.
    t.stock.forEach((card, k) => out.push({ card, x: stockX, y: bottomY, z: k, up: false, source: 'stock' }));
    // Waste: just left of the stock. The top one (or three) fans out leftward, so the card you
    // can play is always the one nearest the stock.
    const fan = game.draw === 3 ? 3 : 1;
    t.waste.forEach((card, k) => {
      const fromTop = t.waste.length - 1 - k;
      const shift = Math.min(fromTop, fan - 1, t.waste.length - 1) * cw * 0.42;
      out.push({ card, x: wasteX - shift, y: bottomY, z: 100 + k, up: true, source: fromTop === 0 ? { from: 'waste' } : null });
    });
    // Foundations: one slot per suit, centered along the top.
    t.foundations.forEach((n, suit) => {
      for (let r = 0; r < n; r++) {
        out.push({ card: suit * 13 + r, x: foundationX(suit), y: topY, z: 200 + r, up: true, source: r === n - 1 ? { from: 'foundation', suit } : null });
      }
    });
    // Tableau: face-down cards tightly stacked, face-up ones fanned; squeezed to end above the
    // stock and waste.
    const room = Math.max(0, bottomY - gap * 2.5 - tableauY - ch);
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

  // ---- Panning the columns sideways (only when they're wider than the screen) ----

  let table = $state<HTMLElement>();
  let panning = $state(false);
  $effect(() => {
    if (!table) return;
    return attachPan(table, {
      max: () => maxScroll,
      get: () => sx,
      set: (x) => (scrollX = x),
      onPanning: (on) => (panning = on),
    });
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
    if (value === '1' || value === '3') deal(newGame(Number(value) as Draw));
  }

  function deal(next: typeof game) {
    game = next;
    scrollX = null; // a new deal opens with the columns centered
  }

  function onKey(e: KeyboardEvent) {
    if (document.querySelector('dialog[open]')) return;
    // Space or D draws from the stock (GameScreen handles Ctrl/Cmd+Z).
    if (e.key === ' ' || e.key === 'd') {
      e.preventDefault();
      dispatch({ type: 'stock' });
    }
  }
</script>

<svelte:document onkeydown={onKey} />

<GameScreen
  title="Solitaire"
  subtitle="Draw {game.draw}"
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  inProgress={!game.done && game.history.length > 0}
  options={[{ value: '1', label: 'Draw 1 · easier' }, { value: '3', label: 'Draw 3 · classic' }]}
  onstart={start}
  finished={game.done}
  onnext={() => deal(newGame(game.draw))}
>
  <div class="board-area">
    <div
      class={['card-table sol-board', { animate, pannable: maxScroll > 0, panning }]}
      bind:this={table}
      bind:clientWidth={width}
      bind:clientHeight={height}
      style:--cw="{cw}px"
      style:--ch="{ch}px"
    >
      <!-- Empty slots: the stock (tap to turn the waste over), foundations, and columns. -->
      <button
        type="button"
        class="slot stock"
        style:transform="translate({stockX}px, {bottomY}px)"
        aria-label={game.table.stock.length ? 'Draw' : 'Turn the waste over'}
        onclick={() => dispatch({ type: 'stock' })}
      >
        {#if !game.table.stock.length && game.table.waste.length}↻{/if}
      </button>
      {#each SUITS as suit, s (s)}
        <div class="slot" style:transform="translate({foundationX(s)}px, {topY}px)" aria-hidden="true">{suit}</div>
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
          aria-label={p.up ? cardName(p.card) : 'Face-down card'}
          onclick={() => tap(p)}
        >
          {#if p.up}<CardFace card={p.card} />{/if}
        </button>
      {/each}
    </div>
  </div>
</GameScreen>
