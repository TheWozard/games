<!--
  The whole screen for a shading game (Star Battle, Nurikabe, Hitori, Light Up): a square board
  where a tap or a drag places the game's mark or the player's note, a picker at the bottom right
  for which of the two a tap places, undo, and the New Game dialog with every shading game as a tab.
  A game supplies its puzzles, which cells are fixed, which marks break a rule, and a `cells`
  snippet that draws the board's contents in cell units (cell i's top left is (i % n, i / n)).
-->
<script lang="ts" generics="P extends Shape">
  import { untrack, type Snippet } from 'svelte';
  import BrushPicker from '../shared/BrushPicker.svelte';
  import GameScreen from '../shared/GameScreen.svelte';
  import VariantPicker, { parsePick } from '../shared/VariantPicker.svelte';
  import { loadJSON, saveJSON } from '../shared/storage';
  import { EMPTY, gameOf, isGame, MAIN, NOTE, reducer, type Action, type Shape } from './board';
  import type { Switcher } from './variants';

  type Drag = 'none' | 'line' | 'free';

  interface Props {
    title: string;
    storageKey: string;
    difficulties: Record<string, { label: string }>;
    create: (difficulty: string) => P;
    isPuzzle: (value: unknown, difficulty: string) => boolean;
    /** Cells that take no marks (numbers, walls). */
    fixed?: (puzzle: P, i: number) => boolean;
    /** Which marks break a rule, to show them red. */
    conflicts: (puzzle: P, marks: number[]) => boolean[];
    /** The picker's two stops: the game's mark, then the player's note. */
    names: [string, string];
    /**
     * How a drag carries each one, the game's mark then the note: 'none' (taps only: a star or lamp
     * goes in one cell at a time), 'line' (along the row or column it first moves in), or 'free'
     * (every cell it passes over, any way it goes).
     */
    drags?: [Drag, Drag];
    /** The picker's icons, for MAIN and NOTE. */
    icon: Snippet<[number]>;
    /** Draws the board's contents. */
    cells: Snippet<[{ puzzle: P; marks: number[]; bad: boolean[]; done: boolean }]>;
    /** The tabs of the New Game dialog, and switching between the games. */
    variants: Switcher;
    /** Start a new game at this difficulty instead of resuming the saved one. */
    first?: string;
  }

  let {
    title, storageKey, difficulties, create, isPuzzle, fixed = () => false, conflicts, names, drags = ['line', 'line'], icon, cells,
    variants, first,
  }: Props = $props();

  const isDifficulty = (d: unknown) => typeof d === 'string' && Object.hasOwn(difficulties, d);
  const make = (d: string) => gameOf(d, create(d));

  let game = $state.raw(
    untrack(() =>
      first !== undefined && isDifficulty(first)
        ? make(first)
        : (loadJSON(storageKey, (v) => isGame<P>(v, isDifficulty, isPuzzle)) ?? make(Object.keys(difficulties)[0])),
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
    pointer: number;
    start: number;
    end: number;
    from: number;
    value: number;
    drag: Drag;
    axis: 'row' | 'col' | null;
    path: number[]; // a free drag's cells, in order
  }

  let stroke = $state.raw<Stroke | null>(null);
  let svg = $state<SVGSVGElement>();

  const range = (a: number, b: number) => Array.from({ length: Math.abs(b - a) + 1 }, (_, k) => (a <= b ? a + k : a - k));

  function strokeCells(s: Stroke): number[] {
    if (s.drag === 'free') return s.path.filter((i) => !isFixed(i) && game.marks[i] === s.from);
    const r0 = Math.floor(s.start / n);
    const c0 = s.start % n;
    const line = s.axis === 'row'
      ? range(c0, s.end % n).map((c) => r0 * n + c)
      : s.axis === 'col'
        ? range(r0, Math.floor(s.end / n)).map((r) => r * n + c0)
        : [s.start];
    return line.filter((i) => !isFixed(i) && game.marks[i] === s.from);
  }

  function cellAt(e: PointerEvent): number | null {
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const unit = box.width / (n + 0.1);
    const c = Math.floor((e.clientX - box.left) / unit - 0.05);
    const r = Math.floor((e.clientY - box.top) / unit - 0.05);
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
    stroke = { pointer: e.pointerId, start: i, end: i, from, value: from === place ? EMPTY : place, drag, axis: null, path: [i] };
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
    const axis = stroke.axis ?? (dr === 0 && dc === 0 ? null : Math.abs(dc) >= Math.abs(dr) ? 'row' : 'col');
    const end = axis === 'row'
      ? Math.floor(stroke.start / n) * n + (i % n)
      : axis === 'col'
        ? Math.floor(i / n) * n + (stroke.start % n)
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
  {#key pickerOpens}<VariantPicker games={variants.games} extras={variants.extras} bind:value={pick} />{/key}
{/snippet}

<GameScreen
  {title}
  subtitle={[variants.games[variants.current].label, difficulties[game.difficulty]?.label].filter(Boolean).join(' · ')}
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  picker={variantPicker}
  onopennew={() => { pick = `${variants.current}:${game.difficulty}`; pickerOpens++; }}
  onstart={start}
  finished={game.done}
  onnext={() => (game = make(game.difficulty))}
>
  <div class="board-area">
    <svg
      bind:this={svg}
      class={['shade-board', { done: game.done }]}
      viewBox="-0.05 -0.05 {n + 0.1} {n + 0.1}"
      role="group"
      aria-label="{variants.games[variants.current].label} board"
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={cancel}
      onlostpointercapture={cancel}
      oncontextmenu={(e) => e.preventDefault()}
    >
      <rect class="grid" x="0" y="0" width={n} height={n} />
      {#each { length: n * n } as _, i (i)}
        <rect class="cell" x={(i % n) + 0.015} y={Math.floor(i / n) + 0.015} width="0.97" height="0.97" />
      {/each}
      {@render cells({ puzzle: game.puzzle, marks: shown, bad, done: game.done })}
      <rect class="frame" x="0" y="0" width={n} height={n} />
    </svg>
  </div>

  <BrushPicker {stops} bind:value={brush} {icon} />
</GameScreen>
