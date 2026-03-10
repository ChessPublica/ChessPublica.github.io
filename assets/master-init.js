import { renderFullPGN } from "./pgn-renderer.js";
import { renderPGNReader } from "./pgn-reader.js";
import { buildMoveTree } from "./tree-builder.js";
import { createBoard } from "./board.js";
import { toFigurine } from "./figurine.js";

import { parseGame } from "./puzzle-helpers.js";
import { renderLocalPuzzle, jcPuzzleCreate } from "./puzzle.js";

import { renderPuzzleBlock } from "./puzzle-block.js";
import { renderPuzzleRush } from "./puzzle-rush.js";

import { initAll } from "./element-init.js";

window.JekyllChess = {
  renderFullPGN,
  renderPGNReader,
  buildMoveTree,
  createBoard,
  toFigurine,

  parseGame,
  renderLocalPuzzle,
  jcPuzzleCreate,

  renderPuzzleBlock,
  renderPuzzleRush,

  initAll
};