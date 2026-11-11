<!--
  Solitaire's New dialog: a row of tabs picks the game (Klondike or FreeCell), and that game's own
  settings are listed under it as toggles. Nothing here starts a game: the pick, "<variant>:<setting>",
  is bound to `value`, and GameScreen's Play then starts it. Opens on the game being played; picking
  the other game's tab selects its first setting. The tabs scroll sideways if there are ever more
  than fit.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { GAMES, parse, VARIANTS, type Variant } from './variants';

  let { value = $bindable() }: { value: string } = $props();
  let shown = $state<Variant>(untrack(() => parse(value)?.variant ?? 'klondike'));
  const opening = untrack(() => value);

  function show(v: Variant) {
    shown = v;
    value = parse(opening)?.variant === v ? opening : GAMES[v].options[0].value;
  }
</script>

<div class="pick-tabs" role="tablist" aria-label="Game">
  {#each VARIANTS as v (v)}
    <button type="button" role="tab" aria-selected={shown === v} onclick={() => show(v)}>{GAMES[v].label}</button>
  {/each}
</div>
<h3 class="pick-title">{GAMES[shown].title}</h3>
<div class="pick">
  {#each GAMES[shown].options as option (option.value)}
    <button type="button" class="btn" aria-pressed={value === option.value} onclick={() => (value = option.value)}>
      <strong>{option.label}</strong><span>{option.detail}</span>
    </button>
  {/each}
</div>
