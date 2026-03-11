/**
 * JekyllChess — Puzzle helper utilities
 */

export function stripFigurines(s) {
  return String(s || "").replace(/[♔♕♖♗♘♙♚♛♜♝♞♟]/g, "");
}

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

export function splitIntoPgnGames(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n(?=\s*\[)/)
    .filter(Boolean);
}

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
    .map(function (t) {
      return t.trim();
    })
    .filter(function (t) {
      return t && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t);
    });
}

export function parseGame(pgn) {
  var raw = String(pgn || "")
    .replace(/\r/g, "")
    .trim();
  if (!raw) return { error: true };

  function getHeader(name) {
    var m = raw.match(new RegExp("\\[" + name + '\\s+"([^"]+)"\\]', "i"));
    return m ? m[1] : null;
  }

  var fen = getHeader("FEN");
  var firstMoveAuto =
    String(getHeader("FirstMoveAuto")).toLowerCase() === "true";
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
      fen = fenMatch[1].trim();
      var moves = tokenizeMoves(movesMatch[1]);
      if (!moves.length) return { error: true };
      return {
        fen: fen,
        moves: moves,
        firstMoveAuto: false,
        orientation: null,
      };
    }
  }

  /* Header style */
  var lines = raw.split("\n");
  var moveLines = lines.filter(function (line) {
    return !/^\s*\[[^\]]+\]\s*$/.test(line);
  });
  var moveText = moveLines.join(" ").trim();
  var moves2 = tokenizeMoves(moveText);

  if (!moves2.length) return { error: true };
  if (!fen) fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  return {
    fen: fen,
    moves: moves2,
    firstMoveAuto: firstMoveAuto,
    orientation: orientation,
  };
}