---
layout: default
title: Home
---

*{{ site.description }}*

**ChessPublica** brings *chess awareness* into HTML and [markdown](https://www.markdownguide.org/). It's a minimal publishing engine for chess content, built on [Chess.js](https://github.com/jhlywa/chess.js/) and [Chessboard.js](https://chessboardjs.com/). It transforms raw chess notation—[FEN](https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation) and [PGN](https://en.wikipedia.org/wiki/Portable_Game_Notation)—into figurines, diagrams, puzzles, studies, and fully playable, interactive content directly in the browser.

## Sample content:

<puzzle>
[Event "Study by Richard Réti, Münchner Neueste Nachrichten, 1928"]
[FEN "8/5K2/8/4pk2/4R3/8/8/8 w - - 0 1"]
[Orientation "White"]
[Caption "🏳️ White to move and win."]

1. Re2! e4 ( 1. Re1? { 💡 Re1? a seemingly sensible move would be a mistake and black could hold the position after: } 1... e4 2. Ke7 Ke5 3. Kd7 Kd5 { and black gains the opposition. = 🤝 } ) 2. Re1! Ke5 { 🔑 Losing a move with 1. Re2! and 2. Re1! is the key! } 3. Ke7 Kd4 { 🎯 White can keep the opposition to win. } 4. Ke6 Kd3 5. Ke5 e3 6. Kf4 e2 7. Kf3 { Black will lose the pawn, and the game. 🪦}
</puzzle>

## 🧰 Elements

{% for post in site.posts %}
📌 [{{ post.title }}]({{ post.url }})
{% endfor %}

<style>h1 a, h1 a:active, h1 a:hover {color:black;text-decoration:none;cursor:pointer;}</style>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.12.0/chess.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.css">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">

<script type="module" src="/assets/ChessPublica.js"></script>
<link rel="stylesheet" href="/assets/ChessPublica.css" />