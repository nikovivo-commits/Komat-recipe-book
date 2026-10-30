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

  /** 'out' (86'd), 'low' (at or below reorder point), 'ok', or 'new' (never counted, no par yet). */
  function stockStatus(item) {
    const onHand = num(item.onHand, 0);
    const par = num(item.par, 0);
    if (onHand <= 0) return par > 0 || item.baseAt || item.countedAt ? 'out' : 'new';
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
      if (r.status === 'cancelled' || r.status === 'pending') return;
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

  /**
   * One order line for an item, sized in packs, or null when nothing is needed.
   * asked: 'out' | 'low' when the kitchen asked for it: then it is ordered (at least one pack) whatever the count says.
   */
  function suggestLine(item, onOrderUnits, factor, asked) {
    const par = num(item.par, 0);
    if (asked) {
      const have = asked === 'out' ? 0 : Math.min(num(item.onHand, 0), par > 0 ? reorderPoint(item) : 0);
      const need = par > 0 ? par * (factor || 1) - have - (onOrderUnits || 0) : 0;
      if ((onOrderUnits || 0) > 0 && need <= 0) return null; // already on its way
      const line = lineFor(item, Math.max(1, Math.ceil(need / packOf(item).size - 1e-9)));
      line.asked = asked;
      return line;
    }
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

  /**
   * Suggested orders grouped by supplier, most urgent first.
   * asks: kitchen requests from kitchenAsks(); one stops counting once an order with that item was sent after it.
   */
  function suggestOrders(items, suppliers, orders, factor, asks) {
    const onOrder = onOrderMap(orders);
    const sentAt = {};
    (orders || []).forEach(function (o) {
      if ((o.status !== 'sent' && o.status !== 'received') || !o.sentAt) return;
      (o.lines || []).forEach(function (l) { sentAt[l.itemId] = Math.max(sentAt[l.itemId] || 0, o.sentAt); });
    });
    const asked = {};
    (asks || []).forEach(function (a) {
      if (a.itemId && !(sentAt[a.itemId] >= a.at)) asked[a.itemId] = a.status === 'out' || asked[a.itemId] === 'out' ? 'out' : 'low';
    });
    const bySupplier = {};
    (items || []).forEach(function (item) {
      if (!item.supplierId) return;
      const line = suggestLine(item, onOrder[item.id] || 0, factor, asked[item.id]);
      if (!line) return;
      line.status = asked[item.id] === 'out' ? 'out' : stockStatus(item);
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

  // Header names seen in POS / inventory exports (Bulgarian, English, German, Finnish), lower-cased.
  const FIELD_SYNONYMS = {
    name: ['name', 'item', 'item name', 'article', 'product', 'description', 'наименование', 'име', 'артикул', 'продукт', 'стока', 'название', 'наименование на артикул', 'artikel', 'artikelname', 'bezeichnung', 'artikelbezeichnung', 'produkt', 'tuote', 'nimi'],
    sku: ['sku', 'code', 'item code', 'article no', 'article number', 'код', 'номер', 'артикулен номер', 'баркод', 'шифър', 'artikelnummer', 'artikel-nr', 'artikelnr', 'art.-nr.', 'art-nr', 'plu', 'ean', 'nummer', 'nr'],
    category: ['category', 'group', 'product group', 'група', 'категория', 'стокова група', 'warengruppe', 'kategorie', 'gruppe', 'hauptgruppe', 'ryhmä'],
    location: ['location', 'storage', 'store', 'warehouse', 'склад', 'място', 'обект', 'lagerort', 'lager', 'storage location', 'varasto'],
    unit: ['unit', 'uom', 'мярка', 'мерна единица', 'м.ед.', 'м. ед.', 'ед.', 'единица', 'einheit', 'mengeneinheit', 'me', 'yksikkö'],
    onHand: ['on hand', 'onhand', 'stock', 'qty', 'quantity', 'current stock', 'наличност', 'наличности', 'количество', 'налично', 'остатък', 'кол.', 'к-во', 'bestand', 'istbestand', 'ist-bestand', 'menge', 'lagerbestand', 'saldo', 'määrä'],
    par: ['par', 'par level', 'target', 'max', 'максимум', 'максимално количество', 'оптимално количество', 'sollbestand', 'soll-bestand', 'maximalbestand', 'höchstbestand', 'tavoite'],
    reorderAt: ['reorder', 'reorder at', 'reorder point', 'min', 'minimum', 'минимум', 'минимално количество', 'мин. количество', 'mindestbestand', 'meldebestand', 'minimalbestand', 'min.bestand'],
    packSize: ['pack size', 'case size', 'units per pack', 'опаковка бр', 'бр. в опаковка', 'разфасовка', 'gebinde', 'gebindegröße', 'vpe', 'inhalt', 'pakkauskoko'],
    packLabel: ['pack', 'pack label', 'case', 'опаковка', 'gebindeart', 'verpackung'],
    cost: ['cost', 'cost price', 'purchase price', 'unit cost', 'доставна цена', 'покупна цена', 'цена доставка', 'себестойност', 'ед. цена доставка', 'ek', 'ek-preis', 'ek preis', 'einkaufspreis', 'einkauf', 'ostohinta'],
    price: ['price', 'sell price', 'selling price', 'sales price', 'продажна цена', 'цена продажба', 'цена', 'ед. цена', 'vk', 'vk-preis', 'vk preis', 'verkaufspreis', 'preis', 'myyntihinta'],
    supplier: ['supplier', 'vendor', 'доставчик', 'фирма доставчик', 'lieferant', 'hersteller', 'toimittaja']
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
      date: find(['date', 'дата', 'ден', 'datum', 'day', 'päivä', 'päivämäärä']),
      time: find(['time', 'час', 'време', 'начален час', 'uhrzeit', 'zeit', 'aika', 'kellonaika']),
      name: find(['name', 'guest', 'име', 'гост', 'клиент', 'на името на', 'gast', 'customer', 'nimi', 'asiakas']),
      covers: find(['covers', 'guests', 'pax', 'people', 'persons', 'party size', 'гости', 'брой гости', 'брой хора', 'хора', 'души', 'брой', 'personen', 'anzahl', 'gäste', 'henkilöä', 'hlö']),
      phone: find(['phone', 'телефон', 'тел.', 'тел', 'telefon', 'tel', 'puhelin', 'mobile']),
      note: find(['note', 'notes', 'бележка', 'бележки', 'коментар', 'забележка', 'notiz', 'bemerkung', 'kommentar', 'comment', 'lisätiedot'])
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

  /* ---------- front of house: wines and drinks sold to guests ---------- */

  const WINE_COLOURS = [['sparkling', 'Sparkling'], ['white', 'White'], ['orange', 'Orange'], ['rose', 'Rosé'], ['red', 'Red'], ['dessert', 'Dessert & fortified']];

  /** How an item is sold to guests: [{id, label, portion (stock units used), price}]. */
  function servesOf(item) {
    if (!item) return [];
    if (item.kind === 'wine') {
      const out = [{ id: 'bottle', label: 'Bottle', portion: 1, price: num(item.price, 0) }];
      const bottle = num(item.bottleCl, 75);
      const glass = num(item.glassCl, 0);
      if (glass > 0 && bottle > 0) out.push({ id: 'glass', label: 'Glass ' + fmtQty(glass) + ' cl', portion: round(glass / bottle, 4), price: num(item.glassPrice, 0) });
      return out;
    }
    if (item.kind === 'drink') return [{ id: 'piece', label: 'Per ' + (item.unit || 'piece'), portion: 1, price: num(item.price, 0) }];
    return [];
  }

  function serveOf(item, serveId) {
    return servesOf(item).find(function (s) { return s.id === serveId; }) || null;
  }

  /** Gross profit share of a serve, after taking VAT out of the menu price. */
  function serveMargin(item, serve, vatPct) {
    const net = num(serve.price, 0) / (1 + Math.max(0, num(vatPct, 0)) / 100);
    const cost = num(item.cost, 0) * num(serve.portion, 1);
    if (!(net > 0) || !(cost > 0)) return null;
    return Math.round((1 - cost / net) * 100);
  }

  /** "4 bottles + 3 glasses" style reading of a wine's stock. */
  function wineStock(item) {
    const onHand = Math.max(0, num(item.onHand, 0));
    const bottles = Math.floor(onHand + 1e-9);
    const glass = serveOf(item, 'glass');
    if (!glass) return { bottles: round(onHand, 2), glasses: 0, text: fmtQty(round(onHand, 2)) + ' btl' };
    const glasses = Math.floor((onHand - bottles) / glass.portion + 1e-6);
    const total = Math.floor(onHand / glass.portion + 1e-6);
    return { bottles: bottles, glasses: glasses, totalGlasses: total, text: bottles + ' btl' + (glasses ? ' + ' + glasses + ' gl' : '') };
  }

  /* ---------- stock movements ----------
   * Counts set an item's stock outright (onHand at baseAt). Sales, deliveries and +/- adjustments are
   * movements kept in per-device documents ("moves"), so two phones selling at once never overwrite
   * each other. Stock shown = onHand + every movement recorded after baseAt. */

  function movesByItem(moveDocs) {
    const by = {};
    (moveDocs || []).forEach(function (doc) {
      (doc.entries || []).forEach(function (e) {
        if (!e || !e.i) return;
        (by[e.i] = by[e.i] || []).push(e);
      });
    });
    return by;
  }

  /** Items with onHand replaced by the live figure. Shown stock never goes below zero. */
  function applyMoves(items, moveDocs) {
    const by = movesByItem(moveDocs);
    return (items || []).map(function (item) {
      const list = by[item.id];
      if (!list) return item;
      const base = num(item.baseAt, 0);
      let delta = 0;
      list.forEach(function (e) { if (num(e.t, 0) > base) delta += num(e.q, 0); });
      if (!delta) return item;
      return Object.assign({}, item, { onHand: Math.max(0, round(num(item.onHand, 0) + delta, 3)), rawOnHand: num(item.onHand, 0) });
    });
  }

  /**
   * Folds movements older than a month into the counted figure, so the app only needs to load recent
   * movement documents. The cut-off is a fixed day boundary, so two phones doing this at once write
   * the same numbers. Returns [{id, onHand, baseAt}] to save.
   */
  function consolidation(items, moveDocs, now) {
    const t = now instanceof Date ? now : new Date(now || Date.now());
    const cutoff = addDays(t, -2).getTime();
    const old = t.getTime() - 30 * DAY_MS;
    const by = movesByItem(moveDocs);
    const out = [];
    (items || []).forEach(function (item) {
      const list = by[item.id];
      if (!list) return;
      const base = num(item.baseAt, 0);
      if (!list.some(function (e) { return num(e.t, 0) > base && num(e.t, 0) < old; })) return;
      let delta = 0;
      list.forEach(function (e) { const et = num(e.t, 0); if (et > base && et <= cutoff) delta += num(e.q, 0); });
      out.push({ id: item.id, onHand: round(num(item.onHand, 0) + delta, 3), baseAt: cutoff });
    });
    return out;
  }

  /** Sales between two dates (inclusive), per item and serve. */
  function salesSummary(moveDocs, items, fromIso, toIso) {
    const byId = {};
    (items || []).forEach(function (i) { byId[i.id] = i; });
    const rows = {};
    let qty = 0, revenue = 0;
    const sources = { bar: 0, pos: 0 };
    (moveDocs || []).forEach(function (doc) {
      if (!doc.date || doc.date < fromIso || doc.date > toIso) return;
      (doc.entries || []).forEach(function (e) {
        if (e.k !== 'sale') return;
        const n = num(e.n, 0);
        const p = num(e.p, 0);
        const key = e.i + '|' + (e.s || '');
        const item = byId[e.i];
        const serve = serveOf(item, e.s);
        const row = rows[key] || (rows[key] = { itemId: e.i, serveId: e.s || '', name: item ? item.name : (e.name || 'Removed item'), label: serve ? serve.label : (e.s || ''), qty: 0, revenue: 0 });
        row.qty += n;
        row.revenue += n * p;
        qty += n;
        revenue += n * p;
        sources[e.src === 'pos' ? 'pos' : 'bar'] += n;
      });
    });
    const list = Object.keys(rows).map(function (k) { const r = rows[k]; r.revenue = round(r.revenue, 2); return r; })
      .sort(function (a, b) { return b.revenue - a.revenue || b.qty - a.qty || a.name.localeCompare(b.name); });
    return { rows: list, qty: round(qty, 2), revenue: round(revenue, 2), sources: sources };
  }

  /* ---------- importing the till's sales report (Hypersoft) ---------- */

  const SALES_SYNONYMS = {
    name: FIELD_SYNONYMS.name.concat(['artikeltext', 'plu-text', 'plu text', 'bezeichnung 1']),
    sku: FIELD_SYNONYMS.sku,
    qty: ['qty', 'quantity', 'количество', 'продадено количество', 'продадени', 'брой', 'бр', 'бр.', 'к-во', 'menge', 'anzahl', 'stück', 'stk', 'stk.', 'count', 'sold', 'verkauft', 'verkaufte menge', 'määrä', 'lkm', 'kpl'],
    revenue: ['revenue', 'total', 'sales', 'amount', 'оборот', 'сума', 'стойност', 'общо', 'продажби', 'сума с ддс', 'umsatz', 'betrag', 'summe', 'brutto', 'umsatz brutto', 'gesamt', 'myynti', 'summa']
  };

  function mapHeadersWith(headers, synonyms) {
    const mapping = {};
    const used = {};
    const norm = headers.map(normHeader);
    [true, false].forEach(function (exact) {
      Object.keys(synonyms).forEach(function (field) {
        if (mapping[field] !== undefined) return;
        for (let i = 0; i < norm.length; i++) {
          if (used[i] || !norm[i]) continue;
          const hit = exact
            ? synonyms[field].indexOf(norm[i]) > -1
            : synonyms[field].some(function (s) { return s.length > 2 && (norm[i].indexOf(s + ' ') === 0 || norm[i].indexOf(s + '.') === 0); });
          if (hit) { mapping[field] = i; used[i] = true; return; }
        }
      });
    });
    return mapping;
  }

  function mapSalesHeaders(headers) { return mapHeadersWith(headers, SALES_SYNONYMS); }

  function normName(s) {
    return String(s || '').toLowerCase().replace(/[„“”"'’]/g, '').replace(/\s+/g, ' ').trim();
  }

  /** Sales report rows, added up per article. */
  function rowsToSales(rows, mapping) {
    const by = {};
    const order = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const get = function (f) { return mapping[f] === undefined ? '' : String(row[mapping[f]] === undefined ? '' : row[mapping[f]]).trim(); };
      const name = get('name');
      const qty = parseNum(get('qty'));
      if (!name || !Number.isFinite(qty) || qty === 0) continue;
      if (/^(summe|total|gesamt|sum|yhteensä|общо|всичко)(\s|$|:)/i.test(name)) continue;
      const key = normName(name);
      if (!by[key]) { by[key] = { key: key, name: name, sku: get('sku'), qty: 0, revenue: 0, hasRevenue: false }; order.push(key); }
      by[key].qty += qty;
      const rev = parseNum(get('revenue'));
      if (Number.isFinite(rev)) { by[key].revenue += rev; by[key].hasRevenue = true; }
    }
    return order.map(function (k) { const x = by[k]; x.qty = round(x.qty, 3); x.revenue = round(x.revenue, 2); return x; });
  }

  const GLASS_HINT = /(^|[^a-z0-9])(glas|glass|gl\.?|lasi|чаша|0[.,]1|0[.,]125|0[.,]15|0[.,]2|1\/8|1\/4|1[0-9]\s?cl|[0-9]{2,3}\s?ml)([^a-z0-9]|$)/i;
  const BOTTLE_HINT = /(^|[^a-z0-9])(fl\.?|flasche|bottle|btl|pullo|бутилка|0[.,]75|0[.,]7|75\s?cl)([^a-z0-9]|$)/i;

  /** Best guess of which item and serve a till article is: {itemId, serveId} | {ignore: true} | null. */
  function matchSale(row, items, posMap) {
    const remembered = posMap && posMap[row.key || normName(row.name)];
    if (remembered) return remembered;
    const sellable = (items || []).filter(function (i) { return servesOf(i).length; });
    let item = null;
    if (row.sku) item = sellable.find(function (i) { return i.sku && String(i.sku).toLowerCase() === String(row.sku).toLowerCase(); }) || null;
    if (!item) {
      const rn = normName(row.name);
      let best = 0;
      sellable.forEach(function (i) {
        const inn = normName(i.name);
        if (inn.length < 3) return;
        const score = rn === inn ? 1000 : rn.indexOf(inn) > -1 ? inn.length : (inn.indexOf(rn) > -1 && rn.length >= 4 ? rn.length : 0);
        if (score > best) { best = score; item = i; }
      });
    }
    if (!item) return null;
    const serves = servesOf(item);
    const glass = serves.find(function (s) { return s.id === 'glass'; });
    const serveId = glass && GLASS_HINT.test(row.name) && !BOTTLE_HINT.test(row.name) ? 'glass' : serves[0].id;
    return { itemId: item.id, serveId: serveId };
  }

  /** Short stable hash, used to give an imported report a fixed id so importing it twice replaces it. */
  function hash(str) {
    let h = 5381;
    const s = String(str);
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  /* ---------- the kitchen (Komat Kitchen Book) ---------- */

  const KITCHEN_BASICS = ['сол', 'морска сол', 'пипер', 'вода', 'лед', 'salt', 'pepper', 'water', 'ice'];
  const STATIONS = { hot: 'Hot', cold: 'Cold', pass: 'Pass & pastry' };

  function cleanProductName(n) {
    return String(n || '')
      .replace(/\([^)]*\)/g, ' ')
      .split(/[,;]/)[0]
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * The products a set of recipes uses, for building the stock list. In-house preparations (anything
   * that is itself a recipe or recipe part) and basics like salt and water are left out.
   */
  function kitchenProducts(recipes) {
    const preps = {};
    (recipes || []).forEach(function (r) {
      preps[normName(cleanProductName(r.name))] = true;
      (r.components || []).forEach(function (c) { preps[normName(cleanProductName(c.name))] = true; });
    });
    const by = {};
    (recipes || []).forEach(function (r) {
      const lists = [{ station: r.station, ings: r.ingredients || [] }].concat((r.components || []).map(function (c) { return { station: c.station || r.station, ings: c.ingredients || [] }; }));
      lists.forEach(function (l) {
        l.ings.forEach(function (g) {
          const name = cleanProductName(g && g.n);
          const key = normName(name);
          if (key.length < 2 || preps[key] || KITCHEN_BASICS.indexOf(key) > -1) return;
          const p = by[key] || (by[key] = { name: name.charAt(0).toUpperCase() + name.slice(1), units: [], usedIn: [], stations: [], onMenu: false });
          const u = String((g && g.u) || '').trim();
          if (u && p.units.indexOf(u) < 0) p.units.push(u);
          if (r.name && p.usedIn.indexOf(r.name) < 0) p.usedIn.push(r.name);
          if (l.station && p.stations.indexOf(l.station) < 0) p.stations.push(l.station);
          if (r.onMenu) p.onMenu = true;
        });
      });
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return (b.onMenu - a.onMenu) || b.usedIn.length - a.usedIn.length || a.name.localeCompare(b.name); });
  }

  /** The stock unit to count a recipe product in. */
  function stockUnitFor(units) {
    const u = (units || []).map(function (x) { return String(x).toLowerCase(); });
    if (u.indexOf('g') > -1 || u.indexOf('kg') > -1) return 'kg';
    if (u.indexOf('ml') > -1 || u.indexOf('l') > -1) return 'l';
    return u[0] || 'pcs';
  }

  /**
   * Kitchen order checks (Out / Low per product, per station) matched to stock items.
   * requests: [{date, station, at, items: [{n, s, note}]}]. Returns one row per product.
   */
  function kitchenAsks(requests, items, kitchenMap) {
    const byName = {};
    (items || []).forEach(function (i) { byName[normName(i.name)] = i; });
    const rows = {};
    (requests || []).slice().sort(function (a, b) { return num(a.at, 0) - num(b.at, 0); }).forEach(function (req) {
      (req.items || []).forEach(function (x) {
        const key = normName(x.n);
        if (!key) return;
        const mapped = kitchenMap && kitchenMap[key];
        const item = (mapped && (items || []).find(function (i) { return i.id === mapped; })) || byName[key] || byName[normName(cleanProductName(x.n))] || null;
        const prev = rows[key];
        rows[key] = {
          key: key,
          name: x.n,
          status: prev && prev.status === 'out' ? 'out' : (x.s === 'out' ? 'out' : 'low'),
          note: [prev && prev.note, x.note].filter(Boolean).join(' · '),
          stations: (prev ? prev.stations : []).concat(prev && prev.stations.indexOf(req.station) > -1 ? [] : [req.station]),
          at: num(req.at, 0),
          date: req.date,
          itemId: item ? item.id : null
        };
      });
    });
    return Object.keys(rows).map(function (k) { return rows[k]; })
      .sort(function (a, b) { return (a.status === 'out' ? 0 : 1) - (b.status === 'out' ? 0 : 1) || a.name.localeCompare(b.name); });
  }

  /** Kitchen Book events as bookings (confirmed ones count as covers; guests can be "40" or "35-40"). */
  function eventBookings(events) {
    return (events || []).filter(function (e) { return e && e.date && e.status !== 'cancelled'; }).map(function (e) {
      const nums = String(e.guests || '').match(/\d+/g) || [];
      const covers = nums.length ? Math.max.apply(null, nums.map(Number)) : 0;
      return { id: 'kev-' + (e.id || e.date), date: e.date, time: e.time || '', name: e.title || 'Event', covers: covers, note: [e.kind, e.menu].filter(Boolean).join(' · '), source: 'kitchen', status: e.status === 'pending' ? 'pending' : 'booked' };
    });
  }

  /* ---------- the daily cash report (Google Sheet, one sheet per day) ----------
   * Layout per day: НАЧАЛО (opening cash); РАЗХОДИ label + amount in columns A-B (cash out);
   * ПРИХОДИ label + amount in columns C-D (cash in); ОБЩО totals; ОСТАТЪК (cash left). */

  function cellText(v) { return String(v === null || v === undefined ? '' : v).trim(); }
  function cellNum(v) {
    if (typeof v === 'number') return v;
    const n = parseNum(cellText(v).replace(/^(lev|лв\.?|bgn|eur|€)\s*/i, '').replace(/\s*(lev|лв\.?|bgn|eur|€)$/i, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function parseCashDay(rows) {
    const day = { name: '', opening: 0, out: [], in: [], closing: null };
    let started = false;
    (rows || []).forEach(function (row, r) {
      row = row || [];
      const a = cellText(row[0]);
      const c = cellText(row[2]);
      if (r === 0 && c && !/^име$/i.test(c)) day.name = c;
      if (/^начало/i.test(a)) { day.opening = round(cellNum(row[1]), 2); return; }
      if (/^остатък/i.test(a)) { day.closing = round(cellNum(row[1]), 2); return; }
      if (/^разход/i.test(a) || /^приход/i.test(c)) { started = true; return; }
      if (!started) return;
      if (a && !/^общо/i.test(a) && cellNum(row[1]) > 0) day.out.push({ label: a, amount: round(cellNum(row[1]), 2) });
      if (c && !/^общо/i.test(c) && cellNum(row[3]) > 0) day.in.push({ label: c, amount: round(cellNum(row[3]), 2) });
    });
    day.totalOut = round(day.out.reduce(function (t, x) { return t + x.amount; }, 0), 2);
    day.totalIn = round(day.in.reduce(function (t, x) { return t + x.amount; }, 0), 2);
    const computed = round(day.opening - day.totalOut + day.totalIn, 2);
    if (day.closing === null) day.closing = computed;
    day.filled = day.out.length > 0 || day.in.length > 0;
    return day;
  }

  /** Who the cash went to: the first word of each line ("Метро", "Еконт", "Пране"). */
  function payeeKey(label) {
    return normName(label).replace(/[^0-9a-zа-я\s]/gi, ' ').trim().split(/\s+/)[0] || '';
  }

  /** A whole month: sheets [{name, rows}] named 1..31. */
  function cashMonth(sheets) {
    const days = (sheets || []).filter(function (sh) { return /^\d{1,2}$/.test(String(sh.name).trim()); })
      .map(function (sh) { return Object.assign({ day: Number(String(sh.name).trim()) }, parseCashDay(sh.rows)); })
      .sort(function (a, b) { return a.day - b.day; });
    const filled = days.filter(function (d) { return d.filled; });
    const payees = {};
    filled.forEach(function (d) {
      d.out.forEach(function (x) {
        const k = payeeKey(x.label);
        if (!k) return;
        const p = payees[k] || (payees[k] = { key: k, label: x.label.split(/[\s/,(]+/)[0], amount: 0, count: 0 });
        p.amount = round(p.amount + x.amount, 2);
        p.count += 1;
      });
    });
    const last = filled[filled.length - 1] || null;
    return {
      days: days,
      filled: filled.length,
      totalOut: round(filled.reduce(function (t, d) { return t + d.totalOut; }, 0), 2),
      totalIn: round(filled.reduce(function (t, d) { return t + d.totalIn; }, 0), 2),
      lastDay: last ? last.day : null,
      cashNow: last ? last.closing : null,
      payees: Object.keys(payees).map(function (k) { return payees[k]; }).sort(function (a, b) { return b.amount - a.amount; })
    };
  }

  /** A Google Sheets file id from a link or a bare id. */
  function sheetId(link) {
    const s = String(link || '').trim();
    const m = /\/d\/([A-Za-z0-9_-]{20,})/.exec(s);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : '';
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
    WINE_COLOURS: WINE_COLOURS,
    servesOf: servesOf,
    serveOf: serveOf,
    serveMargin: serveMargin,
    wineStock: wineStock,
    applyMoves: applyMoves,
    consolidation: consolidation,
    salesSummary: salesSummary,
    mapSalesHeaders: mapSalesHeaders,
    rowsToSales: rowsToSales,
    matchSale: matchSale,
    normName: normName,
    hash: hash,
    STATIONS: STATIONS,
    cleanProductName: cleanProductName,
    kitchenProducts: kitchenProducts,
    stockUnitFor: stockUnitFor,
    kitchenAsks: kitchenAsks,
    eventBookings: eventBookings,
    parseCashDay: parseCashDay,
    cashMonth: cashMonth,
    payeeKey: payeeKey,
    sheetId: sheetId,
    FIELD_SYNONYMS: FIELD_SYNONYMS
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KomatLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
