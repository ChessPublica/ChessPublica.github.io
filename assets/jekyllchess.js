/**
 * JekyllChess — All-in-one chess blog engine
 * Combines: figurine, board, pgn-engine, puzzle-system, and element initializers
 *
 * Dependencies (load BEFORE this script):
 *   - chess.js (Chess class)
 *   - chessboard.js (Chessboard class + CSS)
 *   - jQuery (required by chessboard.js)
 *
 * Custom HTML elements supported:
 *   <pgn>           — Annotated game viewer (static)
 *   <pgn-reader>    — Interactive board + clickable move list
 *   <fen>           — Static board from FEN string
 *   <puzzle>        — Single interactive puzzle
 *   <puzzle-block>  — Multiple puzzles from PGN file
 *   <puzzle-rush>   — Sequential puzzle rush mode
 */

// -------------------------
// Import all 12 modular files
// -------------------------
import "./configuration.js";    // constants like PIECE_THEME, NBSP
import "./figurine.js";         // toFigurine()
import "./board.js";            // createBoard()
import "./tokenizer.js";        // tokenizeMoves(), parseGame()
import "./tree-builder.js";     // buildMoveTree()
import "./branch-logic.js";     // determineBranchFen()
import "./pgn-renderer.js";     // renderFullPGN()
import "./pgn-reader.js";       // renderPGNReader(), parseHeaders()
import "./puzzle.js";           // renderLocalPuzzle(), parseGame()
import "./puzzle-rush.js";      // renderPuzzleRush()
import "./element-init.js";     // renderPuzzleBlock(), initAll()
import "./master-init.js";      // initAll()

// -------------------------
// Auto-init function
// -------------------------
function autoInit() {
  // Initialize all JekyllChess elements
  initAll();

  // Expose main modules globally for programmatic use
  window.JekyllChessModules = {
    renderFullPGN,
    renderPGNReader,
    buildMoveTree,
    createBoard,
    toFigurine,
    parseGame,
    renderLocalPuzzle,
    renderPuzzleRush,
    renderPuzzleBlock,
    parseHeaders,
    determineBranchFen,
  };
}

// -------------------------
// Run auto-init on DOMContentLoaded
// -------------------------
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoInit, { once: true });
} else {
  autoInit();
}