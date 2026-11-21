<!--
  New-game picks for games with a size and optional rules (Bridges, Loop, Nonogram): a row of sizes, then
  one line per rule: a check box toggle, and an i that opens a line explaining the rule. The game
  keeps the picks (bound here); GameScreen's Play then calls its `onstart('start')`. Without
  `sizes`, only the rules.
-->
<script generics="S extends string, R extends string" lang="ts">
  import Choice from './ui/Choice.svelte';
  import PickGroup from './ui/PickGroup.svelte';
  import Toggle from './ui/Toggle.svelte';

  interface Props {
    on: Record<R, boolean>;
    rules: Record<R, { info: string; label: string }>;
    size?: S;
    sizes?: Record<S, { detail: string; label: string }>;
  }

  let { sizes, rules, size = $bindable(), on = $bindable() }: Props = $props();

  // The rule whose explanation is open, if any (one at a time).
  let explained = $state<null | string>(null);
</script>

{#if sizes}
  <PickGroup title="Difficulty">
    {#each Object.entries(sizes) as [key, s] (key)}
      {@const { label, detail } = s as { detail: string; label: string }}
      <Choice {detail} {label} onclick={() => (size = key as S)} pressed={size === key} />
    {/each}
  </PickGroup>
{/if}

<h3 class="pick-title">Rules</h3>
<div class="rules">
  {#each Object.entries(rules) as [key, r] (key)}
    {@const { label, info } = r as { info: string; label: string }}
    <div class="rule">
      <!-- Each rule turns on or off by itself (not one of a set), so it shows a check box. -->
      <Toggle {label} on={on[key as R]} onclick={() => (on = { ...on, [key]: !on[key as R] })} />
      <button
        class="rule-info"
        aria-controls="rule-{key}"
        aria-expanded={explained === key}
        aria-label="About {label}"
        onclick={() => (explained = explained === key ? null : key)}
        type="button"
      >
        i
      </button>
    </div>
    {#if explained === key}<p id="rule-{key}" class="rule-text">{info}</p>{/if}
  {/each}
</div>
