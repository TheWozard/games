import { describe, expect, it } from 'vitest';
import { CHOICES, DEFAULTS, readSettings } from './settings';

describe('readSettings', () => {
  it('defaults to the first choice of each setting', () => {
    expect(DEFAULTS).toEqual({ mahjongFaces: 'full' });
    for (const saved of [null, undefined, 3, 'x', [], {}]) expect(readSettings(saved)).toEqual(DEFAULTS);
  });

  it('keeps each choice it knows, and drops anything else', () => {
    expect(readSettings({ mahjongFaces: 'inset' })).toEqual({ mahjongFaces: 'inset' });
    expect(readSettings({ mahjongFaces: 'huge', gone: 1 })).toEqual(DEFAULTS);
  });

  it('round-trips through JSON', () => {
    for (const choice of CHOICES.mahjongFaces) {
      const settings = { ...DEFAULTS, mahjongFaces: choice };
      expect(readSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
    }
  });
});
