import '../shared/app';
import '../shared/brush.css';
import './nonogram.css';
import { mountGame } from '../shared/mount';
import Nonogram from './Nonogram.svelte';

mountGame(Nonogram);
