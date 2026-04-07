/* ChessPublica — Element Initializers */

import { PIECE_THEME, fetchText } from "./helpers.js";
import { renderFullPGN } from "./pgn.js";
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

function initCustomElements(selector, wrapperClass, renderFn) {
  document.querySelectorAll(selector).forEach(function (el) {
    if (el.dataset.jcRendered === "1") return;
    el.dataset.jcRendered = "1";

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
      var text = el.textContent.trim();
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
  initCustomElements("pgn", "pgn-container game-card", renderFullPGN);
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
      fenStr = raw;
    }

    if (!validateFen(fenStr)) {
      showError(wrapper, "invalid FEN string: " + fenStr);
      return;
    }

    if (orientation && orientation !== "white" && orientation !== "black") {
      showError(wrapper, 'invalid Orientation "' + orientation + '" — must be "white" or "black".');
      return;
    }

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
      } catch (e) {
        showError(wrapper, "failed to render board: " + e.message);
      }
    });
  });
}

/* ── <puzzle> ─────────────────────────────────────────────── */

function renderPuzzleHeader(wrapper, raw) {
  var white = parseHeader(raw, "White");
  var black = parseHeader(raw, "Black");
  var event = parseHeader(raw, "Event");
  var date = parseHeader(raw, "Date");
  var caption = parseHeader(raw, "Caption");

  if (white || black || event || date) {
    var title = document.createElement("div");
    title.className = "jc-puzzle-title";
    title.style.fontWeight = "bold";
    title.style.textAlign = "center";
    title.style.marginBottom = "0.25rem";
    var parts = [];
    if (white || black) parts.push((white || "?") + " — " + (black || "?"));
    if (event) parts.push(event);
    if (date) parts.push(date);
    title.textContent = parts.join(", ");
    wrapper.appendChild(title);
  }

  return caption;
}

function renderPuzzleFromText(raw, wrapper) {
  if (!raw || !raw.trim()) {
    showError(wrapper, "<puzzle> is empty (no inline content and no src attribute).");
    return;
  }

  var caption = renderPuzzleHeader(wrapper, raw);

  var boardHost = document.createElement("div");
  boardHost.className = "jc-puzzle-board";
  wrapper.appendChild(boardHost);

  if (caption) {
    var cap = document.createElement("div");
    cap.className = "fen-caption";
    cap.textContent = caption;
    wrapper.appendChild(cap);
  }

  try {
    var before = boardHost.innerHTML;
    jcPuzzleCreate(boardHost, { rawPGN: raw });
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
      renderPuzzleFromText(oldEl.textContent, wrapper);
    }
  });
}

export function initAll() {
  initPgnElements();
  initFenElements();
  initPuzzleElements();
}
