import '../shared/app';
import './untangle.css';
import { mount } from 'svelte';
import Untangle from './Untangle.svelte';

mount(Untangle, { target: document.getElementById('root')! });
