import '../shared/app';
import '../shared/cards.css';
import './freecell.css';
import { mount } from 'svelte';
import FreeCell from './FreeCell.svelte';

mount(FreeCell, { target: document.getElementById('root')! });
