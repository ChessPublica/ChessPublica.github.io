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

import "assets/configuration.js";
import "assets/figurine.js";
import "assets/board.js";
import "assets/tokenizer.js";
import "assets/tree-builder.js";
import "assets/branch-logic.js";
import "assets/pgn-renderer.js";
import "assets/pgn-reader.js";
import "assets/puzzle.js";
import "assets/puzzle-rush.js";
import "assets/element-init.js";
import "assets/master-init.js";
