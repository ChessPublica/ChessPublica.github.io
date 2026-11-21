/* ChessPublica — PGN Tool
 * Lichess-study-style PGN editor + Markdown editor.
 * Dependencies (from ../dist/ChessPublica.all.min.js): jQuery, Chess (chess.js 0.12), Chessboard.
 */
(function () {
  "use strict";

  /* ================================================================
     PGN MODEL
  ================================================================ */
  var START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  var nextId = 1;
  var byId = new Map();
  var STR = ["Event", "Site", "Date", "Round", "White", "Black", "Result"];
  var STR_DEFAULT = { Event: "?", Site: "?", Date: "????.??.??", Round: "?", White: "?", Black: "?", Result: "*" };

  function makeNode(parent, san, fen, from, to) {
    var n = { id: nextId++, parent: parent, san: san, fen: fen, from: from || null, to: to || null,
              nags: [], comment: "", pre: "", children: [] };
    byId.set(n.id, n);
    return n;
  }
  function makeChapter(fen, headers) {
    var h = headers || {};
    fen = fen || START_FEN;
    var root = makeNode(null, null, fen);
    return { h: h, root: root, sel: root };
  }
  function freshChapter() {
    return makeChapter(START_FEN, { Event: "", Site: "", Date: "", Round: "", White: "", Black: "", Result: "*" });
  }

  var NAG_SYMBOL = { 1: "!", 2: "?", 3: "!!", 4: "??", 5: "!?", 6: "?!", 10: "=", 13: "∞", 14: "⩲", 15: "⩱", 16: "±", 17: "∓", 18: "+−", 19: "−+" };
  var SUFFIX_NAG = { "!": 1, "?": 2, "!!": 3, "??": 4, "!?": 5, "?!": 6 };
  var MOVE_NAGS = [1, 2, 3, 4, 5, 6];
  var EVAL_NAGS = [10, 13, 14, 15, 16, 17, 18, 19];

  /* ---------- Parsing ---------- */

  function splitGames(text) {
    text = String(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    var lines = text.split("\n"), games = [], cur = null, inBrace = false;
    var tagRe = /^\s*\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]\s*$/;
    lines.forEach(function (line) {
      var m = !inBrace && tagRe.exec(line);
      if (m) {
        if (!cur || cur.body.trim()) { cur = { tags: [], body: "" }; games.push(cur); }
        cur.tags.push([m[1], m[2].replace(/\\(["\\])/g, "$1")]);
        return;
      }
      if (!cur) { if (!line.trim()) return; cur = { tags: [], body: "" }; games.push(cur); }
      cur.body += line + "\n";
      /* track { } comment bounds so "[...]" inside a comment is not mistaken for a tag */
      for (var i = 0; i < line.length; i++) {
        if (!inBrace && line[i] === "{") inBrace = true;
        else if (inBrace && line[i] === "}") inBrace = false;
        else if (!inBrace && line[i] === ";") break;
      }
    });
    return games;
  }

  function tokenize(s) {
    var toks = [], i = 0, n = s.length;
    while (i < n) {
      var c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === "{") { var j = s.indexOf("}", i); if (j < 0) j = n; toks.push({ t: "c", v: s.slice(i + 1, j).replace(/[ \t]*\n[ \t]*/g, "\n").trim() }); i = j + 1; continue; }
      if (c === ";") { var e = s.indexOf("\n", i); if (e < 0) e = n; toks.push({ t: "c", v: s.slice(i + 1, e).trim() }); i = e; continue; }
      if (c === "%" && (i === 0 || s[i - 1] === "\n")) { var e2 = s.indexOf("\n", i); i = e2 < 0 ? n : e2; continue; }
      if (c === "(") { toks.push({ t: "(" }); i++; continue; }
      if (c === ")") { toks.push({ t: ")" }); i++; continue; }
      if (c === "$") { var k = i + 1; while (k < n && /\d/.test(s[k])) k++; toks.push({ t: "n", v: parseInt(s.slice(i + 1, k), 10) }); i = k; continue; }
      var k2 = i; while (k2 < n && !/[\s{}();$]/.test(s[k2])) k2++;
      var w = s.slice(i, k2); i = k2;
      if (/^(1-0|0-1|1\/2-1\/2|½-½|\*)$/.test(w)) { toks.push({ t: "r", v: w === "½-½" ? "1/2-1/2" : w }); continue; }
      w = w.replace(/^\d+\s*(\.{1,3}|…)?/, "");
      w = w.replace(/^(\.{1,3}|…)+/, "");
      if (!w) continue;
      var sm = /([!?]{1,2})$/.exec(w);
      if (sm && SUFFIX_NAG[sm[1]]) { w = w.slice(0, -sm[1].length); toks.push({ t: "m", v: w }); toks.push({ t: "n", v: SUFFIX_NAG[sm[1]] }); continue; }
      toks.push({ t: "m", v: w });
    }
    return toks;
  }

  function parseGame(g) {
    var headers = {}; g.tags.forEach(function (t) { headers[t[0]] = t[1]; });
    var fen = START_FEN;
    if (headers.FEN) {
      var test = new Chess();
      if (test.load(headers.FEN)) fen = test.fen();
    }
    var ch = makeChapter(fen, headers);
    var chess = new Chess();
    var toks = tokenize(g.body);
    var bad = [], cur = ch.root, stack = [], dead = false, deadLevel = 0, skip = 0, pendingPre = "", warnings = 0, prevOpen = false;
    toks.forEach(function (tk) {
      var wasOpen = prevOpen; prevOpen = false;
      if (tk.t === "(") {
        if (skip || dead || !cur.parent) { skip++; return; }
        stack.push(cur); cur = cur.parent; prevOpen = true; return;
      }
      if (tk.t === ")") {
        if (skip) { skip--; return; }
        if (stack.length) cur = stack.pop();
        dead = false; return;
      }
      if (skip || dead) return;
      if (tk.t === "r") { if (!stack.length) { if (!headers.Result || headers.Result === "*") headers.Result = tk.v; } return; }
      if (tk.t === "n") { if (cur.parent && cur.nags.indexOf(tk.v) < 0) cur.nags.push(tk.v); return; }
      if (tk.t === "c") {
        if (wasOpen || (cur.parent && !cur.children.length && false)) { pendingPre += (pendingPre ? "\n\n" : "") + tk.v; }
        else cur.comment += (cur.comment ? "\n\n" : "") + tk.v;
        return;
      }
      if (tk.t === "m") {
        var san = tk.v.replace(/0-0-0/g, "O-O-O").replace(/0-0/g, "O-O");
        if (/^(--|Z0|null)$/.test(san)) { warnings++; dead = true; return; }
        chess.load(cur.fen);
        var mv = chess.move(san, { sloppy: true });
        if (!mv) { warnings++; bad.push(san); dead = true; return; }
        var ex = null;
        for (var i = 0; i < cur.children.length; i++) if (cur.children[i].san === mv.san) ex = cur.children[i];
        if (ex) { cur = ex; }
        else { var nn = makeNode(cur, mv.san, chess.fen(), mv.from, mv.to); cur.children.push(nn); cur = nn; }
        if (pendingPre) { cur.pre = pendingPre; pendingPre = ""; }
      }
    });
    ch.warnings = warnings; ch.bad = bad;
    return ch;
  }

  function parsePgn(text) {
    var res = splitGames(text).map(parseGame);
    return res;
  }

  /* ---------- Yazma ---------- */

  function esc(c) { return String(c).replace(/\}/g, ")").replace(/\{/g, "("); }

  function moveTokens(n, force, out) {
    var parts = n.parent.fen.split(" ");
    var white = parts[1] === "w", num = parts[5] || "1";
    if (n.pre) out.push("{" + esc(n.pre) + "}");
    if (white) out.push(num + ".");
    else if (force) out.push(num + "...");
    out.push(n.san);
    n.nags.forEach(function (g) { out.push("$" + g); });
    if (n.comment) out.push("{" + esc(n.comment) + "}");
  }
  function lineTokens(n, force, out) {
    while (n) {
      moveTokens(n, force, out);
      force = !!(n.comment);
      var p = n.parent;
      if (p.children[0] === n && p.children.length > 1) {
        for (var i = 1; i < p.children.length; i++) {
          out.push("("); lineTokens(p.children[i], true, out); out.push(")");
        }
        force = true;
      }
      n = n.children[0];
    }
  }
  function wrapTokens(toks, width) {
    var lines = [], line = "";
    toks.forEach(function (t) {
      var hasNl = t.indexOf("\n") >= 0;
      if (line && (line.length + 1 + t.length > width || hasNl)) { lines.push(line); line = ""; }
      line += (line ? " " : "") + t;
      if (hasNl) { lines.push(line); line = ""; }
    });
    if (line) lines.push(line);
    return lines.join("\n");
  }
  function chapterPgn(ch) {
    var h = ch.h, out = [];
    function tag(k, v) { out.push("[" + k + ' "' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"]'); }
    STR.forEach(function (k) { tag(k, h[k] ? h[k] : STR_DEFAULT[k]); });
    Object.keys(h).forEach(function (k) {
      if (STR.indexOf(k) >= 0 || k === "FEN" || k === "SetUp" || h[k] === "" || h[k] == null) return;
      tag(k, h[k]);
    });
    if (ch.root.fen !== START_FEN) { tag("SetUp", "1"); tag("FEN", ch.root.fen); }
    var toks = [];
    if (ch.root.comment) toks.push("{" + esc(ch.root.comment) + "}");
    if (ch.root.children[0]) lineTokens(ch.root.children[0], false, toks);
    toks.push(h.Result || "*");
    return out.join("\n") + "\n\n" + wrapTokens(toks, 88) + "\n";
  }

  /* ================================================================
     DURUM
  ================================================================ */
  var study = { name: "", chapters: [freshChapter()], cur: 0 };
  var dirty = false;
  var board = null, chess = new Chess(), orientation = "white";
  var LS_KEY = "chesspublica-pgn-tool-v1";

  function chap() { return study.chapters[study.cur]; }
  function sel() { return chap().sel; }
  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, text) { var e = document.createElement(tag); if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); if (text != null) e.textContent = text; return e; }

  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function chapterTitle(ch, i) {
    var h = ch.h;
    if (h.ChapterName) return h.ChapterName;
    if (h.White || h.Black) return (h.White || "?") + " – " + (h.Black || "?");
    if (h.Event) return h.Event;
    return "Chapter " + (i + 1);
  }
  function allPgn() { return study.chapters.map(chapterPgn).join("\n"); }

  var saveTimer;
  function changed() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 500);
  }
  function persist() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ name: study.name, pgn: allPgn(), cur: study.cur, md: $("md-text").value }));
    } catch (e) { /* storage may be unavailable */ }
  }
  function restore() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d.pgn && d.pgn.trim()) {
        var chs = parsePgn(d.pgn);
        if (chs.length) { study.chapters = chs; study.cur = Math.min(d.cur || 0, chs.length - 1); }
      }
      study.name = d.name || "";
      if (d.md) $("md-text").value = d.md;
    } catch (e) { /* yoksay */ }
  }

  /* ================================================================
     TAHTA
  ================================================================ */
  function initBoard() {
    board = Chessboard("board", {
      draggable: true,
      position: "start",
      orientation: orientation,
      pieceTheme: "https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png",
      onDragStart: function (source, piece) {
        chess.load(sel().fen);
        if (chess.game_over()) return false;
        return (chess.turn() === "w") === (piece[0] === "w");
      },
      onDrop: onDrop,
    });
    window.addEventListener("resize", function () { board.resize(); });
  }

  function onDrop(source, target, piece) {
    if (source === target || target === "offboard") return;
    chess.load(sel().fen);
    var moves = chess.moves({ verbose: true }).filter(function (m) { return m.from === source && m.to === target; });
    if (!moves.length) return "snapback";
    if (moves[0].promotion) {
      showPromo(source, target, piece[0]);
      return "snapback";
    }
    playMove({ from: source, to: target });
  }

  function playMove(m) {
    chess.load(sel().fen);
    var mv = chess.move(m);
    if (!mv) { render(); return; }
    var parent = sel(), ex = null;
    parent.children.forEach(function (c) { if (c.san === mv.san) ex = c; });
    if (ex) { goTo(ex); return; }
    var nn = makeNode(parent, mv.san, chess.fen(), mv.from, mv.to);
    parent.children.push(nn);
    changed();
    goTo(nn);
  }

  function showPromo(from, to, color) {
    var box = $("promo"); box.innerHTML = "";
    var syms = { w: { q: "♕", r: "♖", b: "♗", n: "♘" }, b: { q: "♛", r: "♜", b: "♝", n: "♞" } }[color];
    ["q", "r", "b", "n"].forEach(function (p) {
      var b = el("button", { type: "button", title: p }, syms[p]);
      b.onclick = function () { box.hidden = true; playMove({ from: from, to: to, promotion: p }); };
      box.appendChild(b);
    });
    var cancel = el("button", { type: "button" }, "✕"); cancel.onclick = function () { box.hidden = true; render(); };
    box.appendChild(cancel);
    box.hidden = false;
  }

  function goTo(n) { chap().sel = n; render(); }

  function updateBoard() {
    var n = sel();
    board.position(n.fen.split(" ")[0], false);
    var wrap = $("board");
    wrap.querySelectorAll(".hl").forEach(function (s) { s.classList.remove("hl"); });
    if (n.from) {
      [n.from, n.to].forEach(function (sq) { var s = wrap.querySelector(".square-" + sq); if (s) s.classList.add("hl"); });
    }
    $("fen-view").value = n.fen;
  }

  /* ================================================================
     RENDER
  ================================================================ */
  function render() {
    renderChapters();
    updateBoard();
    renderTree();
    renderAnnot();
    renderHeaders();
    if (!$("pane-pgn").hidden) renderPgnPane();
    $("study-name").value = study.name;
  }

  function renderChapters() {
    var ol = $("chapter-list"); ol.innerHTML = "";
    study.chapters.forEach(function (ch, i) {
      var li = el("li", { class: i === study.cur ? "active" : "" });
      li.appendChild(el("span", { class: "n" }, String(i + 1)));
      li.appendChild(el("span", null, chapterTitle(ch, i)));
      li.onclick = function () { study.cur = i; render(); };
      ol.appendChild(li);
    });
  }

  function nagStr(n) { return n.nags.map(function (g) { return NAG_SYMBOL[g] || ""; }).join(""); }

  function treeHtml(start, force) {
    var out = "", n = start, sn = sel();
    while (n) {
      var parts = n.parent.fen.split(" "), white = parts[1] === "w";
      if (n.pre) out += '<span class="cm" data-id="' + n.id + '">' + escHtml(n.pre) + "</span>";
      out += '<span class="mv' + (n === sn ? " cur" : "") + '" data-id="' + n.id + '">';
      if (white) out += '<span class="num">' + parts[5] + ".</span>";
      else if (force) out += '<span class="num">' + parts[5] + "…</span>";
      out += escHtml(n.san) + escHtml(nagStr(n)) + "</span> ";
      force = false;
      if (n.comment) { out += '<span class="cm" data-id="' + n.id + '">' + escHtml(n.comment.replace(/\[%[^\]]*\]\s*/g, "")) + "</span> "; force = true; }
      var p = n.parent;
      if (p.children[0] === n && p.children.length > 1) {
        for (var i = 1; i < p.children.length; i++) out += '<div class="var">' + treeHtml(p.children[i], true) + "</div>";
        force = true;
      }
      n = n.children[0];
    }
    return out;
  }
  function escHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  function renderTree() {
    var ch = chap(), t = $("tree"), keep = t.scrollTop, html = "";
    html += '<div class="intro' + (ch.sel === ch.root ? " cur" : "") + '" data-id="' + ch.root.id + '">' +
      (ch.root.comment ? escHtml(ch.root.comment) : "Start position — click to write a chapter introduction") + "</div>";
    html += treeHtml(ch.root.children[0], false);
    t.innerHTML = html;
    t.scrollTop = keep;
    var cur = t.querySelector(".mv.cur");
    if (cur) {
      var r = cur.getBoundingClientRect(), tr = t.getBoundingClientRect();
      if (r.top < tr.top || r.bottom > tr.bottom) cur.scrollIntoView({ block: "center" });
    }
  }

  function renderAnnot() {
    var n = sel(), isRoot = !n.parent;
    var box = $("nags"); box.innerHTML = "";
    function addBtn(g) {
      var b = el("button", { type: "button", title: "NAG $" + g }, NAG_SYMBOL[g]);
      if (n.nags.indexOf(g) >= 0) b.className = "on";
      b.disabled = isRoot;
      b.onclick = function () {
        var group = MOVE_NAGS.indexOf(g) >= 0 ? MOVE_NAGS : EVAL_NAGS;
        var had = n.nags.indexOf(g) >= 0;
        n.nags = n.nags.filter(function (x) { return group.indexOf(x) < 0; });
        if (!had) n.nags.push(g);
        changed(); renderTree(); renderAnnot();
      };
      box.appendChild(b);
    }
    MOVE_NAGS.forEach(addBtn); box.appendChild(el("span", { class: "gap" })); EVAL_NAGS.forEach(addBtn);
    var c = $("comment");
    if (document.activeElement !== c || c.dataset.nid !== String(n.id)) c.value = n.comment;
    c.dataset.nid = n.id;
    c.placeholder = isRoot ? "Chapter introduction…" : "Comment on this move… (**bold**, *italic* supported)";
    var isVar = !isRoot && n.parent.children[0] !== n;
    $("n-promote").disabled = !isVar;
    $("n-main").disabled = !isVar;
    $("n-del").disabled = isRoot;
  }

  var HDR_FIELDS = ["ChapterName", "Event", "Site", "Date", "Round", "White", "Black", "Result", "WhiteElo", "BlackElo", "ECO", "Annotator"];
  var HDR_LABEL = { ChapterName: "Chapter name", Event: "Event", Site: "Site", Date: "Date", Round: "Round", White: "White", Black: "Black", Result: "Result", WhiteElo: "White Elo", BlackElo: "Black Elo", ECO: "ECO", Annotator: "Annotator" };
  function renderHeaders() {
    var form = $("headers-form"), ch = chap();
    if (form.contains(document.activeElement) && form.dataset.ci === String(study.cur)) return;
    form.innerHTML = ""; form.dataset.ci = study.cur;
    var keys = HDR_FIELDS.slice();
    Object.keys(ch.h).forEach(function (k) { if (keys.indexOf(k) < 0 && k !== "FEN" && k !== "SetUp") keys.push(k); });
    keys.forEach(function (k) {
      var lab = el("label", { title: k }, HDR_LABEL[k] || k);
      var inp;
      if (k === "Result") {
        inp = el("select"); ["*", "1-0", "0-1", "1/2-1/2"].forEach(function (v) { var o = el("option", { value: v }, v); inp.appendChild(o); });
        inp.value = ch.h.Result || "*";
        inp.style.cssText = "font:inherit;padding:.4rem;border-radius:6px;border:1px solid var(--line);background:var(--panel);color:inherit";
      } else { inp = el("input"); inp.value = ch.h[k] || ""; }
      inp.oninput = inp.onchange = function () {
        ch.h[k] = inp.value; changed();
        renderChapters();
      };
      form.appendChild(lab); form.appendChild(inp);
      var extra = el("span");
      if (HDR_FIELDS.indexOf(k) < 0) {
        var x = el("button", { type: "button", title: "Remove tag" }, "✕");
        x.onclick = function () { delete ch.h[k]; changed(); form.dataset.ci = ""; form.innerHTML = ""; renderHeaders(); };
        extra.appendChild(x);
      }
      form.appendChild(extra);
    });
  }

  function renderPgnPane() {
    var scope = document.querySelector('input[name="pgn-scope"]:checked').value;
    var ta = $("pgn-text");
    if (document.activeElement === ta) return;
    ta.value = scope === "study" ? allPgn() : chapterPgn(chap());
    $("pgn-msg").textContent = "";
  }

  /* ================================================================
     CHAPTER OPERATIONS
  ================================================================ */
  function addChapters(chs, select) {
    if (!chs.length) { toast("No valid games found."); return; }
    if (study.chapters.length === 1 && isPristine(study.chapters[0])) study.chapters = [];
    var first = study.chapters.length;
    chs.forEach(function (c) { study.chapters.push(c); });
    if (select !== false) study.cur = first;
    changed(); render();
    var w = chs.reduce(function (a, c) { return a + (c.warnings || 0); }, 0);
    toast(chs.length + " chapter(s) added" + (w ? " — " + w + " illegal move(s) skipped (" + chs[0].bad.slice(0, 3).join(", ") + ")" : ""));
  }
  function isPristine(ch) { return !ch.root.children.length && !ch.root.comment && !Object.keys(ch.h).some(function (k) { return ch.h[k] && k !== "Result"; }); }

  $("ch-add").onclick = function () { addChapters([freshChapter()]); };
  $("ch-fen").onclick = function () {
    var f = prompt("Enter a FEN:", START_FEN);
    if (!f) return;
    var t = new Chess();
    if (!t.load(f.trim())) { toast("Invalid FEN."); return; }
    study.chapters.push(makeChapter(t.fen(), { Event: "", White: "", Black: "", Result: "*" }));
    study.cur = study.chapters.length - 1; changed(); render();
  };
  $("fen-new").onclick = function () {
    var ch = makeChapter(sel().fen, { Event: "", White: "", Black: "", Result: "*" });
    study.chapters.push(ch); study.cur = study.chapters.length - 1; changed(); render();
  };
  $("ch-dup").onclick = function () {
    var c = parsePgn(chapterPgn(chap()))[0];
    study.chapters.splice(study.cur + 1, 0, c); study.cur++; changed(); render();
  };
  $("ch-del").onclick = function () {
    if (!confirm("Delete this chapter?")) return;
    study.chapters.splice(study.cur, 1);
    if (!study.chapters.length) study.chapters.push(freshChapter());
    study.cur = Math.min(study.cur, study.chapters.length - 1); changed(); render();
  };
  function moveChapter(d) {
    var i = study.cur, j = i + d;
    if (j < 0 || j >= study.chapters.length) return;
    var t = study.chapters[i]; study.chapters[i] = study.chapters[j]; study.chapters[j] = t;
    study.cur = j; changed(); render();
  }
  $("ch-up").onclick = function () { moveChapter(-1); };
  $("ch-down").onclick = function () { moveChapter(1); };
  $("ch-paste").onclick = function () {
    openDialog("Paste PGN (multiple games = multiple chapters)", "", "Add", function (txt) { addChapters(parsePgn(txt)); });
  };
  $("study-name").oninput = function (e) { study.name = e.target.value; changed(); };

  /* ---------- Diyalog ---------- */
  function openDialog(title, text, okLabel, cb) {
    var d = $("dlg");
    $("dlg-title").textContent = title; $("dlg-text").value = text; $("dlg-ok").textContent = okLabel;
    d.onclose = function () { if (d.returnValue === "ok") cb($("dlg-text").value); };
    d.returnValue = ""; d.showModal(); $("dlg-text").focus();
  }

  /* ================================================================
     MOVE TREE / BOARD CONTROLS
  ================================================================ */
  $("tree").addEventListener("click", function (e) {
    var t = e.target.closest("[data-id]");
    if (t) { var n = byId.get(+t.dataset.id); if (n) goTo(n); }
  });

  function stepBack() { var n = sel(); if (n.parent) goTo(n.parent); }
  function stepFwd() { var n = sel(); if (n.children[0]) goTo(n.children[0]); }
  function toStart() { goTo(chap().root); }
  function toEnd() { var n = sel(); while (n.children[0]) n = n.children[0]; goTo(n); }
  function flip() { orientation = orientation === "white" ? "black" : "white"; board.orientation(orientation); updateBoard(); }
  $("nav-prev").onclick = stepBack; $("nav-next").onclick = stepFwd;
  $("nav-start").onclick = toStart; $("nav-end").onclick = toEnd; $("nav-flip").onclick = flip;
  $("fen-copy").onclick = function () { copyText($("fen-view").value); };

  document.addEventListener("keydown", function (e) {
    if ($("view-editor").hidden) return;
    var tg = e.target.tagName;
    if (tg === "INPUT" || tg === "TEXTAREA" || tg === "SELECT" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowLeft") { stepBack(); e.preventDefault(); }
    else if (e.key === "ArrowRight") { stepFwd(); e.preventDefault(); }
    else if (e.key === "Home") { toStart(); e.preventDefault(); }
    else if (e.key === "End") { toEnd(); e.preventDefault(); }
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      var n = sel(), p = n.parent;
      if (p && p.children.length > 1) {
        var i = p.children.indexOf(n) + (e.key === "ArrowDown" ? 1 : -1);
        if (i >= 0 && i < p.children.length) goTo(p.children[i]);
      }
      e.preventDefault();
    }
    else if (e.key === "f" || e.key === "F") flip();
  });

  $("comment").addEventListener("input", function (e) {
    sel().comment = e.target.value; changed(); renderTree();
    if (!sel().parent) renderChapters();
  });
  $("n-del").onclick = function () {
    var n = sel(); if (!n.parent) return;
    if (n.children.length && !confirm("Delete this move and everything after it?")) return;
    var p = n.parent; p.children.splice(p.children.indexOf(n), 1);
    changed(); goTo(p);
  };
  $("n-promote").onclick = function () {
    var n = sel(), c = n.parent.children, i = c.indexOf(n);
    if (i > 0) { c.splice(i, 1); c.splice(i - 1, 0, n); changed(); render(); }
  };
  $("n-main").onclick = function () {
    var n = sel(), c = n.parent.children, i = c.indexOf(n);
    if (i > 0) { c.splice(i, 1); c.unshift(n); changed(); render(); }
  };

  /* ---------- Alt sekmeler ---------- */
  document.querySelectorAll(".subtab").forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll(".subtab").forEach(function (x) { x.classList.toggle("active", x === b); });
      ["moves", "headers", "pgn"].forEach(function (p) { $("pane-" + p).hidden = p !== b.dataset.pane; });
      if (b.dataset.pane === "pgn") renderPgnPane();
      if (b.dataset.pane === "headers") { $("headers-form").dataset.ci = ""; renderHeaders(); }
    };
  });
  $("hdr-add").onclick = function () {
    var k = $("hdr-new-name").value.trim().replace(/[^A-Za-z0-9_]/g, "");
    if (!k) return;
    if (!(k in chap().h)) chap().h[k] = " ";
    chap().h[k] = chap().h[k] || " "; changed(); $("hdr-new-name").value = ""; $("headers-form").dataset.ci = ""; renderHeaders();
  };
  document.querySelectorAll('input[name="pgn-scope"]').forEach(function (r) { r.onchange = renderPgnPane; });
  $("pgn-copy").onclick = function () { copyText($("pgn-text").value); };
  $("pgn-apply").onclick = function () {
    var scope = document.querySelector('input[name="pgn-scope"]:checked').value;
    var chs = parsePgn($("pgn-text").value);
    if (!chs.length) { $("pgn-msg").textContent = "No valid games found — nothing applied."; return; }
    var w = chs.reduce(function (a, c) { return a + (c.warnings || 0); }, 0);
    if (scope === "study") { study.chapters = chs; study.cur = Math.min(study.cur, chs.length - 1); }
    else { study.chapters.splice.apply(study.chapters, [study.cur, 1].concat(chs)); }
    changed(); $("pgn-text").blur(); render();
    $("pgn-msg").textContent = "Applied" + (w ? " — " + w + " illegal move(s) skipped." : ".");
  };

  function copyText(t) {
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { toast("Copied"); }, fallback);
    else fallback();
    function fallback() { var ta = el("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); toast("Copied"); } catch (e) { } ta.remove(); }
  }

  /* ================================================================
     OPEN / SAVE FILES
  ================================================================ */
  function download(name, text, type) {
    var a = el("a"); a.href = URL.createObjectURL(new Blob([text], { type: type + ";charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function slug(s) { return (s || "").toLowerCase().replace(/[^a-z0-9ğüşıöç]+/gi, "-").replace(/^-+|-+$/g, "") || ""; }
  function studyFileBase() { return slug(study.name) || slug(chapterTitle(study.chapters[0], 0)) || "study"; }

  $("btn-save-pgn").onclick = function () { download(studyFileBase() + ".pgn", allPgn(), "application/x-chess-pgn"); dirty = false; };
  $("btn-save-md").onclick = function () { saveMd(); };
  $("btn-open").onclick = function () { $("file-input").click(); };
  $("md-open").onclick = function () { $("file-input").click(); };
  $("file-input").onchange = function (e) { openFiles(e.target.files); e.target.value = ""; };

  function openFiles(files) {
    Array.prototype.forEach.call(files, function (f) {
      var r = new FileReader();
      r.onload = function () {
        var txt = String(r.result), isMd = /\.(md|markdown)$/i.test(f.name);
        if (isMd) { $("md-text").value = txt; showView("markdown"); renderPreview(); changed(); toast(f.name + " opened"); }
        else {
          var chs = parsePgn(txt);
          if (!chs.length) { toast(f.name + ": no valid PGN found."); return; }
          var replace = isPristine(study.chapters[0]) && study.chapters.length === 1;
          if (!replace) replace = confirm("Open \"" + f.name + "\" in place of the current study?\n\nOK = replace the study\nCancel = add as chapter(s)");
          if (replace) { study.chapters = chs; study.cur = 0; study.name = f.name.replace(/\.[^.]+$/, ""); dirty = false; changed(); render(); toast(f.name + " opened — " + chs.length + " chapter(s)"); }
          else addChapters(chs);
          showView("editor");
        }
      };
      r.readAsText(f);
    });
  }
  var dragDepth = 0;
  window.addEventListener("dragenter", function (e) { if (e.dataTransfer && e.dataTransfer.types.indexOf("Files") >= 0) { dragDepth++; $("dropzone").hidden = false; } });
  window.addEventListener("dragleave", function () { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $("dropzone").hidden = true; });
  window.addEventListener("dragover", function (e) { e.preventDefault(); });
  window.addEventListener("drop", function (e) { e.preventDefault(); dragDepth = 0; $("dropzone").hidden = true; if (e.dataTransfer.files.length) openFiles(e.dataTransfer.files); });
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  /* ================================================================
     MARKDOWN
  ================================================================ */
  function showView(v) {
    $("view-editor").hidden = v !== "editor"; $("view-markdown").hidden = v !== "markdown";
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.view === v); });
    if (v === "markdown") renderPreview(); else if (board) board.resize();
  }
  document.querySelectorAll(".tab").forEach(function (t) { t.onclick = function () { showView(t.dataset.view); }; });

  function saveMd() {
    var txt = $("md-text").value;
    if (!txt.trim()) { txt = studyToMarkdown(); $("md-text").value = txt; renderPreview(); }
    var m = /^#\s+(.+)$/m.exec(txt);
    download((slug(m && m[1]) || studyFileBase()) + ".md", txt, "text/markdown");
  }
  $("md-save").onclick = saveMd;

  function studyToMarkdown() {
    var out = [];
    if (study.name || study.chapters.length > 1) out.push("# " + (study.name || chapterTitle(study.chapters[0], 0)) + "\n");
    study.chapters.forEach(function (ch, i) {
      out.push("## " + chapterTitle(ch, i) + "\n");
      var meta = [];
      if (ch.h.Event) meta.push(ch.h.Event);
      if (ch.h.Site && ch.h.Site !== "?") meta.push(ch.h.Site);
      if (ch.h.Date && ch.h.Date !== "????.??.??") meta.push(ch.h.Date);
      if (ch.h.White || ch.h.Black) meta.unshift((ch.h.White || "?") + " – " + (ch.h.Black || "?"));
      if (meta.length) out.push("*" + meta.join(" · ") + "*\n");
      if (ch.root.comment) out.push(ch.root.comment + "\n");
      out.push("```pgn\n" + chapterPgn(ch).trim() + "\n```\n");
    });
    return out.join("\n");
  }
  $("md-from-study").onclick = function () {
    if ($("md-text").value.trim() && !confirm("Replace the current Markdown content?")) return;
    $("md-text").value = studyToMarkdown(); renderPreview(); changed();
  };

  function insertAtCursor(before, after, placeholder) {
    var ta = $("md-text"), s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    var mid = v.slice(s, e) || placeholder || "";
    ta.value = v.slice(0, s) + before + mid + (after || "") + v.slice(e);
    ta.focus(); ta.selectionStart = s + before.length; ta.selectionEnd = s + before.length + mid.length;
    renderPreview(); changed();
  }
  function insertBlock(txt) {
    var ta = $("md-text"), s = ta.selectionStart, v = ta.value;
    var pre = s > 0 && v[s - 1] !== "\n" ? "\n\n" : (s > 0 && v[s - 2] !== "\n" ? "\n" : "");
    ta.value = v.slice(0, s) + pre + txt + "\n\n" + v.slice(ta.selectionEnd);
    ta.focus(); renderPreview(); changed();
  }
  document.querySelectorAll("[data-md]").forEach(function (b) {
    b.onclick = function () {
      switch (b.dataset.md) {
        case "h2": insertAtCursor("## ", "", "Heading"); break;
        case "bold": insertAtCursor("**", "**", "bold"); break;
        case "italic": insertAtCursor("*", "*", "italic"); break;
        case "link": insertAtCursor("[", "](https://)", "link"); break;
        case "list": insertAtCursor("- ", "", "item"); break;
        case "quote": insertAtCursor("> ", "", "quote"); break;
        case "fen": insertBlock("```fen\n" + sel().fen + "\n```"); break;
        case "pgn": insertBlock("```pgn\n" + chapterPgn(chap()).trim() + "\n```"); break;
      }
    };
  });

  function inline(s) {
    s = escHtml(s);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, a, u) { return /^(https?:|\/|\.)/i.test(u) ? '<img alt="' + a + '" src="' + u + '">' : m; });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) { return /^(https?:|mailto:|\/|#|\.)/i.test(u) ? '<a href="' + u + '" target="_blank" rel="noopener">' + t + "</a>" : m; });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    return s;
  }
  function mdToHtml(src) {
    var lines = src.replace(/\r\n?/g, "\n").split("\n"), out = [], i = 0, para = [], list = null;
    function flushPara() { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } }
    function flushList() { if (list) { out.push("</" + list + ">"); list = null; } }
    while (i < lines.length) {
      var l = lines[i], m;
      if ((m = /^```\s*(\w*)\s*$/.exec(l))) {
        flushPara(); flushList();
        var buf = []; i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
        i++;
        var code = buf.join("\n"), lang = m[1].toLowerCase();
        if (lang === "pgn") out.push("<pgn>" + escHtml(code) + "</pgn>");
        else if (lang === "fen") out.push("<fen>" + escHtml(code.trim()) + "</fen>");
        else out.push("<pre><code>" + escHtml(code) + "</code></pre>");
        continue;
      }
      if (!l.trim()) { flushPara(); flushList(); i++; continue; }
      if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { flushPara(); flushList(); out.push("<h" + m[1].length + ">" + inline(m[2]) + "</h" + m[1].length + ">"); i++; continue; }
      if (/^(-{3,}|\*{3,})\s*$/.test(l)) { flushPara(); flushList(); out.push("<hr>"); i++; continue; }
      if ((m = /^>\s?(.*)$/.exec(l))) { flushPara(); flushList(); out.push("<blockquote>" + inline(m[1]) + "</blockquote>"); i++; continue; }
      if ((m = /^\s*([-*+]|\d+\.)\s+(.*)$/.exec(l))) {
        flushPara();
        var tag = /\d/.test(m[1]) ? "ol" : "ul";
        if (list !== tag) { flushList(); out.push("<" + tag + ">"); list = tag; }
        out.push("<li>" + inline(m[2]) + "</li>"); i++; continue;
      }
      flushList(); para.push(l.trim()); i++;
    }
    flushPara(); flushList();
    return out.join("\n");
  }

  var previewTimer;
  function renderPreview() {
    clearTimeout(previewTimer);
    var box = $("md-preview");
    box.innerHTML = mdToHtml($("md-text").value);
    try { if (window.ChessPublica && ChessPublica.initAll) ChessPublica.initAll(); } catch (e) { console.error(e); }
  }
  $("md-text").addEventListener("input", function () {
    clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, 450); changed();
  });

  $("md-html").onclick = function () {
    var body = mdToHtml($("md-text").value), t = (/^#\s+(.+)$/m.exec($("md-text").value) || [])[1] || study.name || "ChessPublica";
    var html = '<!DOCTYPE html>\n<html lang="tr">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + escHtml(t) +
      '</title>\n<link rel="stylesheet" href="https://chesspublica.github.io/dist/ChessPublica.all.min.css">\n<style>body{max-width:760px;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif;line-height:1.6}img{max-width:100%}</style>\n</head>\n<body>\n' +
      body + '\n<script src="https://chesspublica.github.io/dist/ChessPublica.all.min.js"></' + 'script>\n</body>\n</html>\n';
    download((slug(t) || "page") + ".html", html, "text/html");
  };

  /* ================================================================
     START
  ================================================================ */
  restore();
  initBoard();
  render();
  if ($("md-text").value.trim()) renderPreview();
  dirty = false;
  window.__pgnTool = { parsePgn: parsePgn, chapterPgn: chapterPgn, study: study };
})();
