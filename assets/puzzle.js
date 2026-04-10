/**
 * ChessPublica — Puzzle System
 *
 * Sections:
 *   1. Puzzle Engine     — renderLocalPuzzle() (interactive drag-and-drop)
 */

import { PIECE_THEME, normalizeSAN, parseGame, formatComment, getDestinationSquare, renderMoveQualityBadge, clearMoveQualityBadge } from "./helpers.js";

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
  var pgnGlyphs = opts.glyphs || [];
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

  /* Show a move-quality badge on the destination square of the move
     at the given index.  The boardDiv reference is captured from the
     closure inside createPuzzleBoard. */
  var _boardDivRef = null;

  function showBadgeForMove(moveIndex) {
    if (!_boardDivRef) return;
    clearMoveQualityBadge(_boardDivRef);
    var glyph = pgnGlyphs[moveIndex];
    if (!glyph) return;
    var san = moves[moveIndex];
    /* The color that played this move: after the move, the turn flips,
       so the mover is the opposite of the current turn. But we can
       also derive it from the move index and the starting side. */
    var startTurn = fen.split(" ")[1] || "w";
    var color = (moveIndex % 2 === 0) ? startTurn : (startTurn === "w" ? "b" : "w");
    var square = getDestinationSquare(san, color);
    if (square) renderMoveQualityBadge(_boardDivRef, square, glyph);
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
    boardDiv.style.position = "relative";
    _boardDivRef = boardDiv;
    /* The wrapper already supplies the 1rem auto margin .jc-board uses
       on its own, so zero it here to avoid doubling the vertical gap. */
    boardDiv.style.margin = "0";
    boardWrap.appendChild(boardDiv);

    /* Refresh button — hidden by default. Shown once the puzzle is
       solved (acts as "replay the puzzle"). Uses the same
       .comment-play-btn class as <pgn-player> so it gets the same
       circular replay-icon styling. Placed inside captionEl so it
       sits at the bottom-right of the comment area. */
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
    if (captionEl) {
      captionEl.style.position = "relative";
      captionEl.appendChild(refreshBtn);
    }

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

    /* Replay the puzzle from scratch (shown only once solved). */
    function handleRefresh() {
      if (state.solved && container.reset) {
        container.reset();
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
        function (e) {
          e.stopImmediatePropagation();
          e.preventDefault();
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
      /* Badge after the animation completes (position is animated). */
      setTimeout(function () { showBadgeForMove(state.index - 1); }, ANIM_MS);
      dispatchMoveEvent(state.index);

      setTimeout(function () {
        state.locked = false;
      }, ANIM_MS);
    }

    /* If the move the user just played matches the first move of any
       variation near the current position, return that variation.
       We check both state.index and state.index + 1 because PGN
       authors commonly place the variation after the opponent's reply
       (e.g.  1. Re2! e4 (1. Re1? …)  — the variation is syntactically
       after e4 but semantically an alternative to Re2). */
    function matchVariationFirstMove(userSan) {
      var norm = normalizeSAN(userSan);
      var indicesToCheck = [state.index, state.index + 1];
      for (var ci = 0; ci < indicesToCheck.length; ci++) {
        var vars = variations[indicesToCheck[ci]];
        if (!vars || !vars.length) continue;
        for (var vi = 0; vi < vars.length; vi++) {
          var v = vars[vi];
          if (v && v.moves && v.moves.length &&
              normalizeSAN(v.moves[0]) === norm) {
            return v;
          }
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

        /* Wrong move — undo and shake. */
        state.game.undo();
        board.position(state.game.fen(), false);
        boardDiv.classList.remove("jc-shake");
        void boardDiv.offsetWidth;
        boardDiv.classList.add("jc-shake");

        /* If a variation matched, collect all its comments and display
           them in the caption so the solver sees the instructive line
           even though the move is rejected. */
        if (matchedVar && captionEl) {
          var allComments = (matchedVar.comments || []).filter(Boolean);
          if (allComments.length) {
            captionEl.innerHTML = formatComment(allComments.join(" "));
          }
        }

        return "snapback";
      }

      state.index++;
      board.position(state.game.fen(), false);
      setCaptionForMoveIndex(state.index - 1);
      requestAnimationFrame(function () { showBadgeForMove(state.index - 1); });
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
        setTimeout(function () { showBadgeForMove(0); }, ANIM_MS);
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
      glyphs: parsed.glyphs || [],
      captionEl: cfg.captionEl || null,
      initialCaption: cfg.initialCaption || "",
    },
  );
}