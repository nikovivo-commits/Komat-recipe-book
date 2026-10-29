/* Komat Back Office: pure business logic.
 * No DOM, no storage. Loaded as a classic script in the browser (window.KomatLogic)
 * and as a CommonJS module by the tests (node --test). */
(function (root) {
  'use strict';

  const DAY_MS = 86400000;
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /* ---------- small helpers ---------- */

  function num(v, fallback) {
    const n = typeof v === 'number' ? v : parseNum(v);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Parses "1,5", "1.234,50", "1,234.50", "€ 12", "12 kg" into a number (NaN when empty). */
  function parseNum(input) {
    if (input === null || input === undefined) return NaN;
    if (typeof input === 'number') return input;
    let s = String(input).trim().replace(/[\s '€$£]/g, '').replace(/[a-zA-Z%]+$/g, '');
    if (!s) return NaN;
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > -1 && lastDot > -1) {
      // Whichever separator comes last is the decimal one.
      if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (lastComma > -1) {
      // European exports: a single comma is the decimal separator ("1,5", "1,250");
      // several commas can only be thousands separators ("1,250,000").
      const parts = s.split(',');
      s = parts.length === 2 ? parts.join('.') : parts.join('');
    } else if (s.split('.').length > 2) {
      s = s.replace(/\./g, '');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function round(n, dp) {
    const f = Math.pow(10, dp || 0);
    return Math.round(n * f) / f;
  }

  /** Local calendar date as YYYY-MM-DD. */
  function isoDate(d) {
    const x = d instanceof Date ? d : new Date(d);
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return x.getFullYear() + '-' + m + '-' + day;
  }

  /** Parses YYYY-MM-DD as a local date at midnight. */
  function fromIso(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }

  function addDays(d, n) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  }

  function fmtQty(n) {
    if (!Number.isFinite(n)) return '–';
    return String(round(n, 2));
  }

  /* ---------- stock ---------- */

  /** The level at which an item should be re-ordered. Defaults to 40% of par. */
  function reorderPoint(item) {
    const explicit = num(item.reorderAt, NaN);
    if (Number.isFinite(explicit) && explicit >= 0) return explicit;
    const par = num(item.par, 0);
    return par > 0 ? round(par * 0.4, 2) : 0;
  }

  /** 'out' (86'd), 'low' (at or below reorder point) or 'ok'. */
  function stockStatus(item) {
    const onHand = num(item.onHand, 0);
    if (onHand <= 0) return 'out';
    const par = num(item.par, 0);
    if (par > 0 && onHand <= reorderPoint(item)) return 'low';
    return 'ok';
  }

  /** Units already ordered (sent, not yet received) per item id. */
  function onOrderMap(orders) {
    const map = {};
    (orders || []).forEach(function (o) {
      if (o.status !== 'sent') return;
      (o.lines || []).forEach(function (l) {
        if (!l.itemId) return;
        map[l.itemId] = (map[l.itemId] || 0) + num(l.qty, 0) * Math.max(1, num(l.unitsPerPack, 1));
      });
    });
    return map;
  }

  /* ---------- bookings ---------- */

  function bookingsByDay(reservations, from, days) {
    const start = from instanceof Date ? from : fromIso(from) || new Date();
    const out = [];
    for (let i = 0; i < days; i++) {
      const date = isoDate(addDays(start, i));
      out.push({ date: date, covers: 0, bookings: 0 });
    }
    const index = {};
    out.forEach(function (d, i) { index[d.date] = i; });
    (reservations || []).forEach(function (r) {
      if (r.status === 'cancelled') return;
      const i = index[r.date];
      if (i === undefined) return;
      out[i].covers += Math.max(0, num(r.covers, 0));
      out[i].bookings += 1;
    });
    return out;
  }

  /**
   * Busy-week boost: when the next 7 days carry more booked covers than a normal
   * week, par levels for ordering scale up by that ratio (never down, capped).
   */
  function demandBoost(reservations, settings, today) {
    const s = settings || {};
    const normal = num(s.normalCoversWeek, 0);
    const cap = Math.max(1, num(s.boostCap, 1.5));
    const week = bookingsByDay(reservations, today || new Date(), 7);
    const booked = week.reduce(function (a, d) { return a + d.covers; }, 0);
    let factor = 1;
    if (s.boost !== false && normal > 0 && booked > normal) {
      factor = Math.min(cap, booked / normal);
    }
    return { booked: booked, normal: normal, factor: round(factor, 2), active: factor > 1 };
  }

  /* ---------- ordering ---------- */

  function packOf(item) {
    const size = Math.max(1, num(item.packSize, 1));
    const label = size > 1 ? String(item.packLabel || 'pack').trim() || 'pack' : String(item.unit || 'pcs');
    return { size: size, label: label };
  }

  /** One order line for an item, sized in packs, or null when nothing is needed. */
  function suggestLine(item, onOrderUnits, factor) {
    const par = num(item.par, 0);
    if (!(par > 0)) return null;
    const available = num(item.onHand, 0) + (onOrderUnits || 0);
    if (available > reorderPoint(item)) return null;
    const target = par * (factor || 1);
    const needUnits = target - available;
    if (needUnits <= 0) return null;
    const pack = packOf(item);
    const qty = Math.ceil(needUnits / pack.size - 1e-9);
    if (qty <= 0) return null;
    return lineFor(item, qty);
  }

  function lineFor(item, qty) {
    const pack = packOf(item);
    return {
      itemId: item.id,
      name: item.name,
      sku: item.sku || '',
      qty: qty,
      orderUnit: pack.label,
      unitsPerPack: pack.size,
      unit: item.unit || 'pcs',
      cost: num(item.cost, 0)
    };
  }

  /** Suggested orders grouped by supplier, most urgent first. */
  function suggestOrders(items, suppliers, orders, factor) {
    const onOrder = onOrderMap(orders);
    const bySupplier = {};
    (items || []).forEach(function (item) {
      if (!item.supplierId) return;
      const line = suggestLine(item, onOrder[item.id] || 0, factor);
      if (!line) return;
      line.status = stockStatus(item);
      line.onHand = num(item.onHand, 0);
      line.par = num(item.par, 0);
      (bySupplier[item.supplierId] = bySupplier[item.supplierId] || []).push(line);
    });
    const supplierIndex = {};
    (suppliers || []).forEach(function (s) { supplierIndex[s.id] = s; });
    return Object.keys(bySupplier)
      .filter(function (id) { return supplierIndex[id]; })
      .map(function (id) {
        const lines = bySupplier[id].sort(function (a, b) {
          return (a.status === 'out' ? 0 : 1) - (b.status === 'out' ? 0 : 1) || a.name.localeCompare(b.name);
        });
        return {
          supplier: supplierIndex[id],
          lines: lines,
          outCount: lines.filter(function (l) { return l.status === 'out'; }).length,
          total: orderTotal({ lines: lines })
        };
      })
      .sort(function (a, b) { return b.outCount - a.outCount || b.lines.length - a.lines.length; });
  }

  function orderTotal(order) {
    return round((order.lines || []).reduce(function (sum, l) {
      return sum + num(l.qty, 0) * Math.max(1, num(l.unitsPerPack, 1)) * num(l.cost, 0);
    }, 0), 2);
  }

  /** Next day (today included) this supplier takes orders; null when no order days are set. */
  function nextOrderDay(supplier, today) {
    const days = (supplier && supplier.orderDays) || [];
    if (!days.length) return null;
    const t = today || new Date();
    for (let i = 0; i < 7; i++) {
      const d = addDays(t, i);
      if (days.indexOf(d.getDay()) > -1) return { date: isoDate(d), inDays: i, weekday: WEEKDAYS[d.getDay()] };
    }
    return null;
  }

  function expectedDelivery(supplier, from) {
    const lead = Math.max(0, num(supplier && supplier.leadDays, 1));
    return isoDate(addDays(from || new Date(), lead));
  }

  function describeLine(l) {
    const per = Math.max(1, num(l.unitsPerPack, 1));
    const qty = fmtQty(num(l.qty, 0));
    return per > 1 ? qty + ' × ' + l.orderUnit + ' (' + fmtQty(per) + ' ' + l.unit + ')' : qty + ' ' + (l.unit || l.orderUnit || '');
  }

  function fmtLongDate(iso, locale) {
    const d = fromIso(iso);
    if (!d) return '';
    try {
      return new Intl.DateTimeFormat(locale || 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
    } catch (e) {
      return iso;
    }
  }

  /** Plain-text supplier email for an order. */
  function orderEmail(order, supplier, settings) {
    const s = settings || {};
    const restaurant = s.restaurant || 'Komat';
    const greetingName = (supplier && (supplier.contact || supplier.name)) || 'team';
    const when = order.deliveryDate ? 'for delivery on ' + fmtLongDate(order.deliveryDate) : 'for the next possible delivery';
    const lines = (order.lines || []).filter(function (l) { return num(l.qty, 0) > 0; });
    const width = lines.reduce(function (w, l) { return Math.max(w, describeLine(l).length); }, 0);
    const body = [];
    body.push('Hello ' + greetingName + ',');
    body.push('');
    body.push((s.emailIntro || 'please send us the following') + ' ' + when + ':');
    body.push('');
    lines.forEach(function (l) {
      body.push('  ' + describeLine(l).padEnd(width + 2) + l.name + (l.sku ? '  [' + l.sku + ']' : ''));
    });
    body.push('');
    if (order.note) { body.push(order.note); body.push(''); }
    if (supplier && supplier.customerNo) body.push('Customer no.: ' + supplier.customerNo);
    if (s.address) body.push('Deliver to: ' + s.address);
    if ((supplier && supplier.customerNo) || s.address) body.push('');
    body.push('Please confirm by replying to this email. Thank you!');
    body.push('');
    body.push(s.signature || [s.sender, restaurant].filter(Boolean).join('\n'));
    const subject = 'Order ' + (order.number || '') + ' from ' + restaurant + (order.deliveryDate ? ' – delivery ' + order.deliveryDate : '');
    return { subject: subject.replace(/\s+/g, ' ').trim(), body: body.join('\n') };
  }

  function orderNumber(date, existing) {
    const d = date || new Date();
    const base = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const taken = {};
    (existing || []).forEach(function (o) { if (o.number) taken[o.number] = true; });
    for (let i = 1; i < 1000; i++) {
      const n = 'K' + base + '-' + String(i).padStart(2, '0');
      if (!taken[n]) return n;
    }
    return 'K' + base + '-' + Date.now().toString(36);
  }

  /* ---------- CSV ---------- */

  function detectDelimiter(text) {
    const first = String(text).split(/\r?\n/).find(function (l) { return l.trim(); }) || '';
    const counts = [';', ',', '\t', '|'].map(function (d) {
      let n = 0, inQ = false;
      for (const ch of first) { if (ch === '"') inQ = !inQ; else if (ch === d && !inQ) n++; }
      return { d: d, n: n };
    });
    counts.sort(function (a, b) { return b.n - a.n; });
    return counts[0].n > 0 ? counts[0].d : ',';
  }

  /** RFC-4180-ish CSV parser. Returns an array of rows (arrays of strings). */
  function parseCSV(text, delimiter) {
    const src = String(text || '').replace(/^﻿/, '');
    const d = delimiter || detectDelimiter(src);
    const rows = [];
    let row = [], field = '', inQ = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (inQ) {
        if (ch === '"') {
          if (src[i + 1] === '"') { field += '"'; i++; } else inQ = false;
        } else field += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === d) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(function (c) { return c.trim() !== ''; })) rows.push(row);
        row = [];
      } else field += ch;
    }
    row.push(field);
    if (row.some(function (c) { return c.trim() !== ''; })) rows.push(row);
    return rows;
  }

  // Header names seen in POS / inventory exports (English, German, Finnish), lower-cased.
  const FIELD_SYNONYMS = {
    name: ['name', 'item', 'item name', 'article', 'product', 'description', 'artikel', 'artikelname', 'bezeichnung', 'artikelbezeichnung', 'produkt', 'tuote', 'nimi'],
    sku: ['sku', 'code', 'item code', 'article no', 'article number', 'artikelnummer', 'artikel-nr', 'artikelnr', 'art.-nr.', 'art-nr', 'plu', 'ean', 'nummer', 'nr'],
    category: ['category', 'group', 'product group', 'warengruppe', 'kategorie', 'gruppe', 'hauptgruppe', 'ryhmä'],
    location: ['location', 'storage', 'store', 'lagerort', 'lager', 'storage location', 'varasto'],
    unit: ['unit', 'uom', 'einheit', 'mengeneinheit', 'me', 'yksikkö'],
    onHand: ['on hand', 'onhand', 'stock', 'qty', 'quantity', 'current stock', 'bestand', 'istbestand', 'ist-bestand', 'menge', 'lagerbestand', 'saldo', 'määrä'],
    par: ['par', 'par level', 'target', 'max', 'sollbestand', 'soll-bestand', 'maximalbestand', 'höchstbestand', 'tavoite'],
    reorderAt: ['reorder', 'reorder at', 'reorder point', 'min', 'minimum', 'mindestbestand', 'meldebestand', 'minimalbestand', 'min.bestand'],
    packSize: ['pack size', 'case size', 'units per pack', 'gebinde', 'gebindegröße', 'vpe', 'inhalt', 'pakkauskoko'],
    packLabel: ['pack', 'pack label', 'case', 'gebindeart', 'verpackung'],
    cost: ['cost', 'cost price', 'purchase price', 'unit cost', 'ek', 'ek-preis', 'ek preis', 'einkaufspreis', 'einkauf', 'ostohinta'],
    price: ['price', 'sell price', 'selling price', 'sales price', 'vk', 'vk-preis', 'vk preis', 'verkaufspreis', 'preis', 'myyntihinta'],
    supplier: ['supplier', 'vendor', 'lieferant', 'hersteller', 'toimittaja']
  };

  function normHeader(h) {
    return String(h || '').toLowerCase().replace(/[_]+/g, ' ').replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
  }

  /** Guesses which column holds which field. Returns {field: columnIndex}. */
  function mapHeaders(headers) {
    const mapping = {};
    const used = {};
    const norm = headers.map(normHeader);
    // Exact matches first, then "header starts with synonym".
    [true, false].forEach(function (exact) {
      Object.keys(FIELD_SYNONYMS).forEach(function (field) {
        if (mapping[field] !== undefined) return;
        const syns = FIELD_SYNONYMS[field];
        for (let i = 0; i < norm.length; i++) {
          if (used[i] || !norm[i]) continue;
          const hit = exact
            ? syns.indexOf(norm[i]) > -1
            : syns.some(function (s) { return s.length > 2 && (norm[i].indexOf(s + ' ') === 0 || norm[i].indexOf(s + '.') === 0); });
          if (hit) { mapping[field] = i; used[i] = true; return; }
        }
      });
    });
    return mapping;
  }

  /** Turns CSV rows into item drafts using a mapping. The first row must be the header. */
  function rowsToItems(rows, mapping) {
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const get = function (f) { return mapping[f] === undefined ? '' : String(row[mapping[f]] === undefined ? '' : row[mapping[f]]).trim(); };
      const name = get('name');
      if (!name) continue;
      const item = { name: name };
      ['sku', 'category', 'location', 'unit', 'packLabel', 'supplier'].forEach(function (f) { const v = get(f); if (v) item[f] = v; });
      ['onHand', 'par', 'reorderAt', 'packSize', 'cost', 'price'].forEach(function (f) {
        const v = parseNum(get(f));
        if (Number.isFinite(v)) item[f] = v;
      });
      out.push(item);
    }
    return out;
  }

  function csvCell(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function toCSV(rows, delimiter) {
    const d = delimiter || ',';
    return rows.map(function (r) { return r.map(csvCell).join(d); }).join('\r\n') + '\r\n';
  }

  function itemsToCSV(items, suppliers) {
    const names = {};
    (suppliers || []).forEach(function (s) { names[s.id] = s.name; });
    const header = ['name', 'sku', 'category', 'location', 'unit', 'on hand', 'par', 'reorder at', 'pack size', 'pack', 'cost', 'price', 'supplier'];
    const rows = [header].concat((items || []).map(function (i) {
      return [i.name, i.sku, i.category, i.location, i.unit, i.onHand, i.par, i.reorderAt, i.packSize, i.packLabel, i.cost, i.price, names[i.supplierId] || ''];
    }));
    return toCSV(rows);
  }

  /** Reservations CSV: needs date + covers; time / name / phone / note optional. */
  function rowsToReservations(rows) {
    if (!rows.length) return [];
    const h = rows[0].map(normHeader);
    const find = function (list) { return h.findIndex(function (x) { return list.indexOf(x) > -1; }); };
    const col = {
      date: find(['date', 'datum', 'day', 'päivä', 'päivämäärä']),
      time: find(['time', 'uhrzeit', 'zeit', 'aika', 'kellonaika']),
      name: find(['name', 'guest', 'gast', 'customer', 'nimi', 'asiakas']),
      covers: find(['covers', 'guests', 'pax', 'people', 'persons', 'party size', 'personen', 'anzahl', 'gäste', 'henkilöä', 'hlö']),
      phone: find(['phone', 'telefon', 'tel', 'puhelin', 'mobile']),
      note: find(['note', 'notes', 'notiz', 'bemerkung', 'kommentar', 'comment', 'lisätiedot'])
    };
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const v = function (k) { return col[k] > -1 ? String(row[col[k]] || '').trim() : ''; };
      const date = normalizeDate(v('date'));
      const covers = parseNum(v('covers'));
      if (!date || !Number.isFinite(covers)) continue;
      out.push({ date: date, time: normalizeTime(v('time')), name: v('name'), covers: covers, phone: v('phone'), note: v('note'), source: 'import' });
    }
    return out;
  }

  /** Accepts 2026-10-29, 29.10.2026, 29/10/2026, 29.10.26 */
  function normalizeDate(s) {
    const str = String(s || '').trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str);
    if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
    m = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/.exec(str);
    if (m) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    }
    return '';
  }

  function normalizeTime(s) {
    const m = /(\d{1,2})[:.](\d{2})/.exec(String(s || ''));
    return m ? m[1].padStart(2, '0') + ':' + m[2] : '';
  }

  /* ---------- email (Gmail search results) ---------- */

  /** Gmail search query for mail from the given suppliers. */
  function supplierQuery(suppliers, days) {
    const emails = [];
    (suppliers || []).forEach(function (s) {
      String(s.email || '').split(/[,;\s]+/).forEach(function (e) {
        if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && emails.indexOf(e.toLowerCase()) < 0) emails.push(e.toLowerCase());
      });
    });
    if (!emails.length) return '';
    return 'from:(' + emails.join(' OR ') + ') newer_than:' + (days || 30) + 'd';
  }

  /** Flattens a Gmail search_threads payload into display rows. */
  function threadRows(payload) {
    const threads = (payload && payload.threads) || [];
    return threads.map(function (t) {
      const msgs = t.messages || [];
      const last = msgs[msgs.length - 1] || {};
      const first = msgs[0] || {};
      let time = Date.parse(last.date || first.date || '');
      if (!Number.isFinite(time) && /^[0-9a-f]{11,}$/i.test(t.id || '')) {
        // Gmail thread ids start with the creation time in hex milliseconds.
        time = parseInt(t.id.slice(0, 11), 16);
      }
      return {
        id: t.id,
        from: String(last.sender || first.sender || ''),
        subject: String(first.subject || last.subject || '(no subject)'),
        snippet: String(last.snippet || first.snippet || ''),
        count: t.messageCount || msgs.length || 1,
        time: Number.isFinite(time) ? time : null,
        url: t.viewUrl || last.viewUrl || 'https://mail.google.com/mail/u/0/#all/' + encodeURIComponent(t.id || '')
      };
    });
  }

  const api = {
    DAY_MS: DAY_MS,
    WEEKDAYS: WEEKDAYS,
    parseNum: parseNum,
    num: num,
    round: round,
    isoDate: isoDate,
    fromIso: fromIso,
    addDays: addDays,
    fmtQty: fmtQty,
    fmtLongDate: fmtLongDate,
    reorderPoint: reorderPoint,
    stockStatus: stockStatus,
    onOrderMap: onOrderMap,
    bookingsByDay: bookingsByDay,
    demandBoost: demandBoost,
    packOf: packOf,
    suggestLine: suggestLine,
    lineFor: lineFor,
    suggestOrders: suggestOrders,
    orderTotal: orderTotal,
    nextOrderDay: nextOrderDay,
    expectedDelivery: expectedDelivery,
    describeLine: describeLine,
    orderEmail: orderEmail,
    orderNumber: orderNumber,
    detectDelimiter: detectDelimiter,
    parseCSV: parseCSV,
    mapHeaders: mapHeaders,
    rowsToItems: rowsToItems,
    toCSV: toCSV,
    itemsToCSV: itemsToCSV,
    rowsToReservations: rowsToReservations,
    normalizeDate: normalizeDate,
    normalizeTime: normalizeTime,
    supplierQuery: supplierQuery,
    threadRows: threadRows,
    FIELD_SYNONYMS: FIELD_SYNONYMS
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KomatLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
