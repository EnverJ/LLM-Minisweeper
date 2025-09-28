(function() {
  console.log('Script loading...');
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
  } else {
    initGame();
  }
  
  function initGame() {
    console.log('DOM ready, initializing game...');
    
  const boardEl = document.getElementById('board');
  const mineCountEl = document.getElementById('mineCount');
  const timerEl = document.getElementById('timer');
  const faceBtn = document.getElementById('faceBtn');
  const rowsInput = document.getElementById('rowsInput');
  const colsInput = document.getElementById('colsInput');
  const minesInput = document.getElementById('minesInput');
  const newGameBtn = document.getElementById('newGameBtn');

  console.log('Elements found:', {
    boardEl: !!boardEl,
    mineCountEl: !!mineCountEl,
    timerEl: !!timerEl,
    faceBtn: !!faceBtn,
    rowsInput: !!rowsInput,
    colsInput: !!colsInput,
    minesInput: !!minesInput,
    newGameBtn: !!newGameBtn
  });

  document.querySelectorAll('.preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = +btn.dataset.rows, c = +btn.dataset.cols, m = +btn.dataset.mines;
      rowsInput.value = r; colsInput.value = c; minesInput.value = m;
      startNewGame(r, c, m);
    });
  });
  newGameBtn.addEventListener('click', () => {
    const r = clamp(+rowsInput.value || 9, 5, 40);
    const c = clamp(+colsInput.value || 9, 5, 60);
    const maxM = Math.max(1, r * c - 9);
    const m = clamp(+minesInput.value || 10, 1, maxM);
    rowsInput.value = r; colsInput.value = c; minesInput.value = m;
    startNewGame(r, c, m);
  });
  faceBtn.addEventListener('click', () => startNewGame(state.rows, state.cols, state.mines));

  let timerHandle = null;
  let state = resetState(9, 9, 10);

  function resetState(rows, cols, mines) {
    stopTimer();
    return {
      rows, cols, mines,
      flags: 0,
      revealed: 0,
      over: false,
      win: false,
      firstClick: true,
      startedAt: 0,
      elapsed: 0,
      grid: makeGrid(rows, cols)
    };
  }

  function startNewGame(rows, cols, mines) {
    state = resetState(rows, cols, mines);
    boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
    faceBtn.textContent = '🙂';
    updateMineCounter();
    updateTimer(0);
    renderBoard();
  }

  function startTimer() {
    if (timerHandle) return;
    state.startedAt = Date.now();
    timerHandle = setInterval(() => {
      const secs = Math.min(999, Math.floor((Date.now() - state.startedAt) / 1000));
      state.elapsed = secs;
      updateTimer(secs);
    }, 250);
  }
  function stopTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }
  function updateTimer(v) {
    timerEl.textContent = pad3(v);
  }
  function updateMineCounter() {
    const remaining = Math.max(0, state.mines - state.flags);
    mineCountEl.textContent = pad3(remaining);
  }
  function pad3(n) {
    const s = String(n);
    return "0".repeat(Math.max(0, 3 - s.length)) + s;
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function makeGrid(rows, cols) {
    const grid = new Array(rows);
    for (let r = 0; r < rows; r++) {
      grid[r] = new Array(cols);
      for (let c = 0; c < cols; c++) {
        grid[r][c] = {
          r, c,
          mine: false,
          adj: 0,
          revealed: false,
          flagged: false,
          el: null
        };
      }
    }
    return grid;
  }

  function eachNeighbor(r, c, fn) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < state.rows && cc >= 0 && cc < state.cols) fn(state.grid[rr][cc]);
      }
    }
  }

  function placeMinesAvoiding(r0, c0) {
    const forbidden = new Set();
    forbidden.add(`${r0},${c0}`);
    eachNeighbor(r0, c0, n => forbidden.add(`${n.r},${n.c}`));

    const all = [];
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const key = `${r},${c}`;
        if (!forbidden.has(key)) all.push({ r, c });
      }
    }
    shuffle(all);
    const count = Math.min(state.mines, all.length);
    for (let i = 0; i < count; i++) {
      const { r, c } = all[i];
      state.grid[r][c].mine = true;
    }
    // compute adjacencies
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.grid[r][c];
        if (cell.mine) continue;
        let adj = 0;
        eachNeighbor(r, c, n => { if (n.mine) adj++; });
        cell.adj = adj;
      }
    }
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function renderBoard() {
    console.log('Rendering board:', state.rows, 'x', state.cols);
    boardEl.innerHTML = '';
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.grid[r][c];
        const el = document.createElement('button');
        el.className = 'cell';
        el.setAttribute('role', 'gridcell');
        el.setAttribute('aria-label', `Cell ${r+1},${c+1}`);
        el.dataset.r = r;
        el.dataset.c = c;

        el.addEventListener('click', handleLeftClick);
        el.addEventListener('contextmenu', handleRightClick);
        el.addEventListener('pointerdown', e => {
          // prevent long-press context menu on mobile
          if (e.pointerType === 'touch') e.preventDefault();
        });

        cell.el = el;
        boardEl.appendChild(el);
      }
    }
  }

  function handleLeftClick(e) {
    e.preventDefault();
    const r = +e.currentTarget.dataset.r;
    const c = +e.currentTarget.dataset.c;
    if (state.over) return;
    const cell = state.grid[r][c];
    if (cell.flagged || cell.revealed) return;

    if (state.firstClick) {
      placeMinesAvoiding(r, c);
      state.firstClick = false;
      startTimer();
    }

    revealCell(r, c);

    if (state.over) {
      revealAllMines(cell);
    } else {
      maybeWin();
    }
  }

  function handleRightClick(e) {
    e.preventDefault();
    const r = +e.currentTarget.dataset.r;
    const c = +e.currentTarget.dataset.c;
    if (state.over) return;
    const cell = state.grid[r][c];
    if (cell.revealed) return;
    cell.flagged = !cell.flagged;
    state.flags += cell.flagged ? 1 : -1;
    updateMineCounter();
    drawCell(cell);
  }

  function revealCell(r, c) {
    const cell = state.grid[r][c];
    if (cell.revealed || cell.flagged) return;
    cell.revealed = true;
    state.revealed++;
    drawCell(cell);

    if (cell.mine) {
      state.over = true;
      state.win = false;
      faceBtn.textContent = '💥';
      stopTimer();
      cell.el.classList.add('boom');
      return;
    }

    // flood fill
    if (cell.adj === 0) {
      const stack = [cell];
      const seen = new Set([key(cell)]);
      while (stack.length) {
        const cur = stack.pop();
        eachNeighbor(cur.r, cur.c, n => {
          if (n.flagged || n.revealed) return;
          n.revealed = true;
          state.revealed++;
          drawCell(n);
          if (n.adj === 0 && !seen.has(key(n))) {
            seen.add(key(n));
            stack.push(n);
          }
        });
      }
    }
  }

  function drawCell(cell) {
    const el = cell.el;
    el.classList.toggle('revealed', cell.revealed);
    el.classList.toggle('flagged', cell.flagged);

    if (!cell.revealed) {
      el.textContent = cell.flagged ? '🚩' : '';
      el.classList.remove('mine', 'boom', 'n1','n2','n3','n4','n5','n6','n7','n8');
      return;
    }

    // revealed
    if (cell.mine) {
      el.textContent = '💣';
      el.classList.add('mine');
      return;
    }

    el.classList.remove('mine', 'boom');
    if (cell.adj === 0) {
      el.textContent = '';
      el.classList.remove('n1','n2','n3','n4','n5','n6','n7','n8');
    } else {
      el.textContent = String(cell.adj);
      el.classList.add('n' + cell.adj);
    }
  }

  function revealAllMines(triggerCell) {
    // show all mines; wrong flags could be indicated if desired
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = state.grid[r][c];
        if (cell.mine) {
          cell.revealed = true;
          drawCell(cell);
        } else if (cell.flagged && !cell.mine) {
          // mark wrong flags subtly
          cell.el.textContent = '❌';
          cell.el.classList.add('revealed');
        }
      }
    }
  }

  function maybeWin() {
    const total = state.rows * state.cols;
    const nonMines = total - state.mines;
    if (state.revealed >= nonMines) {
      state.over = true;
      state.win = true;
      faceBtn.textContent = '😎';
      stopTimer();
      // auto-flag remaining
      for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
          const cell = state.grid[r][c];
          if (cell.mine && !cell.flagged) {
            cell.flagged = true;
            state.flags++;
            drawCell(cell);
          }
        }
      }
      updateMineCounter();
    }
  }

  function key(cell) { return `${cell.r},${cell.c}`; }

  // Initialize default game
  console.log('Initializing Minesweeper game...');
  startNewGame(9, 9, 10);
  console.log('Game initialized!');

  // Keyboard accessibility: space/enter reveals, F flags
  boardEl.addEventListener('keydown', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains('cell')) return;
    const r = +target.dataset.r, c = +target.dataset.c;
    if (e.key === ' ' || e.key === 'Enter') {
      handleLeftClick({ preventDefault() {}, currentTarget: target });
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'f') {
      handleRightClick({ preventDefault() {}, currentTarget: target });
      e.preventDefault();
    }
  });
  
  } // End of initGame function
})();