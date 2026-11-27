<!--
  The Grid tool's screen: a blank size × size grid to work a puzzle out on (one from a book, or a
  game that has no notes of its own). The tools row has, at the left, Solid (shades cells) and Edge
  (draws the lines between cells solid, to outline regions), then Sudoku's Erase / Notes / Write.
  Under it, the pad picks the mark Write and Notes place, from the grid's own set (numbers, letters
  and symbols, picked in Customize: marks.ts). No cell is ever selected: pick a tool, then tap or
  drag. There are no rules and no win, so nothing turns red and Next never shows.

  On GameScreen2, but without a `board` size: ZoomStage would take a one-finger drag to pan, and
  here a drag draws. So the grid fits the stage above the floating controls (measured), as a
  GameScreen board fits above its controls. The menu's New clears the grid with the same size and
  marks, and Customize picks others. A blank grid takes no making, so no worker: both settle at once.
-->
<script lang="ts">
  import Eraser from '@lucide/svelte/icons/eraser';
  import NotebookPen from '@lucide/svelte/icons/notebook-pen';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Square from '@lucide/svelte/icons/square';
  import SquareDashedTopSolid from '@lucide/svelte/icons/square-dashed-top-solid';
  import GameScreen2 from '../shared/GameScreen2.svelte';
  import { gridKey } from '../shared/grid';
  import { loadSettings, saveSetting, type Setting, type Settings } from '../shared/settings';
  import { loadJSON, saveJSON } from '../shared/storage';
  import Button from '../shared/ui/Button.svelte';
  import Choice from '../shared/ui/Choice.svelte';
  import PickGroup from '../shared/ui/PickGroup.svelte';
  import Toggle from '../shared/ui/Toggle.svelte';
  import {
    BOTTOM,
    DEFAULT_SIZE,
    edgeBetween,
    hasEdge,
    isSheet,
    nearestEdge,
    newSheet,
    pointsBetween,
    reducer,
    RIGHT,
    SIZES,
    SOLID,
    type SheetAction,
  } from './game';
  import Mark from './Mark.svelte';
  import {
    DEFAULT_MARKS,
    groupOf,
    MARK_GROUPS,
    markName,
    MAX_MARKS,
    sortMarks,
    type Behavior,
    type Clears,
    type GroupId,
  } from './marks';
  import '../shared/grid.css';

  const STORAGE_KEY = 'games.grid.v1';

  let sheet = $state.raw(loadJSON(STORAGE_KEY, isSheet) ?? newSheet(DEFAULT_SIZE));
  const dispatch = (action: SheetAction) => (sheet = reducer(sheet, action));
  $effect(() => saveJSON(STORAGE_KEY, sheet));

  // Customize's picks, starting on the current grid's each time it opens: its size, and the marks
  // its pad offers (any mix of numbers, letters and symbols, up to MAX_MARKS).
  let size = $state(DEFAULT_SIZE);
  let picking = $state<string[]>([]);

  // How each group's marks act once written (marks.ts `Behavior`): set in the Display dialog, for
  // every grid, and changed at once (saved for next time too).
  let prefs = $state.raw(loadSettings());
  const KEYS = {
    numbers: ['gridNumbersClears', 'gridNumbersNotes', 'gridNumbersHighlight', 'gridNumbersFaded'],
    letters: ['gridLettersClears', 'gridLettersNotes', 'gridLettersHighlight', 'gridLettersFaded'],
    symbols: ['gridSymbolsClears', 'gridSymbolsNotes', 'gridSymbolsHighlight', 'gridSymbolsFaded'],
  } as const satisfies Record<GroupId, readonly [Setting, Setting, Setting, Setting]>;
  const CLEAR_CHOICES: [Clears, string, string][] = [
    ['none', 'Keep', 'notes stay'],
    ['lines', 'Lines', 'row & column'],
    ['grid', 'Grid', 'everywhere'],
  ];
  const behaviors = $derived(
    Object.fromEntries(
      MARK_GROUPS.map(({ id }) => {
        const [clears, notes, highlight, faded] = KEYS[id];
        return [
          id,
          {
            clears: prefs[clears],
            notes: prefs[notes] === 'on',
            highlight: prefs[highlight] === 'on',
            faded: prefs[faded] === 'on',
          },
        ];
      }),
    ) as Record<GroupId, Behavior>,
  );
  const pickSetting = <K extends Setting>(key: K, value: Settings[K]) =>
    (prefs = saveSetting(key, value));
  function flip(m: string) {
    if (picking.includes(m)) picking = picking.filter((p) => p !== m);
    else if (picking.length < MAX_MARKS) picking = sortMarks([...picking, m]);
  }
  function blank(n: number, marks: readonly string[]): Promise<void> {
    sheet = newSheet(n, marks);
    return Promise.resolve();
  }

  // The floating controls' height, kept clear under the grid.
  let controlsHeight = $state(0);

  // The pad, and the notes inside a cell: a slot per mark, so each keeps its place. Up to 4 marks in
  // 2 columns, 9 in 3 (Sudoku's), 16 in 4. The pad is one row of up to 10, or two even rows.
  const marks = $derived(sheet.marks);
  const noteCols = $derived(
    marks.length <= 4 ? 2
    : marks.length <= 9 ? 3
    : 4,
  );
  const padCols = $derived(marks.length <= 10 ? marks.length : Math.ceil(marks.length / 2));

  // What a tap or drag does. Write and Notes place the pad's mark; picking a mark while another
  // tool is on goes back to the one of those two used last. A mark whose group can't be noted
  // (Display) is written even while Notes is on: Write shows as the tool then (the pad keeps such
  // marks full size among the small noted ones), and Notes comes back by itself once a mark that
  // can be noted is picked. Tapping Notes then picks the last mark that could be noted again.
  // `chosen` is the tool tapped; `tool` the one a tap uses.
  type Tool = 'edge' | 'erase' | 'notes' | 'set' | 'solid';
  const TOOLS = [
    ['solid', 'Solid', Square],
    ['edge', 'Edge', SquareDashedTopSolid],
    ['erase', 'Erase', Eraser],
    ['notes', 'Notes', NotebookPen],
    ['set', 'Write', Pencil],
  ] as const;
  let chosen = $state<Tool>('set');
  let writing = $state<'notes' | 'set'>('set');
  let picked = $state('');
  let pickedNotable = $state(''); // the last mark picked that can be noted
  // The picked mark, or the pad's first when it isn't on this grid's pad (a new grid's, at first).
  const mark = $derived(marks.includes(picked) ? picked : marks[0]);
  const behavior = (m: string) => {
    const g = groupOf(m);
    return g ? behaviors[g] : null;
  };
  const canNote = (m: string) => behavior(m)?.notes !== false;
  const notable = $derived(canNote(mark));
  // What Notes goes back to from a mark that can't be noted: the last one that could, if it's still
  // on the pad and still can, or else the pad's first that can (none: Notes is off).
  const noteMark = $derived(
    marks.includes(pickedNotable) && canNote(pickedNotable) ? pickedNotable : marks.find(canNote),
  );
  const tool = $derived(chosen === 'notes' && !notable ? 'set' : chosen);
  const placing = $derived(tool === 'set' || tool === 'notes');
  // Cells holding the picked mark light up, if its group says so.
  const lit = $derived(placing && behavior(mark)?.highlight === true);
  function setTool(t: Tool) {
    if (t === 'notes' && !notable && noteMark) picked = noteMark;
    chosen = t;
    if (t === 'set' || t === 'notes') writing = t;
  }
  function pickMark(m: string) {
    picked = m;
    if (canNote(m)) pickedNotable = m;
    if (!placing) chosen = writing;
  }

  function onKey(e: KeyboardEvent) {
    if (document.querySelector('dialog[open]')) return;
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      // A number or letter on the pad picks it. Otherwise, on top of Sudoku's keys (1–9, S, N,
      // Backspace): C for a check, W to write, F to fill (Solid) and E for Edge.
      const ch = e.key.length === 1 ? e.key.toUpperCase() : '';
      const tools: Record<string, Tool> = { W: 'set', F: 'solid', E: 'edge' };
      const pick =
        marks.includes(ch) ? ch
        : ch === 'C' && marks.includes('check') ? 'check'
        : '';
      if (pick || ch in tools) {
        e.preventDefault();
        return pick ? pickMark(pick) : setTool(tools[ch]);
      }
    }
    const key = gridKey(e);
    if (!key) return;
    e.preventDefault();
    if (!('digit' in key)) setTool(key.mode === 'notes' && tool === 'notes' ? 'set' : key.mode);
  }

  // ---- Strokes ----
  // A press starts a stroke, drawn as it goes and applied on release, as one move for Undo.
  // - On cells (every tool but Edge): it carries on over every cell the finger passes. Solid,
  //   Write and Notes put their mark there, or take it away if the first cell already had it;
  //   Erase clears each cell.
  // - Along lines (Edge): it follows the grid lines from the point (where lines cross) nearest the
  //   press, drawing each line it runs along, or taking them away if the first one was drawn. A
  //   press that never reaches another point is a tap: it toggles the line nearest it.

  interface CellStroke {
    kind: 'cell';
    mark: string;
    on: boolean;
    path: number[];
    pointer: number;
    tool: Exclude<Tool, 'edge'>;
  }
  interface EdgeStroke {
    at: [number, number]; // the grid point it has reached
    edges: number[];
    kind: 'edge';
    on: boolean;
    pointer: number;
    press: [number, number]; // where it started, in cells
  }

  let stroke = $state.raw<CellStroke | EdgeStroke | null>(null);
  let board = $state<HTMLElement>();

  function action(s: CellStroke | EdgeStroke): null | SheetAction {
    if (s.kind === 'edge')
      return s.edges.length ? { type: 'edge', edges: s.edges, on: s.on } : null;
    const { tool, mark, on, path } = s;
    if (tool === 'erase') return { type: 'erase', indices: path };
    if (tool === 'solid') return { type: 'write', indices: path, mark: SOLID, on };
    if (tool === 'set')
      return { type: 'write', indices: path, mark, on, clears: behavior(mark)?.clears };
    return { type: 'note', indices: path, mark, on };
  }

  function cellStroke(i: number, pointer: number, t: Exclude<Tool, 'edge'>): CellStroke {
    const had =
      t === 'solid' ? sheet.values[i] === SOLID
      : t === 'set' ? sheet.values[i] === mark
      : sheet.values[i] === '' && sheet.notes[i].includes(mark);
    return { kind: 'cell', pointer, tool: t, mark, on: !had, path: [i] };
  }

  function cellAt(e: PointerEvent): null | number {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-cell]');
    return el && board?.contains(el) ? Number(el.dataset.cell) : null;
  }

  /** Where a pointer is on the board, in cells from its top-left corner (inside the border). */
  function boardPoint(e: PointerEvent): [number, number] {
    const r = board!.getBoundingClientRect();
    const cell = board!.clientWidth / sheet.size;
    return [
      (e.clientX - r.left - board!.clientLeft) / cell,
      (e.clientY - r.top - board!.clientTop) / cell,
    ];
  }
  const nearestPoint = ([fx, fy]: [number, number]): [number, number] => {
    const clamp = (v: number) => Math.min(sheet.size, Math.max(0, Math.round(v)));
    return [clamp(fx), clamp(fy)];
  };

  function down(e: PointerEvent) {
    if (stroke || e.button !== 0) return;
    if (tool === 'edge') {
      const press = boardPoint(e);
      stroke = {
        kind: 'edge',
        pointer: e.pointerId,
        press,
        at: nearestPoint(press),
        edges: [],
        on: true,
      };
    } else {
      const i = cellAt(e);
      if (i === null) return;
      stroke = cellStroke(i, e.pointerId, tool);
    }
    e.preventDefault();
    board?.setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (e.pointerId !== stroke?.pointer) return;
    if (stroke.kind === 'edge') return moveEdge(stroke, boardPoint(e));
    const i = cellAt(e);
    const last = stroke.path.at(-1)!;
    if (i === null || i === last) return;
    // Every cell on the way from the last one, so a quick swipe doesn't skip any.
    const n = sheet.size;
    const path = stroke.path.slice();
    const [r0, c0] = [Math.floor(last / n), last % n];
    const [dr, dc] = [Math.floor(i / n) - r0, (i % n) - c0];
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    for (let t = 1; t <= steps; t++) {
      const j = (r0 + Math.round((dr * t) / steps)) * n + c0 + Math.round((dc * t) / steps);
      if (!path.includes(j)) path.push(j);
    }
    stroke = { ...stroke, path };
  }

  function moveEdge(s: EdgeStroke, f: [number, number]) {
    // A point counts once the finger is near it, not merely nearer it than any other, so a drag
    // through the middle of a cell doesn't flick between corners.
    const point = nearestPoint(f);
    if (Math.hypot(f[0] - point[0], f[1] - point[1]) > 0.4) return;
    if (point[0] === s.at[0] && point[1] === s.at[1]) return;
    const edges = s.edges.slice();
    let { on } = s;
    let from = s.at;
    for (const to of pointsBetween(s.at, point)) {
      const id = edgeBetween(sheet.size, from, to);
      from = to;
      if (id === null || edges.includes(id)) continue;
      if (edges.length === 0) on = !hasEdge(sheet, id);
      edges.push(id);
    }
    stroke = { ...s, at: point, edges, on };
  }

  function up(e: PointerEvent) {
    if (e.pointerId !== stroke?.pointer) return;
    const s = stroke;
    stroke = null;
    if (s.kind === 'edge' && s.edges.length === 0) {
      const id = nearestEdge(sheet.size, ...s.press);
      if (id !== null) dispatch({ type: 'edge', edges: [id], on: !hasEdge(sheet, id) });
      return;
    }
    const a = action(s);
    if (a) dispatch(a);
  }

  function cancel(e: PointerEvent) {
    if (e.pointerId === stroke?.pointer) stroke = null;
  }

  // A keyboard press on a cell (Enter or Space) acts like a tap with a cell tool; pointer taps go
  // through the stroke.
  function keyTap(e: MouseEvent, i: number) {
    if (e.detail !== 0 || tool === 'edge') return;
    const a = action(cellStroke(i, -1, tool));
    if (a) dispatch(a);
  }

  // What's on screen: the sheet, with the stroke in progress drawn over it.
  const shown = $derived.by(() => {
    const a = stroke && action(stroke);
    return a ? reducer(sheet, a) : sheet;
  });
</script>

<svelte:document onkeydown={onKey} />

{#snippet customize()}
  <!-- Twelve sizes: two rows of six, as one row would be too narrow on a phone. -->
  <PickGroup class="size-pick" title="Size">
    {#each SIZES as n (n)}
      <Choice label="{n}×{n}" onclick={() => (size = n)} pressed={size === n} />
    {/each}
  </PickGroup>

  <!-- Marks: any of them on, up to MAX_MARKS; the rest wait (disabled) once that many are on. -->
  <div class="pick-head">
    <h3 class="pick-title">
      Marks<span class="pick-count">{picking.length} of {MAX_MARKS}</span>
    </h3>
    <Button onclick={() => (picking = [...DEFAULT_MARKS])} small>Default</Button>
    <Button disabled={!picking.length} onclick={() => (picking = [])} small>None</Button>
  </div>
  {#each MARK_GROUPS as group (group.name)}
    <div class="mark-group">
      <span class="mark-group-name">{group.name}</span>
      <div class="mark-tiles">
        {#each group.marks as m (m)}
          {@const on = picking.includes(m)}
          <button
            class="btn mark-tile"
            aria-label={markName(m)}
            aria-pressed={on}
            disabled={!on && picking.length >= MAX_MARKS}
            onclick={() => flip(m)}
            title={markName(m)}
            type="button"
          >
            <Mark mark={m} />
          </button>
        {/each}
      </div>
    </div>
  {/each}
{/snippet}

{#snippet settings()}
  <!-- For each group: what writing one of its marks does to the same mark's notes, whether it can
       be noted, then how it looks. -->
  {#each MARK_GROUPS as { id, name } (id)}
    {@const [clears, notes, highlight, faded] = KEYS[id]}
    {@const b = behaviors[id]}
    <PickGroup title={name}>
      {#each CLEAR_CHOICES as [value, label, detail] (value)}
        <Choice
          {detail}
          {label}
          onclick={() => pickSetting(clears, value)}
          pressed={b.clears === value}
        />
      {/each}
    </PickGroup>
    <div class="mark-toggles">
      <Toggle
        label="Notes"
        on={b.notes}
        onclick={() => pickSetting(notes, b.notes ? 'off' : 'on')}
      />
      <Toggle
        label="Highlight"
        on={b.highlight}
        onclick={() => pickSetting(highlight, b.highlight ? 'off' : 'on')}
      />
      <Toggle
        label="Faded"
        on={b.faded}
        onclick={() => pickSetting(faded, b.faded ? 'off' : 'on')}
      />
    </div>
  {/each}
{/snippet}

<GameScreen2
  canPlay={picking.length > 0}
  canUndo={sheet.history.length > 0}
  finished={false}
  onnext={() => blank(sheet.size, sheet.marks)}
  onopennew={() => {
    size = sheet.size;
    picking = [...sheet.marks];
  }}
  onstart={() => blank(size, picking)}
  onundo={() => dispatch({ type: 'undo' })}
  picker={customize}
  {settings}
  subtitle="{sheet.size}×{sheet.size} · {marks.length} {marks.length === 1 ? 'mark' : 'marks'}"
  title="Grid"
>
  <div
    style:padding-bottom="calc({controlsHeight}px + 36px + var(--safe-bottom))"
    class="board-area tool-area"
  >
    <div
      bind:this={board}
      style:--n={sheet.size}
      style:--note-cols={noteCols}
      style:--note-rows={Math.ceil(marks.length / noteCols)}
      class={['board', 'grid-board', 'tool-grid', { 'edge-tool': tool === 'edge' }]}
      aria-label="Grid"
      onlostpointercapture={cancel}
      onpointercancel={cancel}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      role="group"
    >
      {#each shown.values as v, i (i)}
        {@const n = sheet.size}
        {@const [r, c] = [Math.floor(i / n), i % n]}
        {@const notes = v ? [] : shown.notes[i]}
        <button
          class={[
            'cell',
            {
              'wall-r': c < n - 1 && shown.edges[i] & RIGHT,
              'wall-b': r < n - 1 && shown.edges[i] & BOTTOM,
              'corner-tl': i === 0,
              'corner-tr': i === n - 1,
              'corner-bl': i === n * (n - 1),
              'corner-br': i === n * n - 1,
              solid: v === SOLID,
              same: lit && v === mark,
              faded: behavior(v)?.faded === true,
            },
          ]}
          aria-label="row {r + 1}, column {c + 1}: {v === SOLID ? 'solid'
          : v ? markName(v)
          : notes.length ? `notes ${notes.map(markName).join(', ')}`
          : 'empty'}"
          data-cell={i}
          onclick={(e) => keyTap(e, i)}
          type="button"
        >
          {#if v && v !== SOLID}<span class="value"><Mark mark={v} /></span>{/if}
          <span class="notes">
            {#each marks as m (m)}<span class={{ hit: lit && m === mark }}>
                {#if notes.includes(m)}<Mark mark={m} />{/if}
              </span>{/each}
          </span>
        </button>
      {/each}
    </div>
  </div>

  {#snippet controls()}
    <div class="tool-controls" bind:clientHeight={controlsHeight}>
      <div class="tools grid-tools">
        {#each TOOLS as [t, name, Icon] (t)}
          <button
            class={['btn', { 'group-start': t === 'erase' }]}
            aria-label={name}
            aria-pressed={tool === t}
            disabled={t === 'notes' && !noteMark}
            onclick={() => setTool(t)}
            title={name}
            type="button"
          >
            <Icon
              aria-hidden="true"
              fill={t === 'solid' ? 'currentColor' : 'none'}
              size={22}
              strokeWidth={t === 'solid' ? 1.5 : 2}
            />
          </button>
        {/each}
      </div>

      <div
        style:--pad-cols={padCols}
        class={['pad', 'tool-pad', { 'notes-mode': placing && chosen === 'notes' }]}
      >
        {#each marks as m (m)}
          <button
            class={['digit', { 'write-only': !canNote(m) }]}
            aria-label={markName(m)}
            aria-pressed={placing && m === mark}
            onclick={() => pickMark(m)}
            title={markName(m)}
            type="button"
          >
            <span class="digit-n"><Mark mark={m} /></span>
          </button>
        {/each}
      </div>
    </div>
  {/snippet}
</GameScreen2>

<style>
  /* Solid fills the cell. Solid edges are Sudoku's box lines (grid.css: .wall-r, .wall-b). */
  .tool-grid .cell.solid {
    background: var(--line-strong);
  }
  /* A solid cell is drawn as if every side were a wall: out over the 1px gap and 1px into each
     neighbor, as far as a wall reaches (grid.css: --grid-thick, centered on the gap), and on the
     walls' layer. So a wall that ends at its corner lines up with its edge instead of sticking
     out, and solid neighbors join with no line between them. In the board's corners it follows
     the border's rounding (the cell's 4px, plus the 2px it reaches out). */
  .tool-grid .cell.solid::before {
    position: absolute;
    inset: -2px;
    z-index: 1;
    pointer-events: none;
    content: '';
    background: var(--line-strong);
  }
  .tool-grid .cell.solid.corner-tl::before {
    border-top-left-radius: 6px;
  }
  .tool-grid .cell.solid.corner-tr::before {
    border-top-right-radius: 6px;
  }
  .tool-grid .cell.solid.corner-bl::before {
    border-bottom-left-radius: 6px;
  }
  .tool-grid .cell.solid.corner-br::before {
    border-bottom-right-radius: 6px;
  }
  /* Notes as large as their slots allow, by whichever is tighter: a slot's width (a glyph is
     narrower than it's tall) or its height. Sudoku's size (grid.css) in a 3×3. */
  .tool-grid .notes {
    font-size: calc(min(78 / var(--note-cols), 65 / var(--note-rows)) * 1cqi / var(--n));
  }
  /* A faded mark: dim, highlighted or not. */
  .tool-grid .cell.faded .value {
    opacity: 0.4;
  }
  /* With Edge, a press anywhere on the board draws, the border included. */
  .tool-grid.edge-tool {
    cursor: crosshair;
  }

  /* The stage's space, less a margin; the bottom (the controls and a gap) is set inline. Container
     units then size the grid to fit the rest. */
  .tool-area {
    padding: 12px 16px 0;
  }
  .tool-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 488px; /* GameScreen's column: 520px less its padding */
  }

  /* Solid and Edge, then a wider gap before Erase / Notes / Write. */
  .grid-tools .group-start {
    margin-left: 8px;
  }

  .tool-pad {
    grid-template-columns: repeat(var(--pad-cols), 1fr);
  }
  /* In Notes, a mark that can't be noted stays full size: a tap writes it. */
  .tool-pad.notes-mode .write-only .digit-n {
    font-size: 1.6rem; /* grid.css .digit-n */
    line-height: 1.1;
    color: inherit;
  }
  .tool-pad .digit {
    justify-content: center;
    min-height: 48px;
    padding: 6px 0;
  }

  /* Customize. */
  :global(.pick.size-pick) {
    grid-template-columns: repeat(6, 1fr);
    grid-auto-flow: row;
  }
  .mark-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .mark-group-name {
    font-size: 0.8rem;
    color: var(--muted);
  }
  /* Ten to a row: the numbers in one, the letters in three, the symbols in one. */
  .mark-tiles {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 4px;
  }
  .mark-toggles {
    display: grid;
    grid-template-columns: repeat(3, auto);
    gap: 4px;
  }
  /* Three to a row on a phone: a little tighter than a rule's toggle. */
  .mark-toggles :global(.btn.toggle) {
    gap: 6px;
    min-width: 0;
    padding: 10px 8px;
  }
  .mark-tile {
    display: grid;
    place-items: center;
    min-width: 0;
    aspect-ratio: 1;
    padding: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--muted);
  }
  .mark-tile[aria-pressed='true'] {
    color: var(--text);
  }
</style>
