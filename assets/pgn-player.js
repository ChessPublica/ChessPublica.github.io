/* ChessPublica <pgn-player> element */

import {
  parseCAL,
  parseCSL,
  NAG_TO_GLYPH,
  nagsToGlyph,
  stripCommentAnnotations,
  toFigurine,
  applyFigurineNotation,
  createReadyGate,
  normalizeSAN,
  extractPuzzleMarker,
} from "./helpers.js";
import { lucideIconUrl } from "./icons.js";
import {
  renderAnnotations as applyBoardAnnotations,
  clearAnnotations,
  createGridOverlaySVG,
  getSquareCenter,
} from "./board.js";

/* Convert SAN piece-move tokens in a plain-text comment to figurine
   notation. The comment text is rendered via textContent so it carries
   no real HTML tags; the helper's tag-aware regex still works because
   the tag-matching alternative simply finds nothing to skip and the
   piece-move alternative does the substitution. */
function figurineComment(text) {
  return applyFigurineNotation(text);
}

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

  /* Custom starting position — PGN "FEN" header (normally paired with
     SetUp="1", though some sources omit SetUp and just supply FEN).
     Loaded before any moves are parsed so move validation, the move
     cache, and move-number/side-to-move bookkeeping all key off the
     actual starting position instead of assuming a standard start.
     Falls back to the standard start if the FEN is missing or invalid. */
  const hasFEN = !!headers.FEN && headers.SetUp !== "0";
  if (!hasFEN || !chess.load(headers.FEN)) {
    chess.reset();
  }

  const startFEN         = chess.fen();
  const startFENFields    = startFEN.split(" ");
  const startColor       = startFENFields[1] || "w";
  const startMoveNumber  = parseInt(startFENFields[5], 10) || 1;

  /* Board flip — PGN "Orientation" header ("White"/"Black", case-insensitive),
     matching the convention already used by <puzzle>. Anything else (missing,
     misspelled) is ignored and the board keeps the default white-at-bottom view. */
  const orientationHeader = (headers.Orientation || "").toLowerCase();
  const orientation = orientationHeader === "black" ? "black"
                     : orientationHeader === "white" ? "white"
                     : null;

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
        /* Depth-counting scan, matching the tokenizer in pgn.js, so the
           static <pgn> renderer and the <pgn-player> agree on where a
           comment ends even if the source contains a stray "{". */
        let depth = 1;
        let j = i + 1;
        while (depth > 0 && j < src.length) {
          if (src[j] === "{") depth++;
          else if (src[j] === "}") depth--;
          j++;
        }
        tokens.push({ type: "comment", value: src.slice(i + 1, j - 1).trim() });
        i = j;
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
  const nagsByMove  = []; // raw NAG tokens per main-line move — combined into glyphs below
  const puzzles     = []; // [P] / [Pn] puzzle markers: { plies }

  let moveIndex      = -1;
  let variationDepth = 0;

  const varStack = [];

  /* ---------------------------
     HELPERS
  --------------------------- */

  // Strips a trailing glyph suffix from a SAN move token and returns
  // { san, nag } — nag is the raw suffix ("!", "!!", …), null if none.
  function extractGlyph(token) {

    // Try longest suffixes first so "!!" isn't mistaken for two "!"
    const suffixes = ["!!", "??", "!?", "?!", "!", "?"];

    for (const s of suffixes) {
      if (token.endsWith(s)) {
        return { san: token.slice(0, -s.length), nag: s };
      }
    }

    return { san: token, nag: null };
  }

  function isMove(token) {
    // Strip trailing glyph before testing
    const { san } = extractGlyph(token);
    return /^(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=?[QRBN])?[+#]?)/.test(san) &&
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
        moves:      [],
        comments:   [],
        children:   [],
        nagsByMove: [], // raw NAG tokens per variation move — combined into glyphs at render time
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

      /* [P] / [Pn] puzzle marker — stripped via the shared helper (also
         used by <pgn>) before running stripCommentAnnotations(), since
         [P] isn't part of the [%…] Lichess annotation family that helper
         already handles. */
      const { plies: puzzlePlies, text: commentSrc } = extractPuzzleMarker(t.value);

      const cleaned = stripCommentAnnotations(commentSrc);

      if (variationDepth > 0 && varStack.length > 0) {
        const currentVar = varStack[varStack.length - 1].varObj;
        if (cleaned) currentVar.comments.push(cleaned);
        if (cal.length || csl.length) {
          if (!currentVar.moveAnnotations) currentVar.moveAnnotations = [];
          const mi = Math.max(0, currentVar.moves.length - 1);
          currentVar.moveAnnotations[mi] = { cal, csl };
        }
      } else {
        /* moveIndex is -1 for a comment before the very first main-line
           move (e.g. a puzzle marker attached to a FEN-header start, or
           intro prose before move 1) — store it at that slot too, same
           as any other move's comment/annotation/puzzle marker. goTo(0)
           reads comments/annotations/puzzles with moveIdx = -1 already,
           so this just fills in data that was previously silently
           dropped. */
        if (cleaned) comments[moveIndex] = cleaned;
        if (cal.length || csl.length) {
          annotations[moveIndex] = { cal, csl };
        }
        if (puzzlePlies) {
          puzzles[moveIndex] = { plies: puzzlePlies };
        }
      }

      continue;
    }

    /* TEXT TOKEN */
    if (t.type === "text") {

      const val = t.value;

      if (isMoveNumber(val) || isResult(val)) continue;

      // $N NAG — applies to the most recent move (main-line or variation).
      // Stored as a raw token alongside any inline suffix glyph on the
      // same move; nagsToGlyph() combines up to one quality glyph (!, ?,
      // …) and one positional-evaluation glyph (±, −+, …) at the end.
      if (isNAG(val)) {
        if (!NAG_TO_GLYPH[val]) continue;
        if (variationDepth === 0 && moveIndex >= 0) {
          if (!nagsByMove[moveIndex]) nagsByMove[moveIndex] = [];
          nagsByMove[moveIndex].push(val);
        } else if (variationDepth > 0 && varStack.length > 0) {
          const currentVar = varStack[varStack.length - 1].varObj;
          const mi = Math.max(0, currentVar.moves.length - 1);
          if (!currentVar.nagsByMove[mi]) currentVar.nagsByMove[mi] = [];
          currentVar.nagsByMove[mi].push(val);
        }
        continue;
      }

      if (variationDepth === 0) {

        if (isMove(val)) {
          const { san, nag } = extractGlyph(val);
          /* sloppy:true mirrors pgn.js so authored PGNs that use long
             algebraic notation (e2-e4) or lowercase piece letters parse
             the same in both renderers. */
          const result = chess.move(san, { sloppy: true });
          if (result) {
            moves.push(san);
            moveIndex++;
            nagsByMove[moveIndex] = nag ? [nag] : [];
          }
        }

      } else {

        if (isMove(val) && varStack.length > 0) {
          const { san, nag } = extractGlyph(val);
          const currentVar = varStack[varStack.length - 1].varObj;
          currentVar.moves.push(san);
          currentVar.nagsByMove[currentVar.moves.length - 1] = nag ? [nag] : [];
        }

      }

    }

  }

  /* ---------------------------
     EVAL PARSE
  --------------------------- */

  const evalRegex = /\[%(?:eval|evp) ([^\]]+)\]/g;
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

  // Combine each move's raw NAG tokens into its display glyph now that
  // parsing is done — up to one quality glyph + one eval glyph per move.
  const glyphs = nagsByMove.map(nagsToGlyph);

  return {
    moves,
    evals,
    hasEvals,
    headers,
    comments,
    variations,
    annotations,
    glyphs,
    puzzles,
    startFEN,
    startColor,
    startMoveNumber,
    orientation
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
    emojiSpan.style.setProperty("--icon", lucideIconUrl("swords"));
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
  const signal = engine._abortSignal;

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
  }, { signal });

  // Keyboard arrow navigation
  // FIX #7: keyboard nav enters a "keyboard mode" that hides play button & overlay
  // They reappear on mouse hover (handled by CSS) or board click.
  document.addEventListener("keydown", function(e) {

    // Only handle keys for the active player
    if (VideoEngine.activeEngine !== engine) return;

    // Don't hijack keys while the user is typing in a form control
    if (isTypingTarget(e.target)) return;

    // Only handle arrow keys if the player is visible in the viewport
    const rect = engine.container.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
    if (!isVisible) return;

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

  }, { signal });

  // FIX #7: exit keyboard mode (restore normal hover behaviour) on mouse move over board
  hitEl.addEventListener("mouseenter", function() {
    engine._exitKeyboardMode();
  }, { signal });

}class EvalBar {

  constructor(container) {
    this.container = container;
    this.bar  = container.querySelector(".eval-bar");
    this.fill = this.bar ? this.bar.querySelector(".eval-fill") : null;
    this._disabled = false;
  }

  /** Hide the bar entirely when the PGN has no [%eval]/[%evp] annotations. */
  setDisabled(flag) {
    this._disabled = !!flag;
    if (this.bar) {
      this.bar.classList.toggle("eval-disabled", this._disabled);
    }
    /* Also drop the width reserved for the eval bar's column on
       .player-container and its parent .player-wrapper — otherwise the
       board (and everything else in the wrapper) sits inside a box 10px
       wider than it needs, leaving a blank gutter to the right. */
    if (this.container) {
      this.container.classList.toggle("no-eval-bar", this._disabled);
      const wrapper = this.container.parentElement;
      if (wrapper) wrapper.classList.toggle("no-eval-bar", this._disabled);
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
}

/* FIX #4: glyphs are displayed as plain text — no badge colours */

class VideoMoveList {

  constructor(container, engine) {
    this.container   = container;
    this.engine      = engine;
    this.el          = container.querySelector(".video-moves");
    this._halfSpans  = [];
    this._numSpans   = [];  // move-number span, indexed by the pair's white (even) moveIndex
    this._revealed   = [];  // parallel boolean array
    this._resultSpan = null;
    this._hideFromIndex = Infinity;
    this._startOffset = 0;
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
    this._numSpans    = [];
    this._revealed    = [];
    this._resultSpan  = null;

    /* A game with a puzzle hides every move from the puzzle's first
       covered ply onward — not just the puzzle's own answer(s), but
       everything after it too — instead of showing the full transcript
       up front. Each hidden move is revealed only once it's actually
       been played: by solving the puzzle (PuzzleMode calls reveal()) or
       by normal playback continuing past it (goTo() calls
       revealThrough()). Games with no puzzle keep the full list visible
       immediately, unchanged. */
    const puzzles = this.engine.state.puzzles || [];
    const puzzleIndices = [];
    /* A puzzle marker attached before the very first move (e.g. a
       FEN-header start where [P] covers the game's opening move) lives
       at puzzles[-1] — a non-index property Array#forEach never visits,
       so it's checked separately here. */
    const startMarker = puzzles[-1];
    if (startMarker) {
      for (let k = 1; k <= startMarker.plies; k++) puzzleIndices.push(-1 + k);
    }
    puzzles.forEach((marker, startIndex) => {
      if (!marker) return;
      for (let k = 1; k <= marker.plies; k++) puzzleIndices.push(startIndex + k);
    });
    this._hideFromIndex = puzzleIndices.length ? Math.min(...puzzleIndices) : Infinity;

    /* A PGN can start from a FEN where Black is to move (e.g. a study
       chapter beginning mid-game). `offset` shifts White/Black parity so
       pairing and move numbers key off the real side to move instead of
       always assuming moves[0] is White; reveal() below re-derives the
       same offset to keep the hidden-move-number reveal logic in sync. */
    const offset = this.engine.state.startColor === "b" ? 1 : 0;
    const startMoveNumber = this.engine.state.startMoveNumber || 1;
    this._startOffset = offset;

    let i = 0;

    // Lone Black half opening the list when the game starts mid-move-pair.
    if (offset === 1 && moves.length > 0) {

      const pairSpan = document.createElement("span");
      pairSpan.className = "move";

      const numSpan = document.createElement("span");
      numSpan.className   = "move-number";
      numSpan.textContent = `${startMoveNumber}…`;
      pairSpan.appendChild(numSpan);
      this._numSpans[0] = numSpan;

      const bSpan = this._makeHalf(moves[0], glyphs[0], 0);
      pairSpan.appendChild(bSpan);
      this._halfSpans[0] = bSpan;

      if (0 >= this._hideFromIndex) numSpan.style.display = "none";

      this.el.appendChild(pairSpan);
      i = 1;
    }

    for (; i < moves.length; i += 2) {

      const moveNumber = startMoveNumber + Math.floor((i + offset) / 2);
      const whiteMove  = moves[i];
      const blackMove  = moves[i + 1];

      const pairSpan = document.createElement("span");
      pairSpan.className = "move";

      // Move number
      const numSpan = document.createElement("span");
      numSpan.className   = "move-number";
      numSpan.textContent = `${moveNumber}.`;
      pairSpan.appendChild(numSpan);
      this._numSpans[i] = numSpan;

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

      /* Hide the move number itself only once White's half is hidden —
         seeing e.g. "15." with nothing after it would still tip off how
         far the game runs. A hidden-black/visible-white pair keeps its
         number, matching normal notation. */
      if (i >= this._hideFromIndex) numSpan.style.display = "none";

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
      if (moves.length >= this._hideFromIndex) resultSpan.style.display = "none";
      this.el.appendChild(resultSpan);
      this._resultSpan = resultSpan;
    }

  }

  _makeHalf(san, glyph, moveIdx) {

    const span = document.createElement("span");
    span.className = "white-half";

    /* FIX #4: glyph appended as plain text directly after the move, no badge */
    const moveText = document.createElement("span");
    moveText.className = "move-text";

    if (moveIdx >= this._hideFromIndex) {
      span.dataset.san    = san;
      span.dataset.glyph  = glyph || "";
      span.style.display  = "none";
      this._revealed[moveIdx] = false;
    } else {
      moveText.textContent = toFigurine(san) + (glyph ? glyph : "");
      this._revealed[moveIdx] = true;
    }
    span.appendChild(moveText);

    span.onclick = () => {
      if (!this._revealed[moveIdx]) return;
      this.engine.pause();
      this.engine.goTo(moveIdx + 1);
    };

    return span;
  }

  /* Reveal a single hidden move — called as it's actually played, either
     by PuzzleMode solving a ply or by normal playback reaching it. */
  reveal(moveIndex) {
    if (this._revealed[moveIndex]) return;

    const span = this._halfSpans[moveIndex];
    if (!span) return;

    const moveText = span.querySelector(".move-text");
    moveText.textContent = toFigurine(span.dataset.san) + (span.dataset.glyph || "");
    span.style.display = "";
    this._revealed[moveIndex] = true;

    /* The half that opens its pair (White, normally — or the lone Black
       half when the game starts mid-pair) also unhides the shared
       move-number label. _numSpans is only populated at pair-opening
       indices, so checking for an entry there directly covers both the
       normal parity case and the lone-Black-opener special case (index 0
       when the game starts with Black to move). */
    const numSpan = this._numSpans[moveIndex];
    if (numSpan) numSpan.style.display = "";
  }

  /* Reveal every hidden move up to and including moveIndex — used when
     playback jumps ahead (skip, resuming past a solved puzzle) instead
     of advancing one ply at a time. Also reveals the game result once
     the final move is reached. */
  revealThrough(moveIndex) {
    for (let i = 0; i <= moveIndex; i++) this.reveal(i);
    if (this._resultSpan && moveIndex >= this.engine.state.moves.length - 1) {
      this._resultSpan.style.display = "";
    }
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
     render(moveIndex, glyphs, moves, lastMove)

     moveIndex  – 0-based index into the moves array (-1 = starting pos)
     glyphs     – array from pgn-parser: glyphs[moveIndex] = "!" | "?" …
     moves      – array of SAN strings
     lastMove   – verbose move record { from, to, ... } from
                  state.history[moveIndex]; precomputed by buildCache so
                  we don't have to replay the game on every navigation.
  ------------------------------------------------------------------ */
  render(moveIndex, glyphs, moves, lastMove) {

    this._clear();

    if (moveIndex < 0 || moveIndex >= moves.length) return;

    const glyph = glyphs[moveIndex];
    if (!glyph) return;

    const meta = GLYPH_META[glyph];
    if (!meta) return;

    if (!lastMove || !lastMove.to) return;

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

/* ---------------------------------------------------------------
   PuzzleMode

   Turns the player's own board into a drag-and-drop puzzle when
   playback reaches a move carrying a [P] / [Pn] marker, then resumes
   normal playback once the reader solves it. No second board, no
   modal — it drives the same VideoEngine.board instance.
--------------------------------------------------------------- */
class PuzzleMode {

  constructor(engine) {
    this.engine        = engine;
    this.active         = false;
    this.chess          = null;
    this.startIndex     = null; // 0-based moveIndex the [P] marker is attached to
    this.plies          = 0;
    this.solvedCount    = 0;
    this.expected       = [];   // SAN moves the reader/auto-reply must play, in order
    this.solvedIndices  = new Set(); // startIndex values already solved this session
  }

  /* Called from VideoEngine.goTo() for every moveIndex the player lands on. */
  handleArrival(moveIndex) {
    const marker = this.engine.state.puzzles && this.engine.state.puzzles[moveIndex];

    if (!marker || this.solvedIndices.has(moveIndex)) {
      if (this.active) this._deactivate();
      return;
    }

    if (this.active && this.startIndex === moveIndex) return; // already solving this one

    this._activate(moveIndex, marker.plies);
  }

  _activate(moveIndex, plies) {
    const engine = this.engine;

    this.active      = true;
    this.startIndex  = moveIndex;
    this.plies       = plies;
    this.solvedCount = 0;
    this.chess       = new Chess(engine.state.cache[moveIndex + 1]);
    this.expected    = engine.state.moves.slice(moveIndex + 1, moveIndex + 1 + plies);

    /* Stop the autoplay loop outright — a bare [P] with no prose comment
       leaves state.comments[moveIndex] empty, so the usual
       hasComment-triggered pause() never fires and _loopRAF() would
       otherwise keep advancing the game out from under the puzzle. */
    engine.state.playing = false;
    engine.container.classList.add("paused");

    engine._puzzleActive = true;
    engine.container.classList.add("puzzle-active");
    engine.hidePlayBtn();

    /* Solving-by-dragging replaces the usual "Continue" button; strip it
       if the comment box just rendered one. The "Find the best move…"
       prompt is appended below any prose comment already rendered for
       this move (rather than only when the comment box is empty), so a
       [P] marker sharing a comment with prose still gets its prompt. */
    const el = engine.commentBox && engine.commentBox.el;
    if (el) {
      el.querySelectorAll(".comment-play-btn").forEach(btn => btn.remove());

      const solverColor = this.chess.turn() === "w" ? "White" : "Black";
      const prompt = document.createElement("div");
      prompt.className = "comment-line puzzle-prompt";

      const icon = document.createElement("span");
      icon.className = "comment-icon lucide-icon";
      icon.style.setProperty("--icon", lucideIconUrl("puzzle"));

      const textBlock = document.createElement("div");
      textBlock.className = "comment-text-block";

      const body = document.createElement("span");
      body.className   = "comment-body";
      body.textContent = `Find the best move for ${solverColor}.`;
      textBlock.appendChild(body);

      prompt.appendChild(icon);
      prompt.appendChild(textBlock);
      el.appendChild(prompt);
    }
  }

  _deactivate() {
    this.active      = false;
    this.startIndex  = null;
    this.chess       = null;
    this.expected    = [];
    this.engine._puzzleActive = false;
    this.engine.container.classList.remove("puzzle-active");
  }

  /* Board's onDragStart — only let the solver pick up their own pieces. */
  canDrag(piece) {
    if (!this.active) return false;
    return !!piece && piece[0] === this.chess.turn();
  }

  /* Board's onDrop. */
  handleDrop(from, to) {
    if (!this.active) return "snapback";

    const expectedSAN = this.expected[this.solvedCount];
    const move = this.chess.move({ from, to, promotion: "q" });

    if (!move || normalizeSAN(move.san) !== normalizeSAN(expectedSAN)) {
      if (move) this.chess.undo();
      this._shake();
      return "snapback";
    }

    this._advance();
    return true;
  }

  /* Plays the current expected solution move for the solver — invoked by
     the hint (key icon) button under the board. Mirrors handleDrop()'s
     success path; the move is already known correct so there's no
     from/to to validate against. */
  showHint() {
    if (!this.active) return;

    const expectedSAN = this.expected[this.solvedCount];
    const move = this.chess.move(expectedSAN, { sloppy: true });
    if (!move) return;

    this._advance();
  }

  _shake() {
    const boardEl = this.engine.boardEl;
    boardEl.classList.remove("cp-shake");
    void boardEl.offsetWidth;
    boardEl.classList.add("cp-shake");
  }

  /* Render the board position, last-move arrow, board annotations, and
     glyph badge for the move at absolute index `idx`, mirroring how
     VideoEngine.goTo() renders a normal move. Kept synchronous (besides
     the badge, same as goTo()) so a same-tick resume via _finish() never
     races a stale arrow paint. */
  _renderPly(idx) {
    const engine = this.engine;
    engine.board.position(engine.state.cache[idx + 1], true);
    engine._drawLastMoveArrow(idx);
    engine.renderAnnotations(idx);
    if (engine.moveList) {
      engine.moveList.reveal(idx);
      engine.moveList.highlight(idx);
    }
    requestAnimationFrame(() => {
      if (engine.goodMove) {
        const lastMove = engine.state.history[idx];
        engine.goodMove.render(idx, engine.state.glyphs, engine.state.moves, lastMove);
      }
    });
  }

  _advance() {
    const absoluteIdx = this.startIndex + 1 + this.solvedCount;
    this.solvedCount++;
    this._renderPly(absoluteIdx);

    if (this.solvedCount >= this.plies) {
      this._finish();
      return;
    }

    /* Auto-play the opponent's forced reply, then wait for the next
       solver move — mirrors autoReply() in puzzle.js. */
    setTimeout(() => {
      if (!this.active) return; // torn down (nav away) while waiting
      const replyIdx = this.startIndex + 1 + this.solvedCount;
      this.chess.move(this.engine.state.moves[replyIdx], { sloppy: true });
      this.solvedCount++;
      this._renderPly(replyIdx);
      if (this.solvedCount >= this.plies) this._finish();
    }, 300);
  }

  _finish() {
    const engine = this.engine;
    const startIndex = this.startIndex;
    const plies = this.plies;

    this.solvedIndices.add(startIndex);
    this._deactivate();

    /* Auto-resume: play() advances state.index by 1 itself, so pre-set it
       to the position we're already showing (right after the last solved
       ply) and let the normal play loop take over from there. */
    engine.state.index = startIndex + plies;
    engine.play();
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
      icon.style.setProperty("--icon", lucideIconUrl("message-square"));

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
        icon.style.setProperty("--icon", lucideIconUrl("search"));

        const content = document.createElement("div");
        content.className = "variation-content";

        const varFENs = [];
        const varVerbose = []; // from/to for each variation move
        const tempChess = new Chess();
        if (branchFEN) tempChess.load(branchFEN);
        varFENs.push(tempChess.fen());

        variation.moves.forEach(m => {
          /* sloppy:true matches the parser so variation replays accept
             the same notation the parser already accepted. */
          const result = tempChess.move(m, { sloppy: true });
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

          const varGlyph = nagsToGlyph(variation.nagsByMove[mi]) || "";

          const moveSpan = document.createElement("span");
          moveSpan.className   = "var-move";
          moveSpan.textContent = toFigurine(san) + varGlyph;

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
      const iconSpan = document.createElement("span");
      iconSpan.className = "lucide-icon";
      if (isGameOver) {
        iconSpan.style.setProperty("--icon", lucideIconUrl("rotate-ccw"));
        iconSpan.setAttribute("aria-label", "Replay");
        btn.onclick = () => {
          this.el.querySelectorAll(".var-move").forEach(s => s.classList.remove("active"));
          this.engine.goTo(0);
          this.engine.showPlayBtn();
        };
      } else {
        iconSpan.style.setProperty("--icon", lucideIconUrl("play"));
        iconSpan.setAttribute("aria-label", "Play");
        btn.onclick = () => {
          this.el.querySelectorAll(".var-move").forEach(s => s.classList.remove("active"));
          this.engine.play();
        };
      }
      btn.appendChild(iconSpan);
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

    /* All listeners and observers attached during this engine's lifetime
       go through this controller so destroy() can tear them down in one
       call when the host element is disconnected. */
    this._abort        = new AbortController();
    this._abortSignal  = this._abort.signal;
    this._observers    = [];

    this.chess = new Chess();
    this.puzzle = new PuzzleMode(this);
    this._puzzleActive = false;

    this.boardWrap = container.querySelector(".board-wrap");
    this.boardEl   = container.querySelector(".board");
    this.playBtn   = this.boardWrap ? this.boardWrap.querySelector(".play") : null;
    this.hintBtn   = this.boardWrap ? this.boardWrap.querySelector(".puzzle-hint-btn") : null;

    /* ---- Activate on any interaction ---- */
    const wrapper = container.parentElement;
    const activate = () => this._activate();
    const signal = this._abortSignal;
    wrapper.addEventListener("click",      activate, { signal });
    wrapper.addEventListener("mouseenter", activate, { signal });
    wrapper.addEventListener("touchstart", activate, { passive: true, signal });

    this.board = Chessboard(this.boardEl, {
      position:   "start",
      pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
      moveSpeed:  200,
      draggable:  true,
      onDragStart: (source, piece) => this.puzzle.canDrag(piece),
      onDrop:      (from, to) => this.puzzle.handleDrop(from, to),
      onSnapEnd:   () => {
        if (this.puzzle.active) this.board.position(this.puzzle.chess.fen(), false);
      }
    });

    /* Keep eval-bar height in sync with the (responsive) board height */
    const evalBarEl = container.querySelector(".eval-bar");
    const syncEvalHeight = () => {
      if (evalBarEl) evalBarEl.style.height = this.boardEl.offsetHeight + "px";
    };
    syncEvalHeight();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(syncEvalHeight);
      ro.observe(this.boardEl);
      this._observers.push(ro);
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
      glyphs:      [],
      puzzles:     [],
      startFEN:        null,
      startColor:      "w",
      startMoveNumber: 1,
      orientation:     null
    };

    this._loopLastTick = null;
    this._variation    = null; // active variation nav state

    /* ---- Board click (toggle play/pause) ---- */
    this.boardEl.addEventListener("click", () => {
      if (this._puzzleActive) return;
      this.togglePlay(true);
    }, { signal });

    /* ---- Play button ---- */
    if (this.playBtn) {
      this.playBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.play();
      }, { signal });
    }

    /* ---- Puzzle hint button (under the board, puzzle mode only) ---- */
    if (this.hintBtn) {
      this.hintBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (this.puzzle.active) this.puzzle.showHint();
      }, { signal });
    }

    /* ---- Space bar (only for active player when visible) ---- */
    document.addEventListener("keydown", (e) => {
      if (VideoEngine.activeEngine !== this) return;
      if (isTypingTarget(e.target)) return;
      if (e.code === "Space") {
        /* Only consume spacebar if this player is visible in the viewport.
           If not visible, allow default behavior (page scroll). */
        const rect = container.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        if (isVisible) {
          e.preventDefault();
          this.togglePlay(true);
        }
      }
    }, { signal });

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
      }, { signal });

      settingsPanel.addEventListener("click", (e) => e.stopPropagation(), { signal });

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
                  const lastMove = moveIdx >= 0 ? this.state.history?.[moveIdx] : null;
                  this.goodMove.render(moveIdx, this.state.glyphs, this.state.moves, lastMove);
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
        }, { signal });
      });
    }
  }

  /* Tear down every listener and observer registered during the engine's
     lifetime. Called from the host element's disconnectedCallback so a
     dynamically-added/removed <pgn-player> doesn't leak document keydown
     handlers or hold a detached board element via ResizeObserver. */
  destroy() {
    if (this._abort) {
      try { this._abort.abort(); } catch (_) { /* ignore */ }
      this._abort = null;
      this._abortSignal = null;
    }
    if (this._observers) {
      this._observers.forEach(o => { try { o.disconnect(); } catch (_) {} });
      this._observers = [];
    }
    this.state.playing = false;
    if (VideoEngine.activeEngine === this) {
      VideoEngine.activeEngine = null;
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
    this.state.puzzles     = data.puzzles     || [];
    this.state.startFEN        = data.startFEN        || null;
    this.state.startColor      = data.startColor      || "w";
    this.state.startMoveNumber = data.startMoveNumber || 1;
    this.state.orientation     = data.orientation      || null;

    if (this.evalBar) this.evalBar.setDisabled(!data.hasEvals);

    if (this.state.orientation) this._setOrientation(this.state.orientation);

    this.buildCache();

    this.goTo(0);
    /* goTo(0) may have activated a puzzle covering the game's opening
       move (a [P] marker before the very first move) — don't stomp on
       PuzzleMode's hidePlayBtn() in that case. */
    if (!this._puzzleActive) this.showPlayBtn();

    if (this.title)    this.title.build(this.state.headers);
    if (this.moveList) this.moveList.build(this.state.moves, this.state.glyphs, this.state.headers);
  }



  buildCache() {

    if (this.state.startFEN) {
      this.chess.load(this.state.startFEN);
    } else {
      this.chess.reset();
    }
    this.state.cache    = [];
    this.state.history  = []; // verbose move records, parallel to moves[]
    this.state.cache[0] = this.chess.fen();

    this.state.moves.forEach((m, i) => {
      /* sloppy:true keeps replays in lock-step with the loadPGN parser,
         which also runs sloppy — strict mode would reject moves that
         the parser accepted (e.g. long-algebraic e2-e4). */
      const result = this.chess.move(m, { sloppy: true });
      this.state.cache[i + 1] = this.chess.fen();
      /* Stash {from,to,san,color} once so _drawLastMoveArrow and the
         flip/keyboard/click navigation paths don't have to replay the
         whole game on every move. */
      this.state.history[i] = result
        ? { from: result.from, to: result.to, san: result.san, color: result.color }
        : null;
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

    /* Look up the move's from/to from state.history (populated once in
       buildCache) instead of replaying the game from move 0 on every
       navigation — that was O(n) per arrow keystroke. */
    const lastMove = this.state.history?.[moveIndex];
    if (!lastMove) return;

    const svg = createGridOverlaySVG(this.boardEl, "last-move-overlay");
    if (!svg) return;
    svg.style.zIndex = "14";

    _drawLastMoveArrowSVG(svg, svg.parentNode, lastMove.from, lastMove.to);
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



  _moveContext(moveIndex) {
    /* Mirrors the offset math in VideoMoveList.build()/reveal() — a
       Black-to-move starting FEN shifts the White/Black parity and the
       move-number base. */
    const offset = this.state.startColor === "b" ? 1 : 0;
    const virtualIndex = moveIndex + offset;
    return {
      fullMoveNum: (this.state.startMoveNumber || 1) + Math.floor(virtualIndex / 2),
      isBlack:     virtualIndex % 2 === 1
    };
  }



  goTo(i) {

    /* Solving the puzzle is the only way to advance past it — block every
       navigation path (spacebar, play button, arrow keys, double-tap skip,
       move-list clicks) while it's active and unsolved. PuzzleMode's own
       solving flow never calls goTo() while still active (it drives
       board.position() directly and only calls play()/goTo() from
       _finish(), after deactivating), so this can't block a real solve. */
    if (this.puzzle && this.puzzle.active) return;

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

    if (this.moveList) {
      this.moveList.revealThrough(moveIdx);
      this.moveList.highlight(moveIdx);
    }

    /* Last-move arrow */
    this._drawLastMoveArrow(moveIdx);

    if (this.commentBox) {
      const branchFEN = this.state.cache[Math.max(moveIdx, 0)] || null;
      const ctx       = moveIdx >= 0
        ? this._moveContext(moveIdx)
        : { fullMoveNum: this.state.startMoveNumber || 1, isBlack: this.state.startColor === "b" };
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

    if (this.puzzle) this.puzzle.handleArrival(moveIdx);

    if (this.goodMove) {
      requestAnimationFrame(() => {
        const lastMove = moveIdx >= 0 ? this.state.history?.[moveIdx] : null;
        this.goodMove.render(moveIdx, this.state.glyphs, this.state.moves, lastMove);
      });
    }

    this.renderAnnotations(moveIdx);
  }



  play() {

    /* Same reasoning as the goTo() guard: don't let play() spin up the
       autoplay loop while an unsolved puzzle is active — otherwise
       _loopRAF() would keep ticking state.index forward every second with
       goTo() silently no-oping each time, wasting cycles and leaving
       state.playing out of sync with what's actually on the board. */
    if (this.puzzle && this.puzzle.active) return;

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

  /* Set board orientation directly (no-op if already set) — used to apply
     the PGN "Orientation" header at load time, as opposed to the flip
     button's toggle. Keeps the eval bar's rotation in sync, same as the
     flip button does. */
  _setOrientation(color) {
    if (this.board.orientation() === color) return;
    this.board.orientation(color);
    if (this.evalBar && this.evalBar.bar) {
      this.evalBar.bar.style.transform = color === "black" ? "rotate(180deg)" : "";
    }
  }

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

  constructor() {
    super();
    this._markReady = createReadyGate(this);
  }

  connectedCallback() {

    /* Capture any inline PGN text BEFORE we inject the player DOM,
       otherwise the wrapper's own text (button labels etc.) would be
       mixed into textContent. */
    const inlineText = this.textContent.trim();
    this.innerHTML = "";

    /* ── Build internal DOM ── */

    const wrapper = document.createElement("div");
    wrapper.className = "player-wrapper";

    /* The lucide-icon spans carry a data-lucide attribute so we can set
       their --icon CSS custom property after insertion — keeps the icon
       data URIs (~7 KB) out of every rendered HTML string. */
    wrapper.innerHTML = `
      <div class="video-title"></div>

      <div class="player-container">
        <div class="board-toolbar">
          <button class="settings-toggle" aria-label="Settings">
            <span class="lucide-icon" data-lucide="settings"></span>
          </button>
          <div class="settings-panel hidden">
            <button class="settings-btn" data-action="download" title="Download PGN" aria-label="Download PGN">
              <span class="lucide-icon" data-lucide="download"></span>
            </button>
            <button class="settings-btn" data-action="flip" title="Flip board" aria-label="Flip board">
              <span class="lucide-icon" data-lucide="arrow-up-down"></span>
            </button>
            <button class="settings-btn" data-action="speed" title="Playback speed" aria-label="Playback speed">
              <span class="lucide-icon" data-lucide="gauge"></span>
              <span class="speed-label">1x</span>
            </button>
          </div>
        </div>

        <div class="board-wrap">
          <div class="board"></div>
          <div class="play" aria-label="Play">
            <span class="lucide-icon" data-lucide="play"></span>
          </div>
          <div class="puzzle-hint-row">
            <button class="puzzle-hint-btn" aria-label="Show solution move" title="Show solution move">
              <span class="lucide-icon" data-lucide="key"></span>
            </button>
          </div>
        </div>

        <div class="eval-bar">
          <div class="eval-fill"></div>
        </div>
      </div>

      <div class="video-moves"></div>
      <div class="video-comment"></div>
    `;

    wrapper.querySelectorAll(".lucide-icon[data-lucide]").forEach((el) => {
      el.style.setProperty("--icon", lucideIconUrl(el.dataset.lucide));
    });

    this.appendChild(wrapper);

    /* ── Initialise engine ── */

    /* Defer so CSS is computed before chessboard.js reads offsetWidth.
       Without this, synchronous (IIFE) bundles initialise the board
       before styles are applied, causing incorrect board sizing. */
    requestAnimationFrame(() => {

    const container = wrapper.querySelector(".player-container");
    const engine    = new VideoEngine(container);
    this._engine = engine;

    /* Pause when scrolled fully out of view */
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting && VideoEngine.activeEngine === engine && engine.state.playing) {
          engine.pause();
        }
      }, { threshold: 0 });
      io.observe(this);
      engine._observers.push(io);
    }

    const showError = (msg) => {
      console.error("PGN load error:", msg);
      const titleEl = wrapper.querySelector(".video-title");
      if (titleEl) {
        titleEl.textContent = `⚠️ Could not load game: ${msg}`;
      }
      this._markReady.fail(new Error(msg));
    };

    const renderFromText = (pgnText) => {
      const data = loadPGN(pgnText);
      if (!data.moves || data.moves.length === 0) {
        throw new Error("No moves found in PGN");
      }
      engine.load(data, pgnText);
      this._markReady({ engine });
    };

    const pgnSrc = this.getAttribute("src");

    if (pgnSrc) {
      const fetchUrl = normalizeLichessUrl(pgnSrc);
      const FETCH_TIMEOUT_MS = 20000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      fetch(fetchUrl, { signal: controller.signal })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(renderFromText)
        .catch(err => {
          // fetch() throws TypeError on network/CORS failures — the message
          // ("Failed to fetch") is unhelpful on its own, so add context.
          // An aborted fetch (our own timeout) throws a DOMException named
          // AbortError instead.
          const msg = (err && err.name === "AbortError")
            ? `timed out after ${FETCH_TIMEOUT_MS}ms fetching ${fetchUrl}`
            : (err && err.name === "TypeError")
              ? `network or CORS error fetching ${fetchUrl}`
              : err.message;
          showError(msg);
        })
        .finally(() => clearTimeout(timer));
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

  disconnectedCallback() {
    if (this._engine && typeof this._engine.destroy === "function") {
      this._engine.destroy();
    }
    this._engine = null;
    /* Reset the ready gate so a reconnected element (rebuilding a fresh
       engine in the next connectedCallback) gets a fresh isReady()/ready
       instead of one already resolved from a previous, now-destroyed
       engine. */
    this._markReady = createReadyGate(this);
  }
}

customElements.define("pgn-player", PgnPlayerElement);
