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
  hasDiagramMarker,
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
     [D]/[#]/[P] marker is also present — readers can't otherwise tell the
     game doesn't start from the normal array. This structural diagram is
     full-size; hasDiagramFromComment tracks separately whether a comment
     marker also asked for one, which — being a diagram inside a comment —
     renders at 75% instead (see startDiagram.fromComment below). */
  var root = { next: null, fen: chess.fen(), hasDiagram: !!fenLoaded, hasDiagramFromComment: false, variations: [] };
  parseSequence(tokens, chess, root, pgnText);
  if (root.preComments && root.next) {
    root.next.preComments = root.preComments;
  }
  if (root.hasDiagram && root.next) {
    root.next.startDiagram = {
      fen: root.fen,
      squareMarks: root.squareMarks || [],
      arrows: root.arrows || [],
      fromComment: root.hasDiagramFromComment,
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
      var beforeFen = chess.fen();
      var move = chess.move(token.value, { sloppy: true });
      if (!move) {
        /* Some PGN sources (engine-analysis dumps, copy/paste mangling)
           carry a stray illegal move buried deep in a variation. Rather
           than aborting the whole render (killing the entire game over
           one bad move several variations deep) or dropping the token
           silently (chess.move() left the position unchanged, so the
           NEXT token then gets tried from that same stale position —
           if it happens to be legal there too, e.g. a totally unrelated
           later move that coincidentally fits, it splices straight into
           the display with nothing to show anything was wrong), insert
           a visible placeholder node in its place and keep parsing from
           the same position, same as before. */
        console.error(
          "Invalid move in PGN:", token.value,
          "at move number", getMoveNumber(beforeFen),
        );

        var invalidNode = {
          san: token.value,
          invalid: true,
          fen: beforeFen,
          moveNumber: getMoveNumber(beforeFen),
          color: beforeFen.split(" ")[1] === "b" ? "b" : "w",
          next: null,
          parent: current,
          variations: [],
          parts: [],
          nags: [],
          arrows: [],
          squareMarks: [],
        };

        current.next = invalidNode;
        current = invalidNode;
        lastMoveNode = invalidNode;
        i++;
        continue;
      }

      var fen = chess.fen();
      var fenMoveNum = getMoveNumber(fen);

      var node = {
        san: token.value,
        fen: fen,
        from: move.from,
        to: move.to,
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
        /* Comment before the very first move — e.g. a [D]/[#]/[P]/[Pn]
           marker attached to a FEN-header start, or intro prose before
           move 1. [D] and [#] and [P] all mean "show a diagram here",
           same as processComment() below does for a comment attached to
           a move; the diagram here is of the game's starting position. */
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

        var hasDiagramMarker0 = hasDiagramMarker(token.value);
        var puzzleMarker = extractPuzzleMarker(token.value);
        var cleaned = stripCommentAnnotations(puzzleMarker.text);

        if (hasDiagramMarker0 || parentNode.arrows || parentNode.squareMarks || puzzleMarker.plies) {
          parentNode.hasDiagram = true;
          parentNode.hasDiagramFromComment = true;
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
      var variationRoot = { next: null, fen: branchFen, variations: [] };

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
    var inner = fromFigurine(match.slice(1, -1).trim()).replace(/\[D\]|\[#\]/g, "");

    try {
      var fakePGN = '[Event "?"]\n\n' + inner;
      var variationTokens = parsePGN(fakePGN);

      var branchFen = determineBranchFen(variationTokens, current, parentNode);
      var snapshot = new Chess(branchFen);
      var variationRoot = { next: null, fen: branchFen, variations: [] };
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

  var hasDiagramMarkerFlag = hasDiagramMarker(commentText);

  /* [P] / [Pn] puzzle marker — an interactive puzzle in <pgn-player>, but
     in this static renderer it's just a diagram, same as [D]/[#].
     Extracted before stripCommentAnnotations() since it's not part of the
     [%…] family that helper already strips. */
  var puzzleMarker = extractPuzzleMarker(commentText);

  /* ── Clean comment text (shared with pgn-player.js) ──
     stripCommentAnnotations() removes [%…] tags, [D]/[#] markers, and
     move-number-led parentheticals.  Plain prose parentheticals like
     "(Grob's Attack)" are preserved. */
  var cleaned = stripCommentAnnotations(puzzleMarker.text);

  /* Push parts in PGN order: diagram first, then text. */
  if (hasDiagramMarkerFlag || hadArrows || hadSquareMarks || puzzleMarker.plies) {
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

export function renderMoveTree(rootNode, container, headers, options) {
  var movesDiv = document.createElement("div");
  movesDiv.className = "pgn-moves";

  /* [D]/[#]/[P] before the first move — diagram of the starting position,
     rendered first (diagram-then-text, same order as a mid-game
     comment's parts). Full-size unless a comment marker is what asked
     for it (fromComment) — a diagram inside a comment renders at 75%,
     same as any other comment diagram; a bare FEN/SetUp start's diagram
     stays full-size since it isn't "inside a comment" at all. */
  if (rootNode.startDiagram) {
    var startWrapper = createBoard(movesDiv, rootNode.startDiagram.fen, rootNode.startDiagram, { small: rootNode.startDiagram.fromComment });
    markDiagramClickable(startWrapper, rootNode.startDiagram.fen, null, options, -1);
  }

  if (rootNode.preComments && rootNode.preComments.length) {
    for (var pc = 0; pc < rootNode.preComments.length; pc++) {
      var preP = document.createElement("p");
      preP.className = "pgn-comment";
      /* Same opt-in/convention as markDiagramClickable()'s own -1 for
         the starting diagram just above — moveIndex -1 is "before the
         first move" throughout <pgn-player>'s own events (goTo(0)'s
         cp-move fires with moveIndex: -1 at the starting position), so
         a host page's cp-move listener can find and highlight this
         comment there the same way it already does for any move's. */
      if (options && options.clickableMoves) preP.dataset.ply = "-1";
      preP.innerHTML = formatComment(rootNode.preComments[pc]);
      movesDiv.appendChild(preP);
    }
  }

  renderLine(rootNode, movesDiv, false, { n: 0 }, options);

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

/* Same opt-in as the .pgn-move[data-ply]/[data-fen] spans (see the
   options.clickableMoves doc comment on renderFullPGN() below) — tags a
   diagram's `.cp-board-wrapper` (returned by createBoard()) with the
   FEN (and, for a move-attached diagram, the from/to squares) a host
   page needs to jump <pgn-player> to that position. `node` is null for
   the game's opening diagram (no preceding move to draw an arrow for).

   `ply` additionally carries the same 0-based mainline ply index
   .pgn-move[data-ply] spans use — passed only for a main-line diagram
   (undefined for one inside a variation, which has no such flat index
   to give — see renderLine()'s own doc comment) — so a click handler
   already keyed off data-ply (a plain goTo(), which is what actually
   makes <pgn-player> re-evaluate whether this position is a branch
   point and needs to show a picker) treats a main-line diagram exactly
   like the move it's attached to, rather than falling back to the
   variation-preview path (showVariationPosition(), which never touches
   state.index and so never re-triggers that check) that data-fen alone
   would otherwise send it down. */
function markDiagramClickable(wrapper, fen, node, options, ply) {
  if (!wrapper || !options || !options.clickableMoves) return;
  wrapper.classList.add("pgn-clickable-diagram");
  wrapper.dataset.fen = fen;
  if (node && node.from && node.to) {
    wrapper.dataset.from = node.from;
    wrapper.dataset.to = node.to;
  }
  if (ply !== undefined && ply !== null) {
    wrapper.dataset.ply = String(ply);
  }
}

/* Walks a variation's own move chain (firstMoveNode, firstMoveNode.next,
   …) — never into nested sub-variations, which branch off individual
   moves via `.variations`/`.childrenByMove` rather than continuing this
   same `.next` chain — collecting the FEN after each move plus its
   from/to squares. Every node already carries its own post-move `.fen`
   (set during parsing) and `.from`/`.to` (added alongside the mainline
   .pgn-move[data-ply] click support), so this is just a linear read, no
   replaying the moves through chess.js again.

   `firstMoveNode.parent` is the placeholder root parseSequence() creates
   for every variation (`{ next: null, fen: branchFen }`, see the
   VARIATION branch above) — never a real move — so `.parent.fen` is
   exactly the FEN this variation branches from, giving fens[0].

   Returns { fens, verbose } shaped for VideoEngine.enterVariation():
   fens[0] is the branch position, fens[k] is the position after the
   k-th move; verbose[k-1] is that move's { from, to }. */
function collectVariationSequence(firstMoveNode) {
  var fens = [firstMoveNode.parent ? firstMoveNode.parent.fen : firstMoveNode.fen];
  var verbose = [];
  var n = firstMoveNode;
  while (n) {
    fens.push(n.fen);
    verbose.push(n.from && n.to ? { from: n.from, to: n.to } : null);
    n = n.next;
  }
  return { fens: fens, verbose: verbose };
}

function renderLine(node, parent, isVariation, plyCounter, options) {
  var current = node;
  var buffer = "";
  var lastMoveNumber = null;
  var needsMoveNumber = true;
  /* 0-based index of a variation move within *this* variation/
     sub-variation only (a fresh renderLine() call per variation, so
     this naturally resets at each nesting level) — pairs with the
     fens/verbose sequence stashed on `parent` (see the VARIATIONS
     block below) so a click handler can hand both to <pgn-player>'s
     enterVariation() and get real keyboard (arrow/space) stepping
     through the variation, not just a single-position preview. */
  var vIndex = 0;

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

    /* MOVE TEXT — a node flagged .invalid (see parseSequence's MOVE
       handling above) couldn't be played, so there's no legal SAN to
       show; print a highlighted marker in its place instead so a reader
       can see exactly where the source PGN broke, rather than the move
       silently vanishing (or worse, the next token being quietly
       replayed from this same un-advanced position as if it were the
       real continuation). Safe as raw HTML: current.san never reaches
       here (the marker text is a fixed string, not the offending SAN
       token), and flushBuffer() renders both mainline and variation
       buffers via innerHTML for exactly this reason.

       options.clickableMoves (opt-in, off by default — see
       renderFullPGN()'s doc comment) wraps every valid move — mainline
       or (sub-)variation — in a `.pgn-move` span so a reader-facing page
       can make the whole PGN clickable, not just the mainline:
         - Mainline moves carry `data-ply`, a 0-based ply index matching
           <pgn-player>'s own moveIndex (both walk the same move sequence,
           skipping invalid/unplayable moves the same way) — a listener
           can hand that straight to the player's own goTo().
         - Variation/sub-variation moves instead carry `data-fen` (and
           `data-from`/`data-to` for a last-move arrow): <pgn-player>
           tracks its own variation moves against a separate per-variation
           index space that doesn't line up with this flat counter, but
           every node here already has the FEN after that move, which is
           enough to just show the position directly (see
           <pgn-player>'s showVariationPosition()).
       Left off, this renders exactly as it did before .pgn-move existed —
       plain move text, no wrapper. */
    var moveHTML = toFigurine(current.san) + renderNAG(current.nags);
    var clickable = options && options.clickableMoves;
    buffer += (current.invalid
      ? '<span class="pgn-invalid-move">Invalid PGN</span>'
      : !clickable
        ? moveHTML
        : isVariation
          ? ('<span class="pgn-move" data-fen="' + current.fen +
              '" data-from="' + current.from + '" data-to="' + current.to +
              '" data-vindex="' + (vIndex++) + '">' +
              moveHTML + '</span>')
          : ('<span class="pgn-move" data-ply="' + (plyCounter.n++) + '">' +
              moveHTML + '</span>')) + " ";

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
               continuation instead of a fresh move.

               Wrapped in .pgn-comment-inline[data-fen] (opt-in, same as
               .pgn-move above) so a host page can find and highlight
               this exact comment once the player reaches the move it's
               attached to — current.fen is the same value .pgn-move
               just above carries, so the two need distinguishing by
               class, not just the attribute, when matching one back. */
            buffer += (clickable
              ? '<span class="pgn-comment-inline" data-fen="' + current.fen + '">' + formatComment(part.value) + '</span>'
              : formatComment(part.value)) + " ";
            needsMoveNumber = true;
          } else {
            flushBuffer(parent, buffer, isVariation);
            buffer = "";
            var p = document.createElement("p");
            p.className = "pgn-comment";
            /* Same opt-in, mainline counterpart to data-fen above —
               plyCounter.n was already incremented for this move by the
               .pgn-move span built above, so the ply it's attached to is
               one behind the counter's current value. */
            if (clickable) p.dataset.ply = String(plyCounter.n - 1);
            p.innerHTML = formatComment(part.value);
            parent.appendChild(p);
            needsMoveNumber = true;
          }
        } else if (part.type === "diagram") {
          flushBuffer(parent, buffer, isVariation);
          buffer = "";
          var diagWrapper = createBoard(parent, current.fen, current, { small: true });
          markDiagramClickable(diagWrapper, current.fen, current, options, isVariation ? undefined : plyCounter.n - 1);
          needsMoveNumber = true;
        }
      }
    }

    /* VARIATIONS */
    if (current.variations.length > 0) {
      flushBuffer(parent, buffer, isVariation);
      buffer = "";

      /* 0-based index of `current` (the move this batch of variations
         branches from) within *its own* parent sequence — the mainline's
         data-ply numbering if `current` is a mainline move, this level's
         own vIndex numbering (see above) if `current` is itself inside a
         variation. vIndex/plyCounter.n were already advanced past
         `current` above, hence the -1. Stashed on every child wrapper
         below as cpBranchIndex so a click handler can walk back UP a
         chain of nested .pgn-variation wrappers (own parent found via
         .closest()) and re-enter each ancestor level at the exact move
         it branches from — the position <pgn-player>'s
         exitToParentVariation() needs to resume at correctly, rather
         than always falling back to the very start of the game. */
      var branchIndex = isVariation ? (vIndex - 1) : (plyCounter.n - 1);

      current.variations.forEach(function (variationRoot, altIndex) {
        var variationWrapper = document.createElement("div");
        variationWrapper.className = "pgn-variation";
        parent.appendChild(variationWrapper);
        /* Stashed as plain DOM-element properties (not data-* attributes
           — these are arrays of FEN/verbose-move objects, not strings)
           so a click on any move inside — via data-vindex, its 0-based
           index into this exact sequence — can hand the whole thing to
           enterVariation() for real keyboard stepping. Only computed
           under the same clickableMoves opt-in as everything else here.

           cpBranchIndex/cpAltIndex together are this wrapper's address in
           the SAME PGN structure <pgn-player>'s own (separate) parser
           builds — cpBranchIndex identifies the move it branches from
           (see above), cpAltIndex its 0-based position among any other
           variations branching from that exact same move (current.
           variations can hold more than one). A host page walks both
           trees in lockstep — same PGN, same source order, same indices
           — to find the real, fully-populated variation object
           (moves/commentsByMove/childrenByMove/…) a DOM click here
           corresponds to, rather than reconstructing a partial one from
           scratch. */
        if (options && options.clickableMoves) {
          var seq = collectVariationSequence(variationRoot);
          variationWrapper.cpFens = seq.fens;
          variationWrapper.cpVerbose = seq.verbose;
          variationWrapper.cpBranchIndex = branchIndex;
          variationWrapper.cpAltIndex = altIndex;
        }
        renderLine(variationRoot, variationWrapper, true, plyCounter, options);
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
  /* Both buffers are innerHTML: variation buffers carry already-sanitized
     comment HTML mixed with plain SAN move text; main-line buffers only
     ever hold move text plus the fixed, code-generated "Invalid PGN"
     marker span (see renderLine()'s MOVE TEXT handling) — never raw PGN
     content, so this stays safe. */
  p.innerHTML = trimmed;
  parent.appendChild(p);
}

/**
 * @param {object} [options]
 * @param {boolean} [options.clickableMoves] — opt-in, off by default so
 *   every existing <pgn> renders exactly as before. When set:
 *     - every move (mainline and variation) is wrapped in a `.pgn-move`
 *       span carrying either `data-ply` (mainline) or
 *       `data-fen`/`data-from`/`data-to`/`data-vindex` (variation) — see
 *       renderLine() below. A variation move's `.pgn-variation` wrapper
 *       also carries the whole variation's `fens`/`verbose` sequence (as
 *       `.cpFens`/`.cpVerbose` element properties, not attributes — see
 *       collectVariationSequence()) plus `.cpBranchIndex`/`.cpAltIndex`,
 *       its address — the move it branches from, within its own parent's
 *       sequence (mainline ply, or the parent variation's own vIndex),
 *       and its position among any siblings also branching from that
 *       same move — in the *other*, separate variation tree
 *       <pgn-player>'s own parser builds. A host page can hand `.cpFens`/
 *       `.cpVerbose` straight to <pgn-player>'s enterVariation() for real
 *       keyboard (arrow-key/spacebar) stepping through the variation, not
 *       just a single-position preview, and walk `.cpBranchIndex`/
 *       `.cpAltIndex` against that other tree to find the real,
 *       fully-populated variation object (comments, diagrams, nested
 *       variations, …) this wrapper corresponds to there;
 *     - every diagram's `.cp-board-wrapper` is tagged
 *       `.pgn-clickable-diagram` with `data-fen` (and `data-from`/
 *       `data-to` when it's attached to a move) — see
 *       markDiagramClickable() below;
 *   for a host page to wire up click-to-navigate itself. Introduced for
 *   chesspublica.github.io/pgn-study/; scoped to a per-element opt-in (via
 *   <pgn clickable-moves>, read in init.js) rather than turned on
 *   globally, so no other <pgn> on the site is affected.
 */
export function renderFullPGN(pgnText, container, options) {
  try {
    var headers = parseHeaders(pgnText);
    renderHeaders(headers, container);

    var rootNode = buildMoveTree(pgnText);
    if (rootNode) {
      renderMoveTree(rootNode, container, headers, options);
    }
  } catch (e) {
    var errorDiv = document.createElement("div");
    errorDiv.className = "pgn-error";
    errorDiv.textContent = "Error parsing PGN: " + e.message;
    container.appendChild(errorDiv);
  }
}

