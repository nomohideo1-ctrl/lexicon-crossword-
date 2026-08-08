const WORDS = [
  { word: 'immersive', clue: '没入感のある、夢中にさせる' },
  { word: 'exuberant', clue: '元気いっぱいの、活気に満ちた' },
  { word: 'solitary', clue: 'ひとりの、孤独な' },
  { word: 'middling', clue: '平凡な、可もなく不可もない' },
  { word: 'descend', clue: '下りる、降りてくる' },
  { word: 'elevate', clue: '高める、向上させる' },
  { word: 'novelty', clue: '目新しさ、新奇性' },
  { word: 'bodega', clue: '（米）小さな食料品店' },
  { word: 'gruff', clue: 'ぶっきらぼうな、声が荒い' },
  { word: 'sigh', clue: 'ため息をつく／ため息' }
];

const SIZE = 19;
const SWIPE_THRESHOLD = 18;
let board = [];
let placed = [];
let numberedCells = new Map();
let activeWord = null;
let selectedCellKey = null;
let completionShown = false;

function freshBoard() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(null)); }
function key(r, c) { return `${r},${c}`; }
function inBounds(r, c) { return r >= 0 && c >= 0 && r < SIZE && c < SIZE; }

function canPlace(word, row, col, dir) {
  let intersections = 0;
  for (let i = 0; i < word.length; i++) {
    const r = row + (dir === 'down' ? i : 0);
    const c = col + (dir === 'across' ? i : 0);
    if (!inBounds(r, c)) return null;
    const existing = board[r][c];
    if (existing && existing !== word[i]) return null;
    if (existing === word[i]) intersections++;
    if (!existing) {
      if (dir === 'across') {
        if ((inBounds(r - 1, c) && board[r - 1][c]) || (inBounds(r + 1, c) && board[r + 1][c])) return null;
      } else {
        if ((inBounds(r, c - 1) && board[r][c - 1]) || (inBounds(r, c + 1) && board[r][c + 1])) return null;
      }
    }
  }
  const beforeR = row - (dir === 'down' ? 1 : 0);
  const beforeC = col - (dir === 'across' ? 1 : 0);
  const afterR = row + (dir === 'down' ? word.length : 0);
  const afterC = col + (dir === 'across' ? word.length : 0);
  if (inBounds(beforeR, beforeC) && board[beforeR][beforeC]) return null;
  if (inBounds(afterR, afterC) && board[afterR][afterC]) return null;
  return intersections;
}

function commitPlace(entry, row, col, dir) {
  [...entry.word].forEach((ch, i) => {
    const r = row + (dir === 'down' ? i : 0);
    const c = col + (dir === 'across' ? i : 0);
    board[r][c] = ch;
  });
  placed.push({ ...entry, row, col, dir });
}

function generateCrossword() {
  board = freshBoard();
  placed = [];
  completionShown = false;
  const words = [...WORDS].sort((a, b) => b.word.length - a.word.length);
  const first = words.shift();
  commitPlace(first, Math.floor(SIZE / 2), Math.floor((SIZE - first.word.length) / 2), 'across');
  for (const entry of words) {
    const candidates = [];
    for (const p of placed) {
      for (let i = 0; i < entry.word.length; i++) {
        for (let j = 0; j < p.word.length; j++) {
          if (entry.word[i] !== p.word[j]) continue;
          const dir = p.dir === 'across' ? 'down' : 'across';
          const crossR = p.row + (p.dir === 'down' ? j : 0);
          const crossC = p.col + (p.dir === 'across' ? j : 0);
          const row = crossR - (dir === 'down' ? i : 0);
          const col = crossC - (dir === 'across' ? i : 0);
          const intersections = canPlace(entry.word, row, col, dir);
          if (intersections !== null && intersections > 0) candidates.push({ row, col, dir, intersections });
        }
      }
    }
    candidates.sort((a, b) => b.intersections - a.intersections || Math.random() - 0.5);
    if (candidates[0]) commitPlace(entry, candidates[0].row, candidates[0].col, candidates[0].dir);
  }
}

function bounds() {
  const cells = [];
  placed.forEach(p => wordCells(p).forEach(pos => cells.push(pos)));
  return {
    minR: Math.min(...cells.map(x => x.r)), maxR: Math.max(...cells.map(x => x.r)),
    minC: Math.min(...cells.map(x => x.c)), maxC: Math.max(...cells.map(x => x.c))
  };
}

function assignNumbers() {
  numberedCells = new Map();
  [...placed].sort((a,b) => a.row - b.row || a.col - b.col).forEach(p => {
    const k = key(p.row, p.col);
    if (!numberedCells.has(k)) numberedCells.set(k, numberedCells.size + 1);
    p.number = numberedCells.get(k);
  });
}

function wordCells(p) {
  return Array.from({ length: p.word.length }, (_, i) => ({
    r: p.row + (p.dir === 'down' ? i : 0),
    c: p.col + (p.dir === 'across' ? i : 0)
  }));
}

function wordsAtCell(r, c) { return placed.filter(p => wordCells(p).some(pos => pos.r === r && pos.c === c)); }
function getCell(r, c) { return document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`); }

function clearSelection() {
  document.querySelectorAll('.cell').forEach(c => c.classList.remove('active-word','active-cell'));
  document.querySelectorAll('.clue-card li').forEach(li => li.classList.remove('active-clue-item'));
}

function selectWord(p, currentCell = null) {
  activeWord = p;
  clearSelection();
  wordCells(p).forEach(({r,c}) => {
    const el = getCell(r, c);
    if (el) el.classList.add('active-word');
  });
  if (currentCell) currentCell.classList.add('active-cell');
  const direction = p.dir === 'across' ? 'Across' : 'Down';
  const activeClue = document.getElementById('activeClue');
  if (activeClue) activeClue.innerHTML = `<span class="active-clue-label">${p.number} ${direction}</span><strong>${p.clue}（${p.word.length}文字）</strong>`;
  const clueItem = document.querySelector(`[data-clue-key="${p.dir}-${p.number}"]`);
  if (clueItem) clueItem.classList.add('active-clue-item');
}

function selectDirectionAtCell(r, c, dir, div) {
  const chosen = wordsAtCell(r, c).find(p => p.dir === dir);
  if (!chosen) return false;
  selectedCellKey = key(r, c);
  selectWord(chosen, div);
  const input = div.querySelector('input');
  if (input) { input.focus({ preventScroll: true }); input.select(); }
  return true;
}

function chooseDirectionForCell(r, c, div) {
  const options = wordsAtCell(r, c);
  if (!options.length) return;
  const cellKey = key(r, c);
  let chosen;
  if (selectedCellKey === cellKey && options.length > 1) {
    const idx = activeWord ? options.indexOf(activeWord) : -1;
    chosen = options[(idx + 1) % options.length];
  } else if (activeWord && options.includes(activeWord)) chosen = activeWord;
  else chosen = options.find(p => p.dir === 'across') || options[0];
  selectedCellKey = cellKey;
  selectWord(chosen, div);
}

function moveAlongActiveWord(r, c, delta) {
  if (!activeWord) return;
  const positions = wordCells(activeWord);
  const idx = positions.findIndex(pos => pos.r === r && pos.c === c);
  if (idx < 0) return;
  const nextIndex = idx + delta;
  if (nextIndex < 0 || nextIndex >= positions.length) return;
  const next = positions[nextIndex];
  const nextCell = getCell(next.r, next.c);
  if (!nextCell) return;
  selectedCellKey = key(next.r, next.c);
  selectWord(activeWord, nextCell);
  const nextInput = nextCell.querySelector('input');
  nextInput.focus({ preventScroll: true });
  nextInput.select();
}

function fitCrosswordToPanel() {
  const root = document.getElementById('crossword');
  const panel = root.closest('.panel');
  if (!root || !panel) return;
  const columns = Number(root.dataset.columns || 1);
  const gap = window.innerWidth <= 680 ? 2 : 3;
  const panelStyles = getComputedStyle(panel);
  const available = panel.clientWidth - parseFloat(panelStyles.paddingLeft) - parseFloat(panelStyles.paddingRight);
  const target = Math.floor((available - gap * (columns - 1)) / columns);
  const maxCell = window.innerWidth <= 680 ? 34 : 42;
  const minCell = window.innerWidth <= 680 ? 10 : 18;
  const cell = Math.max(minCell, Math.min(maxCell, target));
  root.style.setProperty('--cell', `${cell}px`);
}

function render() {
  assignNumbers();
  const { minR, maxR, minC, maxC } = bounds();
  const root = document.getElementById('crossword');
  const columns = maxC - minC + 1;
  root.innerHTML = '';
  root.dataset.columns = columns;
  root.style.gridTemplateColumns = `repeat(${columns}, var(--cell))`;
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const ch = board[r][c];
      const div = document.createElement('div');
      if (!ch) div.className = 'block';
      else {
        div.className = 'cell';
        div.dataset.answer = ch;
        div.dataset.row = r;
        div.dataset.col = c;
        const n = numberedCells.get(key(r,c));
        if (n) {
          const span = document.createElement('span');
          span.className = 'num';
          span.textContent = n;
          div.appendChild(span);
        }
        const input = document.createElement('input');
        input.maxLength = 1;
        input.autocomplete = 'off';
        input.autocapitalize = 'characters';
        input.spellcheck = false;
        input.inputMode = 'text';
        let touchStartX = 0, touchStartY = 0, swipeHandled = false;
        input.addEventListener('touchstart', e => {
          const t = e.changedTouches[0];
          touchStartX = t.clientX; touchStartY = t.clientY; swipeHandled = false;
        }, { passive: true });
        input.addEventListener('touchend', e => {
          const t = e.changedTouches[0];
          const dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
          const absX = Math.abs(dx), absY = Math.abs(dy);
          if (absX < SWIPE_THRESHOLD && absY < SWIPE_THRESHOLD) return;
          if (dx > 0 && absX > absY) swipeHandled = selectDirectionAtCell(r, c, 'across', div);
          else if (dy > 0 && absY > absX) swipeHandled = selectDirectionAtCell(r, c, 'down', div);
        }, { passive: true });
        input.addEventListener('click', e => {
          if (swipeHandled) { e.preventDefault(); swipeHandled = false; return; }
          chooseDirectionForCell(r, c, div);
        });
        input.addEventListener('focus', () => {
          const options = wordsAtCell(r, c);
          if (!activeWord || !options.includes(activeWord)) {
            const chosen = options.find(p => p.dir === 'across') || options[0];
            if (chosen) { selectedCellKey = key(r, c); selectWord(chosen, div); }
          } else selectWord(activeWord, div);
        });
        input.addEventListener('input', e => {
          const cleaned = e.target.value.replace(/[^a-zA-Z]/g, '').slice(-1).toUpperCase();
          e.target.value = cleaned;
          div.classList.remove('correct','wrong');
          if (cleaned) moveAlongActiveWord(r, c, 1);
        });
        input.addEventListener('keydown', e => {
          if (e.key === 'Backspace' && input.value === '') { e.preventDefault(); moveAlongActiveWord(r, c, -1); }
          if (e.key === 'ArrowRight') { e.preventDefault(); if (selectDirectionAtCell(r, c, 'across', div)) moveAlongActiveWord(r, c, 1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); if (selectDirectionAtCell(r, c, 'down', div)) moveAlongActiveWord(r, c, 1); }
        });
        div.appendChild(input);
      }
      root.appendChild(div);
    }
  }
  fitCrosswordToPanel();
  renderClues('across', 'acrossClues');
  renderClues('down', 'downClues');
}

function renderClues(dir, id) {
  const list = document.getElementById(id);
  list.innerHTML = '';
  placed.filter(p => p.dir === dir).sort((a,b) => a.number - b.number).forEach(p => {
    const li = document.createElement('li');
    li.value = p.number;
    li.dataset.clueKey = `${p.dir}-${p.number}`;
    li.textContent = `${p.clue}（${p.word.length}文字）`;
    li.addEventListener('click', () => {
      const first = wordCells(p)[0];
      const cell = getCell(first.r, first.c);
      selectedCellKey = key(first.r, first.c);
      selectWord(p, cell);
      if (cell) cell.querySelector('input').focus({ preventScroll: true });
    });
    list.appendChild(li);
  });
}

function cells() { return [...document.querySelectorAll('.cell')]; }

function showCompletion() {
  if (completionShown) return;
  completionShown = true;
  const all = cells();
  document.body.classList.add('mission-cleared');
  all.forEach((cell, i) => setTimeout(() => cell.classList.add('complete-flash'), i * 28));
  document.getElementById('completeWords').textContent = `${placed.length} / ${placed.length}`;
  const overlay = document.getElementById('completeOverlay');
  setTimeout(() => {
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }, Math.min(950, all.length * 28 + 220));
}

function checkAnswers() {
  let correct = 0;
  const all = cells();
  all.forEach(cell => {
    const input = cell.querySelector('input');
    const ok = input.value.toLowerCase() === cell.dataset.answer;
    cell.classList.toggle('correct', ok);
    cell.classList.toggle('wrong', !ok && input.value !== '');
    if (ok) correct++;
  });
  const complete = correct === all.length;
  document.getElementById('result').textContent = complete ? 'SEQUENCE COMPLETE' : `${correct} / ${all.length} 文字正解`;
  if (complete) showCompletion();
}

function revealHint() {
  const unknown = cells().filter(cell => cell.querySelector('input').value.toLowerCase() !== cell.dataset.answer);
  if (!unknown.length) return;
  const cell = unknown[Math.floor(Math.random() * unknown.length)];
  cell.querySelector('input').value = cell.dataset.answer.toUpperCase();
  cell.classList.add('correct');
}

function hideCompletion() {
  const overlay = document.getElementById('completeOverlay');
  overlay.hidden = true;
  document.body.style.overflow = '';
  document.body.classList.remove('mission-cleared');
  cells().forEach(cell => cell.classList.remove('complete-flash'));
}

function resetBoard() {
  hideCompletion();
  completionShown = false;
  cells().forEach(cell => {
    cell.querySelector('input').value = '';
    cell.classList.remove('correct','wrong');
  });
  clearSelection();
  activeWord = null;
  selectedCellKey = null;
  document.getElementById('result').textContent = '';
}

function newPuzzle() {
  hideCompletion();
  activeWord = null;
  selectedCellKey = null;
  generateCrossword();
  render();
  document.getElementById('result').textContent = '';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.getElementById('checkBtn').addEventListener('click', checkAnswers);
document.getElementById('hintBtn').addEventListener('click', revealHint);
document.getElementById('resetBtn').addEventListener('click', resetBoard);
document.getElementById('newPuzzleBtn').addEventListener('click', newPuzzle);
document.getElementById('reviewWordsBtn').addEventListener('click', () => {
  hideCompletion();
  document.querySelector('.clues-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

window.addEventListener('resize', fitCrosswordToPanel);
generateCrossword();
render();
