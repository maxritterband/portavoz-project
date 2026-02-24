---
layout: default
title: Archive
permalink: /archive/
---

<h2>Translation Archive</h2>

<div class="filters">
  <select id="yearFilter">
    <option value="all">All Years</option>
    {% assign years = site.translations | map: "year" | uniq %}
    {% for year in years %}
      <option value="{{ year }}">{{ year }}</option>
    {% endfor %}
  </select>

  <select id="statusFilter">
    <option value="all">All Status</option>
    <option value="published">Published</option>
    <option value="unpublished">Unpublished</option>
  </select>
</div>

<div class="card-grid" id="translationGrid">
  {% for translation in site.translations %}
  <div class="card"
       data-year="{{ translation.year }}"
       data-status="{{ translation.status }}">
    <h4>
      <a href="{{ translation.url | relative_url }}">
        {{ translation.title }}
      </a>
    </h4>
    <p>{{ translation.original_author }}</p>
    <span class="badge">{{ translation.status }}</span>
  </div>
  {% endfor %}
</div>

<script src="{{ '/assets/filter.js' | relative_url }}"></script>
