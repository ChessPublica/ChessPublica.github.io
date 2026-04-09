/* ChessPublica <pgn-player> element */

function loadPGN(pgn) {

  const chess = new Chess();

  /* ---------------------------
     HEADER PARSE
  --------------------------- */

  const headers = {};
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;

  let hMatch;
  while ((hMatch = headerRegex.exec(pgn)) !== null) {
    headers[hMatch[1]] = hMatch[2];
  }

  /* ---------------------------
     SPLIT HEADER / MOVE-TEXT
     Eval regex must only run on the move-text section to avoid
     false matches in header comments.
  --------------------------- */

  const headerBodySplit = pgn.indexOf("\n\n");
  const moveText = headerBodySplit !== -1 ? pgn.slice(headerBodySplit) : pgn;

  /* ---------------------------
     NAG → GLYPH MAP
     Numeric Annotation Glyphs ($N) and inline suffixes (!?? etc.)
     both map to the same six symbols.
  --------------------------- */

  const NAG_MAP = {
    // Inline suffixes
    "!!"  : "!!",
    "??"  : "??",
    "!?"  : "!?",
    "?!"  : "?!",
    "!"   : "!",
    "?"   : "?",
    // Standard NAG codes
    "$1"  : "!",
    "$2"  : "?",
    "$3"  : "!!",
    "$4"  : "??",
    "$5"  : "!?",
    "$6"  : "?!"
  };

  /* ---------------------------
     TOKENIZER
  --------------------------- */

  function tokenize(src) {

    const tokens = [];
    let i = 0;

    while (i < src.length) {

      const char = src[i];

      if (char === "{") {
        let j = i + 1;
        while (j < src.length && src[j] !== "}") j++;
        tokens.push({ type: "comment", value: src.slice(i + 1, j).trim() });
        i = j + 1;
        continue;
      }

      if (char === "(") {
        tokens.push({ type: "var_start" });
        i++;
        continue;
      }

      if (char === ")") {
        tokens.push({ type: "var_end" });
        i++;
        continue;
      }

      if (/\s/.test(char)) {
        i++;
        continue;
      }

      let j = i;
      while (j < src.length && !/\s|\{|\}|\(|\)/.test(src[j])) j++;

      tokens.push({ type: "text", value: src.slice(i, j) });
      i = j;
    }

    return tokens;
  }

  const tokens = tokenize(pgn);

  /* ---------------------------
     PARSE STATE
  --------------------------- */

  const moves       = [];
  const comments    = [];
  const annotations = []; // cal/csl board annotations
  const variations  = [];
  const glyphs      = []; // move quality glyphs: "!", "?", "!!", "??", "!?", "?!"

  let moveIndex      = -1;
  let variationDepth = 0;

  const varStack = [];

  /* ---------------------------
     HELPERS
  --------------------------- */

  // Strips trailing glyph suffixes from a SAN move token and returns
  // { san, glyph } — glyph is null when none is present.
  function extractGlyph(token) {

    // Try longest suffixes first so "!!" isn't mistaken for two "!"
    const suffixes = ["!!", "??", "!?", "?!", "!", "?"];

    for (const s of suffixes) {
      if (token.endsWith(s)) {
        return { san: token.slice(0, -s.length), glyph: NAG_MAP[s] };
      }
    }

    return { san: token, glyph: null };
  }

  function isMove(token) {
    // Strip trailing glyph before testing
    const { san } = extractGlyph(token);
    return /^(O-O-O|O-O|[KQRNB]?[a-h]?[1-8]?x?[a-h][1-8](=?[QRNB])?[+#]?)/.test(san) &&
           san.length > 1;
  }

  function isMoveNumber(token) {
    return /^\d+\./.test(token);
  }

  function isResult(token) {
    return /^(1-0|0-1|1\/2-1\/2|\*)$/.test(token);
  }

  function isNAG(token) {
    return /^\$\d+$/.test(token);
  }

  /* ---------------------------
     MAIN LOOP
  --------------------------- */

  for (const t of tokens) {

    /* ENTER VARIATION */
    if (t.type === "var_start") {

      variationDepth++;

      const newVar = {
        moves:    [],
        comments: [],
        children: []
      };

      const parentMoveIndex = moveIndex;

      if (parentMoveIndex >= 0) {
        if (variationDepth === 1) {
          if (!variations[parentMoveIndex]) {
            variations[parentMoveIndex] = [];
          }
          variations[parentMoveIndex].push(newVar);
        } else if (varStack.length > 0) {
          varStack[varStack.length - 1].varObj.children.push(newVar);
        }
      }

      varStack.push({ varObj: newVar, parentMoveIndex });
      continue;
    }

    /* EXIT VARIATION */
    if (t.type === "var_end") {
      variationDepth--;
      varStack.pop();
      continue;
    }

    /* COMMENT */
    if (t.type === "comment") {

      const calMatches = [...t.value.matchAll(/\[%cal\s+([^\]]+)\]/g)];
      const cslMatches = [...t.value.matchAll(/\[%csl\s+([^\]]+)\]/g)];

      const cal = calMatches.map(m => m[1]);
      const csl = cslMatches.map(m => m[1]);

      const cleaned = t.value
        .replace(/\[%cal\s+[^\]]+\]/g, "")
        .replace(/\[%csl\s+[^\]]+\]/g, "")
        .replace(/\[%[^\]]+\]/g, "")
        .trim();

      if (variationDepth > 0 && varStack.length > 0) {
        const currentVar = varStack[varStack.length - 1].varObj;
        if (cleaned) currentVar.comments.push(cleaned);
        if (cal.length || csl.length) {
          if (!currentVar.moveAnnotations) currentVar.moveAnnotations = [];
          const mi = Math.max(0, currentVar.moves.length - 1);
          currentVar.moveAnnotations[mi] = { cal, csl };
        }
      } else if (moveIndex >= 0) {
        if (cleaned) comments[moveIndex] = cleaned;
        if (cal.length || csl.length) {
          annotations[moveIndex] = { cal, csl };
        }
      }

      continue;
    }

    /* TEXT TOKEN */
    if (t.type === "text") {

      const val = t.value;

      if (isMoveNumber(val) || isResult(val)) continue;

      // $N NAG — applies to the most recent main-line move
      if (isNAG(val)) {
        if (variationDepth === 0 && moveIndex >= 0 && NAG_MAP[val]) {
          // Only store if we don't already have a suffix glyph
          if (!glyphs[moveIndex]) {
            glyphs[moveIndex] = NAG_MAP[val];
          }
        }
        continue;
      }

      if (variationDepth === 0) {

        if (isMove(val)) {
          const { san, glyph } = extractGlyph(val);
          const result = chess.move(san);
          if (result) {
            moves.push(san);
            moveIndex++;
            if (glyph) glyphs[moveIndex] = glyph;
          }
        }

      } else {

        if (isMove(val) && varStack.length > 0) {
          const { san } = extractGlyph(val);
          varStack[varStack.length - 1].varObj.moves.push(san);
        }

      }

    }

  }

  /* ---------------------------
     EVAL PARSE
  --------------------------- */

  const evalRegex = /\[%eval ([^\]]+)\]/g;
  const evals     = [];

  let match;
  while ((match = evalRegex.exec(moveText)) !== null) {

    let val = match[1];

    if (val.startsWith("#")) {
      const sign = val.startsWith("#-") ? -1 : 1;
      val = sign * 10;
    }

    const parsed = parseFloat(val);
    evals.push(isFinite(parsed) ? parsed : 0);
  }

  while (evals.length < moves.length) {
    evals.push(evals.length > 0 ? evals[evals.length - 1] : 0);
  }

  /* ---------------------------
     RESULT
  --------------------------- */

  return {
    moves,
    evals,
    headers,
    comments,
    variations,
    annotations,
    glyphs
  };

}class VideoTitle {

  constructor(container) {
    this.container = container;
    this.titleEl   = container.querySelector(".video-title");
  }

  build(headers) {

    if (!this.titleEl) return;

    const wTitle = headers.WhiteTitle || "";
    const bTitle = headers.BlackTitle || "";

    const white = headers.White || "White";
    const black = headers.Black || "Black";

    const wElo = headers.WhiteElo ? ` (${headers.WhiteElo})` : "";
    const bElo = headers.BlackElo ? ` (${headers.BlackElo})` : "";

    const event = headers.Event || "";
    const date  = (headers.Date || "").replace(/\.\?+/g, ""); // strip trailing .??

    // Line 1: "WTitle White (elo) – BTitle Black (elo)"
    const leftSide  = `${wTitle ? wTitle + " " : ""}${white}${wElo}`.trim();
    const rightSide = `${bTitle ? bTitle + " " : ""}${black}${bElo}`.trim();
    const players   = `${leftSide} – ${rightSide}`;

    // Line 2: event and/or date
    let eventLine = "";
    if (event && date)  eventLine = `${event}, ${date}`;
    else if (event)     eventLine = event;
    else if (date)      eventLine = date;

    // Build DOM
    this.titleEl.innerHTML = "";

    // Emoji — sized via CSS to be ~2 lines tall
    const emojiSpan = document.createElement("span");
    emojiSpan.className   = "video-title-emoji";
    emojiSpan.textContent = "⚔️";
    this.titleEl.appendChild(emojiSpan);

    // Text block (two lines)
    const textDiv = document.createElement("div");
    textDiv.className = "video-title-text";

    const playersDiv = document.createElement("div");
    playersDiv.className   = "video-title-players";
    playersDiv.textContent = players;
    textDiv.appendChild(playersDiv);

    if (eventLine) {
      const eventDiv = document.createElement("div");
      eventDiv.className   = "video-title-event";
      eventDiv.textContent = eventLine;
      textDiv.appendChild(eventDiv);
    }

    this.titleEl.appendChild(textDiv);
  }
}function setupGestures(engine) {

  let lastTap = 0;

  // Double-tap left/right halves of the board for ±10 moves.
  const hitEl = engine.boardWrap || engine.boardEl;

  hitEl.addEventListener("click", function(e) {

    // Ignore clicks that originate from the play button
    if (e.target.closest && e.target.closest(".play")) return;

    const now  = Date.now();
    const rect = hitEl.getBoundingClientRect();
    const side = e.clientX < rect.left + rect.width / 2 ? "left" : "right";

    if (now - lastTap < 300) {
      // Double-tap
      engine.pause();
      if (side === "left") {
        engine.goTo(engine.state.index - 10);
      } else {
        engine.goTo(engine.state.index + 10);
      }
    }

    lastTap = now;
  });

  // Keyboard arrow navigation
  // FIX #7: keyboard nav enters a "keyboard mode" that hides play button & overlay
  // They reappear on mouse hover (handled by CSS) or board click.
  document.addEventListener("keydown", function(e) {

    // Only handle keys for the active player
    if (VideoEngine.activeEngine !== engine) return;

    if (e.code === "ArrowRight") {
      e.preventDefault();
      engine._enterKeyboardMode();
      if (engine._variation) {
        engine.state.playing = false;
        if (engine._variation.index < engine._variation.fens.length - 1) {
          engine.variationGoTo(engine._variation.index + 1);
        } else {
          const mainIdx = engine._variation.mainStateIndex;
          engine.exitVariation();
          engine.goTo(mainIdx + 1);
        }
      } else {
        engine.pause();
        engine.goTo(engine.state.index + 1);
      }
    }

    if (e.code === "ArrowLeft") {
      e.preventDefault();
      engine._enterKeyboardMode();
      if (engine._variation) {
        engine.state.playing = false;
        if (engine._variation.index > 1) {
          engine.variationGoTo(engine._variation.index - 1);
        } else {
          const mainIdx = engine._variation.mainStateIndex;
          engine.exitVariation();
          engine.goTo(mainIdx);
        }
      } else {
        engine.pause();
        engine.goTo(engine.state.index - 1);
      }
    }

  });

  // FIX #7: exit keyboard mode (restore normal hover behaviour) on mouse move over board
  hitEl.addEventListener("mouseenter", function() {
    engine._exitKeyboardMode();
  });

}class EvalBar {

  constructor(container) {
    this.container = container;
    this.bar  = container.querySelector(".eval-bar");
    this.fill = this.bar ? this.bar.querySelector(".eval-fill") : null;
  }

  update(score) {

    // Guard against null / undefined / NaN / Infinity
    if (score === undefined || score === null || typeof score !== "number" || !isFinite(score)) {
      score = 0;
    }

    // Hard clamp so downstream math never sees extreme values
    score = Math.max(-8, Math.min(8, score));

    // tanh mapping gives more visual resolution in the 0-4 pawn range
    // tanh(0) = 0 → 50%, tanh(1) ≈ 0.76 → ~88%, tanh(2) ≈ 0.96 → ~98%
    // We scale the input so ±3 pawns fills most of the bar while mates hit the edge
    const prob    = (Math.tanh(score * 0.4) + 1) / 2;
    const percent = prob * 100;

    if (this.fill) {
      this.fill.style.height = percent + "%";
    }
  }
}/* -------------------------------------------------------
   Figurine notation map
------------------------------------------------------- */
const _pieceToFigurine = { K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658' };

function toFigurine(san) {
  return san
    .replace(/^K/, '\u2654') // ♔
    .replace(/^Q/, '\u2655') // ♕
    .replace(/^R/, '\u2656') // ♖
    .replace(/^B/, '\u2657') // ♗
    .replace(/^N/, '\u2658'); // ♘
}

/* Convert chess moves in free text (PGN comments) to figurine notation.
   Handles piece moves (Nf3, Bxd5+, Nbd7), promotions (e8=Q+), and castling. */
function figurineComment(text) {
  // Piece moves: Nf3, Bxe5+, Nbd7, R1e1, Qh4#, etc.
  return text.replace(
    /(?<![a-zA-Z])([KQRBN])([a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#!?]*)/g,
    (_, piece, rest) => _pieceToFigurine[piece] + rest.replace(/=([QRBN])/, (__, p) => '=' + _pieceToFigurine[p])
  ).replace(
    // Pawn promotions: e8=Q+, bxa1=R#, etc.
    /(?<![a-zA-Z])([a-h](?:x[a-h])?[18])=([QRBN])([+#!?]*)/g,
    (_, prefix, piece, suffix) => prefix + '=' + _pieceToFigurine[piece] + suffix
  );
}

/* FIX #4: glyphs are displayed as plain text — no badge colours */

class VideoMoveList {

  constructor(container, engine) {
    this.container  = container;
    this.engine     = engine;
    this.el         = container.querySelector(".video-moves");
    this._halfSpans = [];
  }

  /**
   * @param {string[]} moves  – SAN move array
   * @param {string[]} glyphs – parallel glyph array from pgn-parser
   */
  build(moves, glyphs = []) {

    if (!this.el) return;

    this.el.innerHTML = "";
    this._halfSpans   = [];

    for (let i = 0; i < moves.length; i += 2) {

      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove  = moves[i];
      const blackMove  = moves[i + 1];

      const pairSpan = document.createElement("span");
      pairSpan.className = "move";

      // Move number
      const numSpan = document.createElement("span");
      numSpan.className   = "move-number";
      numSpan.textContent = `${moveNumber}.`;
      pairSpan.appendChild(numSpan);

      // White half
      const wSpan = this._makeHalf(whiteMove, glyphs[i], i);
      pairSpan.appendChild(wSpan);
      this._halfSpans[i] = wSpan;

      // Black half
      if (blackMove !== undefined) {
        const bSpan = this._makeHalf(blackMove, glyphs[i + 1], i + 1);
        pairSpan.appendChild(bSpan);
        this._halfSpans[i + 1] = bSpan;
      }

      this.el.appendChild(pairSpan);
    }

  }

  _makeHalf(san, glyph, moveIdx) {

    const span = document.createElement("span");
    span.className = "white-half";

    /* FIX #4: glyph appended as plain text directly after the move, no badge */
    const moveText = document.createElement("span");
    moveText.textContent = toFigurine(san) + (glyph ? glyph : "");
    span.appendChild(moveText);

    span.onclick = () => {
      this.engine.pause();
      this.engine.goTo(moveIdx + 1);
    };

    return span;
  }

  highlight(moveIndex) {

    if (!this.el) return;

    this.el.querySelectorAll(".white-half").forEach(el => {
      el.classList.remove("active");
    });

    if (moveIndex >= 0 && this._halfSpans[moveIndex]) {
      const span = this._halfSpans[moveIndex];
      span.classList.add("active");

      span.scrollIntoView({
        behavior: "smooth",
        inline:   "center",
        block:    "nearest"
      });
    }

  }

}/* good-move.js
   Renders a move-quality badge (!, ?, !!, ??, !?, ?!) on the destination
   square of the piece that just moved, and surfaces a human-readable
   description in the comment area if no other comment is already shown.
   -------------------------------------------------------------------- */

const GLYPH_META = {
  "!!"  : { label: "!!", color: "#1aa34a" },
  "!"   : { label: "!",  color: "#00AA00" },
  "!?"  : { label: "!?", color: "#0000FF" },
  "?!"  : { label: "?!", color: "#FFAA00" },
  "?"   : { label: "?",  color: "#FF0000" },
  "??"  : { label: "??", color: "#9c0202" }
};

class GoodMove {

  /**
   * @param {HTMLElement} boardEl   – the .board div (holds the chessboard squares)
   * @param {HTMLElement} commentEl – the .video-comment div (receives the description)
   */
  constructor(boardEl, commentEl) {
    this.boardEl   = boardEl;
    this.commentEl = commentEl;
    this._badge    = null; // current badge DOM element
  }

  /* ------------------------------------------------------------------
     render(moveIndex, glyphs, moves, chess)

     moveIndex  – 0-based index into the moves array (-1 = starting pos)
     glyphs     – array from pgn-parser: glyphs[moveIndex] = "!" | "?" …
     moves      – array of SAN strings
     chess      – a Chess() instance reset and replayed up to moveIndex,
                  so chess.history({verbose:true}) gives us the last move's
                  destination square.
  ------------------------------------------------------------------ */
  render(moveIndex, glyphs, moves, chessInstance) {

    this._clear();

    if (moveIndex < 0 || moveIndex >= moves.length) return;

    const glyph = glyphs[moveIndex];
    if (!glyph) return;

    const meta = GLYPH_META[glyph];
    if (!meta) return;

    // Derive the destination square from the verbose history
    const history = chessInstance.history({ verbose: true });
    if (!history.length) return;

    const lastMove  = history[history.length - 1];
    const toSquare  = lastMove.to; // e.g. "e4"

    // Locate the square DOM element inside the board
    const squareEl = this.boardEl.querySelector(`[data-square="${toSquare}"]`);
    if (!squareEl) return;

    // Build the badge
    const badge = document.createElement("div");
    badge.className        = "gm-badge";
    badge.textContent      = meta.label;
    badge.style.background = meta.color;

    // Position relative to the square element.
    // The badge sits at top-right of the square, offset slightly outward.
    const boardRect  = this.boardEl.getBoundingClientRect();
    const squareRect = squareEl.getBoundingClientRect();

    const right  = boardRect.right  - squareRect.right  + squareRect.width  * 0.05;
    const top    = squareRect.top   - boardRect.top      - squareRect.height * 0.05;

    badge.style.position = "absolute";
    badge.style.right    = right + "px";
    badge.style.top      = top   + "px";
    badge.style.zIndex   = "30";

    // The board element must be position:relative (already enforced by CSS)
    this.boardEl.appendChild(badge);
    this._badge = badge;
  }

  /* Remove any existing badge and glyph description */
  _clear() {
    if (this._badge) {
      this._badge.remove();
      this._badge = null;
    }
  }
}
function initOverlay(boardDiv, moveNode) {

  // Remove old annotation overlay (keep last-move overlay intact)
  const old = boardDiv.querySelector(".board-overlay:not(.last-move-overlay)");
  if (old) old.remove();

  // Create SVG overlay and attach it inside the actual 8×8 grid so 100%/100%
  // maps exactly to the square area — avoids sub-pixel offsets from the
  // chessboard.js outer border.
  const svg = createGridOverlaySVG(boardDiv);
  if (!svg) return;

  if (!moveNode) return;

  const grid = svg.parentNode;

  // Draw square highlights (circles)
  moveNode.squareMarks?.forEach(mark => {
    drawCircle(svg, grid, mark.square, mark.color);
  });

  // Draw arrows
  moveNode.arrows?.forEach(arrow => {
    drawArrow(svg, grid, arrow.from, arrow.to, arrow.color);
  });
}


/* ================= UTIL ================= */

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
 */
function createGridOverlaySVG(boardDiv, extraClass) {
  const grid = getGridElement(boardDiv);
  if (!grid) return null;

  // Ensure the grid can host absolutely-positioned overlays.
  if (grid !== boardDiv && getComputedStyle(grid).position === "static") {
    grid.style.position = "relative";
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("board-overlay");
  if (extraClass) svg.classList.add(extraClass);
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.style.position = "absolute";
  svg.style.left   = "0";
  svg.style.top    = "0";
  svg.style.width  = "100%";
  svg.style.height = "100%";
  svg.style.pointerEvents = "none";

  grid.appendChild(svg);
  return svg;
}

function getSquareCenter(grid, square) {

  const squareEl = grid.querySelector(`[data-square="${square}"]`);
  if (!squareEl) return null;

  const gridRect = grid.getBoundingClientRect();
  const rect     = squareEl.getBoundingClientRect();

  const xInGrid = (rect.left - gridRect.left) + rect.width  / 2;
  const yInGrid = (rect.top  - gridRect.top)  + rect.height / 2;

  return {
    x:    (xInGrid     / gridRect.width)  * 100,
    y:    (yInGrid     / gridRect.height) * 100,
    size: (rect.width  / gridRect.width)  * 100,
  };
}

function lichessColor(code, alpha = 0.85) {

  const colors = {
    R: [255,   0,   0],
    Y: [255, 170,   0],
    G: [  0, 170,   0],
    B: [  0,   0, 255]
  };

  const rgb = colors[code] || colors.R;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}


/* ================= CIRCLE ================= */

function drawCircle(svg, boardDiv, square, color) {

  const center = getSquareCenter(boardDiv, square);
  if (!center) return;

  const strokeWidth = center.size * 0.09;
  const radius      = (center.size / 2) - (strokeWidth / 2);

  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");

  circle.setAttribute("cx",           center.x);
  circle.setAttribute("cy",           center.y);
  circle.setAttribute("r",            radius);
  circle.setAttribute("fill",         "none");
  circle.setAttribute("stroke",       lichessColor(color, 0.8));
  circle.setAttribute("stroke-width", strokeWidth);

  svg.appendChild(circle);
}


/* ================= ARROW ================= */
/* FIX #5: arrow tip now reaches the exact centre of the destination square */

function drawArrow(svg, boardDiv, fromSquare, toSquare, color) {

  const start = getSquareCenter(boardDiv, fromSquare);
  const end   = getSquareCenter(boardDiv, toSquare);

  if (!start || !end) return;

  const dx     = end.x - start.x;
  const dy     = end.y - start.y;
  const angle  = Math.atan2(dy, dx);
  const length = Math.sqrt(dx * dx + dy * dy);

  const bodyWidth  = start.size * 0.16;
  const headWidth  = bodyWidth  * 3.5;
  /* FIX #5: headLength sized so tip lands at the square center (end.x, end.y) */
  let headLength = start.size * 0.55;
  /* FIX #5: startInset only — no edgeInset shortening at the tip */
  let startInset = start.size * 0.2;

  /* Scale arrow parts down for short moves (e.g. adjacent-square pawn pushes)
     so that every move always gets a visible arrow. */
  const minBodyFraction = 0.15;
  const totalInset = headLength + startInset;
  if (totalInset >= length * (1 - minBodyFraction)) {
    const scale = (length * (1 - minBodyFraction)) / totalInset;
    headLength *= scale;
    startInset *= scale;
  }
  const bodyLength = length - headLength - startInset;

  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  const halfBody = bodyWidth / 2;
  const halfHead = headWidth / 2;

  const originX = start.x + startInset * cos;
  const originY = start.y + startInset * sin;

  // Body rectangle corners
  const p1x = originX + halfBody * sin;
  const p1y = originY - halfBody * cos;
  const p2x = originX - halfBody * sin;
  const p2y = originY + halfBody * cos;

  const baseX = originX + bodyLength * cos;
  const baseY = originY + bodyLength * sin;

  const p3x = baseX - halfBody * sin;
  const p3y = baseY + halfBody * cos;
  const p7x = baseX + halfBody * sin;
  const p7y = baseY - halfBody * cos;

  // Head base
  const p4x = baseX - halfHead * sin;
  const p4y = baseY + halfHead * cos;
  const p6x = baseX + halfHead * sin;
  const p6y = baseY - halfHead * cos;

  /* FIX #5: tip is exactly end.x / end.y — the square center, no inset */
  const tipX = end.x;
  const tipY = end.y;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

  const d = [
    `M ${p1x} ${p1y}`,
    `L ${p2x} ${p2y}`,
    `L ${p3x} ${p3y}`,
    `L ${p4x} ${p4y}`,
    `L ${tipX} ${tipY}`,
    `L ${p6x} ${p6y}`,
    `L ${p7x} ${p7y}`,
    "Z"
  ].join(" ");

  path.setAttribute("d",    d);
  path.setAttribute("fill", lichessColor(color, 0.85));

  svg.appendChild(path);
}

// Expose at module scope so callers always find it
window.initOverlay = initOverlay;
/* video-engine.js */

/* ---------------------------------------------------------------
   VideoComment
--------------------------------------------------------------- */
class VideoComment {

  constructor(container, engine) {
    this.el     = container.querySelector(".video-comment");
    this.engine = engine;
  }

  update(moveIndex, comments, variations, isPaused, branchFEN, branchMoveNum, branchIsBlack, isGameOver) {

    if (!this.el) return false;

    const comment       = comments?.[moveIndex];
    const variationList = variations?.[moveIndex];

    let hasContent = false;
    this.el.innerHTML = "";

    if (comment) {
      hasContent = true;

      /* FIX 1 ── layout mirrors .video-title: emoji on left, text block on right */
      const div = document.createElement("div");
      div.className = "comment-line";

      const icon = document.createElement("span");
      icon.className   = "comment-icon";
      icon.textContent = "💬";

      /* Wrap body in a column div */
      const textBlock = document.createElement("div");
      textBlock.className = "comment-text-block";

      const body = document.createElement("span");
      body.className   = "comment-body";
      body.textContent = figurineComment(comment);
      textBlock.appendChild(body);

      div.appendChild(icon);
      div.appendChild(textBlock);

      this.el.appendChild(div);
    }

    if (variationList && variationList.length) {
      hasContent = true;

      variationList.forEach((variation) => {
        if (!variation.moves || !variation.moves.length) return;

        /* Two-column layout: icon on left, content on right
           — same pattern as .comment-line / .video-title */
        const block = document.createElement("div");
        block.className = "variation-block";

        const icon = document.createElement("span");
        icon.className   = "variation-icon";
        icon.textContent = "🔎";

        const content = document.createElement("div");
        content.className = "variation-content";

        const varFENs = [];
        const varVerbose = []; // from/to for each variation move
        const tempChess = new Chess();
        if (branchFEN) tempChess.load(branchFEN);
        varFENs.push(tempChess.fen());

        variation.moves.forEach(m => {
          const result = tempChess.move(m);
          varFENs.push(tempChess.fen());
          varVerbose.push(result ? { from: result.from, to: result.to } : null);
        });

        variation.moves.forEach((san, mi) => {

          const isBlackVarMove = branchIsBlack ? (mi % 2 === 0) : (mi % 2 === 1);
          const fullNum = branchMoveNum + Math.floor(
            (branchIsBlack ? mi : mi + 1) / 2
          );

          const needsNumber = !isBlackVarMove || mi === 0;

          if (needsNumber) {
            const numSpan = document.createElement("span");
            numSpan.className = "var-move-number";
            numSpan.textContent = isBlackVarMove
              ? `${fullNum}…`
              : `${fullNum}.`;
            content.appendChild(numSpan);
          }

          const moveSpan = document.createElement("span");
          moveSpan.className   = "var-move";
          moveSpan.textContent = toFigurine(san);

          const targetFEN = varFENs[mi + 1];

          moveSpan.onclick = () => {
            content.querySelectorAll(".var-move").forEach(s => s.classList.remove("active"));
            moveSpan.classList.add("active");
            const ann = variation.moveAnnotations?.[mi];
            this.engine.enterVariation(varFENs, variation.moveAnnotations, mi + 1, content, varVerbose);
            this.engine.showVariationPosition(targetFEN, ann, varVerbose[mi]);
          };

          content.appendChild(moveSpan);
        });

        if (variation.comments && variation.comments.length) {
          variation.comments.forEach(c => {
            const vcom = document.createElement("div");
            vcom.className = "variation-comment";

            const vbody = document.createElement("span");
            vbody.textContent = figurineComment(c);

            vcom.appendChild(vbody);
            content.appendChild(vcom);
          });
        }

        block.appendChild(icon);
        block.appendChild(content);
        this.el.appendChild(block);
      });
    }

    /* Single Continue button at the end of all content */
    if (hasContent && isPaused) {
      const btn = document.createElement("button");
      btn.className = "comment-play-btn";
      if (isGameOver) {
        btn.innerHTML = '<span class="material-icons">replay</span>';
        btn.onclick   = () => {
          this.el.querySelectorAll(".var-move").forEach(s => s.classList.remove("active"));
          this.engine.goTo(0);
          this.engine.showPlayBtn();
        };
      } else {
        btn.innerHTML = '<span class="material-icons">play_arrow</span>';
        btn.onclick   = () => {
          this.el.querySelectorAll(".var-move").forEach(s => s.classList.remove("active"));
          this.engine.play();
        };
      }
      this.el.appendChild(btn);
    }

    return hasContent;
  }

}



/* ---------------------------------------------------------------
   VideoEngine
--------------------------------------------------------------- */
class VideoEngine {

  /* Track which engine instance owns keyboard focus */
  static activeEngine = null;

  _activate() { VideoEngine.activeEngine = this; }

  constructor(container) {

    this.container = container;
    this.wrapper   = container;

    this.chess = new Chess();

    this.boardWrap = container.querySelector(".board-wrap");
    this.boardEl   = container.querySelector(".board");
    this.playBtn   = this.boardWrap ? this.boardWrap.querySelector(".play") : null;

    /* ---- Activate on any interaction ---- */
    const wrapper = container.parentElement;
    const activate = () => this._activate();
    wrapper.addEventListener("click",      activate);
    wrapper.addEventListener("mouseenter", activate);
    wrapper.addEventListener("touchstart", activate, { passive: true });

    this.board = Chessboard(this.boardEl, {
      position:   "start",
      pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
      moveSpeed:  200
    });

    /* Speed steps in moves-per-second */
    this._speedSteps = [0.5, 1.0, 2.0];
    this._speedIdx   = 1; // default: 1.0x

    this.state = {
      moves:       [],
      evals:       [],
      cache:       [],
      index:       0,
      playing:     false,
      speed:       this._speedSteps[1],
      headers:     {},
      comments:    [],
      variations:  [],
      annotations: [],
      glyphs:      []
    };

    this._loopLastTick = null;
    this._variation    = null; // active variation nav state

    /* ---- Board click (toggle play/pause) ---- */
    this.boardEl.addEventListener("click", () => this.togglePlay(true));

    /* ---- Play button ---- */
    if (this.playBtn) {
      this.playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.play();
      });
    }

    /* ---- Space bar (only for active player) ---- */
    document.addEventListener("keydown", (e) => {
      if (VideoEngine.activeEngine !== this) return;
      if (e.code === "Space") {
        e.preventDefault();
        this.togglePlay(true);
      }
    });

    /* ---- Sub-systems ---- */
    this.evalBar    = new EvalBar(container);
    this.title      = new VideoTitle(container.parentElement);
    this.moveList   = new VideoMoveList(container.parentElement, this);
    this.commentBox = new VideoComment(container.parentElement, this);

    const commentEl = container.parentElement.querySelector(".video-comment");
    this.goodMove   = new GoodMove(this.boardEl, commentEl);

    /* First engine created becomes active by default */
    if (!VideoEngine.activeEngine) this._activate();

    setupGestures(this);

    /* ---- Settings panel ---- */
    const settingsToggle = container.querySelector(".settings-toggle");
    const settingsPanel  = container.querySelector(".settings-panel");

    if (settingsToggle && settingsPanel) {
      settingsToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        settingsPanel.classList.toggle("hidden");
      });

      settingsPanel.addEventListener("click", (e) => e.stopPropagation());

      settingsPanel.querySelectorAll(".settings-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;

          if (action === "flip") {
            this.board.flip();
            if (this.evalBar && this.evalBar.bar) {
              const isFlipped = this.board.orientation() === "black";
              this.evalBar.bar.style.transform = isFlipped ? "rotate(180deg)" : "";
            }
            requestAnimationFrame(() => {
              if (this._variation) {
                const vi = this._variation.index;
                const ann = this._variation.moveAnnotations?.[vi - 1];
                const move = vi > 0 ? this._variation.verbose[vi - 1] : null;
                this.showVariationPosition(this._variation.fens[vi], ann, move);
              } else {
                const moveIdx = this.state.index - 1;
                this._drawLastMoveArrow(moveIdx);
                this.renderAnnotations(moveIdx);
                if (this.goodMove) {
                  const tmp = moveIdx >= 0 ? this._chessAt(moveIdx) : null;
                  this.goodMove.render(moveIdx, this.state.glyphs, this.state.moves, tmp);
                }
              }
            });
          }

          if (action === "speed") {
            this._speedIdx = (this._speedIdx + 1) % this._speedSteps.length;
            this.state.speed = this._speedSteps[this._speedIdx];
            const label = btn.querySelector(".speed-label");
            if (label) label.textContent = this.state.speed + "x";
          }

          if (action === "download" && this._rawPGN) {
            const blob = new Blob([this._rawPGN], { type: "application/x-chess-pgn" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            const white = this.state.headers.White || "game";
            const black = this.state.headers.Black || "";
            a.download = (white + (black ? "-" + black : "") + ".pgn").replace(/\s+/g, "_");
            a.click();
            URL.revokeObjectURL(a.href);
          }
        });
      });
    }
  }



  load(data, rawPGN) {

    this._rawPGN = rawPGN || "";

    this.state.moves       = data.moves       || [];
    this.state.evals       = data.evals       || [];
    this.state.headers     = data.headers     || {};
    this.state.comments    = data.comments    || [];
    this.state.variations  = data.variations  || [];
    this.state.annotations = data.annotations || [];
    this.state.glyphs      = data.glyphs      || [];

    this.buildCache();

    this.goTo(0);
    this.showPlayBtn();

    if (this.title)    this.title.build(this.state.headers);
    if (this.moveList) this.moveList.build(this.state.moves, this.state.glyphs);
  }



  buildCache() {

    this.chess.reset();
    this.state.cache    = [];
    this.state.cache[0] = this.chess.fen();

    this.state.moves.forEach((m, i) => {
      this.chess.move(m);
      this.state.cache[i + 1] = this.chess.fen();
    });
  }



  /* ===========================
     VARIATION NAVIGATION
  =========================== */

  enterVariation(fens, moveAnnotations, index, contentEl, verbose) {
    this._variation = {
      fens,
      moveAnnotations: moveAnnotations || [],
      verbose: verbose || [],
      index,
      mainStateIndex: this.state.index,
      contentEl
    };
  }

  exitVariation() {
    if (this._variation?.contentEl) {
      this._variation.contentEl.querySelectorAll(".var-move")
        .forEach(s => s.classList.remove("active"));
    }
    this._variation = null;
  }

  variationGoTo(index) {
    this._variation.index = index;
    const fen = this._variation.fens[index];
    const ann = this._variation.moveAnnotations?.[index - 1];
    const move = index > 0 ? this._variation.verbose[index - 1] : null;
    this.showVariationPosition(fen, ann, move);

    // Update active highlighting on variation move spans
    if (this._variation.contentEl) {
      const spans = this._variation.contentEl.querySelectorAll(".var-move");
      spans.forEach(s => s.classList.remove("active"));
      if (index > 0 && index - 1 < spans.length) {
        spans[index - 1].classList.add("active");
      }
    }
  }


  /* FIX 3 ── clear last-move arrow when showing a variation position */
  showVariationPosition(fen, ann, move) {
    this._clearLastMoveArrow();
    this.board.position(fen, true);
    if (this.goodMove) this.goodMove._clear();

    /* Draw last-move arrow for the variation move */
    if (move && move.from && move.to) {
      const svg = createGridOverlaySVG(this.boardEl, "last-move-overlay");
      if (svg) {
        svg.style.zIndex = "14";
        _drawLastMoveArrowSVG(svg, svg.parentNode, move.from, move.to);
      }
    }

    /* Render variation annotations (e.g. [%cal], [%csl]) on the board */
    this.clearOverlay();
    if (ann) {
      const node = { arrows: [], squareMarks: [] };
      ann.cal?.forEach(entry => {
        entry.split(",").forEach(item => {
          if (item.length >= 5) {
            node.arrows.push({ color: item[0], from: item.slice(1,3), to: item.slice(3,5) });
          }
        });
      });
      ann.csl?.forEach(entry => {
        entry.split(",").forEach(item => {
          if (item.length >= 3) {
            node.squareMarks.push({ color: item[0], square: item.slice(1,3) });
          }
        });
      });
      if (node.arrows.length || node.squareMarks.length) {
        initOverlay(this.boardEl, node);
      }
    }
  }



  /* ===========================
     LAST-MOVE ARROW
  =========================== */

  /* FIX 2 ── dedicated clear helper used by both goTo and showVariationPosition */
  _clearLastMoveArrow() {
    this.boardEl.querySelectorAll(".last-move-overlay").forEach(el => el.remove());
  }

  _drawLastMoveArrow(moveIndex) {
    /* FIX 2 ── always remove ALL existing last-move overlays first */
    this._clearLastMoveArrow();

    if (moveIndex < 0) return;

    /* FIX 2 ── use the pre-built cache instead of replaying moves, which
       was occasionally producing a stale/empty history due to timing. */
    const tmp = new Chess();
    for (let i = 0; i <= moveIndex; i++) {
      const result = tmp.move(this.state.moves[i]);
      if (!result) return; // safety: bail on invalid move
    }
    const hist = tmp.history({ verbose: true });
    if (!hist.length) return;

    const lastMove = hist[hist.length - 1];
    const from = lastMove.from;
    const to   = lastMove.to;

    const svg = createGridOverlaySVG(this.boardEl, "last-move-overlay");
    if (!svg) return;
    svg.style.zIndex = "14";

    _drawLastMoveArrowSVG(svg, svg.parentNode, from, to);
  }



  /* ===========================
     OVERLAY ANNOTATIONS
  =========================== */

  clearOverlay() {
    const old = this.boardEl.querySelector(".board-overlay:not(.last-move-overlay)");
    if (old) old.remove();
  }

  buildMoveNode(moveIndex) {

    if (moveIndex < 0) return null;
    const ann = this.state.annotations?.[moveIndex];
    if (!ann) return null;

    const node = { arrows: [], squareMarks: [] };

    ann.cal?.forEach(item => {
      node.arrows.push({ color: item[0], from: item.slice(1,3), to: item.slice(3,5) });
    });

    ann.csl?.forEach(item => {
      node.squareMarks.push({ color: item[0], square: item.slice(1,3) });
    });

    return node;
  }

  renderAnnotations(moveIndex) {
    this.clearOverlay();
    if (moveIndex < 0) return;
    const node = this.buildMoveNode(moveIndex);
    if (node) initOverlay(this.boardEl, node);
  }



  _chessAt(moveIndex) {
    const tmp = new Chess();
    for (let i = 0; i <= moveIndex; i++) tmp.move(this.state.moves[i]);
    return tmp;
  }

  _moveContext(moveIndex) {
    return {
      fullMoveNum: Math.floor(moveIndex / 2) + 1,
      isBlack:     moveIndex % 2 === 1
    };
  }



  goTo(i) {

    this._variation = null;

    if (i < 0) i = 0;
    if (i >= this.state.cache.length) i = this.state.cache.length - 1;

    this.board.position(this.state.cache[i], true);

    this.state.index = i;

    /* Eval bar */
    let score = this.state.evals[i];
    if (score === undefined || score === null) {
      if (i === this.state.moves.length && this.state.headers.Result) {
        const r = this.state.headers.Result;
        score = r === "1-0" ? 8 : r === "0-1" ? -8 : 0;
      } else {
        score = 0;
      }
    }
    this.evalBar.update(score);

    const moveIdx = i - 1;

    if (this.moveList) this.moveList.highlight(moveIdx);

    /* Last-move arrow */
    this._drawLastMoveArrow(moveIdx);

    if (this.commentBox) {
      const branchFEN = moveIdx >= 0 ? this.state.cache[moveIdx] : null;
      const ctx       = moveIdx >= 0 ? this._moveContext(moveIdx) : { fullMoveNum: 1, isBlack: false };
      const gameOver  = i >= this.state.moves.length;

      if (this.state.playing) {
        // While playing: check for comment and pause if found
        const hasComment = this.commentBox.update(
          moveIdx,
          this.state.comments,
          this.state.variations,
          false,
          branchFEN,
          ctx.fullMoveNum,
          ctx.isBlack,
          gameOver
        );
        if (hasComment) this.pause(); // pause() will re-render with isPaused=true
      } else {
        // While paused (keyboard nav etc.): render comment, hide play button if present
        const hasComment = this.commentBox.update(
          moveIdx,
          this.state.comments,
          this.state.variations,
          true,
          branchFEN,
          ctx.fullMoveNum,
          ctx.isBlack,
          gameOver
        );
        if (hasComment)          this.hidePlayBtn();
        else if (!this._keyboardMode) this.showPlayBtn();
      }
    }

    if (this.goodMove) {
      requestAnimationFrame(() => {
        const tmp = moveIdx >= 0 ? this._chessAt(moveIdx) : null;
        this.goodMove.render(moveIdx, this.state.glyphs, this.state.moves, tmp);
      });
    }

    this.renderAnnotations(moveIdx);
  }



  play() {

    if (this.state.index >= this.state.moves.length) this.state.index = 0;

    this.state.playing = true;
    this._keyboardMode = false;
    this.container.classList.remove("paused");
    this.hidePlayBtn();

    // Advance immediately so the first move plays at once, not after a delay
    this.state.index++;
    this.goTo(this.state.index);

    this._loopLastTick = null;
    this._loopRAF();
  }

  pause() {

    this.state.playing = false;
    this.container.classList.add("paused");

    // Re-render the current position in paused state (shows Continue button etc.)
    this.goTo(this.state.index);
  }

  togglePlay(showIcon = true) {
    this.state.playing ? this.pause() : this.play();
  }


  /* Timestamp-based RAF loop */
  _loopRAF() {

    if (!this.state.playing) return;

    const tick = (ts) => {

      if (!this.state.playing) return;

      const delay = 1000 / this.state.speed;

      if (this._loopLastTick === null) this._loopLastTick = ts;

      if (ts - this._loopLastTick >= delay) {
        this._loopLastTick = ts;

        if (this.state.index >= this.state.moves.length) {
          this.pause();
          return;
        }

        this.state.index++;
        this.goTo(this.state.index);
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }



  showPlayBtn() { if (this.playBtn) this.playBtn.classList.remove("hidden"); }
  hidePlayBtn() { if (this.playBtn) this.playBtn.classList.add("hidden");    }

  /* FIX #7 keyboard mode helpers */
  _enterKeyboardMode() {
    this.container.classList.add("keyboard-nav");
    this._keyboardMode = true;
    this.hidePlayBtn();
  }
  _exitKeyboardMode() {
    this.container.classList.remove("keyboard-nav");
    this._keyboardMode = false;
  }

}


/* ---------------------------------------------------------------
   Last-move arrow helper
--------------------------------------------------------------- */
function _drawLastMoveArrowSVG(svg, boardDiv, fromSquare, toSquare) {

  const start = getSquareCenter(boardDiv, fromSquare);
  const end   = getSquareCenter(boardDiv, toSquare);
  if (!start || !end) return;

  const dx     = end.x - start.x;
  const dy     = end.y - start.y;
  const angle  = Math.atan2(dy, dx);
  const length = Math.sqrt(dx * dx + dy * dy);

  const bodyWidth  = start.size * 0.14;
  const headWidth  = bodyWidth  * 3.2;

  /* Arrow tip points to the exact centre of the target square (no edgeInset).
     Scale arrow parts down for short moves (e.g. adjacent-square pawn pushes)
     so that every move always gets a visible arrow. */
  let headLength = start.size * 0.48;
  let startInset = start.size * 0.2;
  const minBodyFraction = 0.15;          // reserve at least 15 % for the shaft
  const totalInset = headLength + startInset;
  if (totalInset >= length * (1 - minBodyFraction)) {
    const scale = (length * (1 - minBodyFraction)) / totalInset;
    headLength *= scale;
    startInset *= scale;
  }
  const bodyLength = length - headLength - startInset;

  const sin = Math.sin(angle);
  const cos = Math.cos(angle);

  const halfBody = bodyWidth / 2;
  const halfHead = headWidth / 2;

  const ox = start.x + startInset * cos;
  const oy = start.y + startInset * sin;

  const p1x = ox + halfBody * sin,  p1y = oy - halfBody * cos;
  const p2x = ox - halfBody * sin,  p2y = oy + halfBody * cos;

  const bx = ox + bodyLength * cos;
  const by = oy + bodyLength * sin;

  const p3x = bx - halfBody * sin, p3y = by + halfBody * cos;
  const p7x = bx + halfBody * sin, p7y = by - halfBody * cos;

  const p4x = bx - halfHead * sin, p4y = by + halfHead * cos;
  const p6x = bx + halfHead * sin, p6y = by - halfHead * cos;

  const tipX = end.x;
  const tipY = end.y;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

  path.setAttribute("d", [
    `M ${p1x} ${p1y}`, `L ${p2x} ${p2y}`,
    `L ${p3x} ${p3y}`, `L ${p4x} ${p4y}`,
    `L ${tipX} ${tipY}`,
    `L ${p6x} ${p6y}`, `L ${p7x} ${p7y}`, "Z"
  ].join(" "));

  path.setAttribute("fill",    "rgba(40, 40, 40, 0.38)");
  path.setAttribute("stroke",  "none");

  svg.appendChild(path);
}
/* pgn-player.js — <pgn-player> custom element
   Usage:
     <pgn-player src="./data/sample-game.pgn"></pgn-player>
*/

class PgnPlayerElement extends HTMLElement {

  connectedCallback() {

    /* ── Build internal DOM ── */

    const wrapper = document.createElement("div");
    wrapper.className = "player-wrapper";

    wrapper.innerHTML = `
      <div class="video-title"></div>

      <div class="player-container">
        <div class="board-toolbar">
          <button class="settings-toggle">
            <span class="material-icons">settings</span>
          </button>
          <div class="settings-panel hidden">
            <button class="settings-btn" data-action="download" title="Download PGN">
              <span class="material-icons">download</span>
            </button>
            <button class="settings-btn" data-action="flip" title="Flip board">
              <span class="material-icons">swap_vert</span>
            </button>
            <button class="settings-btn" data-action="speed" title="Playback speed">
              <span class="material-icons">speed</span>
              <span class="speed-label">1x</span>
            </button>
          </div>
        </div>

        <div class="board-wrap">
          <div class="board"></div>
          <div class="play">
            <span class="material-icons">play_arrow</span>
          </div>
        </div>

        <div class="eval-bar">
          <div class="eval-fill"></div>
        </div>
      </div>

      <div class="video-moves"></div>
      <div class="video-comment"></div>
    `;

    this.appendChild(wrapper);

    /* ── Initialise engine ── */

    const container = wrapper.querySelector(".player-container");
    const engine    = new VideoEngine(container);

    const pgnSrc = this.getAttribute("src") || "./data/sample-game.pgn";

    fetch(pgnSrc)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(pgnText => {
        const data = loadPGN(pgnText);
        if (!data.moves || data.moves.length === 0) {
          throw new Error("No moves found in PGN");
        }
        engine.load(data, pgnText);
      })
      .catch(err => {
        console.error("PGN load error:", err);
        const titleEl = wrapper.querySelector(".video-title");
        if (titleEl) {
          titleEl.textContent = `⚠️ Could not load game: ${err.message}`;
        }
      });
  }
}

customElements.define("pgn-player", PgnPlayerElement);
