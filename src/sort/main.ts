import '../shared/app';
import './sort.css';
import { mount } from 'svelte';
import Sort from './Sort.svelte';

mount(Sort, { target: document.getElementById('root')! });
