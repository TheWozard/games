# Dev server with hot reload at http://localhost:5173 (no service worker in dev)
dev:
    npm run dev

# Typecheck and build the site into dist/
build:
    npm run build

# Serve the production build (with its service worker) at http://localhost:4173
preview: build
    npm run preview

test:
    npm test

# Render the PNG icons from public/icons/icon.svg
icons:
    inkscape public/icons/icon.svg --export-type=png -w 512 -h 512 -o public/icons/icon-512.png
    inkscape public/icons/icon.svg --export-type=png -w 192 -h 192 -o public/icons/icon-192.png
    inkscape public/icons/icon.svg --export-type=png -w 180 -h 180 -o public/icons/apple-touch-icon.png

# Make the Sliding Blocks puzzles (src/blocks/puzzles.ts); takes a minute or two
blocks:
    node --experimental-strip-types scripts/blocks.ts
