// Development only: every Mahjong tile face, as it looks in play. Served by `just dev` at
// /dev/tiles/; vite.config.ts keeps src/dev/ out of the build.
import '../../shared/base.css';
import '../../mahjong/mahjong.css';
import { mount } from 'svelte';
import TileViewer from './TileViewer.svelte';

mount(TileViewer, { target: document.getElementById('root')! });
