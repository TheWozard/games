<script lang="ts">
  import { scale } from 'svelte/transition';
  import GameScreen2 from '../shared/GameScreen2.svelte';
  import Button from '../shared/ui/Button.svelte';
  import Choice from '../shared/ui/Choice.svelte';
  import PickGroup from '../shared/ui/PickGroup.svelte';
  import Toggle from '../shared/ui/Toggle.svelte';
  import { attachPan } from '../shared/pan';
  import { createShake } from '../shared/shake.svelte';
  import { formatSeed } from '../shared/seed';
  import { loadSettings } from '../shared/settings';
  import { loadJSON, saveJSON } from '../shared/storage';
  import TileFaces from './TileFaces.svelte';
  import { DEPTH } from './body';
  import TileBody from './TileBody.svelte';
  import { dealFrom, free, fromSaved, newGame, pairsLeft, poolOf, reducer, slotsOf, STORAGE_KEY, type Action } from './game';
  import { ARCHIVE_IDS, isArchive, layoutOf, OWN_IDS, SLIM_IDS, type LayoutId } from './layouts';
  import { DIFFICULTIES, drawOrder, type Difficulty } from './logic';

  const anything = (_value: unknown): _value is unknown => true;
  let game = $state.raw(fromSaved(loadJSON(STORAGE_KEY, anything)) ?? newGame('pyramid'));
  const dispatch = (action: Action) => (game = reducer(game, action));

  // Set from the launcher's gear; read once, as the page opens.
  const settings = loadSettings();
  const inset = settings.mahjongFaces === 'inset';
  const dim = settings.mahjongBlocked === 'dimmed';

  const layout = $derived(layoutOf(game.layout));
  const slots = $derived(slotsOf(game)); // turned, if it was dealt for an upright screen
  const moves = $derived(pairsLeft(game).length);
  const tilesLeft = $derived(game.gone.filter((g) => !g).length);

  // Geometry, in units where a tile is 3 × 4: half-tile steps of 1.5 across and 2 down, each layer
  // raised up and left by LIFT, and every tile showing DEPTH of its side below and to the right.
  const LIFT = 0.42;
  const box = $derived.by(() => {
    const maxX = Math.max(...slots.map((s) => s.x)) + 2;
    const maxY = Math.max(...slots.map((s) => s.y)) + 2;
    const maxZ = Math.max(...slots.map((s) => s.z));
    return { w: maxX * 1.5 + DEPTH + maxZ * LIFT, h: maxY * 2 + DEPTH + maxZ * LIFT, maxZ };
  });

  // Size, in pixels per unit: fit the board to the space, but never smaller than an 8-wide layout
  // gets on an upright phone (PHONE_W). Wide layouts keep that tile size and pan sideways
  // (scrollX, null: centered) when they don't fit; a wider screen (a tablet, a desktop) uses its
  // extra width and only pans if it must.
  const NARROW_W = 8 * 3 + DEPTH + 3 * LIFT; // about the widest layout that fits a phone upright
  const PHONE_W = 400;
  let areaW = $state(360);
  let areaH = $state(560);
  const u = $derived(Math.min(areaH / box.h, Math.max(areaW / box.w, Math.min(areaW, PHONE_W) / NARROW_W)));
  const maxScroll = $derived(Math.max(0, box.w * u - areaW));
  let scrollX = $state<number | null>(null);
  const sx = $derived(scrollX === null ? maxScroll / 2 : Math.min(Math.max(0, scrollX), maxScroll));

  let area = $state<HTMLElement>();
  let panning = $state(false);
  $effect(() => {
    if (!area) return;
    return attachPan(area, {
      max: () => maxScroll,
      get: () => sx,
      set: (x) => (scrollX = x),
      onPanning: (on) => (panning = on),
    });
  });

  // Back to front, so each tile's side and shadow land under the neighbors that should cover them.
  const order = $derived(drawOrder(slots).map((i) => ({ ...slots[i], i })));

  $effect(() => saveJSON(STORAGE_KEY, game));

  // The menu's puzzle line: what deals these tiles again (no seed in saves from before there was one).
  // Seed first, since a long line is cut short on a phone (a tap still copies all of it).
  const puzzle = $derived(
    [game.seed !== undefined && formatSeed(game.seed), game.layout, game.difficulty, game.turned && 'turned']
      .filter(Boolean)
      .join(' · '),
  );

  // How hard a deal is: how often taking any free pair at random would still clear it (logic.ts).
  const LEVELS: Record<Difficulty, { label: string; detail: string }> = {
    easy: { label: 'Easy', detail: 'forgiving' },
    medium: { label: 'Medium', detail: 'a few traps' },
    hard: { label: 'Hard', detail: 'plan ahead' },
  };

  // The New dialog's picks, starting on the current game's: a difficulty, and any number of
  // layouts, a pool each deal takes one from at random (Play needs at least one). Play deals them.
  // Layouts are on two tabs, the game's own and the archive's (layouts.ts); a pool can mix them,
  // and All and None change only the tab shown.
  const TABS = {
    own: { label: 'Original', ids: OWN_IDS },
    archive: { label: 'Archive', ids: ARCHIVE_IDS },
  };
  type Tab = keyof typeof TABS;
  const EVERY = [...OWN_IDS, ...ARCHIVE_IDS];
  let chosen = $state<LayoutId[]>([]);
  let level = $state<Difficulty>('medium');
  let tab = $state<Tab>('own');
  const ordered = (ids: Set<LayoutId>) => EVERY.filter((id) => ids.has(id));
  function toggle(id: LayoutId) {
    chosen = chosen.includes(id) ? chosen.filter((k) => k !== id) : ordered(new Set([...chosen, id]));
  }
  /** Replaces the picks on the tab shown with `ids`, keeping the other tab's. */
  function pickOnTab(ids: readonly LayoutId[]) {
    const shown = new Set(TABS[tab].ids);
    chosen = ordered(new Set([...chosen.filter((id) => !shown.has(id)), ...ids]));
  }
  function openNew() {
    chosen = poolOf(game);
    level = game.difficulty;
    tab = isArchive(game.layout) ? 'archive' : 'own';
  }
  function start(value: string) {
    if (value === 'start' && chosen.length) deal(dealFrom(chosen, level, game.layout, upright()));
  }

  // A layout wider than tall is dealt turned on an upright board area (game.ts, newGame); the game
  // keeps its turn to the end, even if the screen turns.
  const upright = () => areaH > areaW;

  function deal(next: typeof game) {
    game = next;
    scrollX = null; // a new deal opens centered
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

<TileFaces art={settings.mahjongArt} />

<GameScreen2
  title="Mahjong"
  subtitle="{LEVELS[game.difficulty].label} · {layout.name}"
  onundo={() => dispatch({ type: 'undo' })}
  canUndo={!game.done && game.history.length > 0}
  onopennew={openNew}
  onstart={start}
  canPlay={chosen.length > 0}
  finished={game.done}
  onnext={() => deal(dealFrom(poolOf(game), game.difficulty, game.layout, upright()))}
  {puzzle}
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
  {#snippet dev()}
    {#if DevMenu}<DevMenu {game} set={deal} />{/if}
  {/snippet}
  {#snippet picker()}
    <PickGroup title="Difficulty">
      {#each DIFFICULTIES as d (d)}
        <Choice label={LEVELS[d].label} detail={LEVELS[d].detail} pressed={level === d} onclick={() => (level = d)} />
      {/each}
    </PickGroup>
    <div class="mj-layouts-head">
      <h3 class="pick-title">Layouts</h3>
      <Button small onclick={() => pickOnTab(TABS[tab].ids)}>All</Button>
      {#if tab === 'own'}
        <!-- Just the ones that fit a phone upright, with no panning. -->
        <Button small onclick={() => pickOnTab(SLIM_IDS)}>Slim</Button>
      {/if}
      <Button small onclick={() => pickOnTab([])}>None</Button>
    </div>
    <div class="pick-tabs" role="tablist" aria-label="Layouts">
      {#each Object.entries(TABS) as [key, t] (key)}
        {@const picked = t.ids.filter((id) => chosen.includes(id)).length}
        <button type="button" role="tab" aria-selected={tab === key} onclick={() => (tab = key as Tab)}>
          {t.label}{#if picked}<span class="mj-tab-count">{picked}</span>{/if}
        </button>
      {/each}
    </div>
    <div class="mj-layouts" role="tabpanel">
      {#each TABS[tab].ids as id (id)}
        {@const l = layoutOf(id)}
        <!-- Any number can be on, so each shows a check box (like the rules in other games). -->
        <Toggle label={l.name} detail="{l.slots.length} tiles" on={chosen.includes(id)} onclick={() => toggle(id)} />
      {/each}
    </div>
  {/snippet}

  <div class={['board-area mj-area', { pannable: maxScroll > 0, panning }]} bind:this={area} bind:clientWidth={areaW} bind:clientHeight={areaH}>
    <div
      class="mj-board"
      style:width="{box.w * u}px"
      style:height="{box.h * u}px"
      style:--u="{u}px"
      style:translate="{maxScroll / 2 - sx}px 0"
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
            style:left="{((s.x * 1.5 + (box.maxZ - s.z) * LIFT) / box.w) * 100}%"
            style:top="{((s.y * 2 + (box.maxZ - s.z) * LIFT) / box.h) * 100}%"
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
  </div>
</GameScreen2>
