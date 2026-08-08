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
let board = [];
let placed = [];
let numberedCells = new Map();
let activeWord = null;

function freshBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

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
  placed.forEach(p => {
    for (let i = 0; i < p.word.length; i++) {
      cells.push({ r: p.row + (p.dir === 'down' ? i : 0), c: p.col + (p.dir === 'across' ? i : 0) });
    }
  });
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

function wordsAtCell(r, c) {
  return placed.filter(p => {
    for (let i = 0; i < p.word.length; i++) {
      const pr = p.row + (p.dir === 'down' ? i : 0);
      const pc = p.col + (p.dir === 'across' ? i : 0);
      if (pr === r && pc === c) return true;
    }
    return false;
  });
}

function wordCells(p) {
  return Array.from({ length: p.word.length }, (_, i) => ({
    r: p.row + (p.dir === 'down' ? i : 0),
    c: p.col + (p.dir === 'across' ? i : 0)
  }));
}

function clearSelection() {
  document.querySelectorAll('.cell').forEach(c => c.classList.remove('active-word','active-cell'));
  document.querySelectorAll('.clue-card li').forEach(li => li.classList.remove('active-clue-item'));
}

function selectWord(p, currentCell = null) {
  activeWord = p;
  clearSelection();
  wordCells(p).forEach(({r,c}) => {
    const el = document.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if (el) el.classList.add('active-word');
  });
  if (currentCell) currentCell.classList.add('active-cell');

  const direction = p.dir === 'across' ? 'Across' : 'Down';
  document.getElementById('activeClue').innerHTML = `<span class="active-clue-label">${p.number} ${direction}</span><strong>${p.clue}（${p.word.length}文字）</strong>`;

  const clueItem = document.querySelector(`[data-clue-key="${p.dir}-${p.number}"]`);
  if (clueItem) clueItem.classList.add('active-clue-item');
}

function render() {
  assignNumbers();
  const { minR, maxR, minC, maxC } = bounds();
  const root = document.getElementById('crossword');
  root.innerHTML = '';
  root.style.gridTemplateColumns = `repeat(${maxC - minC + 1}, 1fr)`;

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const ch = board[r][c];
      const div = document.createElement('div');
      if (!ch) {
        div.className = 'block';
      } else {
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
        input.inputMode = 'text';
        input.addEventListener('focus', () => {
          const options = wordsAtCell(r,c);
          let chosen = options[0];
          if (activeWord && options.includes(activeWord) && options.length > 1) {
            chosen = options[(options.indexOf(activeWord) + 1) % options.length];
          } else if (activeWord && options.includes(activeWord)) {
            chosen = activeWord;
          }
          if (chosen) selectWord(chosen, div);
        });
        input.addEventListener('click', () => {
          const options = wordsAtCell(r,c);
          if (options.length > 1) {
            const idx = activeWord ? options.indexOf(activeWord) : -1;
            selectWord(options[(idx + 1) % options.length], div);
          } else if (options[0]) selectWord(options[0], div);
        });
        input.addEventListener('input', e => {
          e.target.value = e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase();
          div.classList.remove('correct','wrong');
        });
        div.appendChild(input);
      }
      root.appendChild(div);
    }
  }

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
    li.addEventListener('click', () => selectWord(p));
    list.appendChild(li);
  });
}

function cells() { return [...document.querySelectorAll('.cell')]; }

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
  document.getElementById('result').textContent = correct === all.length ? '🎉 完成！全問正解！' : `${correct} / ${all.length} 文字正解`;
}

function revealHint() {
  const unknown = cells().filter(cell => cell.querySelector('input').value.toLowerCase() !== cell.dataset.answer);
  if (!unknown.length) return;
  const cell = unknown[Math.floor(Math.random() * unknown.length)];
  cell.querySelector('input').value = cell.dataset.answer.toUpperCase();
  cell.classList.add('correct');
}

function resetBoard() {
  cells().forEach(cell => {
    cell.querySelector('input').value = '';
    cell.classList.remove('correct','wrong');
  });
  clearSelection();
  activeWord = null;
  document.getElementById('activeClue').innerHTML = '<span class="active-clue-label">SELECT A WORD</span><strong>盤面のマスをタップすると、その単語をハイライトします。</strong>';
  document.getElementById('result').textContent = '';
}

document.getElementById('checkBtn').addEventListener('click', checkAnswers);
document.getElementById('hintBtn').addEventListener('click', revealHint);
document.getElementById('resetBtn').addEventListener('click', resetBoard);

generateCrossword();
render();
