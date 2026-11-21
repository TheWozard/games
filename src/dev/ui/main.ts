// Development only: every standard UI piece (src/shared/ui/), in each state, to tap and check how
// it works and feels. Served by `just dev` at /dev/ui/; vite.config.ts keeps src/dev/ out of the build.
import '../../shared/base.css';
import { mount } from 'svelte';
import Gallery from './Gallery.svelte';

mount(Gallery, { target: document.getElementById('root')! });
