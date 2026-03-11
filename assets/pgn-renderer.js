/* ================================================================
   PGN RENDERER
   Responsible for rendering static PGN blocks (<pgn>)
================================================================ */

import { NBSP } from "./configuration.js";
import { toFigurine } from "./figurine.js";
import { buildMoveTree } from "./tree-builder.js";
import { createBoard } from "./board.js";

/* ================================================================
   NAG RENDERING
================================================================ */
function renderNAG(nags) {
  if (!nags || nags.length === 0) return "";
  const map = {
    $1: "!",
    $2: "?",
    $3: "!!",
    $4: "??",
    $5: "!?",
    $6: "?!",
  };
  return nags.map((n) => map[n] || "").join("");
}

/* ================================================================
   TEXT BUFFER UTILITIES
================================================================ */
function flushBuffer(parent, text, isVariation) {
  if (!text.trim()) return;
  const p = document.createElement("p");
  p.className = isVariation ? "pgn-variation-line" : "pgn-mainline";
  p.textContent = text.trim();
  parent.appendChild(p);
}

function renderCommentBlock(parent, text) {
  const p = document.createElement("p");
  p.className = "pgn-comment";
  p.textContent = text;
  parent.appendChild(p);
}

/* ================================================================
   HEADER PARSER
================================================================ */
function parseHeaders(pgnText) {
  const headers = {};
  const regex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match;
  while ((match = regex.exec(pgnText))) {
    headers[match[1]] = match[2];
  }
  return headers;
}

/* ================================================================
   HEADER RENDERER
================================================================ */
function renderHeaders(headers, container) {
  const div = document.createElement("div");
  div.className = "pgn-headers";

  if (headers.White && headers.Black) {
    const players = document.createElement("div");
    players.className = "pgn-players";
    players.textContent = headers.White + " – " + headers.Black;
    div.appendChild(players);
  }

  if (headers.Site || headers.Date) {
    const meta = document.createElement("div");
    meta.className = "pgn-meta";
    const site = headers.Site || "";
    const date = headers.Date || "";
    meta.textContent = site && date ? site + ", " + date : site || date;
    div.appendChild(meta);
  }

  container.appendChild(div);
}

/* ================================================================
   MOVE TEXT PARSER
================================================================ */
function stripHeaders(pgnText) {
  return pgnText.replace(/(?:\[[^\]]+\]\s*)+/g, "").trim();
}

function tokenizeMoveText(text) {
  let s = text;
  s = s.replace(/\{[\s\S]*?\}/g, " ");
  s = s.replace(/;[^\n]*/g, " ");
  s = s.replace(/\$\d+/g, " ");
  s = s.replace(/\d+\.(\.\.)?/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s.split(" ").filter(Boolean);
}

/* ================================================================
   MAIN PGN RENDERER
================================================================ */
function renderFullPGN(pgnText, container) {
  container.innerHTML = "";
  if (!pgnText) {
    container.textContent = "Empty PGN.";
    return;
  }

  const headers = parseHeaders(pgnText);
  renderHeaders(headers, container);

  const body = stripHeaders(pgnText);
  if (!body) return;

  const moves = tokenizeMoveText(body);
  const movesDiv = document.createElement("div");
  movesDiv.className = "pgn-moves";

  let moveNumber = 1;
  let color = "w";

  moves.forEach((m) => {
    const span = document.createElement("span");

    if (color === "w") {
      span.textContent = moveNumber + "." + NBSP + toFigurine(m) + NBSP;
      color = "b";
    } else {
      span.textContent = toFigurine(m) + NBSP;
      color = "w";
      moveNumber++;
    }

    span.className = "pgn-move";
    movesDiv.appendChild(span);
  });

  container.appendChild(movesDiv);
}

/* ================================================================
   EXPORTS
================================================================ */
export {
  renderFullPGN,
  renderNAG,
  flushBuffer,
  renderCommentBlock,
  parseHeaders,
  renderHeaders,
  buildMoveTree,
  createBoard,
  toFigurine
};