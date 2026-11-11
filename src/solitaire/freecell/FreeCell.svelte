<script lang="ts">
  import GameScreen from '../../shared/GameScreen.svelte';
  import CardFace from '../../shared/CardFace.svelte';
  import { cardName, isRed, SUITS, type Card } from '../../shared/cards';
  import { attachPan } from '../../shared/pan';
  import { loadJSON, saveJSON } from '../../shared/storage';
  import { isGame, newGame, reducer, STORAGE_KEY, type Action } from './game';
  import { bestTarget, canMove, COLUMNS, DIFFICULTIES, isDifficulty, lifted, type Source, type Target } from './logic';
  import { untrack } from 'svelte';
  import VariantPicker from '../../shared/VariantPicker.svelte';
  import { GAMES, parse, type VariantProps } from '../variants';

  let { start: first, onswitch }: VariantProps = $props();
  // The New dialog's pick, "<variant>:<setting>", starting on this game each time it opens.
  let pickerOpens = $state(0);
  let pick = $state('');

  let game = $state.raw(
    untrack(() => (isDifficulty(first) ? newGame(first) : (loadJSON(STORAGE_KEY, isGame) ?? newGame('classic')))),
  );
  // Cards glide between places only once the player has moved: not while the page lays out.
  let animate = $state(false);
  const dispatch = (action: Action) => {
    animate = true;
    game = reducer(game, action);
  };

  $effect(() => saveJSON(STORAGE_KEY, game));

  function start(value: string) {
    if (value !== 'start') return;
    const choice = parse(pick);
    if (!choice) return;
    if (choice.variant !== 'freecell') onswitch(pick);
    else if (isDifficulty(choice.setting)) deal(newGame(choice.setting));
  }

  function deal(next: typeof game) {
    game = next;
    scrollX = null; // a new deal opens with the columns centered
  }

  // ---- Layout, in pixels, from the space the board has ----
  // Laid out for a phone held upright, like Solitaire: the foundations centered along the top, the
  // columns below, and the free cells centered along the bottom, where a thumb reaches. Card size:
  // all eight columns across the space if they fit, but never smaller than five across an upright
  // phone (PHONE_W), so cards stay big enough to read and drag; and never so tall the columns lose
  // their room. On a phone the columns then come out wider than the screen and pan sideways
  // (scrollX), while the foundations and free cells stay put. A wider screen uses its extra width
  // and only pans if it must.

  let width = $state(360);
  let height = $state(560);
  const PHONE_W = 400;
  const gap = $derived(Math.max(3, Math.min(width, PHONE_W) * 0.012));
  const across = (n: number, w = width) => (w - gap * (n - 1)) / n;
  const heightCap = $derived(height / (5.5 * 1.4));
  const cw = $derived(Math.max(Math.min(across(COLUMNS), heightCap), Math.min(across(5, Math.min(width, PHONE_W)), heightCap)));
  const ch = $derived(cw * 1.4);
  const columnsW = $derived(COLUMNS * cw + (COLUMNS - 1) * gap);
  const maxScroll = $derived(Math.max(0, columnsW - width));
  // When the columns fit with room to spare, they're centered.
  const columnsLeft = $derived(Math.max(0, (width - columnsW) / 2));
  // null: not panned since the deal, so the columns sit centered.
  let scrollX = $state<number | null>(null);
  const sx = $derived(scrollX === null ? maxScroll / 2 : Math.min(Math.max(0, scrollX), maxScroll));
  const colX = (col: number) => columnsLeft + col * (cw + gap) - sx;
  // On a tall screen the table is centered as a block: the top row, room for columns about as
  // long as a game usually gets (COLUMNS_H card heights), and the bottom row. It's a fixed size
  // rather than fitted to the cards, so it doesn't jump about as columns grow.
  const COLUMNS_H = 4;
  const blockH = $derived(ch * (2 + COLUMNS_H) + gap * 5);
  const topY = $derived(Math.max(0, (height - blockH) / 2));
  const bottomY = $derived(Math.max(0, height - topY - ch));
  const tableauY = $derived(topY + ch + gap * 2.5);
  const foundationX = (suit: number) => (width - (4 * cw + 3 * gap)) / 2 + suit * (cw + gap);
  const cellX = (i: number) => {
    const n = game.table.cells.length;
    return (width - (n * cw + (n - 1) * gap)) / 2 + i * (cw + gap);
  };

  interface Placed {
    card: Card;
    x: number;
    y: number;
    z: number;
    source: Source | null; // where a tap or drag picks it up from (null: not movable)
    buried?: boolean; // in a column under cards that aren't a run off it: can't be picked up yet
  }

  const placed = $derived.by(() => {
    const t = game.table;
    const out: Placed[] = [];
    t.cells.forEach((card, i) => {
      if (card !== null) out.push({ card, x: cellX(i), y: bottomY, z: 1, source: { from: 'cell', i } });
    });
    t.foundations.forEach((n, suit) => {
      for (let r = 0; r < n; r++) out.push({ card: suit * 13 + r, x: foundationX(suit), y: topY, z: 1 + r, source: null });
    });
    // Columns end above the free cells, squeezed to fit if they must.
    const room = Math.max(0, bottomY - gap * 2.5 - tableauY - ch);
    t.columns.forEach((col, c) => {
      const step = Math.min(ch * 0.3, room / Math.max(1, col.length - 1));
      col.forEach((card, k) => {
        const source: Source = { from: 'column', col: c, index: k };
        const free = lifted(t, source) !== null;
        out.push({ card, x: colX(c), y: tableauY + k * step, z: 10 + k, source: free ? source : null, buried: !free });
      });
    });
    return out.sort((a, b) => a.card - b.card); // stable order, so cards animate between places
  });

  // ---- Taps and drags ----
  // A tap sends cards to their best place; dragging puts them exactly where they're dropped.
  // A press must move a little before it counts as a drag, and the click after a drag is ignored.

  let board = $state<HTMLDivElement>();
  let shaking = $state<Card | null>(null);
  let shakeTimer: ReturnType<typeof setTimeout> | undefined;
  let press: { id: number; source: Source; card: Card; x: number; y: number } | null = null;
  // sx0: the pan when the drag began. Cards lifted from a column stay under the finger as the
  // columns pan beneath them.
  let drag = $state<{ cards: Card[]; dx: number; dy: number; sx0: number; fromColumn: boolean } | null>(null);
  let pointerX = 0; // where the finger is, across the board, while dragging
  const dragShift = $derived(drag?.fromColumn ? sx - drag.sx0 : 0);
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
    pointerX = e.clientX - (board?.getBoundingClientRect().left ?? 0);
    if (!drag) {
      if (Math.hypot(dx, dy) < 8) return;
      board?.setPointerCapture?.(e.pointerId);
      drag = { cards: lifted(game.table, press.source) ?? [], dx, dy, sx0: sx, fromColumn: press.source.from === 'column' };
    } else {
      drag = { ...drag, dx, dy };
    }
  }

  /** Where the dragged cards' top card is over: a column, a free cell or the foundations. */
  function dropTarget(): Target | null {
    if (!press || !drag) return null;
    const p = placed.find((q) => q.card === press!.card);
    if (!p) return null;
    const cx = p.x + dragShift + drag.dx + cw / 2;
    const cy = p.y + drag.dy + ch / 2;
    // The top row is the foundations.
    if (cy < tableauY - gap) return { to: 'foundation' };
    // The bottom row is the free cells: the one under it if that's empty, else any empty one.
    const cells = game.table.cells;
    if (cy > bottomY - gap) {
      const under = Math.min(cells.length - 1, Math.max(0, Math.floor((cx - cellX(0) + gap / 2) / (cw + gap))));
      const i = cells[under] === null ? under : cells.indexOf(null);
      return i === -1 ? null : { to: 'cell', i };
    }
    return { to: 'column', col: Math.min(COLUMNS - 1, Math.max(0, Math.floor((cx - columnsLeft + sx + gap / 2) / (cw + gap)))) };
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

  // While a card is dragged near either edge, the columns pan to bring the hidden ones in.
  $effect(() => {
    if (!drag) return;
    let frame = requestAnimationFrame(function step() {
      const edge = Math.min(40, width * 0.1);
      if (pointerX < edge) scrollX = Math.max(0, sx - 8);
      else if (pointerX > width - edge) scrollX = Math.min(maxScroll, sx + 8);
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  });

  // Panning the columns: a press anywhere but on a card that can be dragged.
  let panning = $state(false);
  $effect(() => {
    if (!board) return;
    return attachPan(board, {
      max: () => maxScroll,
      get: () => sx,
      set: (x) => (scrollX = x),
      onPanning: (on) => (panning = on),
      startsPan: (e) => !(e.target instanceof Element && e.target.closest('.card.live')),
    });
  });
</script>

<GameScreen
  wide
  title="Solitaire"
  subtitle="FreeCell · {DIFFICULTIES[game.difficulty].label}"
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  onopennew={() => { pick = `freecell:${game.difficulty}`; pickerOpens++; }}
  onstart={start}
  finished={game.done}
  onnext={() => deal(newGame(game.difficulty))}
>
  {#snippet picker()}
    {#key pickerOpens}<VariantPicker games={GAMES} bind:value={pick} />{/key}
  {/snippet}
  <div class="board-area">
    <div
      bind:this={board}
      class={['card-table fc-board', { animate, pannable: maxScroll > 0, panning: panning || (drag !== null && maxScroll > 0) }]}
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
        <div class="slot cell" style:transform="translate({cellX(i)}px, {bottomY}px)" aria-hidden="true"></div>
      {/each}
      {#each SUITS as suit, s (s)}
        <div class="slot" style:transform="translate({foundationX(s)}px, {topY}px)" aria-hidden="true">{suit}</div>
      {/each}
      {#each { length: COLUMNS } as _, col (col)}
        <div class="slot" style:transform="translate({colX(col)}px, {tableauY}px)" aria-hidden="true"></div>
      {/each}

      {#each placed as p (p.card)}
        {@const lifting = drag?.cards.includes(p.card) ?? false}
        <button
          type="button"
          class={['card', { red: isRed(p.card), live: p.source !== null, buried: p.buried, shake: shaking === p.card, dragging: lifting }]}
          style:transform="translate({p.x + (lifting ? dragShift + drag!.dx : 0)}px, {p.y + (lifting ? drag!.dy : 0)}px)"
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
