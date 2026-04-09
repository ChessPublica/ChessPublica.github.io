---
layout: post
title: Annotated Games
---

ChessPublica `<pgn>` element displays the game with comments, variations, annotations, and diagrams.

```html
<pgn>
[Event "Event"]
[Site "Site"]
[Date "2026"]
[White "White"]
[Black "Black"]
[Result "0-1"]

1. g4?! {An eccentric opening (Grob’s Attack). It weakens the kingside badly, especially the diagonal e1–h4, and does little for development or king safety.} 1... e5! {Principled and strong. Black takes the center and immediately prepares to exploit the weakened diagonal.} 2. f3?? {[D]} {A blunder of the highest order. This move:} {📌 Opens the e1–h4 diagonal completely} {📌 Weakens the king further} {📌 Blocks natural knight development: Nf3} 2... Qh4# {Checkmate. The king on e1 has no escape squares, no pieces can block, and nothing can capture the queen.}
</pgn>
```

<pgn>
[Event "Event"]
[Site "Site"]
[Date "2026"]
[White "White"]
[Black "Black"]
[Result "0-1"]

1. g4?! {An eccentric opening (Grob’s Attack). It weakens the kingside badly, especially the diagonal e1–h4, and does little for development or king safety.} 1... e5! {Principled and strong. Black takes the center and immediately prepares to exploit the weakened diagonal.} 2. f3?? {[D]} {A blunder of the highest order. This move:} {📌 Opens the e1–h4 diagonal completely} {📌 Weakens the king further} {📌 Blocks natural knight development: Nf3} 2... Qh4# {Checkmate. The king on e1 has no escape squares, no pieces can block, and nothing can capture the queen.}
</pgn>


### Load from File

```html
<pgn src="/assets/pgn/sample-game.pgn"></pgn>
```

<pgn src="/assets/pgn/sample-game.pgn"></pgn>

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