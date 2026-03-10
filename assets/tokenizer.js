/* PGN Parser: Tokenizer */

  function parsePGN(pgnText) {
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
