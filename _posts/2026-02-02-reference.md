---
layout: post
title: Complete Reference
---

# JekyllChess — Complete Element Reference

This document demonstrates **every custom HTML element** provided by JekyllChess, along with all supported usage patterns.

---

## Table of Contents

1. [`<fen>`](#1-fen--static-board-from-fen-string)
2. [`<pgn>`](#2-pgn--annotated-game-viewer)
3. [`<pgn-player>`](#3-pgn-player--interactive-video-style-game-player)
4. [`<puzzle>`](#4-puzzle--single-interactive-puzzle)
5. [Setup & Dependencies](#5-setup--dependencies)

---

## 1. `<fen>` — Static Board from FEN String

Renders a non-interactive chessboard from a FEN position string.

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

### Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| (text content) | ✅ | FEN string |
| `caption` | ❌ | Caption text below the board |

---

## 2. `<pgn>` — Annotated Game Viewer

Renders a complete annotated game with move numbers, comments, variations, NAGs, arrow/square annotations, and inline diagrams.

### Inline PGN

```html
<pgn>
[Event "World Championship"]
[Site "Reykjavik"]
[Date "1972.07.23"]
[White "Fischer, Robert J."]
[Black "Spassky, Boris V."]
[Result "1-0"]

1. c4 {The English Opening — a surprise from Fischer.} e6 2. Nf3 d5
3. d4 Nf6 4. Nc3 Be7 5. Bg5 O-O 6. e3 h6 7. Bh4 b6
{[%cal Gc8b7] Black prepares to fianchetto the bishop.}
8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6
12. Qa4 c5 {[%csl Gc5,Gd5] Black has a strong pawn center.}
13. Qa3 Rc8 14. Bb5 $1 {A strong move.}
(14. Be2 {was the safe alternative.})
a6 15. dxc5 bxc5 16. O-O Ra7 17. Be2 Nd7 18. Nd4 Qf8
19. Nxe6 fxe6 20. e4 d4 21. f4 Qe7 22. e5 Rb8 23. Bc4 Kh8
24. Qh3 Nf8 25. b3 a5
26. f5 $3 {[%cal Rf5e6,Rf5f6] A brilliant pawn sacrifice!}
exf5 27. Rxf5 Nh7 28. Rcf1 Qd8 29. Qg3 Re7 30. h4 Rbb7
31. e6 Rbc7 32. Qe5 Qe8 33. a4 Qd8 34. R1f2 Qe8 35. R2f3 Qd8
36. Bd3 Qe8 37. Qe4 Nf6 38. Rxf6 gxf6 39. Rxf6 Kg8
40. Bc4 Kh8 41. Qf4 1-0
</pgn>
```
<pgn>
[Event "World Championship"]
[Site "Reykjavik"]
[Date "1972.07.23"]
[White "Fischer, Robert J."]
[Black "Spassky, Boris V."]
[Result "1-0"]

1. c4 {The English Opening — a surprise from Fischer.} e6 2. Nf3 d5
3. d4 Nf6 4. Nc3 Be7 5. Bg5 O-O 6. e3 h6 7. Bh4 b6
{[%cal Gc8b7] Black prepares to fianchetto the bishop.}
8. cxd5 Nxd5 9. Bxe7 Qxe7 10. Nxd5 exd5 11. Rc1 Be6
12. Qa4 c5 {[%csl Gc5,Gd5] Black has a strong pawn center.}
13. Qa3 Rc8 14. Bb5 $1 {A strong move.}
(14. Be2 {was the safe alternative.})
a6 15. dxc5 bxc5 16. O-O Ra7 17. Be2 Nd7 18. Nd4 Qf8
19. Nxe6 fxe6 20. e4 d4 21. f4 Qe7 22. e5 Rb8 23. Bc4 Kh8
24. Qh3 Nf8 25. b3 a5
26. f5 $3 {[%cal Rf5e6,Rf5f6] A brilliant pawn sacrifice!}
exf5 27. Rxf5 Nh7 28. Rcf1 Qd8 29. Qg3 Re7 30. h4 Rbb7
31. e6 Rbc7 32. Qe5 Qe8 33. a4 Qd8 34. R1f2 Qe8 35. R2f3 Qd8
36. Bd3 Qe8 37. Qe4 Nf6 38. Rxf6 gxf6 39. Rxf6 Kg8
40. Bc4 Kh8 41. Qf4 1-0
</pgn>

### Load from File

```html
<pgn src="/assets/pgn/sample-game.pgn"></pgn>
```

<pgn src="/assets/pgn/sample-game.pgn"></pgn>

### Supported PGN Features

| Feature | Syntax | Example |
|---------|--------|---------|
| Comments | `{text}` | `{A strong move.}` |
| Variations | `(moves)` | `(14. Be2 Nf6)` |
| NAGs | `$1` – `$6` | `$1` → `!`, `$3` → `!!` |
| Arrow annotations | `[%cal Rf1f7]` | Green/Red/Yellow/Blue arrows |
| Square highlights | `[%csl Gc5,Rd4]` | Colored square markers |
| Diagrams | `[D]` in comment | Renders board at that position |
| Results | `1-0`, `0-1`, `1/2-1/2`, `*` | Game termination |

### NAG Reference

| NAG | Symbol | Meaning |
|-----|--------|---------|
| `$1` | `!` | Good move |
| `$2` | `?` | Mistake |
| `$3` | `!!` | Brilliant move |
| `$4` | `??` | Blunder |
| `$5` | `!?` | Interesting move |
| `$6` | `?!` | Dubious move |

### Arrow/Square Color Codes

| Code | Color |
|------|-------|
| `G` | Green |
| `R` | Red |
| `Y` | Yellow |
| `B` | Blue |

---

## 3. `<pgn-player>` — Interactive Video-Style Game Player

Renders a video-style chess game player with play/pause controls, an eval bar, clickable move list, comments, variations, move quality glyphs, and board annotations. Supports keyboard navigation and gesture controls.

### Load from File

```html
<pgn-player src="/assets/pgn/sample-player.pgn"></pgn-player>
```

<pgn-player src="/assets/pgn/sample-player.pgn"></pgn-player>

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

### Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `src` | ✅ | URL to a PGN file |

### Supported PGN Features

| Feature | Syntax | Example |
|---------|--------|---------|
| Comments | `{text}` | `{A strong move.}` |
| Variations | `(moves)` | `(7. Nc2 Bd3)` |
| NAGs | `$1` – `$6` or `!?` suffixes | `$3` → `!!`, `Nd5!` |
| Eval scores | `[%eval 0.5]` or `[%eval #3]` | Displayed in eval bar |
| Arrow annotations | `[%cal Rf1f7]` | Colored arrows on board |
| Square highlights | `[%csl Gc5,Rd4]` | Colored square markers |

---

## 4. `<puzzle>` — Single Interactive Puzzle

Renders a drag-and-drop puzzle. The user must find the correct sequence of moves.

### PGN Header Format

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

### With Auto First Move

When `FirstMoveAuto` is `"true"`, the engine plays the first move automatically, and the user solves from the second move onward. This is useful for puzzles where the opponent makes a move first.

```html
<puzzle>
[FEN "r2qk2r/ppp2ppp/2n1bn2/3pp3/2B1P1b1/3P1N2/PPP2PPP/RNBQ1RK1 w kq - 0 6"]
[FirstMoveAuto "true"]

6. Bxf7+ Kxf7 7. Ng5+ Ke8 8. Qxg4
</puzzle>
```

<puzzle>
[FEN "r2qk2r/ppp2ppp/2n1bn2/3pp3/2B1P1b1/3P1N2/PPP2PPP/RNBQ1RK1 w kq - 0 6"]
[FirstMoveAuto "true"]

6. Bxf7+ Kxf7 7. Ng5+ Ke8 8. Qxg4
</puzzle>

### With Orientation Control

Force the board to show from Black's perspective:

```html
<puzzle>
[FEN "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"]
[Orientation "black"]

2... Qh4#
</puzzle>
```

<puzzle>
[FEN "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"]
[Orientation "black"]

2... Qh4#
</puzzle>

### Attributes / Headers

| Header | Required | Description |
|--------|----------|-------------|
| `FEN` | ✅ | Starting position |
| `FirstMoveAuto` | ❌ | `"true"` to auto-play first move |
| `Orientation` | ❌ | `"white"` or `"black"` |

### Behavior

- **Correct move**: Green flash, opponent auto-replies
- **Wrong move**: Board shakes, piece snaps back
- **Solved**: Green glow, click to reset

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
| `<fen>` | Static board | ❌ | Inline FEN |
| `<pgn>` | Annotated game | ❌ | Inline or `src` |
| `<pgn-player>` | Video-style player | ✅ Play/pause/keyboard | `src` |
| `<puzzle>` | Single puzzle | ✅ Drag & drop | Inline PGN |

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.12.0/chess.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.css">
<script type="module" src="/assets/index.js"></script>
<link rel="stylesheet" href="/assets/jekyllchess.css" />
