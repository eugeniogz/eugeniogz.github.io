---
layout: page
title: Blog Archive
---

<ul>
  {% for post in site.posts %}
    <li><a href="{{ post.url }}">{{ post.date | date: "%B %Y" }} - {{ post.title }}</a></li>
    <p>{{ post.content }}</p>
  {% endfor %}
</ul>
