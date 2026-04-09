/**
 * ChessPublica — Shared constants, utilities, and helpers
 *
 * Merged from: config.js, figurine.js, puzzle-helpers.js
 */

/* ================================================================
   CONSTANTS
================================================================ */

export var PIECE_THEME =
  "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png";

export var NBSP = "\u00A0";

/* ================================================================
   FETCH HELPER
================================================================ */

/**
 * Fetch a text resource with cache-busting.
 * Returns a Promise<string>.
 */
export function fetchText(url) {
  return fetch(url, { cache: "no-store" }).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.text();
  });
}

/* ================================================================
   FIGURINE NOTATION
================================================================ */

var FIGURINES = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
};

export function toFigurine(san) {
  if (!san) return san;
  var result = san;
  var firstChar = san.charAt(0);
  if (FIGURINES[firstChar]) {
    result = FIGURINES[firstChar] + san.slice(1);
  }
  result = result.replace(/=([KQRBN])/g, function (_, piece) {
    return "=" + FIGURINES[piece];
  });
  return result;
}

export function stripFigurines(s) {
  return String(s || "").replace(/[♔♕♖♗♘♙♚♛♜♝♞♟]/g, "");
}

/* ================================================================
   COMMENT FORMATTING (inline markdown + safe HTML)
================================================================ */

/* Tags that are safe to render inside a PGN comment. Values are the
   list of attributes that are kept on that tag; all other attributes
   are stripped. */
var ALLOWED_COMMENT_TAGS = {
  br: [], b: [], strong: [], i: [], em: [], u: [], s: [], del: [], ins: [],
  code: [], kbd: [], mark: [], small: [], sub: [], sup: [], span: [],
  a: ["href", "title"]
};

/* Only http(s), mailto, fragment and same-origin paths are allowed as
   link hrefs — blocks javascript: and data: URLs. */
var SAFE_URL_RE = /^(?:https?:|mailto:|#|\/)/i;

function _applyInlineMarkdown(text) {

  /* Protect code spans first so their contents bypass further
     markdown substitution. */
  var codes = [];
  text = text.replace(/`([^`\n]+)`/g, function (_m, code) {
    var idx = codes.push("<code>" + code + "</code>") - 1;
    return "\u0000CODE" + idx + "\u0000";
  });

  /* Bold: **text** and __text__ */
  text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");

  /* Italic: *text* and _text_. The look-behind/ahead prevents matching
     inside an already-replaced <strong>…</strong> span. */
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  text = text.replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");

  /* Links [label](url) */
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_m, label, url) {
    return '<a href="' + url + '">' + label + "</a>";
  });

  /* Restore protected code spans */
  text = text.replace(/\u0000CODE(\d+)\u0000/g, function (_m, i) {
    return codes[+i];
  });

  return text;
}

function _sanitizeCommentDOM(root) {
  var children = Array.prototype.slice.call(root.childNodes);
  for (var i = 0; i < children.length; i++) {
    var child = children[i];

    /* Strip comment and processing-instruction nodes */
    if (child.nodeType !== 1 && child.nodeType !== 3) {
      child.remove();
      continue;
    }
    if (child.nodeType !== 1) continue;

    var tag = child.tagName.toLowerCase();

    if (ALLOWED_COMMENT_TAGS.hasOwnProperty(tag)) {
      var allowed = ALLOWED_COMMENT_TAGS[tag];
      var attrs = Array.prototype.slice.call(child.attributes);
      for (var a = 0; a < attrs.length; a++) {
        var name = attrs[a].name;
        if (allowed.indexOf(name) === -1) {
          child.removeAttribute(name);
          continue;
        }
        if (name === "href") {
          var val = attrs[a].value.trim();
          if (!SAFE_URL_RE.test(val)) {
            child.removeAttribute("href");
          }
        }
      }
      _sanitizeCommentDOM(child);
    } else {
      /* Disallowed tag: unwrap (keep its sanitized children) then drop */
      _sanitizeCommentDOM(child);
      while (child.firstChild) {
        child.parentNode.insertBefore(child.firstChild, child);
      }
      child.remove();
    }
  }
}

/**
 * Render a raw PGN comment as a sanitized HTML fragment.
 *
 * Accepts a small subset of inline markdown (**bold**, *italic*, `code`,
 * [link](url)) and an allowlist of inline HTML tags (<br>, <strong>,
 * <em>, <code>, <a href>, …). Anything outside the allowlist — scripts,
 * event handlers, style attributes, javascript: URLs — is stripped.
 */
export function formatComment(rawText) {
  if (rawText == null) return "";
  var html = _applyInlineMarkdown(String(rawText));
  var tpl = document.createElement("template");
  tpl.innerHTML = html;
  _sanitizeCommentDOM(tpl.content);
  return tpl.innerHTML;
}

/* ================================================================
   TEXT / SAN NORMALIZATION
================================================================ */

export function normalizePuzzleText(s) {
  return String(s || "")
    .replace(/\r/g, "")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*:\s*/g, ": ")
    .trim();
}

export function normalizeSAN(s) {
  return String(s || "")
    .replace(/[+#?!]/g, "")
    .replace(/0-0-0/g, "O-O-O")
    .replace(/0-0/g, "O-O")
    .trim();
}

/* ================================================================
   PGN GAME SPLITTING
================================================================ */

/**
 * Split a multi-game PGN string into individual game strings.
 * Shared by puzzle-block, puzzle-rush, and any future multi-game consumer.
 */
export function splitIntoPgnGames(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n(?=\s*\[)/)
    .filter(Boolean);
}

/* ================================================================
   MOVE TOKENIZER
================================================================ */

export function tokenizeMoves(text) {
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
    .map(function (t) { return t.trim(); })
    .filter(function (t) { return t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t); });
}

/**
 * Parse PGN-ish move text into parallel arrays of SAN moves and the
 * comments attached to them. Comments in {braces} attach to the most
 * recent mainline move. Multiple comments on the same move are joined
 * with a single space. Variations (in parens) and their inner comments
 * are ignored.
 *
 * Returns { moves: string[], comments: (string|null)[] } with
 * comments.length === moves.length.
 */
export function parseMovesWithComments(text) {
  var s = String(text || "").replace(/;[^\n]*/g, " ");

  var moves = [];
  var comments = [];
  var i = 0;

  while (i < s.length) {
    var ch = s[i];

    /* Brace comment — attach to the most recent move. The full content
       between { and the matching } is taken verbatim, so parentheses
       inside the comment (e.g. a textual "(1. Re1? …)" reference) are
       kept, not treated as variations. */
    if (ch === "{") {
      var j = i + 1;
      while (j < s.length && s[j] !== "}") j++;
      var cm = s.slice(i + 1, j).trim();
      if (cm && moves.length > 0) {
        var idx = moves.length - 1;
        comments[idx] = comments[idx] ? comments[idx] + " " + cm : cm;
      }
      i = j + 1;
      continue;
    }

    /* Variation — skip everything up to the matching ), correctly
       handling nested parens and brace-comments that happen to sit
       inside the variation. */
    if (ch === "(") {
      var depth = 1;
      var k = i + 1;
      while (k < s.length && depth > 0) {
        var kc = s[k];
        if (kc === "(") {
          depth++; k++;
        } else if (kc === ")") {
          depth--; k++;
        } else if (kc === "{") {
          k++;
          while (k < s.length && s[k] !== "}") k++;
          if (k < s.length) k++;
        } else {
          k++;
        }
      }
      i = k;
      continue;
    }

    if (/\s/.test(ch)) { i++; continue; }

    var rest = s.slice(i);

    /* Result */
    var rs = rest.match(/^(1-0|0-1|1\/2-1\/2|\*)/);
    if (rs) { i += rs[0].length; continue; }

    /* Move-number prefix (e.g. "12." or "12...") */
    var mn = rest.match(/^\d+\.(?:\.\.)?/);
    if (mn) { i += mn[0].length; continue; }

    /* NAG $n */
    var nag = rest.match(/^\$\d+/);
    if (nag) { i += nag[0].length; continue; }

    /* SAN move (with optional !? suffix) */
    var mv = rest.match(
      /^(?:O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|[a-h][1-8])[+#]?[!?]*/
    );
    if (mv) {
      moves.push(mv[0].replace(/[!?]+$/, ""));
      comments.push(null);
      i += mv[0].length;
      continue;
    }

    i++;
  }

  return { moves: moves, comments: comments };
}

/* ================================================================
   PUZZLE GAME PARSER
================================================================ */

var DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function parseGame(pgn) {
  var raw = String(pgn || "").replace(/\r/g, "").trim();
  if (!raw) return { error: true };

  function getHeader(name) {
    var m = raw.match(new RegExp("\\[" + name + '\\s+"([^"]+)"\\]', "i"));
    return m ? m[1] : null;
  }

  var fen = getHeader("FEN");
  var firstMoveAuto = String(getHeader("FirstMoveAuto")).toLowerCase() === "true";
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
      var moves = tokenizeMoves(movesMatch[1]);
      if (!moves.length) return { error: true };
      return {
        fen: fenMatch[1].trim(),
        moves: moves,
        comments: new Array(moves.length).fill(null),
        firstMoveAuto: false,
        orientation: null,
      };
    }
  }

  /* Header style */
  var lines = raw.split("\n");
  var moveText = lines
    .filter(function (line) { return !/^\s*\[[^\]]+\]\s*$/.test(line); })
    .join(" ")
    .trim();
  var parsedMoves = parseMovesWithComments(moveText);
  var moves2 = parsedMoves.moves;

  if (!moves2.length) return { error: true };
  if (!fen) fen = DEFAULT_FEN;

  return {
    fen: fen,
    moves: moves2,
    comments: parsedMoves.comments,
    firstMoveAuto: firstMoveAuto,
    orientation: orientation,
  };
}