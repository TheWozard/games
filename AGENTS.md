# AGENTS.md

Guidance for working in this repo. A collection of puzzle games shipped as one installable,
offline-capable PWA, built with Svelte 5 + TypeScript + Vite and served by GitHub Pages at
https://thewozard.github.io/games/. There is no backend: everything is static and runs on the device.

## Commands

```
npm install        # once
just dev           # Vite dev server, http://localhost:5173 (no service worker in dev)
just test          # Vitest unit tests (npm test)
just build         # svelte-check (fails on warnings) + production build into dist/
just preview       # serve dist/ with its service worker, http://localhost:4173
just icons         # re-render the PNG app icons (needs Inkscape)
just blocks        # remake the Sliding Blocks puzzle list (a couple of minutes)
```

Before calling a change done: `npm test` and `npm run build` must both pass with no warnings.

## Layout

```
src/
  index.html            launcher: one card per game
  shared/               loaded by every page
    app.ts              shared CSS + service worker registration (import first in every main.ts)
    base.css            color tokens, header bar, buttons, dialogs, page layout, shared rows
    storage.ts          loadJSON / saveJSON: localStorage that never throws
    Dialog.svelte       native modal <dialog>; buttons inside close it with their value
    GameScreen.svelte   every game's frame: header bar, <main class="play">, Next, New dialog, Ctrl+Z
    grid.ts             moves for digit-grid games (select, place, notes, undo, win)
    GridPlay.svelte     the whole screen for a digit-grid game; a game supplies a `layout`
    grid.css            board / cell / number-pad styles for GridPlay
    cards.ts, cards.css, CardFace.svelte   playing cards for Solitaire (Klondike and FreeCell)
  <game>/               one folder per game, picked up automatically as a build entry
    index.html          page shell: head + <body class="game"><div id="root">
    main.ts             imports ../shared/app, the game's CSS, mounts the component
    logic.ts            pure rules: generator, solver, checks (no DOM, no Svelte)
    game.ts             state shape, isGame() validator, pure reducer
    <Game>.svelte       the screen
    <game>.css          game-specific styles
    *.test.ts           tests beside the code they test
public/                 copied to dist/ unchanged: icons/, manifest.webmanifest, .nojekyll
scripts/                one-off generators run on a laptop (blocks.ts: Sliding Blocks puzzles)
vite.config.ts          multi-page build (every src/*/index.html), PWA/Workbox config, Vitest config
.github/workflows/deploy.yml   test + build, then publish dist/ to the gh-pages branch
```

Games: `sudoku` (Classic, Killer and Jigsaw, one page: `src/sudoku/classic/`, `src/sudoku/killer/`
and `src/sudoku/jigsaw/`, all on `GridPlay`, switched by `App.svelte`; `src/killer/` only forwards old links), `mines`, `bridges`, `gradient`, `untangle`,
`mahjong`, `loop`, `sort` (Color Sort), `flow`, `solitaire` (Klondike and FreeCell, one page:
`src/solitaire/klondike/` and `src/solitaire/freecell/`, switched by `App.svelte`; `src/freecell/`
only forwards old links), `blocks` (Sliding Blocks).

## How a game is built

- **logic.ts is pure.** Generators take an optional `random` argument (default `Math.random`)
  so tests can drive them. Keep DOM and Svelte out of it.
- **game.ts holds all state changes** in a pure `reducer(game, action)`. It returns the *same
  object* when an action changes nothing (tests rely on this). Game state is plain JSON.
- **Components** keep the game in `$state.raw`, replace it via the reducer, and save with
  `$effect(() => saveJSON(STORAGE_KEY, game))`. They render inside `<GameScreen>`, passing the
  title, current setting, undo, New options (or a `picker` snippet for several settings) and
  Next; the board and controls are its children, header extras a `status` snippet.
- **Saved games:** key `games.<name>.v1`. `isGame()` must reject anything that doesn't fit the
  current shape, so a stale save falls back to a new game instead of crashing. If you change the
  saved shape of a game that's already deployed, either keep reading the old shape or bump the key.
- **Digit-grid games** (Sudoku-like) don't need their own component: use `GridPlay` with a
  `layout(game)` that gives size, peers (cells that can't share a digit), thick walls, zone colors
  (0–4, drawn inset from each zone's outline; touching zones must differ) and cage labels. See
  `src/sudoku/killer/` and `src/sudoku/App.svelte` (two games on one page, via `variants`).

### Puzzle quality rules

- **Every puzzle must be solvable, and where the genre expects it, uniquely.** Sudoku, Killer,
  Bridges, Flow: unique solution, checked by a solver. Mines: no guessing needed, checked by a
  deduction-only solver. Mahjong: dealt by playing backwards, so it can always be cleared.
  Untangle: built from a planar arrangement. Klondike, FreeCell: deals a solver can win. Tests must
  prove this, not assume it.
- **Difficulty is what a puzzle asks of the player.** Classic Sudoku's is the techniques it needs,
  not how many givens it has: `src/sudoku/classic/grade.ts` solves like a person, and the
  generator keeps only puzzles that need the difficulty's own tier.
- **Too slow to generate on a phone? Ship a list.** Sliding Blocks' puzzles are made ahead of time
  by `scripts/blocks.ts` (`just blocks`) into `src/blocks/puzzles.ts`, and played in order; its
  tests re-check every stored puzzle.
- **Generation must stay fast on a phone.** Solvers take a step `budget`. When a check runs out,
  change the puzzle (split a cage, add a given, redraw) rather than looping forever. Benchmark
  with a throwaway test and aim for tens of milliseconds on a laptop.
- **A setting that can't be fast is marked slow** (Flow: Hard with Wrapping and no Holes, up to
  several seconds). Its Play and Next turn orange (`GameScreen`'s `slow` / `nextSlow`, color
  `--warn`), and the game makes it in a Web Worker (`src/flow/worker.ts`, `background.ts`):
  `onstart` / `onnext` return a promise, and the button shows a spinner until it settles, with the
  New Game dialog held open meanwhile.

## UI conventions

- **American English** everywhere: on-screen text, instructions, docs, comments and names
  (color, center, gray, neighbor, behavior, -ize).

- **Always dark.** Colors are tokens in `src/shared/base.css` (`--bg`, `--surface`, `--text`,
  `--muted`, `--accent`, `--danger`...). Use them, not raw colors. The manifest's
  `background_color` / `theme_color` and each page's `<meta name="theme-color">` must equal `--bg`
  (#16181d) so Android's system bars blend in.
- **Page shell** (drawn by `GameScreen`): `<body class="game">`, a `<header class="bar">` (back to
  the launcher, `<h1>` with the setting in `<small>`, optional status, Undo if the game has undo,
  then the "+" that opens the New dialog, last on the right), then `<main class="play">`, which
  centers the board vertically.
- **Controls under the board, always in this order:**
  1. `.tools` row of the game's other actions: Clear/Erase, Notes, Shuffle. Undo and New
     are in the header; leave the row out if nothing's left.
  2. A row for *what a tap places*, if the game needs one (the number pad). Prefer gestures to mode
     buttons: Mines flags on long-press, Bridges builds by dragging and removes by swiping.
  3. A `.status` note only for a state the player must act on (Mahjong stuck → Shuffle). Wins and
     losses (Mines' mine) just bring up Next; dead ends aren't called (Color Sort: Undo out of it), and
     nothing nudges a player toward the finish (Flow says nothing when every pair is joined but
     squares are empty). No how-to text on the game screen: instructions live behind the card's
     **i** button in `src/index.html`.
- **Color as the piece** (Color Sort, Flow): use `PALETTE` from `src/shared/palette.ts`, twelve
  colors chosen to stay distinct on the dark background; take them from the start of the list.
- **Toggles** use `aria-pressed`. `base.css` styles `[aria-pressed="true"]` as selected.
- **Toasts:** `toast('message')` from `src/shared/toast.ts` shows a short note at the bottom of
  the screen (about 2.5s, tap to dismiss, announced to screen readers, above dialogs); pass
  `{ tone: 'error' }` for the red version (a loss, a refused move). Use it for brief, passing
  feedback, not for anything the player has to act on or read again.
- **Never scroll:** game pages are exactly one screen tall (`body.game`). Put the board inside
  `<div class="board-area">`, which fills the space left between header and controls, and size
  it with container units: `width: min(100cqw, 100cqh * cols / rows); aspect-ratio: cols / rows`. For grids, set both `grid-template-columns` and
  `grid-template-rows` to `repeat(n, 1fr)`; without rows, rows with less content collapse.
  One exception: on thin screens Klondike's and FreeCell's columns, and Mahjong's wide layouts,
  are wider than the screen so cards and tiles stay large, and pan sideways under a finger
  (`src/shared/pan.ts`; not page scrolling: the page itself never moves). These games use
  `GameScreen`'s `wide`, so a tablet or desktop shows everything and only pans if it must.
- **Touch:** set `user-select: none`, `-webkit-touch-callout: none` and
  `touch-action: manipulation` (or `none` while dragging) on boards. Long-press, drags and taps
  must not fire each other. No vibration: feedback is visual only.
- **New Game dialog** (`GameScreen`; one shape in every game):
  - Title "New Game", an × in the top corner to close it (Escape and the backdrop too), and one
    **Play** button at the bottom. Nothing else in the dialog starts a game: choices only select.
  - Every group of choices has a `.pick-title` heading ("Difficulty" for Easy / Medium / Hard,
    "Size" for real sizes, "Rules" for optional rules, "Layout"...), over a `.pick` row of
    `aria-pressed` tiles: a name in `<strong>` and an optional short detail in `<span>`, which
    should fit on one line ("9×9 · 5 colors", "10 mines").
  - One group: pass `options` (`{ value, label, detail? }`), `current` and `optionsTitle`. Several:
    a `picker` snippet of such groups (`RulesPicker` for a size plus optional rules: one line per
    rule, a check box toggle and an **i** that opens a short explanation, one line if it can be);
    Play then calls `onstart('start')`. Solitaire puts tabs (`.pick-tabs`) above its groups to pick
    the game.
  - The header's subtitle lists the picks in the same order, joined by " · ".
- **Capitalization:** Title Case for names the player sees as labels: game titles, dialog titles,
  headings, tabs, choice names and buttons ("New Game", "Fixed Tiles", "Twin Peaks", "Play").
  Lowercase for detail lines and units ("10 mines", "straight lines"); a subtitle keeps each part's
  own case ("10 dots · Lines · Circle"). Sentence case for full sentences (how-to text, toasts).
- **Calm by default:** no timers, and no messages when a game ends: the finished board stays on
  screen and a floating **Next** button (`GameScreen`'s `finished` / `onnext`) appears, starting
  another puzzle with the same settings; **+** (New) is for changing them. Zen games (Gradient, Untangle, Mahjong) also have no fail state.
- **No hints, in any game.** The player works every puzzle out alone; don't add a hint button or
  anything that reveals a move, even where a solver could supply one.
- **Undo everywhere except Mines.** Mines is about the risk of a wrong tap, so a mistake stands.
- **Relative URLs only.** The site lives under `/games/`. Link between pages with `../`. Reference
  files in `public/` root-relative (`/icons/icon.svg`); the build rewrites them.

### Gotchas

- **SVG `<use>`:** CSS from the page doesn't reliably reach the copies that `<use>` draws. Put
  `text-anchor`, `font-family` and similar on the symbol's elements as attributes (see
  `src/mahjong/TileFaces.svelte`).
- **Grid lines:** draw thin lines as `gap` over a line-colored background, and thick lines as
  overlays (`::after`, inset −1px) centered on the gap. Borders on one side make cells look uneven.
- **Service worker caching:** a browser that has visited the built site serves the *previous*
  build until the new worker activates. Use a fresh browser profile when screenshotting, and
  expect one reload on devices after a deploy.

## Adding a game

1. Create `src/<name>/` with `index.html` (copy one from another game; keep the manifest, icon
   and theme-color tags), `main.ts`, `logic.ts`, `game.ts`, the component and CSS.
2. Write tests: generator validity and solvability, reducer moves, undo, win, and an `isGame`
   JSON round trip.
3. Add a card to `src/index.html` (see Icons below) with its **i** button and `.how` popover of
   instructions, and a line to the game list in `README.md`.
4. `npm test && npm run build`, then check it at phone size (390×844 and 360 wide).

Nothing else to register: Vite finds the page, and Workbox precaches every built file.

## Icons

- **App icon:** `public/icons/icon.svg` is the source. `just icons` renders `icon-512.png`,
  `icon-192.png` and `apple-touch-icon.png` from it with Inkscape. Commit the PNGs. Keep the
  artwork inside the central 80% so it survives Android's maskable crop. The manifest lists the
  512 PNG as both `any` and `maskable`.
- **Game card icons** are hand-written inline SVGs in `src/index.html`, `viewBox="0 0 48 48"`, drawn
  with `currentColor` (the accent) and `var(--surface)` for knock-outs. Keep them simple: an outer
  rounded square or a few shapes, legible at 48px. Gradient's card is the one exception that uses
  its own colors.

## Testing

- Unit tests run in Node (Vitest). Put them beside the module as `*.test.ts`.
- Random tests should loop several runs. When a test needs a rare situation (a crossing, an
  ambiguous layout), retry until it occurs and use `expect.hasAssertions()`, so it can never
  pass without checking anything.
- **Component checks** aren't part of the suite. When a UI change needs one, do a throwaway run:
  `npm i --no-save jsdom`, a temporary config merging `vite.config.ts` with
  `resolve: { conditions: ['browser'] }`, mount the component, `flushSync()` after each event,
  then delete the files and `npm prune`. jsdom lacks `showModal`, `animate` and
  `getScreenCTM`, so stub them.
- jsdom can't test real dragging, layout or fonts. Check visually in a browser at phone size.

## Toolchain notes

- TypeScript is pinned to 6.x: `svelte-check` doesn't support TypeScript 7 yet.
- `vite.config.ts` uses `base: './'`. The service worker is registered from `src/shared/app.ts`
  with a URL worked out from the script's own location, because the plugin's helper resolves it
  relative to the page and breaks in sub-folders.
- `npm audit` reports moderate issues in Workbox's build-time dependencies. They don't ship to
  users.

## Deploying

Pushing to `main` runs the workflow: `npm ci`, tests, build, then publishes `dist/` to `gh-pages`
(force-orphaned, one commit). Pages serves that branch. Don't edit `gh-pages` by hand. Commit
messages follow Conventional Commits (`feat:`, `fix:`, `refactor:`...).
