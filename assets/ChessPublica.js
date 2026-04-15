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

import { toFigurine, parseGame } from "./helpers.js";
import { createBoard } from "./board.js";
import { buildMoveTree, parseHeaders, renderFullPGN } from "./pgn.js";
import { renderLocalPuzzle } from "./puzzle.js";
import { initAll } from "./init.js";

/* ================================================================
   AUTO-INIT ON DOM READY
================================================================ */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAll, { once: true });
} else {
  initAll();
}

/* ================================================================
   LOAD <pgn-player> ELEMENT
   pgn-player.js is a classic script that registers a custom element
   on load. Inject it once, resolved relative to this module's URL,
   so consumers only need to include ChessPublica.js.
================================================================ */

(function loadPgnPlayer() {
  if (customElements.get("pgn-player")) return;
  if (document.querySelector('script[data-chesspublica-pgn-player="1"]')) return;
  var url = new URL("./pgn-player.js", import.meta.url).href;
  var s = document.createElement("script");
  s.src = url;
  s.type = "module";
  s.dataset.chesspublicaPgnPlayer = "1";
  document.head.appendChild(s);
})();

/* ================================================================
   PUBLIC API (optional — for programmatic use)
================================================================ */

window.JekyllChess = {
  renderFullPGN: renderFullPGN,
  buildMoveTree: buildMoveTree,
  parseHeaders: parseHeaders,
  createBoard: createBoard,
  toFigurine: toFigurine,
  parseGame: parseGame,
  renderLocalPuzzle: renderLocalPuzzle,
  initAll: initAll,
};