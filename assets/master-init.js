/* ================================================================
     MASTER INIT
  ================================================================ */

  function initAll() {
    initPgnElements();
    initPgnReaderElements();
    initFenElements();
    initPuzzleRushElements();
    initPuzzleBlockElements();
    initPuzzleElements();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll, { once: true });
  } else {
    initAll();
  }

  /* ================================================================
     PUBLIC API (optional — for programmatic use)
  ================================================================ */

  window.JekyllChess = {
    renderFullPGN: renderFullPGN,
    renderPGNReader: renderPGNReader,
    buildMoveTree: buildMoveTree,
    parseHeaders: parseHeaders,
    createBoard: createBoard,
    toFigurine: toFigurine,
    parseGame: parseGame,
    renderLocalPuzzle: renderLocalPuzzle,
    renderPuzzleBlock: renderPuzzleBlock,
    renderPuzzleRush: renderPuzzleRush,
    initAll: initAll,
  };
