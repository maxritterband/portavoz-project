---
layout: default
title: "Name"
original_title: "Titulo"
original_author: "Author"
translator: "Translator"
year: Year
month: Month
status: published
featured: true
---

## Translator’s Note

This translation explores...

---

## About the Author

Jorge Luis Borges was an Argentine writer...

---

## Translation

Full translated text goes here...

<div class="translation-container">

  <div class="translation-main">
    <h2>{{ page.title }}</h2>
    <p><em>{{ page.original_title }}</em> by {{ page.original_author }}</p>

    <hr>

    <h3>Translation</h3>
    <p>
      Full translated text goes here...
    </p>
  </div>

  <div class="translation-sidebar">
    <h3>Translator</h3>
    <p>{{ page.translator }} (Class of {{ page.year }})</p>

    <h3>Status</h3>
    <p>{{ page.status }}</p>

    <h3>Translator’s Note</h3>
    <p>This translation explores...</p>

    <h3>About the Author</h3>
    <p>Jorge Luis Borges was an Argentine writer...</p>
  </div>

</div>
