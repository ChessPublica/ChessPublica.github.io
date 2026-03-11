/**
 * JekyllChess — PGN Parser (Tokenizer + Move Tree Builder)
 */

/* ================================================================
   PGN TOKENIZER
================================================================ */

export function parsePGN(pgnText) {
  var movetext = extractMovetext(pgnText);
  return tokenize(movetext);
}

function tokenize(text) {
  var tokens = [];
  var i = 0;

  while (i < text.length) {
    /* COMMENT */
    if (text[i] === "{") {
      var depth = 1;
      var j = i + 1;
      while (depth > 0 && j < text.length) {
        if (text[j] === "{") depth++;
        if (text[j] === "}") depth--;
        j++;
      }
      tokens.push({
        type: "comment",
        value: text.slice(i + 1, j - 1).trim(),
      });
      i = j;
      continue;
    }

    /* VARIATION */
    if (text[i] === "(") {
      var depth2 = 1;
      var j2 = i + 1;
      while (depth2 > 0 && j2 < text.length) {
        if (text[j2] === "(") depth2++;
        if (text[j2] === ")") depth2--;
        j2++;
      }
      tokens.push({
        type: "variation",
        value: tokenize(text.slice(i + 1, j2 - 1)),
      });
      i = j2;
      continue;
    }

    var nagMatch = text.slice(i).match(/^\$\d+/);
    if (nagMatch) {
      tokens.push({ type: "nag", value: nagMatch[0] });
      i += nagMatch[0].length;
      continue;
    }

    /* RESULT — must be checked BEFORE move number, because "1-0" starts with "1" */
    var resultMatch = text.slice(i).match(/^(1-0|0-1|1\/2-1\/2|\*)/);
    if (resultMatch) {
      tokens.push({ type: "result", value: resultMatch[0] });
      i += resultMatch[0].length;
      continue;
    }

    var moveNumberMatch = text.slice(i).match(/^\d+(\.\.\.?)?\.?/);
    if (moveNumberMatch) {
      tokens.push({ type: "moveNumber", value: moveNumberMatch[0] });
      i += moveNumberMatch[0].length;
      continue;
    }

    var moveMatch = text
      .slice(i)
      .match(
        /^(?:O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|[a-h][1-8])[\+#]?/,
      );
    if (moveMatch) {
      tokens.push({ type: "move", value: moveMatch[0] });
      i += moveMatch[0].length;
      continue;
    }

    i++;
  }

  return tokens;
}

function extractMovetext(pgnText) {
  return pgnText.split(/\n\n/).slice(1).join(" ").trim();
}

/* ================================================================
   MOVE TREE BUILDER
================================================================ */

export function buildMoveTree(pgnText) {
  var tokens = parsePGN(pgnText);
  var chess = new Chess();
  var root = { next: null, fen: chess.fen() };
  parseSequence(tokens, chess, root, pgnText);
  return root.next;
}

function getMoveNumber(fen) {
  var parts = fen.split(" ");
  return parseInt(parts[5], 10) || 1;
}

function parseSequence(tokens, chess, parentNode, originalPgn) {
  var current = parentNode;
  var lastMoveNode = null;
  var i = 0;

  while (i < tokens.length) {
    var token = tokens[i];

    if (token.type === "moveNumber" || token.type === "result") {
      i++;
      continue;
    }

    /* MOVE */
    if (token.type === "move") {
      var move = chess.move(token.value, { sloppy: true });
      if (!move) {
        var currentFen = chess.fen();
        var currentMoveNum = getMoveNumber(currentFen);
        var error = new Error(
          "Invalid move: " + token.value + "\nMove number: " + currentMoveNum,
        );
        error.pgnIndex = findTokenIndex(originalPgn, token.value);
        throw error;
      }

      var fen = chess.fen();
      var fenMoveNum = getMoveNumber(fen);
      var moveNumber = move.color === "w" ? fenMoveNum : fenMoveNum - 1;

      var node = {
        san: token.value,
        fen: chess.fen(),
        moveNumber: moveNumber,
        color: move.color,
        next: null,
        parent: null,
        variations: [],
        comment: null,
        nags: [],
        arrows: [],
        squareMarks: [],
      };

      node.parent = current;
      current.next = node;
      current = node;
      lastMoveNode = node;
      i++;
      continue;
    }

    /* NAG */
    if (token.type === "nag") {
      if (lastMoveNode) {
        lastMoveNode.nags.push(token.value);
      }
      i++;
      continue;
    }

    /* COMMENT */
    if (token.type === "comment") {
      var commentText = token.value;
      var inlineMoveText = "";

      var variationMatch = commentText.match(/\(([^()]+)\)/);
      if (variationMatch) {
        var variationText = variationMatch[1].trim();
        var hasDiagram = variationText.includes("[D]");

        inlineMoveText = variationText
          .replace(/\{[^}]*\}/g, "")
          .replace(/\[%.*?\]/g, "")
          .replace(/\[D\]/g, "")
          .trim();

        try {
          var fakePGN =
            '[Event "?"]\n\n1. ' + variationText.replace(/\[D\]/g, "");
          var variationTokens = parsePGN(fakePGN);

          if (hasDiagram) {
            variationTokens.push({ type: "comment", value: "[D]" });
          }

          var branchFen = determineBranchFen(
            variationTokens,
            current,
            parentNode,
          );
          var snapshot = new Chess(branchFen);
          var variationRoot = { next: null, fen: branchFen };

          parseSequence(
            variationTokens,
            snapshot,
            variationRoot,
            originalPgn,
          );

          if (current && variationRoot.next) {
            current.variations.push(variationRoot.next);
          }
        } catch (e) {
          // Silently skip invalid inline variations
        }
      }

      if (lastMoveNode) {
        var cslMatches = [];
        var cslRegex = /\[%csl\s+([^\]]+)\]/g;
        var cslM;
        while ((cslM = cslRegex.exec(commentText))) {
          cslMatches.push(cslM);
        }
        if (cslMatches.length) {
          lastMoveNode.squareMarks = [];
          cslMatches.forEach(function (m) {
            lastMoveNode.squareMarks = lastMoveNode.squareMarks.concat(
              parseCSL(m[1]),
            );
          });
        }

        var calMatches = [];
        var calRegex = /\[%cal\s+([^\]]+)\]/g;
        var calM;
        while ((calM = calRegex.exec(commentText))) {
          calMatches.push(calM);
        }
        if (calMatches.length) {
          lastMoveNode.arrows = [];
          calMatches.forEach(function (m) {
            lastMoveNode.arrows = lastMoveNode.arrows.concat(parseCAL(m[1]));
          });
        }

        var cleaned = commentText
          .replace(/\([^)]*\)/g, "")
          .replace(/\[%csl\s+[^\]]+\]/g, "")
          .replace(/\[%cal\s+[^\]]+\]/g, "")
          .replace(/\[%eval\s+[^\]]+\]/g, "")
          .replace(/\[%clk\s+[^\]]+\]/g, "")
          .replace(/\[%emt\s+[^\]]+\]/g, "")
          .replace(/\[%depth\s+[^\]]+\]/g, "")
          .replace(/\[%.*?\]/g, "")
          .trim();

        var finalComment = (cleaned + " " + inlineMoveText).trim();

        if (finalComment.length) {
          if (lastMoveNode.comment) {
            lastMoveNode.comment += " " + finalComment;
          } else {
            lastMoveNode.comment = finalComment;
          }
        }
      }

      i++;
      continue;
    }

    /* VARIATION */
    if (token.type === "variation") {
      var branchFen2 = determineBranchFen(token.value, current, parentNode);
      var snapshot2 = new Chess(branchFen2);
      var variationRoot2 = { next: null, fen: branchFen2 };

      parseSequence(token.value, snapshot2, variationRoot2, originalPgn);

      if (current && variationRoot2.next) {
        current.variations.push(variationRoot2.next);
      }

      i++;
      continue;
    }

    i++;
  }
}

/* ================= SMART BRANCH LOGIC ================= */

function determineBranchFen(variationTokens, current, parentNode) {
  if (!current) return parentNode.fen;

  var firstMoveNumberToken = null;
  for (var k = 0; k < variationTokens.length; k++) {
    if (variationTokens[k].type === "moveNumber") {
      firstMoveNumberToken = variationTokens[k];
      break;
    }
  }

  var variationColor;
  if (firstMoveNumberToken && firstMoveNumberToken.value.includes("...")) {
    variationColor = "b";
  } else if (firstMoveNumberToken) {
    variationColor = "w";
  } else {
    variationColor = current.color === "w" ? "b" : "w";
  }

  var nextToMove = current.color === "w" ? "b" : "w";

  if (variationColor === nextToMove) {
    return current.fen;
  } else {
    return current.parent && current.parent.fen
      ? current.parent.fen
      : parentNode.fen;
  }
}

/* ================= HELPERS ================= */

function parseCSL(data) {
  return data.split(",").map(function (entry) {
    return { color: entry[0], square: entry.slice(1) };
  });
}

function parseCAL(data) {
  return data.split(",").map(function (entry) {
    return {
      color: entry[0],
      from: entry.slice(1, 3),
      to: entry.slice(3, 5),
    };
  });
}

function findTokenIndex(pgnText, token) {
  return pgnText.indexOf(token);
}

/* ================================================================
   PGN HEADER PARSER
================================================================ */

export function parseHeaders(pgnText) {
  var headers = {};
  var regex = /\[(\w+)\s+"([^"]*)"\]/g;
  var match;
  while ((match = regex.exec(pgnText))) {
    headers[match[1]] = match[2];
  }
  return headers;
}