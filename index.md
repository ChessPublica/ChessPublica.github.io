---
layout: default
title: Home
---

{% for post in site.posts %}
📌 [{{ post.title }}]({{ post.url }})
{% endfor %}

![SatranChess](https://www.satranchess.com/images/banner.jpg)

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/@chessboard-element/chessboard-element@1.0.0/lib/chessboard-element.css" />
<script src="https://chessboardjs.com/js/chessboard-1.0.0.js"></script>
<script src="assets/jekyllchess.js"></script>
