---
layout: default
title: Home
---

{% for post in site.posts %}
📌 [{{ post.title }}]({{ post.url }})
{% endfor %}

<fen caption="Starting Position">
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
</fen>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js"></script>
<link rel="stylesheet" href="https://chessboardjs.com/css/chessboard-1.0.0.min.css" />
<script src="https://chessboardjs.com/js/chessboard-1.0.0.min.js"></script>
<script src="/assets/jekyllchess.js" defer></script>
<link rel="stylesheet" href="/assets/jekyllchess.css" />

<!--
![SatranChess](https://www.satranchess.com/images/banner.jpg)
-->
