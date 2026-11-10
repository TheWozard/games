# Games

Simple puzzle games as an installable, offline-capable PWA, served by GitHub Pages at
**https://thewozard.github.io/games/**. There's no backend: the games are [Svelte](https://svelte.dev) components with
TypeScript, built with [Vite](https://vite.dev) into small static files.

Games:
- [Sudoku](src/sudoku/): generated puzzles (easy, medium, hard) with a unique solution, pencil marks, undo, and progress saved on the device.

## Installing on a phone

Open https://thewozard.github.io/games/ and:
- **Android (Chrome):** menu → *Add to Home screen* / *Install app*.
- **iOS (Safari):** Share → *Add to Home Screen*.

Once it has loaded once, everything works offline. Saved games live in the browser's storage for
this origin, so they stay on that device.

## Developing

Needs Node 22+. Run `npm install` once, then:

```
just dev       # hot-reloading dev server, http://localhost:5173
just test      # unit tests (Vitest)
just build     # typecheck (svelte-check) + production build into dist/
just preview   # serve dist/ with its service worker, http://localhost:4173
```

The service worker only exists in the production build, so test offline behaviour with `just preview`.

### Layout

- `src/index.html`: the launcher page.
- `src/<game>/`: one folder per game, each with its own `index.html` entry.
- `src/shared/`: what every page loads: [base.css](src/shared/base.css), the service worker
  registration ([app.ts](src/shared/app.ts)), a safe `localStorage` wrapper ([storage.ts](src/shared/storage.ts))
  and a modal [Dialog.svelte](src/shared/Dialog.svelte).
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

1. Make `src/<name>/index.html` (copy the `<head>` from [src/sudoku/index.html](src/sudoku/index.html)
   for the manifest, icons and theme colours) with a `<script type="module" src="./main.ts">`.
   It's picked up as a build entry automatically.
2. In `main.ts`, import `../shared/app` first (shared styles + offline support), then `mount()` your
   game's `.svelte` component (see [src/sudoku/main.ts](src/sudoku/main.ts)). Use `<script lang="ts">`.
   Keep game rules in plain `.ts` modules with `*.test.ts` tests beside them; see
   [src/sudoku/logic.ts](src/sudoku/logic.ts) and [src/sudoku/game.ts](src/sudoku/game.ts).
3. Add a card for it to [src/index.html](src/index.html) and a line to the list above.

Use root-relative URLs for files in `public/` (`/icons/icon.svg`) and relative links between pages
(`../`); the build rewrites them so the site works under `/games/`. Store per-game state with
`loadJSON`/`saveJSON` from [storage.ts](src/shared/storage.ts) under a `games.<name>.` key.

## Icons

The PNGs in [public/icons/](public/icons/) are rendered from [public/icons/icon.svg](public/icons/icon.svg) with `just icons` (needs Inkscape).
Keep the artwork inside the central 80% so it survives Android's maskable crop.
