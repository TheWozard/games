<script lang="ts">
  import GameScreen from '../shared/GameScreen.svelte';
  import CardFace from '../shared/CardFace.svelte';
  import { cardName, isRed, SUITS, type Card } from '../shared/cards';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { isGame, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import { bestTarget, canMove, COLUMNS, DIFFICULTIES, isDifficulty, lifted, type Source, type Target } from './logic';

  let game = $state.raw(loadJSON(STORAGE_KEY, isGame) ?? newGame('classic'));
  // Cards glide between places only once the player has moved: not while the page lays out.
  let animate = $state(false);
  const dispatch = (action: Action) => {
    animate = true;
    game = reducer(game, action);
  };

  $effect(() => saveJSON(STORAGE_KEY, game));

  function start(value: string) {
    if (isDifficulty(value)) game = newGame(value);
  }

  // ---- Layout, in pixels, from the space the board has ----
  // Free cells on the left of the top row and foundations on the right; eight columns below.

  let width = $state(360);
  let height = $state(560);
  const gap = $derived(Math.max(3, width * 0.012));
  const cw = $derived((width - gap * (COLUMNS - 1)) / COLUMNS);
  const ch = $derived(cw * 1.4);
  const colX = (col: number) => col * (cw + gap);
  // Centered as a block about as tall as a game usually needs, so it doesn't jump about as
  // columns grow; long columns use the space below, squeezed to fit if they must.
  const TABLE_H = 5.5; // in card heights
  const rowY = $derived(Math.max(0, (height - ch * TABLE_H) / 2));
  const tableauY = $derived(rowY + ch + gap * 2.5);

  interface Placed {
    card: Card;
    x: number;
    y: number;
    z: number;
    source: Source | null; // where a tap or drag picks it up from (null: not movable)
  }

  const placed = $derived.by(() => {
    const t = game.table;
    const out: Placed[] = [];
    t.cells.forEach((card, i) => {
      if (card !== null) out.push({ card, x: colX(i), y: rowY, z: 1, source: { from: 'cell', i } });
    });
    t.foundations.forEach((n, suit) => {
      for (let r = 0; r < n; r++) out.push({ card: suit * 13 + r, x: colX(COLUMNS - 4 + suit), y: rowY, z: 1 + r, source: null });
    });
    const room = Math.max(0, height - tableauY - ch);
    t.columns.forEach((col, c) => {
      const step = Math.min(ch * 0.3, room / Math.max(1, col.length - 1));
      col.forEach((card, k) => {
        const source: Source = { from: 'column', col: c, index: k };
        out.push({ card, x: colX(c), y: tableauY + k * step, z: 10 + k, source: lifted(t, source) ? source : null });
      });
    });
    return out.sort((a, b) => a.card - b.card); // stable order, so cards animate between places
  });

  // ---- Taps and drags ----
  // A tap sends cards to their best place; dragging puts them exactly where they're dropped.
  // A press must move a little before it counts as a drag, and the click after a drag is ignored.

  let board: HTMLDivElement;
  let shaking = $state<Card | null>(null);
  let shakeTimer: ReturnType<typeof setTimeout> | undefined;
  let press: { id: number; source: Source; card: Card; x: number; y: number } | null = null;
  let drag = $state<{ cards: Card[]; dx: number; dy: number } | null>(null);
  let swallowClick = false;

  function shake(card: Card) {
    clearTimeout(shakeTimer);
    shaking = card;
    shakeTimer = setTimeout(() => (shaking = null), 300);
  }

  function tap(p: Placed) {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    if (!p.source || game.done) return;
    if (!bestTarget(game.table, p.source)) return shake(p.card);
    dispatch({ type: 'tap', source: p.source });
  }

  function pointerDown(e: PointerEvent, p: Placed) {
    swallowClick = false;
    if (!p.source || game.done || press || (e.pointerType === 'mouse' && e.button !== 0)) return;
    press = { id: e.pointerId, source: p.source, card: p.card, x: e.clientX, y: e.clientY };
  }

  function pointerMove(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (!drag) {
      if (Math.hypot(dx, dy) < 8) return;
      board.setPointerCapture?.(e.pointerId);
      drag = { cards: lifted(game.table, press.source) ?? [], dx, dy };
    } else {
      drag = { ...drag, dx, dy };
    }
  }

  /** Where the dragged cards' top card is over: a column, a free cell or the foundations. */
  function dropTarget(): Target | null {
    if (!press || !drag) return null;
    const p = placed.find((q) => q.card === press!.card);
    if (!p) return null;
    const cx = p.x + drag.dx + cw / 2;
    const cy = p.y + drag.dy + ch / 2;
    const col = Math.min(COLUMNS - 1, Math.max(0, Math.floor((cx + gap / 2) / (cw + gap))));
    if (cy >= tableauY - gap) return { to: 'column', col };
    if (col >= COLUMNS - 4) return { to: 'foundation' };
    // Over the free cells: the one under it if it's empty, else any empty one.
    const cells = game.table.cells;
    const i = col < cells.length && cells[col] === null ? col : cells.indexOf(null);
    return i === -1 ? null : { to: 'cell', i };
  }

  function pointerUp(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    if (drag) {
      swallowClick = true;
      const target = dropTarget();
      if (target && canMove(game.table, press.source, target)) dispatch({ type: 'move', source: press.source, target });
      else if (target && !(target.to === 'column' && press.source.from === 'column' && target.col === press.source.col)) shake(press.card);
    }
    press = null;
    drag = null;
  }

  function pointerCancel() {
    press = null;
    drag = null;
  }
</script>

<GameScreen
  title="FreeCell"
  subtitle="{DIFFICULTIES[game.difficulty].label} · {DIFFICULTIES[game.difficulty].cells} free cells"
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  inProgress={!game.done && game.history.length > 0}
  options={Object.entries(DIFFICULTIES).map(([value, d]) => ({ value, label: `${d.label} · ${d.cells} free cells` }))}
  onstart={start}
  finished={game.done}
  onnext={() => (game = newGame(game.difficulty))}
>
  <div class="board-area">
    <div
      bind:this={board}
      class={['card-table fc-board', { animate }]}
      bind:clientWidth={width}
      bind:clientHeight={height}
      style:--cw="{cw}px"
      style:--ch="{ch}px"
      role="group"
      aria-label="FreeCell table"
      onpointermove={pointerMove}
      onpointerup={pointerUp}
      onpointercancel={pointerCancel}
    >
      <!-- Empty places: free cells, foundations (marked with their suit) and columns. -->
      {#each game.table.cells as _, i (i)}
        <div class="slot cell" style:transform="translate({colX(i)}px, {rowY}px)" aria-hidden="true"></div>
      {/each}
      {#each SUITS as suit, s (s)}
        <div class="slot" style:transform="translate({colX(COLUMNS - 4 + s)}px, {rowY}px)" aria-hidden="true">{suit}</div>
      {/each}
      {#each { length: COLUMNS } as _, col (col)}
        <div class="slot" style:transform="translate({colX(col)}px, {tableauY}px)" aria-hidden="true"></div>
      {/each}

      {#each placed as p (p.card)}
        {@const lifting = drag?.cards.includes(p.card) ?? false}
        <button
          type="button"
          class={['card', { red: isRed(p.card), live: p.source !== null, shake: shaking === p.card, dragging: lifting }]}
          style:transform="translate({p.x + (lifting ? drag!.dx : 0)}px, {p.y + (lifting ? drag!.dy : 0)}px)"
          style:z-index={lifting ? 1000 + p.z : p.z}
          aria-label={cardName(p.card)}
          onpointerdown={(e) => pointerDown(e, p)}
          onclick={() => tap(p)}
        >
          <CardFace card={p.card} />
        </button>
      {/each}
    </div>
  </div>
</GameScreen>
