// Game pages are exactly one screen tall. CSS alone (100dvh, then position: fixed) came out too
// tall in the installed Android app after it was closed and reopened, hiding the controls under
// the bottom edge. So measure the visible height here and hand it to CSS as --app-height, and
// measure again whenever it may have changed: resizes, and the app coming back to the screen,
// when the browser's numbers can settle a moment late.
export function trackViewportHeight(): void {
  const root = document.documentElement;
  const measure = () => {
    const vv = window.visualViewport;
    // The visual viewport times its zoom is the layout height, so a pinch doesn't shrink the page.
    const height = vv ? vv.height * vv.scale : window.innerHeight;
    root.style.setProperty('--app-height', `${Math.floor(height)}px`);
  };
  const settle = () => {
    measure();
    requestAnimationFrame(measure);
    setTimeout(measure, 300);
  };
  measure();
  window.addEventListener('resize', measure);
  window.visualViewport?.addEventListener('resize', measure);
  window.addEventListener('orientationchange', settle);
  window.addEventListener('pageshow', settle);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') settle();
  });
}
