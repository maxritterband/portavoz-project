/**
 * portavoz-data.js
 * Fetches translation data from the published Google Sheet CSV.
 * If the "text" field contains a Google Docs published URL, the translation
 * text is fetched from that doc automatically.
 * All pages import this script and call loadTranslations().
 */

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSmH0u2BRjNVlpi43gV9GuN2TZ_kPjEfL2Li2cq8b5UbN47XYhWrLcv0P-eb4667BgYCePxgw0w10Vu/pub?gid=0&single=true&output=csv';

/**
 * Returns true if a string looks like a Google Docs published URL.
 */
function isGoogleDocUrl(str) {
  return typeof str === 'string' && str.includes('docs.google.com');
}

/**
 * Fetch content from a Google Doc published URL.
 * Published /pub URLs return HTML — we parse the DOM to extract just the
 * document body content, skipping Google's injected header boilerplate.
 */
async function fetchDocText(url) {
  try {
    // For published /pub URLs, fetch the HTML page directly
    // For regular doc URLs, convert to an export URL
    let fetchUrl = url;
    if (!url.includes('/pub')) {
      const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
      if (match) {
        fetchUrl = `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error('Failed to fetch');
        const text = await res.text();
        const paragraphs = text.trim().split(/\n{2,}/)
          .map(p => p.replace(/\n/g, ' ').trim())
          .filter(p => p.length > 0);
        return paragraphs.map(p => `<p>${p}</p>`).join('\n');
      }
    }

    // Fetch the published HTML page
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error('Failed to fetch doc');
    const html = await res.text();

    // Parse into a DOM and extract the content div
    // Google Docs published pages wrap the actual content in #contents
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove Google's header/footer elements
    ['#header', '#footer', '#banners', '.doc-banner-container',
     'script', 'style', 'noscript'].forEach(sel => {
      doc.querySelectorAll(sel).forEach(el => el.remove());
    });

    // The actual document content sits inside #contents or .c (Google's content class)
    const contentEl = doc.querySelector('#contents') || doc.querySelector('.c') || doc.body;

    // Extract text paragraph by paragraph, preserving stanza breaks
    const paragraphs = [];
    contentEl.querySelectorAll('p, h1, h2, h3, h4, h5, h6').forEach(el => {
      const text = el.textContent.trim();
      if (text) paragraphs.push(`<p>${text}</p>`);
    });

    if (paragraphs.length > 0) return paragraphs.join('\n');

    // Fallback: just get all text content and split on double newlines
    const plainText = contentEl.textContent.trim();
    return plainText.split(/\n{2,}/)
      .map(p => p.replace(/\n/g, ' ').trim())
      .filter(p => p.length > 0)
      .map(p => `<p>${p}</p>`)
      .join('\n');

  } catch (err) {
    console.error('Failed to fetch Google Doc text:', err);
    return '<p>Could not load translation text. Please check the document link.</p>';
  }
}

/**
 * Parse a raw CSV string into an array of objects using the first row as keys.
 */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVRow(lines[0]);
  console.log('[Portavoz] CSV headers found:', headers);

  const rows = lines.slice(1).map(line => {
    const values = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (values[i] || '').trim();
    });
    obj.featured = obj.featured === 'TRUE' || obj.featured === 'true' || obj.featured === '1' || obj.featured === 'yes';
    return obj;
  }).filter(t => t.id && t.title);

  console.log('[Portavoz] Parsed rows:', rows.length, rows);
  return rows;
}

/**
 * Parse a single CSV row, handling quoted fields with commas inside.
 */
function parseCSVRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

/**
 * Load all translations from the sheet.
 */
async function loadTranslations() {
  try {
    console.log('[Portavoz] Fetching sheet from:', SHEET_CSV_URL);
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    console.log('[Portavoz] Raw CSV (first 500 chars):', text.slice(0, 500));
    return parseCSV(text);
  } catch (err) {
    console.error('[Portavoz] Failed to load from Google Sheets:', err);
    return [];
  }
}

/**
 * Load a single translation by ID, fetching doc text if needed.
 */
async function loadTranslationById(id) {
  const all = await loadTranslations();
  const t = all.find(x => x.id === id);
  if (!t) {
    console.warn('[Portavoz] No translation found with id:', id);
    return null;
  }

  if (isGoogleDocUrl(t.text)) {
    t.text = await fetchDocText(t.text);
  } else if (t.text && !t.text.includes('<p>')) {
    t.text = t.text
      .split(/\n\n+/)
      .map(p => `<p>${p.replace(/\n/g, ' ').trim()}</p>`)
      .join('\n');
  }

  return t;
}

