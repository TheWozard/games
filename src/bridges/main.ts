import '../shared/app';
import './bridges.css';
import { mount } from 'svelte';
import Bridges from './Bridges.svelte';

mount(Bridges, { target: document.getElementById('root')! });
