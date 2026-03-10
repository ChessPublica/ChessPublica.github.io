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

"use strict";

import "./configuration.js";
import "./figurine.js";
import "./board.js";
import "./tokenizer.js";
import "./tree-builder.js";
import "./branch-logic.js";
import "./pgn-renderer.js";
import "./pgn-reader.js";
import "./puzzle.js";
import "./puzzle-rush.js";
import "./element-init.js";
import "./master-init.js";
