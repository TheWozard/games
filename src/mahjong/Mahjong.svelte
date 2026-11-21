<script lang="ts">
  import { scale } from 'svelte/transition';
  import GameScreen2 from '../shared/GameScreen2.svelte';
  import Button from '../shared/ui/Button.svelte';
  import Choice from '../shared/ui/Choice.svelte';
  import PickGroup from '../shared/ui/PickGroup.svelte';
  import Toggle from '../shared/ui/Toggle.svelte';
  import Chip from '../shared/ui/Chip.svelte';
  import PickList from '../shared/ui/PickList.svelte';
  import { createShake } from '../shared/shake.svelte';
  import { formatSeed } from '../shared/seed';
  import { CHOICES, loadSettings, saveSetting, type Setting, type Settings } from '../shared/settings';
  import { loadJSON, saveJSON } from '../shared/storage';
  import TileFaces from './TileFaces.svelte';
  import LayoutThumb from './LayoutThumb.svelte';
  import { DEPTH } from './body';
  import TileBody from './TileBody.svelte';
  import { dealFrom, free, fromSaved, newGame, pairsLeft, poolOf, reducer, slotsOf, STORAGE_KEY, type Action } from './game';
  import { ARCHIVE_IDS, layoutOf, OWN_IDS, type Layout, type LayoutId } from './layouts';
  import { DIFFICULTIES, drawOrder, MAX_TILES, type Difficulty } from './logic';

  const anything = (_value: unknown): _value is unknown => true;
  let game = $state.raw(fromSaved(loadJSON(STORAGE_KEY, anything)) ?? newGame('pyramid'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  // How the tiles look: set in the Display dialog (from the menu), and changed at once (saved for next time too).
  let prefs = $state.raw(loadSettings());
  const inset = $derived(prefs.mahjongFaces === 'inset');
  const dim = $derived(prefs.mahjongBlocked === 'dimmed');
  const SETTINGS: { key: Setting & `mahjong${string}`; label: string; names: Record<string, [string, string]> }[] = [
    { key: 'mahjongArt', label: 'Tile Art', names: { classic: ['Classic', 'hand-drawn'], riichi: ['Riichi', 'Japanese-style set'] } },
    { key: 'mahjongFaces', label: 'Tile Faces', names: { full: ['Full', 'fill the tile'], inset: ['Inset', 'space between tiles'] } },
    { key: 'mahjongBlocked', label: 'Blocked Tiles', names: { dimmed: ['Dimmed', 'free tiles stand out'], plain: ['Plain', 'all look alike'] } },
  ];
  const pickSetting = <K extends Setting>(key: K, value: Settings[K]) => (prefs = saveSetting(key, value));

  const layout = $derived(layoutOf(game.layout));
  const slots = $derived(slotsOf(game));
  const moves = $derived(pairsLeft(game).length);
  const tilesLeft = $derived(game.gone.filter((g) => !g).length);

  // Geometry, in units where a tile is 3 × 4: half-tile steps of 1.5 across and 2 down, each layer
  // raised up and left by LIFT, and every tile showing DEPTH of its side below and to the right.
  const LIFT = 0.42;
  // A tile's top left corner, before the board's own offset: lower layers are drawn further right
  // and down, so the top layer sits up and left of them.
  const leftOf = (s: { x: number; z: number }, maxZ: number) => s.x * 1.5 + (maxZ - s.z) * LIFT;
  const topOf = (s: { y: number; z: number }, maxZ: number) => s.y * 2 + (maxZ - s.z) * LIFT;
  // The board: just around the tiles as drawn, face to the far edge of its side, so it has as much
  // room on the left and top as on the right and bottom (a layout whose raised tiles don't reach
  // its left edge would otherwise leave an empty strip there). x0, y0: its top left, as above.
  const box = $derived.by(() => {
    const maxZ = Math.max(...slots.map((s) => s.z));
    const lefts = slots.map((s) => leftOf(s, maxZ));
    const tops = slots.map((s) => topOf(s, maxZ));
    const x0 = Math.min(...lefts);
    const y0 = Math.min(...tops);
    return { x0, y0, w: Math.max(...lefts) + 3 + DEPTH - x0, h: Math.max(...tops) + 4 + DEPTH - y0, maxZ };
  });

  // Size, in pixels per unit: the same for every layout, so a small one's tiles are as big as a large
  // one's. A layout 8 tiles across just fills the width (an upright phone), or one 8 tiles down
  // the height (a landscape tablet or desktop), whichever is smaller. That's the board at zoom 1,
  // where the stage (GameScreen2) opens it, centered; a bigger layout pans, and any zooms.
  const EIGHT_W = 8 * 3 + DEPTH + 3 * LIFT; // 8 tiles across, with sides and a few layers
  const EIGHT_H = 8 * 4 + DEPTH + 3 * LIFT; // 8 tiles down
  let stageW = $state(0);
  let stageH = $state(0);
  const u = $derived(Math.min((stageW || 360) / EIGHT_W, (stageH || 640) / EIGHT_H));
  const board = $derived({ width: box.w * u, height: box.h * u });

  // Back to front, so each tile's side and shadow land under the neighbors that should cover them.
  const order = $derived(drawOrder(slots).map((i) => ({ ...slots[i], i })));

  $effect(() => saveJSON(STORAGE_KEY, game));

  // What the menu's Details copies: what deals these tiles again (no seed in saves from before there was one).
  const puzzle = $derived(
    [game.seed !== undefined && formatSeed(game.seed), game.layout, game.difficulty]
      .filter(Boolean)
      .join(' · '),
  );

  // How hard a deal is: how often taking any free pair at random would still clear it (logic.ts).
  const LEVELS: Record<Difficulty, { label: string; detail: string }> = {
    easy: { label: 'Zen', detail: 'forgiving' },
    medium: { label: 'Balance', detail: 'a few traps' },
    hard: { label: 'Focus', detail: 'plan ahead' },
  };

  // The Customize dialog's picks, starting on the current game's: a difficulty, and any number of
  // layouts, a pool each deal takes one from at random (Play needs at least one). Play deals them.
  // Layouts are one list, the game's own then the archive's (layouts.ts), narrowed by the filter
  // chips above it: with none on, every layout shows; otherwise a layout must pass every kind of
  // filter that has a chip on (where it's from, how many tiles, how high), and, within a kind, any
  // one of them (a layout has only one source). All and None change only the layouts shown.
  const EVERY = [...OWN_IDS, ...ARCHIVE_IDS];
  const layers = (l: Layout) => Math.max(...l.slots.map((s) => s.z)) + 1;
  const FILTERS: { key: string; kind: string; label: string; test: (l: Layout) => boolean }[] = [
    { key: 'original', kind: 'source', label: 'Original', test: (l) => !l.archive },
    { key: 'kmahjongg', kind: 'source', label: 'KMahjongg', test: (l) => l.archive?.source === 'KMahjongg' },
    { key: 'gnome', kind: 'source', label: 'GNOME', test: (l) => l.archive?.source === 'GNOME Mahjongg' },
    { key: 'quick', kind: 'size', label: 'Quick', test: (l) => l.slots.length < 120 },
    { key: 'full', kind: 'size', label: 'Full Set', test: (l) => l.slots.length === MAX_TILES },
    { key: 'flat', kind: 'height', label: 'Flat', test: (l) => layers(l) <= 3 },
    { key: 'tall', kind: 'height', label: 'Tall', test: (l) => layers(l) >= 6 },
  ];
  let chosen = $state<LayoutId[]>([]);
  let level = $state<Difficulty>('medium');
  let filters = $state<string[]>([]);
  const passes = (id: LayoutId) => {
    const on = FILTERS.filter((f) => filters.includes(f.key));
    const kinds = new Set(on.map((f) => f.kind));
    return [...kinds].every((kind) => on.some((f) => f.kind === kind && f.test(layoutOf(id))));
  };
  const shownIds = $derived(EVERY.filter(passes));
  const flip = (key: string) => (filters = filters.includes(key) ? filters.filter((k) => k !== key) : [...filters, key]);
  const ordered = (ids: Set<LayoutId>) => EVERY.filter((id) => ids.has(id));
  function toggle(id: LayoutId) {
    chosen = chosen.includes(id) ? chosen.filter((k) => k !== id) : ordered(new Set([...chosen, id]));
  }
  /** Replaces the picks among the layouts shown with `ids`, keeping the hidden ones'. */
  function pickShown(ids: readonly LayoutId[]) {
    const seen = new Set(shownIds);
    chosen = ordered(new Set([...chosen.filter((id) => !seen.has(id)), ...ids]));
  }
  function openNew() {
    chosen = poolOf(game);
    level = game.difficulty;
    filters = [];
  }
  function start(value: string) {
    if (value === 'start' && chosen.length) deal(dealFrom(chosen, level, game.layout));
  }


  function deal(next: typeof game) {
    game = next; // the stage opens it on its starting view (boardKey)
  }

  // Dev menu entries (DevMenu.svelte): loaded by the dev server only, so a build leaves them out.
  let DevMenu = $state.raw<typeof import('./DevMenu.svelte').default>();
  if (import.meta.env.DEV) import('./DevMenu.svelte').then((m) => (DevMenu = m.default));

  // A tap on a blocked tile gives it a little shake instead of doing nothing at all.
  const shake = createShake<number>();
  function tap(i: number) {
    if (!free(game, i)) return shake.start(i);
    dispatch({ type: 'tap', slot: i });
  }
</script>

<TileFaces art={prefs.mahjongArt} />

<GameScreen2
  title="Mahjong"
  subtitle="{LEVELS[game.difficulty].label} · {layout.name}"
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  onopennew={openNew}
  onstart={start}
  canPlay={chosen.length > 0}
  finished={game.done}
  onnext={() => deal(dealFrom(poolOf(game), game.difficulty, game.layout))}
  {puzzle}
  {board}
  boardKey="{game.layout} {game.seed}"
  bind:stageWidth={stageW}
  bind:stageHeight={stageH}
>
  {#snippet status()}
    {#if !game.done}
      <span class="mj-count" aria-label="{tilesLeft} tiles left">
        <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2" width="9" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
        {tilesLeft}
      </span>
    {/if}
  {/snippet}
  {#snippet controls()}
    {#if !game.done && moves === 0}
      <!-- Stuck: the only time Shuffle appears. -->
      <p class="status">No matching pairs are free.</p>
      <Button primary onclick={() => dispatch({ type: 'shuffle' })}>Shuffle</Button>
    {/if}
  {/snippet}
  {#snippet settings()}
    {#each SETTINGS as { key, label, names } (key)}
      <PickGroup title={label}>
        {#each CHOICES[key] as value (value)}
          <Choice
            label={names[value][0]}
            detail={names[value][1]}
            pressed={prefs[key] === value}
            onclick={() => pickSetting(key, value as Settings[typeof key])}
          />
        {/each}
      </PickGroup>
    {/each}
  {/snippet}
  {#snippet dev()}
    {#if DevMenu}<DevMenu {game} set={deal} />{/if}
  {/snippet}
  {#snippet picker()}
    <PickGroup title="Difficulty">
      {#each DIFFICULTIES as d (d)}
        <Choice label={LEVELS[d].label} detail={LEVELS[d].detail} pressed={level === d} onclick={() => (level = d)} />
      {/each}
    </PickGroup>
    <PickList title="Layouts" count={chosen.length}>
      {#snippet actions()}
        <span class="pick-select">Select</span>
        <Button small disabled={!shownIds.length} onclick={() => pickShown(shownIds)}>All</Button>
        <Button small disabled={!shownIds.length} onclick={() => pickShown([])}>None</Button>
      {/snippet}
      {#snippet chips()}
        {#each FILTERS as f, i (f.key)}
          {#if i && f.kind !== FILTERS[i - 1].kind}<span class="chip-gap" aria-hidden="true"></span>{/if}
          <Chip label={f.label} on={filters.includes(f.key)} onclick={() => flip(f.key)} />
        {/each}
      {/snippet}
      {#each shownIds as id (id)}
        {@const l = layoutOf(id)}
        <Toggle label={l.name} detail="{l.slots.length} tiles" on={chosen.includes(id)} onclick={() => toggle(id)}>
          {#snippet aside()}<LayoutThumb slots={l.slots} />{/snippet}
        </Toggle>
      {:else}
        <p class="pick-empty">No layouts match.</p>
      {/each}
    </PickList>
  {/snippet}

  <div
    class="mj-board"
    style:width="{board.width}px"
    style:height="{board.height}px"
    style:--u="{u}px"
    role="group"
    aria-label="Mahjong tiles"
  >
    {#each order as s (s.i)}
      {#if !game.gone[s.i]}
        <button
          type="button"
          class={['mj-tile', {
            blocked: dim && !free(game, s.i),
            selected: game.selected === s.i,
            shake: shake.current === s.i,
            inset,
          }]}
          style:left="{((leftOf(s, box.maxZ) - box.x0) / box.w) * 100}%"
          style:top="{((topOf(s, box.maxZ) - box.y0) / box.h) * 100}%"
          style:width="{(3 / box.w) * 100}%"
          style:height="{(4 / box.h) * 100}%"
          data-slot={s.i}
          aria-label="Tile"
          onclick={() => tap(s.i)}
          transition:scale={{ duration: 180, start: 0.7 }}
        >
          <TileBody href="mj-k{game.kinds[s.i]}" />
        </button>
      {/if}
    {/each}
  </div>
</GameScreen2>
