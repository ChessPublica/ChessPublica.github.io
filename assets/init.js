/**
 * JekyllChess — Element Initializers
 */

import { PIECE_THEME, fetchText, stripFigurines, normalizePuzzleText } from "./helpers.js";
import { renderFullPGN, renderPGNReader } from "./pgn.js";
import { jcPuzzleCreate, renderPuzzleBlock, renderPuzzleRush } from "./puzzle.js";

/* ── Init helpers ─────────────────────────────────────────── */

/**
 * Generic "replace custom element, load PGN, render" helper.
 * Eliminates the repeated fetch-or-inline pattern.
 */
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
        .then(function (text) { renderFn(text, wrapper); })
        .catch(function (e) {
          wrapper.textContent = "Failed to load PGN: " + e.message;
        });
    } else {
      var text = el.textContent.trim();
      if (!text) {
        wrapper.textContent = "No PGN content found.";
        return;
      }
      try {
        renderFn(text, wrapper);
      } catch (e) {
        wrapper.textContent = "Error rendering: " + e.message;
      }
    }
  });
}

/* ── Public init functions ────────────────────────────────── */

export function initPgnElements() {
  initCustomElements("pgn", "pgn-container game-card", renderFullPGN);
}

export function initPgnReaderElements() {
  initCustomElements("pgn-reader", "pgn-reader-container", renderPGNReader);
}

export function initFenElements() {
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

export function initPuzzleElements() {
  document.querySelectorAll("puzzle").forEach(function (oldEl) {
    var raw = oldEl.textContent;
    var wrapper = document.createElement("div");
    wrapper.className = "jc-puzzle";
    oldEl.replaceWith(wrapper);
    jcPuzzleCreate(wrapper, { rawPGN: raw });
  });
}

export function initPuzzleBlockElements() {
  document.querySelectorAll("puzzle-block").forEach(renderPuzzleBlock);
}

export function initPuzzleRushElements() {
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

export function initAll() {
  initPgnElements();
  initPgnReaderElements();
  initFenElements();
  initPuzzleRushElements();
  initPuzzleBlockElements();
  initPuzzleElements();
}