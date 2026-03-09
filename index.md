---
layout: default
title: Home
---

{% for post in site.posts %}
📌 [{{ post.title }}]({{ post.url }})
{% endfor %}

![SatranChess](https://www.satranchess.com/images/banner.jpg)
