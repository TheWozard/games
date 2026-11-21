<script lang="ts">
  import { MAIN, NOTE } from '../board';
  import Icons from '../Icons.svelte';
  import ShadePlay from '../ShadePlay.svelte';
  import { storageKey, type Switcher } from '../variants';
  import { conflicts, DIFFICULTIES, generate, isDifficulty, isPuzzle, lit, WALL } from './logic';

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
  drags={['none', 'free']}
  {first}
  fixed={(p, i) => p.walls[i] !== null}
  isPuzzle={(v, d) => isDifficulty(d) && isPuzzle(v, d)}
  names={['Lamp', 'X']}
  storageKey={storageKey('lightup')}
  title="Shading"
  {variants}
>
  {#snippet icon(kind)}
    {#if kind === MAIN}
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <circle class="lamp-icon" cx="8" cy="8" r="5.5" />
      </svg>
    {:else}
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <path
          d="M4.5 4.5l7 7M11.5 4.5l-7 7"
          stroke="currentColor"
          stroke-linecap="round"
          stroke-width="1.8"
        />
      </svg>
    {/if}
  {/snippet}

  {#snippet cells({ puzzle, marks, bad })}
    {@const n = puzzle.size}
    {@const on = lit(
      puzzle,
      marks.map((m) => m === MAIN),
    )}
    {#each marks as m, i (i)}
      {@const x = i % n}
      {@const y = Math.floor(i / n)}
      {@const w = puzzle.walls[i]}
      {#if w !== null}
        <rect
          class={['block', { bad: bad[i] }]}
          height="1.02"
          width="1.02"
          x={x - 0.01}
          y={y - 0.01}
        />
        {#if w !== WALL}<text
            class={['block-n', { bad: bad[i] }]}
            dy="0.355em"
            x={x + 0.5}
            y={y + 0.5}
          >
            {w}
          </text>{/if}
      {:else}
        {#if on[i]}<rect class="glow" height="0.97" width="0.97" x={x + 0.015} y={y + 0.015} />{/if}
        {#if m === MAIN}
          <circle class={['lamp', { bad: bad[i] }]} cx={x + 0.5} cy={y + 0.5} r="0.3" />
        {:else if m === NOTE}
          <Icons kind="x" {x} {y} />
        {/if}
      {/if}
    {/each}
  {/snippet}
</ShadePlay>
