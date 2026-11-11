// A small notification at the bottom of the screen: `toast('Copied')`. It fades in, stays for a
// couple of seconds (or until tapped) and fades out; a new message replaces the current one.
// Screen readers announce it politely. It lives in the browser's top layer (a manual popover)
// where supported, so it shows even above an open dialog.

const FADE_MS = 200;

let host: HTMLElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let closeTimer: ReturnType<typeof setTimeout> | undefined;

const supportsPopover = () => typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

function element(): HTMLElement {
  if (host?.isConnected) return host;
  host = document.createElement('div');
  host.className = 'toast';
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  if (supportsPopover()) host.setAttribute('popover', 'manual');
  host.addEventListener('click', hideToast);
  document.body.append(host);
  return host;
}

export interface ToastOptions {
  /** How long it stays up, in milliseconds. */
  duration?: number;
  /** 'error' shows it in red, for a loss or a failed action. */
  tone?: 'normal' | 'error';
}

export function toast(message: string, { duration = 2500, tone = 'normal' }: ToastOptions = {}): void {
  const el = element();
  clearTimeout(hideTimer);
  clearTimeout(closeTimer);
  el.textContent = message;
  el.classList.toggle('error', tone === 'error');
  if (supportsPopover() && !el.matches(':popover-open')) el.showPopover();
  // Next frame, so the fade-in transition runs from the hidden state.
  requestAnimationFrame(() => el.classList.add('show'));
  hideTimer = setTimeout(hideToast, duration);
}

export function hideToast(): void {
  if (!host) return;
  const el = host;
  clearTimeout(hideTimer);
  el.classList.remove('show');
  closeTimer = setTimeout(() => {
    if (supportsPopover() && el.matches(':popover-open')) el.hidePopover();
  }, FADE_MS);
}
