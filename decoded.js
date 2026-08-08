(() => {
  const decodedWords = new WeakSet();
  let toastLayer = null;

  function solved(p) {
    return wordCells(p).every(({ r, c }) => {
      const cell = getCell(r, c);
      const input = cell?.querySelector('input');
      return input && input.value.toLowerCase() === cell.dataset.answer;
    });
  }

  function ensureToastLayer() {
    if (toastLayer && document.body.contains(toastLayer)) return toastLayer;
    toastLayer = document.createElement('div');
    toastLayer.className = 'decode-toast-layer';
    toastLayer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastLayer);
    return toastLayer;
  }

  function showToast(word) {
    const layer = ensureToastLayer();
    const toast = document.createElement('div');
    toast.className = 'decode-toast';
    toast.innerHTML = `<span class="decoded-word">${word.toUpperCase()}</span> // DECODED`;
    layer.appendChild(toast);
    setTimeout(() => toast.remove(), 980);
  }

  function celebrateWord(p) {
    const positions = wordCells(p);
    positions.forEach(({ r, c }, i) => {
      const cell = getCell(r, c);
      if (!cell) return;
      cell.classList.add('word-decoded-lock');
      cell.style.setProperty('--decode-delay', `${i * 42}ms`);
      cell.classList.remove('word-decoded-flash');
      void cell.offsetWidth;
      cell.classList.add('word-decoded-flash');
      setTimeout(() => cell.classList.remove('word-decoded-flash'), 900 + i * 42);
    });

    showToast(p.word);
    document.dispatchEvent(new CustomEvent('lexicon:word-decoded', {
      detail: { word: p.word, direction: p.dir, number: p.number }
    }));
  }

  function checkCompletedAt(r, c) {
    const newlySolved = wordsAtCell(r, c).filter(p => !decodedWords.has(p) && solved(p));
    newlySolved.forEach((p, index) => {
      decodedWords.add(p);
      setTimeout(() => celebrateWord(p), index * 180);
    });
  }

  document.addEventListener('input', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.value) return;
    const cell = input.closest('#crossword .cell');
    if (!cell) return;
    checkCompletedAt(Number(cell.dataset.row), Number(cell.dataset.col));
  });
})();
