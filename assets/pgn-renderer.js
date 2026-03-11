/* ================================================================
   PGN RENDERER
   Static renderer for <pgn>
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
   COMMENT BLOCK
================================================================ */

function renderCommentBlock(parent, text) {

  const p = document.createElement("div");
  p.className = "pgn-comment";
  p.textContent = text;

  parent.appendChild(p);
}

/* ================================================================
   ARROW + SQUARE PARSER
================================================================ */

function parseAnnotations(comment, board) {

  if (!comment) return;

  const cal = comment.match(/\[%cal ([^\]]+)\]/);
  const csl = comment.match(/\[%csl ([^\]]+)\]/);

  if (cal && board.drawArrow) {

    cal[1].split(",").forEach(a => {

      const color = a[0];
      const from = a.slice(1,3);
      const to = a.slice(3,5);

      board.drawArrow(from, to, color);

    });
  }

  if (csl && board.highlightSquare) {

    csl[1].split(",").forEach(s => {

      const color = s[0];
      const sq = s.slice(1);

      board.highlightSquare(sq, color);

    });
  }
}

/* ================================================================
   MOVE RENDERER
================================================================ */

function renderMove(move, container, board) {

  const span = document.createElement("span");
  span.className = "pgn-move";

  let label = "";

  if (move.color === "w") {
    label += move.moveNumber + "." + NBSP;
  }

  label += toFigurine(move.san) + renderNAG(move.nags);

  span.textContent = label + NBSP;

  span.addEventListener("click", () => {

    board.reset();

    const stack = [];
    let cur = move;

    while (cur && cur.san) {
      stack.unshift(cur.san);
      cur = cur.parent;
    }

    stack.forEach(m => board.move(m));

    parseAnnotations(move.comment, board);

  });

  container.appendChild(span);

  if (move.comment) {
    renderCommentBlock(container, move.comment);
  }

  /* variations */

  if (move.variations) {

    move.variations.forEach(v => {

      const div = document.createElement("div");
      div.className = "pgn-variation";

      renderLine(v, div, board);

      container.appendChild(div);

    });

  }
}

/* ================================================================
   LINE RENDERER
================================================================ */

function renderLine(node, container, board) {

  let cur = node;

  while (cur) {

    renderMove(cur, container, board);

    cur = cur.next;

  }

}

/* ================================================================
   MAIN PGN RENDER
================================================================ */

function renderFullPGN(pgnText, container) {

  container.innerHTML = "";

  if (!pgnText) {
    container.textContent = "Empty PGN.";
    return;
  }

  const headers = parseHeaders(pgnText);

  renderHeaders(headers, container);

  const boardDiv = document.createElement("div");
  boardDiv.className = "jc-board";

  container.appendChild(boardDiv);

  const board = createBoard(boardDiv, headers.FEN || "start");

  const movesDiv = document.createElement("div");
  movesDiv.className = "pgn-moves";

  container.appendChild(movesDiv);

  const root = buildMoveTree(pgnText);

  if (!root) return;

  renderLine(root, movesDiv, board);
}

/* ================================================================
   EXPORTS
================================================================ */

export {
  renderFullPGN,
  renderNAG,
  parseHeaders,
  renderHeaders,
  renderCommentBlock,
  buildMoveTree,
  createBoard,
  toFigurine
};