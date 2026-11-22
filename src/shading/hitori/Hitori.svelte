<script lang="ts">
  import { MAIN, NOTE } from '../board';
  import ShadePlay from '../ShadePlay.svelte';
  import { storageKey, type Switcher } from '../variants';
  import { conflicts, DIFFICULTIES, generate, isDifficulty, isPuzzle } from './logic';

  let { variants, first }: { first?: string; variants: Switcher } = $props();
</script>

<ShadePlay
  conflicts={(p, marks) =>
    conflicts(
      p,
      marks.map((m) => m === MAIN),
      marks.map((m) => m === NOTE),
    )}
  create={(d: string) => generate(isDifficulty(d) ? d : 'easy')}
  difficulties={DIFFICULTIES}
  drags={['none', 'free']}
  {first}
  isPuzzle={(v, d) => isDifficulty(d) && isPuzzle(v, d)}
  names={['Shade', 'Circle']}
  storageKey={storageKey('hitori')}
  title="Shading"
  {variants}
>
  {#snippet icon(kind)}
    {#if kind === MAIN}
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <rect class="shade-icon" height="12" rx="2" width="12" x="2" y="2" />
      </svg>
    {:else}
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <circle cx="8" cy="8" fill="none" r="5.2" stroke="currentColor" stroke-width="1.6" />
      </svg>
    {/if}
  {/snippet}

  {#snippet cells({ puzzle, marks, bad })}
    {@const n = puzzle.size}
    {#each marks as m, i (i)}
      {@const x = i % n}
      {@const y = Math.floor(i / n)}
      {#if m === MAIN}
        <rect
          class={['shade', 'dark', { bad: bad[i] }]}
          height="1.02"
          width="1.02"
          x={x - 0.01}
          y={y - 0.01}
        />
      {:else if m === NOTE}
        <circle class={['ring', { bad: bad[i] }]} cx={x + 0.5} cy={y + 0.5} r="0.36" />
      {/if}
      <text
        class={['digit', { under: m === MAIN, bad: m === NOTE && bad[i] }]}
        dy="0.355em"
        x={x + 0.5}
        y={y + 0.5}
      >
        {puzzle.numbers[i]}
      </text>
    {/each}
  {/snippet}
</ShadePlay>
