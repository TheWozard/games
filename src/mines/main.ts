import '../shared/app';
import './mines.css';
import { mount } from 'svelte';
import Mines from './Mines.svelte';

mount(Mines, { target: document.getElementById('root')! });
