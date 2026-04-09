---
layout: post
title: Puzzle element
---

Chess puzzles are handled by the `<puzzle>` element.

## Single puzzle

```html
<puzzle>
[FEN "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"]
[Orientation "Black"]

1... Qh4#
</puzzle>
```
<puzzle>
[FEN "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2"]
[Orientation "Black"]

1... Qh4#
</puzzle>

## Puzzle-pack from remote PGN file

```html
<puzzle src="/assets/pgn/sample-puzzle-pack.pgn"></puzzle>
```

<puzzle src="/assets/pgn/sample-puzzle-pack.pgn"></puzzle>

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
