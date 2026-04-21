/* ChessPublica <pgn-player> element */

import { parseCAL, parseCSL, NAG_TO_GLYPH, stripCommentAnnotations } from "./helpers.js";
import {
  renderAnnotations as applyBoardAnnotations,
  clearAnnotations,
  createGridOverlaySVG,
  getSquareCenter,
} from "./board.js";

/* Skip global keyboard shortcuts while the user is editing a form field,
   otherwise Space / arrow keys would be swallowed instead of typed. */
function isTypingTarget(target) {
  const el = target || document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

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
        return { san: token.slice(0, -s.length), glyph: NAG_TO_GLYPH[s] };
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

      const cleaned = stripCommentAnnotations(t.value);

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
        if (variationDepth === 0 && moveIndex >= 0 && NAG_TO_GLYPH[val]) {
          // Only store if we don't already have a suffix glyph
          if (!glyphs[moveIndex]) {
            glyphs[moveIndex] = NAG_TO_GLYPH[val];
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

  const hasEvals = evals.length > 0;

  while (evals.length < moves.length) {
    evals.push(evals.length > 0 ? evals[evals.length - 1] : 0);
  }

  /* ---------------------------
     RESULT
  --------------------------- */

  return {
    moves,
    evals,
    hasEvals,
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

    const hasPlayers = !!(headers.White || headers.Black);
    const white = headers.White || "";
    const black = headers.Black || "";

    const wElo = headers.WhiteElo ? ` (${headers.WhiteElo})` : "";
    const bElo = headers.BlackElo ? ` (${headers.BlackElo})` : "";

    const event = headers.Event || "";
    const date  = (headers.Date || "").replace(/\.\?+/g, ""); // strip trailing .??

    // Line 1: "WTitle White (elo) – BTitle Black (elo)" (only when at least one is present)
    const leftSide  = `${wTitle ? wTitle + " " : ""}${white}${wElo}`.trim();
    const rightSide = `${bTitle ? bTitle + " " : ""}${black}${bElo}`.trim();
    const players   = hasPlayers ? `${leftSide || "?"} – ${rightSide || "?"}` : "";

    // Line 2: event and/or date
    let eventLine = "";
    if (event && date)  eventLine = `${event}, ${date}`;
    else if (event)     eventLine = event;
    else if (date)      eventLine = date;

    // Build DOM
    this.titleEl.innerHTML = "";

    // Lucide "swords" icon — sized via CSS to be ~2 lines tall
    const emojiSpan = document.createElement("span");
    emojiSpan.className = "video-title-emoji lucide-icon";
    emojiSpan.style.setProperty(
      "--icon",
      "url(https://unpkg.com/lucide-static@1.8.0/icons/swords.svg)",
    );
    this.titleEl.appendChild(emojiSpan);

    // Text block (two lines)
    const textDiv = document.createElement("div");
    textDiv.className = "video-title-text";

    if (hasPlayers) {
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
    } else if (eventLine) {
      const eventOnly = document.createElement("div");
      eventOnly.className   = "video-title-players";
      eventOnly.textContent = eventLine;
      textDiv.appendChild(eventOnly);
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

    // Don't hijack keys while the user is typing in a form control
    if (isTypingTarget(e.target)) return;

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
    this._disabled = false;
  }

  /** Grey-out the bar when the PGN has no [%eval] annotations. */
  setDisabled(flag) {
    this._disabled = !!flag;
    if (this.bar) {
      this.bar.classList.toggle("eval-disabled", this._disabled);
    }
  }

  update(score) {

    if (this._disabled) return;

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
   * @param {string[]} moves   – SAN move array
   * @param {string[]} glyphs  – parallel glyph array from pgn-parser
   * @param {Object}   headers – PGN headers (for appending the Result)
   */
  build(moves, glyphs = [], headers = {}) {

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

    /* Append the game result inline at the end of the move list, matching
       the <pgn> renderer. Skip "*" (ongoing) and missing values. */
    const rawResult = headers && headers.Result;
    if (rawResult && rawResult !== "*") {
      const label = rawResult === "1/2-1/2" ? "½-½" : rawResult;
      const resultSpan = document.createElement("span");
      resultSpan.className   = "move pgn-result";
      resultSpan.textContent = label;
      this.el.appendChild(resultSpan);
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
      icon.className = "comment-icon lucide-icon";
      icon.style.setProperty(
        "--icon",
        "url(https://unpkg.com/lucide-static@1.8.0/icons/message-square.svg)",
      );

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
        icon.className = "variation-icon lucide-icon";
        icon.style.setProperty(
          "--icon",
          "url(https://unpkg.com/lucide-static@1.8.0/icons/search.svg)",
        );

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
        btn.innerHTML = '<span class="lucide-icon" style="--icon:url(https://unpkg.com/lucide-static@1.8.0/icons/rotate-ccw.svg)" aria-label="Replay"></span>';
        btn.onclick   = () => {
          this.el.querySelectorAll(".var-move").forEach(s => s.classList.remove("active"));
          this.engine.goTo(0);
          this.engine.showPlayBtn();
        };
      } else {
        btn.innerHTML = '<span class="lucide-icon" style="--icon:url(https://unpkg.com/lucide-static@1.8.0/icons/play.svg)" aria-label="Play"></span>';
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

    /* Keep eval-bar height in sync with the (responsive) board height */
    const evalBarEl = container.querySelector(".eval-bar");
    const syncEvalHeight = () => {
      if (evalBarEl) evalBarEl.style.height = this.boardEl.offsetHeight + "px";
    };
    syncEvalHeight();
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(syncEvalHeight).observe(this.boardEl);
    }

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
      if (isTypingTarget(e.target)) return;
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

    if (this.evalBar) this.evalBar.setDisabled(!data.hasEvals);

    this.buildCache();

    this.goTo(0);
    this.showPlayBtn();

    if (this.title)    this.title.build(this.state.headers);
    if (this.moveList) this.moveList.build(this.state.moves, this.state.glyphs, this.state.headers);
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
      ann.cal?.forEach(entry => node.arrows.push(...parseCAL(entry)));
      ann.csl?.forEach(entry => node.squareMarks.push(...parseCSL(entry)));
      if (node.arrows.length || node.squareMarks.length) {
        applyBoardAnnotations(this.boardEl, node);
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
    clearAnnotations(this.boardEl);
  }

  buildMoveNode(moveIndex) {
    if (moveIndex < 0) return null;
    const ann = this.state.annotations?.[moveIndex];
    if (!ann) return null;

    const node = { arrows: [], squareMarks: [] };
    ann.cal?.forEach(entry => node.arrows.push(...parseCAL(entry)));
    ann.csl?.forEach(entry => node.squareMarks.push(...parseCSL(entry)));

    return (node.arrows.length || node.squareMarks.length) ? node : null;
  }

  renderAnnotations(moveIndex) {
    this.clearOverlay();
    if (moveIndex < 0) return;
    const node = this.buildMoveNode(moveIndex);
    if (node) applyBoardAnnotations(this.boardEl, node);
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

  const start = getSquareCenter(svg, boardDiv, fromSquare);
  const end   = getSquareCenter(svg, boardDiv, toSquare);
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

/* Lichess serves PGNs from two families of URLs:
     - Public web routes (e.g. /study/{id}/{chapter}.pgn, /{gameId}) —
       these work in a browser tab but do NOT set Access-Control-Allow-Origin,
       so fetch() from another origin fails with "Failed to fetch".
     - /api/* endpoints — these DO set CORS headers and work from any origin.
   Rewrite the common web routes to their API equivalents so users can
   paste the URL straight from the Lichess address bar. */
function normalizeLichessUrl(src) {

  const m = src.match(/^https?:\/\/lichess\.org\/(.*)$/i);
  if (!m) return src;

  // Strip query / fragment before matching
  const path = m[1].replace(/[?#].*$/, "");

  // Study chapter: study/{studyId}/{chapterId}(.pgn)?
  let mm = path.match(/^study\/([^/]+)\/([^/.]+)(?:\.pgn)?$/);
  if (mm) return `https://lichess.org/api/study/${mm[1]}/${mm[2]}.pgn`;

  // Whole study:  study/{studyId}(.pgn)?
  mm = path.match(/^study\/([^/.]+)(?:\.pgn)?$/);
  if (mm) return `https://lichess.org/api/study/${mm[1]}.pgn`;

  // Single game: {gameId}[/white|/black][.pgn]
  mm = path.match(/^([a-zA-Z0-9]{8})(?:\/(?:white|black))?(?:\.pgn)?$/);
  if (mm) return `https://lichess.org/game/export/${mm[1]}.pgn`;

  return src;
}

class PgnPlayerElement extends HTMLElement {

  connectedCallback() {

    /* Capture any inline PGN text BEFORE we inject the player DOM,
       otherwise the wrapper's own text (button labels etc.) would be
       mixed into textContent. */
    const inlineText = this.textContent.trim();
    this.innerHTML = "";

    /* ── Build internal DOM ── */

    const wrapper = document.createElement("div");
    wrapper.className = "player-wrapper";

    wrapper.innerHTML = `
      <div class="video-title"></div>

      <div class="player-container">
        <div class="board-toolbar">
          <button class="settings-toggle" aria-label="Settings">
            <span class="lucide-icon" style="--icon:url(https://unpkg.com/lucide-static@1.8.0/icons/settings.svg)"></span>
          </button>
          <div class="settings-panel hidden">
            <button class="settings-btn" data-action="download" title="Download PGN" aria-label="Download PGN">
              <span class="lucide-icon" style="--icon:url(https://unpkg.com/lucide-static@1.8.0/icons/download.svg)"></span>
            </button>
            <button class="settings-btn" data-action="flip" title="Flip board" aria-label="Flip board">
              <span class="lucide-icon" style="--icon:url(https://unpkg.com/lucide-static@1.8.0/icons/arrow-up-down.svg)"></span>
            </button>
            <button class="settings-btn" data-action="speed" title="Playback speed" aria-label="Playback speed">
              <span class="lucide-icon" style="--icon:url(https://unpkg.com/lucide-static@1.8.0/icons/gauge.svg)"></span>
              <span class="speed-label">1x</span>
            </button>
          </div>
        </div>

        <div class="board-wrap">
          <div class="board"></div>
          <div class="play" aria-label="Play">
            <span class="lucide-icon" style="--icon:url(https://unpkg.com/lucide-static@1.8.0/icons/play.svg)"></span>
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

    /* Defer so CSS is computed before chessboard.js reads offsetWidth.
       Without this, synchronous (IIFE) bundles initialise the board
       before styles are applied, causing incorrect board sizing. */
    requestAnimationFrame(() => {

    const container = wrapper.querySelector(".player-container");
    const engine    = new VideoEngine(container);

    /* Pause when scrolled fully out of view */
    if (typeof IntersectionObserver !== "undefined") {
      new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting && VideoEngine.activeEngine === engine && engine.state.playing) {
          engine.pause();
        }
      }, { threshold: 0 }).observe(this);
    }

    const showError = (msg) => {
      console.error("PGN load error:", msg);
      const titleEl = wrapper.querySelector(".video-title");
      if (titleEl) {
        titleEl.textContent = `⚠️ Could not load game: ${msg}`;
      }
    };

    const renderFromText = (pgnText) => {
      const data = loadPGN(pgnText);
      if (!data.moves || data.moves.length === 0) {
        throw new Error("No moves found in PGN");
      }
      engine.load(data, pgnText);
    };

    const pgnSrc = this.getAttribute("src");

    if (pgnSrc) {
      const fetchUrl = normalizeLichessUrl(pgnSrc);
      fetch(fetchUrl)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(renderFromText)
        .catch(err => {
          // fetch() throws TypeError on network/CORS failures — the message
          // ("Failed to fetch") is unhelpful on its own, so add context.
          const msg = (err && err.name === "TypeError")
            ? `network or CORS error fetching ${fetchUrl}`
            : err.message;
          showError(msg);
        });
    } else if (inlineText) {
      try {
        renderFromText(inlineText);
      } catch (err) {
        showError(err.message);
      }
    } else {
      showError("<pgn-player> is empty (no inline content and no src attribute).");
    }

    }); // end requestAnimationFrame
  }
}

customElements.define("pgn-player", PgnPlayerElement);
