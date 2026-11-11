import '../shared/app';
import '../shared/cards.css';
import './solitaire.css';
import { mount } from 'svelte';
import Solitaire from './Solitaire.svelte';

mount(Solitaire, { target: document.getElementById('root')! });
