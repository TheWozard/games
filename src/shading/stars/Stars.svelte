<script lang="ts">
  import { MAIN, NOTE } from '../board';
  import Icons from '../Icons.svelte';
  import ShadePlay from '../ShadePlay.svelte';
  import { storageKey, type Switcher } from '../variants';
  import { conflicts, DIFFICULTIES, generate, isDifficulty, isPuzzle } from './logic';

  let { variants, first }: { variants: Switcher; first?: string } = $props();

  /** A five-pointed star in a cell whose top left is (x, y). */
  function starPath(x: number, y: number, r = 0.32): string {
    const pts = Array.from({ length: 10 }, (_, k) => {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.45 : r;
      return `${(x + 0.5 + rr * Math.cos(a)).toFixed(3)} ${(y + 0.53 + rr * Math.sin(a)).toFixed(3)}`;
    });
    return `M${pts.join('L')}Z`;
  }
</script>

<ShadePlay
  title="Shading"
  storageKey={storageKey('stars')}
  difficulties={DIFFICULTIES}
  create={(d) => generate(isDifficulty(d) ? d : 'easy')}
  isPuzzle={(v, d) => isDifficulty(d) && isPuzzle(v, d)}
  conflicts={(p, marks) => conflicts(p, marks.map((m) => m === MAIN))}
  names={['Star', 'X']}
  drags={['none', 'free']}
  {variants}
  {first}
>
  {#snippet icon(kind)}
    {#if kind === MAIN}
      <svg viewBox="0 0 1 1" aria-hidden="true"><path class="star-icon" d={starPath(0, 0, 0.48)} /></svg>
    {:else}
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
    {/if}
  {/snippet}

  {#snippet cells({ puzzle, marks, bad })}
    {@const n = puzzle.size}
    <!-- The board's edge is every edge region's wall too, so it's as thick as the walls inside. -->
    <rect class="wall edge" x="0" y="0" width={n} height={n} />
    {#each puzzle.regions as g, i (i)}
      {@const x = i % n}
      {@const y = Math.floor(i / n)}
      {#if x < n - 1 && puzzle.regions[i + 1] !== g}<line class="wall" x1={x + 1} y1={y} x2={x + 1} y2={y + 1} />{/if}
      {#if y < n - 1 && puzzle.regions[i + n] !== g}<line class="wall" x1={x} y1={y + 1} x2={x + 1} y2={y + 1} />{/if}
    {/each}
    {#each marks as m, i (i)}
      {#if m === MAIN}
        <path class={['star', { bad: bad[i] }]} d={starPath(i % n, Math.floor(i / n))} />
      {:else if m === NOTE}
        <Icons kind="x" x={i % n} y={Math.floor(i / n)} />
      {/if}
    {/each}
  {/snippet}
</ShadePlay>
