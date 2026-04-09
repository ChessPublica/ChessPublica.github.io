---
layout: default
title: Home
---

*{{ site.description }}*

## ♟️ ChessPublica: Markdown + Chess Awareness

ChessPublica is a markdown-friendly publishing engine for chess content, built on [Chess.js](https://github.com/jhlywa/chess.js/) and [Chessboard.js](https://chessboardjs.com/).

It transforms raw chess notation—[FEN](https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation) and [PGN](https://en.wikipedia.org/wiki/Portable_Game_Notation)—into figurines, diagrams, puzzles, studies, and fully playable content, directly in the browser.

## Elements

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
