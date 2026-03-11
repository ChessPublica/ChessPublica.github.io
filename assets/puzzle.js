/**
 * JekyllChess — Puzzle System
 *
 * Merged from: puzzle-engine.js, puzzle-block.js, puzzle-rush.js
 *
 * Sections:
 *   1. Puzzle Engine     — renderLocalPuzzle() (interactive drag-and-drop)
 *   2. Puzzle Block      — renderPuzzleBlock() (multi-puzzle from PGN)
 *   3. Puzzle Rush       — renderPuzzleRush() (sequential puzzle rush)
 */

import { PIECE_THEME, fetchText, normalizeSAN, splitIntoPgnGames, parseGame } from "./helpers.js";
import { parseHeaders } from "./pgn.js";

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

/* ================================================================
   2. PUZZLE BLOCK
================================================================ */

function stripPgnHeaders(pgn) {
  return pgn.replace(/(?:\[[^\]]+\]\s*)+/g, "").trim();
}

function extractAllComments(pgn) {
  var body = stripPgnHeaders(pgn);
  var matches = body.match(/\{([\s\S]*?)\}/g) || [];
  return matches.map(function (c) {
    return c.replace(/^\{|\}$/g, "").trim();
  });
}

function resolveSource(node) {
  var attrSrc = node.getAttribute("src");
  if (attrSrc) {
    return { type: "url", value: new URL(attrSrc, location.href).href };
  }

  var text = (node.textContent || "").trim();
  var match = text.match(/PGN:\s*["']?([^"'\s]+)["']?/i);
  if (match) {
    return { type: "url", value: new URL(match[1], location.href).href };
  }

  if (text.startsWith("[")) {
    return { type: "inline", value: text };
  }

  return null;
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
  );
}

export function renderPuzzleBlock(node) {
  if (node.dataset.jcRendered === "1") return;
  node.dataset.jcRendered = "1";

  var source = resolveSource(node);
  if (!source) {
    node.textContent = "No PGN source found.";
    return;
  }

  node.textContent = "Loading puzzles…";

  function processText(text) {
    var games = splitIntoPgnGames(text);
    node.innerHTML = "";

    games.forEach(function (g) {
      var headers = parseHeaders(g);
      var allComments = extractAllComments(g);

      var wrap = document.createElement("div");
      wrap.className = "jc-puzzle-item";
      node.appendChild(wrap);

      /* META HEADER */
      var metaDiv = document.createElement("div");
      metaDiv.className = "jc-puzzle-meta";

      var emojiDiv = document.createElement("div");
      emojiDiv.className = "jc-puzzle-meta-emoji";
      emojiDiv.textContent = "🧩";
      metaDiv.appendChild(emojiDiv);

      var textDiv = document.createElement("div");
      textDiv.className = "jc-puzzle-meta-text";

      var white = headers.White || "";
      var black = headers.Black || "";

      var line1El = document.createElement("div");
      line1El.className = "jc-puzzle-meta-line1";
      line1El.textContent =
        white && black ? white + " - " + black : white || black || "Puzzle";
      textDiv.appendChild(line1El);

      var line2El = document.createElement("div");
      line2El.className = "jc-puzzle-meta-line2";
      line2El.textContent = headers.Event || headers.Variant || "";
      textDiv.appendChild(line2El);

      metaDiv.appendChild(textDiv);
      wrap.appendChild(metaDiv);

      /* BOARD */
      var boardDiv = document.createElement("div");
      boardDiv.className = "jc-board";
      wrap.appendChild(boardDiv);

      /* MOVE COMMENT */
      var moveCommentDiv = document.createElement("div");
      moveCommentDiv.className = "jc-puzzle-move-comment";
      wrap.appendChild(moveCommentDiv);

      jcPuzzleCreate(boardDiv, { rawPGN: g });
      moveCommentDiv.textContent = allComments[0] || "";

      wrap.addEventListener("jc-puzzle-move", function (e) {
        var moveIndex = e.detail.index;
        if (moveIndex < allComments.length) {
          moveCommentDiv.textContent = allComments[moveIndex] || "";
        }
      });

      wrap.addEventListener("jc-puzzle-reset", function () {
        moveCommentDiv.textContent = allComments[0] || "";
      });
    });
  }

  if (source.type === "url") {
    fetchText(source.value)
      .then(processText)
      .catch(function (err) {
        node.textContent = "Failed to load puzzle file: " + err.message;
      });
  }

  if (source.type === "inline") {
    processText(source.value);
  }
}

/* ================================================================
   3. PUZZLE RUSH
================================================================ */

var RUSH_KEY = "jekyllchess_puzzle_rush_index";

export function renderPuzzleRush(container, url) {
  container.textContent = "Loading...";

  fetchText(url)
    .then(function (text) {
      var puzzles = splitIntoPgnGames(text)
        .map(parseGame)
        .filter(function (p) { return !p.error; });

      var idx = parseInt(localStorage.getItem(RUSH_KEY), 10) || 0;

      container.innerHTML = "";
      var holder = document.createElement("div");
      holder.className = "puzzle-rush-wrap";
      container.appendChild(holder);

      var counterDiv = document.createElement("div");
      counterDiv.className = "puzzle-rush-counter";
      holder.appendChild(counterDiv);

      function updateCounter() {
        counterDiv.textContent =
          "Puzzle " + Math.min(idx + 1, puzzles.length) + " / " + puzzles.length;
      }

      function loadNext() {
        if (!puzzles[idx]) {
          localStorage.removeItem(RUSH_KEY);
          holder.innerHTML =
            "<div class='jc-finished'>All puzzles completed ✔</div>";
          return;
        }

        updateCounter();

        var fenParts = puzzles[idx].fen.split(" ");
        var solverSide = fenParts[1] === "w" ? "b" : "w";
        var orientation = solverSide === "w" ? "white" : "black";

        renderLocalPuzzle(
          holder,
          puzzles[idx].fen,
          puzzles[idx].moves,
          true,
          false,
          function () {
            idx++;
            localStorage.setItem(RUSH_KEY, idx);
            var boards = holder.querySelectorAll(".jc-board");
            boards.forEach(function (b) { b.remove(); });
            requestAnimationFrame(loadNext);
          },
          orientation,
          null,
          true,
        );
      }

      loadNext();
    })
    .catch(function () {
      container.textContent = "Failed to load PGN.";
    });
}