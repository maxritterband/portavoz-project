/**
 * portavoz-data.js
 * Fetches translation data from the published Google Sheet CSV.
 * All pages import this script and call loadTranslations().
 */

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSmH0u2BRjNVlpi43gV9GuN2TZ_kPjEfL2Li2cq8b5UbN47XYhWrLcv0P-eb4667BgYCePxgw0w10Vu/pub?gid=0&single=true&output=csv';

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
 * Main function — fetch and parse the sheet.
 * Returns a promise that resolves to an array of translation objects.
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
