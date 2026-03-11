/**
 * JekyllChess — Shared constants, utilities, and helpers
 *
 * Merged from: config.js, figurine.js, puzzle-helpers.js
 */

/* ================================================================
   CONSTANTS
================================================================ */

export var PIECE_THEME =
  "/images/Chess.jpg";

export var NBSP = "\u00A0";

/* ================================================================
   FETCH HELPER
================================================================ */

/**
 * Fetch a text resource with cache-busting.
 * Returns a Promise<string>.
 */
export function fetchText(url) {
  return fetch(url, { cache: "no-store" }).then(function (r) {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.text();
  });
}

/* ================================================================
   FIGURINE NOTATION
================================================================ */

var FIGURINES = {
  K: "♔",
  Q: "♕",
  R: "♖",
  B: "♗",
  N: "♘",
};

export function toFigurine(san) {
  if (!san) return san;
  var result = san;
  var firstChar = san.charAt(0);
  if (FIGURINES[firstChar]) {
    result = FIGURINES[firstChar] + san.slice(1);
  }
  result = result.replace(/=([KQRBN])/g, function (_, piece) {
    return "=" + FIGURINES[piece];
  });
  return result;
}

export function stripFigurines(s) {
  return String(s || "").replace(/[♔♕♖♗♘♙♚♛♜♝♞♟]/g, "");
}

/* ================================================================
   TEXT / SAN NORMALIZATION
================================================================ */

export function normalizePuzzleText(s) {
  return String(s || "")
    .replace(/\r/g, "")
    .replace(/\n+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*:\s*/g, ": ")
    .trim();
}

export function normalizeSAN(s) {
  return String(s || "")
    .replace(/[+#?!]/g, "")
    .replace(/0-0-0/g, "O-O-O")
    .replace(/0-0/g, "O-O")
    .trim();
}

/* ================================================================
   PGN GAME SPLITTING
================================================================ */

/**
 * Split a multi-game PGN string into individual game strings.
 * Shared by puzzle-block, puzzle-rush, and any future multi-game consumer.
 */
export function splitIntoPgnGames(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n(?=\s*\[)/)
    .filter(Boolean);
}

/* ================================================================
   MOVE TOKENIZER
================================================================ */

export function tokenizeMoves(text) {
  var s = String(text || "");
  s = s.replace(/\{[\s\S]*?\}/g, " ");
  s = s.replace(/;[^\n]*/g, " ");
  while (/\([^()]*\)/.test(s)) {
    s = s.replace(/\([^()]*\)/g, " ");
  }
  s = s.replace(/\$\d+/g, " ");
  s = s.replace(/\d+\.(\.\.)?/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  return s
    .split(" ")
    .map(function (t) { return t.trim(); })
    .filter(function (t) { return t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t); });
}

/* ================================================================
   PUZZLE GAME PARSER
================================================================ */

var DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function parseGame(pgn) {
  var raw = String(pgn || "").replace(/\r/g, "").trim();
  if (!raw) return { error: true };

  function getHeader(name) {
    var m = raw.match(new RegExp("\\[" + name + '\\s+"([^"]+)"\\]', "i"));
    return m ? m[1] : null;
  }

  var fen = getHeader("FEN");
  var firstMoveAuto = String(getHeader("FirstMoveAuto")).toLowerCase() === "true";
  var orientationHeader = String(getHeader("Orientation")).toLowerCase();

  var orientation = null;
  if (orientationHeader === "white") orientation = "white";
  if (orientationHeader === "black") orientation = "black";

  /* Colon format */
  if (!fen) {
    var collapsed = raw.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    var fenMatch = collapsed.match(/FEN:\s*(.*?)\s+Moves:/i);
    var movesMatch = collapsed.match(/Moves:\s*(.*)$/i);

    if (fenMatch && movesMatch) {
      var moves = tokenizeMoves(movesMatch[1]);
      if (!moves.length) return { error: true };
      return { fen: fenMatch[1].trim(), moves: moves, firstMoveAuto: false, orientation: null };
    }
  }

  /* Header style */
  var lines = raw.split("\n");
  var moveText = lines
    .filter(function (line) { return !/^\s*\[[^\]]+\]\s*$/.test(line); })
    .join(" ")
    .trim();
  var moves2 = tokenizeMoves(moveText);

  if (!moves2.length) return { error: true };
  if (!fen) fen = DEFAULT_FEN;

  return { fen: fen, moves: moves2, firstMoveAuto: firstMoveAuto, orientation: orientation };
}