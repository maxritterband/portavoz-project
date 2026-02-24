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
 */
function toDocExportUrl(url) {
  if (url.includes('/pub')) {
    const base = url.split('?')[0];
    return base + '?output=txt';
  }
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
  }
  return null;
}

/**
 * Fetch plain text from a Google Doc and convert it to simple HTML paragraphs.
 */
async function fetchDocText(url) {
  try {
    const exportUrl = toDocExportUrl(url);
    if (!exportUrl) return '<p>Could not load document.</p>';
    const res = await fetch(exportUrl);
    if (!res.ok) throw new Error('Failed to fetch doc');
    const raw = await res.text();

    // Strip Google Docs boilerplate lines
    const boilerplatePatterns = [
      /^Published using Google Docs/i,
      /^Report abuse/i,
      /^Learn more/i,
      /^Updated automatically every/i,
      /^\d+\s+\w+$/,           // e.g. "3 Translation"
      /^[\s\u00a0]*$/,         // blank / whitespace-only lines at start
    ];

    const lines = raw.split(/\r?\n/);
    // Skip leading boilerplate lines, then filter remaining ones
    let startIdx = 0;
    while (startIdx < lines.length && boilerplatePatterns.some(p => p.test(lines[startIdx].trim()))) {
      startIdx++;
    }
    const cleaned = lines.slice(startIdx)
      .filter(line => !boilerplatePatterns.some(p => p.test(line.trim())))
      .join('\n')
      .trim();

    const paragraphs = cleaned
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

