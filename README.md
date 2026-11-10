# Games

Simple puzzle games as an installable, offline-capable PWA, served by GitHub Pages at
**https://thewozard.github.io/games/**. There's no backend and no build step: the repo is the site.

Games:
- [Sudoku](sudoku/): generated puzzles (easy, medium, hard) with a unique solution, pencil marks, undo, and progress saved on the device.

## Installing on a phone

Open https://thewozard.github.io/games/ and:
- **Android (Chrome):** menu → *Add to Home screen* / *Install app*.
- **iOS (Safari):** Share → *Add to Home Screen*.

Once it has loaded once, everything works offline. Saved games live in the browser's storage for
this origin, so they stay on that device.

## Developing

```
just serve     # http://localhost:8000
```

Pushing to `main` deploys (Pages builds from the repo root; `.nojekyll` turns off Jekyll).

The service worker ([sw.js](sw.js)) serves from its cache and refreshes in the background, so a
deploy shows up on the launch after the one that downloaded it. To see changes immediately while
developing, tick *Update on reload* in DevTools → Application → Service workers.

## Adding a game

1. Make a folder (`<name>/index.html` plus its CSS and JS). Copy the `<head>` from
   [sudoku/index.html](sudoku/index.html) so it shares the manifest, icons, [css/base.css](css/base.css)
   and the service worker registration ([js/app.js](js/app.js)). Use relative URLs only: the site
   is served under `/games/`.
2. Add every new file to `ASSETS` in [sw.js](sw.js), or it won't be available offline until it's been opened online.
3. Add a card for it to [index.html](index.html) and a line to the list above.

Store per-game state in `localStorage` under a `games.<name>.` key, wrapped in try/catch.

## Icons

The PNGs in [icons/](icons/) are rendered from [icons/icon.svg](icons/icon.svg) with `just icons` (needs Inkscape).
Keep the artwork inside the central 80% so it survives Android's maskable crop.
