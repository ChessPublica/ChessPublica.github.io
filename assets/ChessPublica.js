/**
 * ChessPublica — All-in-one chess blog engine (ES6 Module Entry Point)
 *
 * Dependencies (load BEFORE this script):
 *   - chess.js (Chess class)
 *   - chessboard.js (Chessboard class + CSS)
 *   - jQuery (required by chessboard.js)
 *
 * Custom HTML elements supported:
 *   <pgn>           — Annotated game viewer (static)
 *   <fen>           — Static board from FEN string
 *   <puzzle>        — Single interactive puzzle
 */

import "./pgn-player.js";
import { toFigurine, parseGame } from "./helpers.js";
import { createBoard } from "./board.js";
import { buildMoveTree, parseHeaders, renderFullPGN } from "./pgn.js";
import { renderLocalPuzzle } from "./puzzle.js";
import { initAll, initFigurineProse } from "./init.js";

/* ================================================================
   AUTO-INIT ON DOM READY
================================================================ */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAll, { once: true });
} else {
  initAll();
}

/* ================================================================
   PUBLIC API (optional — for programmatic use)
================================================================ */

window.ChessPublica = {
  renderFullPGN: renderFullPGN,
  buildMoveTree: buildMoveTree,
  parseHeaders: parseHeaders,
  createBoard: createBoard,
  toFigurine: toFigurine,
  parseGame: parseGame,
  renderLocalPuzzle: renderLocalPuzzle,
  initAll: initAll,
  initFigurineProse: initFigurineProse,
};

/* Deprecated alias for backward compatibility */
window.JekyllChess = window.ChessPublica;