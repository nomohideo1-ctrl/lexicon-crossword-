(function () {
  function detectTabletMode() {
    const hasTouch = (navigator.maxTouchPoints || 0) > 0 || window.matchMedia('(pointer: coarse)').matches;
    const screenWidth = window.screen && window.screen.width ? window.screen.width : window.innerWidth;
    const screenHeight = window.screen && window.screen.height ? window.screen.height : window.innerHeight;
    const shortSide = Math.min(screenWidth, screenHeight);

    // Tablets such as Redmi Pad SE can report a landscape CSS width above 1180px.
    // Using the shorter screen side keeps phones on the existing mobile UI.
    return hasTouch && shortSide >= 600;
  }

  // script.js defines this as a normal global function, so replace it before
  // its async boot sequence finishes and renders the crossword.
  if (typeof isTabletMode === 'function') {
    isTabletMode = detectTabletMode;
  } else {
    window.isTabletMode = detectTabletMode;
  }

  function applyTabletClass() {
    document.documentElement.classList.toggle('tablet-mode', detectTabletMode());
  }

  applyTabletClass();
  window.addEventListener('resize', applyTabletClass);
  window.addEventListener('orientationchange', applyTabletClass);
})();
