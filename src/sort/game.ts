// Color Sort game state and moves, as a pure reducer.
//
// With the mystery rule, `hidden` marks the layers whose color isn't shown yet (parallel to
// `tubes`). A layer comes into view once it's on top of its tube, or once it's poured; pours
// themselves work exactly as without the rule, so hidden layers move with the run above them if
// they match it.
import {
  capacityOf, DIFFICULTIES, generate, isDifficulty, isRules, isSorted, NO_RULES, pour, pourAmount,
  type Difficulty, type Rules, type Tubes,
} from './logic';

export const STORAGE_KEY = 'games.sort.v1';
const HISTORY_LIMIT = 500;

export interface Game {
  difficulty: Difficulty;
  rules: Rules;
  tubes: Tubes;
  hidden: boolean[][]; // per layer, as tubes; all false without the mystery rule
  selected: number | null; // the tube picked up to pour from
  history: { tubes: Tubes; hidden: boolean[][] }[];
  done: boolean;
}

export type Action =
  | { type: 'tap'; tube: number } // pick up, put down, or pour into
  | { type: 'undo' };

/** Every layer but each tube's top one hidden, with the mystery rule; none without. */
const startHidden = (tubes: Tubes, mystery: boolean) => tubes.map((t) => t.map((_, k) => mystery && k < t.length - 1));

export function newGame(difficulty: Difficulty, rules: Rules = NO_RULES): Game {
  const tubes = generate(difficulty, capacityOf(rules));
  return { difficulty, rules: { ...rules }, tubes, hidden: startHidden(tubes, rules.mystery), selected: null, history: [], done: false };
}

/**
 * Validates a save. Saves from before the rules carry on as plain games: no rules, nothing hidden,
 * and their undo history (plain tubes then) read the same way.
 */
export function isGame(value: unknown): value is Game {
  const g = value as (Partial<Game> & { history?: unknown[] }) | null;
  if (!isDifficulty(g?.difficulty) || !Array.isArray(g.tubes) || !Array.isArray(g.history)) return false;
  g.rules ??= { ...NO_RULES };
  if (!isRules(g.rules)) return false;
  const plain = (tubes: Tubes) => tubes.map((t) => t.map(() => false));
  g.hidden ??= plain(g.tubes);
  g.history = g.history.map((h) => (Array.isArray(h) ? { tubes: h as Tubes, hidden: plain(h as Tubes) } : h)) as Game['history'];
  const { colors, spare } = DIFFICULTIES[g.difficulty];
  const capacity = capacityOf(g.rules);
  return (
    g.tubes.length === colors + spare && g.tubes.every((t) => Array.isArray(t) && t.length <= capacity) &&
    g.hidden.length === g.tubes.length && g.hidden.every((h, i) => Array.isArray(h) && h.length === g.tubes![i].length) &&
    g.history.every((h) => Array.isArray(h?.tubes) && Array.isArray(h?.hidden))
  );
}

export const capacity = (g: Game) => capacityOf(g.rules);


/** Hidden flags after pouring `n` layers from `from` to `to`: the poured layers and each tube's new top show. */
function pourHidden(hidden: boolean[][], from: number, to: number, n: number): boolean[][] {
  const out = hidden.map((h) => h.slice());
  out[from].splice(out[from].length - n, n);
  out[to].push(...new Array<boolean>(n).fill(false));
  if (out[from].length) out[from][out[from].length - 1] = false;
  return out;
}

export function reducer(g: Game, action: Action): Game {
  switch (action.type) {
    case 'tap': {
      if (g.done) return g;
      const t = action.tube;
      const cap = capacity(g);
      if (g.selected === null) return g.tubes[t].length ? { ...g, selected: t } : g;
      if (g.selected === t) return { ...g, selected: null };
      const n = pourAmount(g.tubes, g.selected, t, cap);
      if (n === 0) {
        // Can't pour there: pick that tube up instead (if it has anything in it).
        return g.tubes[t].length ? { ...g, selected: t } : g;
      }
      const tubes = pour(g.tubes, g.selected, t, cap);
      const done = isSorted(tubes, cap);
      // Sorted: everything shows.
      const hidden = done ? tubes.map((x) => x.map(() => false)) : pourHidden(g.hidden, g.selected, t, n);
      return {
        ...g, tubes, hidden, selected: null, done,
        history: [...g.history, { tubes: g.tubes, hidden: g.hidden }].slice(-HISTORY_LIMIT),
      };
    }
    case 'undo': {
      const last = g.history.at(-1);
      if (g.done || !last) return g;
      return { ...g, tubes: last.tubes, hidden: last.hidden, selected: null, history: g.history.slice(0, -1) };
    }
  }
}
