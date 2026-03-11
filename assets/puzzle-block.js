/**
 * JekyllChess — Puzzle Block Renderer
 */

import { parseGame } from "./puzzle-helpers.js";
import { renderLocalPuzzle } from "./puzzle-engine.js";

/* ================================================================
   PUZZLE-BLOCK HELPERS
================================================================ */

function splitIntoPgnBlocks(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n(?=\[)/)
    .filter(Boolean);
}

function stripPgnHeaders(pgn) {
  return pgn.replace(/(?:\[[^\]]+\]\s*)+/g, "").trim();
}

function extractPgnHeaders(pgn) {
  var headers = {};
  var regex = /\[(\w+)\s+"([^"]*)"\]/g;
  var match;
  while ((match = regex.exec(pgn))) {
    headers[match[1]] = match[2];
  }
  return headers;
}

function extractAllComments(pgn) {
  var body = stripPgnHeaders(pgn);
  var matches = body.match(/\{([\s\S]*?)\}/g) || [];
  return matches.map(function (c) {
    return c.replace(/^\{|\}$/g, "").trim();
  });
}

function resolveSource(node) {
  var attrSrc = node.getAttribute("src");
  if (attrSrc) {
    return { type: "url", value: new URL(attrSrc, location.href).href };
  }

  var text = (node.textContent || "").trim();
  var match = text.match(/PGN:\s*["']?([^"'\s]+)["']?/i);
  if (match) {
    return { type: "url", value: new URL(match[1], location.href).href };
  }

  if (text.startsWith("[")) {
    return { type: "inline", value: text };
  }

  return null;
}

/* ================================================================
   JCPUZZLE ADAPTER
================================================================ */

function jcPuzzleCreate(el, cfg) {
  var raw = cfg.rawPGN || "";
  var parsed = parseGame(raw);
  if (parsed.error) return;

  renderLocalPuzzle(
    el,
    parsed.fen,
    parsed.moves,
    parsed.firstMoveAuto === true,
    false,
    null,
    null,
    parsed.orientation,
  );
}

/* ================================================================
   PUZZLE-BLOCK RENDERER
================================================================ */

export function renderPuzzleBlock(node) {
  if (node.dataset.jcRendered === "1") return;
  node.dataset.jcRendered = "1";

  var source = resolveSource(node);
  if (!source) {
    node.textContent = "No PGN source found.";
    return;
  }

  node.textContent = "Loading puzzles…";

  function processText(text) {
    var games = splitIntoPgnBlocks(text);
    node.innerHTML = "";

    games.forEach(function (g) {
      var headers = extractPgnHeaders(g);
      var allComments = extractAllComments(g);

      var wrap = document.createElement("div");
      wrap.className = "jc-puzzle-item";
      node.appendChild(wrap);

      /* META HEADER */
      var metaDiv = document.createElement("div");
      metaDiv.className = "jc-puzzle-meta";

      var white = headers.White || "";
      var black = headers.Black || "";
      var line1 =
        white && black ? white + " - " + black : white || black || "Puzzle";
      var line2 = headers.Event || headers.Variant || "";

      metaDiv.innerHTML =
        '<div class="jc-puzzle-meta-emoji">🧩</div>' +
        '<div class="jc-puzzle-meta-text">' +
        '<div class="jc-puzzle-meta-line1">' +
        line1 +
        "</div>" +
        '<div class="jc-puzzle-meta-line2">' +
        line2 +
        "</div>" +
        "</div>";
      wrap.appendChild(metaDiv);

      /* BOARD */
      var boardDiv = document.createElement("div");
      boardDiv.className = "jc-board";
      wrap.appendChild(boardDiv);

      /* MOVE COMMENT */
      var moveCommentDiv = document.createElement("div");
      moveCommentDiv.className = "jc-puzzle-move-comment";
      wrap.appendChild(moveCommentDiv);

      function renderText(target, text) {
        target.textContent = text || "";
      }

      jcPuzzleCreate(boardDiv, { rawPGN: g });
      renderText(moveCommentDiv, allComments[0]);

      wrap.addEventListener("jc-puzzle-move", function (e) {
        var moveIndex = e.detail.index;
        if (moveIndex < allComments.length) {
          renderText(moveCommentDiv, allComments[moveIndex]);
        }
      });

      wrap.addEventListener("jc-puzzle-reset", function () {
        renderText(moveCommentDiv, allComments[0]);
      });
    });
  }

  if (source.type === "url") {
    fetch(source.value, { cache: "no-store" })
      .then(function (r) {
        return r.text();
      })
      .then(processText)
      .catch(function (err) {
        node.textContent = "Failed to load puzzle file: " + err.message;
      });
  }

  if (source.type === "inline") {
    processText(source.value);
  }
}

/* Re-export jcPuzzleCreate for use by puzzle element initializer */
export { jcPuzzleCreate };