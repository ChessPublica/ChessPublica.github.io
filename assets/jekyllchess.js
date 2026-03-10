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
/* ================================================================
   JEKYLLCHESS — MAIN ENTRY (FULLY PRE-WIRED)
   Loads all modules and initializes everything automatically
================================================================ */

/* -------------------------------
   Core configuration
-------------------------------- */

import "./configuration.js";

/* -------------------------------
   Core utilities
-------------------------------- */

import "./figurine.js";
import "./board.js";
import "./tokenizer.js";

/* -------------------------------
   PGN system
-------------------------------- */

import { buildMoveTree } from "./tree-builder.js";
import "./branch-logic.js";
import { renderFullPGN } from "./pgn-renderer.js";
import { renderPGNReader, parseHeaders } from "./pgn-reader.js";

/* -------------------------------
   Puzzle system
-------------------------------- */

import {
  parseGame,
  stripFigurines,
  normalizePuzzleText,
  normalizeSAN,
  splitIntoPgnGames
} from "./puzzle-helpers.js";

import {
  renderLocalPuzzle,
  jcPuzzleCreate
} from "./puzzle.js";

import { renderPuzzleBlock } from "./puzzle-block.js";
import { renderPuzzleRush } from "./puzzle-rush.js";

/* -------------------------------
   Element initializers
-------------------------------- */

import { initAll } from "./element-init.js";

/* -------------------------------
   Optional master exports
-------------------------------- */

import "./master-init.js";

/* ================================================================
   AUTO INITIALIZATION
================================================================ */

function bootJekyllChess() {
  try {
    initAll();
  } catch (err) {
    console.error("JekyllChess initialization error:", err);
  }

  /* ------------------------------------------------
     Public API (optional for developers)
  ------------------------------------------------ */

  window.JekyllChess = {
    renderFullPGN,
    renderPGNReader,
    buildMoveTree,
    parseHeaders,

    parseGame,
    renderLocalPuzzle,
    renderPuzzleBlock,
    renderPuzzleRush,

    stripFigurines,
    normalizePuzzleText,
    normalizeSAN,
    splitIntoPgnGames
  };
}

/* ================================================================
   STARTUP
================================================================ */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootJekyllChess, { once: true });
} else {
  bootJekyllChess();
}