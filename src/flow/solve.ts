// Counts the solutions of a Flow puzzle, up to a limit, to check that a puzzle has only one.
//
// The board becomes a graph: a node per open square, joined to the squares a path can step to.
// A bridge becomes two nodes, one joined only to its left and right neighbors (the path across)
// and one only to its up and down neighbors, so a path through either goes straight; the two
// must be different colors (a path can't cross itself).
//
// Each color is drawn from one dot (its head) to the other (its target). Each step extends the
// unfinished color with the fewest moves, so forced moves cost nothing, after checking that the
// position can still be finished:
// - every empty node has two ways in or out (empty neighbors, or the open end of a path);
// - every target still has a way in;
// - every pocket of empty nodes touches both ends of some unfinished color (a path that goes in
//   has to come out and finish), and every color's head and target are side by side or touch a
//   pocket together.
import { isBridge, isHole, step, neighbors, type Board } from './logic';

/** Directions (see DIRS in logic.ts) that run across: left and right. */
const ACROSS = (d: number) => d >= 2;

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
  // The node a step from `i` in direction d lands on: a bridge's across or down node.
  const into = (j: number, d: number) => (isBridge(j, board) && !ACROSS(d) ? n + j : j);
  for (let i = 0; i < n; i++) {
    if (isHole(i, board)) continue;
    live[i] = true;
    if (isBridge(i, board)) live[n + i] = true;
    for (let d = 0; d < 4; d++) {
      const j = step(i, d, board);
      if (j === -1 || !neighbors(i, board).includes(j)) continue;
      // From a bridge, its across node only goes left and right, its down node up and down.
      const from = isBridge(i, board) && !ACROSS(d) ? n + i : i;
      const to = into(j, d);
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
  const head = dots.map(([a]) => a);
  const target = dots.map(([, b]) => b);
  const done = new Array<boolean>(colors).fill(false);
  // endOf[v]: the color whose open end (head or target) is at v, else -1.
  const endOf = new Int32Array(nodes).fill(-1);
  let empty = 0;
  for (let v = 0; v < nodes; v++) if (live[v]) empty++;
  dots.forEach(([a, b], k) => {
    color[a] = color[b] = k;
    endOf[a] = endOf[b] = k;
    empty -= 2;
  });
  // A bridge's two nodes: its across node (the square's own) and its down node.
  const isBridgeNode = (v: number) => v >= n || live[n + v];
  const sibling = (v: number) => (v < n ? n + v : v - n);
  const region = new Int32Array(nodes);

  /** Whether the position could still be finished (see the checks at the top). */
  function viable(): boolean {
    for (let v = 0; v < nodes; v++) {
      if (!live[v] || color[v] !== -1) continue;
      let ways = 0;
      for (const u of next[v]) if (color[u] === -1 || endOf[u] !== -1) ways++;
      if (ways < 2) return false;
    }
    for (let k = 0; k < colors; k++) {
      if (done[k]) continue;
      if (!next[target[k]].some((u) => color[u] === -1 || u === head[k])) return false;
    }
    // Pockets of empty nodes, with the colors whose head or target each touches.
    region.fill(-1);
    const heads: number[] = [];
    const targets: number[] = [];
    for (let v = 0; v < nodes; v++) {
      if (!live[v] || color[v] !== -1 || region[v] !== -1) continue;
      const r = heads.length;
      let h = 0;
      let t = 0;
      const queue = [v];
      region[v] = r;
      for (let q = 0; q < queue.length; q++) {
        for (const u of next[queue[q]]) {
          if (color[u] === -1) {
            if (region[u] === -1) { region[u] = r; queue.push(u); }
          } else if (endOf[u] !== -1) {
            const k = endOf[u];
            if (u === head[k]) h |= 1 << k;
            else t |= 1 << k;
          }
        }
      }
      if (!(h & t)) return false;
      heads.push(h);
      targets.push(t);
    }
    for (let k = 0; k < colors; k++) {
      if (done[k] || next[head[k]].includes(target[k])) continue;
      const bit = 1 << k;
      if (!heads.some((h, r) => h & targets[r] & bit)) return false;
    }
    return true;
  }

  let found = 0;
  let steps = 0;

  /** The moves for color k's head: an empty node (a bridge node only if the other way isn't k's), or its target. */
  function moves(k: number): number[] {
    const out: number[] = [];
    for (const u of next[head[k]]) {
      if (u === target[k]) out.push(u);
      else if (color[u] === -1 && !(isBridgeNode(u) && color[sibling(u)] === k)) out.push(u);
    }
    return out;
  }

  function search(): boolean {
    if (++steps > budget) return false;
    if (!viable()) return true;
    let pick = -1;
    let options: number[] = [];
    for (let k = 0; k < colors; k++) {
      if (done[k]) continue;
      const m = moves(k);
      if (m.length === 0) return true;
      if (pick === -1 || m.length < options.length) {
        pick = k;
        options = m;
        if (m.length === 1) break;
      }
    }
    if (pick === -1) {
      if (empty === 0) found++;
      return true;
    }
    const k = pick;
    const from = head[k];
    for (const u of options) {
      endOf[from] = -1;
      if (u === target[k]) {
        endOf[u] = -1;
        done[k] = true;
        if (!search()) return false;
        done[k] = false;
        endOf[u] = k;
      } else {
        color[u] = k;
        endOf[u] = k;
        head[k] = u;
        empty--;
        if (!search()) return false;
        empty++;
        head[k] = from;
        endOf[u] = -1;
        color[u] = -1;
      }
      endOf[from] = k;
      if (found >= limit) return true;
    }
    return true;
  }

  return search() ? Math.min(found, limit) : null;
}
