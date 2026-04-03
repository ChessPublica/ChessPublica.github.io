/**
 * PublishChess — Element Initializers
 */

import { PIECE_THEME, fetchText } from "./helpers.js";
import { renderFullPGN } from "./pgn.js";
import { jcPuzzleCreate } from "./puzzle.js";

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

export function initAll() {
  initPgnElements();
  initFenElements();
  initPuzzleElements();
}