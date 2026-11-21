<!--
  Development only (/dev/ui/): the standard UI pieces of src/shared/ui/ and their neighbors, each in
  every state, to tap and check that they work and feel right on a phone. Every tap is written to
  the log at the bottom of the screen, so a tap that does nothing (or fires twice) shows.
-->
<script lang="ts">
  import Bug from '@lucide/svelte/icons/bug';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import Eraser from '@lucide/svelte/icons/eraser';
  import MenuIcon from '@lucide/svelte/icons/menu';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Plus from '@lucide/svelte/icons/plus';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import SettingsIcon from '@lucide/svelte/icons/settings';
  import Trophy from '@lucide/svelte/icons/trophy';
  import Undo2 from '@lucide/svelte/icons/undo-2';
  import Dialog from '../../shared/Dialog.svelte';
  import NewDialog from '../../shared/NewDialog.svelte';
  import NextButton from '../../shared/NextButton.svelte';
  import { toast } from '../../shared/toast';
  import Button from '../../shared/ui/Button.svelte';
  import Choice from '../../shared/ui/Choice.svelte';
  import IconButton from '../../shared/ui/IconButton.svelte';
  import MenuItem from '../../shared/ui/MenuItem.svelte';
  import MenuPuzzle from '../../shared/ui/MenuPuzzle.svelte';
  import MenuSection from '../../shared/ui/MenuSection.svelte';
  import PickGroup from '../../shared/ui/PickGroup.svelte';
  import Toggle from '../../shared/ui/Toggle.svelte';
  import type { Wait } from '../../shared/wait';

  // The log: newest first, a few lines, each with how long since the one before (a double fire
  // shows as +0ms).
  let log = $state<{ n: number; text: string; gap: string }[]>([]);
  let n = 0;
  let last = 0;
  function note(text: string) {
    const now = performance.now();
    const gap = last ? `+${Math.round(now - last)}ms` : '';
    last = now;
    log = [{ n: ++n, text, gap }, ...log].slice(0, 6);
  }

  // Icon buttons
  let canUndo = $state(true);
  let expanded = $state(false);

  // Choices: one of a set
  const LEVELS = [
    { value: 'easy', label: 'Easy', detail: 'forgiving' },
    { value: 'medium', label: 'Medium', detail: 'a few traps' },
    { value: 'hard', label: 'Hard', detail: 'plan ahead' },
  ];
  let level = $state('medium');
  const SIZES = ['Small', 'Medium', 'Large', 'Huge'];
  let size = $state('Small');

  // Toggles: each on or off by itself
  let rules = $state({ squares: false, rings: true });
  let layouts = $state({ pyramid: true, turtle: false });

  // The menu, as a real dialog (GameScreen2's), and inline to look at. What Game Details copies: one
  // of Mahjong's.
  let menuOpen = $state(false);
  const PUZZLE = '60bc4843 · kmahjongg/arena · medium · turned';

  // New Game dialog
  let newOpen = $state(false);
  let wait = $state<Wait>('quick');
  const later = (ms: number) => new Promise((done) => setTimeout(done, ms));

  // Next
  let showNext = $state(false);
  let nextWait = $state<Wait>('quick');
  let slowNext = $state(false);
  let nextBusy = $state(false);
</script>

<div class="gallery">
  <header class="bar">
    <IconButton href="../" icon={ChevronLeft} label="Dev pages" class="back" />
    <h1>UI Components <small>src/shared/ui/</small></h1>
  </header>

  <section>
    <h2>IconButton</h2>
    <p>Round, in the header. Disabled stays visible but takes no tap.</p>
    <div class="row">
      <IconButton icon={Undo2} strokeWidth={2.2} label="Undo" disabled={!canUndo} onclick={() => note('Undo')} />
      <IconButton icon={Plus} label="New Game" onclick={() => note('New Game')} />
      <IconButton
        icon={MenuIcon}
        label="Menu"
        aria-expanded={expanded}
        onclick={() => note(`Menu (aria-expanded ${(expanded = !expanded)})`)}
      />
      <IconButton icon={Bug} label="Link" href="#icon" onclick={() => note('Link (href #icon)')} />
    </div>
    <div class="row">
      <Toggle label="Undo enabled" on={canUndo} onclick={() => note(`Undo enabled: ${(canUndo = !canUndo)}`)} />
    </div>
  </section>

  <section>
    <h2>Button</h2>
    <p>Plain, <code>primary</code>, <code>small</code>; Next and Play's slow colors.</p>
    <div class="row wrap">
      <Button onclick={() => note('Plain')}>Plain</Button>
      <Button primary onclick={() => note('Primary')}>Primary</Button>
      <Button small onclick={() => note('Small')}>Small</Button>
      <Button disabled onclick={() => note('Disabled (should never log)')}>Disabled</Button>
      <Button primary class="slow" onclick={() => note('Slow')}>Slow</Button>
      <Button primary class="slower" onclick={() => note('Slower')}>Slower</Button>
    </div>
    <h3 class="sub">In a .tools row (equal widths, under a board)</h3>
    <div class="tools">
      <Button onclick={() => note('Erase')}><Eraser aria-hidden="true" class="inline-icon" /> Erase</Button>
      <Button aria-pressed={false} onclick={() => note('Notes')}><Pencil aria-hidden="true" class="inline-icon" /> Notes</Button>
      <Button onclick={() => note('Shuffle')}>Shuffle</Button>
    </div>
  </section>

  <section class="dialog-like">
    <h2>PickGroup + Choice</h2>
    <p>One of a set: a tap picks it. As in a New Game dialog.</p>
    <PickGroup title="Difficulty">
      {#each LEVELS as { value, label, detail } (value)}
        <Choice {label} {detail} pressed={level === value} onclick={() => note(`Difficulty: ${(level = value)}`)} />
      {/each}
    </PickGroup>
    <PickGroup title="Size (no details)">
      {#each SIZES as s (s)}
        <Choice label={s} pressed={size === s} onclick={() => note(`Size: ${(size = s)}`)} />
      {/each}
    </PickGroup>
  </section>

  <section class="dialog-like">
    <h2>Toggle</h2>
    <p>Each on or off by itself: a check box.</p>
    <h3 class="pick-title">Rules</h3>
    <div class="col">
      <Toggle label="Squares" on={rules.squares} onclick={() => note(`Squares: ${(rules.squares = !rules.squares)}`)} />
      <Toggle label="Rings" on={rules.rings} onclick={() => note(`Rings: ${(rules.rings = !rules.rings)}`)} />
    </div>
    <h3 class="pick-title">With a detail</h3>
    <div class="grid2">
      <Toggle label="Pyramid" detail="82 tiles" on={layouts.pyramid} onclick={() => note(`Pyramid: ${(layouts.pyramid = !layouts.pyramid)}`)} />
      <Toggle label="Turtle" detail="144 tiles" on={layouts.turtle} onclick={() => note(`Turtle: ${(layouts.turtle = !layouts.turtle)}`)} />
    </div>
  </section>

  <section>
    <h2>MenuSection + MenuItem + MenuPuzzle</h2>
    <p>
      GameScreen2's menu. The real one closes as an item is tapped, with its <code>value</code>. The
      last entry, Game Details, copies what the puzzle is and leaves the menu open.
    </p>
    <div class="row">
      <Button primary onclick={() => (menuOpen = true)}>Open Menu</Button>
    </div>
    <div class="menu-preview">
      {@render menuItems()}
    </div>
  </section>

  <section>
    <h2>Dialogs, toasts, Next</h2>
    <p>New Game: Play waits as long as the pick says, with a spinner (the dialog can't close meanwhile).</p>
    <div class="row wrap">
      <Button onclick={() => (newOpen = true)}>New Game</Button>
      <Button onclick={() => toast('A short note')}>Toast</Button>
      <Button onclick={() => toast('A refused move', { tone: 'error' })}>Error Toast</Button>
    </div>
    <h3 class="pick-title">Next</h3>
    <div class="col">
      <Toggle label="Show Next" on={showNext} onclick={() => (showNext = !showNext)} />
      <Toggle label="Takes a second" detail="spinner, then logs" on={slowNext} onclick={() => (slowNext = !slowNext)} />
    </div>
    <div class="pick">
      {#each ['quick', 'slow', 'slower'] as const as w (w)}
        <Choice label={w[0].toUpperCase() + w.slice(1)} pressed={nextWait === w} onclick={() => (nextWait = w)} />
      {/each}
    </div>
  </section>
</div>

<ol class="log" aria-live="polite">
  {#each log as { n, text, gap } (n)}
    <li><span>{n}</span> {text} <small>{gap}</small></li>
  {:else}
    <li class="empty">Tap something: it shows here.</li>
  {/each}
</ol>

{#snippet menuItems()}
  <MenuSection>
    <MenuItem icon={Plus} label="New Game" value="new" onclick={() => note('Menu: New Game')} />
    <MenuItem icon={SettingsIcon} label="Settings" value="settings" onclick={() => note('Menu: Settings')} />
  </MenuSection>
  <MenuSection>
    <MenuItem icon={RotateCcw} label="Restart" onclick={() => note('Menu: Restart')} />
    <MenuItem icon={Bug} label="Disabled" disabled onclick={() => note('Disabled (should never log)')} />
  </MenuSection>
  <MenuSection tone="dev">
    <MenuItem icon={Trophy} label="Win" onclick={() => note('Menu: Win')} />
  </MenuSection>
  <MenuPuzzle puzzle={PUZZLE} oncopy={() => note(`Copied: ${PUZZLE}`)} />
{/snippet}

<Dialog class="game-menu" label="Menu" open={menuOpen} onclose={(value) => { menuOpen = false; note(`Menu closed (value "${value}")`); }}>
  {@render menuItems()}
</Dialog>

<NewDialog
  open={newOpen}
  onclose={() => (newOpen = false)}
  options={[
    { value: 'quick', label: 'Quick', detail: 'at once' },
    { value: 'slow', label: 'Slow', detail: '1 second' },
    { value: 'slower', label: 'Slower', detail: '3 seconds' },
  ]}
  current="quick"
  optionsTitle="Wait"
  {wait}
  onstart={(value) => {
    wait = value as Wait;
    note(`Play: ${value}`);
    return value === 'quick' ? undefined : later(value === 'slow' ? 1000 : 3000).then(() => note(`Play: ${value} ready`));
  }}
/>

<NextButton
  show={showNext}
  wait={nextWait}
  busy={nextBusy}
  onclick={() => {
    if (nextBusy) return note('Next (busy: ignored)');
    note('Next');
    if (slowNext) {
      nextBusy = true;
      later(1000).then(() => { nextBusy = false; note('Next: ready'); });
    }
  }}
/>

<style>
  .gallery { max-width: 520px; margin: 0 auto; padding-bottom: 200px; /* clear of the log */ }
  section { margin: 0 16px 28px; }
  h2 { margin: 0 0 4px; font-size: 1.05rem; }
  section > p { margin: 0 0 12px; color: var(--muted); font-size: 0.85rem; }
  .sub { margin: 14px 0 6px; color: var(--muted); font-size: 0.8rem; font-weight: 600; }
  .row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
  .row.wrap { flex-wrap: wrap; gap: 8px; }
  .col { display: flex; flex-direction: column; gap: 8px; margin: 6px 0 10px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; }
  .tools :global(.inline-icon) { width: 16px; height: 16px; vertical-align: -3px; }
  /* Laid out as in a dialog (base.css styles some of these only inside one). */
  .dialog-like { display: flex; flex-direction: column; gap: 8px; padding: 16px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); }
  /* Tiles and toggles as they look in a dialog, where they're used. */
  .gallery :global(.btn[aria-pressed='true']) { background: var(--accent-soft); border-color: var(--accent); color: var(--text); }
  .menu-preview { width: min(280px, 100%); margin-top: 10px; padding: 6px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
  .log {
    position: fixed;
    inset: auto 0 0;
    z-index: 40;
    margin: 0;
    padding: 8px 16px calc(8px + env(safe-area-inset-bottom, 0px));
    list-style: none;
    border-top: 1px solid var(--line);
    background: rgb(22 24 29 / 0.94);
    font: 0.8rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .log li:first-child { color: var(--text); }
  .log li { color: var(--muted); }
  .log span { display: inline-block; min-width: 2.5em; color: var(--muted); }
  .log small { color: var(--warn); }
  .log .empty { font-family: system-ui, sans-serif; }
</style>
