import '../shared/app';
import './mahjong.css';
import { mount } from 'svelte';
import Mahjong from './Mahjong.svelte';

mount(Mahjong, { target: document.getElementById('root')! });
