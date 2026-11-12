<!--
  A New Game picker for a page that holds several games (Solitaire: Klondike and FreeCell; Sudoku:
  Classic and Killer): a row of tabs picks the game, and that game's own choices are listed under it
  as a headed group of tiles. Nothing here starts a game: the pick, "<game>:<setting>", is bound to
  `value`, and GameScreen's Play then starts it. Opens on the game being played; picking another
  game's tab selects its first choice. The tabs scroll sideways if there are ever more than fit,
  and the picked one is brought into the middle of the row: at once as the dialog opens, then
  smoothly as another is tapped.
  A game with more to pick (Shading's Nonogram: its rules) passes them in `extras`, by game.
-->
<script lang="ts" module>
  /** Each game's tab name, and its choices under a heading. Choice values are "<game>:<setting>". */
  export type Games = Record<string, { label: string; title: string; options: { value: string; label: string; detail?: string }[] }>;

  /** A pick's game and setting, if it's one of `games`' choices. */
  export function parsePick(games: Games, value: string): { game: string; setting: string } | null {
    if (!Object.values(games).some((g) => g.options.some((o) => o.value === value))) return null;
    const [game, setting] = value.split(':');
    return { game, setting };
  }
</script>

<script lang="ts">
  import { untrack, type Snippet } from 'svelte';

  let { games, value = $bindable(), extras }: { games: Games; value: string; extras?: Record<string, Snippet> } = $props();
  const opening = untrack(() => value);
  let shown = $state(untrack(() => parsePick(games, value)?.game ?? Object.keys(games)[0]));

  let row: HTMLDivElement;

  /** Scrolls the tab row (only it, never the page) so the picked tab sits in its middle. */
  function reveal(behavior: ScrollBehavior) {
    const tab = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!tab) return;
    const at = tab.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft;
    row.scrollTo({ left: at - (row.clientWidth - tab.offsetWidth) / 2, behavior });
  }

  let first = true;
  $effect(() => {
    void shown;
    const behavior: ScrollBehavior = first ? 'instant' : 'smooth';
    first = false;
    // After the dialog has opened and laid the row out.
    requestAnimationFrame(() => reveal(behavior));
  });

  function show(game: string) {
    shown = game;
    value = parsePick(games, opening)?.game === game ? opening : games[game].options[0].value;
  }
</script>

<div class="pick-tabs" role="tablist" aria-label="Game" bind:this={row}>
  {#each Object.entries(games) as [key, g] (key)}
    <button type="button" role="tab" aria-selected={shown === key} onclick={() => show(key)}>{g.label}</button>
  {/each}
</div>
<h3 class="pick-title">{games[shown].title}</h3>
<div class="pick">
  {#each games[shown].options as option (option.value)}
    <button type="button" class="btn" aria-pressed={value === option.value} onclick={() => (value = option.value)}>
      <strong>{option.label}</strong>{#if option.detail}<span>{option.detail}</span>{/if}
    </button>
  {/each}
</div>
{@render extras?.[shown]?.()}
