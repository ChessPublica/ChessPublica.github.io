---
layout: default
title: Home
---

{% for post in site.posts %}
📌 [{{ post.title }}]({{ post.url }})
{% endfor %}

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.12.0/chess.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.css">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<script type="module" src="/assets/index.js"></script>
<link rel="stylesheet" href="/assets/jekyllchess.css" />
<link rel="stylesheet" href="/assets/pgn-player/pgn-player.css" />
<script src="/assets/pgn-player/pgn-player.js"></script>
