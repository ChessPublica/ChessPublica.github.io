 /* Mover Tree Builder */

  function buildMoveTree(pgnText) {
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
