/* ================================================================
   PGN RENDERER
================================================================ */

import { NBSP } from "./configuration.js";
import { toFigurine } from "./figurine.js";
import { buildMoveTree } from "./tree-builder.js";
import { createBoard } from "./board.js";

/* ================================================================
   NAG RENDERING
================================================================ */

function renderNAG(nags) {

  if (!nags || !nags.length) return "";

  const map = {
    $1: "!",
    $2: "?",
    $3: "!!",
    $4: "??",
    $5: "!?",
    $6: "?!"
  };

  return nags.map(n => map[n] || "").join("");
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
   HEADER RENDER
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

    meta.textContent =
      site && date ? site + ", " + date : site || date;

    div.appendChild(meta);
  }

  container.appendChild(div);
}

/* ================================================================
   PGN SPLIT
================================================================ */

function splitPGN(pgnText) {

  const headers = parseHeaders(pgnText);

  const movetext = pgnText
    .replace(/(?:\[[^\]]+\]\s*)+/g, "")
    .trim();

  return { headers, movetext };
}

/* ================================================================
   COMMENT CLEANER
================================================================ */

function cleanComment(text) {

  if (!text) return "";

  return text
    .replace(/\[%cal [^\]]+\]/g, "")
    .replace(/\[%csl [^\]]+\]/g, "")
    .trim();
}

/* ================================================================
   COMMENT RENDER
================================================================ */

function renderComment(parent, text) {

  const clean = cleanComment(text);

  if (!clean) return;

  const div = document.createElement("div");
  div.className = "pgn-comment";
  div.textContent = clean;

  parent.appendChild(div);
}

/* ================================================================
   MAIN MOVE RENDERER
================================================================ */

function renderMoves(root, container) {

  let cur = root;

  let moveNumber = 1;
  let color = "w";

  const fragment = document.createDocumentFragment();

  while (cur) {

    const span = document.createElement("span");
    span.className = "pgn-move";

    let label;

    if (color === "w") {

      label =
        moveNumber + "." + NBSP +
        toFigurine(cur.san) +
        renderNAG(cur.nags) +
        NBSP;

      color = "b";

    } else {

      label =
        moveNumber + "..." + NBSP +
        toFigurine(cur.san) +
        renderNAG(cur.nags) +
        NBSP;

      color = "w";
      moveNumber++;

    }

    span.textContent = label;

    fragment.appendChild(span);

    if (cur.comment) {
      renderComment(fragment, cur.comment);
    }

    cur = cur.next;

  }

  container.appendChild(fragment);

}

/* ================================================================
   MAIN RENDER
================================================================ */

function renderFullPGN(pgnText, container) {

  container.innerHTML = "";

  if (!pgnText) {
    container.textContent = "Empty PGN.";
    return;
  }

  const { headers, movetext } = splitPGN(pgnText);

  renderHeaders(headers, container);

  const root = buildMoveTree(movetext);

  if (!root) return;

  const firstMoveBlock = document.createElement("div");
  firstMoveBlock.className = "pgn-moves";

  container.appendChild(firstMoveBlock);

  /* first move */

  const firstMove = document.createElement("span");
  firstMove.className = "pgn-move";
  firstMove.textContent = "1." + NBSP + toFigurine(root.san);

  firstMoveBlock.appendChild(firstMove);

  /* first board */

  const board1 = document.createElement("div");
  board1.className = "jc-board";

  container.appendChild(board1);

  createBoard(board1);

  /* rest of moves */

  const movesDiv = document.createElement("div");
  movesDiv.className = "pgn-moves";

  container.appendChild(movesDiv);

  renderMoves(root.next, movesDiv);

  /* final board */

  const board2 = document.createElement("div");
  board2.className = "jc-board";

  container.appendChild(board2);

  createBoard(board2);

}

/* ================================================================
   EXPORTS
================================================================ */

export {
  renderFullPGN,
  renderNAG,
  parseHeaders,
  renderHeaders,
  buildMoveTree,
  createBoard,
  toFigurine
};