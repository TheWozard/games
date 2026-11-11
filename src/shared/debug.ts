// A hidden readout of the screen measurements, for chasing layout bugs on a real phone. Tap the
// version on the launcher to turn it on or off; while on, every page shows the numbers live in a
// box at the top. The setting is kept, so it survives closing and reopening the app.
import { loadJSON, saveJSON } from './storage';
import { toast } from './toast';

const KEY = 'games.debug.v1';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

export function setUpDebugReadout(): void {
  const version = document.querySelector<HTMLElement>('.version');
  if (version) {
    version.setAttribute('role', 'button');
    version.addEventListener('click', () => {
      const on = !(loadJSON(KEY, isBool) ?? false);
      saveJSON(KEY, on);
      toast(on ? 'Screen readout on' : 'Screen readout off');
      if (on) show();
      else document.querySelector('.debug-readout')?.remove();
    });
  }
  if (loadJSON(KEY, isBool)) show();
}

function show(): void {
  if (document.querySelector('.debug-readout')) return;
  const box = document.createElement('pre');
  box.className = 'debug-readout';
  // A probe that turns each env() inset into a measurable padding.
  const probe = document.createElement('div');
  probe.className = 'debug-probe';
  document.body.append(box, probe);

  const px = (n: number) => Math.round(n * 10) / 10;
  const bottom = (sel: string) => {
    const el = document.querySelector(sel);
    return el ? px(el.getBoundingClientRect().bottom) : '-';
  };
  const update = () => {
    const vv = window.visualViewport;
    const pad = getComputedStyle(probe);
    const root = getComputedStyle(document.documentElement);
    const chrome = /Chrome\/([\d.]+)/.exec(navigator.userAgent)?.[1] ?? '?';
    const mode = ['fullscreen', 'standalone', 'minimal-ui', 'browser'].find((m) => matchMedia(`(display-mode: ${m})`).matches);
    box.textContent = [
      `build ${import.meta.env.VITE_VERSION ?? '?'}  chrome ${chrome}  ${mode}`,
      `inner ${innerWidth}x${innerHeight}  client ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
      `vv ${vv ? `${px(vv.width)}x${px(vv.height)} scale ${px(vv.scale)} top ${px(vv.offsetTop)}` : '-'}`,
      `screen ${screen.width}x${screen.height} avail ${screen.availHeight} dpr ${px(devicePixelRatio)}`,
      `100dvh ${px(parseFloat(pad.height))}  --app-height ${root.getPropertyValue('--app-height') || '-'}  --safe-bottom ${px(parseFloat(pad.paddingRight))}`,
      `inset bottom ${pad.paddingBottom} max ${pad.paddingLeft} top ${pad.paddingTop}`,
      `body ${px(document.body.getBoundingClientRect().height)}  play⤓ ${bottom('main.play')}  board⤓ ${bottom('.board-area')}`,
      `pad⤓ ${bottom('.pad')}  tools⤓ ${bottom('.tools')}`,
    ].join('\n');
  };
  update();
  setInterval(update, 500);
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
}
