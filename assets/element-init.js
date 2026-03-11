/* ================================================================
   ELEMENT AUTO INITIALIZER
   Automatically initializes all JekyllChess elements
================================================================ */

import { PIECE_THEME } from "./configuration.js";

import { renderFullPGN } from "./pgn-renderer.js";
import { renderPGNReader } from "./pgn-reader.js";

import { jcPuzzleCreate } from "./puzzle.js";
import { renderPuzzleBlock } from "./puzzle-block.js";
import { renderPuzzleRush } from "./puzzle-rush.js";

/* ================================================================
   <pgn>
================================================================ */

function initPgnElements() {
  document.querySelectorAll("pgn").forEach((el) => {

    if (el.dataset.jcRendered) return;
    el.dataset.jcRendered = "1";

    const container = document.createElement("div");
    container.className = "jc-pgn";

    el.replaceWith(container);

    const src = el.getAttribute("src");

    if (src) {

      fetch(src, { cache: "no-store" })
        .then(r => r.text())
        .then(text => renderFullPGN(text, container))
        .catch(err => {
          container.textContent = "PGN load error: " + err.message;
        });

    } else {

      const pgnText = el.textContent.trim();

      if (!pgnText) {
        container.textContent = "Empty PGN.";
        return;
      }

      renderFullPGN(pgnText, container);

    }

  });
}

/* ================================================================
   <pgn-reader>
================================================================ */

function initPgnReaderElements() {

  document.querySelectorAll("pgn-reader").forEach((el) => {

    if (el.dataset.jcRendered) return;
    el.dataset.jcRendered = "1";

    const container = document.createElement("div");
    container.className = "jc-pgn-reader";

    el.replaceWith(container);

    const src = el.getAttribute("src");

    if (src) {

      fetch(src, { cache: "no-store" })
        .then(r => r.text())
        .then(text => renderPGNReader(text, container))
        .catch(err => {
          container.textContent = "PGN reader load error: " + err.message;
        });

    } else {

      const pgnText = el.textContent.trim();

      if (!pgnText) {
        container.textContent = "Empty PGN.";
        return;
      }

      renderPGNReader(pgnText, container);

    }

  });

}

/* ================================================================
   <fen>
================================================================ */

function initFenElements() {

  document.querySelectorAll("fen").forEach((el) => {

    if (el.dataset.jcRendered) return;
    el.dataset.jcRendered = "1";

    const fen = el.textContent.trim();

    if (!fen) return;

    const wrapper = document.createElement("div");
    wrapper.className = "jc-fen";

    const boardDiv = document.createElement("div");
    boardDiv.className = "jc-board";

    wrapper.appendChild(boardDiv);

    const caption = el.getAttribute("caption");

    if (caption) {

      const cap = document.createElement("div");
      cap.className = "jc-fen-caption";
      cap.textContent = caption;

      wrapper.appendChild(cap);
    }

    el.replaceWith(wrapper);

    requestAnimationFrame(() => {

      Chessboard(boardDiv, {
        position: fen,
        pieceTheme: PIECE_THEME
      });

    });

  });

}

/* ================================================================
   <puzzle>
================================================================ */

function initPuzzleElements() {

  document.querySelectorAll("puzzle").forEach((el) => {

    if (el.dataset.jcRendered) return;
    el.dataset.jcRendered = "1";

    const raw = el.textContent;

    const wrapper = document.createElement("div");
    wrapper.className = "jc-puzzle";

    el.replaceWith(wrapper);

    jcPuzzleCreate(wrapper, {
      rawPGN: raw
    });

  });

}

/* ================================================================
   <puzzle-block>
================================================================ */

function initPuzzleBlockElements() {

  document.querySelectorAll("puzzle-block").forEach((el) => {

    if (el.dataset.jcRendered) return;
    el.dataset.jcRendered = "1";

    renderPuzzleBlock(el);

  });

}

/* ================================================================
   <puzzle-rush>
================================================================ */

function initPuzzleRushElements() {

  document.querySelectorAll("puzzle-rush").forEach((el) => {

    if (el.dataset.jcRendered) return;
    el.dataset.jcRendered = "1";

    const text = el.textContent.trim();

    const match = text.match(/PGN:\s*([^\s]+)/i);

    const wrapper = document.createElement("div");
    wrapper.className = "jc-puzzle-rush";

    el.replaceWith(wrapper);

    if (!match) {
      wrapper.textContent = "Puzzle Rush PGN missing.";
      return;
    }

    const url = new URL(match[1], location.href).href;

    renderPuzzleRush(wrapper, url);

  });

}

/* ================================================================
   MASTER INIT
================================================================ */

function initAll() {

  initPgnElements();

  initPgnReaderElements();

  initFenElements();

  initPuzzleRushElements();

  initPuzzleBlockElements();

  initPuzzleElements();

}

/* ================================================================
   AUTO START
================================================================ */

if (document.readyState === "loading") {

  document.addEventListener("DOMContentLoaded", initAll, { once: true });

} else {

  initAll();

}

export { initAll };