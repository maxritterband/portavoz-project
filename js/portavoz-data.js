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
 * document body content, preserving paragraph and line breaks.
 */
async function fetchDocText(url) {
  try {
    const docIdMatch = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
    // Always use the /pub endpoint — works for both shareable and already-published links
    // export?format=txt requires auth even on publicly shared docs
    const fetchUrl = docIdMatch
      ? `https://docs.google.com/document/d/${docIdMatch[1]}/pub`
      : url;

    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const contentEl = doc.querySelector('#contents') || doc.querySelector('.c') || doc.body;
    const elements = contentEl.querySelectorAll('p');
    const result = [];
    let currentBlock = [];

    elements.forEach(el => {
      const text = el.innerText || el.textContent || '';
      const trimmed = text.trim().replace(/\u00a0/g, '');
      if (!trimmed) {
        if (currentBlock.length > 0) {
          result.push(`<p>${currentBlock.join('<br>')}</p>`);
          currentBlock = [];
        }
      } else {
        currentBlock.push(trimmed);
      }
    });
    if (currentBlock.length > 0) {
      result.push(`<p>${currentBlock.join('<br>')}</p>`);
    }
    if (result.length > 0) return result.join('\n');

    // Fallback: plain text
    const plainText = contentEl.textContent.trim();
    return plainText.split(/\n{2,}/)
      .map(p => p.replace(/\n/g, '<br>').trim())
      .filter(p => p.length > 0)
      .map(p => `<p>${p}</p>`)
      .join('\n');

  } catch (err) {
    console.error('Failed to fetch Google Doc text:', err);
    return '<p>Could not load text. Please check the document link.</p>';
  }
}
/**
 * Parse a raw CSV string into an array of objects using the first row as keys.
 * Handles newlines inside quoted fields correctly.
 */
function parseCSV(text) {
  // Tokenize the entire CSV respecting quoted fields (which may contain \n)
  const records = [];
  let current = '';
  let inQuotes = false;
  let fields = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else if ((ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) && !inQuotes) {
      if (ch === '\r') i++; // skip \r in \r\n
      fields.push(current);
      current = '';
      records.push(fields);
      fields = [];
    } else if (ch === '\r' && !inQuotes) {
      // bare \r
      fields.push(current);
      current = '';
      records.push(fields);
      fields = [];
    } else {
      current += ch;
    }
  }
  // Push last field/record
  if (current || fields.length) {
    fields.push(current);
    records.push(fields);
  }

  if (records.length < 2) return [];

  const headers = records[0].map(h => h.trim());
  console.log('[Portavoz] CSV headers found:', headers);

  const rows = records.slice(1).map(values => {
    const obj = {};
    headers.forEach((h, i) => {
      // Preserve internal newlines (for translator/bio line breaks), just trim edges
      obj[h] = (values[i] || '').replace(/^\s+|\s+$/g, '');
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
 * Load all rows from the sheet without filtering by id/title.
 * Used for pages like About that need student translator rows
 * even if they don't have a translation id/title.
 */
async function loadAllRows() {
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    // Robust parser: handles newlines inside quoted cells
    const records = [];
    let current = '', inQuotes = false, fields = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuotes && text[i+1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current); current = '';
      } else if ((ch === '\n' || (ch === '\r' && text[i+1] === '\n')) && !inQuotes) {
        if (ch === '\r') i++;
        fields.push(current); current = '';
        records.push(fields); fields = [];
      } else if (ch === '\r' && !inQuotes) {
        fields.push(current); current = '';
        records.push(fields); fields = [];
      } else { current += ch; }
    }
    if (current || fields.length) { fields.push(current); records.push(fields); }
    if (records.length < 2) return [];
    const headers = records[0].map(h => h.trim());
    return records.slice(1).map(values => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (values[i] || '').replace(/^\s+|\s+$/g, ''); });
      return obj;
    }).filter(row => Object.values(row).some(v => v));
  } catch (err) {
    console.error('[Portavoz] loadAllRows failed:', err);
    return [];
  }
}

/**
 * Load a single translation by ID, fetching doc text if needed.
 * If the sheet has an 'excerpt' column with a Google Doc URL or text,
 * that is used as the displayed text instead of the full 'text' column.
 */
async function loadTranslationById(id) {
  const all = await loadTranslations();
  const t = all.find(x => x.id === id);
  if (!t) {
    console.warn('[Portavoz] No translation found with id:', id);
    return null;
  }

  // Determine which field to show: excerpt takes priority if present
  const textSource = t.excerpt && t.excerpt.trim() ? t.excerpt : '';

  if (isGoogleDocUrl(textSource)) {
    t.text = await fetchDocText(textSource);
  } else if (textSource && !textSource.includes('<p>')) {
    t.text = textSource
      .split(/\n\n+/)
      .map(p => `<p>${p.replace(/\n/g, ' ').trim()}</p>`)
      .join('\n');
  } else {
    t.text = textSource || '';
  }

  // Fetch translator's note — check multiple possible column name casings
  const noteRaw = t.translatorNote || t.TranslatorNote || t.translator_note || t.translatorNotes || '';
  console.log('[Portavoz] translatorNote raw value:', JSON.stringify(noteRaw));

  if (noteRaw && isGoogleDocUrl(noteRaw)) {
    t.translatorNoteText = await fetchDocText(noteRaw);
  } else if (noteRaw && noteRaw.trim()) {
    t.translatorNoteText = noteRaw
      .split(/\n\n+/)
      .map(p => `<p>${p.replace(/\n/g, '<br>').trim()}</p>`)
      .join('\n');
  } else {
    t.translatorNoteText = '';
  }
  console.log('[Portavoz] translatorNoteText:', t.translatorNoteText ? 'loaded (' + t.translatorNoteText.length + ' chars)' : 'empty');

  return t;
}

/**
 * loadEvents()
 * Fetches event data from the "events" tab of the same Google Sheet.
 * The gid parameter must match the sheet tab ID — update EVENTS_SHEET_GID
 * once the events tab is created and its gid is known.
 *
 * Expected columns (in order):
 *   title, subtitle, label, description, startDate, endDate,
 *   posterURL, ticketLink, qrURL, schedule, sponsors
 *
 * startDate / endDate format: YYYY-MM-DD (e.g. 2026-04-08)
 * schedule: pipe-separated items, e.g. "Apr 8 · 4 PM | Reception at Casa Bolívar"
 *   Each item is "date · time | detail"
 * sponsors: pipe-separated list of sponsor names
 * posterURL: Google Drive direct image link
 *   (From Drive share link, replace /file/d/ID/view with /uc?export=view&id=ID)
 */

const EVENTS_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSmH0u2BRjNVlpi43gV9GuN2TZ_kPjEfL2Li2cq8b5UbN47XYhWrLcv0P-eb4667BgYCePxgw0w10Vu/pub?single=true&output=csv';
const EVENTS_SHEET_GID = 'REPLACE_WITH_EVENTS_TAB_GID';

async function loadEvents() {
  try {
    const url = `${EVENTS_BASE_URL}&gid=${EVENTS_SHEET_GID}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch events sheet');
    const text = await res.text();
    const rows = parseCSV(text);
    return rows.map(r => ({
      title:       r.title       || '',
      subtitle:    r.subtitle    || '',
      label:       r.label       || '',
      description: r.description || '',
      startDate:   r.startDate   || '',
      endDate:     r.endDate     || '',
      posterURL:   r.posterURL   || '',
      ticketLink:  r.ticketLink  || '',
      qrURL:       r.qrURL       || '',
      schedule:    r.schedule    || '',
      sponsors:    r.sponsors    || '',
    }));
  } catch (e) {
    console.error('[Portavoz] loadEvents error:', e);
    return [];
  }
}
