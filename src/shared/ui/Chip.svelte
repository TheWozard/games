<!--
  A filter that turns on and off by itself: a small round-ended pill (base.css .chip), lit up while
  on. In a row of them at the top of a PickList (its `chips`), which scrolls sideways. Mahjong's
  layout filters.
-->
<script lang="ts">
  let { label, on, onclick }: { label: string; on: boolean; onclick: () => void } = $props();
</script>

<button type="button" class="chip" aria-pressed={on} {onclick}>{label}</button>
