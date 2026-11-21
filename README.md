# Games

Simple puzzle games as an installable, offline-capable PWA, served by GitHub Pages at
**https://thewozard.github.io/games/**. There's no backend: the games are [Svelte](https://svelte.dev) components with
TypeScript, built with [Vite](https://vite.dev) into small static files.

Games:
- [Sudoku](src/sudoku/): Classic, Killer (colored cages that add up to their sums, almost no givens) or Jigsaw (irregular regions in place of the boxes), picked when you start a game; generated puzzles with a unique solution, rated by the techniques a Classic puzzle needs (Easy: singles; Medium: pointing and pairs; Hard: triples, X-Wing, XY-Wing, Swordfish), pencil marks, undo, and progress saved on the device.
- [Mines](src/mines/): find the mines from the neighbor counts. The first tap is always safe and every board can be cleared without guessing.
- [Loop](src/loop/): draw one closed loop along the dots to match the numbers, with optional squares to keep on opposite sides and ringed dots to pass through; every puzzle has exactly one loop (Hard, the slowest to make, is made in the background).
- [Bridges](src/bridges/): connect numbered islands with up to two bridges each way, no crossings, all one network, with optional colored islands, blocks and diagonal bridges; every puzzle has a unique solution.
- [Nonogram](src/nonogram/): shade cells to match the runs given for each row and column, with optional colors and mystery numbers; solvable a line at a time, no guessing.
- [Shading](src/shading/): four puzzles about which cells to fill, picked when you start a game: Star Battle (stars in every row, column and region, never touching), Nurikabe (a connected sea around numbered islands), Hitori (shade away repeated numbers) and Light Up (lamps that light every cell); every puzzle has one solution, checked by a solver.
- [Flow](src/flow/): join matching dots with paths that fill the board, with optional walls, holes, wrapping edges and bridges; every puzzle has exactly one solution, checked by a solver (the slowest setting, Hard with only wrapping, is made in the background).
- [Untangle](src/untangle/): drag dots until no lines cross (a dot on a line counts); 10–36 dots in three styles, each built from an untangled layout so every puzzle is solvable.
- [Gradient](src/gradient/): swap color tiles back into a smooth four-corner blend (mixed in OKLab); dotted tiles are fixed.
- [Color Sort](src/sort/): pour colored layers between tubes until each holds one color, with optional mystery layers and tall tubes; every deal is checked to be sortable.
- [Solitaire](src/solitaire/): Klondike (draw 1 or 3) or FreeCell (two to four free cells), picked when you start a game; tap a card to send it to its best move, and every deal is checked winnable.
- [Sliding Blocks](src/blocks/): slide blocks to free the red one; Classic, Pillars (fixed squares), Big (8×8) and Two Keys (a second block leaves through the bottom); 100 pre-made levels for each (10 Easy, then 30 Medium, then 60 Hard), chosen for how interesting their shortest solutions are, played in order or picked by number, with the fewest moves shown.
- [Mahjong](src/mahjong/): tile-matching solitaire at three difficulties (Zen, Balance, Focus) on twenty original layouts and 66 classics from KMahjongg and GNOME Mahjongg, one or a pool of several; deals are built by playing backwards, so every one can be cleared, made in a Web Worker, and graded by how often careless play still clears them.

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
  registration ([app.ts](src/shared/app.ts)), a safe `localStorage` wrapper ([storage.ts](src/shared/storage.ts)),
  [mount.ts](src/shared/mount.ts), which starts each game page (and a new game if its save can't be opened),
  a modal [Dialog.svelte](src/shared/Dialog.svelte), and [GameScreen.svelte](src/shared/GameScreen.svelte),
  the frame every game screen shares (header, Next button, New dialog, Ctrl/Cmd+Z undo).
- Digit-grid games (Classic, Killer and Jigsaw Sudoku) share their moves ([grid.ts](src/shared/grid.ts): select, place,
  pencil marks, undo, win) and their whole screen ([GridPlay.svelte](src/shared/GridPlay.svelte)).
  Each one only supplies a puzzle generator and a `layout` (size, which cells can't repeat a
  digit, thick lines, zone colors, corner labels).
- `public/`: copied into the build unchanged (icons, manifest, `.nojekyll`).

### Deploying

Pushing to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml): it installs, tests,
typechecks and builds, then publishes `dist/` to the `gh-pages` branch, which Pages serves
(Settings → Pages → *Deploy from a branch* → `gh-pages` / root). Pull requests run the same checks
without deploying, and with read-only access: only the publish job can write to the repository. Don't edit `gh-pages` by hand; each deploy replaces it.

The service worker is generated at build time by [vite-plugin-pwa](https://vite-pwa-org.netlify.app)
(Workbox) and precaches every built file, so there's no asset list to maintain. When a deploy lands,
an open app downloads it in the background and reloads onto it.

## Adding a game

1. Make `src/<name>/index.html` by copying [src/mines/index.html](src/mines/index.html) (manifest,
   icons, theme color, `<body class="game">` for the centered layout). It's picked up as a build
   entry automatically.
2. In `main.ts`, import `../shared/app` first (shared styles + offline support), then `mount()` your
   game's `.svelte` component (see [src/mines/main.ts](src/mines/main.ts)). Use `<script lang="ts">`.
   A digit-grid game can use `GridPlay` instead of its own component (see [src/sudoku/App.svelte](src/sudoku/App.svelte)).
   Keep game rules in plain `.ts` modules with `*.test.ts` tests beside them; see
   [src/mines/logic.ts](src/mines/logic.ts) and [src/mines/game.ts](src/mines/game.ts).
3. Add a card for it to [src/index.html](src/index.html) and a line to the list above.

Use root-relative URLs for files in `public/` (`/icons/icon.svg`) and relative links between pages
(`../`); the build rewrites them so the site works under `/games/`. Store per-game state with
`loadJSON`/`saveJSON` from [storage.ts](src/shared/storage.ts) under a `games.<name>.` key.

## Mahjong tiles

Mahjong has two sets of tile art, picked in the game menu's Display: Classic, the default, drawn in
[src/mahjong/ClassicFaces.svelte](src/mahjong/ClassicFaces.svelte), and Riichi.
The Riichi faces ([src/mahjong/faces.svg](src/mahjong/faces.svg)) are made by `just mahjong-tiles`
([scripts/mahjong-tiles.ts](scripts/mahjong-tiles.ts)), which fetches and cleans up two sets of vector tiles:
[FluffyStuff/riichi-mahjong-tiles](https://github.com/FluffyStuff/riichi-mahjong-tiles) by FluffyStuff (public domain, CC0)
for the suits, winds and dragons, and the flowers and seasons by xhokir from
[xhokir/riichi-mahjong-tiles](https://github.com/xhokir/riichi-mahjong-tiles), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The white dragon's frame is our own.

## Mahjong layouts

Besides its own layouts, Mahjong has layouts from the
[Mahjong Solitaire Layout Museum](https://ffalt.github.io/mahseum/), in
[src/mahjong/archive.ts](src/mahjong/archive.ts), made by `just mahjong-layouts`
([scripts/mahjong-layouts.ts](scripts/mahjong-layouts.ts)). Only its GPL sources are taken:
[KMahjongg](https://github.com/KDE/kmahjongg/tree/master/layouts/) (KDE, GPL-2.0-or-later; most
layouts by Alexey Charkov) and [GNOME Mahjongg](https://github.com/GNOME/gnome-mahjongg/tree/main/data/maps/)
(GPL-3.0-or-later). Layouts with more than 144 tiles (one set of faces) or too big for the board
are left out. Bridges, tiles over a gap, are allowed. They're picked in the Customize dialog,
listed after the game's own and narrowed by filter chips. A layout is offered only at the
difficulties its deals can reach (Clubs's are too easy for Balance and Focus; `OUT_OF_REACH` in
[src/mahjong/layouts.ts](src/mahjong/layouts.ts)). The game menu's Credits names the sources, and
the author of the layout being played. A layout too big for the screen keeps its tile size: drag to pan it, pinch (or Ctrl/⌘ +
wheel) to zoom.

## Icons

The PNGs in [public/icons/](public/icons/) are rendered from [public/icons/icon.svg](public/icons/icon.svg) with `just icons` (needs Inkscape).
Keep the artwork inside the central 80% so it survives Android's maskable crop.

## License

Copyright (C) 2026 Dan Bond and contributors.

This program is free software: you can redistribute it and/or modify it under the terms of the
GNU General Public License as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version. It is distributed in the hope that it will be
useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See [LICENSE](LICENSE) for the full text.

Third-party parts keep their own licenses, credited where they're used: the in-game icons are
[Lucide](https://lucide.dev) (ISC).
