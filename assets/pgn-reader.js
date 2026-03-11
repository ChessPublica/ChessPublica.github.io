/**
 * JekyllChess — PGN Reader (Interactive board + clickable move list)
 */

import { PIECE_THEME, NBSP } from "./config.js";
import { toFigurine } from "./figurine.js";
import { buildMoveTree, parseHeaders } from "./pgn-parser.js";
import { renderHeaders } from "./pgn-renderer.js";

export function renderPGNReader(pgnText, container) {
  var headers = parseHeaders(pgnText);

  var headerDiv = document.createElement("div");
  headerDiv.className = "pgn-reader-header";
  renderHeaders(headers, headerDiv);
  container.appendChild(headerDiv);

  var rootNode = buildMoveTree(pgnText);
  if (!rootNode) {
    container.textContent = "No moves found in PGN.";
    return;
  }

  var allNodes = [];
  var startFen = rootNode.parent
    ? rootNode.parent.fen
    : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  function collectNodes(node) {
    var cur = node;
    while (cur) {
      allNodes.push(cur);
      cur = cur.next;
    }
  }
  collectNodes(rootNode);

  var layout = document.createElement("div");
  layout.className = "pgn-reader-layout";
  container.appendChild(layout);

  /* Board area */
  var boardArea = document.createElement("div");
  boardArea.className = "pgn-reader-board-area";
  layout.appendChild(boardArea);

  var boardDiv = document.createElement("div");
  boardDiv.className = "jc-board pgn-reader-board";
  boardArea.appendChild(boardDiv);

  /* Controls */
  var controls = document.createElement("div");
  controls.className = "pgn-reader-controls";
  boardArea.appendChild(controls);

  var btnFirst = createControlBtn("⏮", "First move");
  var btnPrev = createControlBtn("◀", "Previous move");
  var btnNext = createControlBtn("▶", "Next move");
  var btnLast = createControlBtn("⏭", "Last move");
  controls.appendChild(btnFirst);
  controls.appendChild(btnPrev);
  controls.appendChild(btnNext);
  controls.appendChild(btnLast);

  /* Moves panel */
  var movesPanel = document.createElement("div");
  movesPanel.className = "pgn-reader-moves-panel";
  layout.appendChild(movesPanel);

  var moveSpans = [];
  var commentSpans = [];

  allNodes.forEach(function (node, idx) {
    if (node.color === "w") {
      var numSpan = document.createElement("span");
      numSpan.className = "pgn-reader-move-number";
      numSpan.textContent = node.moveNumber + "." + NBSP;
      movesPanel.appendChild(numSpan);
    } else if (idx === 0) {
      var numSpan2 = document.createElement("span");
      numSpan2.className = "pgn-reader-move-number";
      numSpan2.textContent = node.moveNumber + "..." + NBSP;
      movesPanel.appendChild(numSpan2);
    }

    var moveSpan = document.createElement("span");
    moveSpan.className = "pgn-reader-move";
    moveSpan.textContent = toFigurine(node.san) + " ";
    moveSpan.dataset.index = idx;
    moveSpan.addEventListener("click", function () {
      goToMove(idx);
    });
    movesPanel.appendChild(moveSpan);
    moveSpans.push(moveSpan);

    if (node.comment) {
      var commentSpan = document.createElement("span");
      commentSpan.className = "pgn-reader-inline-comment";
      commentSpan.textContent = node.comment + " ";
      commentSpan.dataset.moveIndex = idx;
      movesPanel.appendChild(commentSpan);
      commentSpans.push({ idx: idx, el: commentSpan });
    }
  });

  /* Orientation */
  var orientation = "white";
  if (headers.Orientation) {
    orientation = headers.Orientation.toLowerCase();
  }

  var board = Chessboard(boardDiv, {
    position: startFen,
    pieceTheme: PIECE_THEME,
    orientation: orientation,
  });

  var currentIndex = -1;

  function goToMove(idx) {
    if (idx < -1 || idx >= allNodes.length) return;
    currentIndex = idx;

    if (idx === -1) {
      board.position(startFen, true);
    } else {
      board.position(allNodes[idx].fen, true);
    }

    moveSpans.forEach(function (span, i) {
      span.classList.toggle("pgn-reader-move-active", i === idx);
    });

    commentSpans.forEach(function (item) {
      item.el.classList.toggle(
        "pgn-reader-inline-comment-active",
        item.idx === idx,
      );
    });

    if (idx >= 0 && moveSpans[idx]) {
      moveSpans[idx].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  btnFirst.addEventListener("click", function () {
    goToMove(-1);
  });
  btnPrev.addEventListener("click", function () {
    goToMove(currentIndex - 1);
  });
  btnNext.addEventListener("click", function () {
    goToMove(currentIndex + 1);
  });
  btnLast.addEventListener("click", function () {
    goToMove(allNodes.length - 1);
  });

  if (!window.__jcKeyHandler) {
    window.__jcKeyHandler = true;

    document.addEventListener("keydown", function (e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToMove(currentIndex - 1);
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToMove(currentIndex + 1);
      }

      if (e.key === "Home") {
        e.preventDefault();
        goToMove(-1);
      }

      if (e.key === "End") {
        e.preventDefault();
        goToMove(allNodes.length - 1);
      }
    });
  }

  goToMove(-1);
}

function createControlBtn(text, title) {
  var btn = document.createElement("button");
  btn.className = "pgn-reader-btn";
  btn.textContent = text;
  btn.title = title;
  return btn;
}