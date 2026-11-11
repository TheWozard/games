<!--
  Every tile face as an SVG <symbol> (viewBox 30×40), defined once and drawn with <use>.
  Kinds: 0–8 dots, 9–17 bamboo, 18–26 characters, 27–30 winds E S W N, 31–33 dragons.
-->
<script lang="ts" module>
  type P = [number, number];

  // Dot positions per count, in the 30×40 face.
  const DOTS: P[][] = [
    [[15, 20]],
    [[15, 11], [15, 29]],
    [[8, 9], [15, 20], [22, 31]],
    [[9, 11], [21, 11], [9, 29], [21, 29]],
    [[9, 10], [21, 10], [15, 20], [9, 30], [21, 30]],
    [[9, 9], [21, 9], [9, 20], [21, 20], [9, 31], [21, 31]],
    [[8, 6], [15, 10.5], [22, 15], [9, 25], [21, 25], [9, 34], [21, 34]],
    [[9, 6.5], [21, 6.5], [9, 15.5], [21, 15.5], [9, 24.5], [21, 24.5], [9, 33.5], [21, 33.5]],
    [[8, 9], [15, 9], [22, 9], [8, 20], [15, 20], [22, 20], [8, 31], [15, 31], [22, 31]],
  ];
  const DOT_COLORS = ['#2f6bd8', '#c8372d', '#2e8b57'];

  // Bamboo stick centers per count.
  const STICKS: P[][] = [
    [[15, 20]],
    [[15, 12], [15, 28]],
    [[15, 12], [9, 28], [21, 28]],
    [[9, 12], [21, 12], [9, 28], [21, 28]],
    [[8, 12], [22, 12], [15, 20], [8, 28], [22, 28]],
    [[7, 12], [15, 12], [23, 12], [7, 28], [15, 28], [23, 28]],
    [[15, 6], [7, 20], [15, 20], [23, 20], [7, 33], [15, 33], [23, 33]],
    [[6, 12], [12, 12], [18, 12], [24, 12], [6, 28], [12, 28], [18, 28], [24, 28]],
    [[7, 7], [15, 7], [23, 7], [7, 20], [15, 20], [23, 20], [7, 33], [15, 33], [23, 33]],
  ];

  // Set as attributes, not CSS: styles don't reliably reach the copies <use> draws.
  const CJK = "'Noto Serif CJK SC', 'Noto Sans CJK SC', 'Songti SC', 'PingFang SC', serif";
  const NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const WINDS = ['東', '南', '西', '北'];
</script>

<svg class="mj-faces" aria-hidden="true" width="0" height="0">
  <defs>
    {#each DOTS as dots, n (n)}
      <symbol id="mj-k{n}" viewBox="1.5 1.5 27 37">
        {#each dots as [x, y], k (k)}
          {@const r = n === 0 ? 9 : n < 4 ? 5 : n < 6 ? 4.5 : 3.8}
          {@const color = n === 0 ? DOT_COLORS[1] : DOT_COLORS[(k + n) % 3]}
          <circle cx={x} cy={y} {r} fill="none" stroke={color} stroke-width={n === 0 ? 2.4 : 1.6} />
          <circle cx={x} cy={y} r={r * 0.42} fill={color} />
        {/each}
      </symbol>
    {/each}

    {#each STICKS as sticks, n (n)}
      <symbol id="mj-k{9 + n}" viewBox="1.5 1.5 27 37">
        {#each sticks as [x, y], k (k)}
          {@const h = n === 0 ? 26 : n < 6 ? 12 : 10}
          {@const w = n === 0 ? 6 : n === 7 ? 3.4 : 4}
          {@const color = (n === 4 && k === 2) || (n === 6 && k === 0) || (n === 8 && k % 3 === 1) ? '#c8372d' : '#2e8b57'}
          <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={w / 2} fill={color} />
          <path d="M{x - w / 2} {y}h{w}" stroke="#f4eedf" stroke-width="0.9" />
        {/each}
      </symbol>
    {/each}

    {#each NUMERALS as numeral, n (n)}
      <symbol id="mj-k{18 + n}" viewBox="1.5 1.5 27 37">
        <text x="15" y="17" text-anchor="middle" font-weight="700" font-family={CJK} font-size="15" fill="#1d1f24">{numeral}</text>
        <text x="15" y="35" text-anchor="middle" font-weight="700" font-family={CJK} font-size="15.5" fill="#c8372d">萬</text>
      </symbol>
    {/each}

    {#each WINDS as glyph, n (n)}
      <symbol id="mj-k{27 + n}" viewBox="1.5 1.5 27 37">
        <text x="15" y="27.5" text-anchor="middle" font-weight="700" font-family={CJK} font-size="18.5" fill="#1d1f24">{glyph}</text>
      </symbol>
    {/each}

    <symbol id="mj-k31" viewBox="1.5 1.5 27 37">
      <text x="15" y="27.5" text-anchor="middle" font-weight="700" font-family={CJK} font-size="19.5" fill="#c8372d">中</text>
    </symbol>
    <symbol id="mj-k32" viewBox="1.5 1.5 27 37">
      <text x="15" y="27.5" text-anchor="middle" font-weight="700" font-family={CJK} font-size="19.5" fill="#2e8b57">發</text>
    </symbol>
    <symbol id="mj-k33" viewBox="1.5 1.5 27 37">
      <rect x="6" y="7" width="18" height="26" rx="2" fill="none" stroke="#2f6bd8" stroke-width="2" />
      <rect x="9" y="10" width="12" height="20" rx="1" fill="none" stroke="#2f6bd8" stroke-width="1" />
    </symbol>
  </defs>
</svg>

<style>
  .mj-faces { position: absolute; width: 0; height: 0; overflow: hidden; }
</style>
