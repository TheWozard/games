<!--
  New-game picks for games with a size and optional rules (Bridges, Loop): a row of sizes, a row of
  rule toggles, and Start, which closes GameScreen's New dialog with the value "start". The game
  keeps the picks (bound here) and starts the new game in its `onstart`.
-->
<script lang="ts" generics="S extends string, R extends string">
  interface Props {
    sizes: Record<S, { label: string; detail: string }>;
    rules: Record<R, { label: string }>;
    size: S;
    on: Record<R, boolean>;
  }

  let { sizes, rules, size = $bindable(), on = $bindable() }: Props = $props();
</script>

<h3 class="pick-title">Size</h3>
<div class="pick">
  {#each Object.entries(sizes) as [key, s] (key)}
    {@const { label, detail } = s as { label: string; detail: string }}
    <button type="button" class="btn" aria-pressed={size === key} onclick={() => (size = key as S)}>
      <strong>{label}</strong>
      <span>{detail}</span>
    </button>
  {/each}
</div>

<h3 class="pick-title">Rules</h3>
<div class="pick">
  {#each Object.entries(rules) as [key, r] (key)}
    <button type="button" class="btn" aria-pressed={on[key as R]} onclick={() => (on = { ...on, [key]: !on[key as R] })}>
      <strong>{(r as { label: string }).label}</strong>
    </button>
  {/each}
</div>

<button class="btn primary" value="start">Start</button>
