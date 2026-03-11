/**
 * JekyllChess — Board creation + SVG annotation overlay
 */

import { PIECE_THEME } from "./config.js";

export function createBoard(container, fen, moveNode) {
  var wrapper = document.createElement("div");
  wrapper.className = "jc-board-wrapper";

  var boardDiv = document.createElement("div");
  boardDiv.className = "jc-board";

  wrapper.appendChild(boardDiv);
  container.appendChild(wrapper);

  requestAnimationFrame(function () {
    Chessboard(boardDiv, {
      position: fen,
      pieceTheme: PIECE_THEME,
    });
    initOverlay(wrapper, boardDiv, moveNode);
  });
}

function initOverlay(wrapper, boardDiv, moveNode) {
  var size = boardDiv.getBoundingClientRect().width;

  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("jc-overlay");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("viewBox", "0 0 " + size + " " + size);

  wrapper.appendChild(svg);

  if (!moveNode) return;

  if (moveNode.squareMarks) {
    moveNode.squareMarks.forEach(function (mark) {
      drawCircle(svg, boardDiv, mark.square, mark.color);
    });
  }

  if (moveNode.arrows) {
    moveNode.arrows.forEach(function (arrow) {
      drawArrow(svg, boardDiv, arrow.from, arrow.to, arrow.color);
    });
  }
}

function getSquareCenter(boardDiv, square) {
  if (!boardDiv.__squareCache) {
    boardDiv.__squareCache = {};
    boardDiv.querySelectorAll("[data-square]").forEach(function (el) {
      boardDiv.__squareCache[el.dataset.square] = el;
    });
  }

  var squareEl = boardDiv.__squareCache[square];
  if (!squareEl) return null;

  var boardRect = boardDiv.getBoundingClientRect();
  var rect = squareEl.getBoundingClientRect();

  return {
    x: rect.left - boardRect.left + rect.width / 2,
    y: rect.top - boardRect.top + rect.height / 2,
    size: rect.width,
  };
}

function lichessColor(code, alpha) {
  if (alpha === undefined) alpha = 0.35;
  var colors = {
    R: [255, 0, 0],
    Y: [255, 170, 0],
    G: [0, 170, 0],
    B: [0, 0, 255],
  };
  var rgb = colors[code] || colors.R;
  return (
    "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", " + alpha + ")"
  );
}

function drawCircle(svg, boardDiv, square, color) {
  var center = getSquareCenter(boardDiv, square);
  if (!center) return;

  var strokeWidth = center.size * 0.09;
  var radius = center.size / 2 - strokeWidth / 2;

  var circle = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "circle",
  );
  circle.setAttribute("cx", center.x);
  circle.setAttribute("cy", center.y);
  circle.setAttribute("r", radius);
  circle.setAttribute("fill", "none");
  circle.setAttribute("stroke", lichessColor(color));
  circle.setAttribute("stroke-width", strokeWidth);

  svg.appendChild(circle);
}

function drawArrow(svg, boardDiv, fromSquare, toSquare, color) {
  var start = getSquareCenter(boardDiv, fromSquare);
  var end = getSquareCenter(boardDiv, toSquare);

  if (!start || !end) return;

  var dx = end.x - start.x;
  var dy = end.y - start.y;

  var angle = Math.atan2(dy, dx);
  var length = Math.sqrt(dx * dx + dy * dy);

  var bodyWidth = start.size * 0.16;
  var headWidth = bodyWidth * 3.5;
  var headLength = start.size * 0.6;
  var bodyLength = length - headLength;

  var sin = Math.sin(angle);
  var cos = Math.cos(angle);
  var halfBody = bodyWidth / 2;
  var halfHead = headWidth / 2;

  var p1x = start.x + halfBody * sin;
  var p1y = start.y - halfBody * cos;
  var p2x = start.x - halfBody * sin;
  var p2y = start.y + halfBody * cos;

  var baseX = start.x + bodyLength * cos;
  var baseY = start.y + bodyLength * sin;

  var p3x = baseX - halfBody * sin;
  var p3y = baseY + halfBody * cos;
  var p7x = baseX + halfBody * sin;
  var p7y = baseY - halfBody * cos;

  var p4x = baseX - halfHead * sin;
  var p4y = baseY + halfHead * cos;
  var p6x = baseX + halfHead * sin;
  var p6y = baseY - halfHead * cos;

  var p5x = end.x;
  var p5y = end.y;

  var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  var d =
    "M " +
    p1x +
    " " +
    p1y +
    " L " +
    p2x +
    " " +
    p2y +
    " L " +
    p3x +
    " " +
    p3y +
    " L " +
    p4x +
    " " +
    p4y +
    " L " +
    p5x +
    " " +
    p5y +
    " L " +
    p6x +
    " " +
    p6y +
    " L " +
    p7x +
    " " +
    p7y +
    " Z";

  path.setAttribute("d", d);
  path.setAttribute("fill", lichessColor(color));

  svg.appendChild(path);
}