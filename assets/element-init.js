// element-init.js
import { renderFullPGN } from "./pgn-renderer.js";
import { renderPGNReader } from "./pgn-reader.js";
import { jcPuzzleCreate } from "./puzzle.js";
import { renderPuzzleBlock } from "./puzzle-block.js";
import { renderPuzzleRush } from "./puzzle-rush.js";

// ------------------ Initializers ------------------

function initPgnElements() {
  document.querySelectorAll("pgn").forEach((el) => {
    if (el.dataset.jcRendered === "1") return;
    el.dataset.jcRendered = "1";

    const container = document.createElement("div");
    container.className = "pgn-container game-card";
    el.replaceWith(container);

    const src = el.getAttribute("src");
    if (src) {
      fetch(src, { cache: "no-store" })
        .then((res) => res.text())
        .then((text) => renderFullPGN(text, container))
        .catch((e) => {
          container.textContent = "Failed to load PGN: " + e.message;
        });
    } else {
      const pgnText = el.textContent.trim();
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

function initPgnReaderElements() {
  document.querySelectorAll("pgn-reader").forEach((el) => {
    if (el.dataset.jcRendered === "1") return;
    el.dataset.jcRendered = "1";

    const wrapper = document.createElement("div");
    wrapper.className = "pgn-reader-container";
    el.replaceWith(wrapper);

    const src = el.getAttribute("src");
    if (src) {
      fetch(src, { cache: "no-store" })
        .then((res) => res.text())
        .then((text) => renderPGNReader(text, wrapper))
        .catch((e) => {
          wrapper.textContent = "Failed to load PGN: " + e.message;
        });
    } else {
      const pgnText = el.textContent.trim();
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

function initFenElements() {
  document.querySelectorAll("fen").forEach((el) => {
    if (el.dataset.jcRendered === "1") return;
    el.dataset.jcRendered = "1";

    const fenStr = el.textContent.trim();
    if (!fenStr) return;

    const caption = el.getAttribute("caption") || "";
    const wrapper = document.createElement("div");
    wrapper.className = "fen-container";

    const boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";
    wrapper.appendChild(boardDiv);

    if (caption) {
      const cap = document.createElement("div");
      cap.className = "fen-caption";
      cap.textContent = caption;
      wrapper.appendChild(cap);
    }

    el.replaceWith(wrapper);

    requestAnimationFrame(() => {
      Chessboard(boardDiv, { position: fenStr, pieceTheme: PIECE_THEME });
    });
  });
}

function initPuzzleElements() {
  document.querySelectorAll("puzzle").forEach((oldEl) => {
    const raw = oldEl.textContent;
    const wrapper = document.createElement("div");
    wrapper.className = "jc-puzzle";
    oldEl.replaceWith(wrapper);
    jcPuzzleCreate(wrapper, { rawPGN: raw });
  });
}

function initPuzzleBlockElements() {
  document.querySelectorAll("puzzle-block").forEach(renderPuzzleBlock);
}

function initPuzzleRushElements() {
  document.querySelectorAll("puzzle-rush").forEach((node) => {
    const raw = node.textContent.trim();
    const match = raw.match(/PGN:\s*([^\s]+)/i);

    const wrap = document.createElement("div");
    node.replaceWith(wrap);

    if (match) {
      renderPuzzleRush(wrap, new URL(match[1], location.href).href);
    }
  });
}

// ------------------ Master Init ------------------

function initAll() {
  initPgnElements();
  initPgnReaderElements();
  initFenElements();
  initPuzzleRushElements();
  initPuzzleBlockElements();
  initPuzzleElements();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAll, { once: true });
} else {
  initAll();
}

export { initAll };