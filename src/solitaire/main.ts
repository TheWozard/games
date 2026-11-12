import '../shared/app';
import '../shared/cards.css';
import './klondike/solitaire.css';
import './freecell/freecell.css';
import { mountGame } from '../shared/mount';
import App from './App.svelte';

mountGame(App);
