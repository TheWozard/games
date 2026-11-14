// The launcher's Settings dialog (the gear in its header): each choice is a `.btn` with
// `data-setting` and `data-value` (src/index.html), picked as it's tapped and saved at once.
import { loadSettings, saveSetting, type Setting, type Settings } from './shared/settings';

const dialog = document.querySelector<HTMLDialogElement>('#settings')!;
const choices = [...dialog.querySelectorAll<HTMLButtonElement>('[data-setting]')];

function show(settings: Settings) {
  for (const button of choices) {
    const key = button.dataset.setting as Setting;
    button.setAttribute('aria-pressed', String(settings[key] === button.dataset.value));
  }
}

document.querySelector('#open-settings')!.addEventListener('click', () => {
  show(loadSettings());
  dialog.showModal();
});

dialog.addEventListener('click', (e) => {
  // A tap on the dimmed area around the box closes it, as in the games' dialogs.
  if (e.target === dialog) return dialog.close();
  const button = (e.target as Element).closest<HTMLButtonElement>('[data-setting]');
  if (!button) return;
  const key = button.dataset.setting as Setting;
  show(saveSetting(key, button.dataset.value as Settings[typeof key]));
});
