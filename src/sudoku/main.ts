import '../shared/app';
import { mount } from 'svelte';
import GridPlay from '../shared/GridPlay.svelte';
import { isGame, LAYOUT, newGame, STORAGE_KEY, type Game } from './game';
import { DIFFICULTIES, isDifficulty } from './logic';

mount(GridPlay<Game>, {
  target: document.getElementById('root')!,
  props: {
    title: 'Sudoku',
    storageKey: STORAGE_KEY,
    difficulties: DIFFICULTIES,
    isValid: isGame,
    create: (difficulty) => newGame(isDifficulty(difficulty) ? difficulty : 'easy'),
    layout: () => LAYOUT,
  },
});
