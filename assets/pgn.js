/**
 * JekyllChess — PGN Engine
 *
 * Merged from: pgn-parser.js, pgn-renderer.js, pgn-reader.js
 *
 * Sections:
 *   1. Tokenizer        — parsePGN()
 *   2. Move Tree Builder — buildMoveTree()
 *   3. Header Parser     — parseHeaders()
 *   4. Static Renderer   — renderFullPGN(), renderHeaders(), renderMoveTree()
 *   5. Interactive Reader — renderPGNReader()
 */

import { NBSP, PIECE_THEME, toFigurine } from "./helpers.js";
import { createBoard } from "./board.js";

/* ================================================================
   1. PGN TOKENIZER
================================================================ */

export function parsePGN(pgnText) {
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
      tokens.push({ type: "comment", value: text.slice(i + 1, j - 1).trim() });
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
      tokens.push({ type: "variation", value: tokenize(text.slice(i + 1, j2 - 1)) });
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

    var moveNumberMatch = text.slice(i).match(/^\d+(\.\.\.?)?\./);
    if (moveNumberMatch) {
      tokens.push({ type: "moveNumber", value: moveNumberMatch[0] });
      i += moveNumberMatch[0].length;
      continue;
    }

    var moveMatch = text
      .slice(i)
      .match(
        /^(?:O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|[a-h][1-8])[+#]?/,
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
   2. MOVE TREE BUILDER
================================================================ */

export function buildMoveTree(pgnText) {
  var tokens = parsePGN(pgnText);
  var chess = new Chess();
  var root = { next: null, fen: chess.fen() };
  parseSequence(tokens, chess, root, pgnText);
  return root.next;
}

function getMoveNumber(fen) {
  return parseInt(fen.split(" ")[5], 10) || 1;
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
        var error = new Error(
          "Invalid move: " + token.value + "\nMove number: " + getMoveNumber(currentFen),
        );
        error.pgnIndex = originalPgn.indexOf(token.value);
        throw error;
      }

      var fen = chess.fen();
      var fenMoveNum = getMoveNumber(fen);

      var node = {
        san: token.value,
        fen: fen,
        moveNumber: move.color === "w" ? fenMoveNum : fenMoveNum - 1,
        color: move.color,
        next: null,
        parent: current,
        variations: [],
        comment: null,
        nags: [],
        arrows: [],
        squareMarks: [],
      };

      current.next = node;
      current = node;
      lastMoveNode = node;
      i++;
      continue;
    }

    /* NAG */
    if (token.type === "nag") {
      if (lastMoveNode) lastMoveNode.nags.push(token.value);
      i++;
      continue;
    }

    /* COMMENT */
    if (token.type === "comment") {
      if (lastMoveNode) {
        processComment(token.value, lastMoveNode, current, parentNode, chess, originalPgn);
      }
      i++;
      continue;
    }

    /* VARIATION */
    if (token.type === "variation") {
      var branchFen = determineBranchFen(token.value, current, parentNode);
      var snapshot = new Chess(branchFen);
      var variationRoot = { next: null, fen: branchFen };

      parseSequence(token.value, snapshot, variationRoot, originalPgn);

      if (current && variationRoot.next) {
        current.variations.push(variationRoot.next);
      }

      i++;
      continue;
    }

    i++;
  }
}

/* ── Comment processor ──────────────────────────────────── */

var RE_CSL = /\[%csl\s+([^\]]+)\]/g;
var RE_CAL = /\[%cal\s+([^\]]+)\]/g;
var RE_ANNOTATIONS = /\[%(?:eval|clk|emt|depth)\s+[^\]]+\]/g;
var RE_GENERIC_BRACKET = /\[%.*?\]/g;

function processComment(commentText, lastMoveNode, current, parentNode, chess, originalPgn) {
  var inlineMoveText = "";

  var variationMatch = commentText.match(/\(([^()]+)\)/);
  if (variationMatch) {
    var variationText = variationMatch[1].trim();
    var hasDiagram = variationText.includes("[D]");

    inlineMoveText = variationText
      .replace(/\{[^}]*\}/g, "")
      .replace(RE_GENERIC_BRACKET, "")
      .replace(/\[D\]/g, "")
      .trim();

    try {
      var fakePGN = '[Event "?"]\n\n1. ' + variationText.replace(/\[D\]/g, "");
      var variationTokens = parsePGN(fakePGN);

      if (hasDiagram) {
        variationTokens.push({ type: "comment", value: "[D]" });
      }

      var branchFen = determineBranchFen(variationTokens, current, parentNode);
      var snapshot = new Chess(branchFen);
      var variationRoot = { next: null, fen: branchFen };

      parseSequence(variationTokens, snapshot, variationRoot, originalPgn);

      if (current && variationRoot.next) {
        current.variations.push(variationRoot.next);
      }
    } catch (_e) {
      // Silently skip invalid inline variations
    }
  }

  /* Square marks */
  var cslM;
  RE_CSL.lastIndex = 0;
  while ((cslM = RE_CSL.exec(commentText))) {
    lastMoveNode.squareMarks = lastMoveNode.squareMarks.concat(parseCSL(cslM[1]));
  }

  /* Arrows */
  var calM;
  RE_CAL.lastIndex = 0;
  while ((calM = RE_CAL.exec(commentText))) {
    lastMoveNode.arrows = lastMoveNode.arrows.concat(parseCAL(calM[1]));
  }

  /* Clean comment text */
  var cleaned = commentText
    .replace(/\([^)]*\)/g, "")
    .replace(RE_CSL, "")
    .replace(RE_CAL, "")
    .replace(RE_ANNOTATIONS, "")
    .replace(RE_GENERIC_BRACKET, "")
    .trim();

  var finalComment = (cleaned + " " + inlineMoveText).trim();

  if (finalComment.length) {
    lastMoveNode.comment = lastMoveNode.comment
      ? lastMoveNode.comment + " " + finalComment
      : finalComment;
  }
}

/* ── Smart branch logic ─────────────────────────────────── */

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
  }
  return current.parent && current.parent.fen
    ? current.parent.fen
    : parentNode.fen;
}

function parseCSL(data) {
  return data.split(",").map(function (entry) {
    return { color: entry[0], square: entry.slice(1) };
  });
}

function parseCAL(data) {
  return data.split(",").map(function (entry) {
    return { color: entry[0], from: entry.slice(1, 3), to: entry.slice(3, 5) };
  });
}

/* ================================================================
   3. HEADER PARSER
================================================================ */

export function parseHeaders(pgnText) {
  var headers = {};
  var regex = /\[(\w+)\s+"([^"]*)"\]/g;
  var match;
  while ((match = regex.exec(pgnText))) {
    headers[match[1]] = match[2];
  }
  return headers;
}

/* ================================================================
   4. STATIC PGN RENDERER
================================================================ */

export function renderHeaders(headers, container) {
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

export function renderMoveTree(rootNode, container) {
  var movesDiv = document.createElement("div");
  movesDiv.className = "pgn-moves";
  renderLine(rootNode, movesDiv, false);
  container.appendChild(movesDiv);
}

var NAG_MAP = {
  $1: "!", $2: "?", $3: "!!", $4: "??", $5: "!?", $6: "?!",
};

function renderNAG(nags) {
  if (!nags || !nags.length) return "";
  var out = "";
  for (var i = 0; i < nags.length; i++) {
    out += NAG_MAP[nags[i]] || "";
  }
  return out;
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
      if (needsMoveNumber && !buffer.trim()) {
        buffer += current.moveNumber + (current.color === "b" ? "..." : ".") + NBSP;
      } else if (needsMoveNumber && current.color === "b") {
        buffer += current.moveNumber + "..." + NBSP;
      } else if (newMoveNumber && current.color === "w") {
        buffer += current.moveNumber + "." + NBSP;
      }
    }

    needsMoveNumber = false;

    /* MOVE TEXT */
    buffer += toFigurine(current.san) + renderNAG(current.nags) + " ";

    lastMoveNumber = current.moveNumber;

    /* COMMENT */
    if (current.comment) {
      flushBuffer(parent, buffer, isVariation);
      buffer = "";
      var p = document.createElement("p");
      p.className = "pgn-comment";
      p.textContent = current.comment;
      parent.appendChild(p);
      needsMoveNumber = true;
    }

    /* BOARD */
    var hasAnnotations =
      (current.arrows && current.arrows.length) ||
      (current.squareMarks && current.squareMarks.length);

    if (hasAnnotations || current.comment === "[D]") {
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

function flushBuffer(parent, text, isVariation) {
  var trimmed = text.trim();
  if (!trimmed) return;
  var p = document.createElement("p");
  p.className = isVariation ? "pgn-variation-line" : "pgn-mainline";
  p.textContent = trimmed;
  parent.appendChild(p);
}

export function renderFullPGN(pgnText, container) {
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
   5. INTERACTIVE PGN READER
================================================================ */

export function renderPGNReader(pgnText, container) {
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