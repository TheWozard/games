// Starts a game page: mounts its component into #root. A save can pass its game's isGame() check
// and still not open (a field the check doesn't look at, a shape from an old version). So if the
// first render throws, the saves the page loaded are dropped and the page reloads, which starts
// a new game, and a toast says so. Only once: if it fails again with no saves, it's a bug, and
// the error is thrown as usual.
import { flushSync, mount, type Component } from 'svelte';
import { forgetLoaded } from './storage';
import { toast } from './toast';

/** In sessionStorage: the page that just reloaded after dropping its saves. */
const RESET_KEY = 'games.reset';

export function mountGame(component: Component): void {
  const target = document.getElementById('root')!;
  let afterReset = false;
  try {
    afterReset = sessionStorage.getItem(RESET_KEY) === location.pathname;
    sessionStorage.removeItem(RESET_KEY);
  } catch {
    // No sessionStorage: then no reset either (below), so nothing to read.
  }

  try {
    mount(component, { target });
    flushSync(); // run the first effects now, so their errors land here too
  } catch (err) {
    if (afterReset || forgetLoaded() === 0) throw err;
    console.error('The saved game could not be opened; starting a new one.', err);
    try {
      sessionStorage.setItem(RESET_KEY, location.pathname);
    } catch {
      throw err; // without the note, a reload that failed again would reload forever
    }
    location.reload();
    return;
  }

  if (afterReset) toast('The saved game couldn’t be opened, so here’s a new one.');
}
