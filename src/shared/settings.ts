// How the player has customized the games' look, set in the Display dialog that each game's menu
// opens (GameScreen2's `settings`). One save for every game, so a missing or stale one only
// falls back to the defaults, field by field.
import { loadJSON, saveJSON } from './storage';

export const SETTINGS_KEY = 'games.settings.v1';

/** Every setting and the choices it takes; the first choice is the default. */
export const CHOICES = {
  /** Mahjong: the tile art, Classic (drawn here) or Riichi (FluffyStuff's and xhokir's sets). */
  mahjongArt: ['classic', 'riichi'],
  /** Mahjong: a face fills its tile, or sits back from the edges, leaving space between tiles. */
  mahjongFaces: ['full', 'inset'],
  /** Mahjong: tiles that can't be taken yet are dimmed, so the free ones stand out, or look like the rest. */
  mahjongBlocked: ['dimmed', 'plain'],
} as const satisfies Record<string, readonly string[]>;

export type Settings = { -readonly [K in keyof typeof CHOICES]: (typeof CHOICES)[K][number] };
export type Setting = keyof Settings;

export const DEFAULTS = Object.fromEntries(
  Object.entries(CHOICES).map(([key, choices]) => [key, choices[0]]),
) as Settings;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The saved settings, each one a default unless it holds one of its choices. */
export function readSettings(saved: unknown): Settings {
  const settings = { ...DEFAULTS };
  if (!isRecord(saved)) return settings;
  for (const key of Object.keys(CHOICES) as Setting[]) {
    const value = saved[key];
    if ((CHOICES[key] as readonly unknown[]).includes(value))
      (settings as Record<Setting, unknown>)[key] = value;
  }
  return settings;
}

export const loadSettings = (): Settings => readSettings(loadJSON(SETTINGS_KEY, isRecord));

export function saveSetting<K extends Setting>(key: K, value: Settings[K]): Settings {
  const settings = { ...loadSettings(), [key]: value };
  saveJSON(SETTINGS_KEY, settings);
  return settings;
}
