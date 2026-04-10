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
  var variations = opts.variations || [];
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

    /* Wrap the board in a positioned container so the round replay
       button can sit over its bottom-right corner, matching the
       pgn-player style. .jc-board-wrapper already declares
       position:relative + the same max-width as .jc-board. */
    var boardWrap = document.createElement("div");
    boardWrap.className = "jc-board-wrapper";
    container.appendChild(boardWrap);

    var boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";
    /* The wrapper already supplies the 1rem auto margin .jc-board uses
       on its own, so zero it here to avoid doubling the vertical gap. */
    boardDiv.style.margin = "0";
    boardWrap.appendChild(boardDiv);

    /* Refresh button — hidden by default. Shown while the solver is
       exploring a variation (acts as "return to main line") and again
       once the puzzle is solved (acts as "replay the puzzle"). Uses
       the same .comment-play-btn class as <pgn-player> so it gets the
       same circular replay-icon styling. */
    var refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "comment-play-btn jc-puzzle-refresh";
    refreshBtn.setAttribute("aria-label", "Reset puzzle");
    refreshBtn.title = "Reset puzzle";
    refreshBtn.innerHTML = '<span class="material-icons">replay</span>';
    refreshBtn.style.display = "none";
    refreshBtn.addEventListener("click", function () {
      handleRefresh();
    });
    boardWrap.appendChild(refreshBtn);

    function showRefreshButton() {
      /* .comment-play-btn uses display:flex to center the icon. */
      refreshBtn.style.display = "flex";
    }
    function hideRefreshButton() {
      refreshBtn.style.display = "none";
    }

    var game = new Chess(fen);

    var state = {
      game: game,
      moves: moves,
      index: 0,
      solverSide: game.turn(),
      locked: false,
      solved: false,
      savedForVariation: null,
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

    /* Refresh behavior depends on current state:
       — solved: full puzzle reset
       — inside a variation: undo the variation move, restore the
         main-line FEN/index/caption, and continue solving
       — otherwise: no-op (button is hidden) */
    function handleRefresh() {
      if (state.solved) {
        if (container.reset) container.reset();
        return;
      }
      if (state.savedForVariation) {
        var saved = state.savedForVariation;
        state.game.load(saved.fen);
        state.index = saved.index;
        state.savedForVariation = null;
        state.locked = false;
        board.position(state.game.fen(), true);
        if (state.index > 0) {
          setCaptionForMoveIndex(state.index - 1);
        } else {
          resetCaption();
        }
        hideRefreshButton();
      }
    }

    function finishSolved() {
      state.solved = true;
      board.position(state.game.fen(), false);
      boardDiv.classList.remove("jc-fire-once");
      boardDiv.classList.add("jc-fire-solved");
      showRefreshButton();

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

    /* If the move the user just played (already applied to state.game)
       matches the first move of any variation attached to the current
       main-line index, return that variation object. Otherwise null. */
    function matchVariationFirstMove(userSan) {
      var vars = variations[state.index];
      if (!vars || !vars.length) return null;
      var norm = normalizeSAN(userSan);
      for (var vi = 0; vi < vars.length; vi++) {
        var v = vars[vi];
        if (v && v.moves && v.moves.length &&
            normalizeSAN(v.moves[0]) === norm) {
          return v;
        }
      }
      return null;
    }

    function onDrop(from, to) {
      if (state.locked || state.solved || state.game.turn() !== state.solverSide)
        return "snapback";

      var expectedSAN = String(state.moves[state.index] || "").trim();
      var previousFen = state.game.fen();
      var move = state.game.move({ from: from, to: to, promotion: "q" });
      if (!move) return "snapback";

      if (normalizeSAN(move.san) !== normalizeSAN(expectedSAN)) {
        /* Not the main-line move — check whether it matches the first
           move of a variation attached to the current index. */
        var matchedVar = matchVariationFirstMove(move.san);
        if (matchedVar) {
          /* Accept the variation move. Remember the pre-move state so
             the refresh button can bring the solver back to the main
             line, lock further input, and show the variation's
             first-move comment if any. */
          state.savedForVariation = {
            fen: previousFen,
            index: state.index,
          };
          state.locked = true;
          board.position(state.game.fen(), false);
          var varComment = matchedVar.comments && matchedVar.comments[0];
          if (captionEl) {
            captionEl.innerHTML = varComment ? formatComment(varComment) : "";
          }
          showRefreshButton();
          return true;
        }

        /* Wrong move — undo and shake. */
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
      variations: parsed.variations || [],
      captionEl: cfg.captionEl || null,
      initialCaption: cfg.initialCaption || "",
    },
  );
}