---
layout: default
title: Home
---

{% for post in site.posts %}
📌 [{{ post.title }}]({{ post.url }})
{% endfor %}

<pgn>
[White "White test"]
[Black "Black test"]
[Event "Event test"]
[Site "Site test"]
[Date "2000.01.01"]
[Round "1"]
[Result "1-0"]

1. e4 { [%cal Gd1h5,Gf1c4] } 1... e5 2. Nf3 Nc6 3. Bb5 { Ruy Lopez Opening } 3... Nf6 { Berlin Defense } { [%cal Gf6e4] [%csl Re4] }
</pgn>

<fen caption="Starting Position">
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
</fen>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.12.0/chess.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.css">
<script src="/assets/jekyllchess.js" defer></script>
<link rel="stylesheet" href="/assets/jekyllchess.css" />

<!-- ![SatranChess](https://www.satranchess.com/images/banner.jpg) -->
