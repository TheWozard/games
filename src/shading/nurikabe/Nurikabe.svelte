<script lang="ts">
  import { MAIN, NOTE } from '../board';
  import Icons from '../Icons.svelte';
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
    )}
  create={(d: string) => generate(isDifficulty(d) ? d : 'easy')}
  difficulties={DIFFICULTIES}
  drags={['free', 'free']}
  {first}
  fixed={(p, i) => p.clues[i] !== null}
  isPuzzle={(v, d) => isDifficulty(d) && isPuzzle(v, d)}
  names={['Shade', 'Dot']}
  storageKey={storageKey('nurikabe')}
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
        <circle cx="8" cy="8" fill="currentColor" r="2.6" />
      </svg>
    {/if}
  {/snippet}

  {#snippet cells({ puzzle, marks, bad })}
    {@const n = puzzle.size}
    {#each marks as m, i (i)}
      {@const x = i % n}
      {@const y = Math.floor(i / n)}
      {#if puzzle.clues[i] !== null}
        <text class="clue" dy="0.355em" x={x + 0.5} y={y + 0.5}>{puzzle.clues[i]}</text>
      {:else if m === MAIN}
        <rect
          class={['shade', { bad: bad[i] }]}
          height="1.02"
          width="1.02"
          x={x - 0.01}
          y={y - 0.01}
        />
      {:else if m === NOTE}
        <Icons kind="dot" {x} {y} />
      {/if}
    {/each}
  {/snippet}
</ShadePlay>
