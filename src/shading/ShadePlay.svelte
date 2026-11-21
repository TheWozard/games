<!--
  The whole screen for a shading game (Star Battle, Nurikabe, Hitori, Light Up): a square board
  where a tap or a drag places the game's mark or the player's note, a picker at the bottom right
  for which of the two a tap places, undo, and the New Game dialog with every shading game as a tab.
  A game supplies its puzzles, which cells are fixed, which marks break a rule, and a `cells`
  snippet that draws the board's contents in cell units (cell i's top left is (i % n, i / n)).
-->
<script generics="P extends Shape" lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import BrushPicker from '../shared/BrushPicker.svelte';
  import GameScreen from '../shared/GameScreen.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import VariantPicker, { parsePick } from '../shared/VariantPicker.svelte';
  import { EMPTY, gameOf, isGame, MAIN, NOTE, reducer, type Action, type Shape } from './board';
  import type { Switcher } from './variants';

  type Drag = 'free' | 'line' | 'none';

  interface Props {
    /** Draws the board's contents. */
    cells: Snippet<[{ bad: boolean[]; done: boolean; marks: number[]; puzzle: P }]>;
    /** Which marks break a rule, to show them red. */
    conflicts: (puzzle: P, marks: number[]) => boolean[];
    /**
     * A new puzzle. Give its parameter a type (`(d: string) => ...`): then P is inferred from it
     * first, not narrowed to the bare Shape by a callback that comes before it (props are sorted).
     */
    create: (difficulty: string) => P;
    difficulties: Record<string, { label: string }>;
    /**
     * How a drag carries each one, the game's mark then the note: 'none' (taps only: a star or lamp
     * goes in one cell at a time), 'line' (along the row or column it first moves in), or 'free'
     * (every cell it passes over, any way it goes).
     */
    drags?: [Drag, Drag];
    /** Start a new game at this difficulty instead of resuming the saved one. */
    first?: string;
    /** Cells that take no marks (numbers, walls). */
    fixed?: (puzzle: P, i: number) => boolean;
    /** The picker's icons, for MAIN and NOTE. */
    icon: Snippet<[number]>;
    isPuzzle: (value: unknown, difficulty: string) => boolean;
    /** The picker's two stops: the game's mark, then the player's note. */
    names: [string, string];
    storageKey: string;
    title: string;
    /** The tabs of the New Game dialog, and switching between the games. */
    variants: Switcher;
  }

  let {
    title,
    storageKey,
    difficulties,
    create,
    isPuzzle,
    fixed = () => false,
    conflicts,
    names,
    drags = ['line', 'line'],
    icon,
    cells,
    variants,
    first,
  }: Props = $props();

  const isDifficulty = (d: unknown) => typeof d === 'string' && Object.hasOwn(difficulties, d);
  const make = (d: string) => gameOf(d, create(d));

  let game = $state.raw(
    untrack(() =>
      first !== undefined && isDifficulty(first) ?
        make(first)
      : (loadJSON(storageKey, (v) => isGame<P>(v, isDifficulty, isPuzzle)) ??
        make(Object.keys(difficulties)[0])),
    ),
  );
  const isFixed = (i: number) => fixed(game.puzzle, i);
  const dispatch = (action: Action) => (game = reducer(game, action, isFixed));

  $effect(() => saveJSON(storageKey, game));

  const n = $derived(game.puzzle.size);

  // The New Game dialog's pick ("<game>:<difficulty>"), reset each time it opens.
  let pick = $state('');
  let pickerOpens = $state(0);
  function start(value: string) {
    const chosen = value === 'start' ? parsePick(variants.games, pick) : null;
    if (!chosen) return;
    if (chosen.game !== variants.current) variants.onswitch(pick);
    else if (isDifficulty(chosen.setting)) game = make(chosen.setting);
  }

  // What a tap places: the game's mark, or the player's note.
  let brush = $state(MAIN);
  const stops = $derived([
    { value: MAIN, name: names[0] },
    { value: NOTE, name: names[1] },
  ]);

  // ---- Strokes ----
  // A press starts a stroke on a cell: a tap places what the picker shows (or clears the cell if it
  // already holds that), and a mouse's right-click places the note. Dragging carries the same value
  // to every cell that started out like the first one, as that mark drags (`drags`): not at all,
  // along the row or column the drag first moves in, or over every cell it passes. It's drawn as it
  // goes and applied on release.

  interface Stroke {
    axis: 'col' | 'row' | null;
    drag: Drag;
    end: number;
    from: number;
    path: number[]; // a free drag's cells, in order
    pointer: number;
    start: number;
    value: number;
  }

  let stroke = $state.raw<null | Stroke>(null);
  let svg = $state<SVGSVGElement>();

  const range = (a: number, b: number) =>
    Array.from({ length: Math.abs(b - a) + 1 }, (_, k) => (a <= b ? a + k : a - k));

  function strokeCells(s: Stroke): number[] {
    if (s.drag === 'free') return s.path.filter((i) => !isFixed(i) && game.marks[i] === s.from);
    const r0 = Math.floor(s.start / n);
    const c0 = s.start % n;
    const line =
      s.axis === 'row' ? range(c0, s.end % n).map((c) => r0 * n + c)
      : s.axis === 'col' ? range(r0, Math.floor(s.end / n)).map((r) => r * n + c0)
      : [s.start];
    return line.filter((i) => !isFixed(i) && game.marks[i] === s.from);
  }

  function cellAt(e: PointerEvent): null | number {
    if (!svg) return null;
    // The cells fill the box inside the border (shading.css).
    const box = svg.getBoundingClientRect();
    const unit = svg.clientWidth / n;
    const c = Math.floor((e.clientX - box.left - svg.clientLeft) / unit);
    const r = Math.floor((e.clientY - box.top - svg.clientTop) / unit);
    return r >= 0 && r < n && c >= 0 && c < n ? r * n + c : null;
  }

  function down(e: PointerEvent) {
    if (game.done || stroke || (e.button !== 0 && e.button !== 2)) return;
    const i = cellAt(e);
    if (i === null || isFixed(i)) return;
    e.preventDefault();
    svg?.setPointerCapture(e.pointerId);
    const from = game.marks[i];
    const place = e.button === 2 ? NOTE : brush;
    const drag = drags[place === MAIN ? 0 : 1];
    stroke = {
      pointer: e.pointerId,
      start: i,
      end: i,
      from,
      value: from === place ? EMPTY : place,
      drag,
      axis: null,
      path: [i],
    };
  }

  function move(e: PointerEvent) {
    if (!stroke || e.pointerId !== stroke.pointer) return;
    const i = cellAt(e);
    if (i === null || i === stroke.end || stroke.drag === 'none') return;
    if (stroke.drag === 'free') {
      // Every cell on the way from the last one, so a quick swipe doesn't skip any.
      const path = stroke.path.slice();
      const [r0, c0] = [Math.floor(stroke.end / n), stroke.end % n];
      const [dr, dc] = [Math.floor(i / n) - r0, (i % n) - c0];
      const steps = Math.max(Math.abs(dr), Math.abs(dc));
      for (let t = 1; t <= steps; t++) {
        const j = (r0 + Math.round((dr * t) / steps)) * n + c0 + Math.round((dc * t) / steps);
        if (!path.includes(j)) path.push(j);
      }
      stroke = { ...stroke, end: i, path };
      return;
    }
    const dr = Math.floor(i / n) - Math.floor(stroke.start / n);
    const dc = (i % n) - (stroke.start % n);
    const axis =
      stroke.axis ??
      (dr === 0 && dc === 0 ? null
      : Math.abs(dc) >= Math.abs(dr) ? 'row'
      : 'col');
    const end =
      axis === 'row' ? Math.floor(stroke.start / n) * n + (i % n)
      : axis === 'col' ? Math.floor(i / n) * n + (stroke.start % n)
      : stroke.start;
    stroke = { ...stroke, axis, end };
  }

  function up(e: PointerEvent) {
    if (!stroke || e.pointerId !== stroke.pointer) return;
    const s = stroke;
    stroke = null;
    dispatch({ type: 'paint', indices: strokeCells(s), value: s.value });
  }

  function cancel(e: PointerEvent) {
    if (stroke && e.pointerId === stroke.pointer) stroke = null;
  }

  // What's on screen: the game, with the stroke in progress drawn over it.
  const shown = $derived.by(() => {
    if (!stroke) return game.marks;
    const marks = game.marks.slice();
    for (const i of strokeCells(stroke)) marks[i] = stroke.value;
    return marks;
  });
  const bad = $derived(conflicts(game.puzzle, shown));
</script>

{#snippet variantPicker()}
  {#key pickerOpens}<VariantPicker games={variants.games} bind:value={pick} />{/key}
{/snippet}

<GameScreen
  canUndo={!game.done && game.history.length > 0}
  finished={game.done}
  onnext={() => (game = make(game.difficulty))}
  onopennew={() => {
    pick = `${variants.current}:${game.difficulty}`;
    pickerOpens++;
  }}
  onstart={start}
  onundo={() => dispatch({ type: 'undo' })}
  picker={variantPicker}
  subtitle={[variants.games[variants.current].label, difficulties[game.difficulty]?.label]
    .filter(Boolean)
    .join(' · ')}
  {title}
>
  <div class="board-area">
    <svg
      bind:this={svg}
      class={['shade-board', { done: game.done }]}
      aria-label="{variants.games[variants.current].label} board"
      oncontextmenu={(e) => e.preventDefault()}
      onlostpointercapture={cancel}
      onpointercancel={cancel}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      role="group"
      viewBox="0 0 {n} {n}"
    >
      <!-- The cells, then the thin lines between them (a fixed 1px whatever the board's size, like
           Sudoku's), then the game's own marks over both. The outer border is the svg's (shading.css). -->
      <rect class="cell" height={n} width={n} x="0" y="0" />
      <path
        class="lines"
        d={Array.from({ length: n - 1 }, (_, k) => `M${k + 1} 0V${n}M0 ${k + 1}H${n}`).join('')}
      />
      {@render cells({ puzzle: game.puzzle, marks: shown, bad, done: game.done })}
    </svg>
  </div>

  <BrushPicker {icon} {stops} bind:value={brush} />
</GameScreen>
