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
   MOVE-QUALITY BADGE
================================================================ */

var GLYPH_META = {
  "!!": { label: "!!", color: "#1aa34a" },
  "!":  { label: "!",  color: "#00AA00" },
  "!?": { label: "!?", color: "#0000FF" },
  "?!": { label: "?!", color: "#FFAA00" },
  "?":  { label: "?",  color: "#FF0000" },
  "??": { label: "??", color: "#9c0202" },
};

/* Move-quality NAGs: six inline suffixes (identity mappings) plus the
   matching $1-$6 codes and the extended evaluation/positional NAG codes
   used by static move-list renderers. */
export var NAG_TO_GLYPH = {
  "!!": "!!", "??": "??", "!?": "!?", "?!": "?!", "!": "!", "?": "?",
  "$1": "!",  "$2": "?",  "$3": "!!", "$4": "??", "$5": "!?", "$6": "?!",
  "$7": "□",  "$10": "=", "$13": "∞",
  "$14": "⩲", "$15": "⩱", "$16": "±", "$17": "∓", "$18": "+−", "$19": "−+",
};

/**
 * Scan a list of NAG tokens and return the first one that maps to a
 * move-quality glyph. Used to pick a badge when a move carries several
 * NAGs. Returns null when no known glyph is present.
 */
export function nagsToGlyph(nags) {
  if (!nags) return null;
  for (var i = 0; i < nags.length; i++) {
    var g = NAG_TO_GLYPH[nags[i]];
    if (g) return g;
  }
  return null;
}

/**
 * Derive the destination square from a SAN string.
 * e.g. "Nf3" → "f3", "O-O" (white) → "g1", "exd5" → "d5".
 */
export function getDestinationSquare(san, color) {
  if (/^O-O-O/.test(san)) return color === "w" ? "c1" : "c8";
  if (/^O-O/.test(san))   return color === "w" ? "g1" : "g8";
  var m = san.match(/([a-h][1-8])/g);
  return m ? m[m.length - 1] : null;
}

/**
 * Render a move-quality badge (!, !!, ?, …) on a destination square
 * of the given board element.  Clears any existing badge first.
 *
 * @param {HTMLElement} boardEl – element passed to Chessboard() (has data-square children)
 * @param {string}      square  – e.g. "e4"
 * @param {string}      glyph   – e.g. "!" or "??"
 */
export function renderMoveQualityBadge(boardEl, square, glyph) {
  clearMoveQualityBadge(boardEl);
  if (!square || !glyph) return;

  var meta = GLYPH_META[glyph];
  if (!meta) return;

  var squareEl = boardEl.querySelector('[data-square="' + square + '"]');
  if (!squareEl) return;

  var badge = document.createElement("div");
  badge.className = "gm-badge";
  badge.textContent = meta.label;
  badge.style.background = meta.color;

  var boardRect  = boardEl.getBoundingClientRect();
  var squareRect = squareEl.getBoundingClientRect();

  badge.style.position = "absolute";
  badge.style.right = (boardRect.right - squareRect.right + squareRect.width * 0.05) + "px";
  badge.style.top   = (squareRect.top  - boardRect.top   - squareRect.height * 0.05) + "px";
  badge.style.zIndex = "30";

  boardEl.appendChild(badge);
}

export function clearMoveQualityBadge(boardEl) {
  var old = boardEl.querySelector(".gm-badge");
  if (old) old.remove();
}

/* ================================================================
   FETCH HELPER
================================================================ */

/**
 * Fetch a text resource.
 * Returns a Promise<string>.
 */
export function fetchText(url) {
  return fetch(url).then(function (r) {
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
  code: [], kbd: [], mark: [], small: [], sub: [], sup: [],
  span: ["class", "data-san"],
  a: ["href", "title"]
};

/* Classes that may appear on <span> in sanitized comments.  Arbitrary
   class names are stripped to prevent style/layout injection via the
   sanitizer, but our own inline-move spans need to keep their class
   so the puzzle engine can style/target them. */
var ALLOWED_SPAN_CLASSES = /^jc-inline-move$/;

/* Only http(s), mailto, fragment and same-origin paths are allowed as
   link hrefs — blocks javascript: and data: URLs. */
var SAFE_URL_RE = /^(?:https?:|mailto:|#|\/)/i;

/**
 * Convert SAN piece-move patterns in HTML-mixed text to figurine
 * notation.  The first alternative (<[^>]*>) matches and preserves
 * HTML tags so that piece letters inside tag names (<br>, <b>) and
 * attribute values (href URLs) are left untouched.  The preceding-
 * character check is done via the callback's offset rather than a
 * consumed group, so moves immediately after a closing ">" are
 * still converted.
 */
function _applyFigurineNotation(html) {
  /* Piece moves: Nf3, Bxe5+, Nbd7, R1e1, Qh4#, etc. */
  html = html.replace(
    /<[^>]*>|(([KQRBN])([a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#!?]*))/g,
    function (m, _full, piece, rest, offset, str) {
      if (piece == null) return m;
      if (offset > 0 && /[a-zA-Z]/.test(str[offset - 1])) return m;
      return FIGURINES[piece] + rest.replace(/=([QRBN])/, function (__, p) {
        return "=" + FIGURINES[p];
      });
    }
  );
  /* Pawn promotions: e8=Q+, bxa1=R#, etc. */
  html = html.replace(
    /<[^>]*>|(([a-h](?:x[a-h])?[18])=([QRBN])([+#!?]*))/g,
    function (m, _full, pawn, piece, suffix, offset, str) {
      if (piece == null) return m;
      if (offset > 0 && /[a-zA-Z]/.test(str[offset - 1])) return m;
      return pawn + "=" + FIGURINES[piece] + (suffix || "");
    }
  );
  return html;
}

function _applyInlineMarkdown(text) {

  /* Protect code spans first so their contents bypass further
     markdown substitution. */
  var codes = [];
  text = text.replace(/`([^`\n]+)`/g, function (_m, code) {
    var idx = codes.push("<code>" + code + "</code>") - 1;
    return "\u0000CODE" + idx + "\u0000";
  });

  /* Convert literal \n escape sequences to actual newlines */
  text = text.replace(/\\n/g, "\n");

  /* Line breaks: two or more spaces at end of line followed by newline,
     or a single newline (from converted \n or actual line in PGN) */
  text = text.replace(/  +\n|\n/g, "<br>\n");

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

  /* Chess notation → figurine symbols.  Applied after markdown so that
     HTML tags produced by the conversions above (e.g. <strong>, <a>)
     are properly skipped by the tag-aware regex. */
  text = _applyFigurineNotation(text);

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
        if (name === "class" && tag === "span") {
          if (!ALLOWED_SPAN_CLASSES.test(attrs[a].value)) {
            child.removeAttribute("class");
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

/* Wrap SAN tokens ("Re1", "e4", "Bxe5+", "O-O") in prose text with a
   clickable <span class="jc-inline-move" data-san="…">…</span>.  The
   first alternative (<[^>]*>) consumes HTML tags and attribute values
   so SAN-shaped substrings inside those are not touched, mirroring
   the tag-aware technique used by _applyFigurineNotation.  Must run
   BEFORE figurine conversion so the data-san attribute keeps the
   letter-based SAN that chess.js understands. */
function _wrapInlineSanMoves(text) {
  return text.replace(
    /<[^>]*>|(\b(?:O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h](?:x[a-h])?[1-8](?:=[QRBN])?[+#]?)\b)/g,
    function (m, san, offset, str) {
      if (!san) return m;
      if (offset > 0 && /[a-zA-Z0-9]/.test(str[offset - 1])) return m;
      return '<span class="jc-inline-move" data-san="' + san + '">' + san + '</span>';
    },
  );
}

/**
 * Like formatComment() but additionally wraps SAN move tokens inside
 * the comment text in clickable spans so the caller can attach click
 * handlers.  Used by the puzzle engine when a side-line variation is
 * triggered — the variation's instructive move list is rendered as
 * individually clickable spans that replay the line on the board.
 */
export function formatCommentClickable(rawText) {
  if (rawText == null) return "";

  /* Re-implement the _applyInlineMarkdown pipeline so the SAN wrap
     step can slot in between the markdown transforms and the figurine
     conversion.  Keeping formatComment() untouched avoids introducing
     clickable spans into places that don't want them. */
  var codes = [];
  var text = String(rawText);

  text = text.replace(/`([^`\n]+)`/g, function (_m, code) {
    var idx = codes.push("<code>" + code + "</code>") - 1;
    return "\u0000CODE" + idx + "\u0000";
  });

  /* Convert literal \n escape sequences to actual newlines */
  text = text.replace(/\\n/g, "\n");

  /* Line breaks: two or more spaces at end of line followed by newline,
     or a single newline (from converted \n or actual line in PGN) */
  text = text.replace(/  +\n|\n/g, "<br>\n");

  text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  text = text.replace(/(^|[^_\w])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_m, label, url) {
    return '<a href="' + url + '">' + label + "</a>";
  });

  text = _wrapInlineSanMoves(text);
  text = _applyFigurineNotation(text);

  text = text.replace(/\u0000CODE(\d+)\u0000/g, function (_m, i) {
    return codes[+i];
  });

  var tpl = document.createElement("template");
  tpl.innerHTML = text;
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

/* Lichess-style inline annotations inside PGN comments:
     [%csl Gc5,Rd5]      coloured squares
     [%cal Ga2a4,Re4e5]  coloured arrows
   Colour prefixes: R (red), G (green), B (blue), Y (yellow). */
var _RE_CSL = /\[%csl\s+([^\]]+)\]/g;
var _RE_CAL = /\[%cal\s+([^\]]+)\]/g;
var _RE_BRACKET_ANNOT = /\[%[^\]]*\]/g;

/* Parentheticals that start with a move number are inline PGN variations.
   Plain prose like "(Grob's Attack)" does NOT start with digits+dots. */
var _RE_PGN_PAREN = /\(\s*\d+\.+[^()]*\)/g;

/**
 * Strip [%…] annotation tags, [D] diagram markers, and move-number-led
 * parentheticals (inline PGN variations) from a raw comment string.
 * Plain-text parentheticals like "(Grob's Attack)" are preserved.
 * Shared by pgn.js and pgn-player.js so both renderers produce identical
 * comment text before passing it to formatComment().
 */
export function stripCommentAnnotations(raw) {
  return String(raw || "")
    .replace(_RE_PGN_PAREN, "")
    .replace(_RE_BRACKET_ANNOT, "")
    .replace(/\[D\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseCSL(data) {
  return String(data || "").split(",").map(function (entry) {
    entry = entry.trim();
    return { color: entry[0], square: entry.slice(1) };
  }).filter(function (m) {
    return m.color && /^[a-h][1-8]$/.test(m.square);
  });
}

export function parseCAL(data) {
  return String(data || "").split(",").map(function (entry) {
    entry = entry.trim();
    return { color: entry[0], from: entry.slice(1, 3), to: entry.slice(3, 5) };
  }).filter(function (a) {
    return a.color && /^[a-h][1-8]$/.test(a.from) && /^[a-h][1-8]$/.test(a.to);
  });
}

/**
 * Parse PGN-ish move text into parallel arrays of SAN moves, the
 * comments attached to them, and any variations branching off them.
 * Comments in {braces} attach to the most recent mainline move.
 * Multiple comments on the same move are joined with a single space.
 * Variations (in parens) are recursively parsed and attached to the
 * mainline move they branch from — so variations[i] is either null or
 * an array of { moves, comments, variations } objects.
 *
 * Inline [%csl …] / [%cal …] annotations inside a comment are pulled
 * out and returned in parallel `squareMarks` / `arrows` arrays so
 * consumers can render them as overlays.  The annotation text itself
 * is stripped from the comment string.
 *
 * Returns { moves, comments, variations, glyphs, arrows, squareMarks }
 * with all arrays having length === moves.length.
 */
export function parseMovesWithComments(text) {
  var s = String(text || "").replace(/;[^\n]*/g, " ");

  var moves = [];
  var comments = [];
  var variations = [];
  var glyphs = [];
  var arrows = [];
  var squareMarks = [];
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
      var rawCm = s.slice(i + 1, j);

      /* Extract annotations before cleaning the text. */
      var newSquareMarks = [];
      var newArrows = [];
      var am;
      _RE_CSL.lastIndex = 0;
      while ((am = _RE_CSL.exec(rawCm))) {
        newSquareMarks = newSquareMarks.concat(parseCSL(am[1]));
      }
      _RE_CAL.lastIndex = 0;
      while ((am = _RE_CAL.exec(rawCm))) {
        newArrows = newArrows.concat(parseCAL(am[1]));
      }

      var cm = rawCm.replace(_RE_BRACKET_ANNOT, "").replace(/\s+/g, " ").trim();

      if (moves.length > 0) {
        var idx = moves.length - 1;
        if (cm) {
          comments[idx] = comments[idx] ? comments[idx] + " " + cm : cm;
        }
        if (newSquareMarks.length) {
          squareMarks[idx] = (squareMarks[idx] || []).concat(newSquareMarks);
        }
        if (newArrows.length) {
          arrows[idx] = (arrows[idx] || []).concat(newArrows);
        }
      }
      i = j + 1;
      continue;
    }

    /* Variation — scan to the matching ), correctly handling nested
       parens and brace-comments inside the variation, then recursively
       parse the inner content and attach to the most recent mainline
       move. */
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
      /* When depth reached 0, k is one past the matching ')'. When we
         ran off the end (malformed), treat the rest of the string as
         the variation body. */
      var innerEnd = (depth === 0) ? k - 1 : k;
      var inner = s.slice(i + 1, innerEnd);
      if (moves.length > 0) {
        var parsed = parseMovesWithComments(inner);
        if (parsed.moves.length > 0) {
          var vidx = moves.length - 1;
          if (!variations[vidx]) variations[vidx] = [];
          variations[vidx].push(parsed);
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

    /* NAG $n — attach glyph to the most recent move */
    var nag = rest.match(/^\$\d+/);
    if (nag) {
      if (moves.length > 0 && !glyphs[moves.length - 1]) {
        var nagGlyph = NAG_TO_GLYPH[nag[0]];
        if (nagGlyph) glyphs[moves.length - 1] = nagGlyph;
      }
      i += nag[0].length;
      continue;
    }

    /* SAN move (with optional !? suffix) */
    var mv = rest.match(
      /^(?:O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|[a-h][1-8])[+#]?[!?]*/
    );
    if (mv) {
      var suffixMatch = mv[0].match(/[!?]+$/);
      moves.push(mv[0].replace(/[!?]+$/, ""));
      comments.push(null);
      variations.push(null);
      glyphs.push(suffixMatch ? suffixMatch[0] : null);
      arrows.push(null);
      squareMarks.push(null);
      i += mv[0].length;
      continue;
    }

    i++;
  }

  return {
    moves: moves,
    comments: comments,
    variations: variations,
    glyphs: glyphs,
    arrows: arrows,
    squareMarks: squareMarks,
  };
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
        variations: new Array(moves.length).fill(null),
        glyphs: new Array(moves.length).fill(null),
        arrows: new Array(moves.length).fill(null),
        squareMarks: new Array(moves.length).fill(null),
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
    variations: parsedMoves.variations || [],
    glyphs: parsedMoves.glyphs || [],
    arrows: parsedMoves.arrows || [],
    squareMarks: parsedMoves.squareMarks || [],
    firstMoveAuto: firstMoveAuto,
    orientation: orientation,
  };
}