/**
 * ChessPublica — Puzzle System
 *
 * Sections:
 *   1. Puzzle Engine     — renderLocalPuzzle() (interactive drag-and-drop)
 */

import { PIECE_THEME, normalizeSAN, parseGame, formatComment } from "./helpers.js";

/* ================================================================
   1. PUZZLE ENGINE
================================================================ */

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
  opts,
) {
  opts = opts || {};
  var comments = opts.comments || [];
  var captionEl = opts.captionEl || null;
  var initialCaption = opts.initialCaption || "";

  /* Write a per-move comment into the caption slot. When no comment
     exists for the given move the caption is cleared (per spec: the
     initial caption is shown only before the first move; after that,
     only move comments appear). */
  function setCaptionForMoveIndex(moveIndex) {
    if (!captionEl) return;
    var cm = comments[moveIndex];
    if (cm) {
      captionEl.innerHTML = formatComment(cm);
    } else {
      captionEl.textContent = "";
    }
  }

  function resetCaption() {
    if (!captionEl) return;
    captionEl.innerHTML = initialCaption ? formatComment(initialCaption) : "";
  }

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

    resetCaption();

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
      setCaptionForMoveIndex(state.index - 1);
      dispatchMoveEvent(state.index);

      setTimeout(function () {
        state.locked = false;
      }, ANIM_MS);
    }

    function onDrop(from, to) {
      if (state.locked || state.solved || state.game.turn() !== state.solverSide)
        return "snapback";

      var expectedSAN = String(state.moves[state.index] || "").trim();
      var move = state.game.move({ from: from, to: to, promotion: "q" });
      if (!move) return "snapback";

      if (normalizeSAN(move.san) !== normalizeSAN(expectedSAN)) {
        state.game.undo();
        board.position(state.game.fen(), false);
        boardDiv.classList.remove("jc-shake");
        void boardDiv.offsetWidth;
        boardDiv.classList.add("jc-shake");
        return "snapback";
      }

      state.index++;
      board.position(state.game.fen(), false);
      setCaptionForMoveIndex(state.index - 1);
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
        setCaptionForMoveIndex(0);
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

export function jcPuzzleCreate(el, cfg) {
  var parsed = parseGame(cfg.rawPGN || "");
  if (parsed.error) return;

  renderLocalPuzzle(
    el,
    parsed.fen,
    parsed.moves,
    parsed.firstMoveAuto === true,
    false,
    null,
    null,
    parsed.orientation,
    false,
    {
      comments: parsed.comments || [],
      captionEl: cfg.captionEl || null,
      initialCaption: cfg.initialCaption || "",
    },
  );
}