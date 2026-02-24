---
layout: default
title: Home
---

<section class="hero">
  <h2>Spanish to English Literary Translation Archive</h2>
  <p>Featuring collaborative translations between faculty and students.</p>
  <a class="button" href="{{ '/archive/' | relative_url }}">Read Translations</a>
</section>

<section>
  <h3>Featured Works</h3>
  <div class="card-grid">
    {% for translation in site.translations %}
      {% if translation.featured == true %}
        <div class="card">
          <h4><a href="{{ translation.url | relative_url }}">{{ translation.title }}</a></h4>
          <p>{{ translation.original_author }}</p>
        </div>
      {% endif %}
    {% endfor %}
  </div>
</section>
