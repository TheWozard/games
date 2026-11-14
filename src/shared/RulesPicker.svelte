<!--
  New-game picks for games with a size and optional rules (Bridges, Loop, Nonogram): a row of sizes, then
  one line per rule: a check box toggle, and an i that opens a line explaining the rule. The game
  keeps the picks (bound here); GameScreen's Play then calls its `onstart('start')`. Without
  `sizes`, only the rules.
-->
<script lang="ts" generics="S extends string, R extends string">
  import Check from '@lucide/svelte/icons/check';

  interface Props {
    sizes?: Record<S, { label: string; detail: string }>;
    rules: Record<R, { label: string; info: string }>;
    size?: S;
    on: Record<R, boolean>;
  }

  let { sizes, rules, size = $bindable(), on = $bindable() }: Props = $props();

  // The rule whose explanation is open, if any (one at a time).
  let explained = $state<string | null>(null);
</script>

{#if sizes}
  <h3 class="pick-title">Difficulty</h3>
  <div class="pick">
    {#each Object.entries(sizes) as [key, s] (key)}
      {@const { label, detail } = s as { label: string; detail: string }}
      <button type="button" class="btn" aria-pressed={size === key} onclick={() => (size = key as S)}>
        <strong>{label}</strong>
        <span>{detail}</span>
      </button>
    {/each}
  </div>
{/if}

<h3 class="pick-title">Rules</h3>
<div class="rules">
  {#each Object.entries(rules) as [key, r] (key)}
    {@const { label, info } = r as { label: string; info: string }}
    <div class="rule">
      <!-- Each rule turns on or off by itself (not one of a set), so it shows a check box. -->
      <button type="button" class="btn toggle" aria-pressed={on[key as R]} onclick={() => (on = { ...on, [key]: !on[key as R] })}>
        <span class="check" aria-hidden="true">
          <Check strokeWidth={3.5} />
        </span>
        <strong>{label}</strong>
      </button>
      <button
        type="button"
        class="rule-info"
        aria-label="About {label}"
        aria-expanded={explained === key}
        aria-controls="rule-{key}"
        onclick={() => (explained = explained === key ? null : key)}
      >i</button>
    </div>
    {#if explained === key}<p class="rule-text" id="rule-{key}">{info}</p>{/if}
  {/each}
</div>
