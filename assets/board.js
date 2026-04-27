/**
 * ChessPublica — Board creation + SVG annotation overlay
 */

import {
  PIECE_THEME,
  getDestinationSquare,
  renderMoveQualityBadge,
  nagsToGlyph,
} from "./helpers.js";

export function createBoard(container, fen, moveNode) {
  var wrapper = document.createElement("div");
  wrapper.className = "jc-board-wrapper";

  var boardDiv = document.createElement("div");
  boardDiv.className = "jc-board";

  wrapper.appendChild(boardDiv);
  container.appendChild(wrapper);

  requestAnimationFrame(function () {
    var widget = Chessboard(boardDiv, {
      position: fen,
      pieceTheme: PIECE_THEME,
    });

    /* Draw the SVG overlay + (optional) NAG move-quality badge. Wrapped
       in a function so makeBoardResizable() can re-run it after the
       board re-fits its container; the squares' new pixel positions
       feed into renderAnnotations()'s screen->SVG-user mapping so the
       circles/arrows stay aligned. */
    function renderOverlay() {
      renderAnnotations(boardDiv, moveNode);
      if (moveNode && moveNode.nags && moveNode.nags.length) {
        var glyph = nagsToGlyph(moveNode.nags);
        if (glyph && moveNode.san) {
          var square = getDestinationSquare(moveNode.san, moveNode.color);
          if (square) {
            boardDiv.style.position = "relative";
            renderMoveQualityBadge(boardDiv, square, glyph);
          }
        }
      }
    }

    renderOverlay();
    makeBoardResizable(boardDiv, widget, renderOverlay);
  });
}

/* ================================================================
   RESIZE HANDLING
================================================================ */

/**
 * chessboard.js v1.0.0 sizes its inner .board-b72b1 (and each square)
 * in fixed pixels at init: widget.resize() reads the container width
 * once, then squares get inline width/height. Our boards live inside a
 * .jc-board with `width: 100%; max-width: var(--board-size)`, so on
 * viewport resize the container scales but the squares stay put — and
 * the SVG annotation overlay (sized 100%/100% of .chessboard-63f37,
 * viewBox 0..100, preserveAspectRatio="none") drifts off the squares.
 *
 * Observe the boardDiv with a ResizeObserver and on each size change
 * call widget.resize() to re-fit the inner board, then re-run the
 * caller-supplied redraw callback so any SVG annotations or NAG badges
 * are re-derived from the squares' new screen positions. Updates are
 * batched through requestAnimationFrame so dragging the window edge
 * doesn't fire redundant work.
 *
 * @param {HTMLElement} boardDiv  the .jc-board element to observe
 * @param {Object}      widget    the chessboard.js instance (must expose .resize())
 * @param {Function}    redraw    callback invoked after each widget.resize()
 */
export function makeBoardResizable(boardDiv, widget, redraw) {
  if (typeof ResizeObserver === "undefined") return null;
  if (!widget || typeof widget.resize !== "function") return null;

  var pendingFrame = null;
  var ro = new ResizeObserver(function () {
    if (pendingFrame) return;
    pendingFrame = requestAnimationFrame(function () {
      pendingFrame = null;
      widget.resize();
      if (typeof redraw === "function") redraw();
    });
  });
  ro.observe(boardDiv);
  return ro;
}

/* ================================================================
   GRID UTILITIES
================================================================ */

/**
 * Locate the chessboard.js inner 8×8 grid element. All squares live directly
 * inside this element; attaching the SVG overlay here (instead of the outer
 * board wrapper) avoids any border/padding offsets and gives pixel-perfect
 * alignment without manual positioning math.
 */
function getGridElement(boardDiv) {
  return boardDiv.querySelector(".chessboard-63f37") || boardDiv;
}

/**
 * Create an SVG board-overlay element, attached inside the actual 8×8 grid,
 * sized 100%×100% so viewBox 0..100 maps exactly to the square area.
 *
 * Exported so callers (e.g. pgn-player's last-move arrow) can create their
 * own overlay layers using the same infrastructure.
 *
 * @param {HTMLElement} boardDiv
 * @param {string}      [extraClass]  additional CSS class on the SVG element
 * @returns {SVGSVGElement|null}
 */
export function createGridOverlaySVG(boardDiv, extraClass) {
  var grid = getGridElement(boardDiv);
  if (!grid) return null;

  /* Ensure the grid can host absolutely-positioned overlays. */
  if (grid !== boardDiv && getComputedStyle(grid).position === "static") {
    grid.style.position = "relative";
  }

  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("board-overlay");
  if (extraClass) svg.classList.add(extraClass);
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.position = "absolute";
  svg.style.left     = "0";
  svg.style.top      = "0";
  svg.style.width    = "100%";
  svg.style.height   = "100%";
  svg.style.pointerEvents = "none";

  grid.appendChild(svg);
  return svg;
}

/**
 * Compute a square's centre in SVG user coordinates by inverting the SVG's
 * current transformation matrix. This is immune to border/padding/box-sizing
 * differences on any ancestor element, so circles and arrows align exactly
 * with the squares regardless of how chessboard.js lays out its DOM.
 *
 * Exported so callers that create their own SVG layer (e.g. pgn-player's
 * last-move arrow) can re-use the same coordinate mapping.
 *
 * @param {SVGSVGElement} svg
 * @param {HTMLElement}   boardDiv  the element that contains [data-square] children
 * @param {string}        square    e.g. "e4"
 * @returns {{ x: number, y: number, size: number }|null}
 */
export function getSquareCenter(svg, boardDiv, square) {
  var squareEl = boardDiv.querySelector('[data-square="' + square + '"]');
  if (!squareEl) return null;

  var ctm = svg.getScreenCTM();
  if (!ctm) return null;
  var inv = ctm.inverse();

  var sr = squareEl.getBoundingClientRect();
  var cx = sr.left + sr.width  / 2;
  var cy = sr.top  + sr.height / 2;

  var pt = svg.createSVGPoint();
  pt.x = cx; pt.y = cy;
  var center = pt.matrixTransform(inv);

  pt.x = cx + sr.width; pt.y = cy;
  var edge = pt.matrixTransform(inv);

  return {
    x:    center.x,
    y:    center.y,
    size: edge.x - center.x,   // full square width in SVG user units
  };
}

/* ================================================================
   PUBLIC ANNOTATION API
================================================================ */

/**
 * Render (or clear) Lichess-style square circles + arrows on a board.
 *
 * Attaches a .board-overlay SVG inside the chessboard.js inner grid so that
 * 100 % / 100 % maps exactly to the square area — no border/padding offsets.
 * Any existing annotation overlay is removed first; the last-move overlay
 * (if present) is left untouched.
 *
 * The `wrapper` parameter is accepted for backward compatibility but is no
 * longer used — callers that previously passed boardDiv.parentNode can keep
 * their call sites unchanged.
 *
 * @param {HTMLElement} boardDiv    the .jc-board element
 * @param {?Object}     annotations { squareMarks, arrows } — may be null
 * @param {HTMLElement} [wrapper]   ignored (kept for API compatibility)
 */
export function renderAnnotations(boardDiv, annotations, wrapper) {
  /* Remove previous annotation overlay, keeping any last-move overlay. */
  var existing = boardDiv.querySelectorAll(".board-overlay:not(.last-move-overlay)");
  for (var e = 0; e < existing.length; e++) existing[e].remove();

  var svg = createGridOverlaySVG(boardDiv);
  if (!svg) return;

  if (!annotations) return;

  var grid = svg.parentNode;

  if (annotations.squareMarks) {
    annotations.squareMarks.forEach(function (mark) {
      drawCircle(svg, grid, mark.square, mark.color);
    });
  }

  if (annotations.arrows) {
    annotations.arrows.forEach(function (arrow) {
      drawArrow(svg, grid, arrow.from, arrow.to, arrow.color);
    });
  }
}

/**
 * Remove any rendered annotation overlay from the board.
 * The last-move overlay (if present) is left untouched.
 *
 * @param {HTMLElement} boardDiv
 * @param {HTMLElement} [wrapper]  ignored (kept for API compatibility)
 */
export function clearAnnotations(boardDiv, wrapper) {
  var existing = boardDiv.querySelectorAll(".board-overlay:not(.last-move-overlay)");
  for (var e = 0; e < existing.length; e++) existing[e].remove();
}

/* ================================================================
   DRAWING PRIMITIVES
================================================================ */

var _COLOR_MAP = {
  R: "rgba(255,0,0,",
  Y: "rgba(255,170,0,",
  G: "rgba(0,170,0,",
  B: "rgba(0,0,255,",
};

function lichessColor(code, alpha) {
  return (_COLOR_MAP[code] || _COLOR_MAP.R) + (alpha === undefined ? 0.55 : alpha) + ")";
}

function drawCircle(svg, boardDiv, square, color) {
  var center = getSquareCenter(svg, boardDiv, square);
  if (!center) return;

  var strokeWidth = center.size * 0.09;
  var radius      = (center.size / 2) - (strokeWidth / 2);

  var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx",           center.x);
  circle.setAttribute("cy",           center.y);
  circle.setAttribute("r",            radius);
  circle.setAttribute("fill",         "none");
  circle.setAttribute("stroke",       lichessColor(color, 0.55));
  circle.setAttribute("stroke-width", strokeWidth);

  svg.appendChild(circle);
}

function drawArrow(svg, boardDiv, fromSquare, toSquare, color) {
  var start = getSquareCenter(svg, boardDiv, fromSquare);
  var end   = getSquareCenter(svg, boardDiv, toSquare);
  if (!start || !end) return;

  var dx     = end.x - start.x;
  var dy     = end.y - start.y;
  var angle  = Math.atan2(dy, dx);
  var length = Math.sqrt(dx * dx + dy * dy);

  var bodyWidth  = start.size * 0.16;
  var headWidth  = bodyWidth  * 3.5;
  /* Arrow tip lands at the exact centre of the destination square. */
  var headLength = start.size * 0.55;
  var startInset = start.size * 0.2;

  /* Scale down for short moves (e.g. adjacent-square pawn pushes) so every
     move always gets a visible arrow. */
  var minBodyFraction = 0.15;
  var totalInset = headLength + startInset;
  if (totalInset >= length * (1 - minBodyFraction)) {
    var scale = (length * (1 - minBodyFraction)) / totalInset;
    headLength *= scale;
    startInset *= scale;
  }
  var bodyLength = length - headLength - startInset;

  var sin = Math.sin(angle);
  var cos = Math.cos(angle);

  var halfBody = bodyWidth / 2;
  var halfHead = headWidth / 2;

  var originX = start.x + startInset * cos;
  var originY = start.y + startInset * sin;

  var p1x = originX + halfBody * sin,  p1y = originY - halfBody * cos;
  var p2x = originX - halfBody * sin,  p2y = originY + halfBody * cos;

  var baseX = originX + bodyLength * cos;
  var baseY = originY + bodyLength * sin;

  var p3x = baseX - halfBody * sin,  p3y = baseY + halfBody * cos;
  var p7x = baseX + halfBody * sin,  p7y = baseY - halfBody * cos;
  var p4x = baseX - halfHead * sin,  p4y = baseY + halfHead * cos;
  var p6x = baseX + halfHead * sin,  p6y = baseY - halfHead * cos;

  var tipX = end.x;
  var tipY = end.y;

  var d = [
    "M", p1x, p1y,
    "L", p2x, p2y,
    "L", p3x, p3y,
    "L", p4x, p4y,
    "L", tipX, tipY,
    "L", p6x, p6y,
    "L", p7x, p7y,
    "Z",
  ].join(" ");

  var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d",    d);
  path.setAttribute("fill", lichessColor(color, 0.55));

  svg.appendChild(path);
}
