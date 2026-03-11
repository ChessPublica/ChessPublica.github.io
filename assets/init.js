/**
 * JekyllChess — Element Initializers
 */

import { PIECE_THEME } from "./config.js";
import { stripFigurines, normalizePuzzleText } from "./puzzle-helpers.js";
import { renderFullPGN } from "./pgn-renderer.js";
import { renderPGNReader } from "./pgn-reader.js";
import { jcPuzzleCreate, renderPuzzleBlock } from "./puzzle-block.js";
import { renderPuzzleRush } from "./puzzle-rush.js";

export function initPgnElements() {
  document.querySelectorAll("pgn").forEach(function (el) {
    if (el.dataset.jcRendered === "1") return;
    el.dataset.jcRendered = "1";

    var container = document.createElement("div");
    container.className = "pgn-container game-card";
    el.replaceWith(container);

    var pgnText = "";
    var src = el.getAttribute("src");

    if (src) {
      fetch(src, { cache: "no-store" })
        .then(function (res) {
          return res.text();
        })
        .then(function (text) {
          renderFullPGN(text, container);
        })
        .catch(function (e) {
          container.textContent = "Failed to load PGN: " + e.message;
        });
    } else {
      pgnText = el.textContent.trim();
      if (!pgnText) {
        container.textContent = "No PGN content found.";
        return;
      }
      try {
        renderFullPGN(pgnText, container);
      } catch (e) {
        container.textContent = "Error rendering PGN: " + e.message;
      }
    }
  });
}

export function initPgnReaderElements() {
  document.querySelectorAll("pgn-reader").forEach(function (el) {
    if (el.dataset.jcRendered === "1") return;
    el.dataset.jcRendered = "1";

    var wrapper = document.createElement("div");
    wrapper.className = "pgn-reader-container";
    el.replaceWith(wrapper);

    var src = el.getAttribute("src");

    if (src) {
      fetch(src, { cache: "no-store" })
        .then(function (res) {
          return res.text();
        })
        .then(function (text) {
          renderPGNReader(text, wrapper);
        })
        .catch(function (e) {
          wrapper.textContent = "Failed to load PGN: " + e.message;
        });
    } else {
      var pgnText = el.textContent.trim();
      if (!pgnText) {
        wrapper.textContent = "No PGN content found.";
        return;
      }
      try {
        renderPGNReader(pgnText, wrapper);
      } catch (e) {
        wrapper.textContent = "Error rendering PGN reader: " + e.message;
      }
    }
  });
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