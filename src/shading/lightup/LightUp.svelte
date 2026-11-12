<script lang="ts">
  import { MAIN, NOTE } from '../board';
  import Icons from '../Icons.svelte';
  import ShadePlay from '../ShadePlay.svelte';
  import { storageKey, type Switcher } from '../variants';
  import { conflicts, DIFFICULTIES, generate, isDifficulty, isPuzzle, lit, WALL } from './logic';

  let { variants, first }: { variants: Switcher; first?: string } = $props();
</script>

<ShadePlay
  title="Shading"
  storageKey={storageKey('lightup')}
  difficulties={DIFFICULTIES}
  create={(d) => generate(isDifficulty(d) ? d : 'easy')}
  isPuzzle={(v, d) => isDifficulty(d) && isPuzzle(v, d)}
  fixed={(p, i) => p.walls[i] !== null}
  conflicts={(p, marks) => conflicts(p, marks.map((m) => m === MAIN))}
  names={['Lamp', 'X']}
  drags={['none', 'free']}
  {variants}
  {first}
>
  {#snippet icon(kind)}
    {#if kind === MAIN}
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle class="lamp-icon" cx="8" cy="8" r="5.5" /></svg>
    {:else}
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
    {/if}
  {/snippet}

  {#snippet cells({ puzzle, marks, bad })}
    {@const n = puzzle.size}
    {@const on = lit(puzzle, marks.map((m) => m === MAIN))}
    {#each marks as m, i (i)}
      {@const x = i % n}
      {@const y = Math.floor(i / n)}
      {@const w = puzzle.walls[i]}
      {#if w !== null}
        <rect class={['block', { bad: bad[i] }]} x={x - 0.01} y={y - 0.01} width="1.02" height="1.02" />
        {#if w !== WALL}<text class={['block-n', { bad: bad[i] }]} x={x + 0.5} y={y + 0.5} dy="0.355em">{w}</text>{/if}
      {:else}
        {#if on[i]}<rect class="glow" x={x + 0.015} y={y + 0.015} width="0.97" height="0.97" />{/if}
        {#if m === MAIN}
          <circle class={['lamp', { bad: bad[i] }]} cx={x + 0.5} cy={y + 0.5} r="0.3" />
        {:else if m === NOTE}
          <Icons kind="x" {x} {y} />
        {/if}
      {/if}
    {/each}
  {/snippet}
</ShadePlay>
