---
layout: post
title: Complete Reference
---

Complete Element Reference

This document demonstrates **every custom HTML element** provided, along with all supported usage patterns.

---

## Table of Contents

1. [`<fen>`](#1-fen--static-board-from-fen-string)
2. [`<pgn>`](#2-pgn--annotated-game-viewer)
3. [`<pgn-player>`](#3-pgn-player--interactive-video-style-game-player)
4. [`<puzzle>`](#4-puzzle--single-interactive-puzzle)
5. [Setup & Dependencies](#5-setup--dependencies)

---

## 1. `<fen>` — Static Board from FEN String

Renders a non-interactive chessboard diagram from a FEN string.

### Basic Usage

```html
<fen>rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</fen>
```
<fen>rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</fen>

### With Caption

```html
<fen caption="Starting Position">rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</fen>
```
<fen caption="Starting Position">rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</fen>

or

```html
<fen>
[White "..."]
[Black "..."]
[Event "..."]
[Date "..."]
[FEN "..."]
[Caption "..."]
[Orientation "..."]
[FirstMoveAuto "..."]

1. ...
</fen>
```
Displays:
- a title with player names, event, and date,
- a static FEN diagram in desired board orientation,
- a caption below the diagram,
- the first move played if `[FirstMoveAuto]` is set to `true`.

---

## 2. `<pgn>` — Annotated Game Viewer

Renders a complete annotated game with move numbers, comments, variations, NAGs, arrow/square annotations, and inline diagrams.

### Inline PGN

```html
<pgn>
[Event "..."]
[Site "..."]
[Date "..."]
[White "..."]
[Black "..."]
[Result "..."]
1. ...
</pgn>
```

or

### Load from File

```html
<pgn src="/assets/pgn/sample-game.pgn"></pgn>
```

<pgn src="/assets/pgn/sample-game.pgn"></pgn>

### Supported PGN Features

| Feature | Syntax | Example |
|---------|--------|---------|
| Comments | `{text}` | `{A strong move.}` |
| Diagrams | `[D]` in comment | Renders a diagram at that position |
| Variations | `(moves)` | `(14. Be2 Nf6)` |
| NAGs | `$1` – `$6` | `$1` → `!`, `$3` → `!!` |
| Arrow annotations | `[%cal Rf1f7]` | Colored arrows |
| Square highlights | `[%csl Gc5,Rd4]` | Colored square markers |
| Results | `1-0`, `0-1`, `1/2-1/2`, `*` | Game termination |

---

## 3. `<pgn-player>` — Interactive Video-Style Game Player

Renders a video-style chess game player with play/pause controls, an eval bar, clickable move list, comments, variations, move quality glyphs, and board annotations. Supports keyboard navigation and gesture controls.

### Inline PGN

```html
<pgn-player>
[Event "..."]
[Site "..."]
[Date "..."]
[White "..."]
[Black "..."]
[Result "..."]
1. ...
</pgn-player>
```
or

### Load from File

```html
<pgn-player src="/assets/pgn/sample-game.pgn"></pgn-player>
```

<pgn-player src="/assets/pgn/sample-game.pgn"></pgn-player>

### Features

- **Play/Pause**: Click the board or press Space to toggle playback
- **Keyboard navigation**: ← (prev), → (next); also works inside variations
- **Double-tap**: Left/right halves of the board to skip ±10 moves
- **Eval bar**: Displays evaluation scores from PGN `[%eval]` annotations
- **Move list**: Horizontal scrollable list; click any move to jump to that position
- **Comments & Variations**: Displayed below the board with continue button
- **Move quality glyphs**: `!`, `?`, `!!`, `??`, `!?`, `?!` shown as badges on the board
- **Board annotations**: Arrow `[%cal]` and square `[%csl]` highlights
- **Settings toolbar**: Flip board, adjust playback speed (0.5x/1x/2x), download PGN
- **Multiple players**: Each `<pgn-player>` on a page gets its own independent engine

---

## 4. `<puzzle>` — Single Interactive Puzzle

Renders a drag-and-drop puzzle. The user must find the correct sequence of moves.

### Inline FEN in PGN header

```html
<puzzle>
[FEN "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1"]

1. Qxf7#
</puzzle>
```
<puzzle>
[FEN "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1"]

1. Qxf7#
</puzzle>

### Attributes / PGN Headers

| Header | Required | Description |
|--------|----------|-------------|
| `FEN` | ✅ | Starting position |
| `FirstMoveAuto` | ❌ | `"true"` to auto-play first move |
| `Orientation` | ❌ | `"white"` or `"black"` |

---

## 5. Setup & Dependencies

### Required External Libraries

Load these **before** JekyllChess scripts:

```html
<!-- jQuery (required by chessboard.js) -->
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>

<!-- chess.js (move validation engine) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js"></script>

<!-- chessboard.js (board rendering) -->
<link rel="stylesheet" href="https://unpkg.com/@chessboard-element/chessboard-element@1.0.0/lib/chessboard-element.css" />
<script src="https://chessboardjs.com/js/chessboard-1.0.0.js"></script>

<!-- Material Icons (required by pgn-player) -->
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
```

### JekyllChess Files

```html
<!-- JekyllChess CSS (required) -->
<link rel="stylesheet" href="jekyllchess.css" />

<!-- JekyllChess JS (all-in-one) -->
<script src="jekyllchess.js"></script>

<!-- PGN Player (required for <pgn-player> element) -->
<link rel="stylesheet" href="pgn-player/pgn-player.css" />
<script src="pgn-player/pgn-player.js"></script>
```

## Quick Reference

| Element | Purpose | Interactive | Source |
|---------|---------|-------------|--------|
| `<fen>` | Static diagram with circle and arrow annotations | ❌ | Inline FEN |
| `<pgn>` | Annotated game with static diagrams | ❌ | Inline or `src` |
| `<pgn-player>` | Video-style PGN player | ✅ | Inline or `src` |
| `<puzzle>` | Single puzzle or puzzle-pack | ✅ | Inline or `src` |

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.12.0/chess.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.css">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<script type="module" src="/assets/index.js"></script>
<link rel="stylesheet" href="/assets/jekyllchess.css" />
<link rel="stylesheet" href="/assets/pgn-player/pgn-player.css" />
<script src="/assets/pgn-player/pgn-player.js"></script>
