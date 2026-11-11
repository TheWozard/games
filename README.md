# Games

Simple puzzle games as an installable, offline-capable PWA, served by GitHub Pages at
**https://thewozard.github.io/games/**. There's no backend: the games are [Svelte](https://svelte.dev) components with
TypeScript, built with [Vite](https://vite.dev) into small static files.

Games:
- [Sudoku](src/sudoku/): generated puzzles (easy, medium, hard) with a unique solution, pencil marks, undo, and progress saved on the device.
- [Killer Sudoku](src/killer/): Sudoku plus textured cages that add up to their sums; every puzzle has a unique solution and almost no givens.
- [Mines](src/mines/): find the mines from the neighbor counts. The first tap is always safe and every board can be cleared without guessing.
- [Loop](src/loop/): draw one closed loop along the dots to match the numbers; every puzzle has exactly one loop.
- [Bridges](src/bridges/): connect numbered islands with up to two bridges each way, no crossings, all one network; every puzzle has a unique solution.
- [Flow](src/flow/): join matching dots with paths that fill the board; each puzzle is built from a real covering of paths.
- [Untangle](src/untangle/): drag dots until no lines cross (a dot on a line counts); 10–36 dots in three styles, each built from an untangled layout so every puzzle is solvable.
- [Gradient](src/gradient/): swap color tiles back into a smooth four-corner blend (mixed in OKLab); dotted tiles are fixed.
- [Color Sort](src/sort/): pour colored layers between tubes until each holds one color; every deal is checked to be sortable.
- [Solitaire](src/solitaire/): Klondike-style patience, draw 1 or 3; tap a card to send it to its best move, and every deal is checked winnable.
- [Mahjong](src/mahjong/): tile-matching solitaire on ten original layouts; deals are built by playing backwards, so every one can be cleared.

## Installing on a phone

Open https://thewozard.github.io/games/ and:
- **Android (Chrome):** menu → *Add to Home screen* / *Install app*.
- **iOS (Safari):** Share → *Add to Home Screen*.

Once it has loaded once, everything works offline. Saved games live in the browser's storage for
this origin, so they stay on that device.

## Developing

See [AGENTS.md](AGENTS.md) for how the repo is organized, the UI and puzzle conventions, and how to add a game.

Needs Node 22+. Run `npm install` once, then:

```
just dev       # hot-reloading dev server, http://localhost:5173
just test      # unit tests (Vitest)
just build     # typecheck (svelte-check) + production build into dist/
just preview   # serve dist/ with its service worker, http://localhost:4173
```

The service worker only exists in the production build, so test offline behavior with `just preview`.

### Layout

- `src/index.html`: the launcher page.
- `src/<game>/`: one folder per game, each with its own `index.html` entry.
- `src/shared/`: what every page loads: [base.css](src/shared/base.css), the service worker
  registration ([app.ts](src/shared/app.ts)), a safe `localStorage` wrapper ([storage.ts](src/shared/storage.ts))
  and a modal [Dialog.svelte](src/shared/Dialog.svelte).
- Digit-grid games (Sudoku, Killer Sudoku) share their moves ([grid.ts](src/shared/grid.ts): select, place,
  pencil marks, undo, win) and their whole screen ([GridPlay.svelte](src/shared/GridPlay.svelte)).
  Each one only supplies a puzzle generator and a `layout` (size, which cells can't repeat a
  digit, thick lines, dashed outlines, corner labels).
- `public/`: copied into the build unchanged (icons, manifest, `.nojekyll`).

### Deploying

Pushing to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): it installs, tests,
typechecks and builds, then publishes `dist/` to the `gh-pages` branch, which Pages serves
(Settings → Pages → *Deploy from a branch* → `gh-pages` / root). Pull requests run the same checks
without deploying. Don't edit `gh-pages` by hand; each deploy replaces it.

The service worker is generated at build time by [vite-plugin-pwa](https://vite-pwa-org.netlify.app)
(Workbox) and precaches every built file, so there's no asset list to maintain. When a deploy lands,
an open app downloads it in the background and reloads onto it.

## Adding a game

1. Make `src/<name>/index.html` by copying [src/mines/index.html](src/mines/index.html) (manifest,
   icons, theme color, `<body class="game">` for the centered layout). It's picked up as a build
   entry automatically.
2. In `main.ts`, import `../shared/app` first (shared styles + offline support), then `mount()` your
   game's `.svelte` component (see [src/mines/main.ts](src/mines/main.ts)). Use `<script lang="ts">`.
   A digit-grid game can mount `GridPlay` directly instead (see [src/killer/main.ts](src/killer/main.ts)).
   Keep game rules in plain `.ts` modules with `*.test.ts` tests beside them; see
   [src/mines/logic.ts](src/mines/logic.ts) and [src/mines/game.ts](src/mines/game.ts).
3. Add a card for it to [src/index.html](src/index.html) and a line to the list above.

Use root-relative URLs for files in `public/` (`/icons/icon.svg`) and relative links between pages
(`../`); the build rewrites them so the site works under `/games/`. Store per-game state with
`loadJSON`/`saveJSON` from [storage.ts](src/shared/storage.ts) under a `games.<name>.` key.

## Icons

The PNGs in [public/icons/](public/icons/) are rendered from [public/icons/icon.svg](public/icons/icon.svg) with `just icons` (needs Inkscape).
Keep the artwork inside the central 80% so it survives Android's maskable crop.
