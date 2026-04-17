/* ChessPublica — Element Initializers */

import {
  PIECE_THEME,
  fetchText,
  splitIntoPgnGames,
  toFigurine,
  parseCAL,
  parseCSL,
} from "./helpers.js";
import { renderFullPGN } from "./pgn.js";
import { renderAnnotations } from "./board.js";
import { jcPuzzleCreate } from "./puzzle.js";

/* ── Error helper ─────────────────────────────────────────── */

function showError(wrapper, message) {
  wrapper.innerHTML = "";
  var err = document.createElement("div");
  err.className = "jc-error";
  err.style.color = "red";
  err.style.fontFamily = "monospace";
  err.style.whiteSpace = "pre-wrap";
  err.style.padding = "0.5rem";
  err.style.border = "1px solid red";
  err.style.margin = "1rem 0";
  err.textContent = "ChessPublica error: " + message;
  wrapper.appendChild(err);
}

/* ── Header parsing ───────────────────────────────────────── */

function parseHeader(text, name) {
  var m = text.match(new RegExp("\\[" + name + '\\s+"([^"]*)"\\]', "i"));
  return m ? m[1] : null;
}

function isBracketHeaderForm(text) {
  return /\[\s*\w+\s+"[^"]*"\s*\]/.test(text);
}

/* ── <pgn> ────────────────────────────────────────────────── */

function initCustomElements(selector, wrapperClass, renderFn, opts) {
  var preserveInlineHTML = !!(opts && opts.preserveInlineHTML);

  document.querySelectorAll(selector).forEach(function (el) {
    if (el.dataset.jcRendered === "1") return;
    el.dataset.jcRendered = "1";

    /* For <pgn> we read innerHTML (not textContent) so that inline HTML
       the author put inside comments — e.g. <br>, <strong>, Kramdown-
       produced <em>…</em> from *italic* — survives into the tokenizer
       and can be rendered by the sanitizing formatComment() helper. */
    var inlineRaw = preserveInlineHTML
      ? el.innerHTML
      : el.textContent;

    var wrapper = document.createElement("div");
    wrapper.className = wrapperClass;
    el.replaceWith(wrapper);

    var src = el.getAttribute("src");

    if (src) {
      fetchText(src)
        .then(function (text) {
          try {
            renderFn(text, wrapper);
          } catch (e) {
            showError(wrapper, "failed to render <" + selector + "> from " + src + ": " + e.message);
          }
        })
        .catch(function (e) {
          showError(wrapper, "failed to load " + src + ": " + e.message);
        });
    } else {
      var text = inlineRaw.trim();
      if (!text) {
        showError(wrapper, "<" + selector + "> is empty (no inline content and no src attribute).");
        return;
      }
      try {
        renderFn(text, wrapper);
      } catch (e) {
        showError(wrapper, "failed to render <" + selector + ">: " + e.message);
      }
    }
  });
}

export function initPgnElements() {
  initCustomElements("pgn", "pgn-container game-card", renderFullPGN, {
    preserveInlineHTML: true,
  });
}

/* ── <fen> ────────────────────────────────────────────────── */

function validateFen(fen) {
  if (typeof Chess === "undefined") return true; // can't validate without chess.js
  try {
    var c = new Chess();
    if (typeof c.validate_fen === "function") {
      var v = c.validate_fen(fen);
      return v && v.valid;
    }
    return new Chess(fen) && true;
  } catch (e) {
    return false;
  }
}

export function initFenElements() {
  document.querySelectorAll("fen").forEach(function (el) {
    if (el.dataset.jcRendered === "1") return;
    el.dataset.jcRendered = "1";

    var raw = el.textContent.trim();
    var wrapper = document.createElement("div");
    wrapper.className = "fen-container";
    el.replaceWith(wrapper);

    if (!raw) {
      showError(wrapper, "<fen> element is empty.");
      return;
    }

    var fenStr;
    var caption = el.getAttribute("caption") || "";
    var orientation = (el.getAttribute("orientation") || "").toLowerCase();

    if (isBracketHeaderForm(raw)) {
      fenStr = parseHeader(raw, "FEN");
      var capHdr = parseHeader(raw, "Caption");
      var oriHdr = parseHeader(raw, "Orientation");
      if (capHdr) caption = capHdr;
      if (oriHdr) orientation = oriHdr.toLowerCase();
      if (!fenStr) {
        showError(wrapper, '<fen> bracket-header form requires a [FEN "..."] header.');
        return;
      }
    } else {
      /* Raw-FEN form: strip any {brace blocks} so Lichess-style
         annotation tags (e.g. {[%csl Ge4]}) may follow the FEN line. */
      fenStr = raw.replace(/\{[^}]*\}/g, "").trim();
    }

    if (!validateFen(fenStr)) {
      showError(wrapper, "invalid FEN string: " + fenStr);
      return;
    }

    if (orientation && orientation !== "white" && orientation !== "black") {
      showError(wrapper, 'invalid Orientation "' + orientation + '" — must be "white" or "black".');
      return;
    }

    /* Parse [%csl ...] and [%cal ...] annotations from anywhere in the
       raw element content. Both bracket-header and raw-FEN forms are
       supported — tags may live inside {brace comments} or stand alone. */
    var squareMarks = [];
    var arrows = [];
    var cslRe = /\[%csl\s+([^\]]+)\]/g;
    var calRe = /\[%cal\s+([^\]]+)\]/g;
    var m;
    while ((m = cslRe.exec(raw))) squareMarks = squareMarks.concat(parseCSL(m[1]));
    while ((m = calRe.exec(raw))) arrows = arrows.concat(parseCAL(m[1]));

    var boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";
    wrapper.appendChild(boardDiv);

    if (caption) {
      var cap = document.createElement("div");
      cap.className = "fen-caption";
      cap.textContent = caption;
      wrapper.appendChild(cap);
    }

    requestAnimationFrame(function () {
      try {
        Chessboard(boardDiv, {
          position: fenStr,
          orientation: orientation || "white",
          pieceTheme: PIECE_THEME,
        });
        if (squareMarks.length || arrows.length) {
          renderAnnotations(boardDiv, {
            squareMarks: squareMarks,
            arrows: arrows,
          });
        }
      } catch (e) {
        showError(wrapper, "failed to render board: " + e.message);
      }
    });
  });
}

/* ── <puzzle> ─────────────────────────────────────────────── */

function renderPuzzleHeader(wrapper, raw, packInfo) {
  var white = parseHeader(raw, "White");
  var black = parseHeader(raw, "Black");
  var event = parseHeader(raw, "Event");
  var date = parseHeader(raw, "Date");
  var caption = parseHeader(raw, "Caption");

  var line1 = "";
  var line2 = "";

  if (packInfo) {
    line1 = "Puzzle " + packInfo.index + " / " + packInfo.total;
    var packParts = [];
    if (event) packParts.push(event);
    if (date) packParts.push(date);
    line2 = packParts.join(", ");
  } else {
    if (white || black) line1 = (white || "?") + " — " + (black || "?");
    var parts = [];
    if (event) parts.push(event);
    if (date) parts.push(date);
    line2 = parts.join(", ");
    if (!line1 && line2) {
      line1 = line2;
      line2 = "";
    }
    if (!line1) line1 = "Puzzle";
  }

  {
    var title = document.createElement("div");
    title.className = "video-title jc-puzzle-title";

    var emojiSpan = document.createElement("span");
    emojiSpan.className = "video-title-emoji lucide-icon";
    emojiSpan.style.setProperty(
      "--icon",
      "url(https://unpkg.com/lucide-static@latest/icons/puzzle.svg)",
    );
    title.appendChild(emojiSpan);

    var textDiv = document.createElement("div");
    textDiv.className = "video-title-text";

    if (line1) {
      var l1 = document.createElement("div");
      l1.className = "video-title-players";
      l1.textContent = line1;
      textDiv.appendChild(l1);
    }
    if (line2) {
      var l2 = document.createElement("div");
      l2.className = "video-title-event";
      l2.textContent = line2;
      textDiv.appendChild(l2);
    }

    title.appendChild(textDiv);
    wrapper.appendChild(title);
  }

  return caption;
}

function renderPuzzleFromText(raw, wrapper) {
  if (!raw || !raw.trim()) {
    showError(wrapper, "<puzzle> is empty (no inline content and no src attribute).");
    return;
  }

  var games = splitIntoPgnGames(raw);
  if (games.length > 1) {
    games.forEach(function (game, i) {
      var sub = document.createElement("div");
      sub.className = "jc-puzzle jc-puzzle-pack-item";
      sub.style.marginBottom = "1.5rem";
      wrapper.appendChild(sub);
      renderSinglePuzzle(game, sub, { index: i + 1, total: games.length });
    });
    return;
  }

  renderSinglePuzzle(raw, wrapper);
}

function renderSinglePuzzle(raw, wrapper, packInfo) {
  var caption = renderPuzzleHeader(wrapper, raw, packInfo);

  var boardHost = document.createElement("div");
  boardHost.className = "jc-puzzle-board";
  wrapper.appendChild(boardHost);

  /* Always create the caption slot (even when no initial caption is
     set) so that per-move comments have a home to render into. */
  var cap = document.createElement("div");
  cap.className = "fen-caption";
  if (caption) cap.textContent = caption;
  wrapper.appendChild(cap);

  try {
    var before = boardHost.innerHTML;
    jcPuzzleCreate(boardHost, {
      rawPGN: raw,
      captionEl: cap,
      initialCaption: caption || "",
    });
    if (boardHost.innerHTML === before) {
      showError(wrapper, "could not parse <puzzle>: missing FEN or moves.");
    }
  } catch (e) {
    showError(wrapper, "failed to render <puzzle>: " + e.message);
  }
}

export function initPuzzleElements() {
  document.querySelectorAll("puzzle").forEach(function (oldEl) {
    if (oldEl.dataset.jcRendered === "1") return;
    oldEl.dataset.jcRendered = "1";

    var wrapper = document.createElement("div");
    wrapper.className = "jc-puzzle";
    oldEl.replaceWith(wrapper);

    var src = oldEl.getAttribute("src");
    if (src) {
      fetchText(src)
        .then(function (text) { renderPuzzleFromText(text, wrapper); })
        .catch(function (e) {
          showError(wrapper, "failed to load puzzle from " + src + ": " + e.message);
        });
    } else {
      /* Read innerHTML (not textContent) so inline HTML the author
         put inside comments — <br>, <strong>, Kramdown-produced
         <em>…</em> — survives into the tokenizer and can be rendered
         by the sanitizing formatComment() helper. */
      renderPuzzleFromText(oldEl.innerHTML, wrapper);
    }
  });
}

/* ── Figurine notation in prose ───────────────────────────────────────── */

/* Matches SAN move tokens that contain a piece letter and therefore benefit
   from figurine conversion.  Pawn moves (e4, exd5 …) are left untouched.
   The trailing \b intentionally excludes "+" and "#" from the match so that
   the suffix stays in place while only the piece letter is converted. */
var _RE_PROSE_SAN = /\b(O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[KQRBN])?)\b/g;

function _figurinifyNode(node) {
  if (node.nodeType === 3 /* TEXT_NODE */) {
    var orig = node.textContent;
    _RE_PROSE_SAN.lastIndex = 0;
    var updated = orig.replace(_RE_PROSE_SAN, toFigurine);
    if (updated !== orig) node.textContent = updated;
  } else if (node.nodeType === 1 /* ELEMENT_NODE */) {
    var tag = node.tagName;
    /* Leave code blocks and other non-prose elements verbatim. */
    if (tag === "CODE" || tag === "PRE" || tag === "SCRIPT" || tag === "STYLE") return;
    for (var i = 0; i < node.childNodes.length; i++) {
      _figurinifyNode(node.childNodes[i]);
    }
  }
}

/**
 * Convert SAN piece letters to Unicode figurines in every <p> and heading
 * on the page, skipping elements that live inside chess element containers
 * (those are already handled by the chess engine).
 */
export function initFigurineProse() {
  document.querySelectorAll("p, h1, h2, h3, h4, h5, h6").forEach(function (el) {
    if (el.closest("pgn, puzzle, pgn-player, fen, .pgn-container, .jc-puzzle, .jc-board-wrapper")) return;
    _figurinifyNode(el);
  });
}

export function initAll() {
  initPgnElements();
  initFenElements();
  initPuzzleElements();
  initFigurineProse();
}
