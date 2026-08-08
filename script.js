const FALLBACK_WORDS = [
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

let WORDS = [...FALLBACK_WORDS];

const SIZE = 19;
const TARGET_WORDS = 10;
const SWIPE_THRESHOLD = 18;
let board = [];
let placed = [];
let numberedCells = new Map();
let activeWord = null;
let selectedCellKey = null;
let completionShown = false;

function isTabletMode() {
  return window.innerWidth >= 681 && window.innerWidth <= 1180;
}

function freshBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function key(r, c) { return `${r},${c}`; }
function inBounds(r, c) { return r >= 0 && c >= 0 && r < SIZE && c < SIZE; }

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cleanLexiconWords(items) {
  const seen = new Set();
  return (items || [])
    .map(item => ({ word: String(item.word || '').trim().toLowerCase(), clue: String(item.clue || '').trim() }))
    .filter(item => /^[a-z]+$/.test(item.word))
    .filter(item => item.word.length >= 3 && item.word.length <= 15)
    .filter(item => item.clue)
    .filter(item => {
      if (seen.has(item.word)) return false;
      seen.add(item.word);
      return true;
    });
}

async function loadWordsFromNotion() {
  const response = await fetch('/api/words', { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Notion sync failed (${response.status})`);
  const data = await response.json();
  const syncedWords = cleanLexiconWords(data.words);
  if (syncedWords.length < 5) throw new Error('Not enough usable words returned from Notion');
  WORDS = syncedWords;
}

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
      } else if ((inBounds(r, c - 1) && board[r][c - 1]) || (inBounds(r, c + 1) && board[r][c + 1])) return null;
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
  completionShown = false;
  let bestBoard = null;
  let bestPlaced = [];
  const attempts = Math.max(35, Math.min(90, WORDS.length * 3));
  for (let attempt = 0; attempt < attempts; attempt++) {
    board = freshBoard(); placed = [];
    const poolSize = Math.min(WORDS.length, Math.max(TARGET_WORDS * 3, 20));
    const words = shuffle(WORDS).slice(0, poolSize).sort((a, b) => b.word.length - a.word.length || Math.random() - 0.5);
    const first = words.shift();
    if (!first) continue;
    commitPlace(first, Math.floor(SIZE / 2), Math.floor((SIZE - first.word.length) / 2), 'across');
    for (const entry of words) {
      if (placed.length >= TARGET_WORDS) break;
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
    if (placed.length > bestPlaced.length) {
      bestBoard = board.map(row => [...row]);
      bestPlaced = placed.map(p => ({ ...p }));
    }
    if (bestPlaced.length >= TARGET_WORDS) break;
  }
  if (bestBoard && bestPlaced.length) { board = bestBoard; placed = bestPlaced.slice(0, TARGET_WORDS); }
}

function bounds() {
  const occupied = [];
  placed.forEach(p => wordCells(p).forEach(pos => occupied.push(pos)));
  return { minR: Math.min(...occupied.map(x => x.r)), maxR: Math.max(...occupied.map(x => x.r)), minC: Math.min(...occupied.map(x => x.c)), maxC: Math.max(...occupied.map(x => x.c)) };
}

function assignNumbers() {
  numberedCells = new Map();
  [...placed].sort((a, b) => a.row - b.row || a.col - b.col).forEach(p => {
    const k = key(p.row, p.col);
    if (!numberedCells.has(k)) numberedCells.set(k, numberedCells.size + 1);
    p.number = numberedCells.get(k);
  });
}

function wordCells(p) { return Array.from({ length: p.word.length }, (_, i) => ({ r: p.row + (p.dir === 'down' ? i : 0), c: p.col + (p.dir === 'across' ? i : 0) })); }
function wordsAtCell(r, c) { return placed.filter(p => wordCells(p).some(pos => pos.r === r && pos.c === c)); }
function getCell(r, c) { return document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`); }
function getSelectedCell() {
  if (!selectedCellKey) return null;
  const [r, c] = selectedCellKey.split(',').map(Number);
  return getCell(r, c);
}

function clearSelection() {
  document.querySelectorAll('.cell').forEach(c => c.classList.remove('active-word', 'active-cell'));
  document.querySelectorAll('.clue-card li').forEach(li => li.classList.remove('active-clue-item'));
}

function updateTabletKeyboardStatus() {
  const status = document.getElementById('tabletKeyboardStatus');
  if (!status) return;
  status.textContent = activeWord && selectedCellKey ? `${activeWord.number} ${activeWord.dir === 'across' ? 'ACROSS' : 'DOWN'}` : 'SELECT A CELL';
}

function selectWord(p, currentCell = null) {
  activeWord = p;
  clearSelection();
  wordCells(p).forEach(({ r, c }) => { const el = getCell(r, c); if (el) el.classList.add('active-word'); });
  if (currentCell) currentCell.classList.add('active-cell');
  const activeClue = document.getElementById('activeClue');
  if (activeClue) activeClue.innerHTML = `<span class="active-clue-label">${p.number} ${p.dir === 'across' ? 'Across' : 'Down'}</span><strong>${p.clue}（${p.word.length}文字）</strong>`;
  const clueItem = document.querySelector(`[data-clue-key="${p.dir}-${p.number}"]`);
  if (clueItem) clueItem.classList.add('active-clue-item');
  updateTabletKeyboardStatus();
}

function focusInput(input) {
  if (!input || isTabletMode()) return;
  input.focus({ preventScroll: true });
  input.select();
}

function selectDirectionAtCell(r, c, dir, div) {
  const chosen = wordsAtCell(r, c).find(p => p.dir === dir);
  if (!chosen) return false;
  selectedCellKey = key(r, c);
  selectWord(chosen, div);
  focusInput(div.querySelector('input'));
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
  const nextIndex = idx + delta;
  if (idx < 0 || nextIndex < 0 || nextIndex >= positions.length) return;
  const next = positions[nextIndex];
  const nextCell = getCell(next.r, next.c);
  selectedCellKey = key(next.r, next.c);
  selectWord(activeWord, nextCell);
  focusInput(nextCell.querySelector('input'));
}

function enterTabletLetter(letter) {
  const cell = getSelectedCell();
  if (!isTabletMode() || !cell) return;
  const input = cell.querySelector('input');
  input.value = letter.toUpperCase();
  cell.classList.remove('correct', 'wrong');
  moveAlongActiveWord(Number(cell.dataset.row), Number(cell.dataset.col), 1);
}

function tabletBackspace() {
  const cell = getSelectedCell();
  if (!isTabletMode() || !cell) return;
  const input = cell.querySelector('input');
  const r = Number(cell.dataset.row), c = Number(cell.dataset.col);
  if (input.value) input.value = '';
  else {
    moveAlongActiveWord(r, c, -1);
    const previous = getSelectedCell();
    if (previous) previous.querySelector('input').value = '';
  }
}

function buildTabletKeyboard() {
  document.querySelectorAll('.keyboard-row[data-row]').forEach(row => {
    row.innerHTML = '';
    row.dataset.row.toUpperCase().split('').forEach(letter => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'keyboard-key'; button.textContent = letter;
      button.addEventListener('pointerdown', e => e.preventDefault());
      button.addEventListener('click', () => enterTabletLetter(letter));
      row.appendChild(button);
    });
  });
  const backspace = document.getElementById('tabletBackspace');
  if (backspace) {
    backspace.addEventListener('pointerdown', e => e.preventDefault());
    backspace.addEventListener('click', tabletBackspace);
  }
}

function fitCrosswordToPanel() {
  const root = document.getElementById('crossword');
  const panel = root.closest('.panel');
  if (!root || !panel) return;
  const columns = Number(root.dataset.columns || 1);
  const gap = window.innerWidth <= 680 ? 2 : 3;
  const styles = getComputedStyle(panel);
  const available = panel.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
  const target = Math.floor((available - gap * (columns - 1)) / columns);
  const maxCell = isTabletMode() ? 46 : (window.innerWidth <= 680 ? 34 : 42);
  root.style.setProperty('--cell', `${Math.max(window.innerWidth <= 680 ? 10 : 18, Math.min(maxCell, target))}px`);
}

function render() {
  assignNumbers();
  const { minR, maxR, minC, maxC } = bounds();
  const root = document.getElementById('crossword');
  const columns = maxC - minC + 1;
  root.innerHTML = '';
  root.dataset.columns = columns;
  root.style.gridTemplateColumns = `repeat(${columns}, var(--cell))`;
  for (let r = minR; r <= maxR; r++) for (let c = minC; c <= maxC; c++) {
    const ch = board[r][c];
    const div = document.createElement('div');
    if (!ch) div.className = 'block';
    else {
      div.className = 'cell'; div.dataset.answer = ch; div.dataset.row = r; div.dataset.col = c;
      const n = numberedCells.get(key(r, c));
      if (n) { const span = document.createElement('span'); span.className = 'num'; span.textContent = n; div.appendChild(span); }
      const input = document.createElement('input');
      input.maxLength = 1; input.autocomplete = 'off'; input.autocapitalize = 'characters'; input.spellcheck = false; input.inputMode = 'text';
      if (isTabletMode()) {
        input.readOnly = true;
        input.inputMode = 'none';
        input.tabIndex = -1;
        input.setAttribute('aria-readonly', 'true');
      }
      let touchStartX = 0, touchStartY = 0, swipeHandled = false;
      input.addEventListener('touchstart', e => { const t = e.changedTouches[0]; touchStartX = t.clientX; touchStartY = t.clientY; swipeHandled = false; }, { passive: true });
      input.addEventListener('touchend', e => {
        const t = e.changedTouches[0], dx = t.clientX - touchStartX, dy = t.clientY - touchStartY;
        if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
        if (dx > 0 && Math.abs(dx) > Math.abs(dy)) swipeHandled = selectDirectionAtCell(r, c, 'across', div);
        else if (dy > 0 && Math.abs(dy) > Math.abs(dx)) swipeHandled = selectDirectionAtCell(r, c, 'down', div);
      }, { passive: true });
      input.addEventListener('pointerdown', e => {
        if (isTabletMode()) e.preventDefault();
      });
      input.addEventListener('click', e => {
        if (swipeHandled) { e.preventDefault(); swipeHandled = false; return; }
        if (isTabletMode()) e.preventDefault();
        chooseDirectionForCell(r, c, div);
      });
      input.addEventListener('focus', () => {
        if (isTabletMode()) { input.blur(); return; }
        const options = wordsAtCell(r, c);
        if (!activeWord || !options.includes(activeWord)) {
          const chosen = options.find(p => p.dir === 'across') || options[0];
          if (chosen) { selectedCellKey = key(r, c); selectWord(chosen, div); }
        } else selectWord(activeWord, div);
      });
      input.addEventListener('input', e => {
        const cleaned = e.target.value.replace(/[^a-zA-Z]/g, '').slice(-1).toUpperCase();
        e.target.value = cleaned; div.classList.remove('correct', 'wrong');
        if (cleaned) moveAlongActiveWord(r, c, 1);
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && input.value === '') { e.preventDefault(); moveAlongActiveWord(r, c, -1); }
      });
      div.appendChild(input);
      if (isTabletMode()) {
        div.addEventListener('pointerdown', e => { e.preventDefault(); chooseDirectionForCell(r, c, div); });
      }
    }
    root.appendChild(div);
  }
  fitCrosswordToPanel(); renderClues('across', 'acrossClues'); renderClues('down', 'downClues');
}

function renderClues(dir, id) {
  const list = document.getElementById(id); list.innerHTML = '';
  placed.filter(p => p.dir === dir).sort((a, b) => a.number - b.number).forEach(p => {
    const li = document.createElement('li'); li.value = p.number; li.dataset.clueKey = `${p.dir}-${p.number}`; li.textContent = `${p.clue}（${p.word.length}文字）`;
    li.addEventListener('click', () => {
      const first = wordCells(p)[0], cell = getCell(first.r, first.c);
      selectedCellKey = key(first.r, first.c); selectWord(p, cell);
      if (cell) focusInput(cell.querySelector('input'));
    });
    list.appendChild(li);
  });
}

function cells() { return [...document.querySelectorAll('.cell')]; }
function checkAnswers() {
  let correct = 0; const all = cells();
  all.forEach(cell => { const input = cell.querySelector('input'); const ok = input.value.toLowerCase() === cell.dataset.answer; cell.classList.toggle('correct', ok); cell.classList.toggle('wrong', !ok && input.value !== ''); if (ok) correct++; });
  document.getElementById('result').textContent = correct === all.length ? 'SEQUENCE COMPLETE' : `${correct} / ${all.length} 文字正解`;
}
function revealHint() {
  const unknown = cells().filter(cell => cell.querySelector('input').value.toLowerCase() !== cell.dataset.answer);
  if (!unknown.length) return;
  const cell = unknown[Math.floor(Math.random() * unknown.length)]; cell.querySelector('input').value = cell.dataset.answer.toUpperCase(); cell.classList.add('correct');
}
function resetBoard() {
  cells().forEach(cell => { cell.querySelector('input').value = ''; cell.classList.remove('correct', 'wrong'); });
  clearSelection(); activeWord = null; selectedCellKey = null; document.getElementById('result').textContent = ''; updateTabletKeyboardStatus();
}
function newPuzzle() { activeWord = null; selectedCellKey = null; generateCrossword(); render(); document.getElementById('result').textContent = ''; window.scrollTo({ top: 0, behavior: 'smooth' }); }

async function boot() {
  const result = document.getElementById('result'); result.textContent = 'SYNCING LEXICON...';
  try { await loadWordsFromNotion(); } catch (error) { console.warn(error); WORDS = [...FALLBACK_WORDS]; }
  generateCrossword(); render(); buildTabletKeyboard(); result.textContent = '';
}

document.getElementById('checkBtn').addEventListener('click', checkAnswers);
document.getElementById('hintBtn').addEventListener('click', revealHint);
document.getElementById('resetBtn').addEventListener('click', resetBoard);
document.getElementById('newPuzzleBtn').addEventListener('click', newPuzzle);
window.addEventListener('resize', () => { fitCrosswordToPanel(); });
boot();