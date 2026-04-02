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
3. [`<puzzle>`](#3-puzzle--single-interactive-puzzle)
4. [Setup & Dependencies](#4-setup--dependencies)

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

### Famous Positions

```html
<!-- Lucena Position (Rook Endgame) -->
<fen caption="Lucena Position — White to play and win">1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1</fen>

<!-- Philidor Position -->
<fen caption="Philidor Position — Black draws">8/8/8/4k3/R7/4K3/4P3/3r4 w - - 0 1</fen>

<!-- Sicilian Dragon -->
<fen caption="Sicilian Dragon — Yugoslav Attack">r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 0 9</fen>
```
<fen caption="Lucena Position — White to play and win">1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1</fen>
<fen caption="Philidor Position — Black draws">8/8/8/4k3/R7/4K3/4P3/3r4 w - - 0 1</fen>
<fen caption="Sicilian Dragon — Yugoslav Attack">r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 0 9</fen>

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
<pgn src="./data/sample-game.pgn"></pgn>
```

<pgn src="./assets/pgn/sample-game.pgn"></pgn>

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

## 3. `<puzzle>` — Single Interactive Puzzle

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

## 4. Setup & Dependencies

### Required External Libraries

Load these **before** `jekyllchess.js`:

```html
<!-- jQuery (required by chessboard.js) -->
<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>

<!-- chess.js (move validation engine) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js"></script>

<!-- chessboard.js (board rendering) -->
<link rel="stylesheet" href="https://unpkg.com/@chessboard-element/chessboard-element@1.0.0/lib/chessboard-element.css" />
<script src="https://chessboardjs.com/js/chessboard-1.0.0.js"></script>
```

### JekyllChess Files

```html
<!-- JekyllChess CSS (required) -->
<link rel="stylesheet" href="jekyllchess.css" />

<!-- JekyllChess JS (all-in-one) -->
<script src="jekyllchess.js"></script>
```

## Quick Reference

| Element | Purpose | Interactive | Source |
|---------|---------|-------------|--------|
| `<fen>` | Static board | ❌ | Inline FEN |
| `<pgn>` | Annotated game | ❌ | Inline or `src` |
| `<puzzle>` | Single puzzle | ✅ Drag & drop | Inline PGN |
