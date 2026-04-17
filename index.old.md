---
layout: home
title: Home
---

**ChessPublica** brings *chess awareness* into HTML and [markdown](https://www.markdownguide.org/). It's a minimal publishing engine for chess content, built on [Chess.js](https://github.com/jhlywa/chess.js/) and [Chessboard.js](https://chessboardjs.com/). It transforms raw chess notation—[FEN](https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation) and [PGN](https://en.wikipedia.org/wiki/Portable_Game_Notation)—into figurines, diagrams, puzzles, studies, and fully playable, interactive content directly in the browser.

## Sample content:

<puzzle>
[Event "Study by Richard Réti, Münchner Neueste Nachrichten, 1928"]
[FEN "8/5K2/8/4pk2/4R3/8/8/8 w - - 0 1"]
[Orientation "White"]
[Caption "🏳️ White to move and win."]

1. Re2! e4 ( 1. Re1? { 🚫 Wrong move<br>A seemingly sensible move, Re1? would be a sad mistake. Black maintains the opposition after } 1... e4 2. Ke7 Ke5 3. Kd7 Kd5 { and manages to draw. 🤝 Please try again. } ) 2. Re1! Ke5 { Losing a move with 1. Re2! and 2. Re1! is the key! 🔑 } 3. Ke7 Kd4 {[%cal Ge7e6]} 4. Ke6 Kd3 {[%cal Ge6e5]} 5. Ke5 e3 {[%cal Ge5f4]} 6. Kf4 e2 {[%cal Gf4f3]} 7. Kf3 { Black will lose the pawn, and the game. 🪦}
</puzzle>

## Complete Element Reference

This document demonstrates **every custom HTML element** provided by **ChessPublica**, along with all supported usage patterns.

## 📋 Table of Contents

1. [`<fen>`](#1-fen--static-board-from-fen-string)
2. [`<puzzle>`](#2-puzzle--single-interactive-puzzle)
3. [`<pgn>`](#3-pgn--annotated-game-viewer)
4. [`<pgn-player>`](#4-pgn-player--interactive-video-style-game-player) 
5. [Setup & Dependencies](#5-setup--dependencies)

## 1. 🔲 `<fen>` — Static Diagram from FEN String

Renders a non-interactive chessboard diagram from a FEN string.

## Single board diagram

```html
<fen>rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</fen>
```

<fen>rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</fen>

## Diagram with caption

```html
<fen>
[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]
[Caption "Starting position"]
</fen>
```

<fen>
[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]
[Caption "Starting position"]
</fen>

## Board orientation

```html
<fen>
[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]
[Orientation "Black"]
</fen>
```

<fen>
[FEN "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]
[Orientation "Black"]
</fen>

## 2. 🧩 `<puzzle>` — Single Interactive Puzzle

Renders a drag-and-drop puzzle. The user must find the correct sequence of moves.

## Single puzzle

```html
<puzzle>
[FEN "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"]
[Orientation "Black"]
[Caption "Mate in one"]

1... Qh4#
</puzzle>
```
<puzzle>
[FEN "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"]
[Orientation "Black"]
[Caption "Mate in one"]

1... Qh4#
</puzzle>

## Puzzle-pack from remote PGN file

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

## 3. `<pgn>` — Annotated Game for Blog Posts

Renders a complete annotated game with move numbers, comments, variations, NAGs, arrow/square annotations, and inline diagrams.

```html
<pgn>
[Event "Event"]
[Site "Site"]
[Date "2026"]
[White "White"]
[Black "Black"]
[Result "0-1"]

1. g4?! { An eccentric opening (Grob’s Attack). It weakens the kingside badly, especially the diagonal e1–h4, and does little for development or king safety. } 1... e5! { Principled and strong. Black takes the center and immediately prepares to exploit the weakened diagonal. } 2. f3?? {[D]} { A blunder of the highest order. This move:<br>📌 Opens the e1–h4 diagonal completely<br>📌 Weakens the king further<br>📌 Blocks natural knight development: Nf3 } 2... Qh4# { Checkmate. The king on e1 has no escape squares, no pieces can block, and nothing can capture the queen. }
</pgn>
```

<pgn>
[Event "Event"]
[Site "Site"]
[Date "2026"]
[White "White"]
[Black "Black"]
[Result "0-1"]

1. g4?! { An eccentric opening (Grob’s Attack). It weakens the kingside badly, especially the diagonal e1–h4, and does little for development or king safety. } 1... e5! { Principled and strong. Black takes the center and immediately prepares to exploit the weakened diagonal. } 2. f3?? {[D]} { A blunder of the highest order. This move:<br>📌 Opens the e1–h4 diagonal completely<br>📌 Weakens the king further<br>📌 Blocks natural knight development: Nf3 } 2... Qh4# { Checkmate. The king on e1 has no escape squares, no pieces can block, and nothing can capture the queen. }
</pgn>


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

## 4. ⚔️ `<pgn-player>` — Interactive Video-Style Game Player

Renders a video-style chess game player with play/pause controls, an eval bar, clickable move list, comments, variations, move quality glyphs, and board annotations. Supports keyboard navigation and gesture controls.

```html
<pgn-player>
[Event "Event"]
[Site "Site"]
[Date "2026"]
[White "White"]
[Black "Black"]
[Result "0-1"]

1. g4?! {An eccentric opening (Grob’s Attack). It weakens the kingside badly, especially the diagonal e1–h4, and does little for development or king safety.} 1... e5! {Principled and strong. Black takes the center and immediately prepares to exploit the weakened diagonal.} 2. f3?? {[D]} {A blunder of the highest order. This move:} {📌 Opens the e1–h4 diagonal completely} {📌 Weakens the king further} {📌 Blocks natural knight development: Nf3} 2... Qh4# {Checkmate. The king on e1 has no escape squares, no pieces can block, and nothing can capture the queen.}
</pgn-player>
```

<pgn-player>
[Event "Event"]
[Site "Site"]
[Date "2026"]
[White "White"]
[Black "Black"]
[Result "0-1"]

1. g4?! {An eccentric opening (Grob’s Attack). It weakens the kingside badly, especially the diagonal e1–h4, and does little for development or king safety.} 1... e5! {Principled and strong. Black takes the center and immediately prepares to exploit the weakened diagonal.} 2. f3?? {[D]} {A blunder of the highest order. This move:} {📌 Opens the e1–h4 diagonal completely} {📌 Weakens the king further} {📌 Blocks natural knight development: Nf3} 2... Qh4# {Checkmate. The king on e1 has no escape squares, no pieces can block, and nothing can capture the queen.}
</pgn-player>


### Load from File

```html
<pgn-player src="/assets/pgn/sample-game.pgn"></pgn-player>
```

<pgn-player src="/assets/pgn/sample-game.pgn"></pgn-player>

### Load from Remote URL (e.g. Lichess API URL)

```html
<pgn-player src="https://lichess.org/api/study/97di6JjX/Jzyakrf4.pgn"></pgn-player>
```

<pgn-player src="https://lichess.org/api/study/97di6JjX/Jzyakrf4.pgn"></pgn-player>

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

## Quick Reference

| Element | Purpose | Interactive | Source |
|---------|---------|-------------|--------|
| `<fen>` | Static diagram with annotations | ❌ | Inline |
| `<puzzle>` | Single puzzle or puzzle-pack | ✅ | Inline or `src` |
| `<pgn>` | Annotated game with diagrams | ❌ | Inline or `src` |
| `<pgn-player>` | Video-style PGN player | ✅ | Inline or `src` |

## 5. Setup & Dependencies

### Setup

Setup requires only two lines of code:

```html
<script src="https://cdn.jsdelivr.net/gh/ChessPublica/ChessPublica.github.io@main/dist/ChessPublica.all.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/ChessPublica/ChessPublica.github.io@main/dist/ChessPublica.all.min.css">
```

### Required External Libraries

Required external libraries [jQuery](https://jquery.com/), [Chess.js](https://github.com/jhlywa/chess.js/), and [Chessboard.js](https://chessboardjs.com/) are automatically loaded.

---

<style>h1 a, h1 a:active, h1 a:hover {color:black;text-decoration:none;cursor:pointer;}</style>

<script src="https://cdn.jsdelivr.net/gh/ChessPublica/ChessPublica.github.io@main/dist/ChessPublica.all.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/ChessPublica/ChessPublica.github.io@main/dist/ChessPublica.all.min.css">

<!--
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.12.0/chess.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.css">

<script type="module" src="/assets/ChessPublica.js"></script>
<link rel="stylesheet" href="/assets/ChessPublica.css" />
-->
