---
layout: post
title: Complete Reference
permalink: /reference.html
---

## ChessPublica Complete Element Reference

This document demonstrates **every custom HTML element** provided by **ChessPublica**, along with all supported usage patterns.

---

## 📋 Table of Contents

1. [`<fen>`](#1-fen--static-board-from-fen-string)
2. [`<puzzle>`](#2-puzzle--single-interactive-puzzle)
3. [`<pgn>`](#3-pgn--annotated-game-viewer)
4. [`<pgn-player>`](#4-pgn-player--interactive-video-style-game-player) 
5. [Setup & Dependencies](#5-setup--dependencies)

---

## 1. 🔲 `<fen>` — Static Diagram from FEN String

Renders a non-interactive chessboard diagram from a FEN string.

### Basic Usage

```html
<fen>rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</fen>
```
<fen>rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</fen>

or

```html
<fen>
[FEN "..."]
[Orientation "..."]
[Caption "..."]
</fen>
```
displays:
- a static FEN diagram in the specified board orientation,
- a caption below the diagram.

<fen>
[FEN "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"]
[Orientation "Black"]
[Caption "Sicilian Defence"]
</fen>

---

## 2. 🧩 `<puzzle>` — Single Interactive Puzzle

Renders a drag-and-drop puzzle. The user must find the correct sequence of moves.

### Inline FEN

```html
<puzzle>
[FEN "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1"]

1. Qxf7#
</puzzle>
```

or

### Inline PGN Headers

```html
<puzzle>
[White "..."]
[Black "..."]
[Event "..."]
[Date "..."]
[FEN "..."]
[Orientation "..."]
[Caption "..."]
[FirstMoveAuto "..."]

1. ...
</puzzle>
```
displays:
- a puzzle title with player names, event, and date,
- a draggable puzzle diagram in specified board orientation,
- a caption below the diagram,
- the first move on the board if `FirstMoveAuto` is set to `true`.

<puzzle>
[White "White"]
[Black "Black"]
[Event "Test"]
[Date "2026"]
[FEN "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3"]
[Orientation "White"]
[Caption "Mate in one"]
[FirstMoveAuto "true"]

3... Nf6?? 4. Qh5#
</puzzle>

or

### Load from File

```html
<puzzle src="/assets/pgn/sample-puzzle-pack.pgn"></puzzle>
```

<puzzle src="/assets/pgn/sample-puzzle-pack.pgn"></puzzle>

### Attributes

| Header | Required | Description |
|--------|----------|-------------|
| `FEN` | ✅ | Position |
| `Orientation` | ❌ | `"white"` or `"black"` |
| `FirstMoveAuto` | ❌ | `"true"` to auto-play first move |

---

## 3. `<pgn>` — Annotated Game for Blog Posts

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

### Features

| Feature | Syntax | Example |
|---------|--------|---------|
| Comments | `{text}` | `{A strong move.}` |
| Variations | `(moves)` | `(14. Be2 Nf6)` |
| NAGs | `$1` – `$6` | `$1` → `!`, `$3` → `!!` |
| Arrow annotations | `[%cal Rf1f7]` | Colored arrows |
| Square highlights | `[%csl Gc5,Rd4]` | Colored square markers |
| Results | `1-0`, `0-1`, `1/2-1/2`, `*` | Game termination |
| Diagrams | `[D]` in comment | Renders a diagram at that position |
| | `[%cal]` and `[%csl]` tags in comment | Renders a diagram at that position |

---

## 4. ⚔️ `<pgn-player>` — Interactive Video-Style Game Player

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

## 5. Setup & Dependencies

### ChessPublica Setup

Setup requires only two lines of code:

```html
<!-- ChessPublica JS (all-in-one JavaScript code, includes <fen>, <puzzle>, <pgn>, and <pgn-player> elements.) -->
<script src="ChessPublica.js"></script>

<!-- ChessPublica CSS (required) -->
<link rel="stylesheet" href="ChessPublica.css" />
```
### Required External Libraries

All required external libraries [jQuery](https://jquery.com/), [Chess.js](https://github.com/jhlywa/chess.js/), [Chessboard.js](https://chessboardjs.com/), and [Google Material Icons](https://fonts.google.com/icons) are automatically loaded.

---

## Quick Reference

| Element | Purpose | Interactive | Source |
|---------|---------|-------------|--------|
| `<fen>` | Static diagram with annotations | ❌ | Inline |
| `<puzzle>` | Single puzzle or puzzle-pack | ✅ | Inline or `src` |
| `<pgn>` | Annotated game with diagrams | ❌ | Inline or `src` |
| `<pgn-player>` | Video-style PGN player | ✅ | Inline or `src` |

---

<style>
h1 a {color:black;text-decoration:none;}
h1 a:active {color:black;text-decoration:none;cursor:pointer;}
h1 a:hover {color:black;text-decoration:none;cursor:pointer;}
</style>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.12.0/chess.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.css">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">

<script type="module" src="/assets/ChessPublica.js"></script>
<link rel="stylesheet" href="/assets/ChessPublica.css" />
<script src="/assets/pgn-player.js"></script>