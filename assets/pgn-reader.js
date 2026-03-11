/* ================= PGN READER ================= */
import { NBSP, PIECE_THEME } from "./configuration.js";
import {
  buildMoveTree,
  createBoard,
  toFigurine,
  parseHeaders,
  renderHeaders,
  renderNAG
} from "./pgn-renderer.js";

/**
 * Renders an interactive PGN reader in the given container.
 * Shows board, clickable moves, and comments.
 */
function renderPGNReader(pgnText, container) {
  const headers = parseHeaders(pgnText);
  renderHeaders(headers, container);

  const moves = buildMoveTree(pgnText);
  if (!moves) {
    container.textContent = "No moves found in PGN.";
    return;
  }

  const boardDiv = document.createElement("div");
  boardDiv.className = "jc-board";
  container.appendChild(boardDiv);

  const board = createBoard(boardDiv, headers.FEN || "start");

  const movesDiv = document.createElement("div");
  movesDiv.className = "pgn-moves";
  container.appendChild(movesDiv);

  const commentDiv = document.createElement("div");
  commentDiv.className = "pgn-comment-box";
  container.appendChild(commentDiv);

  /* Build clickable move list */
  let cur = moves;
  let moveNumber = 1;
  while (cur) {
    const span = document.createElement("span");
    const btn = document.createElement("button");
    btn.className = "pgn-move-btn";

    // Prepend move number only on white
    const text =
      cur.color === "w"
        ? moveNumber + "." + NBSP + toFigurine(cur.san) + renderNAG(cur.nags)
        : toFigurine(cur.san) + renderNAG(cur.nags);
    btn.textContent = text;

    btn.addEventListener("click", () => {
      // Build stack from parent chain
      let temp = cur;
      const stack = [];
      while (temp && temp.san) {
        stack.unshift(temp.san);
        temp = temp.parent;
      }
      board.position(headers.FEN || "start", false);
      stack.forEach((m) => board.move(m, { sloppy: true }));
      commentDiv.textContent = cur.comment || "";
    });

    span.appendChild(btn);
    movesDiv.appendChild(span);

    if (cur.color === "b") moveNumber++;
    cur = cur.next;
  }
}

/* ================= EXPORTS ================= */
export { renderPGNReader, parseHeaders };