/* ChessPublica landing page — tab navigation + sandbox renderers. */

const $ = (id) => document.getElementById(id);
const val = (id) => ($(id) ? $(id).value.trim() : '');

/* ── Tab switching ────────────────────────────────────────── */

window.showTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.remove('hidden');

    document.querySelectorAll('.tab-trigger').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
    });
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

/* ── Sandbox renderers ────────────────────────────────────── */

const BLANK_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function renderBlankBoard(host) {
    if (!host) return;
    host.innerHTML = '';
    const el = document.createElement('fen');
    el.textContent = BLANK_FEN;
    host.appendChild(el);
    if (window.JekyllChess && typeof window.JekyllChess.initAll === 'function') {
        window.JekyllChess.initAll();
    }
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
    if (window.JekyllChess && typeof window.JekyllChess.initAll === 'function') {
        window.JekyllChess.initAll();
    }
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

/* ── Tab-specific composers ───────────────────────────────── */

function updateFen(host) {
    const fen = val('sandbox-fen-fen');
    if (!fen) {
        renderBlankBoard(host);
        return;
    }
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
    renderInline(host, 'fen', body);
}

function updatePuzzle(host) {
    const fen = val('sandbox-puzzle-fen');
    const moves = val('sandbox-puzzle-solution');
    if (!fen || !moves) {
        renderBlankBoard(host);
        return;
    }
    const headers = buildHeaders([
        ['FEN', fen],
        ['White', val('sandbox-puzzle-white')],
        ['Black', val('sandbox-puzzle-black')],
        ['Event', val('sandbox-puzzle-event')],
        ['Date', val('sandbox-puzzle-date')],
        ['Caption', val('sandbox-puzzle-caption')],
    ]);
    renderInline(host, 'puzzle', `${headers}\n${moves}`);
}

/* ── Defaults ─────────────────────────────────────────────── */

function setDefaults() {
    const defaults = {
        'sandbox-fen-fen': 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
        'sandbox-fen-orientation': 'black',
        'sandbox-fen-caption': "**Sicilian Defense** — Black's most popular reply to 1.e4.",
        'sandbox-fen-csl': 'Gc5,Ge4',
        'sandbox-fen-cal': 'Gf3e5',

        'sandbox-puzzle-fen': 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
        'sandbox-puzzle-solution': 'a6',
        'sandbox-puzzle-caption': '**Black to move.** How should Black respond to the Ruy Lopez pin?',

        'sandbox-pgn-white': 'Morphy, Paul',
        'sandbox-pgn-black': 'Duke of Brunswick',
        'sandbox-pgn-event': 'Paris Opera Box',
        'sandbox-pgn-date': '1858',
        'sandbox-pgn-result': '1-0',
        'sandbox-pgn-moves':
            '1. e4 e5 2. Nf3 d6 3. d4 Bg4 {A pin that proves costly.} 4. dxe5 Bxf3 5. Qxf3 dxe5\n' +
            '6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7\n' +
            '12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8#',

        'sandbox-player-white': 'Carlsen, Magnus',
        'sandbox-player-black': 'Nepomniachtchi, Ian',
        'sandbox-player-event': 'World Championship',
        'sandbox-player-date': '2021',
        'sandbox-player-result': '1-0',
        'sandbox-player-moves':
            '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O\n' +
            '8. h3 Na5 9. Nxe5 Nxb3 10. axb3 Bb7 11. d3 d5 12. exd5 Qxd5 13. Qf3 Bd6\n' +
            '14. Kf1 Rfb8 15. Qxd5 Nxd5 16. Bd2 c5 17. Nf3 Rd8 18. Nc3 Nb4 19. Rec1 Rac8\n' +
            '20. Ne2 Nc6 21. Be3 Ne7 22. Bf4 Bxf4 23. Nxf4 Rxd3 24. Ra3 Rxa3 25. bxa3 g5',
    };
    for (const [id, v] of Object.entries(defaults)) {
        const el = $(id);
        if (el && !el.value) el.value = v;
    }
}

/* ── Init ─────────────────────────────────────────────────── */

function updatePgn(host) {
    const moves = val('sandbox-pgn-moves');
    if (!moves) {
        renderBlankBoard(host);
        return;
    }
    const headers = buildHeaders([
        ['White', val('sandbox-pgn-white')],
        ['Black', val('sandbox-pgn-black')],
        ['Event', val('sandbox-pgn-event')],
        ['Date', val('sandbox-pgn-date')],
        ['Result', val('sandbox-pgn-result')],
    ]);
    renderInline(host, 'pgn', headers ? `${headers}\n${moves}` : moves);
}

function updatePgnPlayer(host) {
    const moves = val('sandbox-player-moves');
    if (!moves) {
        renderBlankBoard(host);
        return;
    }
    const headers = buildHeaders([
        ['White', val('sandbox-player-white')],
        ['Black', val('sandbox-player-black')],
        ['Event', val('sandbox-player-event')],
        ['Date', val('sandbox-player-date')],
        ['Result', val('sandbox-player-result')],
    ]);
    renderPlayer(host, headers ? `${headers}\n${moves}` : moves);
}

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

function initSandbox() {
    setDefaults();

    const fenHost = $('sandbox-fen-board');
    const fenBtn = $('update-fen-btn');
    if (fenHost && fenBtn) {
        fenBtn.addEventListener('click', () => updateFen(fenHost));
        updateFen(fenHost);
    }

    const puzzleHost = $('sandbox-puzzle-container');
    const puzzleBtn = $('update-puzzle-btn');
    if (puzzleHost && puzzleBtn) {
        puzzleBtn.addEventListener('click', () => updatePuzzle(puzzleHost));
        updatePuzzle(puzzleHost);
    }

    const pgnHost = $('sandbox-pgn-container');
    const pgnBtn = $('update-pgn-btn');
    if (pgnHost && pgnBtn) {
        pgnBtn.addEventListener('click', () => updatePgn(pgnHost));
        updatePgn(pgnHost);
    }

    const insertDiagramBtn = $('insert-diagram-btn');
    const pgnMovesEl = $('sandbox-pgn-moves');
    if (insertDiagramBtn && pgnMovesEl) {
        insertDiagramBtn.addEventListener('click', () => insertDiagramAtCaret(pgnMovesEl));
    }

    const playerHost = $('sandbox-player-container');
    const playerBtn = $('update-player-btn');
    if (playerHost && playerBtn) {
        playerBtn.addEventListener('click', () => updatePgnPlayer(playerHost));
        updatePgnPlayer(playerHost);
    }
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
