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
(function () {
  "use strict";

  /* ================================================================
     CONFIGURATION
  ================================================================ */

  const PIECE_THEME =
    "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png";
  const NBSP = "\u00A0";

  /* ================================================================
     FIGURINE — Convert SAN to figurine notation
  ================================================================ */

  const FIGURINES = {
    K: "♔",
    Q: "♕",
    R: "♖",
    B: "♗",
    N: "♘",
  };

  function toFigurine(san) {
    if (!san) return san;
    let result = san;
    const firstChar = san.charAt(0);
    if (FIGURINES[firstChar]) {
      result = FIGURINES[firstChar] + san.slice(1);
    }
    result = result.replace(/=([KQRBN])/g, function (_, piece) {
      return "=" + FIGURINES[piece];
    });
    return result;
  }

  /* ================================================================
     BOARD — Board creation + SVG annotation overlay
  ================================================================ */

  function createBoard(container, fen, moveNode) {
    var wrapper = document.createElement("div");
    wrapper.className = "jc-board-wrapper";

    var boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";

    wrapper.appendChild(boardDiv);
    container.appendChild(wrapper);

    requestAnimationFrame(function () {
      Chessboard(boardDiv, {
        position: fen,
        pieceTheme: PIECE_THEME,
      });
      initOverlay(wrapper, boardDiv, moveNode);
    });
  }

  function initOverlay(wrapper, boardDiv, moveNode) {
    var size = boardDiv.getBoundingClientRect().width;

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("jc-overlay");
    svg.setAttribute("width", size);
    svg.setAttribute("height", size);
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);

    wrapper.appendChild(svg);

    if (!moveNode) return;

    if (moveNode.squareMarks) {
      moveNode.squareMarks.forEach(function (mark) {
        drawCircle(svg, boardDiv, mark.square, mark.color);
      });
    }

    if (moveNode.arrows) {
      moveNode.arrows.forEach(function (arrow) {
        drawArrow(svg, boardDiv, arrow.from, arrow.to, arrow.color);
      });
    }
  }

  function getSquareCenter(boardDiv, square) {
    if (!boardDiv.__squareCache) {
      boardDiv.__squareCache = {};
      boardDiv.querySelectorAll("[data-square]").forEach(function (el) {
        boardDiv.__squareCache[el.dataset.square] = el;
      });
    }

    var squareEl = boardDiv.__squareCache[square];
    if (!squareEl) return null;

    var boardRect = boardDiv.getBoundingClientRect();
    var rect = squareEl.getBoundingClientRect();

    return {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height / 2,
      size: rect.width,
    };
  }

  function lichessColor(code, alpha) {
    if (alpha === undefined) alpha = 0.35;
    var colors = {
      R: [255, 0, 0],
      Y: [255, 170, 0],
      G: [0, 170, 0],
      B: [0, 0, 255],
    };
    var rgb = colors[code] || colors.R;
    return (
      "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", " + alpha + ")"
    );
  }

  function drawCircle(svg, boardDiv, square, color) {
    var center = getSquareCenter(boardDiv, square);
    if (!center) return;

    var strokeWidth = center.size * 0.09;
    var radius = center.size / 2 - strokeWidth / 2;

    var circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    circle.setAttribute("cx", center.x);
    circle.setAttribute("cy", center.y);
    circle.setAttribute("r", radius);
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke", lichessColor(color));
    circle.setAttribute("stroke-width", strokeWidth);

    svg.appendChild(circle);
  }

  function drawArrow(svg, boardDiv, fromSquare, toSquare, color) {
    var start = getSquareCenter(boardDiv, fromSquare);
    var end = getSquareCenter(boardDiv, toSquare);

    if (!start || !end) return;

    var dx = end.x - start.x;
    var dy = end.y - start.y;

    var angle = Math.atan2(dy, dx);
    var length = Math.sqrt(dx * dx + dy * dy);

    var bodyWidth = start.size * 0.16;
    var headWidth = bodyWidth * 3.5;
    var headLength = start.size * 0.6;
    var bodyLength = length - headLength;

    var sin = Math.sin(angle);
    var cos = Math.cos(angle);
    var halfBody = bodyWidth / 2;
    var halfHead = headWidth / 2;

    var p1x = start.x + halfBody * sin;
    var p1y = start.y - halfBody * cos;
    var p2x = start.x - halfBody * sin;
    var p2y = start.y + halfBody * cos;

    var baseX = start.x + bodyLength * cos;
    var baseY = start.y + bodyLength * sin;

    var p3x = baseX - halfBody * sin;
    var p3y = baseY + halfBody * cos;
    var p7x = baseX + halfBody * sin;
    var p7y = baseY - halfBody * cos;

    var p4x = baseX - halfHead * sin;
    var p4y = baseY + halfHead * cos;
    var p6x = baseX + halfHead * sin;
    var p6y = baseY - halfHead * cos;

    var p5x = end.x;
    var p5y = end.y;

    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    var d =
      "M " +
      p1x +
      " " +
      p1y +
      " L " +
      p2x +
      " " +
      p2y +
      " L " +
      p3x +
      " " +
      p3y +
      " L " +
      p4x +
      " " +
      p4y +
      " L " +
      p5x +
      " " +
      p5y +
      " L " +
      p6x +
      " " +
      p6y +
      " L " +
      p7x +
      " " +
      p7y +
      " Z";

    path.setAttribute("d", d);
    path.setAttribute("fill", lichessColor(color));

    svg.appendChild(path);
  }

  /* ================================================================
     PGN PARSER — Tokenizer
  ================================================================ */

  function parsePGN(pgnText) {
    var movetext = extractMovetext(pgnText);
    return tokenize(movetext);
  }

  function tokenize(text) {
    var tokens = [];
    var i = 0;

    while (i < text.length) {
      /* COMMENT */
      if (text[i] === "{") {
        var depth = 1;
        var j = i + 1;
        while (depth > 0 && j < text.length) {
          if (text[j] === "{") depth++;
          if (text[j] === "}") depth--;
          j++;
        }
        tokens.push({
          type: "comment",
          value: text.slice(i + 1, j - 1).trim(),
        });
        i = j;
        continue;
      }

      /* VARIATION */
      if (text[i] === "(") {
        var depth2 = 1;
        var j2 = i + 1;
        while (depth2 > 0 && j2 < text.length) {
          if (text[j2] === "(") depth2++;
          if (text[j2] === ")") depth2--;
          j2++;
        }
        tokens.push({
          type: "variation",
          value: tokenize(text.slice(i + 1, j2 - 1)),
        });
        i = j2;
        continue;
      }

      var nagMatch = text.slice(i).match(/^\$\d+/);
      if (nagMatch) {
        tokens.push({ type: "nag", value: nagMatch[0] });
        i += nagMatch[0].length;
        continue;
      }

      /* RESULT — must be checked BEFORE move number, because "1-0" starts with "1" */
      var resultMatch = text.slice(i).match(/^(1-0|0-1|1\/2-1\/2|\*)/);
      if (resultMatch) {
        tokens.push({ type: "result", value: resultMatch[0] });
        i += resultMatch[0].length;
        continue;
      }

      var moveNumberMatch = text.slice(i).match(/^\d+(\.\.\.?)?\.?/);
      if (moveNumberMatch) {
        tokens.push({ type: "moveNumber", value: moveNumberMatch[0] });
        i += moveNumberMatch[0].length;
        continue;
      }

      var moveMatch = text
        .slice(i)
        .match(
          /^(?:O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|[a-h][1-8])[\+#]?/,
        );
      if (moveMatch) {
        tokens.push({ type: "move", value: moveMatch[0] });
        i += moveMatch[0].length;
        continue;
      }

      i++;
    }

    return tokens;
  }

  function extractMovetext(pgnText) {
    return pgnText.split(/\n\n/).slice(1).join(" ").trim();
  }

  /* ================================================================
     MOVE TREE BUILDER
  ================================================================ */

  function buildMoveTree(pgnText) {
    var tokens = parsePGN(pgnText);
    var chess = new Chess();
    var root = { next: null, fen: chess.fen() };
    parseSequence(tokens, chess, root, pgnText);
    return root.next;
  }

  function getMoveNumber(fen) {
    var parts = fen.split(" ");
    return parseInt(parts[5], 10) || 1;
  }

  function parseSequence(tokens, chess, parentNode, originalPgn) {
    var current = parentNode;
    var lastMoveNode = null;
    var i = 0;

    while (i < tokens.length) {
      var token = tokens[i];

      if (token.type === "moveNumber" || token.type === "result") {
        i++;
        continue;
      }

      /* MOVE */
      if (token.type === "move") {
        var move = chess.move(token.value, { sloppy: true });
        if (!move) {
          var currentFen = chess.fen();
          var currentMoveNum = getMoveNumber(currentFen);
          var error = new Error(
            "Invalid move: " + token.value + "\nMove number: " + currentMoveNum,
          );
          error.pgnIndex = findTokenIndex(originalPgn, token.value);
          throw error;
        }

        var fen = chess.fen();
        var fenMoveNum = getMoveNumber(fen);
        var moveNumber = move.color === "w" ? fenMoveNum : fenMoveNum - 1;

        var node = {
          san: token.value,
          fen: chess.fen(),
          moveNumber: moveNumber,
          color: move.color,
          next: null,
          parent: null,
          variations: [],
          comment: null,
          nags: [],
          arrows: [],
          squareMarks: [],
        };

        node.parent = current;
        current.next = node;
        current = node;
        lastMoveNode = node;
        i++;
        continue;
      }

      /* NAG */
      if (token.type === "nag") {
        if (lastMoveNode) {
          lastMoveNode.nags.push(token.value);
        }
        i++;
        continue;
      }

      /* COMMENT */
      if (token.type === "comment") {
        var commentText = token.value;
        var inlineMoveText = "";

        var variationMatch = commentText.match(/\(([^()]+)\)/);
        if (variationMatch) {
          var variationText = variationMatch[1].trim();
          var hasDiagram = variationText.includes("[D]");

          inlineMoveText = variationText
            .replace(/\{[^}]*\}/g, "")
            .replace(/\[%.*?\]/g, "")
            .replace(/\[D\]/g, "")
            .trim();

          try {
            var fakePGN =
              '[Event "?"]\n\n1. ' + variationText.replace(/\[D\]/g, "");
            var variationTokens = parsePGN(fakePGN);

            if (hasDiagram) {
              variationTokens.push({ type: "comment", value: "[D]" });
            }

            var branchFen = determineBranchFen(
              variationTokens,
              current,
              parentNode,
            );
            var snapshot = new Chess(branchFen);
            var variationRoot = { next: null, fen: branchFen };

            parseSequence(
              variationTokens,
              snapshot,
              variationRoot,
              originalPgn,
            );

            if (current && variationRoot.next) {
              current.variations.push(variationRoot.next);
            }
          } catch (e) {
            // Silently skip invalid inline variations
          }
        }

        if (lastMoveNode) {
          var cslMatches = [];
          var cslRegex = /\[%csl\s+([^\]]+)\]/g;
          var cslM;
          while ((cslM = cslRegex.exec(commentText))) {
            cslMatches.push(cslM);
          }
          if (cslMatches.length) {
            lastMoveNode.squareMarks = [];
            cslMatches.forEach(function (m) {
              lastMoveNode.squareMarks = lastMoveNode.squareMarks.concat(
                parseCSL(m[1]),
              );
            });
          }

          var calMatches = [];
          var calRegex = /\[%cal\s+([^\]]+)\]/g;
          var calM;
          while ((calM = calRegex.exec(commentText))) {
            calMatches.push(calM);
          }
          if (calMatches.length) {
            lastMoveNode.arrows = [];
            calMatches.forEach(function (m) {
              lastMoveNode.arrows = lastMoveNode.arrows.concat(parseCAL(m[1]));
            });
          }

          var cleaned = commentText
            .replace(/\([^)]*\)/g, "")
            .replace(/\[%csl\s+[^\]]+\]/g, "")
            .replace(/\[%cal\s+[^\]]+\]/g, "")
            .replace(/\[%eval\s+[^\]]+\]/g, "")
            .replace(/\[%clk\s+[^\]]+\]/g, "")
            .replace(/\[%emt\s+[^\]]+\]/g, "")
            .replace(/\[%depth\s+[^\]]+\]/g, "")
            .replace(/\[%.*?\]/g, "")
            .trim();

          var finalComment = (cleaned + " " + inlineMoveText).trim();

          if (finalComment.length) {
            if (lastMoveNode.comment) {
              lastMoveNode.comment += " " + finalComment;
            } else {
              lastMoveNode.comment = finalComment;
            }
          }
        }

        i++;
        continue;
      }

      /* VARIATION */
      if (token.type === "variation") {
        var branchFen2 = determineBranchFen(token.value, current, parentNode);
        var snapshot2 = new Chess(branchFen2);
        var variationRoot2 = { next: null, fen: branchFen2 };

        parseSequence(token.value, snapshot2, variationRoot2, originalPgn);

        if (current && variationRoot2.next) {
          current.variations.push(variationRoot2.next);
        }

        i++;
        continue;
      }

      i++;
    }
  }

  /* ================= SMART BRANCH LOGIC ================= */

  function determineBranchFen(variationTokens, current, parentNode) {
    if (!current) return parentNode.fen;

    var firstMoveNumberToken = null;
    for (var k = 0; k < variationTokens.length; k++) {
      if (variationTokens[k].type === "moveNumber") {
        firstMoveNumberToken = variationTokens[k];
        break;
      }
    }

    var variationColor;
    if (firstMoveNumberToken && firstMoveNumberToken.value.includes("...")) {
      variationColor = "b";
    } else if (firstMoveNumberToken) {
      variationColor = "w";
    } else {
      variationColor = current.color === "w" ? "b" : "w";
    }

    var nextToMove = current.color === "w" ? "b" : "w";

    if (variationColor === nextToMove) {
      return current.fen;
    } else {
      return current.parent && current.parent.fen
        ? current.parent.fen
        : parentNode.fen;
    }
  }

  /* ================= HELPERS ================= */

  function parseCSL(data) {
    return data.split(",").map(function (entry) {
      return { color: entry[0], square: entry.slice(1) };
    });
  }

  function parseCAL(data) {
    return data.split(",").map(function (entry) {
      return {
        color: entry[0],
        from: entry.slice(1, 3),
        to: entry.slice(3, 5),
      };
    });
  }

  function findTokenIndex(pgnText, token) {
    return pgnText.indexOf(token);
  }

  /* ================================================================
     PGN HEADER RENDERER
  ================================================================ */

  function renderHeaders(headers, container) {
    var div = document.createElement("div");
    div.className = "pgn-headers";

    if (headers.White && headers.Black) {
      var players = document.createElement("div");
      players.className = "pgn-players";
      players.textContent = headers.White + " – " + headers.Black;
      div.appendChild(players);
    }

    if (headers.Site || headers.Date) {
      var meta = document.createElement("div");
      meta.className = "pgn-meta";
      var site = headers.Site || "";
      var date = headers.Date || "";
      meta.textContent = site && date ? site + ", " + date : site || date;
      div.appendChild(meta);
    }

    container.appendChild(div);
  }

  function parseHeaders(pgnText) {
    var headers = {};
    var regex = /\[(\w+)\s+"([^"]*)"\]/g;
    var match;
    while ((match = regex.exec(pgnText))) {
      headers[match[1]] = match[2];
    }
    return headers;
  }

  /* ================================================================
     TREE RENDERER
  ================================================================ */

  function renderMoveTree(rootNode, container) {
    var movesDiv = document.createElement("div");
    movesDiv.className = "pgn-moves";
    renderLine(rootNode, movesDiv, false);
    container.appendChild(movesDiv);
  }

  function renderLine(node, parent, isVariation) {
    var current = node;
    var buffer = "";
    var lastMoveNumber = null;
    var needsMoveNumber = true;

    while (current) {
      var newMoveNumber = current.moveNumber !== lastMoveNumber;

      /* MOVE NUMBER */
      if (!isVariation) {
        if (current.color === "w") {
          buffer += current.moveNumber + "." + NBSP;
        } else if (needsMoveNumber) {
          buffer += current.moveNumber + "..." + NBSP;
        }
      } else {
        if (needsMoveNumber && buffer.trim() === "") {
          if (current.color === "b") {
            buffer += current.moveNumber + "..." + NBSP;
          } else {
            buffer += current.moveNumber + "." + NBSP;
          }
        } else if (needsMoveNumber && current.color === "b") {
          buffer += current.moveNumber + "..." + NBSP;
        } else if (newMoveNumber && current.color === "w") {
          buffer += current.moveNumber + "." + NBSP;
        }
      }

      needsMoveNumber = false;

      /* MOVE TEXT */
      buffer += toFigurine(current.san);
      buffer += renderNAG(current.nags);
      buffer += " ";

      lastMoveNumber = current.moveNumber;

      /* COMMENT */
      if (current.comment) {
        flushBuffer(parent, buffer, isVariation);
        buffer = "";
        renderCommentBlock(parent, current.comment);
        needsMoveNumber = true;
      }

      /* BOARD */
      var hasAnnotations =
        (current.arrows && current.arrows.length) ||
        (current.squareMarks && current.squareMarks.length);
      var isDiagram = current.comment === "[D]";

      if (hasAnnotations || isDiagram) {
        flushBuffer(parent, buffer, isVariation);
        buffer = "";
        createBoard(parent, current.fen, current);
        needsMoveNumber = true;
      }

      /* VARIATIONS */
      if (current.variations.length > 0) {
        flushBuffer(parent, buffer, isVariation);
        buffer = "";

        current.variations.forEach(function (variationRoot) {
          var variationWrapper = document.createElement("div");
          variationWrapper.className = "pgn-variation";
          parent.appendChild(variationWrapper);
          renderLine(variationRoot, variationWrapper, true);
        });

        needsMoveNumber = true;
      }

      current = current.next;
    }

    flushBuffer(parent, buffer, isVariation);
  }

  function renderCommentBlock(parent, text) {
    var p = document.createElement("p");
    p.className = "pgn-comment";
    p.textContent = text;
    parent.appendChild(p);
  }

  function renderNAG(nags) {
    if (!nags || nags.length === 0) return "";
    var map = {
      $1: "!",
      $2: "?",
      $3: "!!",
      $4: "??",
      $5: "!?",
      $6: "?!",
    };
    return nags
      .map(function (n) {
        return map[n] || "";
      })
      .join("");
  }

  function flushBuffer(parent, text, isVariation) {
    if (!text.trim()) return;
    var p = document.createElement("p");
    p.className = isVariation ? "pgn-variation-line" : "pgn-mainline";
    p.textContent = text.trim();
    parent.appendChild(p);
  }

  /* ================================================================
     FULL PGN RENDER (convenience function)
  ================================================================ */

  function renderFullPGN(pgnText, container) {
    try {
      var headers = parseHeaders(pgnText);
      renderHeaders(headers, container);

      var rootNode = buildMoveTree(pgnText);
      if (rootNode) {
        renderMoveTree(rootNode, container);
      }
    } catch (e) {
      var errorDiv = document.createElement("div");
      errorDiv.className = "pgn-error";
      errorDiv.textContent = "Error parsing PGN: " + e.message;
      container.appendChild(errorDiv);
    }
  }

  /* ================================================================
     PGN READER — Interactive board + clickable move list
  ================================================================ */

  function renderPGNReader(pgnText, container) {
    var headers = parseHeaders(pgnText);

    var headerDiv = document.createElement("div");
    headerDiv.className = "pgn-reader-header";
    renderHeaders(headers, headerDiv);
    container.appendChild(headerDiv);

    var rootNode = buildMoveTree(pgnText);
    if (!rootNode) {
      container.textContent = "No moves found in PGN.";
      return;
    }

    var allNodes = [];
    var startFen = rootNode.parent
      ? rootNode.parent.fen
      : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

    function collectNodes(node) {
      var cur = node;
      while (cur) {
        allNodes.push(cur);
        cur = cur.next;
      }
    }
    collectNodes(rootNode);

    var layout = document.createElement("div");
    layout.className = "pgn-reader-layout";
    container.appendChild(layout);

    /* Board area */
    var boardArea = document.createElement("div");
    boardArea.className = "pgn-reader-board-area";
    layout.appendChild(boardArea);

    var boardDiv = document.createElement("div");
    boardDiv.className = "jc-board pgn-reader-board";
    boardArea.appendChild(boardDiv);

    /* Controls */
    var controls = document.createElement("div");
    controls.className = "pgn-reader-controls";
    boardArea.appendChild(controls);

    var btnFirst = createControlBtn("⏮", "First move");
    var btnPrev = createControlBtn("◀", "Previous move");
    var btnNext = createControlBtn("▶", "Next move");
    var btnLast = createControlBtn("⏭", "Last move");
    controls.appendChild(btnFirst);
    controls.appendChild(btnPrev);
    controls.appendChild(btnNext);
    controls.appendChild(btnLast);

    /* Moves panel */
    var movesPanel = document.createElement("div");
    movesPanel.className = "pgn-reader-moves-panel";
    layout.appendChild(movesPanel);

    var moveSpans = [];
    var commentSpans = [];

    allNodes.forEach(function (node, idx) {
      if (node.color === "w") {
        var numSpan = document.createElement("span");
        numSpan.className = "pgn-reader-move-number";
        numSpan.textContent = node.moveNumber + "." + NBSP;
        movesPanel.appendChild(numSpan);
      } else if (idx === 0) {
        var numSpan2 = document.createElement("span");
        numSpan2.className = "pgn-reader-move-number";
        numSpan2.textContent = node.moveNumber + "..." + NBSP;
        movesPanel.appendChild(numSpan2);
      }

      var moveSpan = document.createElement("span");
      moveSpan.className = "pgn-reader-move";
      moveSpan.textContent = toFigurine(node.san) + " ";
      moveSpan.dataset.index = idx;
      moveSpan.addEventListener("click", function () {
        goToMove(idx);
      });
      movesPanel.appendChild(moveSpan);
      moveSpans.push(moveSpan);

      if (node.comment) {
        var commentSpan = document.createElement("span");
        commentSpan.className = "pgn-reader-inline-comment";
        commentSpan.textContent = node.comment + " ";
        commentSpan.dataset.moveIndex = idx;
        movesPanel.appendChild(commentSpan);
        commentSpans.push({ idx: idx, el: commentSpan });
      }
    });

    /* Orientation */
    var orientation = "white";
    if (headers.Orientation) {
      orientation = headers.Orientation.toLowerCase();
    }

    var board = Chessboard(boardDiv, {
      position: startFen,
      pieceTheme: PIECE_THEME,
      orientation: orientation,
    });

    var currentIndex = -1;

    function goToMove(idx) {
      if (idx < -1 || idx >= allNodes.length) return;
      currentIndex = idx;

      if (idx === -1) {
        board.position(startFen, true);
      } else {
        board.position(allNodes[idx].fen, true);
      }

      moveSpans.forEach(function (span, i) {
        span.classList.toggle("pgn-reader-move-active", i === idx);
      });

      commentSpans.forEach(function (item) {
        item.el.classList.toggle(
          "pgn-reader-inline-comment-active",
          item.idx === idx,
        );
      });

      if (idx >= 0 && moveSpans[idx]) {
        moveSpans[idx].scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    btnFirst.addEventListener("click", function () {
      goToMove(-1);
    });
    btnPrev.addEventListener("click", function () {
      goToMove(currentIndex - 1);
    });
    btnNext.addEventListener("click", function () {
      goToMove(currentIndex + 1);
    });
    btnLast.addEventListener("click", function () {
      goToMove(allNodes.length - 1);
    });

    if (!window.__jcKeyHandler) {
      window.__jcKeyHandler = true;

      document.addEventListener("keydown", function (e) {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
          return;

        if (e.key === "ArrowLeft") {
          e.preventDefault();
          goToMove(currentIndex - 1);
        }

        if (e.key === "ArrowRight") {
          e.preventDefault();
          goToMove(currentIndex + 1);
        }

        if (e.key === "Home") {
          e.preventDefault();
          goToMove(-1);
        }

        if (e.key === "End") {
          e.preventDefault();
          goToMove(allNodes.length - 1);
        }
      });
    }

    goToMove(-1);
  }

  function createControlBtn(text, title) {
    var btn = document.createElement("button");
    btn.className = "pgn-reader-btn";
    btn.textContent = text;
    btn.title = title;
    return btn;
  }

  /* ================================================================
     PUZZLE SYSTEM — Helpers
  ================================================================ */

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

  /* ================================================================
     PUZZLE-RUSH RENDERER
  ================================================================ */

  var RUSH_KEY = "jekyllchess_puzzle_rush_index";

  function renderPuzzleRush(container, url) {
    container.textContent = "Loading...";

    fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var puzzles = splitIntoPgnGames(text)
          .map(parseGame)
          .filter(function (p) {
            return !p.error;
          });

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
            "Puzzle " +
            Math.min(idx + 1, puzzles.length) +
            " / " +
            puzzles.length;
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
              holder.innerHTML = "";
              var newCounter = document.createElement("div");
              newCounter.className = "puzzle-rush-counter";
              holder.appendChild(newCounter);
              counterDiv.remove();
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

  /* ================================================================
     ELEMENT INITIALIZERS
  ================================================================ */

  function initPgnElements() {
    document.querySelectorAll("pgn").forEach(function (el) {
      if (el.dataset.jcRendered === "1") return;
      el.dataset.jcRendered = "1";

      var container = document.createElement("div");
      container.className = "pgn-container game-card";
      el.replaceWith(container);

      var pgnText = "";
      var src = el.getAttribute("src");

      if (src) {
        fetch(src, { cache: "no-store" })
          .then(function (res) {
            return res.text();
          })
          .then(function (text) {
            renderFullPGN(text, container);
          })
          .catch(function (e) {
            container.textContent = "Failed to load PGN: " + e.message;
          });
      } else {
        pgnText = el.textContent.trim();
        if (!pgnText) {
          container.textContent = "No PGN content found.";
          return;
        }
        try {
          renderFullPGN(pgnText, container);
        } catch (e) {
          container.textContent = "Error rendering PGN: " + e.message;
        }
      }
    });
  }

  function initPgnReaderElements() {
    document.querySelectorAll("pgn-reader").forEach(function (el) {
      if (el.dataset.jcRendered === "1") return;
      el.dataset.jcRendered = "1";

      var wrapper = document.createElement("div");
      wrapper.className = "pgn-reader-container";
      el.replaceWith(wrapper);

      var src = el.getAttribute("src");

      if (src) {
        fetch(src, { cache: "no-store" })
          .then(function (res) {
            return res.text();
          })
          .then(function (text) {
            renderPGNReader(text, wrapper);
          })
          .catch(function (e) {
            wrapper.textContent = "Failed to load PGN: " + e.message;
          });
      } else {
        var pgnText = el.textContent.trim();
        if (!pgnText) {
          wrapper.textContent = "No PGN content found.";
          return;
        }
        try {
          renderPGNReader(pgnText, wrapper);
        } catch (e) {
          wrapper.textContent = "Error rendering PGN reader: " + e.message;
        }
      }
    });
  }

  function initFenElements() {
    document.querySelectorAll("fen").forEach(function (el) {
      if (el.dataset.jcRendered === "1") return;
      el.dataset.jcRendered = "1";

      var fenStr = el.textContent.trim();
      if (!fenStr) return;

      var caption = el.getAttribute("caption") || "";
      var wrapper = document.createElement("div");
      wrapper.className = "fen-container";

      var boardDiv = document.createElement("div");
      boardDiv.className = "jc-board";
      wrapper.appendChild(boardDiv);

      if (caption) {
        var cap = document.createElement("div");
        cap.className = "fen-caption";
        cap.textContent = caption;
        wrapper.appendChild(cap);
      }

      el.replaceWith(wrapper);

      requestAnimationFrame(function () {
        Chessboard(boardDiv, {
          position: fenStr,
          pieceTheme: PIECE_THEME,
        });
      });
    });
  }

  function initPuzzleElements() {
    document.querySelectorAll("puzzle").forEach(function (oldEl) {
      var raw = oldEl.textContent;
      var wrapper = document.createElement("div");
      wrapper.className = "jc-puzzle";
      oldEl.replaceWith(wrapper);
      jcPuzzleCreate(wrapper, { rawPGN: raw });
    });
  }

  function initPuzzleBlockElements() {
    document.querySelectorAll("puzzle-block").forEach(renderPuzzleBlock);
  }

  function initPuzzleRushElements() {
    document.querySelectorAll("puzzle-rush").forEach(function (node) {
      var raw = normalizePuzzleText(stripFigurines(node.textContent));
      var pgnMatch = raw.match(/PGN:\s*([^\s]+)/i);

      var wrap = document.createElement("div");
      node.replaceWith(wrap);

      if (pgnMatch) {
        renderPuzzleRush(wrap, new URL(pgnMatch[1], location.href).href);
      }
    });
  }

  /* ================================================================
     MASTER INIT
  ================================================================ */

  function initAll() {
    initPgnElements();
    initPgnReaderElements();
    initFenElements();
    initPuzzleRushElements();
    initPuzzleBlockElements();
    initPuzzleElements();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll, { once: true });
  } else {
    initAll();
  }

  /* ================================================================
     PUBLIC API (optional — for programmatic use)
  ================================================================ */

  window.JekyllChess = {
    renderFullPGN: renderFullPGN,
    renderPGNReader: renderPGNReader,
    buildMoveTree: buildMoveTree,
    parseHeaders: parseHeaders,
    createBoard: createBoard,
    toFigurine: toFigurine,
    parseGame: parseGame,
    renderLocalPuzzle: renderLocalPuzzle,
    renderPuzzleBlock: renderPuzzleBlock,
    renderPuzzleRush: renderPuzzleRush,
    initAll: initAll,
  };
})();