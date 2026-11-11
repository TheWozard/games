import '../shared/app';
import '../shared/cards.css';
import './klondike/solitaire.css';
import './freecell/freecell.css';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('root')! });
