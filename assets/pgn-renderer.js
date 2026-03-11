/**
 * JekyllChess — PGN Tree Renderer (static display)
 */

import { NBSP } from "./config.js";
import { toFigurine } from "./figurine.js";
import { createBoard } from "./board.js";
import { buildMoveTree, parseHeaders } from "./pgn-parser.js";

/* ================================================================
   HEADER RENDERER
================================================================ */

export function renderHeaders(headers, container) {
  var div = document.createElement("div");
  div.className = "pgn-headers";

  if (headers.White && headers.Black) {
    var players = document.createElement("div");
    players.className = "pgn-players";
    players.textContent = headers.White + " – " + headers.Black;
    div.appendChild(players);
  }

  if (headers.Site || headers.Date) {
    var meta = document.createElement("div");
    meta.className = "pgn-meta";
    var site = headers.Site || "";
    var date = headers.Date || "";
    meta.textContent = site && date ? site + ", " + date : site || date;
    div.appendChild(meta);
  }

  container.appendChild(div);
}

/* ================================================================
   TREE RENDERER
================================================================ */

export function renderMoveTree(rootNode, container) {
  var movesDiv = document.createElement("div");
  movesDiv.className = "pgn-moves";
  renderLine(rootNode, movesDiv, false);
  container.appendChild(movesDiv);
}

function renderLine(node, parent, isVariation) {
  var current = node;
  var buffer = "";
  var lastMoveNumber = null;
  var needsMoveNumber = true;

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
      if (needsMoveNumber && buffer.trim() === "") {
        if (current.color === "b") {
          buffer += current.moveNumber + "..." + NBSP;
        } else {
          buffer += current.moveNumber + "." + NBSP;
        }
      } else if (needsMoveNumber && current.color === "b") {
        buffer += current.moveNumber + "..." + NBSP;
      } else if (newMoveNumber && current.color === "w") {
        buffer += current.moveNumber + "." + NBSP;
      }
    }

    needsMoveNumber = false;

    /* MOVE TEXT */
    buffer += toFigurine(current.san);
    buffer += renderNAG(current.nags);
    buffer += " ";

    lastMoveNumber = current.moveNumber;

    /* COMMENT */
    if (current.comment) {
      flushBuffer(parent, buffer, isVariation);
      buffer = "";
      renderCommentBlock(parent, current.comment);
      needsMoveNumber = true;
    }

    /* BOARD */
    var hasAnnotations =
      (current.arrows && current.arrows.length) ||
      (current.squareMarks && current.squareMarks.length);
    var isDiagram = current.comment === "[D]";

    if (hasAnnotations || isDiagram) {
      flushBuffer(parent, buffer, isVariation);
      buffer = "";
      createBoard(parent, current.fen, current);
      needsMoveNumber = true;
    }

    /* VARIATIONS */
    if (current.variations.length > 0) {
      flushBuffer(parent, buffer, isVariation);
      buffer = "";

      current.variations.forEach(function (variationRoot) {
        var variationWrapper = document.createElement("div");
        variationWrapper.className = "pgn-variation";
        parent.appendChild(variationWrapper);
        renderLine(variationRoot, variationWrapper, true);
      });

      needsMoveNumber = true;
    }

    current = current.next;
  }

  flushBuffer(parent, buffer, isVariation);
}

function renderCommentBlock(parent, text) {
  var p = document.createElement("p");
  p.className = "pgn-comment";
  p.textContent = text;
  parent.appendChild(p);
}

function renderNAG(nags) {
  if (!nags || nags.length === 0) return "";
  var map = {
    $1: "!",
    $2: "?",
    $3: "!!",
    $4: "??",
    $5: "!?",
    $6: "?!",
  };
  return nags
    .map(function (n) {
      return map[n] || "";
    })
    .join("");
}

function flushBuffer(parent, text, isVariation) {
  if (!text.trim()) return;
  var p = document.createElement("p");
  p.className = isVariation ? "pgn-variation-line" : "pgn-mainline";
  p.textContent = text.trim();
  parent.appendChild(p);
}

/* ================================================================
   FULL PGN RENDER (convenience function)
================================================================ */

export function renderFullPGN(pgnText, container) {
  try {
    var headers = parseHeaders(pgnText);
    renderHeaders(headers, container);

    var rootNode = buildMoveTree(pgnText);
    if (rootNode) {
      renderMoveTree(rootNode, container);
    }
  } catch (e) {
    var errorDiv = document.createElement("div");
    errorDiv.className = "pgn-error";
    errorDiv.textContent = "Error parsing PGN: " + e.message;
    container.appendChild(errorDiv);
  }
}