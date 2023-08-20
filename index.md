{% for tag in site.tags %}
{{ tag[0] }}

    {% for post in tag[1] %}
    {{ post.date | date: "%B %Y" }} - {{ post.title }}
    {% endfor %} 

{% endfor %} 
