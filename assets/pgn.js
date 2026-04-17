/**
 * ChessPublica — PGN Engine
 *
 * Sections:
 *   1. Tokenizer        — parsePGN()
 *   2. Move Tree Builder — buildMoveTree()
 *   3. Header Parser     — parseHeaders()
 *   4. Static Renderer   — renderFullPGN(), renderHeaders(), renderMoveTree()
 */

import {
  NBSP,
  toFigurine,
  formatComment,
  NAG_TO_GLYPH,
  stripCommentAnnotations,
} from "./helpers.js";
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

    /* Inline suffix NAGs: !!, ??, !?, ?!, !, ? */
    var suffixNagMatch = text.slice(i).match(/^(!!|\?\?|!\?|\?!|!|\?)/);
    if (suffixNagMatch) {
      tokens.push({ type: "nag", value: suffixNagMatch[0] });
      i += suffixNagMatch[0].length;
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
        parts: [],
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

/* Inline PGN variations embedded inside a brace comment, identified by
   starting with a move number: "(1. Re1? e4 2. Ke7)".
   Plain-prose parentheticals like "(Grob's Attack)" do NOT start with
   digits and are left untouched. */
var RE_INLINE_PGN_VAR = /\(\s*\d+\.+[^()]*\)/g;

function processComment(commentText, lastMoveNode, current, parentNode, chess, originalPgn) {

  /* ── Parse any inline PGN variations found in the comment ── */
  RE_INLINE_PGN_VAR.lastIndex = 0;
  var varMatch;
  while ((varMatch = RE_INLINE_PGN_VAR.exec(commentText))) {
    /* Strip the surrounding parens to get the bare move text. */
    var inner = varMatch[0].slice(1, -1).trim();
    var hasDiagram = inner.includes("[D]");

    try {
      var fakePGN = '[Event "?"]\n\n' + inner.replace(/\[D\]/g, "");
      var variationTokens = parsePGN(fakePGN);
      if (hasDiagram) variationTokens.push({ type: "comment", value: "[D]" });

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

  /* ── Extract square marks and arrows ── */
  var cslM;
  var hadSquareMarks = false;
  RE_CSL.lastIndex = 0;
  while ((cslM = RE_CSL.exec(commentText))) {
    lastMoveNode.squareMarks = lastMoveNode.squareMarks.concat(parseCSL(cslM[1]));
    hadSquareMarks = true;
  }

  var calM;
  var hadArrows = false;
  RE_CAL.lastIndex = 0;
  while ((calM = RE_CAL.exec(commentText))) {
    lastMoveNode.arrows = lastMoveNode.arrows.concat(parseCAL(calM[1]));
    hadArrows = true;
  }

  var hasDiagramMarker = /\[D\]/.test(commentText);

  /* ── Clean comment text (shared with pgn-player.js) ──
     stripCommentAnnotations() removes [%…] tags, [D] markers, and
     move-number-led parentheticals.  Plain prose parentheticals like
     "(Grob's Attack)" are preserved. */
  var cleaned = stripCommentAnnotations(commentText);

  /* Push parts in PGN order: diagram first, then text. */
  if (hasDiagramMarker || hadArrows || hadSquareMarks) {
    lastMoveNode.parts.push({ type: "diagram" });
  }
  if (cleaned.length) {
    lastMoveNode.parts.push({ type: "text", value: cleaned });
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
  var wTitle = headers.WhiteTitle || "";
  var bTitle = headers.BlackTitle || "";

  var white = headers.White || "White";
  var black = headers.Black || "Black";

  var wElo = headers.WhiteElo ? " (" + headers.WhiteElo + ")" : "";
  var bElo = headers.BlackElo ? " (" + headers.BlackElo + ")" : "";

  var event = headers.Event || "";
  var date = (headers.Date || "").replace(/\.\?+/g, "");

  var leftSide = ((wTitle ? wTitle + " " : "") + white + wElo).trim();
  var rightSide = ((bTitle ? bTitle + " " : "") + black + bElo).trim();
  var players = leftSide + " – " + rightSide;

  var eventLine = "";
  if (event && date) eventLine = event + ", " + date;
  else if (event) eventLine = event;
  else if (date) eventLine = date;

  var title = document.createElement("div");
  title.className = "video-title pgn-title";

  var emojiSpan = document.createElement("span");
  emojiSpan.className = "video-title-emoji lucide-icon";
  emojiSpan.style.setProperty(
    "--icon",
    "url(https://unpkg.com/lucide-static@latest/icons/swords.svg)",
  );
  title.appendChild(emojiSpan);

  var textDiv = document.createElement("div");
  textDiv.className = "video-title-text";

  var playersDiv = document.createElement("div");
  playersDiv.className = "video-title-players";
  playersDiv.textContent = players;
  textDiv.appendChild(playersDiv);

  if (eventLine) {
    var eventDiv = document.createElement("div");
    eventDiv.className = "video-title-event";
    eventDiv.textContent = eventLine;
    textDiv.appendChild(eventDiv);
  }

  title.appendChild(textDiv);
  container.appendChild(title);
}

export function renderMoveTree(rootNode, container, headers) {
  var movesDiv = document.createElement("div");
  movesDiv.className = "pgn-moves";
  renderLine(rootNode, movesDiv, false);

  /* Append the game result (1-0 / 0-1 / ½-½) inline at the end of
     the main line. Skip "*" (ongoing) and missing values. */
  var rawResult = headers && headers.Result;
  if (rawResult && rawResult !== "*") {
    var label = rawResult === "1/2-1/2" ? "½-½" : rawResult;
    var resultP = document.createElement("p");
    resultP.className = "pgn-mainline pgn-result";
    resultP.textContent = label;
    movesDiv.appendChild(resultP);
  }

  container.appendChild(movesDiv);
}

function renderNAG(nags) {
  if (!nags || !nags.length) return "";
  var out = "";
  for (var i = 0; i < nags.length; i++) {
    out += NAG_TO_GLYPH[nags[i]] || nags[i];
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

    /* COMMENTS & DIAGRAMS — rendered in PGN order */
    if (current.parts && current.parts.length) {
      for (var pi = 0; pi < current.parts.length; pi++) {
        var part = current.parts[pi];
        if (part.type === "text") {
          if (isVariation) {
            /* Inline comments inside variations stay on the same line.
               Comments are pre-sanitized so flushBuffer can safely use
               innerHTML for variation lines (moves are plain SAN and
               contain no HTML-special characters). */
            buffer += formatComment(part.value) + " ";
          } else {
            flushBuffer(parent, buffer, isVariation);
            buffer = "";
            var p = document.createElement("p");
            p.className = "pgn-comment";
            p.innerHTML = formatComment(part.value);
            parent.appendChild(p);
            needsMoveNumber = true;
          }
        } else if (part.type === "diagram") {
          flushBuffer(parent, buffer, isVariation);
          buffer = "";
          createBoard(parent, current.fen, current);
          needsMoveNumber = true;
        }
      }
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
  /* Variation buffers carry already-sanitized comment HTML mixed with
     plain SAN move text, so innerHTML is needed to render them.
     Main-line buffers only ever hold move text, so textContent is fine
     (and also slightly safer). */
  if (isVariation) {
    p.innerHTML = trimmed;
  } else {
    p.textContent = trimmed;
  }
  parent.appendChild(p);
}

export function renderFullPGN(pgnText, container) {
  try {
    var headers = parseHeaders(pgnText);
    renderHeaders(headers, container);

    var rootNode = buildMoveTree(pgnText);
    if (rootNode) {
      renderMoveTree(rootNode, container, headers);
    }
  } catch (e) {
    var errorDiv = document.createElement("div");
    errorDiv.className = "pgn-error";
    errorDiv.textContent = "Error parsing PGN: " + e.message;
    container.appendChild(errorDiv);
  }
}

