// The picked choice's highlight in a .pick row, as one piece that slides from choice to choice
// instead of each button lighting up by itself. Put it on the row: <div class="pick" {@attach slidePick}>
// (PickGroup does). It adds a .pick-slider behind the buttons and moves it over whichever has
// aria-pressed="true": when a pick changes, when the choices change, and when the row is resized
// (a dialog opening, a turned screen). It doesn't slide in from nowhere: from no pick, or a row
// that wasn't shown, it just appears where it belongs.
import type { Attachment } from 'svelte/attachments';

export const slidePick: Attachment<HTMLElement> = (row) => {
  const slider = document.createElement('span');
  slider.className = 'pick-slider';
  slider.setAttribute('aria-hidden', 'true');
  row.prepend(slider);
  row.classList.add('sliding');

  let shown = false; // whether it was on a choice last time, so a move can slide
  function place() {
    // Svelte may empty the row in one go (an {#each} that's its only child), taking this with it.
    if (slider.parentNode !== row) row.prepend(slider);
    const picked = row.querySelector<HTMLElement>(':scope > [aria-pressed="true"]');
    if (!picked || row.offsetWidth === 0) {
      slider.hidden = true;
      shown = false;
      return;
    }
    slider.classList.toggle('jump', !shown);
    slider.hidden = false;
    // Exact to the fraction of a pixel (offsetLeft and the like round), from the row's padding edge.
    const box = row.getBoundingClientRect();
    const at = picked.getBoundingClientRect();
    slider.style.translate = `${at.left - box.left - row.clientLeft}px ${at.top - box.top - row.clientTop}px`;
    slider.style.width = `${at.width}px`;
    slider.style.height = `${at.height}px`;
    shown = true;
  }

  const changes = new MutationObserver(place);
  changes.observe(row, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['aria-pressed'],
  });
  const sizes = new ResizeObserver(place);
  sizes.observe(row);
  place();

  return () => {
    changes.disconnect();
    sizes.disconnect();
    slider.remove();
    row.classList.remove('sliding');
  };
};
