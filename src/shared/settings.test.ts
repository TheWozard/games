import { describe, expect, it } from 'vitest';
import { CHOICES, DEFAULTS, readSettings } from './settings';

describe('readSettings', () => {
  it('defaults to the first choice of each setting', () => {
    expect(DEFAULTS).toEqual({
      mahjongArt: 'classic',
      mahjongFaces: 'full',
      mahjongBlocked: 'dimmed',
      gridNumbersClears: 'none',
      gridLettersClears: 'none',
      gridSymbolsClears: 'none',
      gridNumbersHighlight: 'on',
      gridLettersHighlight: 'on',
      gridSymbolsHighlight: 'on',
      gridNumbersNotes: 'on',
      gridLettersNotes: 'on',
      gridSymbolsNotes: 'on',
      gridNumbersFaded: 'off',
      gridLettersFaded: 'off',
      gridSymbolsFaded: 'off',
    });
    for (const saved of [null, undefined, 3, 'x', [], {}])
      expect(readSettings(saved)).toEqual(DEFAULTS);
  });

  it('keeps each choice it knows, and drops anything else', () => {
    expect(readSettings({ mahjongFaces: 'inset' })).toEqual({ ...DEFAULTS, mahjongFaces: 'inset' });
    expect(
      readSettings({ mahjongArt: 'riichi', mahjongFaces: 'inset', mahjongBlocked: 'plain' }),
    ).toEqual({
      ...DEFAULTS,
      mahjongArt: 'riichi',
      mahjongFaces: 'inset',
      mahjongBlocked: 'plain',
    });
    expect(readSettings({ gridSymbolsClears: 'grid', gridLettersFaded: 'on' })).toEqual({
      ...DEFAULTS,
      gridSymbolsClears: 'grid',
      gridLettersFaded: 'on',
    });
    expect(
      readSettings({
        mahjongArt: 'neon',
        mahjongFaces: 'huge',
        mahjongBlocked: true,
        gridNumbersClears: 'row',
        gone: 1,
      }),
    ).toEqual(DEFAULTS);
  });

  it('round-trips through JSON', () => {
    for (const art of CHOICES.mahjongArt) {
      for (const faces of CHOICES.mahjongFaces) {
        for (const blocked of CHOICES.mahjongBlocked) {
          const settings = {
            ...DEFAULTS,
            mahjongArt: art,
            mahjongFaces: faces,
            mahjongBlocked: blocked,
          };
          expect(readSettings(JSON.parse(JSON.stringify(settings)))).toEqual(settings);
        }
      }
    }
  });
});
