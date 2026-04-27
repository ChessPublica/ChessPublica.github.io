/**
 * ChessPublica — Puzzle System
 *
 * Sections:
 *   1. Puzzle Engine     — renderLocalPuzzle() (interactive drag-and-drop)
 */

import { PIECE_THEME, normalizeSAN, parseGame, toFigurine, formatComment, formatCommentClickable, getDestinationSquare, renderMoveQualityBadge, clearMoveQualityBadge } from "./helpers.js";
import { renderAnnotations, clearAnnotations, makeBoardResizable } from "./board.js";

/* ================================================================
   1. PUZZLE ENGINE
================================================================ */

var ANIM_MS = 250;

/**
 * Build ready-to-set innerHTML for a variation caption by interleaving
 * clickable move spans between the prose comment fragments.
 *
 * The variation's `comments` array is keyed by move index: comments[0]
 * is the prose attached to the variation's first move (already on the
 * board), comments[N] is prose attached to move N.  Moves between
 * comment fragments are emitted as .cp-inline-move spans so the reader
 * sees and can click:
 *   "…after <span>1... e4</span> <span>2. ♔e7</span> … and manages to draw."
 *
 * Prose parts go through formatComment() so markdown / figurines are
 * applied but NO extra SAN spans are introduced (formatComment does not
 * call _wrapInlineSanMoves).  This means wireInlineMoveClicks() will
 * find only the spans we explicitly build here — the actual variation
 * moves — and never accidentally pick up SAN tokens mentioned in prose
 * (e.g. "Re1?" in the comment text).
 *
 * @param {Object}  varObj    parsed variation { moves, comments }
 * @param {string}  startFen  FEN immediately after the variation's first
 *                            move has been played on the board
 * @returns {string} HTML string ready for element.innerHTML
 */
function buildVariationComment(varObj, startFen) {
  var moves    = varObj.moves    || [];
  var comments = varObj.comments || [];

  var htmlParts = [];

  /* Prose comment attached to the variation's first move (already played). */
  if (comments[0]) htmlParts.push(formatComment(comments[0]));

  /* Walk remaining moves (index 1+), building explicitly clickable spans.
     data-san carries the raw SAN that chess.js understands; the visible
     label uses figurine notation and a move-number prefix. */
  if (moves.length > 1) {
    var chess        = new Chess(startFen);
    var moveParts    = [];
    var prevWasWhite = false;

    for (var i = 1; i < moves.length; i++) {
      var fenParts = chess.fen().split(" ");
      var turn     = fenParts[1];           /* 'w' | 'b' */
      var fullMove = parseInt(fenParts[5], 10);

      if (!chess.move(moves[i], { sloppy: true })) break;

      var label;
      if (turn === "w") {
        label        = fullMove + ". " + toFigurine(moves[i]);
        prevWasWhite = true;
      } else {
        /* Black: show "N..." only when not immediately after White. */
        label        = prevWasWhite
          ? toFigurine(moves[i])
          : fullMove + "... " + toFigurine(moves[i]);
        prevWasWhite = false;
      }

      moveParts.push(
        '<span class="cp-inline-move" data-san="' + moves[i] + '">' + label + "</span>"
      );

      /* Flush accumulated spans whenever a prose comment follows this move. */
      if (comments[i]) {
        htmlParts.push(moveParts.join(" "));
        htmlParts.push(formatComment(comments[i]));
        moveParts    = [];
        prevWasWhite = false;   /* next Black move after a break needs "N..." */
      }
    }

    if (moveParts.length) htmlParts.push(moveParts.join(" "));
  }

  return htmlParts.join(" ");
}

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
  var pgnArrows = opts.arrows || [];
  var pgnSquareMarks = opts.squareMarks || [];
  var captionEl = opts.captionEl || null;
  var initialCaption = opts.initialCaption || "";

  /* The text slot lives inside captionEl as a sibling of the refresh
     button, so rewriting its innerHTML never wipes the button. It is
     populated by createPuzzleBoard and reassigned on each reset. */
  var captionTextEl = null;

  /* Write a per-move comment into the caption slot. When no comment
     exists for the given move the caption is cleared (per spec: the
     initial caption is shown only before the first move; after that,
     only move comments appear). */
  function setCaptionForMoveIndex(moveIndex) {
    if (!captionTextEl) return;
    var cm = comments[moveIndex];
    if (cm) {
      captionTextEl.innerHTML = formatComment(cm);
    } else {
      captionTextEl.textContent = "";
    }
  }

  function resetCaption() {
    if (!captionTextEl) return;
    captionTextEl.innerHTML = initialCaption ? formatComment(initialCaption) : "";
  }

  function setCaptionHTML(html) {
    if (!captionTextEl) return;
    captionTextEl.innerHTML = html;
  }

  /* Show a move-quality badge on the destination square of the move
     at the given index.  The boardDiv reference is captured from the
     closure inside createPuzzleBoard. */
  var _boardDivRef = null;
  var _boardWrapRef = null;

  /* Track what the SVG/badge overlays currently show so a resize can
     re-derive their positions from the squares' new pixel coordinates.
     Updated through setOverlayAnnotations / setOverlayBadge wrappers
     instead of calling render/clear directly. */
  var _currentAnnotations = null;
  var _currentBadge = null;
  /* ResizeObserver for the active board. Lives at this outer scope so
     a reset (which builds a fresh board) can disconnect the previous
     observer before installing a new one. */
  var _resizeObserver = null;

  function setOverlayAnnotations(annotations) {
    if (!_boardDivRef) return;
    var hasAny = annotations && (
      (annotations.arrows && annotations.arrows.length) ||
      (annotations.squareMarks && annotations.squareMarks.length)
    );
    if (hasAny) {
      _currentAnnotations = annotations;
      renderAnnotations(_boardDivRef, annotations, _boardWrapRef);
    } else {
      _currentAnnotations = null;
      clearAnnotations(_boardDivRef, _boardWrapRef);
    }
  }

  function setOverlayBadge(square, glyph) {
    if (!_boardDivRef) return;
    if (square && glyph) {
      _currentBadge = { square: square, glyph: glyph };
      renderMoveQualityBadge(_boardDivRef, square, glyph);
    } else {
      _currentBadge = null;
      clearMoveQualityBadge(_boardDivRef);
    }
  }

  function redrawOverlay() {
    if (!_boardDivRef) return;
    if (_currentAnnotations) {
      renderAnnotations(_boardDivRef, _currentAnnotations, _boardWrapRef);
    } else {
      clearAnnotations(_boardDivRef, _boardWrapRef);
    }
    if (_currentBadge) {
      renderMoveQualityBadge(_boardDivRef, _currentBadge.square, _currentBadge.glyph);
    } else {
      clearMoveQualityBadge(_boardDivRef);
    }
  }

  function showBadgeForMove(moveIndex) {
    if (!_boardDivRef) return;
    var glyph = pgnGlyphs[moveIndex];
    if (!glyph) {
      setOverlayBadge(null, null);
      return;
    }
    var san = moves[moveIndex];
    /* The color that played this move: after the move, the turn flips,
       so the mover is the opposite of the current turn. But we can
       also derive it from the move index and the starting side. */
    var startTurn = fen.split(" ")[1] || "w";
    var color = (moveIndex % 2 === 0) ? startTurn : (startTurn === "w" ? "b" : "w");
    var square = getDestinationSquare(san, color);
    setOverlayBadge(square, glyph);
  }

  /* Draw the coloured squares / arrows attached to the move at the
     given index (from [%csl …] / [%cal …] annotations inside its PGN
     comment).  When the move has no annotations the overlay is
     cleared, so stale arrows from a previous move don't linger. */
  function showAnnotationsForMove(moveIndex) {
    if (!_boardDivRef) return;
    var arrows = pgnArrows[moveIndex];
    var squareMarks = pgnSquareMarks[moveIndex];
    setOverlayAnnotations({
      arrows: arrows || [],
      squareMarks: squareMarks || [],
    });
  }

  function createPuzzleBoard() {
    container.innerHTML = "";

    /* Tear down any previous board's resize observer before building a
       fresh board (reset / first move auto). The old observer would
       otherwise hang on to the detached boardDiv. */
    if (_resizeObserver) {
      _resizeObserver.disconnect();
      _resizeObserver = null;
    }
    _currentAnnotations = null;
    _currentBadge = null;

    /* Wrap the board in a positioned container so the round replay
       button can sit over its bottom-right corner, matching the
       pgn-player style. .cp-board-wrapper already declares
       position:relative + the same max-width as .cp-board. */
    var boardWrap = document.createElement("div");
    boardWrap.className = "cp-board-wrapper";
    container.appendChild(boardWrap);

    var boardDiv = document.createElement("div");
    boardDiv.className = "cp-board";
    boardDiv.style.position = "relative";
    _boardDivRef = boardDiv;
    _boardWrapRef = boardWrap;
    /* The wrapper already supplies the 1rem auto margin .cp-board uses
       on its own, so zero it here to avoid doubling the vertical gap. */
    boardDiv.style.margin = "0";
    boardWrap.appendChild(boardDiv);

    /* Refresh button — hidden by default. Shown once the puzzle is
       solved, or after a variation first-move is accepted (both act
       as "replay the puzzle"). Uses the same .comment-play-btn class
       as <pgn-player> so it gets the same circular replay-icon
       styling. Placed inside captionEl as a sibling of the inner text
       div so rewriting the text's innerHTML never removes the button. */
    var refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "comment-play-btn cp-puzzle-refresh";
    refreshBtn.setAttribute("aria-label", "Reset puzzle");
    refreshBtn.title = "Reset puzzle";
    refreshBtn.innerHTML = '<span class="lucide-icon" style="--icon:url(https://unpkg.com/lucide-static@1.8.0/icons/rotate-ccw.svg)"></span>';
    refreshBtn.style.display = "none";
    refreshBtn.addEventListener("click", function () {
      handleRefresh();
    });
    if (captionEl) {
      captionEl.innerHTML = "";
      captionEl.style.position = "relative";
      captionTextEl = document.createElement("div");
      captionTextEl.className = "cp-puzzle-caption-text";
      captionEl.appendChild(captionTextEl);
      captionEl.appendChild(refreshBtn);
    } else {
      captionTextEl = null;
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
      /* When a side-line variation is triggered, the engine switches
         into free-play mode: drag-and-drop accepts any legal move for
         either side, and inline SAN tokens in the comment become
         clickable to replay the instructive line. */
      freePlay: false,
      variationStartFen: null,
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
        new CustomEvent("cp-puzzle-move", {
          detail: { index: index },
          bubbles: true,
        }),
      );
    }

    /* Attach click handlers to every .cp-inline-move span in the
       caption.  Clicking a span replays the variation from its start
       position up to and including that move, so the reader can walk
       through the instructive line one move at a time without having
       to drag pieces.  The active span is marked with .active for
       visual feedback. */
    function wireInlineMoveClicks() {
      if (!captionTextEl) return;
      var spans = captionTextEl.querySelectorAll(".cp-inline-move[data-san]");
      if (!spans.length) return;

      var sequence = [];
      for (var s = 0; s < spans.length; s++) sequence.push(spans[s].dataset.san);

      spans.forEach(function (span, idx) {
        span.addEventListener("click", function () {
          if (!state.variationStartFen) return;
          state.game.load(state.variationStartFen);
          for (var j = 0; j <= idx; j++) {
            var mv = state.game.move(sequence[j], { sloppy: true });
            if (!mv) {
              console.error("Illegal inline variation move:", sequence[j]);
              state.game.load(state.variationStartFen);
              board.position(state.game.fen(), true);
              return;
            }
          }
          board.position(state.game.fen(), true);
          setOverlayAnnotations(null);
          setOverlayBadge(null, null);
          clearActiveInlineMove();
          span.classList.add("active");
        });
      });
    }

    function clearActiveInlineMove() {
      if (!captionTextEl) return;
      var active = captionTextEl.querySelectorAll(".cp-inline-move.active");
      for (var a = 0; a < active.length; a++) active[a].classList.remove("active");
    }

    /* Replay the puzzle from scratch. Called when the user clicks
       the replay button — shown after solving, or after playing a
       variation first-move (which is treated as a dead end). */
    function handleRefresh() {
      if (container.reset) container.reset();
    }

    function finishSolved() {
      state.solved = true;
      board.position(state.game.fen(), false);
      boardDiv.classList.remove("cp-fire-once");
      boardDiv.classList.add("cp-fire-solved");
      /* Append the solved banner on its own line without wiping the
         last move's comment (if any). */
      if (captionTextEl) {
        var existing = captionTextEl.innerHTML.trim();
        var solved = "\uD83C\uDFC6 Puzzle solved!";
        captionTextEl.innerHTML = existing
          ? existing + "<br>" + solved
          : solved;
      }
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
      /* Badge + annotations after the animation completes (position is
         animated and we want arrows to settle on the final squares). */
      setTimeout(function () {
        showBadgeForMove(state.index - 1);
        showAnnotationsForMove(state.index - 1);
      }, ANIM_MS);
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
      /* In free-play mode (entered after a side-line variation is
         triggered) accept any legal move for either side. The board
         becomes an exploration sandbox until the user hits replay. */
      if (state.freePlay && !state.solved) {
        var fpMove = state.game.move({ from: from, to: to, promotion: "q" });
        if (!fpMove) return "snapback";
        board.position(state.game.fen(), false);
        setOverlayAnnotations(null);
        setOverlayBadge(null, null);
        clearActiveInlineMove();
        return true;
      }

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
          /* Accept the variation move and enter free-play mode: leave
             the move on the board, shake to signal "wrong solution",
             render the variation's quality badge (e.g. the "?" on
             Re1?), show the comment with clickable SAN tokens, and
             reveal the replay button. */
          board.position(state.game.fen(), false);

          /* Shake — the user didn't play the puzzle's solution. */
          boardDiv.classList.remove("cp-shake");
          void boardDiv.offsetWidth;
          boardDiv.classList.add("cp-shake");

          state.freePlay = true;
          state.locked = false;
          state.variationStartFen = state.game.fen();

          if (captionTextEl) {
            captionTextEl.innerHTML = buildVariationComment(matchedVar, state.variationStartFen);
            wireInlineMoveClicks();
          }

          /* Render the variation first-move quality glyph ("?", "??",
             "!?", etc.) on its destination square, and any [%csl …] /
             [%cal …] annotations attached to that first move. */
          requestAnimationFrame(function () {
            var varGlyph = (matchedVar.glyphs && matchedVar.glyphs[0]) || null;
            setOverlayBadge(varGlyph ? move.to : null, varGlyph);

            var varArrows = (matchedVar.arrows && matchedVar.arrows[0]) || null;
            var varMarks = (matchedVar.squareMarks && matchedVar.squareMarks[0]) || null;
            setOverlayAnnotations({
              arrows: varArrows || [],
              squareMarks: varMarks || [],
            });
          });

          showRefreshButton();
          return true;
        }

        /* Wrong move — undo and shake. */
        state.game.undo();
        board.position(state.game.fen(), false);
        boardDiv.classList.remove("cp-shake");
        void boardDiv.offsetWidth;
        boardDiv.classList.add("cp-shake");

        return "snapback";
      }

      state.index++;
      board.position(state.game.fen(), false);
      setCaptionForMoveIndex(state.index - 1);
      requestAnimationFrame(function () {
        showBadgeForMove(state.index - 1);
        showAnnotationsForMove(state.index - 1);
      });
      dispatchMoveEvent(state.index);

      boardDiv.classList.remove("cp-fire-once");
      requestAnimationFrame(function () {
        boardDiv.classList.add("cp-fire-once");
      });

      setTimeout(function () {
        if (!state.solved) boardDiv.classList.remove("cp-fire-once");
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

    /* Re-fit the inner board and re-draw the SVG overlay + NAG badge
       whenever the .cp-board container changes width (e.g. crossing
       the mobile breakpoint). chessboard.js doesn't auto-resize, so
       without this the squares would stay at their original pixel
       size and the annotations would no longer line up. */
    _resizeObserver = makeBoardResizable(boardDiv, board, redrawOverlay);

    if (autoFirstMove) {
      var mv = state.game.move(moves[0], { sloppy: true });
      if (mv) {
        board.position(state.game.fen(), true);
        state.index = 1;
        state.solverSide = state.game.turn();
        setCaptionForMoveIndex(0);
        setTimeout(function () {
          showBadgeForMove(0);
          showAnnotationsForMove(0);
        }, ANIM_MS);
      }
    }
  }

  createPuzzleBoard();

  container.reset = function () {
    createPuzzleBoard();
    container.dispatchEvent(
      new CustomEvent("cp-puzzle-reset", { bubbles: true }),
    );
  };
}

export function createPuzzle(el, cfg) {
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
      arrows: parsed.arrows || [],
      squareMarks: parsed.squareMarks || [],
      captionEl: cfg.captionEl || null,
      initialCaption: cfg.initialCaption || "",
    },
  );
}