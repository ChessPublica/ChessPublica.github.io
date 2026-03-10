/* PUZZLE SYSTEM — Helpers */

  function stripFigurines(s) {
    return String(s || "").replace(/[♔♕♖♗♘♙♚♛♜♝♞♟]/g, "");
  }

  function normalizePuzzleText(s) {
    return String(s || "")
      .replace(/\r/g, "")
      .replace(/\n+/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\s*:\s*/g, ": ")
      .trim();
  }

  function normalizeSAN(s) {
    return String(s || "")
      .replace(/[+#?!]/g, "")
      .replace(/0-0-0/g, "O-O-O")
      .replace(/0-0/g, "O-O")
      .trim();
  }

  function splitIntoPgnGames(text) {
    return String(text || "")
      .replace(/\r/g, "")
      .trim()
      .split(/\n\s*\n(?=\s*\[)/)
      .filter(Boolean);
  }

  function tokenizeMoves(text) {
    var s = String(text || "");
    s = s.replace(/\{[\s\S]*?\}/g, " ");
    s = s.replace(/;[^\n]*/g, " ");
    while (/\([^()]*\)/.test(s)) {
      s = s.replace(/\([^()]*\)/g, " ");
    }
    s = s.replace(/\$\d+/g, " ");
    s = s.replace(/\d+\.(\.\.)?/g, " ");
    s = s.replace(/\s+/g, " ").trim();

    return s
      .split(" ")
      .map(function (t) {
        return t.trim();
      })
      .filter(function (t) {
        return t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t);
      });
  }

  function parseGame(pgn) {
    var raw = String(pgn || "")
      .replace(/\r/g, "")
      .trim();
    if (!raw) return { error: true };

    function getHeader(name) {
      var m = raw.match(new RegExp("\\[" + name + '\\s+"([^"]+)"\\]', "i"));
      return m ? m[1] : null;
    }

    var fen = getHeader("FEN");
    var firstMoveAuto =
      String(getHeader("FirstMoveAuto")).toLowerCase() === "true";
    var orientationHeader = String(getHeader("Orientation")).toLowerCase();

    var orientation = null;
    if (orientationHeader === "white") orientation = "white";
    if (orientationHeader === "black") orientation = "black";

    /* Colon format */
    if (!fen) {
      var collapsed = raw.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
      var fenMatch = collapsed.match(/FEN:\s*(.*?)\s+Moves:/i);
      var movesMatch = collapsed.match(/Moves:\s*(.*)$/i);

      if (fenMatch && movesMatch) {
        fen = fenMatch[1].trim();
        var moves = tokenizeMoves(movesMatch[1]);
        if (!moves.length) return { error: true };
        return {
          fen: fen,
          moves: moves,
          firstMoveAuto: false,
          orientation: null,
        };
      }
    }

    /* Header style */
    var lines = raw.split("\n");
    var moveLines = lines.filter(function (line) {
      return !/^\s*\[[^\]]+\]\s*$/.test(line);
    });
    var moveText = moveLines.join(" ").trim();
    var moves2 = tokenizeMoves(moveText);

    if (!moves2.length) return { error: true };
    if (!fen) fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    return {
      fen: fen,
      moves: moves2,
      firstMoveAuto: firstMoveAuto,
      orientation: orientation,
    };
  }

  /* ================================================================
     LOCAL PUZZLE ENGINE
  ================================================================ */

  var ANIM_MS = 250;

  function renderLocalPuzzle(
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

  /* ================================================================
     JCPUZZLE GLOBAL ADAPTER
  ================================================================ */

  function jcPuzzleCreate(el, cfg) {
    var raw = cfg.rawPGN || "";
    var parsed = parseGame(raw);
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

  /* ================================================================
     PUZZLE-BLOCK RENDERER
  ================================================================ */

  function splitIntoPgnBlocks(text) {
    return String(text || "")
      .replace(/\r/g, "")
      .trim()
      .split(/\n\s*\n(?=\[)/)
      .filter(Boolean);
  }

  function stripPgnHeaders(pgn) {
    return pgn.replace(/(?:\[[^\]]+\]\s*)+/g, "").trim();
  }

  function extractPgnHeaders(pgn) {
    var headers = {};
    var regex = /\[(\w+)\s+"([^"]*)"\]/g;
    var match;
    while ((match = regex.exec(pgn))) {
      headers[match[1]] = match[2];
    }
    return headers;
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

  function renderPuzzleBlock(node) {
    if (node.dataset.jcRendered === "1") return;
    node.dataset.jcRendered = "1";

    var source = resolveSource(node);
    if (!source) {
      node.textContent = "No PGN source found.";
      return;
    }

    node.textContent = "Loading puzzles…";

    function processText(text) {
      var games = splitIntoPgnBlocks(text);
      node.innerHTML = "";

      games.forEach(function (g) {
        var headers = extractPgnHeaders(g);
        var allComments = extractAllComments(g);

        var wrap = document.createElement("div");
        wrap.className = "jc-puzzle-item";
        node.appendChild(wrap);

        /* META HEADER */
        var metaDiv = document.createElement("div");
        metaDiv.className = "jc-puzzle-meta";

        var white = headers.White || "";
        var black = headers.Black || "";
        var line1 =
          white && black ? white + " - " + black : white || black || "Puzzle";
        var line2 = headers.Event || headers.Variant || "";

        metaDiv.innerHTML =
          '<div class="jc-puzzle-meta-emoji">🧩</div>' +
          '<div class="jc-puzzle-meta-text">' +
          '<div class="jc-puzzle-meta-line1">' +
          line1 +
          "</div>" +
          '<div class="jc-puzzle-meta-line2">' +
          line2 +
          "</div>" +
          "</div>";
        wrap.appendChild(metaDiv);

        /* BOARD */
        var boardDiv = document.createElement("div");
        boardDiv.className = "jc-board";
        wrap.appendChild(boardDiv);

        /* MOVE COMMENT */
        var moveCommentDiv = document.createElement("div");
        moveCommentDiv.className = "jc-puzzle-move-comment";
        wrap.appendChild(moveCommentDiv);

        function renderText(target, text) {
          target.textContent = text || "";
        }

        jcPuzzleCreate(boardDiv, { rawPGN: g });
        renderText(moveCommentDiv, allComments[0]);

        wrap.addEventListener("jc-puzzle-move", function (e) {
          var moveIndex = e.detail.index;
          if (moveIndex < allComments.length) {
            renderText(moveCommentDiv, allComments[moveIndex]);
          }
        });

        wrap.addEventListener("jc-puzzle-reset", function () {
          renderText(moveCommentDiv, allComments[0]);
        });
      });
    }

    if (source.type === "url") {
      fetch(source.value, { cache: "no-store" })
        .then(function (r) {
          return r.text();
        })
        .then(processText)
        .catch(function (err) {
          node.textContent = "Failed to load puzzle file: " + err.message;
        });
    }

    if (source.type === "inline") {
      processText(source.value);
    }
  }
