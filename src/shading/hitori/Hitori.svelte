<script lang="ts">
  import { MAIN, NOTE } from '../board';
  import ShadePlay from '../ShadePlay.svelte';
  import { storageKey, type Switcher } from '../variants';
  import { conflicts, DIFFICULTIES, generate, isDifficulty, isPuzzle } from './logic';

  let { variants, first }: { variants: Switcher; first?: string } = $props();
</script>

<ShadePlay
  title="Shading"
  storageKey={storageKey('hitori')}
  difficulties={DIFFICULTIES}
  create={(d) => generate(isDifficulty(d) ? d : 'easy')}
  isPuzzle={(v, d) => isDifficulty(d) && isPuzzle(v, d)}
  conflicts={(p, marks) => conflicts(p, marks.map((m) => m === MAIN), marks.map((m) => m === NOTE))}
  names={['Shade', 'Circle']}
  drags={['none', 'free']}
  {variants}
  {first}
>
  {#snippet icon(kind)}
    {#if kind === MAIN}
      <svg viewBox="0 0 16 16" aria-hidden="true"><rect class="shade-icon" x="2" y="2" width="12" height="12" rx="2" /></svg>
    {:else}
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
    {/if}
  {/snippet}

  {#snippet cells({ puzzle, marks, bad })}
    {@const n = puzzle.size}
    {#each marks as m, i (i)}
      {@const x = i % n}
      {@const y = Math.floor(i / n)}
      {#if m === MAIN}
        <rect class={['shade', 'dark', { bad: bad[i] }]} x={x - 0.01} y={y - 0.01} width="1.02" height="1.02" />
      {:else if m === NOTE}
        <circle class={['ring', { bad: bad[i] }]} cx={x + 0.5} cy={y + 0.5} r="0.36" />
      {/if}
      <text class={['digit', { under: m === MAIN, bad: m === NOTE && bad[i] }]} x={x + 0.5} y={y + 0.5} dy="0.355em">{puzzle.numbers[i]}</text>
    {/each}
  {/snippet}
</ShadePlay>
