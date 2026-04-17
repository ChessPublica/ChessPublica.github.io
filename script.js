/* ChessPublica landing page — tab navigation + sandbox renderers. */

const $ = (id) => document.getElementById(id);
const val = (id) => ($(id) ? $(id).value.trim() : '');

/* ── Tab switching ────────────────────────────────────────── */

const renderedTabs = new Set();

function renderTabBoard(tabId) {
    switch (tabId) {
        case 'fen':    { const h = $('sandbox-fen-board');      if (h) updateFen(h); break; }
        case 'puzzle': { const h = $('sandbox-puzzle-container'); if (h) updatePuzzle(h); break; }
        case 'pgn':    { const h = $('sandbox-pgn-container');    if (h) updatePgn(h); break; }
        case 'player': { const h = $('sandbox-player-container'); if (h) updatePgnPlayer(h); break; }
    }
}

window.showTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.remove('hidden');

    document.querySelectorAll('.tab-trigger').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
    });

    if (!renderedTabs.has(tabId)) {
        renderedTabs.add(tabId);
        renderTabBoard(tabId);
    }
};

document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.tab-trigger');
    if (trigger && trigger.dataset.tab) {
        e.preventDefault();
        window.showTab(trigger.dataset.tab);
    }
});

/* ── PGN helpers ──────────────────────────────────────────── */

function header(name, value) {
    return value ? `[${name} "${value.replace(/"/g, '\\"')}"]\n` : '';
}

function buildHeaders(fields) {
    let out = '';
    for (const [name, value] of fields) {
        out += header(name, value);
    }
    return out;
}

function escapeAttr(value) {
    return (value || '').replace(/"/g, '&quot;');
}

/* ── Sandbox renderers ────────────────────────────────────── */

const BLANK_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function runInitAll() {
    if (window.JekyllChess && typeof window.JekyllChess.initAll === 'function') {
        window.JekyllChess.initAll();
    }
}

function renderBlankBoard(host) {
    if (!host) return;
    host.innerHTML = '';
    const el = document.createElement('fen');
    el.textContent = BLANK_FEN;
    host.appendChild(el);
    runInitAll();
}

function renderInline(host, tagName, content) {
    if (!host) return;
    const trimmed = (content || '').trim();
    if (!trimmed) {
        renderBlankBoard(host);
        return;
    }
    host.innerHTML = '';
    const el = document.createElement(tagName);
    el.textContent = trimmed;
    host.appendChild(el);
    runInitAll();
}

function renderFromSrc(host, tagName, src) {
    if (!host) return;
    host.innerHTML = '';
    const el = document.createElement(tagName);
    el.setAttribute('src', src);
    host.appendChild(el);
    runInitAll();
}

function renderPlayer(host, content) {
    if (!host) return;
    const trimmed = (content || '').trim();
    if (!trimmed) {
        renderBlankBoard(host);
        return;
    }
    host.innerHTML = '';
    const el = document.createElement('pgn-player');
    el.textContent = trimmed;
    host.appendChild(el);
}

function renderPlayerFromSrc(host, src) {
    if (!host) return;
    host.innerHTML = '';
    const el = document.createElement('pgn-player');
    el.setAttribute('src', src);
    host.appendChild(el);
}

/* ── Code block helpers ───────────────────────────────────── */

function indent(text, spaces) {
    const pad = ' '.repeat(spaces);
    return text
        .split('\n')
        .map(line => (line.length ? pad + line : line))
        .join('\n');
}

function wrapTag(tagName, body, { src } = {}) {
    if (src) {
        return `<${tagName} src="${escapeAttr(src)}"></${tagName}>`;
    }
    const trimmed = (body || '').replace(/\s+$/g, '');
    if (!trimmed) return `<${tagName}></${tagName}>`;
    return `<${tagName}>\n${indent(trimmed, 2)}\n</${tagName}>`;
}

function setCode(codeId, text) {
    const el = $(codeId);
    if (el) el.textContent = text;
}

function flashCopyFeedback(button) {
    if (!button) return;
    const original = button.dataset.originalLabel || button.textContent;
    button.dataset.originalLabel = original;
    button.textContent = 'Copied!';
    button.disabled = true;
    setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
    }, 1500);
}

async function copyToClipboard(text, button) {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'absolute';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        flashCopyFeedback(button);
    } catch (err) {
        console.error('Copy failed:', err);
    }
}

/* ── Tab-specific composers ───────────────────────────────── */

function composeFen() {
    const fen = val('sandbox-fen-fen');
    if (!fen) return '';
    let body = buildHeaders([
        ['FEN', fen],
        ['Orientation', val('sandbox-fen-orientation')],
        ['Caption', val('sandbox-fen-caption')],
    ]);
    const csl = val('sandbox-fen-csl');
    const cal = val('sandbox-fen-cal');
    const annots = [];
    if (csl) annots.push(`[%csl ${csl}]`);
    if (cal) annots.push(`[%cal ${cal}]`);
    if (annots.length) body += `\n{${annots.join(' ')}}`;
    return body;
}

function updateFen(host) {
    const body = composeFen();
    setCode('sandbox-fen-code', wrapTag('fen', body));
    if (!body) {
        renderBlankBoard(host);
        return;
    }
    renderInline(host, 'fen', body);
}

function composePuzzle() {
    const fen = val('sandbox-puzzle-fen');
    const moves = val('sandbox-puzzle-solution');
    if (!fen || !moves) return '';
    const firstMoveAuto = $('sandbox-puzzle-firstmoveauto');
    const headers = buildHeaders([
        ['FEN', fen],
        ['Orientation', val('sandbox-puzzle-orientation')],
        ['FirstMoveAuto', firstMoveAuto && firstMoveAuto.checked ? 'true' : ''],
        ['White', val('sandbox-puzzle-white')],
        ['Black', val('sandbox-puzzle-black')],
        ['Event', val('sandbox-puzzle-event')],
        ['Date', val('sandbox-puzzle-date')],
        ['Caption', val('sandbox-puzzle-caption')],
    ]);
    return `${headers}\n${moves}`;
}

function updatePuzzle(host) {
    const src = val('sandbox-puzzle-src');
    if (src) {
        setCode('sandbox-puzzle-code', wrapTag('puzzle', '', { src }));
        renderFromSrc(host, 'puzzle', src);
        return;
    }
    const body = composePuzzle();
    setCode('sandbox-puzzle-code', wrapTag('puzzle', body));
    if (!body) {
        renderBlankBoard(host);
        return;
    }
    renderInline(host, 'puzzle', body);
}

function composePgn() {
    const moves = val('sandbox-pgn-moves');
    if (!moves) return '';
    const headers = buildHeaders([
        ['White', val('sandbox-pgn-white')],
        ['Black', val('sandbox-pgn-black')],
        ['Event', val('sandbox-pgn-event')],
        ['Date', val('sandbox-pgn-date')],
        ['Result', val('sandbox-pgn-result')],
    ]);
    return headers ? `${headers}\n${moves}` : moves;
}

function updatePgn(host) {
    const src = val('sandbox-pgn-src');
    if (src) {
        setCode('sandbox-pgn-code', wrapTag('pgn', '', { src }));
        renderFromSrc(host, 'pgn', src);
        return;
    }
    const body = composePgn();
    setCode('sandbox-pgn-code', wrapTag('pgn', body));
    if (!body) {
        renderBlankBoard(host);
        return;
    }
    renderInline(host, 'pgn', body);
}

function composePlayer() {
    const moves = val('sandbox-player-moves');
    if (!moves) return '';
    const headers = buildHeaders([
        ['White', val('sandbox-player-white')],
        ['Black', val('sandbox-player-black')],
        ['Event', val('sandbox-player-event')],
        ['Date', val('sandbox-player-date')],
        ['Result', val('sandbox-player-result')],
    ]);
    return headers ? `${headers}\n${moves}` : moves;
}

function updatePgnPlayer(host) {
    const src = val('sandbox-player-src');
    if (src) {
        setCode('sandbox-player-code', wrapTag('pgn-player', '', { src }));
        renderPlayerFromSrc(host, src);
        return;
    }
    const body = composePlayer();
    setCode('sandbox-player-code', wrapTag('pgn-player', body));
    if (!body) {
        renderBlankBoard(host);
        return;
    }
    renderPlayer(host, body);
}

/* ── Defaults ─────────────────────────────────────────────── */

const NIMZOWITSCH_MOVES =
    '{ **_A pawn move must not in itself be regarded as a developing move, but merely as an aid to development._** } ' +
    '{ An important rule for the beginner is the following: if it were possible to develop the pieces without the aid of pawn moves, the pawnless advance would be the correct one, for, as suggested, the pawn is not a fighting unit in the sense that his crossing of the frontier is to be feared by the enemy, since obviously the attacking force of the pawns is smail compared with that of the pieces. The pawnless advance, however, is in reality impossible of execution, since the enemy pawn center, thanks to its inherent aggressiveness, would drive back the pieces we had developed. For this reason we should, in order to safeguard the development of our pieces, first build up a pawn center. By center we mean the four squares which enclose the midpoint - the squares e4, e5, d4, d5. } ' +
    '{ The wrecking of a pawnless advance is illustrated by the following: } ' +
    '1. Nf3 Nc6 2.e3 { Since the pawn has not been moved to the center, we may still regard the advance as pawnless in our sense. } ' +
    '2... e5 3. Nc3 Nf6 4. Bc4? d5 { Now the faultiness of White\'s development may be seen; the Black pawns have a demobilizing effect. } ' +
    '5. Bb3 { Bad at the outset, a piece moved twice. } ' +
    '5... d4 {[D]} { and White is uncomfortably placed, at any rate from the point of view of the player with little fighting experience. }';

const RETI_SOLUTION =
    '1. Re2! e4 ( 1. Re1? { 🚫 Wrong move<br>A seemingly sensible move, Re1? would be a sad mistake. Black maintains the opposition after } 1... e4 2. Ke7 Ke5 3. Kd7 Kd5 { and manages to draw. Try again. } ) ' +
    '2. Re1! Ke5 { Losing a move with 1. Re2! and 2. Re1! is the key! } ' +
    '3. Ke7 Kd4 {[%cal Ge7e6]} 4. Ke6 Kd3 {[%cal Ge6e5]} 5. Ke5 e3 {[%cal Ge5f4]} 6. Kf4 e2 {[%cal Gf4f3]} 7. Kf3 { Black will lose the pawn, and the game. }';

function setDefaults() {
    const defaults = {
        'sandbox-fen-fen': '7k/1p1b1Qp1/1r6/p1r2pq1/1b1Np2p/4P3/K1BNR1PP/3R4 b - - 3 35',
        'sandbox-fen-orientation': 'black',
        'sandbox-fen-caption': '**GM Praggnanandhaa R. - GM Sindarov, Javokhir** FIDE Candidates Tournament, 2026.',
        'sandbox-fen-csl': 'Ra2,Rf7',
        'sandbox-fen-cal': 'Gd7e6',

        'sandbox-puzzle-fen': '8/5K2/8/4pk2/4R3/8/8/8 w - - 0 1',
        'sandbox-puzzle-solution': RETI_SOLUTION,
        'sandbox-puzzle-orientation': 'white',
        'sandbox-puzzle-event': 'Study by Richard Réti, Münchner Neueste Nachrichten, 1928',
        'sandbox-puzzle-caption': 'White to move and win.',

        'sandbox-pgn-event': 'Nimzowitsch, A. (1994) My System. Original work published 1925-1927',
        'sandbox-pgn-moves': NIMZOWITSCH_MOVES,

        'sandbox-player-src': 'https://lichess.org/api/study/97di6JjX/Jzyakrf4.pgn',
    };
    for (const [id, v] of Object.entries(defaults)) {
        const el = $(id);
        if (el && !el.value) el.value = v;
    }
}

/* ── Init ─────────────────────────────────────────────────── */

function insertDiagramAtCaret(textarea) {
    const marker = '{[D]}';
    const pos = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? pos;
    const before = textarea.value.slice(0, pos);
    const after = textarea.value.slice(end);
    const pad = before && !/\s$/.test(before) ? ' ' : '';
    const insert = pad + marker + ' ';
    textarea.value = before + insert + after;
    const caret = pos + insert.length;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
}

function wireCopyButton(buttonId, codeId) {
    const btn = $(buttonId);
    const code = $(codeId);
    if (!btn || !code) return;
    btn.addEventListener('click', () => copyToClipboard(code.textContent || '', btn));
}

function initSandbox() {
    setDefaults();

    const fenBtn = $('update-fen-btn');
    if (fenBtn) fenBtn.addEventListener('click', () => updateFen($('sandbox-fen-board')));

    const puzzleBtn = $('update-puzzle-btn');
    if (puzzleBtn) puzzleBtn.addEventListener('click', () => updatePuzzle($('sandbox-puzzle-container')));

    const pgnBtn = $('update-pgn-btn');
    if (pgnBtn) pgnBtn.addEventListener('click', () => updatePgn($('sandbox-pgn-container')));

    const playerBtn = $('update-player-btn');
    if (playerBtn) playerBtn.addEventListener('click', () => updatePgnPlayer($('sandbox-player-container')));

    const insertDiagramBtn = $('insert-diagram-btn');
    const pgnMovesEl = $('sandbox-pgn-moves');
    if (insertDiagramBtn && pgnMovesEl) {
        insertDiagramBtn.addEventListener('click', () => insertDiagramAtCaret(pgnMovesEl));
    }

    wireCopyButton('copy-fen-btn', 'sandbox-fen-code');
    wireCopyButton('copy-puzzle-btn', 'sandbox-puzzle-code');
    wireCopyButton('copy-pgn-btn', 'sandbox-pgn-code');
    wireCopyButton('copy-player-btn', 'sandbox-player-code');

    /* Populate every code block immediately so the Copy Code button works
       even for tabs the user hasn't opened yet. Passing null for the host
       skips board rendering — hidden tabs would render at zero width. */
    updateFen(null);
    updatePuzzle(null);
    updatePgn(null);
    updatePgnPlayer(null);

    /* Render the initially visible (FEN) tab's board. */
    renderedTabs.add('fen');
    renderTabBoard('fen');
}

function init() {
    const yearEl = $('current-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
    initSandbox();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
