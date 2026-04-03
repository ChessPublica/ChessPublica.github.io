---
layout: default
title: Home
---

*{{ site.description }}*

## 📖 Posts

{% for post in site.posts %}
📌 [{{ post.title }}]({{ post.url }})
{% endfor %}

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

<script type="module" src="/assets/PublishChess.js"></script>
<link rel="stylesheet" href="/assets/PublishChess.css" />
<script src="/assets/pgn-player.js"></script>
