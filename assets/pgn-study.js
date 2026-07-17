/**
 * ChessPublica — PGN Study page
 *
 * Turns a bare `<pgn-study>[PGN text]</pgn-study>` element into the full
 * framed study UI: ribbon (play/pause, table of contents, mobile article
 * toggle, settings, collapse/expand), loading placeholder, resizable
 * board/reading-column split, move picker, reading-column scroll sync,
 * and opening table of contents. Pair with pgn-study.css and a page
 * whose <body> holds nothing but the one <pgn-study> element — see
 * pgn-study/sadler/index.html for a minimal example.
 */

/* This page's <body> is nothing but a single <pgn-study> element holding
   the raw PGN text as its content — the ribbon, the loading placeholder,
   and the board/reading-column split are all built here instead of being
   duplicated as static markup in every page that embeds one of these
   studies. Both snippets below are inserted before anything else runs:
   the loading placeholder first (so it appears as early as possible),
   then the ribbon once <pgn-study>'s own content has been read out — see
   the comment on pgnHTML just below for why that order matters. Both
   stay hidden until pgn-study.css's own `pgn-study:not(.cp-ready)` /
   `.pgn-study-ribbon` rules lift, exactly as if they'd been static HTML
   with this same markup. */
const RIBBON_HTML = `
    <header class="pgn-study-ribbon">
        <div class="pgn-study-ribbon-toprow">
            <div class="pgn-study-ribbon-group pgn-study-ribbon-left">
                <button class="pgn-study-ribbon-btn" type="button" data-ribbon-action="toggle-play" title="Play" aria-label="Play" disabled>
                    <span class="lucide-icon" id="pgnStudyPlayPauseIcon"></span>
                </button>
                <button class="pgn-study-ribbon-btn" type="button" data-ribbon-action="toc" title="Table of contents" aria-label="Table of contents" disabled>
                    <span class="lucide-icon" id="pgnStudyTocIcon"></span>
                </button>
                <!-- Mobile-only — see .pgn-study-article-btn's own CSS
                     below. Desktop already shows the article text as its
                     own column; this button exists purely to give the
                     stacked mobile layout (which otherwise drops the
                     reading column entirely — see the "max-width: 899px"
                     rule above) a way to reach it. -->
                <button class="pgn-study-ribbon-btn pgn-study-article-btn" type="button" data-ribbon-action="article" title="Article text" aria-label="Article text" aria-pressed="false" disabled>
                    <span class="lucide-icon" id="pgnStudyArticleIcon"></span>
                </button>
            </div>
            <!-- Shown only while collapsed (see .pgn-study-ribbon-title's
                 own CSS above) — filled in once at load from the reading
                 column's own title, same source as .pgn-study-mobile-title
                 below. -->
            <div class="pgn-study-ribbon-title" id="pgnStudyRibbonTitle">
                <span class="lucide-icon" id="pgnStudyRibbonTitleIcon"></span>
                <span class="pgn-study-ribbon-title-lines">
                    <span class="pgn-study-ribbon-title-text" id="pgnStudyRibbonTitleText"></span>
                    <span class="pgn-study-ribbon-title-subtext" id="pgnStudyRibbonTitleSubtext"></span>
                </span>
            </div>
            <div class="pgn-study-ribbon-group pgn-study-ribbon-right">
                <span class="pgn-study-settings-inline" id="pgnStudySettingsInline">
                    <button class="pgn-study-ribbon-btn" type="button" data-ribbon-action="download" title="Download PGN" aria-label="Download PGN" disabled>
                        <span class="lucide-icon" id="pgnStudyDownloadIcon"></span>
                    </button>
                    <button class="pgn-study-ribbon-btn" type="button" data-ribbon-action="speed" title="Playback speed (1x)" aria-label="Playback speed" disabled>
                        <span class="lucide-icon" id="pgnStudySpeedIcon"></span>
                        <span class="pgn-study-speed-badge" id="pgnStudySpeedBadge">1x</span>
                    </button>
                    <button class="pgn-study-ribbon-btn" type="button" data-ribbon-action="flip" title="Flip board" aria-label="Flip board" disabled>
                        <span class="lucide-icon" id="pgnStudyFlipIcon"></span>
                    </button>
                </span>
                <button class="pgn-study-ribbon-btn" type="button" data-ribbon-action="settings" title="Settings" aria-label="Settings" disabled>
                    <span class="lucide-icon" id="pgnStudySettingsIcon"></span>
                </button>
                <button class="pgn-study-ribbon-btn pgn-study-collapse-toggle" type="button" id="pgnStudyCollapseToggle" data-ribbon-action="collapse" title="Collapse" aria-label="Collapse" aria-pressed="false">
                    <span class="lucide-icon" id="pgnStudyCollapseIcon"></span>
                </button>
            </div>
        </div>

        <div class="pgn-study-toc-accordion" id="pgnStudyTocAccordion"></div>
    </header>`;
const LOADING_HTML = `
    <div class="pgn-study-loading visible" id="pgnStudyLoading">
        <div class="pgn-study-loading-board"></div>
        <div class="pgn-study-loading-side">
            <div class="pgn-study-loading-spinner"></div>
            <p>Loading game…</p>
        </div>
    </div>`;

const studyEl = document.querySelector('pgn-study');
studyEl.insertAdjacentHTML('beforebegin', LOADING_HTML);

/* <pgn-study> holds the PGN text exactly once. Split it into a real
   <pgn-player> (left) and a real <pgn clickable-moves> (right) — the
   same two elements this page always used, just built from one shared
   source instead of two hand-kept-in-sync copies of the PGN. Runs
   synchronously (not on DOMContentLoaded) so both elements exist in
   time for ChessPublica's own DOMContentLoaded init pass to pick up the
   new <pgn> tag exactly like any other on the page — nothing about how
   <pgn>/<pgn-player> themselves work is touched, only this page's
   markup.

   innerHTML (not textContent) both ways: <pgn-study>'s content was
   parsed as real HTML by the browser like any element, so this
   preserves inline HTML inside comments (<br>, <em>, …) exactly as the
   original two separate blocks did — <pgn-player> reads it back via
   .textContent (tags collapse away, same as before), <pgn> via
   .innerHTML (tags survive, same as before). Read out before
   RIBBON_HTML goes in below — otherwise studyEl.innerHTML would pick up
   the ribbon markup too. */
const pgnHTML = studyEl.innerHTML;

const playerEl = document.createElement('pgn-player');
playerEl.innerHTML = pgnHTML;

const pgnEl = document.createElement('pgn');
pgnEl.setAttribute('clickable-moves', '');
pgnEl.innerHTML = pgnHTML;

const resizerEl = document.createElement('div');
resizerEl.className = 'pgn-study-resizer';
resizerEl.setAttribute('role', 'separator');
resizerEl.setAttribute('aria-orientation', 'vertical');
resizerEl.setAttribute('aria-label', 'Resize columns');
const resizerHandle = document.createElement('span');
resizerHandle.className = 'pgn-study-resizer-handle';
const resizerHandleIcon = document.createElement('span');
resizerHandleIcon.className = 'lucide-icon';
resizerHandleIcon.style.setProperty('--icon', window.ChessPublica.lucideIconUrl('grip-vertical'));
resizerHandle.appendChild(resizerHandleIcon);
resizerEl.appendChild(resizerHandle);

studyEl.replaceChildren(playerEl, resizerEl, pgnEl);
studyEl.insertAdjacentHTML('afterbegin', RIBBON_HTML);

        /* Drag-to-resize the board/reading-list columns (desktop grid
           layout only — the resizer is display:none in the stacked
           mobile layout, and pointerdown never fires on a hidden
           element). Only --left-col-width is ever written: the right
           column's own --right-col-width stays at its 2fr default the
           whole time, so it keeps automatically filling whatever the
           left column (and the fixed 6px resizer track) don't use —
           see the "min-width: 900px" rule above. The board inside
           pgn-player picks up the new column width on its own via the
           container-query --board-size rule just above (which is why
           it visibly resizes live as the reader drags, not just once
           they let go), and the reading column's text reflows for
           free — neither needs any resize-specific code here. */
        const columnResizer = (function setupColumnResizer() {
            let dragStartX = null;
            let dragStartWidth = null;

            /* One-way resize: dragging left (shrinking the board) is
               allowed down to a 20% floor. Dragging right can actually
               grow the board — up to the point where it hits its own
               cap (600px, see "pgn-study pgn-player { --board-size:
               min(calc(400px * 1.5), 94cqw) }" above): past that column
               width, the board can't grow any further, so widening the
               column more would only add empty padding around an
               already-maxed-out board — the drag stops right there
               instead of continuing to grow the gap. A 85%-of-total
               ceiling on top of that is just a sanity floor for the
               reading column, in case an unusually narrow desktop
               viewport would otherwise let the board-cap width swallow
               nearly all of it. */
            const clampLeftWidth = (px) => {
                const totalWidth = studyEl.getBoundingClientRect().width
                    - (parseFloat(getComputedStyle(studyEl).paddingLeft) || 0)
                    - (parseFloat(getComputedStyle(studyEl).paddingRight) || 0)
                    - 6; // the resizer track itself
                const min = totalWidth * 0.2;
                const boardCapWidth = 600 / 0.94;
                const max = Math.min(boardCapWidth, totalWidth * 0.85);
                return Math.min(Math.max(px, min), max);
            };

            resizerEl.addEventListener('pointerdown', (e) => {
                dragStartX = e.clientX;
                dragStartWidth = playerEl.getBoundingClientRect().width;
                resizerEl.classList.add('dragging');
                resizerEl.setPointerCapture(e.pointerId);
                e.preventDefault();
            });
            resizerEl.addEventListener('pointermove', (e) => {
                if (dragStartX === null) return;
                const newWidth = clampLeftWidth(dragStartWidth + (e.clientX - dragStartX));
                studyEl.style.setProperty('--left-col-width', newWidth + 'px');
                studyEl.style.setProperty('--right-col-width', '1fr');
            });
            const endDrag = (e) => {
                if (dragStartX === null) return;
                dragStartX = null;
                resizerEl.classList.remove('dragging');
                if (e && resizerEl.hasPointerCapture(e.pointerId)) resizerEl.releasePointerCapture(e.pointerId);
            };
            resizerEl.addEventListener('pointerup', endDrag);
            resizerEl.addEventListener('pointercancel', endDrag);

            /* Exposed so revealStudy() can start the reader at the same
               fully-dragged-right position a manual drag would end up
               at, instead of the CSS default 1fr:2fr split — clampLeftWidth
               reads studyEl's own rendered width, which is only real
               once .cp-ready lifts the "display: none" it starts with
               (see the "pgn-study:not(.cp-ready)" rule above), so this
               can't just run here at setup time alongside everything
               else in this IIFE. */
            function setToMaxWidth() {
                studyEl.style.setProperty('--left-col-width', clampLeftWidth(Infinity) + 'px');
                studyEl.style.setProperty('--right-col-width', '1fr');
            }

            return { setToMaxWidth };
        })();

        /* Ribbon icons, read straight off <pgn-player>'s own (hidden)
           lucide icons rather than hardcoding a duplicate icon URL here
           — same trick the move picker below already uses for its own
           "play" icon. Safe to do this immediately, unlike the button
           click-forwarding further down: connectedCallback builds
           <pgn-player>'s whole template (including these icons'
           already-set --icon custom properties) synchronously, before
           its actual engine — which the buttons need — finishes
           constructing. */
        const ribbonIconMap = {
            pgnStudyDownloadIcon: '.settings-btn[data-action="download"] .lucide-icon',
            pgnStudyFlipIcon:     '.settings-btn[data-action="flip"] .lucide-icon',
            pgnStudySpeedIcon:    '.settings-btn[data-action="speed"] .lucide-icon',
        };
        Object.entries(ribbonIconMap).forEach(([id, selector]) => {
            const iconUrl = playerEl.querySelector(selector)?.style.getPropertyValue('--icon');
            if (iconUrl) document.getElementById(id).style.setProperty('--icon', iconUrl);
        });

        // The collapse toggle, play/pause button, and TOC button have no
        // single already-rendered icon anywhere in <pgn-player> to borrow
        // from (unlike the three above — the on-board overlay button only
        // ever shows the "play" glyph, never "pause", and the ribbon's
        // play/pause button needs to swap between both), so these go
        // straight through ChessPublica's own public lucideIconUrl()
        // instead — see assets/icons.js / assets/ChessPublica.js. The
        // play/pause icon starts as "play"; syncPlayPauseButton() below
        // swaps it to "pause" (and back) as playback state changes. The
        // collapse toggle's own icon starts as "circle-x" (expanded —
        // click to collapse); syncCollapseToggle() below swaps it to
        // "maximize-2" (collapsed — click to expand) and back.
        document.getElementById('pgnStudyPlayPauseIcon').style.setProperty('--icon', window.ChessPublica.lucideIconUrl('circle-play'));
        document.getElementById('pgnStudyTocIcon').style.setProperty('--icon', window.ChessPublica.lucideIconUrl('list'));
        document.getElementById('pgnStudySettingsIcon').style.setProperty('--icon', window.ChessPublica.lucideIconUrl('settings'));
        // Same "A≡" glyph pgn.js/pgn-player.js already use for a game's own
        // title byline (.video-title-emoji) — already the site's existing
        // shorthand for "article text", so reused here rather than adding
        // a new icon to assets/icons.js's curated set.
        document.getElementById('pgnStudyArticleIcon').style.setProperty('--icon', window.ChessPublica.lucideIconUrl('text-initial'));

        /* ARTICLE ribbon button (mobile only — see its own CSS) — a plain
           layout toggle with no engine/board dependency at all, so it's
           wired up here rather than alongside TOC/settings below (which
           wait on the engine to finish loading first): a reader should
           still be able to read the article text even if the interactive
           board somehow fails to come up. */
        const articleBtn = document.querySelector('.pgn-study-ribbon-btn[data-ribbon-action="article"]');
        articleBtn.disabled = false;
        articleBtn.addEventListener('click', () => {
            const active = studyEl.classList.toggle('mobile-article-view');
            articleBtn.classList.toggle('active', active);
            articleBtn.setAttribute('aria-pressed', String(active));
        });

        // Collapsing doesn't depend on the engine, or even on loading
        // having finished — clear whichever loading placeholder might
        // still be showing (?.remove() no-ops safely if it's already
        // gone) and toggle the collapsed class, which is what
        // .pgn-study-collapsed's own CSS (above) acts on to hide every
        // other direct child of <pgn-study> and shrink the frame down to
        // just the ribbon.
        const collapseToggle = document.getElementById('pgnStudyCollapseToggle');
        const collapseIcon = document.getElementById('pgnStudyCollapseIcon');
        function syncCollapseToggle() {
            const collapsed = studyEl.classList.contains('pgn-study-collapsed');
            const label = collapsed ? 'Expand' : 'Collapse';
            collapseToggle.title = label;
            collapseToggle.setAttribute('aria-label', label);
            collapseToggle.setAttribute('aria-pressed', String(collapsed));
            collapseIcon.style.setProperty('--icon', window.ChessPublica.lucideIconUrl(collapsed ? 'maximize-2' : 'circle-x'));
        }
        function setCollapsed(collapsed) {
            if (studyEl.classList.contains('pgn-study-collapsed') === collapsed) return;
            document.getElementById('pgnStudyLoading')?.remove();
            studyEl.classList.toggle('pgn-study-collapsed', collapsed);
            syncCollapseToggle();
            /* Un-collapsing hands pgn-player's board back its real size in
               one step (display: none -> flex), but chessboard.js only
               redraws at that size once its own ResizeObserver notices and
               calls widget.resize() (see makeBoardResizable() in
               board.js) - batched a frame later via requestAnimationFrame.
               That gap is what reads as the board (and, since its column
               is sized off the board itself, the divider) starting large
               and visibly shrinking into place a moment after. Forcing
               the same resize() revealStudy() already does on first load
               here too skips straight to the settled size instead of
               waiting on that observer. */
            if (!collapsed && readyEngine && readyEngine.board && typeof readyEngine.board.resize === "function") {
                readyEngine.board.resize();
            }
        }
        collapseToggle.addEventListener('click', (e) => {
            // Stops this from also reaching the whole-frame listener just
            // below, which would otherwise immediately re-run setCollapsed()
            // with the state this click just left (a no-op given the guard
            // above, but only by luck of ordering - stopping it here keeps
            // that from being load-bearing).
            e.stopPropagation();
            setCollapsed(!studyEl.classList.contains('pgn-study-collapsed'));
        });
        syncCollapseToggle();

        /* Once collapsed, the ribbon *is* the whole frame (everything else
           is display: none - see .pgn-study-collapsed's own CSS above), so
           the entire thing acts as one big "expand" button rather than
           just the small toggle icon in the corner. A no-op while expanded
           (setCollapsed() only acts on state changes), so this is safe to
           leave listening on <pgn-study> at all times rather than
           attaching/detaching it as the state flips. */
        studyEl.addEventListener('click', () => setCollapsed(false));

        /* The page loads with the study already opening — the loading
           placeholder starts visible in the markup (see .pgn-study-loading
           above), and revealStudy() below swaps it for the real thing the
           instant loading finishes (see markStudyReady(), called from the
           DOMContentLoaded listener below). readyEngine captures that
           background work's result so revealStudy() can force the board's
           layout to compute once it actually has one. */
        let readyEngine = null;

        function revealStudy() {
            document.getElementById('pgnStudyLoading')?.classList.remove('visible');
            document.getElementById('pgnStudyLoading')?.remove();
            studyEl.classList.add('cp-ready');
            columnResizer.setToMaxWidth();
            if (readyEngine && readyEngine.board && typeof readyEngine.board.resize === "function") {
                readyEngine.board.resize();
            }
        }

        function markStudyReady(engine) {
            readyEngine = engine || null;
            revealStudy();
        }

        /* Chessbase-style reading sync between the <pgn-player> on the left
           and the static <pgn> column on the right:
             - player shows a mainline move -> highlight + scroll to it on
               the right (matched via the shared 0-based ply index —
               pgn-player.js's "cp-move" event detail / pgn.js's
               .pgn-move[data-ply] spans)
             - reader clicks a mainline move on the right -> player jumps
               to it (engine.goTo(), which re-fires "cp-move" and keeps
               everything above in sync)
             - reader clicks a variation/sub-variation move, or any
               diagram, on the right -> the player just shows that
               position directly (engine.showVariationPosition() — the
               same primitive <pgn-player> uses to preview a variation
               move from its own comment box — since neither has a
               mainline ply index to hand to goTo())
           The left column itself stays put via the sticky CSS above. */
        document.addEventListener('DOMContentLoaded', async () => {
            // <pgn> only becomes `.pgn-container` (see init.js) once
            // ChessPublica's own DOMContentLoaded listener has run — it
            // was registered before this one, so that's already true by
            // the time this fires.
            const movesRoot = studyEl.querySelector('.pgn-container .pgn-moves');
            if (!movesRoot) {
                // Nothing to sync, but still a reason not to leave the
                // reader stuck on a loading placeholder forever if they've
                // already asked to open it — reveal whatever <pgn-study>
                // did render.
                markStudyReady(null);
                return;
            }

            /* Mobile layout has no room for a full second column, so it
               drops the reading column's move text entirely (see the
               "max-width: 899px" rule above) — but the game's title/
               byline (pgn.js's own ".pgn-title", distinct from
               <pgn-player>'s identical-looking one, which stays hidden
               there) is worth keeping, just moved up above the board
               instead of buried at the top of a now-hidden column. A
               clone (not a move) keeps the original in place for the
               desktop reading column, which still wants it right where
               it's always been — .pgn-study-mobile-title's own CSS is
               what actually decides which of the two is ever visible at
               a given width, not this. */
            const originalTitle = studyEl.querySelector('.pgn-container .pgn-title');
            if (originalTitle) {
                const mobileTitle = originalTitle.cloneNode(true);
                mobileTitle.classList.add('pgn-study-mobile-title');
                studyEl.insertBefore(mobileTitle, playerEl);

                // Same idea, third spot: the ribbon's own compact title
                // (see .pgn-study-ribbon-title's CSS above), shown only
                // once collapsed — icon plus both text lines (players,
                // event/date), same content as mobileTitle above, just
                // pulled into its own pill instead of cloning the whole
                // block (which carries its own unwanted block-level
                // layout/spacing built for a full column, not a ribbon).
                const ribbonTitleIcon = document.getElementById('pgnStudyRibbonTitleIcon');
                const ribbonTitleText = document.getElementById('pgnStudyRibbonTitleText');
                const ribbonTitleSubtext = document.getElementById('pgnStudyRibbonTitleSubtext');
                const titleIconUrl = originalTitle.querySelector('.video-title-emoji')?.style.getPropertyValue('--icon');
                if (titleIconUrl) ribbonTitleIcon.style.setProperty('--icon', titleIconUrl);
                ribbonTitleText.textContent =
                    originalTitle.querySelector('.video-title-players')?.textContent
                    || originalTitle.textContent;
                ribbonTitleSubtext.textContent =
                    originalTitle.querySelector('.video-title-event')?.textContent || '';
            }

            let activeEl = null;
            function setActiveMove(el) {
                if (activeEl) activeEl.classList.remove('pgn-move-active');
                activeEl = el || null;
                if (activeEl) activeEl.classList.add('pgn-move-active');
            }

            /* <pgn-player>'s own comment box under the board is hidden
               entirely for pgn-study (see the CSS above) — showing a
               move's comment there AND in the reading column right next
               to it was the same information twice. Highlighting the
               reading column's own copy instead (rather than just
               leaving it be) is what makes losing the under-board copy
               not a regression: the engine still pauses on a commented
               move exactly as before (see the goTo()/
               _updateVariationCommentBox() pause logic elsewhere in this
               file and in pgn-player.js), and now that's the reader's
               cue to look right at the highlighted paragraph/span
               instead of down at the board. */
            let activeCommentEl = null;
            function setActiveComment(el) {
                if (activeCommentEl) activeCommentEl.classList.remove('pgn-comment-active');
                activeCommentEl = el || null;
                if (activeCommentEl) activeCommentEl.classList.add('pgn-comment-active');
            }

            // Aligns a reading-column move with the *top* of its own
            // column. Unlike a normal in-page <pgn>/<pgn-player> pair,
            // this frame layout never scrolls the window itself (html/body
            // are overflow:hidden — see the CSS above) — the reading
            // column scrolls internally (.pgn-container's own
            // overflow-y:auto), so it's that element's scrollTop that
            // needs to move, not window.scrollBy(). scrollIntoView() has
            // no "align with the top of my own scroll container" option,
            // so this scrolls by the gap between the move and the
            // container's own top edge instead.
            const scrollColumnEl = studyEl.querySelector('.pgn-container');
            function scrollMoveToBoardTop(el) {
                if (!scrollColumnEl) return;
                const delta = el.getBoundingClientRect().top - scrollColumnEl.getBoundingClientRect().top;
                scrollColumnEl.scrollBy({ top: delta, behavior: 'smooth' });
            }

            // Scrolling the page WHILE chessboard.js is mid-slide for the
            // move that triggered it visibly breaks the animation: its
            // piece-drag overlay is positioned in *document* coordinates,
            // computed once at the start of the slide, but the board
            // itself sits in a `position: sticky` column — once stuck, its
            // on-screen position no longer moves with the page the way an
            // ordinary document-flow element would, so as the page keeps
            // scrolling underneath it, the sliding piece drifts away from
            // the (visually stationary) squares instead of tracking them,
            // and appears to "jump" once the real piece reappears at the
            // end. Deferring the scroll to the board's own "cp-animation-end"
            // event (see pgn-player.js's onMoveEnd hook) instead of firing
            // it immediately lets the slide finish first, so the two
            // animations never overlap. pendingScrollTarget always holds
            // the *latest* target — during autoplay, several cp-move
            // events can land before the first slide even finishes, and
            // only the current position's row is ever worth scrolling to.
            // The timer is a fallback for the rare case chessboard.js
            // doesn't actually animate anything (e.g. re-rendering an
            // unchanged position), which never fires "cp-animation-end" at
            // all — 250ms comfortably clears pgn-player.js's own 200ms
            // moveSpeed on the normal path without adding a perceptible
            // delay of its own.
            let pendingScrollTarget = null;
            let pendingScrollTimer = null;
            function scheduleScroll(el) {
                pendingScrollTarget = el;
                clearTimeout(pendingScrollTimer);
                pendingScrollTimer = setTimeout(runPendingScroll, 250);
            }
            function runPendingScroll() {
                clearTimeout(pendingScrollTimer);
                if (!pendingScrollTarget) return;
                scrollMoveToBoardTop(pendingScrollTarget);
                pendingScrollTarget = null;
            }
            playerEl.addEventListener('cp-animation-end', runPendingScroll);

            playerEl.addEventListener('cp-move', (e) => {
                const moveIndex = e.detail.moveIndex;
                if (moveIndex == null || moveIndex < 0) { setActiveMove(null); setActiveComment(null); return; }

                const target = movesRoot.querySelector(`.pgn-move[data-ply="${moveIndex}"]`);
                if (!target) { setActiveMove(null); setActiveComment(null); return; }

                setActiveMove(target);
                scheduleScroll(target);
                setActiveComment(movesRoot.querySelector(`.pgn-comment[data-ply="${moveIndex}"]`));
            });

            // Counterpart to "cp-move" above, but for a variation position
            // (arrow-key stepping, the spacebar auto-play tick loop, or a
            // fresh variation/diagram click — see pgn-player.js's
            // showVariationPosition()). There's no mainline ply index to
            // match on here, so key off the FEN instead — every
            // data-fen-carrying element in the reading column (mainline
            // spans never carry one) is a candidate. Scoped to
            // .pgn-move/.pgn-clickable-diagram specifically, not a bare
            // "[data-fen=...]" — .pgn-comment-inline right below carries
            // the exact same FEN as the move it's attached to (there's no
            // other value to key an inline comment on), so an unscoped
            // selector could just as easily land on the comment instead
            // of the move/diagram this one actually needs.
            playerEl.addEventListener('cp-variation-move', (e) => {
                const fen = e.detail.fen;
                const target = fen ? movesRoot.querySelector(`.pgn-move[data-fen="${fen}"], .pgn-clickable-diagram[data-fen="${fen}"]`) : null;
                if (!target) { setActiveMove(null); setActiveComment(null); return; }

                setActiveMove(target);
                scheduleScroll(target);
                setActiveComment(movesRoot.querySelector(`.pgn-comment-inline[data-fen="${fen}"]`));
            });

            // The reading column's own diagrams (createBoard() calls
            // inside pgn.js's renderFullPGN — one per [D]/[#] marker,
            // NAG-glyph position, etc.) each build their own <img> piece
            // elements. Most point at the same ~12 shared theme URLs, so
            // the browser only fetches each once, but that first fetch
            // can still take a visible moment — without waiting for it,
            // the loading placeholder disappears (see cp-ready below)
            // before those images have actually arrived, so the reading
            // column pops its diagrams in piece-by-piece right in front
            // of the reader instead of appearing whole.
            //
            // createBoard() defers each diagram's actual construction
            // (and thus its <img> tags) by one requestAnimationFrame —
            // since every diagram here was scheduled during the same
            // synchronous render pass, they all land in the very next
            // frame; awaiting two rAFs is a small safety margin before
            // collecting <img> elements below, so none still pending get
            // missed.
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const readingColumnEl = movesRoot.closest('.pgn-container');
            const diagramImages = readingColumnEl ? Array.from(readingColumnEl.querySelectorAll('img')) : [];
            const diagramImagesReady = Promise.all(diagramImages.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true }); // a broken image shouldn't hang the loading screen forever
            })));

            // Player isn't ready to accept goTo()/showVariationPosition()
            // calls until its PGN has been parsed and the board built —
            // see helpers.js's createReadyGate.
            const [engine] = await Promise.all([
                playerEl.ready.catch(() => null),
                diagramImagesReady,
            ]);

            // <pgn-player> has now finished loading, on success or
            // failure alike (a load error shouldn't leave the reader
            // stuck looking at a loading placeholder forever once they've
            // asked to see it) — mark it ready. If the reader already
            // clicked "Open PGN Study" while this was still in flight,
            // this reveals it immediately; otherwise it just remembers
            // the result (see markStudyReady()/revealStudy() above) until
            // they do. Either way, engine.board.resize() (inside
            // revealStudy()) is what forces the board's layout to
            // actually compute for the first time, right as it becomes
            // visible — not here, since it's likely still display:none
            // behind that button at this exact point.
            markStudyReady(engine);

            if (!engine) return;

            /* Ribbon buttons forward to <pgn-player>'s own (hidden)
               settings buttons — same three actions (download/flip/
               speed) and same underlying logic, just always-visible
               app-style chrome instead of tucked behind a gear-icon
               toggle. Only wired up now, not any earlier: those
               buttons' own click handlers aren't attached until the
               engine itself has finished constructing (see
               VideoEngine's constructor in pgn-player.js), same
               reason the buttons start out disabled in the markup. */
            // Speed badge lives on the speed button itself now (it used
            // to sit on the play/pause button, but the speed button is
            // the one this multiplier is actually about) — resynced
            // straight from its own click handler below.
            const speedBadge = document.getElementById('pgnStudySpeedBadge');
            const syncSpeedBadge = () => { speedBadge.textContent = engine.state.speed + 'x'; };
            syncSpeedBadge();

            document.querySelectorAll('.pgn-study-ribbon-btn').forEach(btn => {
                const action = btn.dataset.ribbonAction;
                const target = playerEl.querySelector(`.settings-btn[data-action="${action}"]`);
                if (!target) return;

                btn.disabled = false;
                btn.addEventListener('click', () => {
                    target.click();
                    // Icon-only button, so the current multiplier (the one
                    // piece of state an icon alone can't show) lives in the
                    // tooltip instead of on-screen text — resync it from the
                    // engine's actual state after every click.
                    if (action === 'speed') {
                        const label = `Playback speed (${engine.state.speed}x)`;
                        btn.title = label;
                        btn.setAttribute('aria-label', label);
                        syncSpeedBadge();
                    }
                });
            });

            /* Play/Pause ribbon button drives the engine directly —
               unlike download/flip/speed above, there's no hidden
               .settings-btn counterpart to forward to (the on-board
               overlay button only ever shows/hides itself, it doesn't
               expose a separate "pause" control). One button toggles
               both the action and its own icon/title, kept in sync via
               both "cp-move" (goTo() — mainline play ticks, pauses, and
               manual navigation) and "cp-variation-move"
               (showVariationPosition() — the same for a variation's own
               autoplay/spacebar loop). Both are needed: togglePlay()
               tracks variation playback in engine._variation.playing
               instead of engine.state.playing (which it forces false
               whenever a variation is active), so checking only the
               latter left this button stuck on "Play" — silently wrong,
               not just unsynced — the entire time a variation was
               actually auto-playing. */
            const playPauseBtn = document.querySelector('.pgn-study-ribbon-btn[data-ribbon-action="toggle-play"]');
            const playPauseIcon = document.getElementById('pgnStudyPlayPauseIcon');
            const syncPlayPauseButton = () => {
                const playing = engine.state.playing || !!(engine._variation && engine._variation.playing);
                playPauseIcon.style.setProperty('--icon', window.ChessPublica.lucideIconUrl(playing ? 'pause' : 'circle-play'));
                playPauseBtn.title = playing ? 'Pause' : 'Play';
                playPauseBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
            };
            playPauseBtn.disabled = false;
            playPauseBtn.addEventListener('click', () => {
                // A picker showing (lastPicker, set up below) means the
                // engine is deliberately paused right at a branch point —
                // togglePlay() would just call play()/resume the variation
                // as usual, but the goTo()/variationGoTo() wrapper below
                // vetoes exactly that step unless allowNextAdvance is set,
                // so without this the button would silently do nothing.
                // Confirm the same default choice the picker's own bold
                // row already offers (mainline continuation, or resuming
                // this variation) rather than falling through to
                // togglePlay() and getting vetoed.
                if (lastPicker && lastPicker.kind === 'main') {
                    allowNextAdvance = true;
                    engine.play();
                    return;
                }
                if (lastPicker && lastPicker.kind === 'sub' && lastPicker.index < lastPicker.variationObj.moves.length) {
                    const v = engine._variation;
                    if (v) {
                        allowNextAdvance = true;
                        v.maxIndex = v.fens.length - 1;
                        v.playing = true;
                        engine._variationPlayTick(v, null);
                        return;
                    }
                }
                engine.togglePlay();
            });
            syncPlayPauseButton();
            playerEl.addEventListener('cp-move', syncPlayPauseButton);
            playerEl.addEventListener('cp-variation-move', syncPlayPauseButton);

            /* TOC ribbon button — expands/collapses the accordion built
               into the ribbon itself (see the markup above) rather than
               scrolling to the .pgn-study-toc at the bottom of the
               reading column. Looked up at click time rather than cached
               here since buildOpeningToc() below still needs to fetch
               and render it first — toggling just expands/collapses an
               empty shell either way until then. */
            const tocBtn = document.querySelector('.pgn-study-ribbon-btn[data-ribbon-action="toc"]');
            const tocAccordion = document.getElementById('pgnStudyTocAccordion');
            tocBtn.disabled = false;
            tocBtn.addEventListener('click', () => {
                tocAccordion.classList.toggle('open');
            });

            /* Settings ribbon button — shows/hides the flip/speed/download
               group inline in the ribbon's right-hand side (see the
               markup above and .pgn-study-settings-inline's CSS). */
            const settingsBtn = document.querySelector('.pgn-study-ribbon-btn[data-ribbon-action="settings"]');
            const settingsInline = document.getElementById('pgnStudySettingsInline');
            settingsBtn.disabled = false;
            settingsBtn.addEventListener('click', () => {
                settingsInline.classList.toggle('open');
            });

            /* Move picker — replaces <pgn-player>'s own comment/variation
               box (hidden in the CSS above) with just the mainline move
               and each alternative's opening move, one line each, so the
               reader can see the choices at a branch point and click one
               instead of reading the full variation text again (already
               available in the column on the right). Built straight from
               <pgn-player>'s own engine.state — variations[moveIdx] are
               the PGN "(...)" alternatives to state.moves[moveIdx], and
               cache[moveIdx] is the FEN they all branch from — rather
               than re-parsing anything. */
            const pickerEl = document.createElement('div');
            pickerEl.className = 'pgn-study-move-picker';
            playerEl.querySelector('.player-wrapper').appendChild(pickerEl);

            // Reuse the site's actual "play" icon (same lucide glyph as
            // the board's own play button / variation play-icons)
            // instead of a plain "▶" character — read straight off the
            // board's own (hidden) play button so this stays in sync
            // with whatever icon the rest of the site uses, rather than
            // hardcoding a duplicate icon URL here. .pgn-study-picker-icon
            // below is `.lucide-icon` (shared mask-image technique) and
            // inherits this custom property from its ancestor.
            const playIconUrl = playerEl.querySelector('.play .lucide-icon')?.style.getPropertyValue('--icon');
            if (playIconUrl) pickerEl.style.setProperty('--icon', playIconUrl);

            const toFigurine = window.ChessPublica.toFigurine;
            const formatLabel = (san, fullNum, isBlack) =>
                `${fullNum}${isBlack ? '…' : '.'} ${toFigurine(san)}`;

            // A move's color/number, read straight from the FEN *before*
            // it was played (side-to-move + fullmove-number fields) —
            // works identically for a mainline move (engine.state.cache
            // entries) and a variation move (a _variation.fens entry),
            // so both picker modes below can share it instead of each
            // needing their own branch-tracking arithmetic.
            function fenMoveContext(fen) {
                const parts = fen.split(' ');
                return { isBlack: parts[1] === 'b', fullMoveNum: parseInt(parts[5], 10) || 1 };
            }

            const setActiveRow = (row) => {
                pickerEl.querySelectorAll('.pgn-study-picker-row').forEach(r => r.classList.remove('active'));
                row.classList.add('active');
            };

            // Keyboard picker navigation (see the capture-phase keydown
            // listener below): ArrowUp/ArrowDown move this cursor between
            // rows — reusing the same .active highlight setActiveRow()
            // already uses, so the "candidate" the reader is considering
            // and the eventual "confirmed" row look identical — without
            // touching the board; Space commits whichever row it's on
            // (same as clicking it). Re-synced to match the picker's own
            // default-active row every time it's (re)built, whatever
            // triggered that — a fresh branch point, or a plain mouse
            // click on a row.
            let pickerFocusIndex = -1;
            const pickerRows = () => Array.from(pickerEl.querySelectorAll('.pgn-study-picker-row'));
            function syncPickerFocus() {
                const rows = pickerRows();
                const activeIdx = rows.findIndex(r => r.classList.contains('active'));
                pickerFocusIndex = activeIdx >= 0 ? activeIdx : (rows.length ? 0 : -1);
            }

            const makeRow = (label, isMainline, onClick) => {
                const row = document.createElement('div');
                row.className = 'pgn-study-picker-row' + (isMainline ? ' mainline' : '');
                row.innerHTML = '<span class="pgn-study-picker-icon lucide-icon"></span><span></span>';
                row.lastElementChild.textContent = label;
                row.onclick = () => { setActiveRow(row); onClick(); };
                pickerEl.appendChild(row);
                return row;
            };

            /* Replays a move list from a branch FEN into a fens/verbose
               sequence — the shape engine.enterVariation() needs — same
               idea as pgn.js's collectVariationSequence() but starting
               from a SAN list (a parsed variation/child object) rather
               than an already-built node chain. Shared by both picker
               modes below (a top-level alternative and a nested child
               are the same shape: { moves, moveAnnotations, … }). */
            function replayMoves(branchFEN, sans) {
                const chess = new Chess(branchFEN);
                const fens = [branchFEN];
                const verbose = [];
                for (const san of sans) {
                    const move = chess.move(san, { sloppy: true });
                    if (!move) break; // stop at the first unparseable move, keep what came before it
                    fens.push(chess.fen());
                    verbose.push({ from: move.from, to: move.to });
                }
                return { fens, verbose };
            }

            /* Enters a freshly-picked variation/child (top-level
               alternative or nested sub-variation — same shape either
               way) at its first move, and keeps going: plays through the
               rest of it automatically, the same tick loop spacebar
               drives, instead of leaving the reader to press Space again
               just to get it moving. "Pick an option" and "continue
               playing it" used to be two separate steps; this collapses
               them into one, matching the mainline "continue" row, which
               already auto-plays forward the moment it's picked.

               playing is set *before* showVariationPosition() rather
               than after, on purpose: that call fires "cp-variation-move"
               synchronously, which is what updatePicker() uses to detect
               a sub-variation branch right at this first move and pause
               there (see renderSubPicker() above) — it can only do that
               by flipping _variation.playing back off, so playing has to
               already be on for that to have anything to undo. Checking
               it again afterward is what tells us whether that happened:
               still true means no immediate branch, so the tick loop
               actually starts; false means renderSubPicker() already
               paused it and is showing its own picker, and starting the
               loop here would just plow straight through that pause.

               engine.state.playing = false is what actually stops the
               *mainline*'s own autoplay tick loop right here, not just
               eventually: the picker (and this row) render the instant
               engine.state.index reaches a branch — one tick before the
               veto in goTo() below would actually fire and pause it —
               so if the reader picks this row in that same window, the
               main line's loop is still ticking. Its own next scheduled
               tick lands on the vetoed step, and the veto's own
               engine.pause() calls goTo() to re-render — which
               unconditionally clears _variation (see pgn-player.js),
               wiping out the variation just entered here out from under
               the reader for no reason they could see. Setting this
               false first means that stale tick's own
               "if (!this.state.playing) return;" guard catches it
               before any of that runs. */
            function enterAndPlayVariation(fens, moveAnnotations, verbose, variationObj) {
                engine.state.playing = false;
                engine.enterVariation(fens, moveAnnotations, 1, null, verbose, variationObj);
                const v = engine._variation;
                v.maxIndex = v.fens.length - 1;
                v.playing = true;
                engine.showVariationPosition(fens[1], null, verbose[0], null);
                /* _variationPlayTick(v, null) — passing ts=null directly,
                   the way the sub-picker's own "continue" row and the
                   auto-continue listener below both do — treats *this*
                   call itself as the first move of a fresh autoplay run
                   ("ts == null" skips the timing check entirely and
                   advances right away, matching what a reader clicking
                   Play expects: the very next move appears immediately,
                   only later ones get spaced out). Both of those callers
                   are resuming from wherever the board already sits, so
                   that's exactly right. This one is different: the first
                   move was already just shown above via
                   showVariationPosition(fens[1], ...), so treating the
                   tick's own first call as *another* "advance right
                   away" skips straight to the second move instead of
                   pacing normally from here — which is exactly what
                   looked like "clicking 13...Nc7+ jumps straight to
                   13...Ke7". Scheduling through requestAnimationFrame
                   instead gives the tick a real timestamp on its first
                   call, so its own delay check applies from the start
                   rather than being bypassed once. */
                if (v.playing) requestAnimationFrame((ts) => engine._variationPlayTick(v, ts));
            }

            // Mainline branch point: the move about to be played next from
            // here (engine.state.moves[moveIdx], where moveIdx ===
            // engine.state.index — nothing past this point has been
            // played yet) has recorded PGN "(...)" alternatives
            // (engine.state.variations[moveIdx]) — one row per
            // alternative, plus a bold row for the move the game actually
            // continues with. The wrapped engine.goTo() below (see its
            // own comment) is what keeps the engine sitting right here
            // instead of auto-playing that move and landing one ply past
            // it, so branchFEN below is simply the position already on
            // the board — nothing needs rewinding to get there.
            function renderMainlinePicker(moveIdx) {
                const alternatives = moveIdx >= 0 ? engine.state.variations[moveIdx] : null;
                if (!alternatives || !alternatives.length) return;

                const branchFEN = engine.state.cache[moveIdx];
                const ctx = fenMoveContext(branchFEN);

                const mainlineRow = makeRow(
                    formatLabel(engine.state.moves[moveIdx], ctx.fullMoveNum, ctx.isBlack),
                    true,
                    () => { allowNextAdvance = true; engine.play(); },
                );
                setActiveRow(mainlineRow); // pre-selected as the default Space/click choice

                alternatives.forEach((variation) => {
                    if (!variation.moves || !variation.moves.length) return;
                    const { fens, verbose } = replayMoves(branchFEN, variation.moves);
                    if (verbose.length === 0) return; // even the first move failed

                    makeRow(formatLabel(variation.moves[0], ctx.fullMoveNum, ctx.isBlack), false, () => {
                        enterAndPlayVariation(fens, variation.moveAnnotations, verbose, variation);
                    });
                });
            }

            // Sub-variation branch point: variationObj.moves[index] (the
            // move about to be played next *within this variation* —
            // index === engine._variation.index, nothing past this point
            // of the variation played yet) has recorded nested
            // alternatives (variationObj.childrenByMove[index]) — same
            // idea as renderMainlinePicker() above, one nesting level
            // deeper, and recurses to any depth the same way (each child
            // clicked becomes the new engine._variation.variationObj, so
            // this function runs again against *its* childrenByMove
            // next). index === 0 (the variation was just entered — see
            // enterAndPlayVariation() above — and hasn't played even its
            // own first move yet) is excluded by updatePicker() below,
            // same reasoning as ever: nothing played yet to attach a
            // picker to at that exact point.
            function renderSubPicker(variationObj, index) {
                const children = variationObj.childrenByMove && variationObj.childrenByMove[index];
                if (!children || !children.length) return;

                const branchFEN = engine._variation.fens[index];
                const ctx = fenMoveContext(branchFEN);

                // "Continue" — resume *this* variation's own playback
                // forward (the same tick loop spacebar drives), not the
                // mainline. Omitted at the variation's last move — there
                // is nothing further in it to continue into.
                if (index < variationObj.moves.length) {
                    const continueRow = makeRow(
                        formatLabel(variationObj.moves[index], ctx.fullMoveNum, ctx.isBlack),
                        true,
                        () => {
                            const v = engine._variation;
                            if (!v) return;
                            allowNextAdvance = true;
                            v.maxIndex = v.fens.length - 1;
                            v.playing = true;
                            engine._variationPlayTick(v, null);
                        },
                    );
                    setActiveRow(continueRow); // pre-selected as the default Space/click choice
                }

                children.forEach((child) => {
                    if (!child.moves || !child.moves.length) return;
                    const { fens, verbose } = replayMoves(branchFEN, child.moves);
                    if (verbose.length === 0) return;

                    makeRow(formatLabel(child.moves[0], ctx.fullMoveNum, ctx.isBlack), false, () => {
                        enterAndPlayVariation(fens, child.moveAnnotations, verbose, child);
                    });
                });
            }

            // Dispatches to whichever picker mode matches where the
            // player currently is, and — this is what makes the picker
            // disappear the moment a row is clicked, not just when a
            // *different* mainline move is reached — always clears and
            // rebuilds from scratch on a real position change, whether
            // that's a fresh mainline move ("cp-move") or a fresh
            // variation move ("cp-variation-move"). Guarded against
            // rebuilding for a *redundant* event carrying the exact same
            // position (e.g. engine.pause() re-firing "cp-move" at an
            // unchanged state.index) — without that, such an event would
            // wipe the picker and reset which row looks .active a moment
            // after a click handler had just set it correctly.
            let lastPicker = null;
            function picksSame(a, b) {
                if (!a || !b || a.kind !== b.kind) return false;
                if (a.kind === 'main') return a.moveIdx === b.moveIdx;
                if (a.kind === 'sub') return a.variationObj === b.variationObj && a.index === b.index;
                return true;
            }

            function updatePicker() {
                let next;
                if (!engine._variation) {
                    const moveIdx = engine.state.index;
                    const alternatives = moveIdx >= 0 ? engine.state.variations[moveIdx] : null;
                    next = (alternatives && alternatives.length) ? { kind: 'main', moveIdx } : { kind: 'none' };
                } else if (engine._variation.variationObj) {
                    const index = engine._variation.index;
                    const children = index > 0 ? engine._variation.variationObj.childrenByMove?.[index] : null;
                    next = (children && children.length) ? { kind: 'sub', variationObj: engine._variation.variationObj, index } : { kind: 'none' };
                } else {
                    // A variation entered without a variationObj (the
                    // reading column's own variation-move clicks don't
                    // have one — pgn.js and pgn-player.js parse the PGN
                    // independently into incompatible shapes, so there's
                    // no childrenByMove to look up sub-branches from
                    // here). Nothing to show, but still a real position
                    // change, so fall through to clear any stale picker.
                    next = { kind: 'none' };
                }

                if (picksSame(lastPicker, next)) return;
                lastPicker = next;

                pickerEl.replaceChildren();
                if (next.kind === 'main') renderMainlinePicker(next.moveIdx);
                else if (next.kind === 'sub') renderSubPicker(next.variationObj, next.index);
                syncPickerFocus();
            }

            /* Auto-play (the tick loop) and single-step navigation alike
               normally advance one ply at a time by calling
               goTo()/variationGoTo() with the very next index — including
               a move that has recorded PGN "(...)" alternatives, which is
               exactly the position the picker above wants to show
               *before*, not after. An earlier version let that move play
               (and animate onto the board) and then rewound one ply once
               the picker noticed it should have stopped sooner — correct
               in the end, but each half of that round trip is its own
               animated piece slide (chessboard.js — see board.js), which
               together read as the move playing and then immediately
               un-playing itself.

               Wrapping goTo()/variationGoTo() to simply refuse that one
               specific step avoids the animation ever starting: the
               position just never leaves the branch point on its own.
               The one legitimate case that *does* need the exact same
               step to go through is a row's own click handler above
               ("continue" or resuming a variation's playback past its own
               branch) — allowNextAdvance below is set by those two click
               handlers immediately before they step forward, and nothing
               else, specifically so it means "the reader just clicked
               this exact row", not merely "this branch's picker happens
               to be showing" (which is true the instant the picker
               renders, well before any click — the very next tick of the
               *auto-play* loop would otherwise read as having "already
               shown" it too, defeating the whole point of pausing here).

               goTo()'s own callers aren't consistent about *when* they
               update state.index relative to calling it — play() and the
               tick loop both do "state.index++; goTo(state.index)",
               mutating it *before* the call, while arrow-key/TOC/reading-
               column navigation instead pass "state.index + 1" as a
               plain argument, leaving the field itself untouched until
               goTo() runs. Reading engine.state.index in here can't tell
               those apart — by the time some calls arrive it already
               equals the target, not the position still on the board.
               Tracking that separately (updated only when a call is
               actually let through below) sidesteps the inconsistency
               entirely. variationGoTo()'s own callers are consistent
               (none of them pre-mutate engine._variation.index), so it
               reads that directly instead. */
            let allowNextAdvance = false;
            let currentBoardIndex = engine.state.index;
            const originalGoTo = engine.goTo.bind(engine);
            engine.goTo = function (i) {
                if (i === currentBoardIndex + 1) {
                    const moveIdx = i - 1;
                    const alternatives = engine.state.variations[moveIdx];
                    if (alternatives && alternatives.length && !allowNextAdvance) {
                        engine.state.index = currentBoardIndex; // undo play()/the tick loop's own pre-increment above
                        engine.pause(); // re-renders the unchanged current position, paused
                        return;
                    }
                }
                allowNextAdvance = false;
                currentBoardIndex = i;
                return originalGoTo(i);
            };
            const originalVariationGoTo = engine.variationGoTo.bind(engine);
            engine.variationGoTo = function (index) {
                const v = engine._variation;
                if (v && v.variationObj && index === v.index + 1) {
                    const branchIdx = v.index;
                    const children = v.variationObj.childrenByMove?.[branchIdx];
                    if (children && children.length && !allowNextAdvance) {
                        engine._pauseVariationPlay(); // re-dispatches at the unchanged current position, paused
                        return;
                    }
                }
                allowNextAdvance = false;
                return originalVariationGoTo(index);
            };

            /* goTo() (see pgn-player.js) auto-pauses whenever
               commentBox.update() reports "content" for the move just
               played — and it treats both a move's recorded PGN "(...)"
               alternatives AND a [D]/[#] diagram marker as content on
               their own, even with no actual comment text, so it can
               render an alternatives preview or an inline board
               snapshot in the comment box. pgn-study hides that box
               entirely (see .video-comment above) — the alternatives
               preview is replaced by its own move-picker, which already
               owns pausing at a branch, one ply *before* it, not after;
               and a diagram is always just a snapshot of whatever
               position is current, which the interactive board to its
               left is already showing continuously, live, the whole
               time — never something the reader could only see by
               pausing here. Left unfiltered, either one fires a pause
               with nothing on screen to explain it: a silent extra stop
               right after the picker's own choice is confirmed, or a
               dead stop on a move that happens to carry a diagram
               marker and nothing else. Wrapping the update call to
               report only real comment *text* as content — never bare
               alternatives, never a diagram alone — leaves the one
               genuine reason to pause (an actual comment) untouched,
               and does the same for the DOM update itself, so nothing
               about what's actually rendered changes either. */
            const originalCommentUpdate = engine.commentBox.update.bind(engine.commentBox);
            engine.commentBox.update = function (moveIndex, comments, variations, diagrams, ...rest) {
                const hasContent = originalCommentUpdate(moveIndex, comments, variations, diagrams, ...rest);
                return hasContent && !!comments?.[moveIndex];
            };

            updatePicker();
            playerEl.addEventListener('cp-move', updatePicker);
            playerEl.addEventListener('cp-variation-move', updatePicker);

            /* Once a (sub-)variation the reader picked has played all the
               way to its own last move — variationEnded on the event
               detail, set only by _variationPlayTick() in pgn-player.js
               reaching the true end, never by a plain mid-variation pause
               — there's nothing further to show from here on its own, so
               pick back up wherever it branched from: the parent
               variation if this was nested inside one (resuming *its*
               playback, not just repositioning to it), the main line
               otherwise. allowNextAdvance is set first exactly like the
               picker's own mainline/continue rows do, since resuming
               past this exact branch again is precisely what those rows
               mean too — without it, the goTo()/variationGoTo() veto
               above would just re-show the same branch we already
               explored. */
            playerEl.addEventListener('cp-variation-move', (e) => {
                if (!e.detail || !e.detail.variationEnded) return;
                const v = engine._variation;
                if (!v) return;

                if (engine.exitToParentVariation()) {
                    const parent = engine._variation;
                    allowNextAdvance = true;
                    parent.maxIndex = parent.fens.length - 1;
                    parent.playing = true;
                    engine._variationPlayTick(parent, null);
                } else {
                    // engine.state.index is still sitting at the branch
                    // point itself (mainStateIndex) — nothing touches it
                    // while a variation is active — so play() alone (its
                    // own state.index++ then goTo()) is exactly the same
                    // single step the mainline picker row's own handler
                    // takes, no separate goTo() needed first.
                    engine.exitVariation();
                    allowNextAdvance = true;
                    engine.play();
                }
            });

            /* ArrowUp/ArrowDown move the picker's keyboard focus; Space
               commits whichever row it's on (same as clicking it) —
               *only* while the picker actually has rows to navigate.
               Registered on the capture phase specifically so it runs
               BEFORE pgn-player.js's own bubble-phase Space handler
               (togglePlay(), attached to document same as this): with
               nothing to pick from, we don't touch the event at all and
               that handler runs exactly as it always has (mainline
               play/pause, or "continue playing a variation" once one's
               been entered — see below); with a picker showing, we
               consume the keypress ourselves so Space never
               double-fires both a picker selection AND a play/pause
               toggle for the same press.

               This is also *why* the second Space in "select an option,
               then hit spacebar to continue" just works without any
               special-casing: selecting a row normally leaves the picker
               empty right after (see updatePicker() above), so that next
               Space press finds no rows here, isn't touched, and falls
               straight through to togglePlay() — which finds
               engine._variation now set and plays through it, same as
               any other variation entered by hand. */
            document.addEventListener('keydown', (e) => {
                if (e.code !== 'ArrowDown' && e.code !== 'ArrowUp' && e.code !== 'Space') return;

                const rows = pickerRows();
                if (!rows.length) return;

                const activeTag = document.activeElement && document.activeElement.tagName;
                if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

                const rect = playerEl.getBoundingClientRect();
                if (!(rect.top < window.innerHeight && rect.bottom > 0)) return;

                e.preventDefault();
                e.stopPropagation();

                if (e.code === 'Space') {
                    rows[pickerFocusIndex]?.click();
                    return;
                }

                const delta = e.code === 'ArrowDown' ? 1 : -1;
                pickerFocusIndex = Math.max(0, Math.min(rows.length - 1, pickerFocusIndex + delta));
                setActiveRow(rows[pickerFocusIndex]);
            }, { capture: true });

            // Matches a chain of .pgn-variation wrappers (outermost first,
            // see the click handler below) to their real counterparts in
            // engine.state's own parsed variation tree — pgn.js and
            // pgn-player.js parse the same PGN independently into
            // incompatible shapes, but both walk it in the same source
            // order, so the same (branch move, position among siblings
            // branching from it) address — cpBranchIndex/cpAltIndex, set
            // by pgn.js on each wrapper — identifies the same variation in
            // either tree. Returns one entry per chain level, null for any
            // level that couldn't be matched (shouldn't normally happen
            // for a real PGN variation move, but callers should treat a
            // null as "no extra data available", not throw).
            function resolveRealVariationChain(chain) {
                const real = [];
                let candidates = engine.state.variations[chain[0].cpBranchIndex];
                let obj = candidates ? candidates[chain[0].cpAltIndex] : null;
                real.push(obj || null);
                for (let i = 1; i < chain.length; i++) {
                    const parentObj = real[i - 1];
                    const kids = parentObj && parentObj.childrenByMove
                        ? parentObj.childrenByMove[chain[i].cpBranchIndex]
                        : null;
                    obj = kids ? kids[chain[i].cpAltIndex] : null;
                    real.push(obj || null);
                }
                return real;
            }

            movesRoot.addEventListener('click', (e) => {
                // .pgn-move: mainline (data-ply) or variation (data-fen) move text.
                // .pgn-clickable-diagram: an inline [D]/[#] board — always data-fen.
                const moveEl = e.target.closest('.pgn-move, .pgn-clickable-diagram');
                if (!moveEl) return;

                engine.pause();

                if (moveEl.dataset.ply !== undefined) {
                    const moveIndex = parseInt(moveEl.dataset.ply, 10);
                    if (Number.isNaN(moveIndex)) return;
                    engine.goTo(moveIndex + 1); // goTo() takes a position index (ply + 1), not a move index; fires "cp-move" above
                    return;
                }

                const fen = moveEl.dataset.fen;
                if (!fen) return;
                const move = moveEl.dataset.from && moveEl.dataset.to
                    ? { from: moveEl.dataset.from, to: moveEl.dataset.to }
                    : null;

                // A variation move carries data-vindex — its 0-based index
                // into the fens/verbose sequence pgn.js stashed on the
                // enclosing .pgn-variation (see collectVariationSequence()
                // there). A diagram inside a variation carries no such
                // index (it isn't itself one of the sequence's moves), so
                // find it by matching its FEN in that same sequence
                // instead. Either way, handing the whole sequence to
                // enterVariation(), not just this one FEN, is what makes
                // arrow keys/spacebar step through the REST of the
                // variation from here afterward, instead of falling back
                // to mainline playback (which is all showVariationPosition()
                // alone gives you — a static preview with no position of
                // its own to resume from).
                //
                // A click can land inside a sub-...-sub-variation, nested
                // arbitrarily deep — walk outward from it collecting every
                // enclosing .pgn-variation, outermost first, then replay
                // that whole chain through enterVariation() one level at a
                // time (mirrors how entering a variation from *inside*
                // another one already works — see enterVariation()'s own
                // doc comment in pgn-player.js). Each call but the last
                // enters its level at exactly the move the *next* level
                // down branches from (cpBranchIndex, stashed per wrapper
                // by pgn.js) — the position <pgn-player>'s own
                // exitToParentVariation() needs waiting on its stack to
                // correctly resume there later, once ArrowRight/ArrowLeft
                // walks back out past this variation's own last move,
                // instead of always dropping straight back to the very
                // start of the game (state.index defaults to 0 when the
                // main line was never actually played through to get
                // here). The final call in the chain enters at the
                // move actually clicked.
                //
                // Each level is also matched, via cpBranchIndex/cpAltIndex,
                // to the corresponding REAL variation object in
                // <pgn-player>'s own (separately parsed) tree — see
                // resolveRealVariationChain() — rather than handing
                // enterVariation() a bare shim: only the real object has
                // commentsByMove/diagramByMove (so the comment box shows
                // this variation's own prose, not nothing) *and*
                // childrenByMove (so the move picker can find this
                // variation's own sub-branches and offer them, exactly
                // like clicking through the picker itself already does —
                // without it, updatePicker() has no way to know a branch
                // point reached this way has any alternatives at all).
                const chain = [];
                for (let w = moveEl.closest('.pgn-variation'); w; w = w.parentElement.closest('.pgn-variation')) {
                    chain.unshift(w);
                }

                if (chain.length) {
                    engine.exitVariation(); // clean slate, don't stack onto whatever was active before this click

                    // Positions the main line's own pointer at the exact
                    // move this outermost variation branches from, so
                    // enterVariation()'s mainStateIndex capture (just
                    // `state.index` at call time) is correct even though
                    // the main line itself was never actually played
                    // through to get here.
                    if (Number.isFinite(chain[0].cpBranchIndex)) {
                        engine.state.index = chain[0].cpBranchIndex + 1;
                    }

                    const realChain = resolveRealVariationChain(chain);

                    chain.forEach((w, i) => {
                        const isInnermost = i === chain.length - 1;
                        let index;
                        if (isInnermost) {
                            const vIndex = moveEl.dataset.vindex;
                            index = vIndex !== undefined
                                ? parseInt(vIndex, 10) + 1
                                : w.cpFens.indexOf(fen);
                        } else {
                            index = chain[i + 1].cpBranchIndex + 1;
                        }
                        if (index < 0) return; // shouldn't happen, but don't enter at a bogus position

                        const real = realChain[i];
                        engine.enterVariation(w.cpFens, real ? real.moveAnnotations : null, index, null, w.cpVerbose, real);
                    });
                }

                engine.showVariationPosition(fen, null, move, null);
                setActiveMove(moveEl);
            });

            buildOpeningToc();

            /* ===========================================================
               OPENING TABLE OF CONTENTS
               ===========================================================
               An index of every named opening/variation reached anywhere
               in the game — main line or any variation, however deep —
               each entry linking straight to the move where it first
               diverges from whatever was named before it. Sourced from
               assets/eco-openings.json: a { "<space-joined SAN moves>":
               "<name>" } map built from lichess-org/chess-openings (CC0),
               keyed the same way "1. d4 Nf6 2. c4 e6 3. Nf3 d5 4. Nc3
               Bb4" appears there, minus the move numbers.

               Naming a position: per that project's own convention
               ("play moves backwards until a named position is found"),
               nameForSans() checks the full move list first, then one
               move shorter, and so on — not every ply has its own exact
               entry (most don't; opening names only cover so much
               depth), so this is what lets a position inherit its
               nearest ancestor's name instead of coming up empty. */
            async function buildOpeningToc() {
                const container = movesRoot.closest('.pgn-container');
                const mainlineCount = engine.state.moves.length;
                if (!container || !mainlineCount) return;

                let openings;
                try {
                    openings = await fetch('../../assets/eco-openings.json').then(r => r.json());
                } catch (e) {
                    return; // no network/asset — just skip the TOC rather than break the page
                }

                function nameForSans(sans) {
                    for (let len = sans.length; len > 0; len--) {
                        const name = openings[sans.slice(0, len).join(' ')];
                        if (name) return name;
                    }
                    return null;
                }

                /* One entry per (name, first move it's reached at).
                   `enter` jumps the board straight there — a plain
                   goTo() for a main-line entry, or the same
                   chain-of-enterVariation() replay the reading column's
                   own click handler above uses for a variation one, since
                   walk() below already resolved each entry's real
                   variationObj/fens/verbose/ancestor chain directly from
                   engine.state (no DOM round-trip needed here). */
                const toc = [];

                function walk(variationObj, startColumn, branchFEN, sansPrefix, depth, parentChain, inheritedName) {
                    const { fens, verbose } = replayMoves(branchFEN, variationObj.moves || []);
                    const chain = parentChain.concat([{ variationObj, fens, verbose, startColumn }]);

                    const sans = sansPrefix.slice();
                    let prevName = inheritedName;
                    (variationObj.moves || []).forEach((san, mi) => {
                        sans.push(san);
                        const name = nameForSans(sans);
                        if (name && name !== prevName) {
                            const ctx = fenMoveContext(fens[mi]);
                            toc.push({
                                name,
                                depth,
                                label: formatLabel(san, ctx.fullMoveNum, ctx.isBlack),
                                enter: () => enterOpeningChain(chain, mi + 1),
                            });
                        }
                        prevName = name;

                        const kids = variationObj.childrenByMove && variationObj.childrenByMove[mi];
                        if (kids) kids.forEach(kid => walk(kid, startColumn + mi, fens[mi], sans.slice(), depth + 1, chain, name));
                    });
                }

                const mainlineSans = [];
                let prevName = null;
                for (let p = 0; p < mainlineCount; p++) {
                    const nameBeforePly = prevName;
                    mainlineSans.push(engine.state.moves[p]);
                    const name = nameForSans(mainlineSans);
                    if (name && name !== prevName) {
                        const ctx = engine._moveContext(p);
                        toc.push({
                            name,
                            depth: 0,
                            label: formatLabel(engine.state.moves[p], ctx.fullMoveNum, ctx.isBlack),
                            enter: () => { engine.pause(); engine.goTo(p + 1); },
                        });
                    }
                    prevName = name;

                    const alts = engine.state.variations[p];
                    if (alts) alts.forEach(alt => walk(alt, p, engine.state.cache[p], mainlineSans.slice(0, p), 1, [], nameBeforePly));
                }

                if (!toc.length) return; // nothing in this PGN matched a named opening

                /* Renders the same `toc` array into any container — only
                   the ribbon's accordion uses this now, but kept as its
                   own function (rather than inlined below) since it used
                   to also render an always-in-the-page copy at the
                   bottom of the reading column, and splitting the "walk
                   the game and build the `toc` array" step above from
                   "render `toc` somewhere" made that a one-line change to
                   remove instead of a rewrite. */
                function renderTocEntries(listEl, onCollapse) {
                    toc.forEach(entry => {
                        const row = document.createElement('div');
                        row.className = 'pgn-study-toc-entry';
                        row.style.marginLeft = (entry.depth * 1.25) + 'rem';
                        const name = document.createElement('span');
                        name.className = 'pgn-study-toc-name';
                        name.textContent = entry.name;
                        const move = document.createElement('span');
                        move.className = 'pgn-study-toc-move';
                        move.textContent = entry.label;
                        row.appendChild(name);
                        row.appendChild(move);
                        row.addEventListener('click', () => {
                            entry.enter();
                            if (onCollapse) onCollapse();
                        });
                        listEl.appendChild(row);
                    });
                }

                const accordion = document.getElementById('pgnStudyTocAccordion');
                const accordionHeading = document.createElement('h3');
                accordionHeading.className = 'pgn-study-toc-heading';
                accordionHeading.textContent = 'Table of Contents';
                accordion.appendChild(accordionHeading);
                const accordionListEl = document.createElement('div');
                accordionListEl.className = 'pgn-study-toc-list';
                accordion.appendChild(accordionListEl);
                renderTocEntries(accordionListEl, () => accordion.classList.remove('open'));
            }

            /* Replays a TOC entry's own ancestor chain through
               enterVariation() one level at a time — same idea as the
               reading column's own click handler above (see its "A click
               can land inside a sub-...-sub-variation" comment), except
               every chain link here already carries its real, fully-
               parsed variationObj (walk() above sourced it directly from
               engine.state, no DOM round-trip needed) and its own
               precomputed fens/verbose. */
            function enterOpeningChain(chain, clickedIndex) {
                engine.pause();
                engine.exitVariation();
                engine.state.index = chain[0].startColumn + 1;

                chain.forEach((entry, i) => {
                    const isInnermost = i === chain.length - 1;
                    const index = isInnermost ? clickedIndex : (chain[i + 1].startColumn - entry.startColumn + 1);
                    engine.enterVariation(entry.fens, entry.variationObj.moveAnnotations, index, null, entry.verbose, entry.variationObj);
                });

                const innermost = chain[chain.length - 1];
                const move = clickedIndex > 0 ? innermost.verbose[clickedIndex - 1] : null;
                engine.showVariationPosition(innermost.fens[clickedIndex], null, move, null);
            }
        });