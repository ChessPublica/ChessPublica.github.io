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
  fromFigurine,
  formatComment,
  nagsToGlyph,
  stripCommentAnnotations,
  extractPuzzleMarker,
  parseCSL,
  parseCAL,
} from "./helpers.js";
import { lucideIconUrl } from "./icons.js";
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
  return pgnText.split(/\r?\n[ \t]*\r?\n/).slice(1).join(" ").trim();
}

/* ================================================================
   2. MOVE TREE BUILDER
================================================================ */

export function buildMoveTree(pgnText) {
  var tokens = parsePGN(pgnText);
  var headers = parseHeaders(pgnText);
  var chess = new Chess();

  /* Custom starting position — PGN "FEN" header (normally paired with
     SetUp="1", though some sources omit SetUp and just supply FEN).
     Loaded before any moves are parsed so move validation and move-number
     bookkeeping key off the actual starting position instead of assuming
     a standard start. Falls back to the standard start if the FEN is
     missing or invalid. Mirrors the same logic in pgn-player.js. */
  var hasFEN = !!headers.FEN && headers.SetUp !== "0";
  var fenLoaded = hasFEN && chess.load(headers.FEN);
  if (!fenLoaded) {
    chess.reset();
  }

  /* A genuine SetUp/FEN start (as opposed to the standard starting
     position) always gets an opening diagram, regardless of whether a
     [D]/[P] marker is also present — readers can't otherwise tell the
     game doesn't start from the normal array. */
  var root = { next: null, fen: chess.fen(), hasDiagram: !!fenLoaded };
  parseSequence(tokens, chess, root, pgnText);
  if (root.preComments && root.next) {
    root.next.preComments = root.preComments;
  }
  if (root.hasDiagram && root.next) {
    root.next.startDiagram = {
      fen: root.fen,
      squareMarks: root.squareMarks || [],
      arrows: root.arrows || [],
    };
  }
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
      } else {
        /* Comment before the very first move — e.g. a [D]/[P]/[Pn]
           marker attached to a FEN-header start, or intro prose before
           move 1. [D] and [P] both mean "show a diagram here", same as
           processComment() below does for a comment attached to a move;
           the diagram here is of the game's starting position. */
        var cslM0;
        RE_CSL.lastIndex = 0;
        while ((cslM0 = RE_CSL.exec(token.value))) {
          if (!parentNode.squareMarks) parentNode.squareMarks = [];
          parentNode.squareMarks = parentNode.squareMarks.concat(parseCSL(cslM0[1]));
        }

        var calM0;
        RE_CAL.lastIndex = 0;
        while ((calM0 = RE_CAL.exec(token.value))) {
          if (!parentNode.arrows) parentNode.arrows = [];
          parentNode.arrows = parentNode.arrows.concat(parseCAL(calM0[1]));
        }

        var hasDiagramMarker0 = /\[D\]/.test(token.value);
        var puzzleMarker = extractPuzzleMarker(token.value);
        var cleaned = stripCommentAnnotations(puzzleMarker.text);

        if (hasDiagramMarker0 || parentNode.arrows || parentNode.squareMarks || puzzleMarker.plies) {
          parentNode.hasDiagram = true;
        }
        if (cleaned.length) {
          if (!parentNode.preComments) parentNode.preComments = [];
          parentNode.preComments.push(cleaned);
        }
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

/**
 * Render any inline PGN variations found in a comment string, in place.
 * Authors sometimes embed a short illustrative reference line (e.g.
 * naming a well-known opening) directly inside a comment, in
 * parentheses starting with a move number: "(1. e4 e5 2. Nf3 ...)".
 * Each match is replaced with plain figurine text — parentheses dropped
 * — so it reads as part of the sentence the author wrote. Plain-prose
 * parentheticals like "(Grob's Attack)" don't start with digits and are
 * left untouched.
 *
 * Shared by pgn.js's own processComment() below and pgn-player.js, so
 * both renderers parse/branch/render these embedded lines identically.
 *
 * @param {string} commentText
 * @param {object|null} current   move-tree node ({fen,color,moveNumber,
 *   parent}) the comment is attached to, or null if there isn't one
 *   (e.g. a comment before the very first move) — passed to
 *   determineBranchFen() to pick where each embedded line branches from.
 * @param {object} parentNode     fallback/start-position node ({fen}).
 * @param {string} originalPgn    raw PGN text, threaded through to
 *   parseSequence() purely for its error messages' pgnIndex.
 */
export function renderInlinePgnReferences(commentText, current, parentNode, originalPgn) {
  return commentText.replace(RE_INLINE_PGN_VAR, function (match) {
    /* Authors sometimes write this in figurine notation (♘f3 rather
       than Nf3) for readability; the tokenizer only knows ASCII piece
       letters, so normalize back before parsing or the figurine glyphs
       desync the move sequence entirely. */
    var inner = fromFigurine(match.slice(1, -1).trim()).replace(/\[D\]/g, "");

    try {
      var fakePGN = '[Event "?"]\n\n' + inner;
      var variationTokens = parsePGN(fakePGN);

      var branchFen = determineBranchFen(variationTokens, current, parentNode);
      var snapshot = new Chess(branchFen);
      var variationRoot = { next: null, fen: branchFen };
      parseSequence(variationTokens, snapshot, variationRoot, originalPgn || "");

      return variationRoot.next ? renderInlineVariationText(variationRoot.next) : "";
    } catch (_e) {
      // Drop invalid inline snippets, same as before.
      return "";
    }
  });
}

function processComment(commentText, lastMoveNode, current, parentNode, chess, originalPgn) {

  commentText = renderInlinePgnReferences(commentText, current, parentNode, originalPgn);

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

  /* [P] / [Pn] puzzle marker — an interactive puzzle in <pgn-player>, but
     in this static renderer it's just a diagram, same as [D]. Extracted
     before stripCommentAnnotations() since it's not part of the [%…]
     family that helper already strips. */
  var puzzleMarker = extractPuzzleMarker(commentText);

  /* ── Clean comment text (shared with pgn-player.js) ──
     stripCommentAnnotations() removes [%…] tags, [D] markers, and
     move-number-led parentheticals.  Plain prose parentheticals like
     "(Grob's Attack)" are preserved. */
  var cleaned = stripCommentAnnotations(puzzleMarker.text);

  /* Push parts in PGN order: diagram first, then text. */
  if (hasDiagramMarker || hadArrows || hadSquareMarks || puzzleMarker.plies) {
    lastMoveNode.parts.push({ type: "diagram" });
  }
  if (cleaned.length) {
    lastMoveNode.parts.push({ type: "text", value: cleaned });
  }
}

/* Render a parsed inline-variation node chain as plain figurine text,
   e.g. "1. e4 e5 2. ♘f3 ♘c6" — spliced back into a comment's prose
   exactly where the author's "(1. e4 e5 2. Nf3 Nc6)" reference line
   appeared, in place of a separate variation block. */
function renderInlineVariationText(node) {
  var buffer = "";
  var current = node;
  var first = true;

  while (current) {
    if (current.color === "w") {
      buffer += current.moveNumber + "." + NBSP;
    } else if (first) {
      buffer += current.moveNumber + "..." + NBSP;
    }
    buffer += toFigurine(current.san) + renderNAG(current.nags) + " ";
    first = false;
    current = current.next;
  }

  return buffer.trim();
}

/* ── Smart branch logic ─────────────────────────────────── */

function determineBranchFen(variationTokens, current, parentNode) {
  var firstMoveNumberToken = null;
  for (var k = 0; k < variationTokens.length; k++) {
    if (variationTokens[k].type === "moveNumber") {
      firstMoveNumberToken = variationTokens[k];
      break;
    }
  }

  var branchFen;
  if (!current) {
    /* No specific move to branch from (e.g. a comment-embedded reference
       line whose exact attachment point isn't tracked, such as inside a
       <pgn-player> variation's flat comment list) — parentNode.fen is
       the best available anchor. Still subject to the move-number
       mismatch check below. */
    branchFen = parentNode.fen;
  } else {
    var variationColor;
    if (firstMoveNumberToken && firstMoveNumberToken.value.includes("...")) {
      variationColor = "b";
    } else if (firstMoveNumberToken) {
      variationColor = "w";
    } else {
      variationColor = current.color === "w" ? "b" : "w";
    }

    var nextToMove = current.color === "w" ? "b" : "w";

    branchFen = variationColor === nextToMove
      ? current.fen
      : (current.parent && current.parent.fen ? current.parent.fen : parentNode.fen);
  }

  /* A variation's move-number token should match the fullmove number of
     wherever it actually branches from — real chess annotation always
     keeps these in sync (an alternate to White's 9th move is written
     "(9. ...)", never "(1. ...)"). When they disagree — e.g. a comment
     restarts "1." deep into a much later position, or right after
     Black's own first move, where the natural next move would properly
     be numbered 2 — the supposed "variation" is virtually always an
     unrelated illustrative reference (often naming a different opening)
     rather than a genuine alternate to the current move. Play it from
     the standard starting position instead of branching off the current
     game state. */
  if (firstMoveNumberToken) {
    var parsedNum = parseInt(firstMoveNumberToken.value, 10);
    var branchMoveNum = parseInt(branchFen.split(" ")[5], 10) || 1;
    if (parsedNum !== branchMoveNum) {
      return new Chess().fen();
    }
  }

  return branchFen;
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

  var hasPlayers = !!(headers.White || headers.Black);
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
  emojiSpan.style.setProperty("--icon", lucideIconUrl("text-initial"));
  title.appendChild(emojiSpan);

  var textDiv = document.createElement("div");
  textDiv.className = "video-title-text";

  if (hasPlayers) {
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
  } else if (eventLine) {
    var eventOnly = document.createElement("div");
    eventOnly.className = "video-title-players";
    eventOnly.textContent = eventLine;
    textDiv.appendChild(eventOnly);
  }

  title.appendChild(textDiv);
  container.appendChild(title);
}

export function renderMoveTree(rootNode, container, headers) {
  var movesDiv = document.createElement("div");
  movesDiv.className = "pgn-moves";

  /* [D]/[P] before the first move — diagram of the starting position,
     rendered first (diagram-then-text, same order as a mid-game
     comment's parts). */
  if (rootNode.startDiagram) {
    createBoard(movesDiv, rootNode.startDiagram.fen, rootNode.startDiagram);
  }

  if (rootNode.preComments && rootNode.preComments.length) {
    for (var pc = 0; pc < rootNode.preComments.length; pc++) {
      var preP = document.createElement("p");
      preP.className = "pgn-comment";
      preP.innerHTML = formatComment(rootNode.preComments[pc]);
      movesDiv.appendChild(preP);
    }
  }

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
  return nagsToGlyph(nags) || "";
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
               contain no HTML-special characters). needsMoveNumber is
               still set so a black move right after the comment gets
               its "N..." prefix reprinted — otherwise, reading "Qd5"
               straight after a full sentence looks like an unnumbered
               continuation instead of a fresh move. */
            buffer += formatComment(part.value) + " ";
            needsMoveNumber = true;
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

