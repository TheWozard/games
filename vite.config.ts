import { execSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

const root = resolve(import.meta.dirname, 'src');

// Every src/<name>/index.html is a page: the launcher plus one per game. No list to keep in sync.
const pages = Object.fromEntries([
  ['index', resolve(root, 'index.html')],
  ...readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(resolve(root, d.name, 'index.html')))
    .map((d) => [d.name, resolve(root, d.name, 'index.html')]),
]);

// The commit this build came from, shown on the launcher as %VITE_VERSION% so a phone can tell
// which deploy it's running.
function version() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}
process.env.VITE_VERSION ??= version();

export default defineConfig({
  root,
  publicDir: resolve(import.meta.dirname, 'public'),
  // Relative URLs, so the build works under https://thewozard.github.io/games/ or anywhere else.
  base: './',
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: { input: pages },
  },
  plugins: [
    svelte({ configFile: false }), // Svelte 5 handles <script lang="ts"> itself; no preprocessing needed
    VitePWA({
      // Registration lives in src/shared/app.ts (workbox-window); the manifest is public/manifest.webmanifest.
      injectRegister: false,
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        // Precache the whole build so every game works offline after the first visit.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Each game is its own page, so don't rewrite unknown navigations to the launcher.
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  test: {
    root: import.meta.dirname,
    include: ['src/**/*.test.ts'],
  },
});
