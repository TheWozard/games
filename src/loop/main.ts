import '../shared/app';
import './loop.css';
import { mount } from 'svelte';
import Loop from './Loop.svelte';

mount(Loop, { target: document.getElementById('root')! });
