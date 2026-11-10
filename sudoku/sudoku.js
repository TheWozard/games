// Sudoku: puzzles are generated in the browser (random full grid, then clues removed while the
// solution stays unique), and the game in progress is saved to localStorage after every move.
(() => {
  'use strict';

  const STORAGE_KEY = 'games.sudoku.v1';
  const DIFFICULTIES = {
    easy: { label: 'Easy', clues: 40 },
    medium: { label: 'Medium', clues: 32 },
    hard: { label: 'Hard', clues: 26 },
  };
  const ALL_DIGITS = 0x3fe; // bits 1..9
  const HISTORY_LIMIT = 500;

  // ---- Grid helpers ----

  const rowOf = (i) => Math.floor(i / 9);
  const colOf = (i) => i % 9;
  const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

  const PEERS = Array.from({ length: 81 }, (_, i) => {
    const peers = [];
    for (let j = 0; j < 81; j++) {
      if (j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))) peers.push(j);
    }
    return peers;
  });

  function freeMask(grid, i) {
    let used = 0;
    for (const p of PEERS[i]) used |= 1 << grid[p];
    return ALL_DIGITS & ~used;
  }

  function bitCount(m) {
    let n = 0;
    for (; m; n++) m &= m - 1;
    return n;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // The empty cell with the fewest candidates: { index: -1 } when the grid is full, null at a dead end.
  function pickCell(grid) {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const mask = freeMask(grid, i);
      const count = bitCount(mask);
      if (count === 0) return null;
      if (count < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = count;
        if (count === 1) break;
      }
    }
    return { index: best, mask: bestMask };
  }

  function fillRandom(grid) {
    const pick = pickCell(grid);
    if (!pick) return false;
    if (pick.index === -1) return true;
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
      if (!(pick.mask & (1 << d))) continue;
      grid[pick.index] = d;
      if (fillRandom(grid)) return true;
    }
    grid[pick.index] = 0;
    return false;
  }

  // Counts solutions up to `limit`, leaving the grid as it found it.
  function countSolutions(grid, limit) {
    const pick = pickCell(grid);
    if (!pick) return 0;
    if (pick.index === -1) return 1;
    let count = 0;
    for (let d = 1; d <= 9 && count < limit; d++) {
      if (!(pick.mask & (1 << d))) continue;
      grid[pick.index] = d;
      count += countSolutions(grid, limit - count);
    }
    grid[pick.index] = 0;
    return count;
  }

  function generate(difficulty) {
    const solution = new Array(81).fill(0);
    fillRandom(solution);
    const puzzle = solution.slice();
    let clues = 81;
    for (const i of shuffle([...Array(81).keys()])) {
      if (clues <= DIFFICULTIES[difficulty].clues) break;
      const value = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle, 2) === 1) clues--;
      else puzzle[i] = value;
    }
    return { puzzle, solution };
  }

  // ---- State ----

  let state;

  function newGame(difficulty) {
    const { puzzle, solution } = generate(difficulty);
    state = {
      difficulty,
      puzzle,
      solution,
      values: puzzle.slice(),
      notes: new Array(81).fill(0), // bitmask of pencil marks per cell
      selected: null,
      notesMode: false,
      history: [], // each entry: [[index, value, notes], ...] to restore
      elapsed: 0,
      done: false,
    };
    save();
    render();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable (private mode, quota); the game still works, it just isn't kept.
    }
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && DIFFICULTIES[saved.difficulty] && saved.values?.length === 81 && saved.solution?.length === 81) return saved;
    } catch {
      // Missing or unreadable; start fresh.
    }
    return null;
  }

  // ---- DOM ----

  const $ = (id) => document.getElementById(id);
  const board = $('board');
  const pad = $('pad');
  const timerEl = $('timer');
  const difficultyEl = $('difficulty');
  const undoBtn = $('undo');
  const eraseBtn = $('erase');
  const notesBtn = $('notes');
  const newBtn = $('new');
  const newDialog = $('new-dialog');
  const winDialog = $('win-dialog');

  const cells = Array.from({ length: 81 }, (_, i) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'cell';
    el.dataset.index = i;
    const r = rowOf(i);
    const c = colOf(i);
    if (c === 2 || c === 5) el.classList.add('box-r');
    if (r === 2 || r === 5) el.classList.add('box-b');
    if (c === 8) el.classList.add('edge-r');
    if (r === 8) el.classList.add('edge-b');
    const value = document.createElement('span');
    const notes = document.createElement('span');
    notes.className = 'notes';
    for (let d = 0; d < 9; d++) notes.append(document.createElement('span'));
    el.append(value, notes);
    board.append(el);
    return { el, value, notes: [...notes.children] };
  });

  const digitButtons = Array.from({ length: 9 }, (_, k) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'digit';
    el.innerHTML = `<span class="digit-n">${k + 1}</span><span class="digit-left"></span>`;
    el.addEventListener('click', () => enter(k + 1));
    pad.append(el);
    return { el, left: el.querySelector('.digit-left') };
  });

  function formatTime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor(s / 60) % 60;
    const sec = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  }

  function render() {
    const sel = state.selected;
    const selValue = sel === null ? 0 : state.values[sel];
    const counts = new Array(10).fill(0);
    for (const v of state.values) counts[v]++;

    cells.forEach(({ el, value, notes }, i) => {
      const v = state.values[i];
      const given = state.puzzle[i] !== 0;
      value.textContent = v || '';
      const mask = v ? 0 : state.notes[i];
      notes.forEach((n, k) => { n.textContent = mask & (1 << (k + 1)) ? k + 1 : ''; });
      el.classList.toggle('given', given);
      el.classList.toggle('selected', i === sel);
      el.classList.toggle('peer', sel !== null && PEERS[sel].includes(i));
      el.classList.toggle('same', v !== 0 && v === selValue && i !== sel);
      el.classList.toggle('conflict', v !== 0 && !given && PEERS[i].some((p) => state.values[p] === v));
      el.setAttribute('aria-label', `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}: ${v || 'empty'}`);
    });

    digitButtons.forEach(({ el, left }, k) => {
      const remaining = 9 - counts[k + 1];
      left.textContent = remaining > 0 ? remaining : '';
      el.classList.toggle('complete', remaining <= 0);
    });

    pad.classList.toggle('notes-mode', state.notesMode);
    notesBtn.setAttribute('aria-pressed', String(state.notesMode));
    undoBtn.disabled = state.done || state.history.length === 0;
    eraseBtn.disabled = state.done;
    difficultyEl.textContent = DIFFICULTIES[state.difficulty].label;
    timerEl.textContent = formatTime(state.elapsed);
  }

  // ---- Actions ----

  function editable() {
    return !state.done && state.selected !== null && state.puzzle[state.selected] === 0;
  }

  function apply(changes) {
    state.history.push(changes.map(([i]) => [i, state.values[i], state.notes[i]]));
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
    for (const [i, value, notes] of changes) {
      state.values[i] = value;
      state.notes[i] = notes;
    }
  }

  function enter(d) {
    if (!editable()) return;
    const i = state.selected;
    const bit = 1 << d;
    if (state.notesMode) {
      if (state.values[i]) return;
      apply([[i, 0, state.notes[i] ^ bit]]);
    } else if (state.values[i] === d) {
      apply([[i, 0, 0]]);
    } else {
      // Place the digit and clear it from the pencil marks it rules out.
      const changes = [[i, d, 0]];
      for (const p of PEERS[i]) {
        if (state.notes[p] & bit) changes.push([p, state.values[p], state.notes[p] & ~bit]);
      }
      apply(changes);
    }
    checkWin();
    render();
    save();
  }

  function erase() {
    if (!editable()) return;
    const i = state.selected;
    if (!state.values[i] && !state.notes[i]) return;
    apply([[i, 0, 0]]);
    render();
    save();
  }

  function undo() {
    if (state.done) return;
    const last = state.history.pop();
    if (!last) return;
    for (const [i, value, notes] of last) {
      state.values[i] = value;
      state.notes[i] = notes;
    }
    render();
    save();
  }

  function select(i) {
    state.selected = i;
    render();
  }

  function toggleNotes() {
    state.notesMode = !state.notesMode;
    render();
    save();
  }

  function checkWin() {
    if (!state.values.every((v, i) => v === state.solution[i])) return;
    state.done = true;
    state.selected = null;
    $('win-text').textContent = `${DIFFICULTIES[state.difficulty].label} puzzle in ${formatTime(state.elapsed)}.`;
    winDialog.showModal();
  }

  function askNewGame() {
    $('new-warning').hidden = state.done || state.history.length === 0;
    newDialog.returnValue = '';
    newDialog.showModal();
  }

  // ---- Events ----

  board.addEventListener('click', (e) => {
    const cell = e.target.closest('.cell');
    if (cell) select(Number(cell.dataset.index));
  });
  undoBtn.addEventListener('click', undo);
  eraseBtn.addEventListener('click', erase);
  notesBtn.addEventListener('click', toggleNotes);
  newBtn.addEventListener('click', askNewGame);

  newDialog.addEventListener('close', () => {
    if (DIFFICULTIES[newDialog.returnValue]) newGame(newDialog.returnValue);
  });
  winDialog.addEventListener('close', () => {
    if (winDialog.returnValue === 'new') askNewGame();
    winDialog.returnValue = '';
  });

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key)) {
      e.preventDefault();
      enter(Number(e.key));
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      e.preventDefault();
      erase();
    } else if (e.key === 'n' || e.key === 'N') {
      toggleNotes();
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const i = state.selected ?? 40;
      const r = rowOf(i);
      const c = colOf(i);
      const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      const [dr, dc] = moves[e.key] ?? [0, 0];
      select(((r + dr + 9) % 9) * 9 + ((c + dc + 9) % 9));
    }
  });

  // The clock only runs while the game is on screen and no dialog is open.
  setInterval(() => {
    if (state.done || document.visibilityState !== 'visible' || document.querySelector('dialog[open]')) return;
    state.elapsed++;
    timerEl.textContent = formatTime(state.elapsed);
    if (state.elapsed % 10 === 0) save();
  }, 1000);
  document.addEventListener('visibilitychange', save);
  window.addEventListener('pagehide', save);

  // ---- Start ----

  state = load();
  if (state) render();
  else newGame('easy');
})();
