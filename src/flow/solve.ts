// Counts the solutions of a Flow puzzle, up to a limit, to check that a puzzle has only one.
//
// The board becomes a graph: a node per open square, joined to the squares a path can step to.
// A bridge becomes two nodes, one joined only to its left and right neighbors (the path across)
// and one only to its up and down neighbors, so a path through either goes straight; the two
// must be different colors (a path can't cross itself).
//
// Every color is drawn from both of its dots at once: each dot is an open end, and the color is
// done when its two ends meet. Each step extends one end, after checking that the position can
// still be finished:
// - every empty node has two ways in or out (empty neighbors, or open ends). With exactly two it
//   must use both: if both are ends of different colors it would join them, so it's dead; if one
//   is an end, that end's next step is forced;
// - every open end has a move;
// - empty nodes fall into pockets, walled off by paths. A path that goes into a pocket can't come
//   out until it finishes, so each pocket needs a color of its own whose two ends both touch it
//   (a matching of pockets to colors), and a color that's the only one fitting a pocket must step
//   into it next. Every color's ends must touch each other or a pocket together.
// With no forced step, it extends the end with the fewest moves (ties: the one beside the empty
// node with the fewest ways), trying each.
//
// On the hardest boards (9×9, wrapping) this is about ten times faster than drawing each color
// from one dot with only the pocket check.
import { isBridge, isHole, neighbors, step, type Board } from './logic';

/** Directions (see DIRS in logic.ts) that run across: left and right. */
const ACROSS = (d: number) => d >= 2;

const lowBit = (m: number) => 31 - Math.clz32(m & -m);

interface Graph {
  /** Per node: the nodes a path can step to. Nodes 0..n-1 are squares (a bridge's across path), n..2n-1 a bridge's down path. */
  next: number[][];
  /** Per node: whether it's on the board at all (not a hole, and only bridges have a down node). */
  live: boolean[];
}

function graph(board: Board): Graph {
  const n = board.size * board.size;
  const next: number[][] = Array.from({ length: 2 * n }, () => []);
  const live = new Array<boolean>(2 * n).fill(false);
  // A bridge's down node is entered and left by vertical steps; everything else by its square.
  const node = (i: number, d: number) => (isBridge(i, board) && !ACROSS(d) ? n + i : i);
  for (let i = 0; i < n; i++) {
    if (isHole(i, board)) continue;
    live[i] = true;
    if (isBridge(i, board)) live[n + i] = true;
    for (let d = 0; d < 4; d++) {
      const j = step(i, d, board);
      if (j === -1 || !neighbors(i, board).includes(j)) continue;
      const from = node(i, d);
      const to = node(j, d);
      if (!next[from].includes(to)) next[from].push(to);
    }
  }
  return { next, live };
}

/**
 * How many ways there are to join the dots, filling the board, counting up to `limit`; or null
 * if that takes more than `budget` search steps.
 */
export function countSolutions(
  dots: readonly (readonly [number, number])[],
  board: Board,
  limit = 2,
  budget = Infinity,
): number | null {
  const n = board.size * board.size;
  const { next, live } = graph(board);
  const nodes = 2 * n;
  const colors = dots.length;
  const color = new Int32Array(nodes).fill(-1); // -1: empty
  // Open ends: color k's are ends 2k and 2k+1, at[e] where end e is now.
  const at = dots.flatMap(([a, b]) => [a, b]);
  const done = new Array<boolean>(colors).fill(false);
  const endAt = new Int32Array(nodes).fill(-1); // the open end at a node, or -1
  let empty = 0;
  for (let v = 0; v < nodes; v++) if (live[v]) empty++;
  dots.forEach(([a, b], k) => {
    color[a] = color[b] = k;
    endAt[a] = 2 * k;
    endAt[b] = 2 * k + 1;
    empty -= 2;
  });
  // A bridge's two nodes: its across node (the square's own) and its down node.
  const isBridgeNode = (v: number) => v >= n || live[n + v];
  const sibling = (v: number) => (v < n ? n + v : v - n);
  /** Whether color k may step onto empty node u (not both ways over one bridge). */
  const mayEnter = (u: number, k: number) => color[u] === -1 && !(isBridgeNode(u) && color[sibling(u)] === k);

  // Worked out by viable(), for the step that follows it.
  const pocket = new Int32Array(nodes); // pocket number per empty node
  const ways = new Int32Array(nodes); // ways in or out per empty node
  const pinned = new Int32Array(colors); // the pocket color k must step into next, or -1
  let forced: [end: number, node: number] | null = null;

  /** Whether the position could still be finished (see the checks at the top). */
  function viable(): boolean {
    forced = null;
    for (let v = 0; v < nodes; v++) {
      if (!live[v] || color[v] !== -1) continue;
      let w = 0;
      let e1 = -1;
      let e2 = -1;
      for (const u of next[v]) {
        if (color[u] === -1) w++;
        else if (endAt[u] !== -1) {
          w++;
          if (e1 === -1) e1 = endAt[u];
          else e2 = endAt[u];
        }
      }
      if (w < 2) return false;
      ways[v] = w;
      if (w === 2 && e1 !== -1) {
        if (e2 !== -1 && e1 >> 1 !== e2 >> 1) return false;
        forced ??= [e1, v];
      }
    }
    for (let e = 0; e < at.length; e++) {
      if (done[e >> 1]) continue;
      const other = at[e ^ 1];
      if (!next[at[e]].some((u) => u === other || mayEnter(u, e >> 1))) return false;
    }
    // Pockets, with the colors whose two ends both touch each.
    pocket.fill(-1);
    const fits: number[] = [];
    for (let v = 0; v < nodes; v++) {
      if (!live[v] || color[v] !== -1 || pocket[v] !== -1) continue;
      const r = fits.length;
      let even = 0; // colors whose end 2k touches the pocket
      let odd = 0; // ... and end 2k+1
      const queue = [v];
      pocket[v] = r;
      for (let q = 0; q < queue.length; q++) {
        for (const u of next[queue[q]]) {
          if (color[u] === -1) {
            if (pocket[u] === -1) {
              pocket[u] = r;
              queue.push(u);
            }
          } else if (endAt[u] !== -1) {
            if (endAt[u] % 2) odd |= 1 << (endAt[u] >> 1);
            else even |= 1 << (endAt[u] >> 1);
          }
        }
      }
      if (!(even & odd)) return false;
      fits.push(even & odd);
    }
    for (let k = 0; k < colors; k++) {
      if (done[k] || next[at[2 * k]].includes(at[2 * k + 1])) continue;
      if (!fits.some((f) => f & (1 << k))) return false;
    }
    // Each pocket a color of its own (augmenting paths; a dozen colors at most).
    const owner = new Int32Array(colors).fill(-1);
    let tried = 0;
    const claim = (r: number): boolean => {
      for (let m = fits[r] & ~tried; m; m &= m - 1) {
        const k = lowBit(m);
        tried |= 1 << k;
        if (owner[k] === -1 || claim(owner[k])) {
          owner[k] = r;
          return true;
        }
      }
      return false;
    };
    pinned.fill(-1);
    for (let r = 0; r < fits.length; r++) {
      tried = 0;
      if (!claim(r)) return false;
      if (!(fits[r] & (fits[r] - 1))) pinned[lowBit(fits[r])] = r;
    }
    return true;
  }

  /** Where end e can go: its other end, or an empty node (into its pinned pocket, if it has one). */
  function moves(e: number): number[] {
    const k = e >> 1;
    const other = at[e ^ 1];
    const pin = pinned[k];
    const out: number[] = [];
    for (const u of next[at[e]]) {
      if (pin !== -1 ? mayEnter(u, k) && pocket[u] === pin : u === other || mayEnter(u, k)) out.push(u);
    }
    return out;
  }

  let found = 0;
  let steps = 0;

  /** Moves end e onto u (finishing its color if u is its other end), searches on, and takes it back. */
  function go(e: number, u: number): boolean {
    const k = e >> 1;
    const from = at[e];
    const other = at[e ^ 1];
    endAt[from] = -1;
    let ok: boolean;
    if (u === other) {
      endAt[other] = -1;
      done[k] = true;
      ok = search();
      done[k] = false;
      endAt[other] = e ^ 1;
    } else {
      color[u] = k;
      endAt[u] = e;
      at[e] = u;
      empty--;
      ok = search();
      empty++;
      at[e] = from;
      endAt[u] = -1;
      color[u] = -1;
    }
    endAt[from] = e;
    return ok;
  }

  /** False if the budget ran out. */
  function search(): boolean {
    if (++steps > budget) return false;
    if (!viable()) return true;
    if (forced) {
      const [e, v] = forced;
      const k = e >> 1;
      if (!mayEnter(v, k) || (pinned[k] !== -1 && pocket[v] !== pinned[k])) return true;
      return go(e, v);
    }
    // The end with the fewest moves; ties go to the one beside the tightest empty node.
    const tightness = (ms: number[]) => Math.min(...ms.map((u) => (color[u] === -1 ? ways[u] : 9)));
    let pick = -1;
    let options: number[] = [];
    let tight = 0;
    for (let e = 0; e < at.length && options.length !== 1; e++) {
      if (done[e >> 1]) continue;
      const m = moves(e);
      if (m.length === 0) return true;
      if (pick !== -1 && m.length > options.length) continue;
      const t = tightness(m);
      if (pick === -1 || m.length < options.length || t < tight) {
        pick = e;
        options = m;
        tight = t;
      }
    }
    if (pick === -1) {
      if (empty === 0) found++;
      return true;
    }
    for (const u of options) {
      if (!go(pick, u)) return false;
      if (found >= limit) return true;
    }
    return true;
  }

  return search() ? Math.min(found, limit) : null;
}
