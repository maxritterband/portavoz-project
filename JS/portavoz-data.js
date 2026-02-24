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
 * Convert a Google Doc URL (any format) to its published plain-text export URL.
 * Handles:
 *   - Published "publish to web" URLs: /pub?...
 *   - Regular doc URLs: /document/d/DOC_ID/edit
 */
function toDocExportUrl(url) {
  // Already a published URL — swap output to plain text
  if (url.includes('/pub')) {
    const base = url.split('?')[0];
    return base + '?output=txt';
  }
  // Regular doc URL — extract the ID and build an export URL
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
  }
  return null;
}

/**
 * Fetch plain text from a Google Doc and convert it to simple HTML paragraphs.
 * Preserves paragraph breaks. Blank lines between stanzas become spacing.
 */
async function fetchDocText(url) {
  try {
    const exportUrl = toDocExportUrl(url);
    if (!exportUrl) return '<p>Could not load document.</p>';

    const res = await fetch(exportUrl);
    if (!res.ok) throw new Error('Failed to fetch doc');
    const raw = await res.text();

    // Split on double newlines (paragraph/stanza breaks)
    const paragraphs = raw
      .split(/\r?\n\r?\n/)
      .map(p => p.replace(/\r?\n/g, ' ').trim())
      .filter(p => p.length > 0);

    return paragraphs.map(p => `<p>${p}</p>`).join('\n');
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

  return lines.slice(1).map(line => {
    const values = parseCSVRow(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = (values[i] || '').trim();
    });
    // Normalize the "featured" field to a boolean
    obj.featured = obj.featured === 'TRUE' || obj.featured === 'true' || obj.featured === '1' || obj.featured === 'yes';
    return obj;
  }).filter(t => t.id && t.title); // skip empty rows
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
 * For card views (archive, recent, home) — returns metadata only, no text fetching.
 * Text is only fetched when needed on the individual translation page.
 */
async function loadTranslations() {
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error('Network response was not ok');
    const text = await res.text();
    return parseCSV(text);
  } catch (err) {
    console.error('Failed to load translations from Google Sheets:', err);
    return [];
  }
}

/**
 * Load a single translation by ID, and if its text field is a Google Doc URL,
 * fetch and return the doc content as HTML.
 * Use this on the individual translation page.
 */
async function loadTranslationById(id) {
  const all = await loadTranslations();
  const t = all.find(x => x.id === id);
  if (!t) return null;

  // If the text column contains a Google Doc link, fetch the actual text
  if (isGoogleDocUrl(t.text)) {
    t.text = await fetchDocText(t.text);
  } else if (t.text && !t.text.includes('<p>')) {
    // Plain text in the sheet — wrap in paragraph tags
    t.text = t.text
      .split(/\n\n+/)
      .map(p => `<p>${p.replace(/\n/g, ' ').trim()}</p>`)
      .join('\n');
  }

  return t;
}

