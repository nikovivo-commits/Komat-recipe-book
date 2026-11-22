/* Turns a Hype export (CSV text) into the rows written to Firestore. Nothing here touches the network.
   What the columns are called, how dates are written and so on comes from config.json. */
import iconv from 'iconv-lite';

/* ---- dates ---- */

/* 'YYYY-MM-DD' of a moment, as the clock on the wall shows it in that time zone */
export function dayOf(ms, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}
export function hourOf(ms, tz) {
  return +new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date(ms));
}
/* the day before a 'YYYY-MM-DD' */
export function dayBefore(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}
/* a 'YYYY-MM-DD' written the way a report wants it, e.g. 'DD.MM.YYYY' */
export function formatDay(day, fmt) {
  const [y, m, d] = day.split('-');
  return fmt.replace(/YYYY|YY|MM|M|DD|D/g, (k) => ({ YYYY: y, YY: y.slice(2), MM: m, M: String(+m), DD: d, D: String(+d) })[k]);
}
function offsetAt(ms, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    .formatToParts(new Date(ms)).map((x) => [x.type, +x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}
/* wall-clock time in a time zone -> ms since 1970 */
export function zonedToMs(y, mo, d, h, mi, s, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess - offsetAt(guess, tz);
  return guess - offsetAt(first, tz);
}
const TOKENS = { YYYY: '(\\d{4})', YY: '(\\d{2})', MM: '(\\d{1,2})', M: '(\\d{1,2})', DD: '(\\d{1,2})', D: '(\\d{1,2})', HH: '(\\d{1,2})', H: '(\\d{1,2})', mm: '(\\d{2})', ss: '(\\d{2})' };
const formats = new Map();
function compile(fmt) {
  if (formats.has(fmt)) return formats.get(fmt);
  const keys = [];
  const src = fmt.split(/(YYYY|YY|MM|M|DD|D|HH|H|mm|ss)/).map((part) => {
    if (TOKENS[part]) { keys.push(part[0] === 'Y' ? 'y' : part[0] === 'M' ? 'mo' : part[0] === 'D' ? 'd' : part[0] === 'H' ? 'h' : part === 'mm' ? 'mi' : 's'); return TOKENS[part]; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  }).join('');
  const c = { re: new RegExp('^\\s*' + src + '(?:[.,]\\d+)?\\s*$'), keys };
  formats.set(fmt, c);
  return c;
}
/* text such as '22.11.2026 14:10:05' -> ms, read with a format such as 'DD.MM.YYYY HH:mm:ss'.
   A format with only a time ('HH:mm:ss') takes the date from `day`. Returns null when the text does not fit. */
export function parseTime(text, fmt, tz, day) {
  const c = compile(fmt), m = c.re.exec(String(text));
  if (!m) return null;
  const [dy, dm, dd] = day.split('-').map(Number);
  const v = { y: dy, mo: dm, d: dd, h: 0, mi: 0, s: 0 };
  c.keys.forEach((k, i) => { v[k] = +m[i + 1]; });
  if (c.keys.includes('y') && v.y < 100) v.y += 2000;
  if (v.mo < 1 || v.mo > 12 || v.d < 1 || v.d > 31 || v.h > 23 || v.mi > 59 || v.s > 59) return null;
  return zonedToMs(v.y, v.mo, v.d, v.h, v.mi, v.s, tz);
}

/* ---- numbers ---- */

/* '1 234,50', '1,234.50', '12.5 лв' -> a number; null when there is none. decimal: ',' | '.' | 'auto' */
export function parseNum(text, decimal = 'auto') {
  let s = String(text ?? '').replace(/[\s  ]/g, '').replace(/[^\d.,-]/g, '');
  if (!/\d/.test(s)) return null;
  const dec = decimal === ',' || decimal === '.' ? decimal
    : s.includes(',') && s.includes('.') ? (s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.')
    : s.includes(',') ? ',' : '.';
  s = s.split(dec === ',' ? '.' : ',').join('');
  if (dec === ',') s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
}

/* ---- CSV ---- */

/* the bytes of a download -> text. encoding: 'auto' or anything iconv-lite knows ('utf8', 'win1251', 'utf16le'...) */
export function decode(buf, encoding = 'auto') {
  if (encoding && encoding !== 'auto') return iconv.decode(buf, encoding).replace(/^﻿/, '');
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  if (buf[0] === 0xff && buf[1] === 0xfe) return iconv.decode(buf.subarray(2), 'utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) return iconv.decode(buf.subarray(2), 'utf16be');
  const utf8 = buf.toString('utf8');
  /* not valid UTF-8: Hype is Bulgarian, so the old Windows Cyrillic page is the likely one */
  return utf8.includes('�') ? iconv.decode(buf, 'win1251') : utf8;
}
function guessDelimiter(text) {
  const head = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10);
  let best = ';', score = -1;
  for (const d of [';', ',', '\t', '|']) {
    const n = head.reduce((a, l) => a + l.split(d).length - 1, 0);
    if (n > score) { score = n; best = d; }
  }
  return best;
}
/* CSV text -> array of rows, each an array of cells. Quoted cells may hold the delimiter, line breaks and "" */
export function parseCsv(text, delimiter = 'auto') {
  const d = !delimiter || delimiter === 'auto' ? guessDelimiter(text) : delimiter === '\\t' ? '\t' : delimiter;
  const rows = [];
  let row = [], cell = '', quoted = false, i = 0;
  const endCell = () => { row.push(cell); cell = ''; };
  const endRow = () => { endCell(); if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; };
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 2; continue; }
      if (ch === '"') { quoted = false; i++; continue; }
      cell += ch; i++; continue;
    }
    if (ch === '"' && cell.trim() === '') { quoted = true; cell = ''; i++; continue; }
    if (ch === d) { endCell(); i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { endRow(); i++; continue; }
    cell += ch; i++;
  }
  if (cell !== '' || row.length) endRow();
  return rows;
}

/* ---- finding the columns ---- */

const norm = (s) => String(s ?? '').replace(/^﻿/, '').trim().toLowerCase().replace(/\s+/g, ' ');
/* names: what the column may be called (a text or a list of texts), or its number counted from 1 */
function findCol(header, names) {
  if (names == null || names === '') return -1;
  if (typeof names === 'number') return names - 1;
  const want = [].concat(names).map(norm), have = header.map(norm);
  for (const w of want) { const i = have.indexOf(w); if (i >= 0) return i; }
  return -1;
}
/* Exports often start with a title and the date range: the header is the first line that has all the required columns */
function locate(table, columns, required) {
  for (let r = 0; r < Math.min(table.length, 30); r++) {
    const idx = Object.fromEntries(Object.keys(columns).map((k) => [k, findCol(table[r], columns[k])]));
    if (required.every((k) => idx[k] >= 0)) return { headerRow: r, idx };
  }
  const lines = table.slice(0, 5).map((r) => '    ' + r.join(' | ')).join('\n');
  throw new Error(`could not find the columns ${required.map((k) => `${k} (${[].concat(columns[k] ?? '?').join(' / ')})`).join(', ')} in the export. Its first lines are:\n${lines}\n  Fix the column names in config.json.`);
}
const text = (row, i) => (i >= 0 && row[i] != null ? String(row[i]).trim() : '');

/* The "Detailed sales data" export -> { rows, skipped, header }.
   rep: the "sales" block of config.json; day: 'YYYY-MM-DD' the export was asked for; tz: the restaurant's time zone */
export function parseSales(buf, rep, tz, day) {
  const table = parseCsv(decode(buf, rep.encoding), rep.delimiter);
  if (!table.length) return { rows: [], skipped: 0, header: [] };
  const cols = rep.columns || {};
  const { headerRow, idx } = locate(table, cols, ['time', 'item', 'qty']);
  const fmt = rep.timeFormat || 'DD.MM.YYYY HH:mm:ss';
  const rows = [];
  let skipped = 0;
  for (const r of table.slice(headerRow + 1)) {
    const item = text(r, idx.item), qty = parseNum(text(r, idx.qty), rep.decimal);
    const stamp = idx.date >= 0 ? `${text(r, idx.date)} ${text(r, idx.time)}` : text(r, idx.time);
    const t = parseTime(stamp, fmt, tz, day);
    /* totals at the foot of the report, blank lines, repeated headers */
    if (!item || qty === null || t === null) { skipped++; continue; }
    const price = parseNum(text(r, idx.price), rep.decimal), total = parseNum(text(r, idx.total), rep.decimal);
    rows.push({
      t, bill: text(r, idx.bill), item, qty,
      price: price ?? (total !== null && qty ? Math.round((total / qty) * 100) / 100 : 0),
      total: total ?? (price !== null ? Math.round(price * qty * 100) / 100 : 0),
      op: text(r, idx.op), cust: text(r, idx.cust),
    });
  }
  /* always in the same order, so that the same sales give the same document */
  rows.sort((a, b) => a.t - b.t || a.bill.localeCompare(b.bill) || a.item.localeCompare(b.item) || a.qty - b.qty || a.total - b.total);
  return { rows, skipped, header: table[headerRow] };
}

/* The stock export -> { rows: [{ item, qty, unit }], skipped, header } */
export function parseStock(buf, rep) {
  const table = parseCsv(decode(buf, rep.encoding), rep.delimiter);
  if (!table.length) return { rows: [], skipped: 0, header: [] };
  const { headerRow, idx } = locate(table, rep.columns || {}, ['item', 'qty']);
  const rows = [];
  let skipped = 0;
  for (const r of table.slice(headerRow + 1)) {
    const item = text(r, idx.item), qty = parseNum(text(r, idx.qty), rep.decimal);
    if (!item || qty === null) { skipped++; continue; }
    rows.push({ item, qty, unit: text(r, idx.unit) });
  }
  rows.sort((a, b) => a.item.localeCompare(b.item) || a.unit.localeCompare(b.unit));
  return { rows, skipped, header: table[headerRow] };
}
