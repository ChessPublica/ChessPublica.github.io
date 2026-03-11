/**
 * JekyllChess — Local Puzzle Engine
 */

import { PIECE_THEME } from "./config.js";
import { normalizeSAN } from "./puzzle-helpers.js";

var ANIM_MS = 250;

export function renderLocalPuzzle(
  container,
  fen,
  moves,
  autoFirstMove,
  forceBlack,
  onSolved,
  forcedOrientation,
  orientationFromPGN,
  isRush,
) {
  function createPuzzleBoard() {
    container.innerHTML = "";

    var boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";
    container.appendChild(boardDiv);

    var game = new Chess(fen);

    var state = {
      game: game,
      moves: moves,
      index: 0,
      solverSide: game.turn(),
      locked: false,
      solved: false,
    };

    boardDiv.__state = state;

    function getOrientation() {
      if (orientationFromPGN) return orientationFromPGN;
      if (forcedOrientation) return forcedOrientation;
      if (forceBlack) return "black";
      return state.solverSide === "w" ? "white" : "black";
    }

    function dispatchMoveEvent(index) {
      boardDiv.dispatchEvent(
        new CustomEvent("jc-puzzle-move", {
          detail: { index: index },
          bubbles: true,
        }),
      );
    }

    function finishSolved() {
      state.solved = true;
      board.position(state.game.fen(), false);
      boardDiv.classList.remove("jc-fire-once");
      boardDiv.classList.add("jc-fire-solved");

      boardDiv.addEventListener(
        "mousedown",
        function () {
          if (container.reset) container.reset();
        },
        { once: true, capture: true },
      );

      if (onSolved) onSolved();
    }

    function autoReply() {
      if (state.index >= state.moves.length) return finishSolved();

      var mv = state.game.move(state.moves[state.index], { sloppy: true });

      if (!mv) {
        console.error("Invalid puzzle move:", state.moves[state.index]);
        return;
      }

      state.index++;
      board.position(state.game.fen(), true);
      dispatchMoveEvent(state.index);

      setTimeout(function () {
        state.locked = false;
      }, ANIM_MS);
    }

    function onDrop(from, to) {
      if (
        state.locked ||
        state.solved ||
        state.game.turn() !== state.solverSide
      )
        return "snapback";

      var expectedSAN = String(state.moves[state.index] || "").trim();
      var move = state.game.move({ from: from, to: to, promotion: "q" });
      if (!move) return "snapback";

      if (
        normalizeSAN(move.san).trim() !== normalizeSAN(expectedSAN).trim()
      ) {
        state.game.undo();
        board.position(state.game.fen(), false);
        boardDiv.classList.remove("jc-shake");
        void boardDiv.offsetWidth;
        boardDiv.classList.add("jc-shake");
        return "snapback";
      }

      state.index++;
      board.position(state.game.fen(), false);
      dispatchMoveEvent(state.index);

      boardDiv.classList.remove("jc-fire-once");
      requestAnimationFrame(function () {
        boardDiv.classList.add("jc-fire-once");
      });

      setTimeout(function () {
        if (!state.solved) boardDiv.classList.remove("jc-fire-once");
      }, 1000);

      if (state.index >= state.moves.length) return finishSolved();

      state.locked = true;
      setTimeout(autoReply, 80);
      return true;
    }

    var board = Chessboard(boardDiv, {
      draggable: true,
      position: fen,
      orientation: getOrientation(),
      pieceTheme: PIECE_THEME,
      onDrop: onDrop,
      onSnapEnd: function () {
        board.position(state.game.fen(), false);
      },
    });

    boardDiv.__board = board;

    if (autoFirstMove) {
      var mv = state.game.move(moves[0], { sloppy: true });
      if (mv) {
        board.position(state.game.fen(), true);
        state.index = 1;
        state.solverSide = state.game.turn();
      }
    }
  }

  createPuzzleBoard();

  container.reset = function () {
    createPuzzleBoard();
    container.dispatchEvent(
      new CustomEvent("jc-puzzle-reset", { bubbles: true }),
    );
  };
}