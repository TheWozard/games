import '../shared/app';
import './sudoku.css';
import { mount } from 'svelte';
import Sudoku from './Sudoku.svelte';

mount(Sudoku, { target: document.getElementById('root')! });
