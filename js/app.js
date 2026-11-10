// Registers the service worker that makes the whole collection work offline.
// Loaded by every page; sw.js sits at the repo root so its scope covers all games.
(() => {
  if (!('serviceWorker' in navigator)) return;
  const url = new URL('../sw.js', document.currentScript.src);
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(url).catch((err) => console.warn('Service worker registration failed:', err));
  });
})();
