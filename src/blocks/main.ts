import '../shared/app';
import './blocks.css';
import { mount } from 'svelte';
import Blocks from './Blocks.svelte';

mount(Blocks, { target: document.getElementById('root')! });
