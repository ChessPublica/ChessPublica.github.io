/**
 * ChessPublica — Board creation + SVG annotation overlay
 */

import { PIECE_THEME, getDestinationSquare, renderMoveQualityBadge } from "./helpers.js";

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

    /* Show a move-quality badge on the destination square if the
       move that produced this diagram has a NAG annotation. */
    if (moveNode && moveNode.nags && moveNode.nags.length) {
      var glyph = _nagToGlyph(moveNode.nags);
      if (glyph && moveNode.san) {
        var square = getDestinationSquare(moveNode.san, moveNode.color);
        if (square) {
          boardDiv.style.position = "relative";
          renderMoveQualityBadge(boardDiv, square, glyph);
        }
      }
    }
  });
}

var _NAG_GLYPH_MAP = {
  "$1": "!", "$2": "?", "$3": "!!", "$4": "??", "$5": "!?", "$6": "?!",
  "!": "!", "?": "?", "!!": "!!", "??": "??", "!?": "!?", "?!": "?!",
};

function _nagToGlyph(nags) {
  for (var i = 0; i < nags.length; i++) {
    var g = _NAG_GLYPH_MAP[nags[i]];
    if (g) return g;
  }
  return null;
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

var COLOR_MAP = {
  R: "rgba(255,0,0,",
  Y: "rgba(255,170,0,",
  G: "rgba(0,170,0,",
  B: "rgba(0,0,255,",
};

function lichessColor(code, alpha) {
  return (COLOR_MAP[code] || COLOR_MAP.R) + (alpha === undefined ? 0.35 : alpha) + ")";
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
  var hb = bodyWidth / 2;
  var hh = headWidth / 2;

  var bx = start.x + bodyLength * cos;
  var by = start.y + bodyLength * sin;

  var d = [
    "M", start.x + hb * sin, start.y - hb * cos,
    "L", start.x - hb * sin, start.y + hb * cos,
    "L", bx - hb * sin, by + hb * cos,
    "L", bx - hh * sin, by + hh * cos,
    "L", end.x, end.y,
    "L", bx + hh * sin, by - hh * cos,
    "L", bx + hb * sin, by - hb * cos,
    "Z",
  ].join(" ");

  var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", lichessColor(color));

  svg.appendChild(path);
}