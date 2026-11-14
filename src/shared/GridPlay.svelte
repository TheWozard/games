<!--
  The whole screen for a digit-grid game, inside GameScreen: board, the Erase / Notes / Set modes,
  number pad, keyboard controls and saving. No cell is ever selected: the player picks a mode and a
  digit, then taps cells (Set, Erase) or drags across them (Notes, Erase). A game supplies how to make and
  validate its state and how its board looks (`layout`); the moves come from grid.ts.
-->
<script lang="ts" module>
  import type { GridShape } from './grid';

  export interface GridLayout extends GridShape {
    /** Thick line on the cell's right / bottom edge (box or cage boundaries). */
    wallRight?: (i: number) => boolean;
    wallBottom?: (i: number) => boolean;
    /** A color (0–4, 0 blank) filling the cell's zone, e.g. its cage, inset from the zone's outline. Touching zones must differ. */
    zone?: (i: number) => number;
    /** Small text in the cell's top-left corner (cage clues). */
    label?: (i: number) => string;
    /** Extra error highlighting beyond repeated digits (e.g. a full cage that doesn't add up). */
    error?: (i: number) => boolean;
  }
</script>

<script lang="ts" generics="G extends GridState">
  import { untrack } from 'svelte';
  import GameScreen from './GameScreen.svelte';
  import { gridKey, gridReducer, hasConflict, type GridAction, type GridState, type Mode } from './grid';
  import { loadJSON, saveJSON } from './storage';
  import VariantPicker, { parsePick, type Games } from './VariantPicker.svelte';
  import Eraser from '@lucide/svelte/icons/eraser';
  import Pencil from '@lucide/svelte/icons/pencil';
  import NotebookPen from '@lucide/svelte/icons/notebook-pen';
  import './grid.css';

  interface Props {
    title: string;
    storageKey: string;
    difficulties: Record<string, { label: string }>;
    isValid: (value: unknown) => value is G;
    create: (difficulty: string) => G;
    layout: (game: G) => GridLayout;
    /**
     * For a page holding several such games (Sudoku: Classic and Killer): all of them, this one's
     * key, and what to do when the New Game dialog plays another ("<game>:<difficulty>").
     */
    variants?: { games: Games; current: string; onswitch: (pick: string) => void };
    /** Start a new game at this difficulty instead of resuming the saved one. */
    first?: string;
  }

  let { title, storageKey, difficulties, isValid, create, layout, variants, first }: Props = $props();

  // The whole game is one immutable value; every move replaces it via the reducer in grid.ts.
  let game = $state.raw(
    untrack(() =>
      first !== undefined && Object.hasOwn(difficulties, first)
        ? create(first)
        : (loadJSON(storageKey, isValid) ?? create(Object.keys(difficulties)[0])),
    ),
  );
  const shape = $derived(layout(game));
  const dispatch = (action: GridAction) => (game = gridReducer(game, action, shape));

  const digits = $derived(Array.from({ length: shape.size }, (_, k) => k + 1));

  // What a tap does, and with which digit. Picking a digit while erasing goes back to the mode that
  // writes (Set or Notes) used last.
  let mode = $state<Mode>('set');
  let writing = $state<Exclude<Mode, 'erase'>>('set');
  let digit = $state(1);
  function setMode(m: Mode) {
    mode = m;
    if (m !== 'erase') writing = m;
  }
  function pickDigit(d: number) {
    digit = d;
    if (mode === 'erase') mode = writing;
  }
  /**
   * Where a cell's zone fill stops short of the cell, so each zone reads as one inset shape: insets on
   * the sides that border another zone (or the board's edge), and notches at inner corners, where
   * both sides continue the zone but the diagonal cell is another zone.
   */
  function zoneFill(i: number): string {
    const zone = shape.zone!;
    const n = shape.size;
    const r = Math.floor(i / n);
    const c = i % n;
    const z = zone(i);
    const same = (dr: number, dc: number) =>
      r + dr >= 0 && r + dr < n && c + dc >= 0 && c + dc < n && zone(i + dr * n + dc) === z;
    const [t, rt, b, l] = [!same(-1, 0), !same(0, 1), !same(1, 0), !same(0, -1)];
    const g = 'var(--zone-gap)';
    const notch = (side1: boolean, side2: boolean, dr: number, dc: number) => !side1 && !side2 && !same(dr, dc);
    const fit = (edge: boolean) => (edge ? g : '0px');
    // Corners clockwise from top-left, in the fill's own box (already inset on bordering sides).
    const pts = [
      notch(t, l, -1, -1) ? [`0 ${g}`, `${g} ${g}`, `${g} 0`] : ['0 0'],
      notch(t, rt, -1, 1) ? [`calc(100% - ${g}) 0`, `calc(100% - ${g}) ${g}`, `100% ${g}`] : ['100% 0'],
      notch(b, rt, 1, 1) ? [`100% calc(100% - ${g})`, `calc(100% - ${g}) calc(100% - ${g})`, `calc(100% - ${g}) 100%`] : ['100% 100%'],
      notch(b, l, 1, -1) ? [`${g} 100%`, `${g} calc(100% - ${g})`, `0 calc(100% - ${g})`] : ['0 100%'],
    ].flat();
    return `inset: ${fit(t)} ${fit(rt)} ${fit(b)} ${fit(l)}; clip-path: polygon(${pts.join(', ')})`;
  }

  const remaining = $derived(digits.map((d) => shape.size - game.values.filter((v) => v === d).length));

  // Save after every change (the reducer returns a new object only when something changed).
  $effect(() => saveJSON(storageKey, game));

  // With variants, the New Game dialog's pick ("<game>:<difficulty>"), reset each time it opens.
  let pick = $state('');
  let pickerOpens = $state(0);

  function start(value: string) {
    if (!variants) {
      if (Object.hasOwn(difficulties, value)) game = create(value);
      return;
    }
    const chosen = value === 'start' ? parsePick(variants.games, pick) : null;
    if (!chosen) return;
    if (chosen.game !== variants.current) variants.onswitch(pick);
    else if (Object.hasOwn(difficulties, chosen.setting)) game = create(chosen.setting);
  }

  function onKey(e: KeyboardEvent) {
    if (document.querySelector('dialog[open]')) return;
    const key = gridKey(e);
    if (!key) return;
    e.preventDefault();
    if ('digit' in key) { if (key.digit <= shape.size) pickDigit(key.digit); }
    else setMode(key.mode === 'notes' && mode === 'notes' ? 'set' : key.mode);
  }

  // ---- Strokes ----
  // A press starts a stroke on a cell. Set places the digit in that one cell. Notes and Erase carry
  // on over every cell the finger passes: Notes adds the digit's note, or takes it away if the first
  // cell already had it; Erase clears each cell. It's drawn as it goes and applied on release, as one
  // move for Undo.

  interface Stroke {
    pointer: number;
    mode: Mode;
    digit: number;
    on: boolean; // Notes: add the note (or take it away)
    path: number[];
  }

  let stroke = $state.raw<Stroke | null>(null);
  let board = $state<HTMLElement>();

  function action({ mode, digit, on, path }: Stroke): GridAction {
    if (mode === 'set') return { type: 'place', index: path[0], digit };
    if (mode === 'notes') return { type: 'note', indices: path, digit, on };
    return { type: 'erase', indices: path };
  }

  function strokeAt(i: number, pointer: number): Stroke {
    const on = !(game.values[i] === 0 && game.notes[i] & (1 << digit));
    return { pointer, mode, digit, on, path: [i] };
  }

  function cellAt(e: PointerEvent): number | null {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-cell]');
    return el && board?.contains(el) ? Number(el.dataset.cell) : null;
  }

  function down(e: PointerEvent) {
    if (game.done || stroke || e.button !== 0) return;
    const i = cellAt(e);
    if (i === null) return;
    e.preventDefault();
    board?.setPointerCapture(e.pointerId);
    stroke = strokeAt(i, e.pointerId);
  }

  function move(e: PointerEvent) {
    if (!stroke || e.pointerId !== stroke.pointer || stroke.mode === 'set') return;
    const i = cellAt(e);
    const last = stroke.path.at(-1)!;
    if (i === null || i === last) return;
    // Every cell on the way from the last one, so a quick swipe doesn't skip any.
    const n = shape.size;
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

  function up(e: PointerEvent) {
    if (!stroke || e.pointerId !== stroke.pointer) return;
    const s = stroke;
    stroke = null;
    dispatch(action(s));
  }

  function cancel(e: PointerEvent) {
    if (stroke && e.pointerId === stroke.pointer) stroke = null;
  }

  // A keyboard press on a cell (Enter or Space) acts like a tap; pointer taps go through the stroke.
  function keyTap(e: MouseEvent, i: number) {
    if (e.detail !== 0 || game.done) return;
    dispatch(action(strokeAt(i, -1)));
  }

  // What's on screen: the game, with the stroke in progress drawn over it.
  const shown = $derived(stroke ? gridReducer(game, action(stroke), shape) : game);
</script>

<svelte:document onkeydown={onKey} />

{#snippet variantPicker()}
  {#key pickerOpens}<VariantPicker games={variants!.games} bind:value={pick} />{/key}
{/snippet}

<GameScreen
  {title}
  subtitle={[variants?.games[variants.current].label, difficulties[game.difficulty]?.label].filter(Boolean).join(' · ')}
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  options={variants ? [] : Object.entries(difficulties).map(([value, { label }]) => ({ value, label }))}
  current={game.difficulty}
  picker={variants ? variantPicker : undefined}
  onopennew={() => { if (variants) { pick = `${variants.current}:${game.difficulty}`; pickerOpens++; } }}
  onstart={start}
  finished={game.done}
  onnext={() => (game = create(game.difficulty))}
>
  <div class="board-area">
    <div
      bind:this={board}
      class="board grid-board"
      role="group"
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={cancel}
      onlostpointercapture={cancel}
      style:--n={shape.size} style:--note-cols={shape.size <= 4 ? 2 : 3} style:--note-rows={Math.ceil(shape.size / (shape.size <= 4 ? 2 : 3))} aria-label="{title} board"
    >
      {#each shown.values as v, i (i)}
        {@const r = Math.floor(i / shape.size)}
        {@const c = i % shape.size}
        {@const given = game.puzzle[i] !== 0}
        {@const mask = v ? 0 : shown.notes[i]}
        {@const label = shape.label?.(i)}
        <button
          type="button"
          class={['cell', {
            // Not along the board's own edge: its border draws that, and a wall's square end would
            // poke out past the rounded corner.
            'wall-r': c < shape.size - 1 && shape.wallRight?.(i),
            'wall-b': r < shape.size - 1 && shape.wallBottom?.(i),
            [`zone-${shape.zone?.(i)}`]: shape.zone !== undefined,
            given,
            'corner-tl': i === 0,
            'corner-tr': i === shape.size - 1,
            'corner-bl': i === shape.size * (shape.size - 1),
            'corner-br': i === shape.size * shape.size - 1,
            same: mode !== 'erase' && v === digit,
            conflict: !given && (hasConflict(shown.values, shape.peers, i) || shape.error?.(i)),
          }]}
          aria-label="{label ? `${label}, ` : ''}row {r + 1}, column {c + 1}: {v || 'empty'}"
          data-cell={i}
          onclick={(e) => keyTap(e, i)}
        >
          {#if shape.zone}<span class="zone-fill" style={zoneFill(i)}></span>{/if}
          {#if label}<span class="label">{label}</span>{/if}
          <span class="value">{v || ''}</span>
          <span class="notes">
            {#each digits as d (d)}<span class={{ hit: mode !== 'erase' && d === digit }}>{mask & (1 << d) ? d : ''}</span>{/each}
          </span>
        </button>
      {/each}
    </div>
  </div>

  <div class="tools grid-tools">
    {#each [['erase', 'Erase', Eraser], ['notes', 'Notes', NotebookPen], ['set', 'Set', Pencil]] as const as [m, name, Icon] (m)}
      <button type="button" class="btn" aria-pressed={mode === m} aria-label={name} title={name} onclick={() => setMode(m)}>
        <Icon size={22} aria-hidden="true" />
      </button>
    {/each}
  </div>

  <div class={['pad', { 'notes-mode': mode === 'notes' || (mode === 'erase' && writing === 'notes') }]} style:--n={shape.size}>
    {#each digits as d, k (d)}
      <button
        type="button"
        class={['digit', { complete: remaining[k] <= 0 }]}
        aria-pressed={mode !== 'erase' && d === digit}
        onclick={() => pickDigit(d)}
      >
        <span class="digit-n">{d}</span>
        <span class="digit-left">{remaining[k] > 0 ? remaining[k] : ''}</span>
      </button>
    {/each}
  </div>
</GameScreen>
