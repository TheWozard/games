import '../shared/app';
import './gradient.css';
import { mount } from 'svelte';
import Gradient from './Gradient.svelte';

mount(Gradient, { target: document.getElementById('root')! });
