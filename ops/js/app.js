/* Komat Back Office: user interface.
 * Plain DOM: each view is a function returning HTML; one delegated listener per event type.
 * All record text goes through esc() because shared data is written by other people. */
(function () {
  'use strict';

  const L = window.KomatLogic;
  const store = window.KomatStore;
  const net = window.KomatConnect;

  const VIEWS = ['today', 'stock', 'orders', 'bar', 'bookings', 'cash', 'invoices', 'inbox', 'setup'];
  const OFFICE = ['cash', 'invoices', 'inbox'];
  const COLS = ['items', 'suppliers', 'orders', 'reservations', 'moves', 'kitchen'];
  const PREFS_KEY = 'komat-backoffice-prefs';
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'bunch', 'bottle', 'can', 'keg', 'pack', 'box', 'case', 'tray', 'portion'];

  const viewEl = document.getElementById('view');
  const sheetRoot = document.getElementById('sheet-root');
  const toastEl = document.getElementById('toast');

  /* ---------- per-viewer preferences (this browser only) ---------- */

  function prefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch (e) { return {}; }
  }
  function setPref(key, value) {
    try { const p = prefs(); p[key] = value; localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) { /* not saved: fine */ }
  }

  const ui = {
    view: 'today',
    stock: { q: '', status: 'all', location: 'all', counting: false, draft: {} },
    orders: { tab: 'suggested' },
    bookings: { day: L.isoDate(new Date()) },
    bar: { tab: 'wines', q: '', range: 'today', last: null },
    cash: { state: 'idle' },
    mail: {},
    watches: {},
    gmailOn: !!prefs().gmailOn,
    gmailBusy: false,
    gmailNote: null,
    confirm: null,
    sheet: null
  };

  /* ---------- helpers ---------- */

  function esc(v) {
    return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  let moneyFmt = null, moneyCur = null;
  function money(n) {
    const cur = String(store.settings.currency || 'EUR').toUpperCase();
    if (cur !== moneyCur) {
      try { moneyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }); }
      catch (e) { moneyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }); }
      moneyCur = cur;
    }
    return moneyFmt.format(Number(n) || 0);
  }

  const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const longFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  function fmtDay(iso) { const d = L.fromIso(iso); return d ? dayFmt.format(d) : ''; }
  function relDay(iso) {
    if (!iso) return '';
    const now = new Date();
    if (iso === L.isoDate(now)) return 'today';
    if (iso === L.isoDate(L.addDays(now, 1))) return 'tomorrow';
    if (iso === L.isoDate(L.addDays(now, -1))) return 'yesterday';
    return fmtDay(iso);
  }
  function ago(ms) {
    if (!ms) return '';
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    const d = new Date(ms);
    return dayFmt.format(d);
  }
  function byName(a, b) { return String(a.name || '').localeCompare(String(b.name || '')); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function qtyText(n) { return L.fmtQty(L.num(n, 0)); }
  function stepFor(item) { return /^(kg|l|litre|liter|lt)$/i.test(String(item.unit || '').trim()) ? 0.5 : 1; }
  function namesOf(list, max) {
    const n = list.slice(0, max || 3).map(function (x) { return x.name; }).join(', ');
    return list.length > (max || 3) ? n + ' +' + (list.length - (max || 3)) : n;
  }

  const ICON = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="m9 13 2 2 4-4"/></svg>',
    stock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8 12 3l9 5v8l-9 5-9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
    orders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 6h11v10H2zM13 10h4l4 4v2h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
    bookings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>'
  };

  /* ---------- toast ---------- */

  let toastTimer = null;
  function toast(text, kind) {
    toastEl.textContent = text;
    toastEl.className = 'toast' + (kind === 'bad' ? ' bad' : '');
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, kind === 'bad' ? 6000 : 3200);
  }

  async function copyText(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      toast((what || 'Text') + ' copied');
      return true;
    } catch (e) {
      toast('Copying is blocked here. Select the text and copy it by hand.', 'bad');
      return false;
    }
  }

  /* ---------- derived numbers for the current render ---------- */

  function derive() {
    const now = new Date();
    const todayIso = L.isoDate(now);
    const yesterdayIso = L.isoDate(L.addDays(now, -1));
    const moves = store.list('moves');
    const items = L.applyMoves(store.list('items'), moves).sort(byName);
    const suppliers = store.list('suppliers').sort(byName);
    const orders = store.list('orders').sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
    // Kitchen Book data copied into the "kitchen" collection: station order checks, events, products.
    const kdocs = store.list('kitchen');
    const kitchenRequests = kdocs.filter(function (k) { return /^req-/.test(k.id) && k.date >= yesterdayIso; });
    const kitchenEvents = L.eventBookings(kdocs.filter(function (k) { return /^ev-/.test(k.id); }).map(function (k) { return Object.assign({}, k, { id: k.id.slice(3) }); }));
    const ownBookings = store.list('reservations');
    const reservations = ownBookings.concat(kitchenEvents);
    const supplierById = {};
    suppliers.forEach(function (s) { supplierById[s.id] = s; });
    const status = {};
    items.forEach(function (i) { status[i.id] = L.stockStatus(i); });
    const asks = L.kitchenAsks(kitchenRequests, items, store.settings.kitchenMap);
    const boost = L.demandBoost(reservations, store.settings, now);
    const suggestions = L.suggestOrders(items, suppliers, orders, boost.factor, asks);
    const drafts = orders.filter(function (o) { return o.status === 'draft'; });
    const sent = orders.filter(function (o) { return o.status === 'sent'; });
    const draftBySupplier = {};
    drafts.forEach(function (o) { if (!draftBySupplier[o.supplierId]) draftBySupplier[o.supplierId] = o; });
    const toOrder = {};
    suggestions.forEach(function (s) { toOrder[s.supplier.id] = true; });
    drafts.forEach(function (o) { toOrder[o.supplierId] = true; });
    const todays = reservations.filter(function (r) { return r.date === todayIso && r.status !== 'cancelled' && r.status !== 'pending'; });
    const sellable = items.filter(function (i) { return L.servesOf(i).length; });
    return {
      now: now,
      todayIso: todayIso,
      items: items,
      suppliers: suppliers,
      orders: orders,
      reservations: reservations,
      moves: moves,
      supplierById: supplierById,
      status: status,
      out: items.filter(function (i) { return status[i.id] === 'out'; }),
      low: items.filter(function (i) { return status[i.id] === 'low'; }),
      onOrder: L.onOrderMap(orders),
      boost: boost,
      suggestions: suggestions,
      drafts: drafts,
      sent: sent,
      draftBySupplier: draftBySupplier,
      toOrderIds: Object.keys(toOrder),
      deliveriesDue: sent.filter(function (o) { return o.deliveryDate && o.deliveryDate <= todayIso; }),
      todays: todays,
      coversToday: todays.reduce(function (a, r) { return a + L.num(r.covers, 0); }, 0),
      sellable: sellable,
      salesToday: L.salesSummary(moves, items, todayIso, todayIso),
      asks: asks,
      kitchenEvents: kitchenEvents,
      kitchenMeta: store.get('kitchen', 'meta'),
      kitchenProducts: ((store.get('kitchen', 'products') || {}).items) || [],
      hasExamples: [items, suppliers, orders, ownBookings, moves, kdocs].some(function (list) { return list.some(function (x) { return x.example; }); }),
      empty: !items.length && !suppliers.length && !ownBookings.length && !orders.length
    };
  }

  /** One item with its live stock figure. */
  function effItem(id) {
    const raw = store.get('items', id);
    return raw ? L.applyMoves([raw], store.list('moves'))[0] : null;
  }

  /* ---------- shared fragments ---------- */

  function statusPill(status) {
    if (status === 'out') return '<span class="pill out" title="Out of stock">86’d</span>';
    if (status === 'low') return '<span class="pill low">Low</span>';
    if (status === 'new') return '<span class="pill" title="Not counted yet and no par level">Not counted</span>';
    return '<span class="pill ok">OK</span>';
  }
  function orderPill(status) {
    const label = { draft: 'Draft', sent: 'Sent', received: 'Delivered', cancelled: 'Cancelled' }[status] || status;
    return '<span class="pill ' + esc(status) + '">' + esc(label) + '</span>';
  }
  function examplePill(x) { return x && x.example ? '<span class="pill example" title="Example data">Example</span>' : ''; }

  function stat(o) {
    const attrs = o.href ? 'href="' + o.href + '"' + (o.act ? ' data-act="' + o.act + '"' : '') + (o.data || '') : '';
    const tag = o.href ? 'a' : 'div';
    return '<' + tag + ' class="stat ' + (o.cls || '') + '" ' + attrs + '>' +
      '<span class="label">' + esc(o.label) + '</span>' +
      '<span class="value">' + esc(o.value) + '</span>' +
      '<span class="hint">' + (o.hint ? esc(o.hint) : '&nbsp;') + '</span></' + tag + '>';
  }

  function stockRow(item, d, opts) {
    const st = d.status[item.id];
    const sup = d.supplierById[item.supplierId];
    const par = L.num(item.par, 0);
    const onHand = L.num(item.onHand, 0);
    const pct = par > 0 ? Math.min(100, Math.round(onHand / par * 100)) : 0;
    const meta = [];
    if (par > 0) meta.push('par <b>' + esc(qtyText(par)) + ' ' + esc(item.unit || '') + '</b>');
    if (d.onOrder[item.id]) meta.push('<b>' + esc(qtyText(d.onOrder[item.id])) + '</b> on order');
    if (sup) meta.push(esc(sup.name));
    else meta.push('no supplier');
    if (L.num(item.cost, 0) > 0) meta.push(esc(money(item.cost)) + '/' + esc(item.unit || 'unit'));
    const serves = L.servesOf(item);
    if (serves.length) {
      meta.push(serves.map(function (sv) { return esc(sv.id === 'piece' ? 'sells' : sv.label.toLowerCase()) + ' ' + esc(money(sv.price)); }).join(', '));
      if (item.kind === 'wine' && L.serveOf(item, 'glass')) meta.push('<b>' + esc(L.wineStock(item).text) + '</b>');
    } else if (L.num(item.price, 0) > 0) {
      const margin = L.num(item.cost, 0) > 0 ? Math.round((1 - item.cost / item.price) * 100) : null;
      meta.push('sells ' + esc(money(item.price)) + (margin !== null ? ' (' + margin + '% margin)' : ''));
    }
    if (st === 'new') meta.push('count it and set a par level');
    let qty;
    if (opts && opts.counting) {
      const draft = ui.stock.draft[item.id];
      qty = '<label class="sr-only" for="count-' + esc(item.id) + '">Counted ' + esc(item.name) + '</label>' +
        '<input type="text" inputmode="decimal" autocomplete="off" class="count-input' + (draft !== undefined && draft !== '' ? ' changed' : '') + '" id="count-' + esc(item.id) + '" data-count="' + esc(item.id) + '" value="' + esc(draft === undefined ? '' : draft) + '" placeholder="' + esc(qtyText(onHand)) + '">' +
        '<span class="unit">' + esc(item.unit || '') + '</span>';
    } else {
      const ro = store.readOnly ? ' disabled' : '';
      const sid = (opts && opts.idPrefix || '') + esc(item.id);
      qty = '<div class="stepper"><button type="button" id="dec-' + sid + '" data-act="dec" data-id="' + esc(item.id) + '" aria-label="One less ' + esc(item.name) + '"' + ro + '>−</button>' +
        '<button type="button" id="inc-' + sid + '" data-act="inc" data-id="' + esc(item.id) + '" aria-label="One more ' + esc(item.name) + '"' + ro + '>+</button></div>' +
        '<span class="on-hand">' + esc(qtyText(onHand)) + '</span><span class="unit">' + esc(item.unit || '') + '</span>';
    }
    return '<div class="row">' +
      '<div class="row-main"><div class="row-title"><span class="name">' + esc(item.name) + '</span>' + statusPill(st) + examplePill(item) + '</div>' +
      '<div class="row-meta">' + meta.join(' · ') + '</div>' +
      (par > 0 ? '<div class="par-bar" aria-hidden="true"><i class="' + st + '" style="width:' + Math.max(pct, 3) + '%"></i></div>' : '') +
      '</div>' +
      '<div class="qty">' + qty + '</div>' +
      '<button type="button" class="btn ghost sm row-edit" data-act="edit-item" data-id="' + esc(item.id) + '">Edit</button>' +
      '</div>';
  }

  function bookingBars(d, days, selectable) {
    const series = L.bookingsByDay(d.reservations, d.now, days);
    const max = Math.max(10, Math.max.apply(null, series.map(function (s) { return s.covers; })));
    return '<div class="bars' + (days > 7 ? ' wide' : '') + '" style="--days:' + days + '">' + series.map(function (s, i) {
      const dt = L.fromIso(s.date);
      const wd = dt.getDay();
      const h = Math.round(s.covers / max * 100);
      const cls = 'bar' + (i === 0 ? ' today' : '') + (wd === 5 || wd === 6 ? ' weekend' : '');
      const label = i === 0 ? 'Today' : L.WEEKDAYS[wd] + ' ' + dt.getDate();
      return '<button type="button" class="' + cls + '" data-act="pick-day" data-date="' + s.date + '"' +
        (selectable ? ' aria-pressed="' + (ui.bookings.day === s.date) + '"' : '') +
        ' title="' + esc(fmtDay(s.date) + ': ' + plural(s.covers, 'cover') + ', ' + plural(s.bookings, 'booking')) + '">' +
        '<span class="n">' + s.covers + '</span>' +
        '<span class="col"><i style="height:' + (s.covers ? Math.max(h, 4) : 0) + '%"></i></span>' +
        '<span class="d">' + esc(label) + '</span></button>';
    }).join('') + '</div>';
  }

  function boostLine(d) {
    const b = d.boost;
    if (!(b.normal > 0)) {
      return '<p class="normal-line">Next 7 days: <b class="num">' + b.booked + '</b> covers booked. <a href="#setup">Set a normal week</a> so busy weeks raise your orders automatically.</p>';
    }
    if (b.active) {
      return '<p class="normal-line"><span class="pill today">Busy week</span> <b class="num">' + b.booked + '</b> covers booked vs <span class="num">' + b.normal + '</span> normal, so suggested orders are raised <b class="num">×' + b.factor.toFixed(2) + '</b>.</p>';
    }
    return '<p class="normal-line">Next 7 days: <b class="num">' + b.booked + '</b> covers booked vs <span class="num">' + b.normal + '</span> in a normal week. Orders use your normal par levels.</p>';
  }

  function mailList(key, emptyText) {
    const m = ui.mail[key];
    if (!m || m.state === 'loading') return '<div class="loading" style="padding:28px"><div class="spinner"></div><span>Checking Gmail…</span></div>';
    if (m.state === 'error') {
      return '<div class="note bad" style="margin:12px 16px"><p>' + esc(m.error.text) + '</p>' +
        (m.error.allow || m.error.retry ? '<p><button type="button" class="btn sm" data-act="gmail-connect">Try again</button></p>' : '') + '</div>';
    }
    const rows = m.rows || [];
    if (!rows.length) return '<div class="empty"><span>' + esc(emptyText) + '</span></div>';
    return '<div class="mail-list">' + rows.map(function (r) {
      return '<a class="mail" href="' + esc(r.url) + '" target="_blank" rel="noopener">' +
        '<span class="from">' + esc(r.from.replace(/<.*>/, '').trim() || r.from) + (r.count > 1 ? ' <span class="muted small">(' + r.count + ')</span>' : '') + '</span>' +
        '<span class="when">' + esc(r.time ? ago(r.time) : '') + '</span>' +
        '<span class="subject">' + esc(r.subject) + '</span>' +
        (r.snippet ? '<span class="snippet">' + esc(r.snippet) + '</span>' : '') + '</a>';
    }).join('') + '</div>';
  }

  function updatedLine(key) {
    const m = ui.mail[key];
    return m && m.storedAt ? '<span class="muted">Updated ' + esc(ago(m.storedAt)) + '</span>' : '';
  }

  function banners(d) {
    const out = [];
    if (store.readOnly) {
      out.push('<div class="banner warn"><p><b>View only.</b> You can see stock and orders but not change them. Ask the owner to share this page with you as a Contributor or Editor.</p></div>');
    }
    if (store.mode === 'local' && !d.empty) {
      out.push('<div class="banner"><p><b>Saved in this browser only.</b> Open Komat Back Office on claude.ai to share live stock with the team, or export a backup from Setup.</p><a class="btn sm" href="#setup">Setup</a></div>');
    }
    if (d.hasExamples) {
      out.push('<div class="banner"><p><b>You are looking at example data.</b> Try things out, then remove the examples and import your own items from Hype.</p>' +
        '<div class="actions"><button type="button" class="btn sm" data-act="import-items">Import from Hype</button><button type="button" class="btn sm danger" data-act="remove-examples">Remove examples</button></div></div>');
    }
    return out.join('');
  }

  /* ---------- views ---------- */

  function viewWelcome() {
    return '<section class="welcome"><div>' +
      '<p class="eyebrow" style="color:inherit">Komat back office</p>' +
      '<h1>Stock, orders and bookings in one place.</h1>' +
      '<p>Count what is on the shelves, get supplier orders written for you, send them by email and see how busy the week is.</p>' +
      '<div class="actions" style="margin-top:20px"><button type="button" class="btn primary" data-act="load-examples">Load an example kitchen</button>' +
      '<button type="button" class="btn" data-act="import-items">Import items from Hype</button></div></div>' +
      '<ol class="steps">' +
      '<li><div><b>Bring in your stock from Hype</b>Export the stock list from Hype (Excel or CSV) and import it. Do it again whenever you want fresh numbers.</div></li>' +
      '<li><div><b>Add your suppliers</b>Their order email, order days and delivery time. Link each item to its supplier.</div></li>' +
      '<li><div><b>Count and order</b>Count stock after service. Anything at or below its reorder point lands in a ready-to-send order.</div></li>' +
      '</ol></section>' +
      (store.readOnly ? '' : '<div class="actions"><button type="button" class="btn" data-act="new-item">' + ICON.plus + 'Add an item</button><button type="button" class="btn" data-act="new-supplier">' + ICON.plus + 'Add a supplier</button><button type="button" class="btn" data-act="new-booking">' + ICON.plus + 'Add a booking</button></div>');
  }

  function greeting(now) {
    const h = now.getHours();
    return h < 11 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  function viewToday(d) {
    if (d.empty) return viewWelcome();
    const s = store.settings;
    const head = '<div class="page-head"><div><p class="eyebrow">' + esc(longFmt.format(d.now)) + ' · ' + esc(s.restaurant || 'Komat') + '</p>' +
      '<h1>' + greeting(d.now) + '. Here is today.</h1></div>' +
      '<div class="actions"><a class="btn" href="#stock" data-act="count-start">Count stock</a><a class="btn primary" href="#orders" data-act="orders-tab" data-tab="suggested">Review orders</a></div></div>';

    const supplierNames = d.toOrderIds.map(function (id) { return d.supplierById[id] && d.supplierById[id].name; }).filter(Boolean);
    const strip = '<div class="strip">' +
      stat({ cls: d.out.length ? 'bad' : '', label: '86’d (out)', value: d.out.length, hint: d.out.length ? namesOf(d.out) : 'nothing out', href: '#stock', act: 'filter-stock', data: ' data-status="out"' }) +
      stat({ cls: d.low.length ? 'warn' : '', label: 'Running low', value: d.low.length, hint: d.low.length ? namesOf(d.low) : 'all above reorder point', href: '#stock', act: 'filter-stock', data: ' data-status="low"' }) +
      stat({ cls: d.toOrderIds.length ? 'hot' : '', label: 'Orders to send', value: d.toOrderIds.length, hint: supplierNames.join(', ') || 'nothing to order', href: '#orders', act: 'orders-tab', data: ' data-tab="suggested"' }) +
      stat({ label: 'Deliveries due', value: d.deliveriesDue.length, hint: d.deliveriesDue.map(function (o) { return (d.supplierById[o.supplierId] || {}).name; }).filter(Boolean).join(', ') || 'none due', href: '#orders', act: 'orders-tab', data: ' data-tab="open"' }) +
      stat({ label: 'Covers today', value: d.coversToday, hint: plural(d.todays.length, 'booking'), href: '#bookings', act: 'pick-day', data: ' data-date="' + d.todayIso + '"' }) +
      '</div>';

    // Suppliers to order from, today's order days first.
    const groups = d.toOrderIds.map(function (id) {
      const sup = d.supplierById[id];
      if (!sup) return null;
      const sug = d.suggestions.find(function (g) { return g.supplier.id === id; });
      const draft = d.draftBySupplier[id];
      return { sup: sup, sug: sug, draft: draft, nod: L.nextOrderDay(sup, d.now) };
    }).filter(Boolean).sort(function (a, b) {
      const ai = a.nod ? a.nod.inDays : 9, bi = b.nod ? b.nod.inDays : 9;
      return ai - bi || ((b.sug && b.sug.outCount) || 0) - ((a.sug && a.sug.outCount) || 0);
    });
    const orderCards = groups.length ? '<div class="order-cards">' + groups.map(function (g) {
      const lines = g.draft ? g.draft.lines || [] : g.sug.lines;
      const today = g.nod && g.nod.inDays === 0;
      const when = !g.nod ? '<span class="pill">No order days set</span>'
        : today ? '<span class="pill today">Order today' + (g.sup.cutoff ? ' by ' + esc(g.sup.cutoff) : '') + '</span>'
          : '<span class="pill">Next order day ' + esc(g.nod.inDays === 1 ? 'tomorrow' : g.nod.weekday) + '</span>';
      const chips = lines.slice(0, 5).map(function (l) {
        const st = d.status[l.itemId];
        return '<span class="pill ' + (st === 'out' ? 'out' : st === 'low' ? 'low' : '') + '">' + esc(l.name) + '</span>';
      }).join('') + (lines.length > 5 ? '<span class="pill">+' + (lines.length - 5) + ' more</span>' : '');
      return '<article class="order-card' + (today ? ' urgent' : '') + '"><header><div><span class="who">' + esc(g.sup.name) + '</span>' +
        '<span class="small muted">' + plural(lines.length, 'line') + ' · about ' + esc(money(L.orderTotal({ lines: lines }))) + (g.draft ? ' · draft started' : '') + '</span></div>' + when + '</header>' +
        '<div class="chips-inline">' + chips + '</div>' +
        '<div class="actions"><button type="button" class="btn ' + (today ? 'primary' : '') + ' sm" data-act="start-order" data-supplier="' + esc(g.sup.id) + '">' + (g.draft ? 'Open draft' : 'Review order') + '</button></div></article>';
    }).join('') + '</div>'
      : '<div class="empty"><strong>Nothing to order</strong><span>Every item with a supplier is above its reorder point.</span></div>';

    const urgent = d.out.concat(d.low).slice(0, 8);
    const lowPanel = '<section class="panel flush"><div class="section-head"><h2>Running low</h2><a class="small" href="#stock" data-act="filter-stock" data-status="all">All stock</a></div>' +
      (urgent.length ? '<div class="rows">' + urgent.map(function (i) { return stockRow(i, d); }).join('') + '</div>'
        : '<div class="empty"><span>Nothing is low. Count stock after service to keep this honest.</span></div>') + '</section>';

    const deliveries = d.sent.slice().sort(function (a, b) { return String(a.deliveryDate || '9').localeCompare(String(b.deliveryDate || '9')); });
    const delPanel = '<section class="panel flush"><div class="section-head"><h2>Deliveries expected</h2></div>' +
      (deliveries.length ? '<div class="rows">' + deliveries.slice(0, 6).map(function (o) {
        const sup = d.supplierById[o.supplierId] || {};
        const late = o.deliveryDate && o.deliveryDate < d.todayIso;
        return '<div class="row"><div class="row-main"><div class="row-title"><span class="name">' + esc(sup.name || 'Supplier') + '</span>' +
          (late ? '<span class="pill low">Late</span>' : o.deliveryDate === d.todayIso ? '<span class="pill today">Today</span>' : '') + examplePill(o) + '</div>' +
          '<div class="row-meta">' + plural((o.lines || []).length, 'line') + ' · due ' + esc(relDay(o.deliveryDate) || 'no date') + ' · ' + esc(o.number || '') + '</div></div>' +
          '<span></span><button type="button" class="btn sm" data-act="receive-order" data-id="' + esc(o.id) + '">Check in</button></div>';
      }).join('') + '</div>' : '<div class="empty"><span>No orders on the way.</span></div>') + '</section>';

    const bookPanel = '<section class="panel"><div class="section-head"><h2>Covers this week</h2><a class="small" href="#bookings">Bookings</a></div>' +
      bookingBars(d, 7, false) + boostLine(d) + '</section>';

    let mailPanel;
    if (net.gmail() && ui.gmailOn) {
      mailPanel = '<section class="panel flush"><div class="section-head"><h2>Supplier mail</h2><a class="small" href="#inbox">Inbox</a></div>' +
        (L.supplierQuery(d.suppliers) ? mailList('suppliers', 'No mail from your suppliers in the last 30 days.') : '<div class="empty"><span>Add supplier email addresses to see their replies here.</span></div>') + '</section>';
    } else {
      mailPanel = '<section class="panel"><div class="section-head"><h2>Supplier mail</h2></div><p class="small muted" style="margin:0">' +
        (net.gmail() ? 'Connect Gmail to see order confirmations, invoices and booking emails here. <a href="#inbox">Connect Gmail</a>'
          : 'Order confirmations and invoices show up here when Komat Back Office is opened on claude.ai with Gmail connected.') + '</p></section>';
    }

    const sold = d.salesToday;
    const shortDrinks = d.sellable.filter(function (i) { return d.status[i.id] === 'out' || d.status[i.id] === 'low'; });
    const barPanel = d.sellable.length ? '<section class="panel stack"><div class="section-head"><h2>Bar today</h2><a class="small" href="#bar">Bar</a></div>' +
      '<p style="margin:0"><b class="num">' + esc(qtyText(sold.qty)) + '</b> sold · <b class="num">' + esc(money(sold.revenue)) + '</b>' +
      (sold.rows.length ? '<span class="muted small"> · best: ' + esc(sold.rows.slice(0, 3).map(function (r) { return r.name + ' ' + r.label.toLowerCase(); }).join(', ')) + '</span>' : '') + '</p>' +
      (shortDrinks.length ? '<p class="small" style="margin:0"><b>Tell the floor:</b> ' + shortDrinks.map(function (i) {
        return esc(i.name) + (d.status[i.id] === 'out' ? ' is 86’d' : ' (' + esc(i.kind === 'wine' ? L.wineStock(i).text : qtyText(i.onHand) + ' left') + ')');
      }).join(' · ') + '</p>' : '') + '</section>' : '';

    return head + banners(d) + strip +
      '<div class="grid-2"><div class="stack"><section class="panel"><div class="section-head"><h2>Orders to send</h2>' +
      (d.boost.active ? '<span class="pill today">Busy week ×' + d.boost.factor.toFixed(2) + '</span>' : '') + '</div>' + orderCards + '</section>' + kitchenPanel(d) + lowPanel + '</div>' +
      '<div class="stack">' + bookPanel + barPanel + delPanel + mailPanel + '</div></div>';
  }

  function viewStock(d) {
    const st = ui.stock;
    const q = st.q.trim().toLowerCase();
    const locations = Array.from(new Set(d.items.map(function (i) { return i.location || 'No location'; }))).sort();
    if (st.location !== 'all' && locations.indexOf(st.location) < 0) st.location = 'all';
    const list = d.items.filter(function (i) {
      if (st.status !== 'all' && d.status[i.id] !== st.status) return false;
      if (st.location !== 'all' && (i.location || 'No location') !== st.location) return false;
      if (q) {
        const sup = d.supplierById[i.supplierId];
        const hay = [i.name, i.category, i.location, i.sku, sup && sup.name].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    const value = d.items.reduce(function (a, i) { return a + L.num(i.onHand, 0) * L.num(i.cost, 0); }, 0);
    const counting = st.counting;
    const changed = Object.keys(st.draft).filter(function (k) { return st.draft[k] !== '' && st.draft[k] !== undefined; }).length;

    const head = '<div class="page-head"><div><p class="eyebrow">Stock room</p><h1>' + (counting ? 'Stock count' : 'Stock') + '</h1>' +
      '<p class="muted small" style="margin:4px 0 0">' + plural(d.items.length, 'item') + ' · ' + esc(money(value)) + ' on the shelves · ' + d.out.length + ' out · ' + d.low.length + ' low</p></div>' +
      '<div class="actions">' + (counting ? '' :
        '<button type="button" class="btn" data-act="count-start">Count stock</button>' +
        '<button type="button" class="btn" data-act="import-items">Update from Hype</button>' +
        (d.kitchenProducts.length ? '<button type="button" class="btn" data-act="import-kitchen">From Kitchen Book</button>' : '') +
        '<button type="button" class="btn" data-act="export-items">Export</button>' +
        '<button type="button" class="btn primary" data-act="new-item">' + ICON.plus + 'Item</button>') + '</div></div>';

    const seg = function (val, label) {
      return '<button type="button" data-act="stock-status" data-status="' + val + '" aria-pressed="' + (st.status === val) + '">' + label + '</button>';
    };
    const toolbar = '<div class="toolbar"><label class="search" for="stock-q">' + ICON.search +
      '<input type="search" id="stock-q" data-bind="stock-q" placeholder="Search items, suppliers, locations" value="' + esc(st.q) + '" autocomplete="off"></label>' +
      '<div class="seg" role="group" aria-label="Filter by status">' + seg('all', 'All') + seg('out', '86’d') + seg('low', 'Low') + seg('ok', 'OK') + '</div>' +
      '<label class="sr-only" for="stock-loc">Storage location</label><select id="stock-loc" data-bind="stock-loc" style="width:auto"><option value="all">All locations</option>' +
      locations.map(function (l) { return '<option' + (st.location === l ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select></div>';

    const countNote = counting ? '<div class="banner"><p><b>Walk the stores and type what is on the shelf.</b> Leave a box empty to keep the current number. Grouped by storage location.</p></div>' : '';

    let body;
    if (!d.items.length) {
      body = '<div class="empty"><strong>No items yet</strong><span>Import your article list from Hype or add the first item.</span>' +
        '<div class="actions"><button type="button" class="btn primary" data-act="import-items">Import CSV</button><button type="button" class="btn" data-act="new-item">Add item</button><button type="button" class="btn" data-act="load-examples">Load examples</button></div></div>';
    } else if (!list.length) {
      body = '<div class="empty"><span>No items match. <button type="button" class="btn ghost sm" data-act="stock-reset">Clear filters</button></span></div>';
    } else {
      const groups = {};
      list.forEach(function (i) { const k = i.location || 'No location'; (groups[k] = groups[k] || []).push(i); });
      body = Object.keys(groups).sort().map(function (loc) {
        return '<div class="group-label"><span>' + esc(loc) + '</span><span>' + groups[loc].length + '</span></div>' +
          groups[loc].map(function (i) { return stockRow(i, d, { counting: counting }); }).join('');
      }).join('');
    }

    const countbar = counting ? '<div class="countbar"><span><b class="num">' + changed + '</b> ' + (changed === 1 ? 'item' : 'items') + ' counted</span>' +
      '<div class="actions"><button type="button" class="btn sm" data-act="count-cancel">Cancel</button><button type="button" class="btn primary sm" data-act="count-save"' + (changed ? '' : ' disabled') + '>Save count</button></div></div>' : '';

    return head + banners(d) + countNote + toolbar + '<section class="panel flush"><div class="rows">' + body + '</div></section>' + countbar;
  }

  function viewOrders(d) {
    const tab = ui.orders.tab;
    const open = d.orders.filter(function (o) { return o.status === 'draft' || o.status === 'sent'; });
    const history = d.orders.filter(function (o) { return o.status === 'received' || o.status === 'cancelled'; });
    const seg = function (val, label, n) {
      return '<button type="button" data-act="orders-tab" data-tab="' + val + '" aria-pressed="' + (tab === val) + '">' + label + (n !== undefined ? ' <span class="num">' + n + '</span>' : '') + '</button>';
    };
    const head = '<div class="page-head"><div><p class="eyebrow">Purchasing</p><h1>Orders</h1>' +
      '<p class="muted small" style="margin:4px 0 0">' + plural(d.suggestions.length, 'supplier') + ' to order from · ' + plural(d.sent.length, 'order') + ' on the way</p></div>' +
      '<div class="actions"><button type="button" class="btn" data-act="new-supplier">' + ICON.plus + 'Supplier</button><button type="button" class="btn primary" data-act="new-order">' + ICON.plus + 'Order</button></div></div>' +
      '<div><div class="seg" role="group" aria-label="Orders">' + seg('suggested', 'To order', d.suggestions.length) + seg('open', 'Open', open.length) + seg('history', 'History') + seg('suppliers', 'Suppliers', d.suppliers.length) + '</div></div>';

    let body = '';
    if (tab === 'suggested') {
      const unassigned = d.items.filter(function (i) { return !i.supplierId && d.status[i.id] !== 'ok'; });
      body = (d.boost.active ? '<div class="banner"><p>' + boostLine(d).replace(/^<p class="normal-line">|<\/p>$/g, '') + '</p></div>' : '') +
        (d.suggestions.length ? '<div class="order-cards">' + d.suggestions.map(function (g) {
          const sup = g.supplier;
          const nod = L.nextOrderDay(sup, d.now);
          const draft = d.draftBySupplier[sup.id];
          const under = L.num(sup.minOrder, 0) > 0 && g.total < L.num(sup.minOrder, 0);
          return '<article class="order-card' + (nod && nod.inDays === 0 ? ' urgent' : '') + '"><header><div><span class="who">' + esc(sup.name) + '</span>' +
            '<span class="small muted">' + (nod ? (nod.inDays === 0 ? 'Order day today' + (sup.cutoff ? ', by ' + esc(sup.cutoff) : '') : 'Next order day ' + esc(nod.inDays === 1 ? 'tomorrow' : nod.weekday)) : 'No order days set') +
            (sup.email ? ' · ' + esc(sup.email) : ' · no email yet') + '</span></div>' +
            '<span class="num">≈ ' + esc(money(g.total)) + '</span></header>' +
            '<div class="table-wrap"><table class="line-table sug"><thead><tr><th>Item</th><th class="r">On hand</th><th class="r">Par</th><th class="r">Order</th></tr></thead><tbody>' +
            g.lines.map(function (l) {
              return '<tr><td>' + esc(l.name) + ' ' + (l.asked ? '<span class="pill ' + (l.asked === 'out' ? 'out' : 'low') + '" title="Asked for in the Kitchen Book">Kitchen: ' + (l.asked === 'out' ? 'out' : 'low') + '</span>' : l.status === 'out' ? statusPill('out') : '') + '</td>' +
                '<td class="r num">' + esc(qtyText(l.onHand)) + ' ' + esc(l.unit) + '</td><td class="r num">' + esc(qtyText(l.par)) + '</td>' +
                '<td class="r num"><b>' + esc(L.describeLine(l)) + '</b></td></tr>';
            }).join('') + '</tbody></table></div>' +
            (under ? '<p class="small" style="margin:0;color:var(--warn)">Below the ' + esc(money(sup.minOrder)) + ' minimum order. Add more or wait for the next order day.</p>' : '') +
            '<div class="actions"><button type="button" class="btn primary sm" data-act="start-order" data-supplier="' + esc(sup.id) + '">' + (draft ? 'Add to draft' : 'Create order') + '</button></div></article>';
        }).join('') + '</div>'
          : '<section class="panel"><div class="empty"><strong>Nothing to order</strong><span>Suggestions appear when an item with a supplier drops to its reorder point. Keep counts fresh and set par levels on your items.</span></div></section>') +
        (unassigned.length ? '<div class="note"><p><b>' + plural(unassigned.length, 'low item') + ' without a supplier:</b> ' + esc(namesOf(unassigned, 6)) + '. Give them a supplier so they get ordered.</p></div>' : '') +
        (function () {
          const stuck = d.asks.filter(function (a) { const it = a.itemId && d.items.find(function (i) { return i.id === a.itemId; }); return !it || !it.supplierId; });
          return stuck.length ? '<section class="panel flush"><div class="section-head"><h2>Kitchen asked for, but it can’t be ordered yet</h2><span class="muted small">' + esc(kitchenSynced(d)) + '</span></div>' + askRows(d, stuck) + '</section>' : '';
        })();
    } else if (tab === 'open' || tab === 'history') {
      const list = tab === 'open' ? open : history.slice(0, 60);
      body = list.length ? '<section class="panel flush"><div class="rows">' + list.map(function (o) {
        const sup = d.supplierById[o.supplierId] || {};
        const meta = [esc(o.number || ''), plural((o.lines || []).length, 'line'), esc(money(L.orderTotal(o)))];
        if (o.status === 'sent') meta.push('due ' + esc(relDay(o.deliveryDate) || 'no date'));
        if (o.status === 'draft') meta.push('started ' + esc(ago(o.createdAt)));
        if (o.status === 'received') meta.push('delivered ' + esc(ago(o.receivedAt)));
        return '<div class="row"><div class="row-main"><div class="row-title"><span class="name">' + esc(sup.name || 'Unknown supplier') + '</span>' + orderPill(o.status) + examplePill(o) + '</div>' +
          '<div class="row-meta">' + meta.join(' · ') + '</div></div><span></span>' +
          '<button type="button" class="btn sm" data-act="open-order" data-id="' + esc(o.id) + '">' + (o.status === 'draft' ? 'Edit & send' : o.status === 'sent' ? 'Check in' : 'View') + '</button></div>';
      }).join('') + '</div></section>'
        : '<section class="panel"><div class="empty"><span>' + (tab === 'open' ? 'No open orders. Start one from To order.' : 'Delivered orders show up here.') + '</span></div></section>';
    } else {
      body = d.suppliers.length ? '<div class="order-cards">' + d.suppliers.map(function (s) {
        const count = d.items.filter(function (i) { return i.supplierId === s.id; }).length;
        const days = (s.orderDays || []).slice().sort(function (a, b) { return WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b); }).map(function (n) { return L.WEEKDAYS[n]; }).join(', ');
        return '<article class="order-card"><header><div><span class="who">' + esc(s.name) + ' ' + examplePill(s) + '</span>' +
          '<span class="small muted">' + plural(count, 'item') + (s.contact ? ' · ' + esc(s.contact) : '') + '</span></div>' +
          '<button type="button" class="btn sm" data-act="edit-supplier" data-id="' + esc(s.id) + '">Edit</button></header>' +
          '<dl class="kv"><dt>Email</dt><dd>' + (s.email ? '<span class="copy-line"><code>' + esc(s.email) + '</code><button type="button" class="btn ghost sm" data-act="copy" data-text="' + esc(s.email) + '">Copy</button></span>' : '<span class="muted">not set</span>') + '</dd>' +
          (s.phone ? '<dt>Phone</dt><dd class="num">' + esc(s.phone) + '</dd>' : '') +
          '<dt>Order days</dt><dd>' + (days ? esc(days) + (s.cutoff ? ' by ' + esc(s.cutoff) : '') : '<span class="muted">not set</span>') + '</dd>' +
          '<dt>Delivery</dt><dd>' + esc(plural(L.num(s.leadDays, 1), 'day')) + ' after ordering' + (L.num(s.minOrder, 0) ? ' · min. ' + esc(money(s.minOrder)) : '') + '</dd>' +
          (s.customerNo ? '<dt>Customer no.</dt><dd class="num">' + esc(s.customerNo) + '</dd>' : '') + '</dl></article>';
      }).join('') + '</div>'
        : '<section class="panel"><div class="empty"><strong>No suppliers yet</strong><span>Add the companies you order from, with the email address they take orders on.</span><button type="button" class="btn primary" data-act="new-supplier">Add supplier</button></div></section>';
    }
    return head + banners(d) + body;
  }

  function viewBookings(d) {
    const day = ui.bookings.day;
    const list = d.reservations.filter(function (r) { return r.date === day; }).sort(function (a, b) { return String(a.time || '').localeCompare(String(b.time || '')); });
    const covers = list.filter(function (r) { return r.status !== 'cancelled' && r.status !== 'pending'; }).reduce(function (a, r) { return a + L.num(r.covers, 0); }, 0);
    const fortnight = L.bookingsByDay(d.reservations, d.now, 14).reduce(function (a, x) { return a + x.covers; }, 0);
    const head = '<div class="page-head"><div><p class="eyebrow">Front of house</p><h1>Bookings</h1>' +
      '<p class="muted small" style="margin:4px 0 0">' + fortnight + ' covers booked over the next 14 days</p></div>' +
      '<div class="actions"><button type="button" class="btn" data-act="import-bookings">Import CSV</button><button type="button" class="btn primary" data-act="new-booking">' + ICON.plus + 'Booking</button></div></div>';
    const chart = '<section class="panel"><div class="section-head"><h2>Next 14 days</h2><span class="muted small">Tap a day to see its bookings</span></div>' +
      '<div class="table-wrap">' + bookingBars(d, 14, true) + '</div>' + boostLine(d) + '</section>';
    const dayPanel = '<section class="panel flush"><div class="section-head"><h2>' + esc(relDay(day) === 'today' ? 'Today' : fmtDay(day)) + '</h2><span class="muted small num">' + plural(covers, 'cover') + ' · ' + plural(list.length, 'booking') + '</span></div>' +
      (list.length ? '<div class="booking-list">' + list.map(function (r) {
        return '<div class="booking"><span class="time">' + esc(r.time || '––:––') + '</span>' +
          '<div class="row-main"><div class="row-title"><span class="name">' + esc(r.name || 'Guest') + '</span>' + (r.status === 'cancelled' ? '<span class="pill cancelled">Cancelled</span>' : '') + (r.status === 'pending' ? '<span class="pill low">Not confirmed</span>' : '') + examplePill(r) + '</div>' +
          (r.note || r.phone ? '<div class="row-meta">' + esc([r.note, r.phone].filter(Boolean).join(' · ')) + '</div>' : '') + '</div>' +
          '<span class="covers">' + esc(L.num(r.covers, 0)) + ' pax</span>' +
          (r.source === 'kitchen' ? '<span class="pill" title="An event from the Kitchen Book. Change it there.">Kitchen Book</span>'
            : '<button type="button" class="btn ghost sm" data-act="edit-booking" data-id="' + esc(r.id) + '">Edit</button>') + '</div>';
      }).join('') + '</div>' : '<div class="empty"><span>No bookings on ' + esc(fmtDay(day)) + '.</span><button type="button" class="btn sm" data-act="new-booking" data-date="' + esc(day) + '">Add booking</button></div>') + '</section>';

    let inbox;
    if (net.gmail() && ui.gmailOn) {
      inbox = '<section class="panel flush"><div class="section-head"><h2>Booking emails</h2>' + updatedLine('bookings') + '</div>' + mailList('bookings', 'No booking emails in the last 14 days.') + '</section>';
    } else {
      inbox = '<section class="panel"><h2>Bookings from your reservation system</h2><p class="small muted">Export bookings as CSV (date, time, name, covers) and import them here. ' +
        (net.gmail() ? 'Or <a href="#inbox">connect Gmail</a> to see booking confirmation emails next to the calendar.' : 'On claude.ai with Gmail connected, booking confirmation emails show up here too.') + '</p></section>';
    }
    return head + banners(d) + '<div class="grid-2"><div class="stack">' + chart + dayPanel + '</div><div class="stack">' + inbox + '</div></div>';
  }

  function viewInbox(d) {
    const head = officeHead('inbox', 'Mail', 'Supplier replies, orders and booking emails from your Gmail, refreshed every few minutes.',
      net.gmail() && ui.gmailOn ? '<button type="button" class="btn" data-act="gmail-refresh">Refresh</button><button type="button" class="btn ghost" data-act="gmail-off">Disconnect</button>' : '');
    if (net.gmailMissing) {
      return head + '<section class="panel stack"><h2>Add Gmail to your claude.ai account</h2>' +
        '<p class="muted" style="margin:0">In claude.ai open Settings → Connectors, add Gmail with your business account, then reload this page. Orders will then go out from your Gmail and supplier replies show up here.</p></section>';
    }
    if (!net.gmail()) {
      return head + '<section class="panel stack"><h2>Gmail works when this page is opened on claude.ai</h2>' +
        '<p class="muted" style="margin:0">Open Komat Back Office from your claude.ai link, with Gmail added under Settings → Connectors. Then orders go out straight from your business Gmail and supplier replies show up here.</p>' +
        '<p class="muted" style="margin:0">Here, the order screen gives you the email text to copy and an <b>Open in email app</b> button instead.</p></section>';
    }
    if (!ui.gmailOn) {
      return head + '<section class="panel stack"><h2>Connect your business Gmail</h2>' +
        '<p class="muted" style="margin:0">Komat Back Office will read mail from your suppliers and booking emails, and send orders when you press Send. Each person connects their own Gmail; nobody else sees your inbox.</p>' +
        (ui.gmailNote ? '<div class="note bad"><p>' + esc(ui.gmailNote) + '</p></div>' : '') +
        '<div class="actions"><button type="button" class="btn primary" data-act="gmail-connect"' + (ui.gmailBusy ? ' disabled' : '') + '>' + (ui.gmailBusy ? 'Connecting…' : 'Connect Gmail') + '</button></div></section>';
    }
    const supQ = L.supplierQuery(d.suppliers);
    return head +
      '<div class="grid-2"><div class="stack">' +
      '<section class="panel flush"><div class="section-head"><h2>From your suppliers</h2>' + updatedLine('suppliers') + '</div>' +
      (supQ ? mailList('suppliers', 'No mail from your suppliers in the last 30 days.') : '<div class="empty"><span>Add email addresses to your suppliers to see their replies here.</span><button type="button" class="btn sm" data-act="orders-tab" data-tab="suppliers">Suppliers</button></div>') + '</section>' +
      '<section class="panel flush"><div class="section-head"><h2>Orders, deliveries &amp; invoices</h2>' + updatedLine('orders') + '</div>' + mailList('orders', 'Nothing matching in the last 14 days.') + '</section>' +
      '</div><div class="stack">' +
      '<section class="panel flush"><div class="section-head"><h2>Booking emails</h2>' + updatedLine('bookings') + '</div>' + mailList('bookings', 'No booking emails in the last 14 days.') + '</section>' +
      '<p class="small muted">Change what these lists search for under <a href="#setup">Setup → Email searches</a>.</p>' +
      '</div></div>';
  }

  function viewSetup(d) {
    const s = store.settings;
    const modeText = store.mode === 'shared'
      ? '<b>Live and shared.</b> Everyone you share this page with on claude.ai sees the same stock, orders and bookings, updated as they change.'
      : '<b>This browser only.</b> Changes are saved on this device' + (store.persistent ? '' : ' for this visit only (storage is blocked)') + '. Open the claude.ai version to share live with the team.';
    const field = function (id, label, value, attrs, hint) {
      return '<label class="field' + (attrs && attrs.indexOf('wide') > -1 ? ' wide' : '') + '" for="' + id + '"><span>' + label + '</span>' +
        '<input type="text" id="' + id + '" name="' + id.replace('set-', '') + '" value="' + esc(value) + '" ' + (attrs || '').replace('wide', '') + '>' + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</label>';
    };
    const confirmErase = ui.confirm === 'erase'
      ? '<div class="confirm"><p><b>Erase every item, supplier, order and booking?</b> This cannot be undone. Export a backup first if you might need it.</p><div class="actions"><button type="button" class="btn" data-act="confirm-cancel">Keep everything</button><button type="button" class="btn danger solid" data-act="erase-all">Erase everything</button></div></div>' : '';
    return '<div class="page-head"><div><p class="eyebrow">Back office</p><h1>Setup</h1></div></div>' + banners(d) +
      '<form data-form="settings" id="settings-form" class="grid-2">' +
      '<div class="stack">' +
      '<section class="panel stack"><h2>Restaurant</h2><div class="form-grid">' +
      field('set-restaurant', 'Restaurant name', s.restaurant) +
      field('set-sender', 'Your name (orders are signed with it)', s.sender) +
      field('set-address', 'Delivery address', s.address, 'wide') +
      '<label class="field wide" for="set-signature"><span>Email signature</span><textarea id="set-signature" name="signature" placeholder="' + esc([s.sender || 'Your name', s.restaurant || 'Komat', 'phone'].join('\n')) + '">' + esc(s.signature) + '</textarea></label>' +
      '</div></section>' +
      '<section class="panel stack"><h2>Orders</h2><div class="form-grid">' +
      field('set-emailIntro', 'Order email opening', s.emailIntro, 'wide', 'Shown as: “Hello Produce team, ' + esc(s.emailIntro || 'please send us the following') + ' for delivery on …”') +
      field('set-copyTo', 'Send a copy of every order to', s.copyTo, 'inputmode="email" placeholder="orders@komat…"', 'Your business address, so every order is in your inbox too.') +
      field('set-currency', 'Currency', s.currency, 'maxlength="3" style="text-transform:uppercase"', 'Three letters, e.g. EUR') +
      field('set-vat', 'Menu prices include VAT (%)', s.vat || '', 'inputmode="decimal" placeholder="e.g. 20"', 'Used to show wine and drink margins without VAT.') +
      '</div></section>' +
      '<section class="panel stack"><h2>Busy weeks</h2><div class="form-grid">' +
      field('set-normalCoversWeek', 'Covers in a normal week', s.normalCoversWeek || '', 'inputmode="numeric" placeholder="e.g. 180"', 'Booked covers in an ordinary week.') +
      field('set-boostCap', 'Raise orders by at most', s.boostCap, 'inputmode="decimal"', '1.5 means up to 50% more than par.') +
      '<label class="check wide" for="set-boost"><input type="checkbox" id="set-boost" name="boost"' + (s.boost !== false ? ' checked' : '') + '><span>When more covers are booked for the next 7 days than in a normal week, raise suggested orders to match.</span></label>' +
      '</div></section>' +
      '</div><div class="stack">' +
      '<section class="panel stack"><h2>Email searches</h2><p class="small muted" style="margin:0">Gmail search words for the Inbox. Supplier mail is found from the supplier addresses automatically.</p><div class="form-grid">' +
      field('set-inboxQuery', 'Orders &amp; invoices', s.inboxQuery, 'wide') +
      field('set-bookingsQuery', 'Booking emails', s.bookingsQuery, 'wide', 'Tip: use your reservation system’s sender, e.g. from:noreply@yourbookingtool.com') +
      field('set-invoiceQuery', 'Invoices', s.invoiceQuery || '', 'wide placeholder="' + esc(invoiceQuery(true)) + '"', 'Leave empty to look for invoices from your suppliers’ addresses.') +
      '</div></section>' +
      '<section class="panel stack"><h2>Cash report</h2><div class="form-grid">' +
      field('set-cashSheet', 'Google Sheet link', s.cashSheet || '', 'wide placeholder="https://docs.google.com/spreadsheets/d/…"', 'The sheet you fill in every day: one tab per day with НАЧАЛО, РАЗХОДИ, ПРИХОДИ and ОСТАТЪК.') +
      field('set-cashCurrency', 'Currency of the cash report', s.cashCurrency || '', 'maxlength="3" placeholder="' + esc(s.currency || 'EUR') + '" style="text-transform:uppercase"', 'BGN for months kept in leva.') +
      '</div></section>' +
      '<div class="actions"><button type="submit" class="btn primary"' + (store.readOnly ? ' disabled' : '') + '>Save setup</button></div>' +
      '<section class="panel stack"><h2>Connections</h2><dl class="kv">' +
      '<dt>Storage</dt><dd>' + modeText + '</dd>' +
      '<dt>Hype</dt><dd>Deliveries and sales are entered in Hype. Bring its stock report in under Stock → Update from Hype, and its sales report under Bar → Import till sales.</dd>' +
      '<dt>reservation.tools</dt><dd>Import its booking export under Bookings, and see its booking emails in the Inbox.</dd>' +
      '<dt>Kitchen Book</dt><dd>' + (d.kitchenMeta ? esc(kitchenSynced(d)) + '. Station order checks and events show up here; recipe products can be added under Stock.' : 'Not copied yet. Station order checks, events and recipe products from the Komat Kitchen Book show up here once they are.') + '</dd>' +
      '<dt>Gmail</dt><dd>' + (net.gmail() ? (ui.gmailOn ? 'Connected for you. Orders send from your Gmail.' : 'Available. <a href="#inbox">Connect Gmail</a>') : 'Available when the page is opened on claude.ai.') + '</dd></dl></section>' +
      '<section class="panel stack"><h2>Data</h2><div class="actions">' +
      '<button type="button" class="btn" data-act="export-items">Export stock (CSV)</button>' +
      '<button type="button" class="btn" data-act="export-backup">Export backup</button>' +
      '<button type="button" class="btn" data-act="import-backup">Restore backup</button></div>' +
      '<div class="actions">' + (d.hasExamples ? '<button type="button" class="btn danger" data-act="remove-examples">Remove example data</button>' : '<button type="button" class="btn" data-act="load-examples">Load example data</button>') +
      '<button type="button" class="btn danger" data-act="confirm-erase">Erase everything</button></div>' + confirmErase + '</section>' +
      '</div></form>';
  }

  /* ---------- bar (front of house) ---------- */

  const COLOUR_ORDER = L.WINE_COLOURS.map(function (c) { return c[0]; });
  function byColour(a, b) {
    const ai = COLOUR_ORDER.indexOf(a.colour), bi = COLOUR_ORDER.indexOf(b.colour);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || byName(a, b);
  }
  function colourName(c) { const x = L.WINE_COLOURS.find(function (w) { return w[0] === c; }); return x ? x[1] : 'Other wines'; }
  function swatch(item) { return item.kind === 'wine' ? '<span class="swatch" data-colour="' + esc(item.colour || '') + '" aria-hidden="true"></span>' : ''; }

  function soldToday(d, itemId, serveId) {
    const row = d.salesToday.rows.find(function (r) { return r.itemId === itemId && r.serveId === serveId; });
    return row ? row.qty : 0;
  }

  function tile(d, item, serve) {
    const st = d.status[item.id];
    const sold = soldToday(d, item.id, serve.id);
    const left = serve.id === 'glass' ? plural(L.wineStock(item).totalGlasses, 'glass', 'glasses') + ' left'
      : serve.id === 'bottle' ? qtyText(item.onHand) + ' btl left' : qtyText(item.onHand) + ' left';
    const title = item.name + (item.vintage ? ' ' + item.vintage : '');
    return '<button type="button" class="tile ' + esc(st) + '" id="sell-' + esc(item.id) + '-' + serve.id + '" data-act="sell" data-id="' + esc(item.id) + '" data-serve="' + serve.id + '" aria-label="Sell ' + esc(serve.label + ', ' + title + ', ' + money(serve.price)) + '">' +
      '<span class="tile-top"><span class="tile-name">' + swatch(item) + esc(title) + '</span>' + (sold ? '<span class="tile-count" title="Sold today">' + esc(qtyText(sold)) + '</span>' : '') + '</span>' +
      '<span class="tile-sub">' + esc(serve.id === 'piece' ? (item.category || 'Drink') : serve.label) + '</span>' +
      '<span class="tile-price">' + esc(money(serve.price)) + '</span>' +
      '<span class="tile-stock">' + (st === 'out' ? '86’d · ' : '') + esc(left) + '</span></button>';
  }

  function viewBar(d) {
    const tab = ui.bar.tab;
    const s = d.salesToday;
    const seg = function (val, label) { return '<button type="button" data-act="bar-tab" data-tab="' + val + '" aria-pressed="' + (tab === val) + '">' + label + '</button>'; };
    const head = '<div class="page-head"><div><p class="eyebrow">Front of house</p><h1>Bar</h1>' +
      '<p class="muted small" style="margin:4px 0 0">Today: <b class="num">' + esc(qtyText(s.qty)) + '</b> sold · <b class="num">' + esc(money(s.revenue)) + '</b></p></div>' +
      '<div class="actions"><button type="button" class="btn" data-act="import-sales">Import till sales</button>' +
      '<button type="button" class="btn" data-act="new-drink">' + ICON.plus + 'Drink</button>' +
      '<button type="button" class="btn primary" data-act="new-wine">' + ICON.plus + 'Wine</button></div></div>' +
      '<div><div class="seg" role="group" aria-label="Bar">' + seg('wines', 'Wine list') + seg('sales', 'Sales') + seg('sell', 'Quick sell') + '</div></div>';

    if (!d.sellable.length) {
      return head + banners(d) + '<section class="panel"><div class="empty"><strong>Nothing on the bar yet</strong>' +
        '<span>Add your wines (sold by the bottle and the glass) and soft drinks (sold per piece). Each sale tapped here comes off stock.</span>' +
        '<div class="actions"><button type="button" class="btn primary" data-act="new-wine">Add a wine</button><button type="button" class="btn" data-act="new-drink">Add a drink</button></div>' +
        '<span class="small">Already in Stock? Open the item and choose how it is sold to guests.</span></div></section>';
    }
    let body = '';
    if (tab === 'sell') body = barSell(d);
    else if (tab === 'wines') body = barWines(d);
    else body = barSales(d);
    return head + banners(d) + body;
  }

  function barSell(d) {
    const q = ui.bar.q.trim().toLowerCase();
    const match = function (i) { return !q || [i.name, i.producer, i.grape, i.region, i.vintage, i.category].join(' ').toLowerCase().indexOf(q) > -1; };
    const wines = d.sellable.filter(function (i) { return i.kind === 'wine' && match(i); }).sort(byColour);
    const drinks = d.sellable.filter(function (i) { return i.kind === 'drink' && match(i); });
    const sections = [
      ['Wine by the glass', wines.filter(function (i) { return L.serveOf(i, 'glass'); }).map(function (i) { return [i, L.serveOf(i, 'glass')]; })],
      ['Wine by the bottle', wines.map(function (i) { return [i, L.serveOf(i, 'bottle')]; })],
      ['Soft drinks & water', drinks.map(function (i) { return [i, L.serveOf(i, 'piece')]; })]
    ].filter(function (x) { return x[1].length; });
    const short = d.sellable.filter(function (i) { return d.status[i.id] === 'out' || d.status[i.id] === 'low'; });
    const last = ui.bar.last && Date.now() - ui.bar.last.t < 10 * 60 * 1000 ? ui.bar.last : null;
    return '<p class="small muted" style="margin:0">Sales rung up in Hype come in with <b>Import till sales</b>. Tap here only for drinks that don’t go through Hype; each tap comes off stock.</p>' +
      '<label class="search" for="bar-q">' + ICON.search + '<input type="search" id="bar-q" data-bind="bar-q" placeholder="Find a wine or drink" value="' + esc(ui.bar.q) + '" autocomplete="off"></label>' +
      (short.length ? '<div class="note"><p><b>Tell the floor:</b> ' + short.map(function (i) {
        return esc(i.name) + (d.status[i.id] === 'out' ? ' is 86’d' : ' (' + esc(i.kind === 'wine' ? L.wineStock(i).text : qtyText(i.onHand) + ' left') + ')');
      }).join(' · ') + '</p></div>' : '') +
      (last ? '<div class="lastsale" role="status"><span>Sold <b>' + esc(last.label) + '</b> · ' + esc(money(last.price)) + '</span><button type="button" class="btn sm" data-act="undo-sale">Undo</button></div>' : '') +
      (sections.length ? sections.map(function (sec) {
        return '<section class="stack"><div class="section-head"><h2>' + esc(sec[0]) + '</h2><span class="muted small">' + plural(sec[1].length, 'item') + '</span></div>' +
          '<div class="tiles">' + sec[1].map(function (t) { return tile(d, t[0], t[1]); }).join('') + '</div></section>';
      }).join('') : '<div class="empty"><span>Nothing matches “' + esc(ui.bar.q) + '”.</span></div>');
  }

  function barWines(d) {
    const vat = store.settings.vat;
    const wines = d.sellable.filter(function (i) { return i.kind === 'wine'; }).sort(byColour);
    const drinks = d.sellable.filter(function (i) { return i.kind === 'drink'; });
    const groups = {};
    wines.forEach(function (w) { const k = COLOUR_ORDER.indexOf(w.colour) > -1 ? w.colour : ''; (groups[k] = groups[k] || []).push(w); });
    const gp = function (item, serveId) {
      const sv = L.serveOf(item, serveId);
      const m = sv ? L.serveMargin(item, sv, vat) : null;
      return m === null ? '–' : m + '%';
    };
    const stockCell = function (item, text) {
      const st = d.status[item.id];
      return '<td class="r" data-l="In stock"><span class="num">' + esc(text) + '</span>' + (st === 'out' || st === 'low' ? ' ' + statusPill(st) : '') + '</td>';
    };
    const wineTables = COLOUR_ORDER.concat(['']).filter(function (k) { return groups[k]; }).map(function (k) {
      return '<section class="panel flush"><div class="section-head"><h2>' + esc(colourName(k)) + '</h2><span class="muted small">' + plural(groups[k].length, 'wine') + '</span></div>' +
        '<div class="table-wrap"><table class="line-table winelist wines"><thead><tr><th>Wine</th><th>Vintage</th><th class="r">Bottle</th><th class="r">Glass</th><th class="r">In stock</th><th class="r">GP bottle / glass</th><th></th></tr></thead><tbody>' +
        groups[k].map(function (w) {
          const glass = L.serveOf(w, 'glass');
          const sub = [w.producer, w.region, w.grape].filter(Boolean).join(' · ');
          return '<tr><td>' + swatch(w) + '<b>' + esc(w.name) + '</b>' + (sub ? '<div class="small muted">' + esc(sub) + '</div>' : '') + '</td>' +
            '<td class="num" data-l="Vintage">' + esc(w.vintage || '–') + '</td>' +
            '<td class="r num" data-l="Bottle">' + esc(money(w.price)) + '</td>' +
            '<td class="r num" data-l="Glass">' + (glass ? esc(money(glass.price)) + '<div class="small muted">' + esc(qtyText(w.glassCl)) + ' cl</div>' : '–') + '</td>' +
            stockCell(w, L.wineStock(w).text) +
            '<td class="r num" data-l="GP">' + gp(w, 'bottle') + ' / ' + (glass ? gp(w, 'glass') : '–') + '</td>' +
            '<td class="r"><button type="button" class="btn ghost sm" data-act="edit-item" data-id="' + esc(w.id) + '">Edit</button></td></tr>';
        }).join('') + '</tbody></table></div></section>';
    }).join('');
    const drinkTable = drinks.length ? '<section class="panel flush"><div class="section-head"><h2>Soft drinks &amp; water</h2><span class="muted small">sold per piece</span></div>' +
      '<div class="table-wrap"><table class="line-table winelist"><thead><tr><th>Drink</th><th class="r">Price</th><th class="r">In stock</th><th class="r">GP</th><th></th></tr></thead><tbody>' +
      drinks.map(function (i) {
        return '<tr><td><b>' + esc(i.name) + '</b></td><td class="r num" data-l="Price">' + esc(money(i.price)) + '</td>' + stockCell(i, qtyText(i.onHand) + ' ' + (i.unit || '')) +
          '<td class="r num" data-l="GP">' + gp(i, 'piece') + '</td><td class="r"><button type="button" class="btn ghost sm" data-act="edit-item" data-id="' + esc(i.id) + '">Edit</button></td></tr>';
      }).join('') + '</tbody></table></div></section>' : '';
    return wineTables + drinkTable +
      '<p class="small muted">GP is the gross profit on the menu price' + (L.num(vat, 0) > 0 ? ' without ' + esc(qtyText(vat)) + '% VAT' : '; set your VAT rate in Setup to take it out') + '. Glass stock counts the open bottle too.</p>';
  }

  function salesRange() {
    const now = new Date();
    if (ui.bar.range === 'yesterday') { const y = L.isoDate(L.addDays(now, -1)); return [y, y, 'yesterday']; }
    if (ui.bar.range === 'week') return [L.isoDate(L.addDays(now, -6)), L.isoDate(now), 'the last 7 days'];
    const t = L.isoDate(now);
    return [t, t, 'today'];
  }

  function barSales(d) {
    const r = salesRange();
    const sum = L.salesSummary(d.moves, d.items, r[0], r[1]);
    const chip = function (val, label) { return '<button type="button" data-act="bar-range" data-range="' + val + '" aria-pressed="' + (ui.bar.range === val) + '">' + label + '</button>'; };
    return '<div class="toolbar"><div class="seg" role="group" aria-label="Period">' + chip('today', 'Today') + chip('yesterday', 'Yesterday') + chip('week', 'Last 7 days') + '</div></div>' +
      '<div class="strip">' +
      stat({ label: 'Sold', value: qtyText(sum.qty), hint: 'glasses, bottles and drinks' }) +
      stat({ label: 'Takings', value: money(sum.revenue), hint: 'menu prices' }) +
      stat({ label: 'From the bar screen', value: qtyText(sum.sources.bar), hint: 'tapped by staff' }) +
      stat({ label: 'From Hype', value: qtyText(sum.sources.pos), hint: 'imported till reports' }) + '</div>' +
      '<section class="panel flush"><div class="section-head"><h2>Sales ' + esc(r[2]) + '</h2></div>' +
      (sum.rows.length ? '<div class="table-wrap"><table class="line-table winelist"><thead><tr><th>Item</th><th>Sold as</th><th class="r">Qty</th><th class="r">Takings</th></tr></thead><tbody>' +
        sum.rows.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td data-l="Sold as">' + esc(x.label) + '</td><td class="r num" data-l="Qty">' + esc(qtyText(x.qty)) + '</td><td class="r num" data-l="Takings">' + esc(money(x.revenue)) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '<div class="empty"><span>No sales recorded ' + esc(r[2]) + '.</span><button type="button" class="btn sm" data-act="import-sales">Import till sales</button></div>') + '</section>';
  }

  /* ---------- kitchen (Komat Kitchen Book) ---------- */

  function stationNames(list) { return (list || []).map(function (s) { return L.STATIONS[s] || s; }).join(', '); }

  function kitchenSynced(d) {
    const m = d.kitchenMeta;
    return m && m.syncedAt ? 'From the Kitchen Book, copied ' + ago(m.syncedAt) : '';
  }

  function askRows(d, list) {
    return '<div class="rows">' + list.map(function (a) {
      const item = a.itemId && d.items.find(function (i) { return i.id === a.itemId; });
      const sup = item && d.supplierById[item.supplierId];
      const where = item ? (sup ? 'goes on the ' + esc(sup.name) + ' order' : '<span style="color:var(--warn)">' + esc(item.name) + ' has no supplier</span>')
        : '<span style="color:var(--warn)">not in the stock list</span>';
      return '<div class="row"><div class="row-main"><div class="row-title"><span class="name">' + esc(a.name) + '</span>' +
        '<span class="pill ' + (a.status === 'out' ? 'out' : 'low') + '">' + (a.status === 'out' ? 'Out' : 'Low') + '</span></div>' +
        '<div class="row-meta">' + esc(stationNames(a.stations)) + (a.note ? ' · “' + esc(a.note) + '”' : '') + ' · ' + where + '</div></div><span></span>' +
        (item ? (sup ? '' : '<button type="button" class="btn sm" data-act="edit-item" data-id="' + esc(item.id) + '">Set supplier</button>')
          : '<button type="button" class="btn sm" data-act="link-ask" data-key="' + esc(a.key) + '">Link</button>') + '</div>';
    }).join('') + '</div>';
  }

  function kitchenPanel(d) {
    if (!d.asks.length && !d.kitchenMeta) return '';
    return '<section class="panel flush"><div class="section-head"><h2>Kitchen asked for</h2><span class="muted small">' + esc(kitchenSynced(d)) + '</span></div>' +
      (d.asks.length ? askRows(d, d.asks) : '<div class="empty"><span>No order checks from the stations since yesterday.</span></div>') + '</section>';
  }

  function linkAskSheet(s) {
    const items = store.list('items').sort(byName);
    return {
      title: 'Link a kitchen product',
      body: '<p style="margin:0">The kitchen calls it <b>' + esc(s.name) + '</b>. Which stock item is that?</p>' +
        '<label class="field" for="link-item"><span>Stock item</span><select id="link-item"><option value="">Choose…</option>' +
        items.map(function (i) { return '<option value="' + esc(i.id) + '">' + esc(i.name) + '</option>'; }).join('') + '</select>' +
        '<span class="hint">Remembered: next time the kitchen asks for it, it goes straight onto the right order.</span></label>',
      foot: '<button type="button" class="btn" data-act="ask-new-item">Add as a new item</button><span class="spacer"></span>' +
        '<button type="button" class="btn" data-act="close-sheet">Cancel</button><button type="button" class="btn primary" data-act="ask-link">Link</button>'
    };
  }

  function importKitchenSheet(s) {
    const d = derive();
    const have = {};
    d.items.forEach(function (i) { have[L.normName(i.name)] = true; });
    const linked = {};
    Object.keys(store.settings.kitchenMap || {}).forEach(function (k) { linked[k] = true; });
    const list = d.kitchenProducts.filter(function (p) { const k = L.normName(p.name); return !have[k] && !linked[k]; });
    s.list = list;
    s.sel = s.sel || {};
    const n = list.filter(function (p, idx) { return s.sel[idx]; }).length;
    return {
      title: 'Products from the Kitchen Book',
      body: (list.length ? '<p style="margin:0">' + plural(list.length, 'product') + ' used in the Kitchen Book recipes ' + (list.length === 1 ? 'is' : 'are') + ' not in your stock list yet. Tick the ones you buy; preparations and salt, pepper and water are already left out.</p>' +
        '<div class="actions"><button type="button" class="btn sm" data-act="kp-menu">Tick everything on the menu</button><button type="button" class="btn sm ghost" data-act="kp-none">Clear</button></div>' +
        '<div class="form-grid"><label class="field" for="kp-sup"><span>Supplier for the ticked items</span><select id="kp-sup">' + supplierOptions(s.sup || '') + '</select></label>' +
        '<label class="field" for="kp-loc"><span>Storage location</span><input type="text" id="kp-loc" list="dl-loc" value="' + esc(s.loc || '') + '" placeholder="Walk-in fridge"></label>' + datalists() + '</div>' +
        '<div class="kp-list">' + list.map(function (p, idx) {
          const used = p.usedIn.slice(0, 2).join(', ') + (p.usedIn.length > 2 ? ' +' + (p.usedIn.length - 2) : '');
          return '<label class="kp" for="kp-' + idx + '"><input type="checkbox" id="kp-' + idx + '" data-kp="' + idx + '"' + (s.sel[idx] ? ' checked' : '') + '>' +
            '<span><b>' + esc(p.name) + '</b><small>' + esc(used) + (p.stations.length ? ' · ' + esc(stationNames(p.stations)) : '') + (p.onMenu ? '' : ' · not on the menu') + '</small></span>' +
            '<span class="muted small">' + esc(L.stockUnitFor(p.units)) + '</span></label>';
        }).join('') + '</div>'
        : '<div class="empty"><span>' + (d.kitchenProducts.length ? 'Every product from the Kitchen Book recipes is already in your stock list.' : 'No recipes have been copied from the Kitchen Book yet.') + '</span></div>'),
      foot: '<span class="spacer"></span><button type="button" class="btn" data-act="close-sheet">Cancel</button>' +
        (list.length ? '<button type="button" class="btn primary" data-act="kp-run"' + (n ? '' : ' disabled') + '>Add ' + plural(n, 'item') + '</button>' : '')
    };
  }

  /* ---------- till sales import (Hype daily report) ---------- */

  function importSalesSheet(s) {
    if (!s.rows) {
      return {
        title: 'Import till sales',
        body: '<label class="field" for="pos-date"><span>Sales from</span><input type="date" id="pos-date" data-bind="pos-date" value="' + esc(s.date) + '"></label>' +
          fileOrPaste('pos', '.csv,.txt,.tsv,.xlsx,.xls,text/csv', 'In Hype, export the sales by article report for the day (CSV or Excel). It needs the article name and the quantity sold; takings are picked up when present. Wines and drinks are matched to the wine list; mark food lines as not tracked once and they are remembered.') +
          (s.error ? '<div class="note bad"><p>' + esc(s.error) + '</p></div>' : ''),
        foot: '<span class="spacer"></span><button type="button" class="btn" data-act="close-sheet">Cancel</button><button type="button" class="btn primary" data-act="pos-read">Read report</button>'
      };
    }
    const d = derive();
    const sales = L.rowsToSales(s.rows, s.mapping);
    const options = [];
    d.sellable.slice().sort(byColour).forEach(function (i) {
      L.servesOf(i).forEach(function (sv) { options.push([i.id + '|' + sv.id, i.name + (i.vintage ? ' ' + i.vintage : '') + ' · ' + sv.label]); });
    });
    sales.forEach(function (r) {
      if (s.choice[r.key] !== undefined) return;
      const m = L.matchSale(r, d.items, store.settings.posMap);
      s.choice[r.key] = !m ? '' : m.ignore ? 'ignore' : m.itemId + '|' + m.serveId;
    });
    const barSold = d.moves.filter(function (m) { return m.date === s.date && m.tab !== 'pos'; })
      .reduce(function (a, m) { return a + (m.entries || []).filter(function (e) { return e.k === 'sale'; }).length; }, 0);
    const headers = s.rows[0];
    const mapSel = function (f, label) {
      return '<label class="field" for="smap-' + f + '"><span>' + label + '</span><select id="smap-' + f + '" data-smap="' + f + '"><option value="">Not in file</option>' +
        headers.map(function (h, idx) { return '<option value="' + idx + '"' + (s.mapping[f] === idx ? ' selected' : '') + '>' + esc(h || 'Column ' + (idx + 1)) + '</option>'; }).join('') + '</select></label>';
    };
    const tracked = sales.filter(function (r) { return s.choice[r.key] && s.choice[r.key] !== 'ignore'; });
    const open = sales.filter(function (r) { return !s.choice[r.key]; }).length;
    return {
      title: 'Import till sales',
      body: '<p style="margin:0">Sales from <b>' + esc(fmtDay(s.date)) + '</b>: ' + plural(sales.length, 'article') + ' in the report.</p>' +
        '<div class="form-grid">' + mapSel('name', 'Article name') + mapSel('qty', 'Quantity sold') + mapSel('revenue', 'Takings (optional)') + mapSel('sku', 'Article number (optional)') + '</div>' +
        (barSold ? '<div class="note bad"><p>The bar screen already recorded ' + plural(barSold, 'sale') + ' on this day. Importing the till report as well counts those drinks twice. Use one or the other for a day.</p></div>' : '') +
        '<div class="table-wrap"><table class="line-table"><thead><tr><th>Till article</th><th class="r">Qty</th><th>Comes off stock as</th></tr></thead><tbody>' +
        sales.map(function (r) {
          const c = s.choice[r.key];
          return '<tr' + (c ? '' : ' class="unmatched"') + '><td>' + esc(r.name) + '</td><td class="r num">' + esc(qtyText(r.qty)) + '</td>' +
            '<td><label class="sr-only" for="pos-' + esc(L.hash(r.key)) + '">Stock item for ' + esc(r.name) + '</label><select id="pos-' + esc(L.hash(r.key)) + '" data-pos="' + esc(r.key) + '">' +
            '<option value="">Choose…</option><option value="ignore"' + (c === 'ignore' ? ' selected' : '') + '>Not tracked (food, other)</option>' +
            options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (c === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (open ? '<div class="actions"><span class="small muted">' + plural(open, 'article') + ' not matched yet.</span><button type="button" class="btn sm" data-act="pos-ignore-rest">Mark the rest as not tracked</button></div>' : '') +
        '<label class="check" for="pos-deduct"><input type="checkbox" id="pos-deduct" data-bind="pos-deduct"' + (s.deduct ? ' checked' : '') + '><span>Also take these sales off stock. Leave this off when you update stock from Hype’s stock report, or the drinks come off twice.</span></label>' +
        '<p class="small muted" style="margin:0">Your choices are remembered for the next report. Importing the same report again replaces it instead of counting it twice.</p>',
      foot: '<button type="button" class="btn" data-act="pos-back">Back</button><span class="spacer"></span><button type="button" class="btn primary" data-act="pos-run"' + (tracked.length ? '' : ' disabled') + '>Take ' + plural(tracked.length, 'article') + ' off stock</button>'
    };
  }


  /* ---------- office: cash report, invoices, mail ---------- */

  function officeHead(tab, title, sub, actions) {
    const link = function (v, label) { return '<a href="#' + v + '"' + (tab === v ? ' aria-current="page"' : '') + '>' + label + '</a>'; };
    return '<div class="page-head"><div><p class="eyebrow">Office</p><h1>' + esc(title) + '</h1>' +
      (sub ? '<p class="muted small" style="margin:4px 0 0">' + sub + '</p>' : '') + '</div>' +
      (actions ? '<div class="actions">' + actions + '</div>' : '') + '</div>' +
      '<div><nav class="seg" aria-label="Office">' + link('cash', 'Cash') + link('invoices', 'Invoices') + link('inbox', 'Mail') + '</nav></div>';
  }

  function invoiceQuery(defaultOnly) {
    const custom = String(store.settings.invoiceQuery || '').trim();
    if (custom && !defaultOnly) return custom;
    const sup = L.supplierQuery(store.list('suppliers'), 90);
    return sup ? sup.replace(/ newer_than:\d+d$/, '') + ' (фактура OR invoice OR проформа) newer_than:90d'
      : '(фактура OR invoice OR проформа) has:attachment newer_than:60d';
  }

  let cashFmt = null, cashCur = null;
  function cashMoney(n) {
    const cur = String(store.settings.cashCurrency || store.settings.currency || 'EUR').toUpperCase();
    if (cur !== cashCur) {
      try { cashFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }); } catch (e) { cashFmt = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
      cashCur = cur;
    }
    return cashFmt.format(Number(n) || 0);
  }

  function base64Bytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function loadCash(refresh) {
    const id = L.sheetId(store.settings.cashSheet);
    if (!id || !net.drive()) return;
    ui.cash = Object.assign({}, ui.cash, { state: 'loading', id: id });
    render();
    try {
      const file = await net.sheetAsXlsx(id, refresh);
      const X = await loadXlsx();
      const wb = X.read(base64Bytes(file.content), { type: 'array' });
      const sheets = wb.SheetNames.map(function (n) { return { name: n, rows: X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) }; });
      const month = L.cashMonth(sheets);
      ui.cash = { state: 'ok', id: id, title: file.title, month: month, at: Date.now(), sel: month.lastDay };
    } catch (e) {
      ui.cash = { state: 'error', id: id, error: e && e.code ? net.explain(e, 'read', 'Google Drive').text
        : e && /reader/.test(e.message || '') ? 'The Excel reader could not load. Check the internet connection and try again.'
          : 'The spreadsheet could not be read. Check that the link is a Google Sheet you can open.' };
    }
    render();
  }

  function viewCash(d) {
    const s = store.settings;
    const id = L.sheetId(s.cashSheet);
    const c = ui.cash;
    const head = officeHead('cash', 'Cash', 'The daily cash report: what was in the till, what went out and what came in.',
      id && net.drive() ? '<a class="btn ghost" href="https://docs.google.com/spreadsheets/d/' + esc(id) + '/edit" target="_blank" rel="noopener">Open the sheet</a><button type="button" class="btn" data-act="cash-refresh">Refresh</button>' : '');
    if (!id) {
      return head + '<section class="panel stack"><h2>Connect the cash report</h2>' +
        '<p class="muted" style="margin:0">Paste the link of the Google Sheet you fill in every day: one tab per day (1–31) with НАЧАЛО, РАЗХОДИ, ПРИХОДИ, ОБЩО and ОСТАТЪК. Komat Back Office reads it; it never changes it.</p>' +
        '<div class="toolbar"><label class="sr-only" for="cash-link">Google Sheet link</label><input type="text" id="cash-link" placeholder="https://docs.google.com/spreadsheets/d/…" style="flex:1 1 320px">' +
        '<button type="button" class="btn primary" data-act="cash-link-save">Connect</button></div></section>';
    }
    if (net.driveMissing) {
      return head + '<section class="panel stack"><h2>Add Google Drive to your claude.ai account</h2><p class="muted" style="margin:0">In claude.ai open Settings → Connectors, add Google Drive with the account that can open the cash report, then reload this page.</p></section>';
    }
    if (!net.drive()) {
      return head + '<section class="panel stack"><h2>The cash report opens on claude.ai</h2><p class="muted" style="margin:0">Open Komat Back Office from your claude.ai link with Google Drive connected to read the cash report here.</p></section>';
    }
    if (c.state === 'idle' || c.id !== id) {
      ui.cash = { state: 'loading', id: id }; // marks it taken, so a second redraw doesn't start another download
      setTimeout(function () { loadCash(false); }, 0);
    }
    if (c.state !== 'ok' && c.state !== 'error') return head + '<div class="loading"><div class="spinner"></div><span>Reading the cash report…</span></div>';
    if (c.state === 'error') {
      return head + '<section class="panel stack"><div class="note bad"><p>' + esc(c.error) + '</p></div><div class="actions"><button type="button" class="btn" data-act="cash-refresh">Try again</button><button type="button" class="btn ghost" data-act="cash-unlink">Use another sheet</button></div></section>';
    }
    const m = c.month;
    if (!m.days.length) {
      return head + '<section class="panel stack"><p style="margin:0">“' + esc(c.title) + '” has no day tabs named 1 to 31, so it does not look like the cash report.</p><div class="actions"><button type="button" class="btn" data-act="cash-unlink">Use another sheet</button></div></section>';
    }
    const sel = m.days.find(function (x) { return x.day === c.sel; }) || m.days.find(function (x) { return x.day === m.lastDay; }) || m.days[0];
    const strip = '<div class="strip">' +
      stat({ cls: 'hot', label: 'Cash left', value: m.cashNow === null ? '–' : cashMoney(m.cashNow), hint: m.lastDay ? 'end of day ' + m.lastDay : 'no days filled yet' }) +
      stat({ label: 'Cash out', value: cashMoney(m.totalOut), hint: plural(m.filled, 'day') + ' filled' }) +
      stat({ label: 'Cash in', value: cashMoney(m.totalIn), hint: 'ПРИХОДИ this month' }) +
      stat({ label: 'Biggest payee', value: m.payees[0] ? cashMoney(m.payees[0].amount) : '–', hint: m.payees[0] ? m.payees[0].label + ', ' + plural(m.payees[0].count, 'time') : '' }) + '</div>';
    const table = '<section class="panel flush"><div class="section-head"><h2>' + esc(c.title || 'Cash report') + '</h2><span class="muted small">read ' + esc(ago(c.at)) + '</span></div>' +
      '<div class="table-wrap"><table class="line-table winelist cashdays"><thead><tr><th>Day</th><th class="r">Opening</th><th class="r">Out</th><th class="r">In</th><th class="r">Left</th><th>Who</th></tr></thead><tbody>' +
      m.days.filter(function (x) { return x.filled || x.day === sel.day; }).map(function (x) {
        return '<tr class="' + (x.day === sel.day ? 'sel' : '') + '"><td><button type="button" class="btn ghost sm" data-act="cash-day" data-day="' + x.day + '">Day ' + x.day + '</button></td>' +
          '<td class="r num" data-l="Opening">' + esc(cashMoney(x.opening)) + '</td><td class="r num" data-l="Out">' + esc(cashMoney(x.totalOut)) + '</td>' +
          '<td class="r num" data-l="In">' + esc(cashMoney(x.totalIn)) + '</td><td class="r num" data-l="Left"><b>' + esc(cashMoney(x.closing)) + '</b></td><td data-l="Who">' + esc(x.name) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
    const lines = function (list, empty) {
      return list.length ? '<div class="rows">' + list.map(function (x) {
        return '<div class="row"><div class="row-main"><span class="name">' + esc(x.label) + '</span></div><span class="num">' + esc(cashMoney(x.amount)) + '</span><span></span></div>';
      }).join('') + '</div>' : '<div class="empty"><span>' + empty + '</span></div>';
    };
    const max = m.payees[0] ? m.payees[0].amount : 1;
    const dayPanel = '<section class="panel flush"><div class="section-head"><h2>Day ' + sel.day + '</h2><span class="muted small num">' + esc(cashMoney(sel.opening)) + ' → ' + esc(cashMoney(sel.closing)) + '</span></div>' +
      '<h3 class="group-label">Out (РАЗХОДИ) <span>' + esc(cashMoney(sel.totalOut)) + '</span></h3>' + lines(sel.out, 'Nothing paid out.') +
      '<h3 class="group-label">In (ПРИХОДИ) <span>' + esc(cashMoney(sel.totalIn)) + '</span></h3>' + lines(sel.in, 'Nothing came in.') + '</section>';
    const payees = '<section class="panel stack"><div class="section-head"><h2>Where the cash went</h2><span class="muted small">this month</span></div>' +
      '<div class="payees">' + m.payees.slice(0, 10).map(function (p) {
        return '<div class="payee"><span class="payee-name">' + esc(p.label) + ' <span class="muted small">×' + p.count + '</span></span><span class="num">' + esc(cashMoney(p.amount)) + '</span>' +
          '<span class="payee-bar" aria-hidden="true"><i style="width:' + Math.max(2, Math.round(p.amount / max * 100)) + '%"></i></span></div>';
      }).join('') + '</div></section>';
    return head + strip + '<div class="grid-2"><div class="stack">' + table + '</div><div class="stack">' + dayPanel + payees + '</div></div>';
  }

  function viewInvoices(d) {
    const head = officeHead('invoices', 'Invoices', 'Invoice emails from your suppliers, newest first.', net.gmail() && ui.gmailOn ? '<button type="button" class="btn" data-act="gmail-refresh">Refresh</button>' : '');
    if (!net.gmail() || !ui.gmailOn) {
      return head + '<section class="panel stack"><h2>Invoices come from your Gmail</h2><p class="muted" style="margin:0">' +
        (net.gmail() ? 'Connect Gmail on the Mail tab to list supplier invoices here.' : 'Open Komat Back Office on claude.ai with Gmail connected to list supplier invoices here.') + '</p>' +
        (net.gmail() ? '<div class="actions"><a class="btn primary" href="#inbox">Connect Gmail</a></div>' : '') + '</section>';
    }
    return head + '<section class="panel flush"><div class="section-head"><h2>Invoice emails</h2>' + updatedLine('invoices') + '</div>' + mailList('invoices', 'No invoice emails found. Check the invoice search in Setup.') + '</section>' +
      '<p class="small muted">Searching Gmail for: <code>' + esc(invoiceQuery()) + '</code>. Change it under <a href="#setup">Setup → Email searches</a>.</p>';
  }

  /* ---------- sheets (side panels) ---------- */

  let lastFocus = null;

  function openSheet(state) {
    lastFocus = document.activeElement;
    ui.sheet = state;
    renderSheet(true);
  }

  function closeSheet() {
    ui.sheet = null;
    sheetRoot.innerHTML = '';
    document.body.style.overflow = '';
    if (lastFocus && document.contains(lastFocus) && lastFocus.focus) lastFocus.focus();
  }

  function renderSheet(initial) {
    const s = ui.sheet;
    if (!s) return;
    const def = SHEETS[s.type](s);
    const existing = sheetRoot.querySelector('.sheet');
    withFocus(sheetRoot, function () {
      if (initial || !existing) {
        sheetRoot.innerHTML = '<div class="scrim" data-act="close-sheet"></div>' +
          '<section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">' +
          '<header class="sheet-head"><h2 id="sheet-title">' + esc(def.title) + '</h2><button type="button" class="close" data-act="close-sheet" aria-label="Close">×</button></header>' +
          '<div class="sheet-body" id="sheet-body">' + def.body + '</div>' +
          (def.foot ? '<footer class="sheet-foot" id="sheet-foot">' + def.foot + '</footer>' : '') + '</section>';
        return;
      }
      // Update in place: the panel stays put (no replayed slide-in) and keeps its scroll position.
      const body = document.getElementById('sheet-body');
      const scroll = body.scrollTop;
      document.getElementById('sheet-title').textContent = def.title;
      body.innerHTML = def.body;
      body.scrollTop = scroll;
      let foot = document.getElementById('sheet-foot');
      if (def.foot) {
        if (!foot) {
          foot = document.createElement('footer');
          foot.className = 'sheet-foot';
          foot.id = 'sheet-foot';
          existing.appendChild(foot);
        }
        foot.innerHTML = def.foot;
      } else if (foot) {
        foot.remove();
      }
    });
    if (initial) {
      document.body.style.overflow = 'hidden';
      const first = sheetRoot.querySelector('[autofocus]') || sheetRoot.querySelector('.sheet-body input, .sheet-body select, .sheet-body textarea, .sheet-foot .btn');
      if (first) first.focus();
    }
  }

  /** Re-renders only the footer, so typed form values stay put. */
  function renderSheetFoot() {
    const s = ui.sheet;
    const foot = document.getElementById('sheet-foot');
    if (!s || !foot) return;
    foot.innerHTML = SHEETS[s.type](s).foot;
  }

  function supplierOptions(selected) {
    return '<option value="">No supplier</option>' + store.list('suppliers').sort(byName).map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (s.id === selected ? ' selected' : '') + '>' + esc(s.name) + '</option>';
    }).join('');
  }

  function datalists() {
    const items = store.list('items');
    const uniq = function (key, extra) {
      return Array.from(new Set(items.map(function (i) { return i[key]; }).filter(Boolean).concat(extra || []))).sort();
    };
    const dl = function (id, values) { return '<datalist id="' + id + '">' + values.map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>'; };
    return dl('dl-loc', uniq('location', ['Walk-in fridge', 'Freezer', 'Dry store', 'Bar', 'Cellar'])) +
      dl('dl-cat', uniq('category', ['Produce', 'Meat & fish', 'Dairy', 'Dry goods', 'Wine', 'Beer', 'Soft drinks', 'Non-food'])) +
      dl('dl-unit', uniq('unit', UNITS)) + dl('dl-pack', uniq('packLabel', ['case', 'box', 'sack', 'tray', 'crate', 'bag', 'can']));
  }

  function inputField(name, label, value, opts) {
    const o = opts || {};
    return '<label class="field' + (o.wide ? ' wide' : '') + '" for="f-' + name + '"><span>' + label + '</span>' +
      '<input type="' + (o.type || 'text') + '" id="f-' + name + '" name="' + name + '" value="' + esc(value === undefined || value === null ? '' : value) + '"' +
      (o.required ? ' required' : '') + (o.list ? ' list="' + o.list + '"' : '') + (o.mode ? ' inputmode="' + o.mode + '"' : '') +
      (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + (o.autofocus ? ' autofocus' : '') + ' autocomplete="off">' +
      (o.hint ? '<span class="hint">' + o.hint + '</span>' : '') + '</label>';
  }

  function deleteFoot(s, what, formId) {
    if (s.confirmDelete) {
      return '<span class="small" style="margin-right:auto">Delete this ' + what + '?</span><button type="button" class="btn" data-act="sheet-undelete">Keep</button>' +
        '<button type="button" class="btn danger solid" data-act="sheet-delete">Delete</button>';
    }
    return (s.id && !store.readOnly ? '<button type="button" class="btn danger" data-act="sheet-ask-delete">Delete</button>' : '') + '<span class="spacer"></span>' +
      '<button type="button" class="btn" data-act="close-sheet">Cancel</button>' +
      (store.readOnly ? '' : '<button type="submit" class="btn primary" form="' + formId + '">Save</button>');
  }

  const SHEETS = {
    item: function (s) {
      const i = s.id ? effItem(s.id) || {} : (s.preset || {});
      const rp = L.num(i.reorderAt, NaN);
      const kind = i.kind || '';
      const colourOpts = L.WINE_COLOURS.map(function (c) { return '<option value="' + c[0] + '"' + (i.colour === c[0] ? ' selected' : '') + '>' + c[1] + '</option>'; }).join('');
      return {
        title: s.id ? 'Edit item' : 'New item',
        body: '<form data-form="item" id="item-form" class="form-grid">' + datalists() +
          inputField('name', 'Name', i.name, { required: true, wide: true, autofocus: !s.id, placeholder: kind === 'wine' ? 'e.g. Rioja Reserva' : 'e.g. Tomatoes' }) +
          '<label class="field wide" for="f-kind"><span>Sold to guests</span><select id="f-kind" name="kind" data-bind="item-kind">' +
          '<option value="">Not sold directly (kitchen or bar supply)</option>' +
          '<option value="wine"' + (kind === 'wine' ? ' selected' : '') + '>Wine, by the bottle and the glass</option>' +
          '<option value="drink"' + (kind === 'drink' ? ' selected' : '') + '>Drink sold per piece (soft drinks, water, juice)</option>' +
          '</select><span class="hint">Wines and drinks show up on the Bar screen, and every sale comes off stock.</span></label>' +
          '<fieldset class="wide form-grid" id="wine-fields"' + (kind === 'wine' ? '' : ' hidden') + '><legend>Wine</legend>' +
          inputField('producer', 'Producer', i.producer) +
          inputField('vintage', 'Vintage', i.vintage, { placeholder: '2022 or NV' }) +
          inputField('region', 'Region', i.region) +
          inputField('grape', 'Grape', i.grape) +
          '<label class="field" for="f-colour"><span>Style</span><select id="f-colour" name="colour"><option value="">Choose…</option>' + colourOpts + '</select></label>' +
          inputField('bottleCl', 'Bottle size (cl)', i.bottleCl || 75, { mode: 'decimal' }) +
          inputField('glassCl', 'Glass size (cl)', i.glassCl || '', { mode: 'decimal', placeholder: 'e.g. 15', hint: 'Leave empty if it is only sold by the bottle.' }) +
          inputField('glassPrice', 'Price per glass', i.glassPrice, { mode: 'decimal' }) +
          '</fieldset>' +
          inputField('location', 'Storage location', i.location, { list: 'dl-loc', placeholder: 'Walk-in fridge' }) +
          inputField('category', 'Category', i.category, { list: 'dl-cat', placeholder: 'Produce' }) +
          inputField('unit', 'Counted in', i.unit || 'pcs', { list: 'dl-unit', hint: 'The unit you count: kg, l, pcs, bottle…' }) +
          inputField('onHand', 'On hand now', i.onHand === undefined ? '' : i.onHand, { mode: 'decimal' }) +
          inputField('par', 'Par level', i.par, { mode: 'decimal', hint: 'How much you want after a delivery.' }) +
          inputField('reorderAt', 'Reorder at', Number.isFinite(rp) ? rp : '', { mode: 'decimal', placeholder: i.par ? qtyText(L.reorderPoint(i)) + ' (40% of par)' : '40% of par', hint: 'At or below this, the item goes on the next order.' }) +
          inputField('packSize', 'Units per pack', i.packSize || '', { mode: 'decimal', placeholder: '1', hint: 'e.g. 6 bottles in a case. Orders round up to whole packs.' }) +
          inputField('packLabel', 'Pack name', i.packLabel, { list: 'dl-pack', placeholder: 'case' }) +
          '<label class="field wide" for="f-supplierId"><span>Supplier</span><select id="f-supplierId" name="supplierId">' + supplierOptions(i.supplierId) + '</select></label>' +
          inputField('cost', 'Cost per unit', i.cost, { mode: 'decimal', hint: 'Purchase price (EK) per counted unit.' }) +
          inputField('price', 'Selling price', i.price, { mode: 'decimal', hint: 'Menu price (VK): per bottle for wines, per piece for drinks.' }) +
          inputField('sku', 'Article number', i.sku, { placeholder: 'Supplier or Hype number' }) +
          '<label class="field wide" for="f-notes"><span>Notes</span><textarea id="f-notes" name="notes" style="min-height:64px">' + esc(i.notes) + '</textarea></label>' +
          '</form>',
        foot: deleteFoot(s, 'item', 'item-form')
      };
    },

    supplier: function (s) {
      const x = s.id ? store.get('suppliers', s.id) || {} : {};
      const days = x.orderDays || [];
      return {
        title: s.id ? 'Edit supplier' : 'New supplier',
        body: '<form data-form="supplier" id="supplier-form" class="form-grid">' +
          inputField('name', 'Company', x.name, { required: true, wide: true, autofocus: !s.id }) +
          inputField('email', 'Order email', x.email, { mode: 'email', hint: 'Where orders are sent. Separate several with commas.' }) +
          inputField('contact', 'Contact name', x.contact, { hint: 'Used in the greeting.' }) +
          inputField('phone', 'Phone', x.phone, { type: 'tel', mode: 'tel' }) +
          inputField('customerNo', 'Your customer number', x.customerNo) +
          '<fieldset class="wide"><legend>Order days</legend><div class="daypick">' + WEEK_ORDER.map(function (n) {
            return '<label><input type="checkbox" name="orderDays" value="' + n + '"' + (days.indexOf(n) > -1 ? ' checked' : '') + '><span>' + L.WEEKDAYS[n] + '</span></label>';
          }).join('') + '</div></fieldset>' +
          inputField('cutoff', 'Order by (time)', x.cutoff, { type: 'time' }) +
          inputField('leadDays', 'Days until delivery', x.leadDays === undefined ? 1 : x.leadDays, { mode: 'numeric' }) +
          inputField('minOrder', 'Minimum order value', x.minOrder, { mode: 'decimal' }) +
          '<label class="field wide" for="f-notes"><span>Notes</span><textarea id="f-notes" name="notes" style="min-height:64px">' + esc(x.notes) + '</textarea></label>' +
          '</form>',
        foot: deleteFoot(s, 'supplier', 'supplier-form')
      };
    },

    booking: function (s) {
      const r = s.id ? store.get('reservations', s.id) || {} : {};
      return {
        title: s.id ? 'Edit booking' : 'New booking',
        body: '<form data-form="booking" id="booking-form" class="form-grid">' +
          inputField('date', 'Date', r.date || s.date || ui.bookings.day, { type: 'date', required: true }) +
          inputField('time', 'Time', r.time || '19:00', { type: 'time' }) +
          inputField('name', 'Name', r.name, { autofocus: !s.id, wide: true }) +
          inputField('covers', 'Covers', r.covers || 2, { mode: 'numeric', required: true }) +
          inputField('phone', 'Phone', r.phone, { type: 'tel' }) +
          '<label class="field wide" for="f-note"><span>Note</span><textarea id="f-note" name="note" style="min-height:64px">' + esc(r.note) + '</textarea></label>' +
          (s.id ? '<label class="check wide" for="f-cancelled"><input type="checkbox" id="f-cancelled" name="cancelled"' + (r.status === 'cancelled' ? ' checked' : '') + '><span>Cancelled</span></label>' : '') +
          '</form>',
        foot: deleteFoot(s, 'booking', 'booking-form')
      };
    },

    pickSupplier: function () {
      const sups = store.list('suppliers').sort(byName);
      return {
        title: 'New order',
        body: sups.length ? '<p class="muted" style="margin:0">Who is this order for?</p><div class="rows panel flush">' + sups.map(function (x) {
          return '<div class="row"><div class="row-main"><span class="name" style="font-weight:650">' + esc(x.name) + '</span><span class="row-meta">' + esc(x.email || 'no email yet') + '</span></div><span></span>' +
            '<button type="button" class="btn sm primary" data-act="start-order" data-supplier="' + esc(x.id) + '" data-blank="1">Start</button></div>';
        }).join('') + '</div>' : '<div class="empty"><span>Add a supplier first.</span><button type="button" class="btn primary" data-act="new-supplier">Add supplier</button></div>'
      };
    },

    order: function (s) { return orderSheet(s); },
    linkAsk: function (s) { return linkAskSheet(s); },
    importKitchen: function (s) { return importKitchenSheet(s); },
    importSales: function (s) { return importSalesSheet(s); },
    importItems: function (s) { return importItemsSheet(s); },
    importBookings: function (s) { return importBookingsSheet(s); },
    importBackup: function (s) { return importBackupSheet(s); }
  };

  /* ---------- order sheet ---------- */

  function orderSheet(s) {
    const o = s.draft;
    const sup = store.get('suppliers', o.supplierId) || { name: 'Unknown supplier' };
    const settings = store.settings;
    const mail = L.orderEmail(o, sup, settings);
    const editable = o.status === 'draft' && !store.readOnly;
    const items = store.list('items').sort(byName);
    const inOrder = {};
    (o.lines || []).forEach(function (l) { inOrder[l.itemId] = true; });

    let body = '<dl class="kv"><dt>Supplier</dt><dd><b>' + esc(sup.name) + '</b></dd>' +
      '<dt>Send to</dt><dd>' + (sup.email ? '<span class="copy-line"><code>' + esc(sup.email) + '</code><button type="button" class="btn ghost sm" data-act="copy" data-text="' + esc(sup.email) + '">Copy</button></span>' : '<span style="color:var(--bad)">No email address. <button type="button" class="btn ghost sm" data-act="edit-supplier" data-id="' + esc(sup.id || '') + '">Add one</button></span>') + '</dd>' +
      (settings.copyTo ? '<dt>Copy to</dt><dd>' + esc(settings.copyTo) + '</dd>' : '') +
      '<dt>Status</dt><dd>' + orderPill(o.status) + (o.sentAt ? ' <span class="muted small">sent ' + esc(ago(o.sentAt)) + (o.sentVia === 'gmail' ? ' with Gmail' : '') + '</span>' : '') + '</dd></dl>';

    if (s.message) body += '<div class="note' + (s.message.kind === 'bad' ? ' bad' : '') + '"><p>' + esc(s.message.text) + '</p>' + (s.message.link ? '<p><a href="' + esc(s.message.link) + '" target="_blank" rel="noopener">Open in Gmail</a></p>' : '') + '</div>';

    if (s.receiving) {
      body += '<section class="stack"><h3>What arrived?</h3><p class="small muted" style="margin:0">Adjust anything that was short or missing. Received amounts are added to stock.</p>' +
        '<div class="table-wrap"><table class="line-table"><thead><tr><th>Item</th><th class="r">Ordered</th><th class="r">Received</th><th></th></tr></thead><tbody>' +
        (o.lines || []).map(function (l, idx) {
          return '<tr><td>' + esc(l.name) + '</td><td class="r num">' + esc(qtyText(l.qty)) + '</td>' +
            '<td class="r"><label class="sr-only" for="rv-' + idx + '">Received ' + esc(l.name) + '</label><input type="text" inputmode="decimal" class="count-input" id="rv-' + idx + '" data-recv="' + idx + '" value="' + esc(s.recv[idx]) + '"></td>' +
            '<td class="small muted">' + esc(l.unitsPerPack > 1 ? l.orderUnit : l.unit) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';
    } else if (editable) {
      const own = items.filter(function (i) { return i.supplierId === o.supplierId && !inOrder[i.id]; });
      const other = items.filter(function (i) { return i.supplierId !== o.supplierId && !inOrder[i.id]; });
      body += '<section class="stack"><h3>Lines</h3>' +
        ((o.lines || []).length ? '<div class="table-wrap"><table class="line-table"><thead><tr><th>Item</th><th class="r">Qty</th><th></th><th></th></tr></thead><tbody>' +
          o.lines.map(function (l, idx) {
            const item = effItem(l.itemId);
            return '<tr><td>' + esc(l.name) + (l.asked ? ' <span class="pill ' + (l.asked === 'out' ? 'out' : 'low') + '">Kitchen</span>' : '') + (item ? '<div class="small muted">on hand ' + esc(qtyText(item.onHand)) + ' ' + esc(item.unit || '') + ' · par ' + esc(qtyText(item.par)) + '</div>' : '') + '</td>' +
              '<td class="r"><label class="sr-only" for="ol-' + idx + '">Quantity of ' + esc(l.name) + '</label><input type="text" inputmode="decimal" class="count-input" id="ol-' + idx + '" data-line="' + idx + '" value="' + esc(qtyText(l.qty)) + '"></td>' +
              '<td class="small muted">' + esc(l.unitsPerPack > 1 ? l.orderUnit + ' of ' + qtyText(l.unitsPerPack) : l.unit) + '</td>' +
              '<td><button type="button" class="btn ghost sm" data-act="line-remove" data-i="' + idx + '" aria-label="Remove ' + esc(l.name) + '">Remove</button></td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="muted small" style="margin:0">No lines yet. Add items below.</p>') +
        '<label class="field" for="ol-add"><span>Add an item</span><select id="ol-add" data-bind="line-add"><option value="">Choose…</option>' +
        (own.length ? '<optgroup label="' + esc(sup.name) + '">' + own.map(function (i) { return '<option value="' + esc(i.id) + '">' + esc(i.name) + ' (' + esc(qtyText(i.onHand)) + ' ' + esc(i.unit || '') + ')</option>'; }).join('') + '</optgroup>' : '') +
        (other.length ? '<optgroup label="Other items">' + other.map(function (i) { return '<option value="' + esc(i.id) + '">' + esc(i.name) + '</option>'; }).join('') + '</optgroup>' : '') +
        '</select></label>' +
        '<div class="form-grid"><label class="field" for="o-date"><span>Delivery date</span><input type="date" id="o-date" data-bind="order-date" value="' + esc(o.deliveryDate || '') + '"></label>' +
        '<label class="field wide" for="o-note"><span>Note to the supplier</span><textarea id="o-note" data-bind="order-note" style="min-height:64px" placeholder="e.g. Please deliver before 10:00, back door.">' + esc(o.note || '') + '</textarea></label></div></section>';
    }

    body += '<section class="stack"><div class="section-head"><h3>Email</h3><button type="button" class="btn ghost sm" data-act="order-copy">Copy text</button></div>' +
      '<div class="ticket" id="ticket"><div class="ticket-head"><span>' + esc(o.number || 'ORDER') + '</span><span>' + esc(L.isoDate(new Date(o.createdAt || Date.now()))) + '</span></div>' +
      '<b>' + esc(mail.subject) + '</b>\n\n' + esc(mail.body) + '</div></section>';

    return { title: (o.status === 'draft' ? 'Order for ' : o.status === 'sent' ? 'Check in · ' : '') + sup.name, body: body, foot: orderFoot(s, sup, mail) };
  }

  function orderFoot(s, sup, mail) {
    const o = s.draft;
    if (store.readOnly) return '<button type="button" class="btn" data-act="close-sheet">Close</button>';
    if (s.confirm === 'delete') {
      return '<span class="small" style="margin-right:auto">Delete this draft?</span><button type="button" class="btn" data-act="order-confirm-cancel">Keep</button><button type="button" class="btn danger solid" data-act="order-delete">Delete draft</button>';
    }
    if (s.confirm === 'cancel') {
      return '<span class="small" style="margin-right:auto">Cancel this order? Stock is not changed.</span><button type="button" class="btn" data-act="order-confirm-cancel">Keep</button><button type="button" class="btn danger solid" data-act="order-cancel">Cancel order</button>';
    }
    if (s.confirm === 'send') {
      return '<span class="small" style="margin-right:auto">Send to <b>' + esc(sup.email) + '</b> from your Gmail now?</span><button type="button" class="btn" data-act="order-confirm-cancel">Back</button>' +
        '<button type="button" class="btn primary" data-act="order-send-gmail"' + (s.busy ? ' disabled' : '') + '>' + ICON.send + (s.busy ? 'Sending…' : 'Send now') + '</button>';
    }
    if (o.status === 'draft') {
      const hasLines = (o.lines || []).some(function (l) { return L.num(l.qty, 0) > 0; });
      const canEmail = hasLines && !!sup.email;
      const mailto = 'mailto:' + encodeURIComponent(sup.email || '').replace(/%40/g, '@').replace(/%2C/g, ',') + '?subject=' + encodeURIComponent(mail.subject) +
        (store.settings.copyTo ? '&cc=' + encodeURIComponent(store.settings.copyTo) : '') + '&body=' + encodeURIComponent(mail.body);
      return '<button type="button" class="btn danger" data-act="order-ask-delete">Delete</button><span class="spacer"></span>' +
        (canEmail ? '<a class="btn" href="' + esc(mailto) + '" target="_blank" rel="noopener" data-act="order-mailto">Open in email app</a>' : '') +
        '<button type="button" class="btn" data-act="order-mark-sent"' + (hasLines ? '' : ' disabled') + '>Mark as sent</button>' +
        (net.gmail() ? '<button type="button" class="btn" data-act="order-draft-gmail"' + (canEmail && !s.busy ? '' : ' disabled') + '>Gmail draft</button>' +
          '<button type="button" class="btn primary" data-act="order-ask-send"' + (canEmail && !s.busy ? '' : ' disabled') + '>' + ICON.send + 'Send with Gmail</button>' : '');
    }
    if (o.status === 'sent') {
      if (s.receiving) return '<button type="button" class="btn" data-act="order-receive-back">Back</button><span class="spacer"></span><button type="button" class="btn primary" data-act="order-receive-save">Add to stock</button>';
      return '<button type="button" class="btn danger" data-act="order-ask-cancel">Cancel order</button><button type="button" class="btn" data-act="order-unsend">Back to draft</button><span class="spacer"></span>' +
        '<button type="button" class="btn primary" data-act="order-receive">Check in delivery</button>';
    }
    return '<span class="spacer"></span><button type="button" class="btn" data-act="close-sheet">Close</button>';
  }

  function openOrder(id, receiving) {
    const o = store.get('orders', id);
    if (!o) { toast('That order no longer exists.', 'bad'); return; }
    const draft = clone(o);
    openSheet({ type: 'order', id: id, draft: draft, receiving: !!receiving && o.status === 'sent', recv: (draft.lines || []).map(function (l) { return qtyText(l.qty); }), confirm: null, message: null });
  }

  function saveOrderDraft() {
    const s = ui.sheet;
    if (!s || s.type !== 'order') return;
    store.put('orders', s.draft);
  }

  function refreshTicket() {
    const s = ui.sheet;
    const t = document.getElementById('ticket');
    if (!s || !t) return;
    const sup = store.get('suppliers', s.draft.supplierId) || {};
    const mail = L.orderEmail(s.draft, sup, store.settings);
    t.innerHTML = '<div class="ticket-head"><span>' + esc(s.draft.number || 'ORDER') + '</span><span>' + esc(L.isoDate(new Date(s.draft.createdAt || Date.now()))) + '</span></div><b>' + esc(mail.subject) + '</b>\n\n' + esc(mail.body);
    renderSheetFoot();
  }

  function startOrder(supplierId, blank) {
    const d = derive();
    const sup = d.supplierById[supplierId];
    if (!sup) return;
    const sug = blank ? null : d.suggestions.find(function (g) { return g.supplier.id === supplierId; });
    const lines = sug ? sug.lines.map(function (l) {
      return { itemId: l.itemId, name: l.name, sku: l.sku, qty: l.qty, orderUnit: l.orderUnit, unitsPerPack: l.unitsPerPack, unit: l.unit, cost: l.cost, asked: l.asked };
    }) : [];
    const existing = d.draftBySupplier[supplierId];
    if (existing) {
      const have = {};
      (existing.lines || []).forEach(function (l) { have[l.itemId] = true; });
      const add = lines.filter(function (l) { return !have[l.itemId]; });
      if (add.length) store.patch('orders', existing.id, { lines: (existing.lines || []).concat(add) });
      openOrder(existing.id);
      if (add.length) toast(plural(add.length, 'line') + ' added to the draft');
      return;
    }
    const nod = L.nextOrderDay(sup, d.now);
    const base = nod ? L.fromIso(nod.date) : d.now;
    const id = store.put('orders', {
      number: L.orderNumber(d.now, d.orders),
      supplierId: supplierId,
      status: 'draft',
      createdAt: Date.now(),
      deliveryDate: L.expectedDelivery(sup, base),
      note: '',
      lines: lines
    });
    openOrder(id);
  }

  /* ---------- import sheets ---------- */

  /** Identifies an export layout by its header row, to remember how its columns were matched. */
  function headerKey(headers) { return L.hash(headers.map(function (h) { return L.normName(h); }).join('|')); }

  const FIELD_LABELS = {
    name: 'Name', sku: 'Article number', category: 'Category', location: 'Storage location', unit: 'Unit',
    onHand: 'On hand', par: 'Par level', reorderAt: 'Reorder at', packSize: 'Units per pack', packLabel: 'Pack name',
    cost: 'Cost per unit', price: 'Selling price', supplier: 'Supplier'
  };

  function fileOrPaste(prefix, accept, help) {
    return '<p class="muted" style="margin:0">' + help + '</p>' +
      '<label class="field" for="' + prefix + '-file"><span>Choose a file (CSV or Excel)</span><input type="file" id="' + prefix + '-file" data-file="' + prefix + '" accept="' + accept + '"></label>' +
      '<label class="field" for="' + prefix + '-paste"><span>…or paste the contents</span><textarea id="' + prefix + '-paste" style="min-height:120px;font-family:var(--font-mono);font-size:.78rem" placeholder="name;on hand;unit;par;supplier"></textarea></label>';
  }

  function importItemsSheet(s) {
    if (!s.rows) {
      return {
        title: 'Update stock from Hype',
        body: fileOrPaste('imp', '.csv,.txt,.tsv,.xlsx,.xls,text/csv', 'In Hype, export the stock list (наличности) as Excel or CSV and choose it here. Columns in Bulgarian or English are recognised, such as Наименование, Код, Мярка, Количество, Доставна цена, Продажна цена, Доставчик, Склад, Група. Stock figures from Hype replace the counts here; your par levels and suppliers stay.') +
          (s.error ? '<div class="note bad"><p>' + esc(s.error) + '</p></div>' : ''),
        foot: '<span class="spacer"></span><button type="button" class="btn" data-act="close-sheet">Cancel</button><button type="button" class="btn primary" data-act="imp-read">Read data</button>'
      };
    }
    const headers = s.rows[0];
    const preview = L.rowsToItems(s.rows, s.mapping);
    const existing = {};
    store.list('items').forEach(function (i) { existing[String(i.name).toLowerCase()] = true; });
    const updates = preview.filter(function (p) { return existing[p.name.toLowerCase()]; }).length;
    return {
      title: 'Update stock from Hype',
      body: '<p style="margin:0"><b class="num">' + (s.rows.length - 1) + '</b> rows found. Check which column holds what.</p>' +
        '<div class="form-grid">' + Object.keys(FIELD_LABELS).map(function (f) {
          return '<label class="field" for="map-' + f + '"><span>' + FIELD_LABELS[f] + (f === 'name' ? ' (required)' : '') + '</span><select id="map-' + f + '" data-map="' + f + '"><option value="">Not in file</option>' +
            headers.map(function (h, idx) { return '<option value="' + idx + '"' + (s.mapping[f] === idx ? ' selected' : '') + '>' + esc(h || 'Column ' + (idx + 1)) + '</option>'; }).join('') + '</select></label>';
        }).join('') + '</div>' +
        (s.remembered ? '<p class="small muted" style="margin:0">Using the columns you matched last time for this export.</p>' : '') +
        '<label class="check" for="imp-update"><input type="checkbox" id="imp-update" data-bind="imp-update"' + (s.update ? ' checked' : '') + '><span>Update stock and prices of items already in the list (matched by name): ' + plural(updates, 'match', 'matches') + '</span></label>' +
        '<label class="check" for="imp-addnew"><input type="checkbox" id="imp-addnew" data-bind="imp-addnew"' + (s.addNew ? ' checked' : '') + '><span>Add the ' + plural(preview.length - updates, 'item') + ' that ' + (preview.length - updates === 1 ? 'is' : 'are') + ' not in the list yet</span></label>' +
        '<h3>Preview</h3><div class="table-wrap"><table class="line-table"><thead><tr><th>Name</th><th class="r">On hand</th><th>Unit</th><th class="r">Par</th><th class="r">Cost</th><th>Supplier</th></tr></thead><tbody>' +
        preview.slice(0, 8).map(function (p) {
          return '<tr><td>' + esc(p.name) + '</td><td class="r num">' + esc(p.onHand === undefined ? '' : qtyText(p.onHand)) + '</td><td>' + esc(p.unit || '') + '</td><td class="r num">' + esc(p.par === undefined ? '' : qtyText(p.par)) + '</td><td class="r num">' + esc(p.cost === undefined ? '' : money(p.cost)) + '</td><td>' + esc(p.supplier || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        (preview.length > 8 ? '<p class="small muted" style="margin:0">…and ' + (preview.length - 8) + ' more.</p>' : '') +
        (s.mapping.name === undefined ? '<div class="note bad"><p>Pick the column that holds the item name.</p></div>' : ''),
      foot: '<button type="button" class="btn" data-act="imp-back">Back</button><span class="spacer"></span><button type="button" class="btn primary" data-act="imp-run"' + (s.mapping.name === undefined || !preview.length ? ' disabled' : '') + '>Import</button>'
    };
  }

  function importBookingsSheet(s) {
    if (!s.list) {
      return {
        title: 'Import bookings',
        body: fileOrPaste('impb', '.csv,.txt,.xlsx,.xls,text/csv', 'Export the bookings from reservation.tools (CSV or Excel). It needs a date and the number of guests per row; time, name, phone and notes are picked up when present. Bulgarian column names such as Дата, Час, Име, Брой гости and Телефон are recognised.') +
          (s.error ? '<div class="note bad"><p>' + esc(s.error) + '</p></div>' : ''),
        foot: '<span class="spacer"></span><button type="button" class="btn" data-act="close-sheet">Cancel</button><button type="button" class="btn primary" data-act="impb-read">Read data</button>'
      };
    }
    const covers = s.list.reduce(function (a, r) { return a + r.covers; }, 0);
    return {
      title: 'Import bookings',
      body: '<p style="margin:0"><b class="num">' + s.list.length + '</b> bookings, <b class="num">' + covers + '</b> covers.</p>' +
        '<div class="table-wrap"><table class="line-table"><thead><tr><th>Date</th><th>Time</th><th>Name</th><th class="r">Covers</th></tr></thead><tbody>' +
        s.list.slice(0, 10).map(function (r) { return '<tr><td class="num">' + esc(r.date) + '</td><td class="num">' + esc(r.time) + '</td><td>' + esc(r.name) + '</td><td class="r num">' + esc(r.covers) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' +
        '<label class="check" for="impb-replace"><input type="checkbox" id="impb-replace" data-bind="impb-replace"' + (s.replace ? ' checked' : '') + '><span>Replace earlier imported bookings on these dates (avoids doubles when you import the same export again)</span></label>',
      foot: '<button type="button" class="btn" data-act="impb-back">Back</button><span class="spacer"></span><button type="button" class="btn primary" data-act="impb-run">Import ' + plural(s.list.length, 'booking') + '</button>'
    };
  }

  function importBackupSheet(s) {
    return {
      title: 'Restore backup',
      body: '<p class="muted" style="margin:0">Choose a backup file exported from Komat Back Office. Records in the backup are added, and records with the same id are replaced. Nothing else is deleted.</p>' +
        '<label class="field" for="bk-file"><span>Backup file (.json)</span><input type="file" id="bk-file" data-file="bk" accept=".json,application/json"></label>' +
        (s.summary ? '<div class="note"><p>' + esc(s.summary) + '</p></div>' : '') + (s.error ? '<div class="note bad"><p>' + esc(s.error) + '</p></div>' : ''),
      foot: '<span class="spacer"></span><button type="button" class="btn" data-act="close-sheet">Cancel</button><button type="button" class="btn primary" data-act="bk-run"' + (s.data ? '' : ' disabled') + '>Restore</button>'
    };
  }

  let xlsxLoading = null;
  /** SheetJS, loaded only when someone picks an Excel file. */
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxLoading) {
      xlsxLoading = new Promise(function (resolve, reject) {
        const sc = document.createElement('script');
        sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        sc.onload = function () { resolve(window.XLSX); };
        sc.onerror = function () { xlsxLoading = null; reject(new Error('Excel reader did not load')); };
        document.head.appendChild(sc);
      });
    }
    return xlsxLoading;
  }

  function decodeText(buf) {
    const text = new TextDecoder('utf-8').decode(buf);
    if (text.indexOf('\ufffd') < 0) return text;
    // Not UTF-8. Bulgarian Windows exports are usually Windows-1251, Western European ones Windows-1252.
    try {
      const cyrillic = new TextDecoder('windows-1251').decode(buf);
      if (/[\u0400-\u04FF]{3}/.test(cyrillic)) return cyrillic;
      return new TextDecoder('windows-1252').decode(buf);
    } catch (e) {
      return text;
    }
  }

  /** A chosen file as text; Excel files become semicolon-separated rows of their first sheet. */
  function readFileText(input) {
    const f = input.files && input.files[0];
    if (!f) return Promise.resolve(null);
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsArrayBuffer(f);
    }).then(function (buf) {
      if (!/\.(xlsx|xlsm|xls|ods)$/i.test(f.name)) return decodeText(buf);
      return loadXlsx().then(function (X) {
        const wb = X.read(new Uint8Array(buf), { type: 'array' });
        return X.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: ';', blankrows: false });
      });
    });
  }

  async function sourceText(prefix) {
    const file = document.getElementById(prefix + '-file');
    const paste = document.getElementById(prefix + '-paste');
    const fromFile = file ? await readFileText(file) : null;
    return fromFile || (paste ? paste.value : '');
  }

  /* ---------- Gmail ---------- */

  const MAIL_KEYS = ['suppliers', 'orders', 'bookings', 'invoices'];

  function mailQueries() {
    const s = store.settings;
    return {
      suppliers: L.supplierQuery(store.list('suppliers')),
      orders: String(s.inboxQuery || '').trim(),
      bookings: String(s.bookingsQuery || '').trim(),
      invoices: invoiceQuery()
    };
  }

  /** Keeps one live Gmail search per list, re-registering when its query changes. */
  function syncWatches() {
    const wanted = net.gmail() && ui.gmailOn ? mailQueries() : {};
    MAIL_KEYS.forEach(function (key) {
      const q = wanted[key] || '';
      const w = ui.watches[key];
      if (w && w.query === q) return;
      if (w) { w.stop(); delete ui.watches[key]; delete ui.mail[key]; }
      if (!q) return;
      ui.mail[key] = { state: 'loading' };
      const stop = net.watchSearch(q, function (res) {
        if (res.ok) ui.mail[key] = { state: 'ok', rows: L.threadRows(res.payload), storedAt: res.storedAt };
        else {
          const x = net.explain(res.error, 'read');
          // Transient failures keep the last good list; access problems clear it.
          const prev = ui.mail[key];
          if (x.retry && prev && prev.state === 'ok') prev.stale = true;
          else ui.mail[key] = { state: 'error', error: x };
        }
        if (ui.view === 'inbox' || ui.view === 'today' || ui.view === 'bookings') scheduleRender();
      });
      ui.watches[key] = { query: q, stop: stop };
    });
  }

  async function connectGmail() {
    ui.gmailBusy = true;
    ui.gmailNote = null;
    render();
    try {
      await net.search('newer_than:1d');
      ui.gmailOn = true;
      setPref('gmailOn', true);
      MAIL_KEYS.forEach(function (k) { if (ui.watches[k]) { ui.watches[k].stop(); delete ui.watches[k]; } });
    } catch (e) {
      ui.gmailNote = net.explain(e, 'read').text;
    }
    ui.gmailBusy = false;
    render();
  }

  /* ---------- actions ---------- */

  const WRITE_ACTS = {
    inc: 1, dec: 1, 'count-save': 1, 'new-item': 1, 'new-supplier': 1, 'new-booking': 1, 'new-order': 1, 'start-order': 1,
    'load-examples': 1, 'remove-examples': 1, 'erase-all': 1, 'confirm-erase': 1, 'import-items': 1, 'import-bookings': 1, 'import-backup': 1,
    'receive-order': 1, 'count-start': 1, sell: 1, 'undo-sale': 1, 'new-wine': 1, 'new-drink': 1, 'import-sales': 1,
    'import-kitchen': 1, 'link-ask': 1
  };

  function bump(id, dir) {
    const item = effItem(id);
    if (!item) return;
    // Never below zero: a minus on an empty item does nothing.
    const step = dir < 0 ? -Math.min(stepFor(item), L.num(item.onHand, 0)) : stepFor(item);
    if (!step) return;
    store.addMove({ t: Date.now(), i: id, q: L.round(step, 3), k: 'adjust' }, L.isoDate(new Date()));
  }

  function addRecords(col, list) {
    list.forEach(function (x) { store.put(col, x); });
  }

  const ACTIONS = {
    'close-sheet': function () { closeSheet(); },
    copy: function (el) { copyText(el.dataset.text, 'Address'); },

    inc: function (el) { bump(el.dataset.id, 1); },
    dec: function (el) { bump(el.dataset.id, -1); },

    'filter-stock': function (el) {
      ui.stock.status = el.dataset.status || 'all';
      ui.stock.location = 'all';
      ui.stock.q = '';
      if (location.hash === '#stock') render();
    },
    'stock-status': function (el) { ui.stock.status = el.dataset.status; render(); },
    'stock-reset': function () { ui.stock.status = 'all'; ui.stock.location = 'all'; ui.stock.q = ''; render(); },
    'count-start': function (el, e) {
      ui.stock.counting = true;
      ui.stock.draft = {};
      ui.stock.status = 'all';
      ui.stock.q = '';
      if (location.hash !== '#stock') { if (el.tagName !== 'A') location.hash = '#stock'; } else render();
    },
    'count-cancel': function () { ui.stock.counting = false; ui.stock.draft = {}; render(); },
    'count-save': function () {
      let n = 0;
      Object.keys(ui.stock.draft).forEach(function (id) {
        const raw = ui.stock.draft[id];
        if (raw === '' || raw === undefined) return;
        const v = L.parseNum(raw);
        if (!Number.isFinite(v) || v < 0) return;
        const now = Date.now();
        store.patch('items', id, { onHand: L.round(v, 3), baseAt: now, countedAt: now });
        n++;
      });
      ui.stock.counting = false;
      ui.stock.draft = {};
      render();
      toast('Count saved for ' + plural(n, 'item'));
    },

    'new-item': function () { openSheet({ type: 'item' }); },
    'edit-item': function (el) { openSheet({ type: 'item', id: el.dataset.id }); },
    'new-supplier': function () { openSheet({ type: 'supplier' }); },
    'edit-supplier': function (el) { if (el.dataset.id) openSheet({ type: 'supplier', id: el.dataset.id }); },
    'new-booking': function (el) { openSheet({ type: 'booking', date: el.dataset.date }); },
    'edit-booking': function (el) { openSheet({ type: 'booking', id: el.dataset.id }); },
    'pick-day': function (el) { ui.bookings.day = el.dataset.date; if (ui.view !== 'bookings') location.hash = '#bookings'; else render(); },

    'sheet-ask-delete': function () { ui.sheet.confirmDelete = true; renderSheetFoot(); },
    'sheet-undelete': function () { ui.sheet.confirmDelete = false; renderSheetFoot(); },
    'sheet-delete': function () {
      const s = ui.sheet;
      const col = { item: 'items', supplier: 'suppliers', booking: 'reservations' }[s.type];
      if (s.type === 'supplier') {
        store.list('items').filter(function (i) { return i.supplierId === s.id; }).forEach(function (i) { store.patch('items', i.id, { supplierId: '' }); });
      }
      store.remove(col, s.id);
      closeSheet();
      toast('Deleted');
    },

    'orders-tab': function (el) {
      ui.orders.tab = el.dataset.tab;
      if (ui.view === 'orders') render();
      else if (el.tagName !== 'A') location.hash = '#orders';
    },
    'new-order': function () { openSheet({ type: 'pickSupplier' }); },
    'start-order': function (el) { startOrder(el.dataset.supplier, !!el.dataset.blank); },
    'open-order': function (el) { openOrder(el.dataset.id); },
    'receive-order': function (el) { openOrder(el.dataset.id, true); },
    'line-remove': function (el) {
      ui.sheet.draft.lines.splice(Number(el.dataset.i), 1);
      saveOrderDraft();
      renderSheet();
    },
    'order-copy': function () {
      const s = ui.sheet;
      const sup = store.get('suppliers', s.draft.supplierId) || {};
      const mail = L.orderEmail(s.draft, sup, store.settings);
      copyText('Subject: ' + mail.subject + '\n\n' + mail.body, 'Order text');
    },
    'order-mailto': function () {
      const s = ui.sheet;
      s.message = { kind: 'ok', text: 'Your email app should open with the order filled in. After you send it there, press Mark as sent.' };
      setTimeout(renderSheet, 300);
    },
    'order-mark-sent': function () {
      const s = ui.sheet;
      s.draft.status = 'sent';
      s.draft.sentAt = Date.now();
      s.draft.sentVia = s.draft.sentVia || 'manual';
      saveOrderDraft();
      s.message = { kind: 'ok', text: 'Marked as sent. Check it in here when the delivery arrives.' };
      renderSheet();
      toast('Order marked as sent');
    },
    'order-ask-send': function () { ui.sheet.confirm = 'send'; ui.sheet.message = null; renderSheet(); },
    'order-ask-delete': function () { ui.sheet.confirm = 'delete'; renderSheetFoot(); },
    'order-ask-cancel': function () { ui.sheet.confirm = 'cancel'; renderSheetFoot(); },
    'order-confirm-cancel': function () { ui.sheet.confirm = null; renderSheetFoot(); },
    'order-delete': function () { store.remove('orders', ui.sheet.id); closeSheet(); toast('Draft deleted'); },
    'order-cancel': function () {
      ui.sheet.draft.status = 'cancelled';
      saveOrderDraft();
      closeSheet();
      toast('Order cancelled');
    },
    'order-unsend': function () {
      const s = ui.sheet;
      s.draft.status = 'draft';
      delete s.draft.sentAt;
      delete s.draft.sentVia;
      saveOrderDraft();
      s.message = null;
      renderSheet();
    },
    'order-send-gmail': async function () {
      const s = ui.sheet;
      const sup = store.get('suppliers', s.draft.supplierId) || {};
      const mail = L.orderEmail(s.draft, sup, store.settings);
      s.busy = true;
      renderSheetFoot();
      try {
        await net.sendEmail({ to: sup.email, cc: store.settings.copyTo, subject: mail.subject, body: mail.body });
        s.draft.status = 'sent';
        s.draft.sentAt = Date.now();
        s.draft.sentVia = 'gmail';
        saveOrderDraft();
        s.message = { kind: 'ok', text: 'Sent to ' + sup.email + ' from your Gmail.' };
        toast('Order sent to ' + sup.name);
      } catch (e) {
        const x = net.explain(e, 'write');
        s.message = { kind: 'bad', text: x.text };
      }
      if (ui.sheet !== s) return;
      s.busy = false;
      s.confirm = null;
      renderSheet();
    },
    'order-draft-gmail': async function () {
      const s = ui.sheet;
      const sup = store.get('suppliers', s.draft.supplierId) || {};
      const mail = L.orderEmail(s.draft, sup, store.settings);
      s.busy = true;
      renderSheetFoot();
      try {
        const res = await net.draftEmail({ to: sup.email, cc: store.settings.copyTo, subject: mail.subject, body: mail.body });
        s.message = { kind: 'ok', text: 'Saved as a draft in your Gmail. Send it from there, then press Mark as sent.', link: res.url };
        s.draft.sentVia = 'gmail-draft';
        saveOrderDraft();
      } catch (e) {
        s.message = { kind: 'bad', text: net.explain(e, 'write').text };
      }
      if (ui.sheet !== s) return;
      s.busy = false;
      renderSheet();
    },
    'order-receive': function () { ui.sheet.receiving = true; ui.sheet.message = null; renderSheet(); },
    'order-receive-back': function () { ui.sheet.receiving = false; renderSheet(); },
    'order-receive-save': function () {
      const s = ui.sheet;
      let added = 0;
      (s.draft.lines || []).forEach(function (l, idx) {
        const got = L.parseNum(s.recv[idx]);
        l.receivedQty = Number.isFinite(got) && got >= 0 ? got : 0;
        const item = l.itemId && store.get('items', l.itemId);
        if (item && l.receivedQty > 0) {
          store.addMove({ t: Date.now(), i: item.id, q: L.round(l.receivedQty * Math.max(1, L.num(l.unitsPerPack, 1)), 3), k: 'receive', o: s.id }, L.isoDate(new Date()));
          added++;
        }
      });
      s.draft.status = 'received';
      s.draft.receivedAt = Date.now();
      saveOrderDraft();
      closeSheet();
      toast('Delivery checked in: ' + plural(added, 'item') + ' added to stock');
    },

    'cash-link-save': function () {
      const v = document.getElementById('cash-link').value;
      if (!L.sheetId(v)) { toast('That does not look like a Google Sheets link.', 'bad'); return; }
      store.saveSettings({ cashSheet: v.trim() });
      ui.cash = { state: 'idle' };
      render();
    },
    'cash-refresh': function () { loadCash(true); },
    'cash-unlink': function () { store.saveSettings({ cashSheet: '' }); ui.cash = { state: 'idle' }; render(); },
    'cash-day': function (el) { ui.cash.sel = Number(el.dataset.day); render(); },
    /* bar */
    'bar-tab': function (el) { ui.bar.tab = el.dataset.tab; render(); },
    'bar-range': function (el) { ui.bar.range = el.dataset.range; render(); },
    'new-wine': function () { openSheet({ type: 'item', preset: { kind: 'wine', unit: 'bottle', bottleCl: 75, glassCl: 15, category: 'Wine', packSize: 6, packLabel: 'case' } }); },
    'new-drink': function () { openSheet({ type: 'item', preset: { kind: 'drink', unit: 'bottle', category: 'Soft drinks', packSize: 24, packLabel: 'case' } }); },
    sell: function (el) {
      const item = effItem(el.dataset.id);
      const serve = L.serveOf(item, el.dataset.serve);
      if (!item || !serve) return;
      const t = Date.now();
      store.addMove({ t: t, i: item.id, k: 'sale', s: serve.id, n: 1, p: serve.price, q: -serve.portion, src: 'bar' }, L.isoDate(new Date()));
      ui.bar.last = { t: t, label: (serve.id === 'piece' ? '' : serve.label + ' ') + item.name, price: serve.price };
    },
    'undo-sale': function () {
      const last = ui.bar.last;
      if (!last) return;
      const gone = store.undoMove(function (e) { return e.k === 'sale' && e.t === last.t; });
      ui.bar.last = null;
      if (gone) toast('Sale removed: ' + last.label);
      else toast('That sale was made on another device or day and can’t be undone here.', 'bad');
      render();
    },
    'import-sales': function () {
      openSheet({ type: 'importSales', date: L.isoDate(new Date()), choice: {}, deduct: !!store.settings.salesDeduct });
    },
    'pos-read': async function () {
      const s = ui.sheet;
      try {
        const rows = L.parseCSV(await sourceText('pos'));
        if (rows.length < 2) { s.error = 'No rows found. The report needs a header row and at least one article.'; renderSheet(); return; }
        s.rows = rows;
        s.mapping = L.mapSalesHeaders(rows[0]);
        s.error = null;
      } catch (e) {
        s.error = 'The file could not be read. Save it as CSV or Excel and try again.';
      }
      renderSheet();
    },
    'pos-back': function () { const s = ui.sheet; s.rows = null; s.choice = {}; renderSheet(); },
    'pos-ignore-rest': function () {
      const s = ui.sheet;
      L.rowsToSales(s.rows, s.mapping).forEach(function (r) { if (!s.choice[r.key]) s.choice[r.key] = 'ignore'; });
      renderSheet();
    },
    'pos-run': function () {
      const s = ui.sheet;
      const sales = L.rowsToSales(s.rows, s.mapping);
      const posMap = Object.assign({}, store.settings.posMap || {});
      const t = Date.now();
      const entries = [];
      let n = 0;
      sales.forEach(function (r) {
        const c = s.choice[r.key];
        if (c === 'ignore') { posMap[r.key] = { ignore: true }; return; }
        if (!c) return;
        const parts = c.split('|');
        const item = store.get('items', parts[0]);
        const serve = L.serveOf(item, parts[1]);
        if (!item || !serve) return;
        posMap[r.key] = { itemId: item.id, serveId: serve.id };
        entries.push({ t: t, i: item.id, k: 'sale', s: serve.id, n: r.qty, p: r.hasRevenue && r.qty ? L.round(r.revenue / r.qty, 2) : serve.price, q: s.deduct ? -L.round(serve.portion * r.qty, 4) : 0, src: 'pos', name: r.name });
        n += r.qty;
      });
      // A fixed id per report: importing the same report again replaces it.
      const id = s.date + '~pos-' + L.hash(s.date + '|' + sales.map(function (r) { return r.key + ':' + r.qty; }).join(','));
      store.put('moves', { id: id, date: s.date, tab: 'pos', source: 'Hype', entries: entries });
      store.saveSettings({ posMap: posMap, salesDeduct: !!s.deduct });
      closeSheet();
      ui.bar.tab = 'sales';
      ui.bar.range = s.date === L.isoDate(new Date()) ? 'today' : s.date === L.isoDate(L.addDays(new Date(), -1)) ? 'yesterday' : 'week';
      toast(qtyText(n) + ' wines and drinks imported from Hype' + (s.deduct ? ' and taken off stock' : ''));
      if (ui.view !== 'bar') location.hash = '#bar'; else render();
    },

    /* kitchen */
    'link-ask': function (el) {
      const d = derive();
      const a = d.asks.find(function (x) { return x.key === el.dataset.key; });
      if (a) openSheet({ type: 'linkAsk', key: a.key, name: a.name });
    },
    'ask-link': function () {
      const s = ui.sheet;
      const id = document.getElementById('link-item').value;
      if (!id) { toast('Choose the stock item first.', 'bad'); return; }
      const map = Object.assign({}, store.settings.kitchenMap || {});
      map[s.key] = id;
      store.saveSettings({ kitchenMap: map });
      closeSheet();
      toast('Linked. The kitchen’s “' + s.name + '” now goes on that item’s order.');
    },
    'ask-new-item': function () {
      const s = ui.sheet;
      const id = store.put('items', { name: s.name.charAt(0).toUpperCase() + s.name.slice(1), unit: 'pcs', onHand: 0, category: 'Kitchen' });
      const map = Object.assign({}, store.settings.kitchenMap || {});
      map[s.key] = id;
      store.saveSettings({ kitchenMap: map });
      openSheet({ type: 'item', id: id });
      toast('Added. Set its supplier and par level.');
    },
    'import-kitchen': function () { openSheet({ type: 'importKitchen', sel: {} }); },
    'kp-menu': function () {
      const s = ui.sheet;
      (s.list || []).forEach(function (p, idx) { if (p.onMenu) s.sel[idx] = true; });
      renderSheet();
    },
    'kp-none': function () { ui.sheet.sel = {}; renderSheet(); },
    'kp-run': function () {
      const s = ui.sheet;
      const sup = document.getElementById('kp-sup').value;
      const loc = document.getElementById('kp-loc').value.trim();
      let n = 0;
      (s.list || []).forEach(function (p, idx) {
        if (!s.sel[idx]) return;
        store.put('items', { name: p.name, unit: L.stockUnitFor(p.units), category: 'Kitchen', location: loc, supplierId: sup, onHand: 0, stations: p.stations, source: 'kitchen-book' });
        n++;
      });
      closeSheet();
      toast(plural(n, 'item') + ' added. Count them and set par levels to get order suggestions.');
    },

    'import-items': function () { openSheet({ type: 'importItems', update: true, addNew: true }); },
    'imp-read': async function () {
      const s = ui.sheet;
      try {
        const text = await sourceText('imp');
        const rows = L.parseCSV(text);
        if (rows.length < 2) { s.error = 'No rows found. The file needs a header row and at least one item.'; renderSheet(); return; }
        s.rows = rows;
        const remembered = (store.settings.importMaps || {})[headerKey(rows[0])];
        s.mapping = remembered ? Object.assign({}, remembered) : L.mapHeaders(rows[0]);
        s.remembered = !!remembered;
        s.error = null;
      } catch (e) {
        s.error = 'The file could not be read. Save it as CSV or Excel and try again.';
      }
      renderSheet();
    },
    'imp-back': function () { const s = ui.sheet; s.rows = null; s.mapping = null; renderSheet(); },
    'imp-run': function () {
      const s = ui.sheet;
      const list = L.rowsToItems(s.rows, s.mapping);
      const maps = Object.assign({}, store.settings.importMaps || {});
      maps[headerKey(s.rows[0])] = s.mapping;
      store.saveSettings({ importMaps: maps });
      const byName = {};
      store.list('items').forEach(function (i) { byName[String(i.name).toLowerCase()] = i; });
      const supByName = {};
      store.list('suppliers').forEach(function (x) { supByName[String(x.name).toLowerCase()] = x.id; });
      let created = 0, updated = 0, newSup = 0;
      list.forEach(function (p) {
        let supplierId;
        if (p.supplier) {
          const key = p.supplier.toLowerCase();
          if (!supByName[key]) { supByName[key] = store.put('suppliers', { name: p.supplier, orderDays: [], leadDays: 1 }); newSup++; }
          supplierId = supByName[key];
        }
        delete p.supplier;
        if (supplierId) p.supplierId = supplierId;
        if (p.onHand !== undefined) { p.baseAt = Date.now(); p.countedAt = p.baseAt; }
        const existing = byName[p.name.toLowerCase()];
        if (existing) {
          if (!s.update) return;
          store.patch('items', existing.id, p);
          updated++;
        } else {
          if (!s.addNew) return;
          if (!p.unit) p.unit = 'pcs';
          if (p.onHand === undefined) p.onHand = 0;
          byName[p.name.toLowerCase()] = { id: store.put('items', p) };
          created++;
        }
      });
      closeSheet();
      toast(plural(created, 'item') + ' added, ' + updated + ' updated' + (newSup ? ', ' + plural(newSup, 'supplier') + ' created' : ''));
    },
    'import-bookings': function () { openSheet({ type: 'importBookings', replace: true }); },
    'impb-read': async function () {
      const s = ui.sheet;
      try {
        const list = L.rowsToReservations(L.parseCSV(await sourceText('impb')));
        if (!list.length) { s.error = 'No bookings found. The file needs a header row with at least a date and a number of guests.'; renderSheet(); return; }
        s.list = list;
        s.error = null;
      } catch (e) {
        s.error = 'The file could not be read. Save it as CSV and try again.';
      }
      renderSheet();
    },
    'impb-back': function () { ui.sheet.list = null; renderSheet(); },
    'impb-run': function () {
      const s = ui.sheet;
      if (s.replace) {
        const dates = {};
        s.list.forEach(function (r) { dates[r.date] = true; });
        store.list('reservations').filter(function (r) { return r.source === 'import' && dates[r.date]; }).forEach(function (r) { store.remove('reservations', r.id); });
      }
      addRecords('reservations', s.list);
      closeSheet();
      toast(plural(s.list.length, 'booking') + ' imported');
    },
    'import-backup': function () { openSheet({ type: 'importBackup' }); },
    'bk-run': function () {
      const s = ui.sheet;
      let n = 0;
      COLS.forEach(function (col) {
        (s.data.data[col] || []).forEach(function (x) { store.put(col, x); n++; });
      });
      if (s.data.settings) store.saveSettings(s.data.settings);
      closeSheet();
      toast('Restored ' + plural(n, 'record'));
    },

    'export-items': async function () {
      const d = derive();
      const csv = L.itemsToCSV(d.items, d.suppliers);
      try {
        const ok = await net.saveFile('komat-stock-' + d.todayIso + '.csv', csv, 'text/csv');
        if (ok) toast('Stock list saved');
      } catch (e) {
        copyText(csv, 'Stock CSV');
      }
    },
    'export-backup': async function () {
      const data = {};
      COLS.forEach(function (c) { data[c] = store.list(c); });
      const text = JSON.stringify({ app: 'komat-backoffice', version: 1, exportedAt: new Date().toISOString(), settings: store.settings, data: data }, null, 2);
      try {
        const ok = await net.saveFile('komat-backup-' + L.isoDate(new Date()) + '.json', text, 'application/json');
        if (ok) toast('Backup saved');
      } catch (e) {
        copyText(text, 'Backup');
      }
    },
    'load-examples': function () {
      const sample = window.KomatSample.build(new Date(), L);
      addRecords('suppliers', sample.suppliers);
      addRecords('items', sample.items);
      addRecords('reservations', sample.reservations);
      addRecords('orders', sample.orders);
      addRecords('moves', sample.moves);
      // Never replace real Kitchen Book data with the example versions.
      addRecords('kitchen', sample.kitchen.filter(function (k) { const cur = store.get('kitchen', k.id); return !cur || cur.example; }));
      if (!L.num(store.settings.normalCoversWeek, 0)) store.saveSettings({ normalCoversWeek: 150 });
      toast('Example kitchen loaded');
      if (ui.view === 'setup') location.hash = '#today';
    },
    'remove-examples': function () {
      let n = 0;
      COLS.forEach(function (col) {
        store.list(col).filter(function (x) { return x.example; }).forEach(function (x) { store.remove(col, x.id); n++; });
      });
      toast(plural(n, 'example record') + ' removed');
    },
    'confirm-erase': function () { ui.confirm = 'erase'; render(); },
    'confirm-cancel': function () { ui.confirm = null; render(); },
    'erase-all': function () {
      COLS.forEach(function (col) {
        store.list(col).forEach(function (x) { store.remove(col, x.id); });
      });
      ui.confirm = null;
      toast('Everything erased');
      location.hash = '#today';
    },

    'gmail-connect': function () { connectGmail(); },
    'gmail-off': function () {
      ui.gmailOn = false;
      setPref('gmailOn', false);
      syncWatches();
      render();
    },
    'gmail-refresh': function () {
      if (net.mcp && net.mcp.invalidate) net.mcp.invalidate('Gmail', 'search_threads').catch(function () {});
      toast('Refreshing…');
    }
  };

  /* ---------- forms ---------- */

  function formObject(form) {
    const fd = new FormData(form);
    const o = {};
    fd.forEach(function (v, k) {
      if (o[k] === undefined) o[k] = v;
      else o[k] = [].concat(o[k], v);
    });
    return o;
  }

  function numOrUndef(v) { const n = L.parseNum(v); return Number.isFinite(n) ? n : undefined; }

  const FORMS = {
    item: function (o, s) {
      const current = s.id ? store.get('items', s.id) || {} : {};
      const live = s.id ? effItem(s.id) || {} : {};
      const kind = o.kind === 'wine' || o.kind === 'drink' ? o.kind : undefined;
      const wine = kind === 'wine';
      const text = function (v) { return String(v || '').trim() || undefined; };
      const typed = numOrUndef(o.onHand);
      const item = Object.assign({}, current, {
        id: s.id,
        name: String(o.name || '').trim(),
        location: String(o.location || '').trim(),
        category: String(o.category || '').trim() || (wine ? 'Wine' : kind === 'drink' ? 'Soft drinks' : ''),
        unit: wine ? 'bottle' : String(o.unit || '').trim() || (kind === 'drink' ? 'bottle' : 'pcs'),
        kind: kind,
        producer: wine ? text(o.producer) : undefined,
        vintage: wine ? text(o.vintage) : undefined,
        region: wine ? text(o.region) : undefined,
        grape: wine ? text(o.grape) : undefined,
        colour: wine ? text(o.colour) : undefined,
        bottleCl: wine ? numOrUndef(o.bottleCl) || 75 : undefined,
        glassCl: wine ? numOrUndef(o.glassCl) : undefined,
        glassPrice: wine ? numOrUndef(o.glassPrice) : undefined,
        par: numOrUndef(o.par),
        reorderAt: numOrUndef(o.reorderAt),
        packSize: numOrUndef(o.packSize),
        packLabel: String(o.packLabel || '').trim(),
        supplierId: o.supplierId || '',
        cost: numOrUndef(o.cost),
        price: numOrUndef(o.price),
        sku: String(o.sku || '').trim(),
        notes: String(o.notes || '').trim()
      });
      if (!item.name) return 'Give the item a name.';
      delete item.rawOnHand;
      // A stock figure typed here is a count: it replaces the live figure from now on.
      if (!s.id || (typed !== undefined && L.round(typed, 3) !== L.round(L.num(live.onHand, 0), 3))) {
        item.onHand = typed === undefined ? 0 : Math.max(0, typed);
        if (typed !== undefined) { item.baseAt = Date.now(); item.countedAt = item.baseAt; }
      }
      store.put('items', item);
      toast(s.id ? 'Item saved' : item.name + ' added');
    },
    supplier: function (o, s) {
      const current = s.id ? store.get('suppliers', s.id) || {} : {};
      const sup = Object.assign({}, current, {
        id: s.id,
        name: String(o.name || '').trim(),
        email: String(o.email || '').trim(),
        contact: String(o.contact || '').trim(),
        phone: String(o.phone || '').trim(),
        customerNo: String(o.customerNo || '').trim(),
        orderDays: [].concat(o.orderDays || []).map(Number),
        cutoff: o.cutoff || '',
        leadDays: Math.max(0, Math.round(numOrUndef(o.leadDays) || 0)),
        minOrder: numOrUndef(o.minOrder),
        notes: String(o.notes || '').trim()
      });
      if (!sup.name) return 'Give the supplier a name.';
      if (sup.email && !net.emails(sup.email).length) return 'That email address does not look right.';
      store.put('suppliers', sup);
      toast(s.id ? 'Supplier saved' : sup.name + ' added');
    },
    booking: function (o, s) {
      const current = s.id ? store.get('reservations', s.id) || {} : {};
      const r = Object.assign({}, current, {
        id: s.id,
        date: o.date,
        time: o.time || '',
        name: String(o.name || '').trim(),
        covers: Math.max(0, Math.round(numOrUndef(o.covers) || 0)),
        phone: String(o.phone || '').trim(),
        note: String(o.note || '').trim(),
        status: o.cancelled ? 'cancelled' : 'booked',
        source: current.source || 'manual'
      });
      if (!L.fromIso(r.date)) return 'Pick a date.';
      if (!r.covers) return 'How many guests?';
      store.put('reservations', r);
      ui.bookings.day = r.date;
      toast('Booking saved');
    },
    settings: function (o) {
      const cap = numOrUndef(o.boostCap);
      store.saveSettings({
        restaurant: String(o.restaurant || '').trim() || 'Komat',
        sender: String(o.sender || '').trim(),
        address: String(o.address || '').trim(),
        signature: String(o.signature || '').trim(),
        emailIntro: String(o.emailIntro || '').trim() || 'please send us the following',
        copyTo: String(o.copyTo || '').trim(),
        currency: (String(o.currency || 'EUR').trim().toUpperCase() || 'EUR').slice(0, 3),
        normalCoversWeek: Math.max(0, Math.round(numOrUndef(o.normalCoversWeek) || 0)),
        boostCap: cap && cap >= 1 ? Math.min(3, cap) : 1.5,
        boost: !!o.boost,
        vat: Math.max(0, numOrUndef(o.vat) || 0),
        inboxQuery: String(o.inboxQuery || '').trim(),
        invoiceQuery: String(o.invoiceQuery || '').trim(),
        cashSheet: String(o.cashSheet || '').trim(),
        cashCurrency: String(o.cashCurrency || '').trim().toUpperCase().slice(0, 3),
        bookingsQuery: String(o.bookingsQuery || '').trim()
      });
      toast('Setup saved');
      return false;
    }
  };

  /* ---------- events ---------- */

  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const fn = ACTIONS[act];
    if (!fn) return;
    if (store.readOnly && WRITE_ACTS[act]) {
      e.preventDefault();
      toast('This page is view only for you.', 'bad');
      return;
    }
    if (el.tagName === 'BUTTON') e.preventDefault();
    fn(el, e);
  });

  let searchTimer = null;
  document.addEventListener('input', function (e) {
    const t = e.target;
    if (t.dataset.bind === 'stock-q') {
      ui.stock.q = t.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(render, 120);
    } else if (t.dataset.bind === 'bar-q') {
      ui.bar.q = t.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(render, 120);
    } else if (t.dataset.count) {
      ui.stock.draft[t.dataset.count] = t.value;
      t.classList.toggle('changed', t.value !== '');
      const bar = document.querySelector('.countbar');
      if (bar) {
        const n = Object.keys(ui.stock.draft).filter(function (k) { return ui.stock.draft[k] !== ''; }).length;
        bar.querySelector('.num').textContent = n;
        bar.querySelector('[data-act="count-save"]').disabled = !n;
      }
    } else if (t.dataset.line !== undefined && ui.sheet && ui.sheet.type === 'order') {
      const v = L.parseNum(t.value);
      ui.sheet.draft.lines[Number(t.dataset.line)].qty = Number.isFinite(v) ? Math.max(0, v) : 0;
      refreshTicket();
    } else if (t.dataset.recv !== undefined && ui.sheet) {
      ui.sheet.recv[Number(t.dataset.recv)] = t.value;
    } else if (t.dataset.bind === 'order-note' && ui.sheet) {
      ui.sheet.draft.note = t.value;
      refreshTicket();
    }
  });

  document.addEventListener('change', async function (e) {
    const t = e.target;
    const s = ui.sheet;
    if (t.dataset.bind === 'stock-loc') { ui.stock.location = t.value; render(); return; }
    if (!s) return;
    if (s.type === 'item' && t.dataset.bind === 'item-kind') {
      document.getElementById('wine-fields').hidden = t.value !== 'wine';
      const unit = document.getElementById('f-unit');
      if (t.value === 'wine' || (t.value === 'drink' && /^(pcs|)$/.test(unit.value))) unit.value = 'bottle';
      return;
    }
    if (s.type === 'importSales') {
      if (t.dataset.bind === 'pos-date') s.date = t.value || s.date;
      else if (t.dataset.file === 'pos') ACTIONS['pos-read']();
      else if (t.dataset.smap) {
        if (t.value === '') delete s.mapping[t.dataset.smap]; else s.mapping[t.dataset.smap] = Number(t.value);
        s.choice = {};
        renderSheet();
      } else if (t.dataset.pos !== undefined) {
        s.choice[t.dataset.pos] = t.value;
        t.closest('tr').classList.toggle('unmatched', !t.value);
        renderSheetFoot();
      } else if (t.dataset.bind === 'pos-deduct') s.deduct = t.checked;
      return;
    }
    if (s.type === 'importKitchen') {
      if (t.dataset.kp !== undefined) { s.sel[Number(t.dataset.kp)] = t.checked; renderSheetFoot(); }
      else if (t.id === 'kp-sup') s.sup = t.value;
      else if (t.id === 'kp-loc') s.loc = t.value;
      return;
    }
    if (s.type === 'order') {
      if (t.dataset.line !== undefined || t.dataset.bind === 'order-note') { saveOrderDraft(); return; }
      if (t.dataset.bind === 'order-date') { s.draft.deliveryDate = t.value; saveOrderDraft(); refreshTicket(); return; }
      if (t.dataset.bind === 'line-add' && t.value) {
        const item = store.get('items', t.value);
        if (item) {
          s.draft.lines = (s.draft.lines || []).concat([L.lineFor(item, 1)]);
          saveOrderDraft();
          renderSheet();
          const idx = s.draft.lines.length - 1;
          const input = document.getElementById('ol-' + idx);
          if (input) { input.focus(); input.select(); }
        }
        return;
      }
    }
    if (s.type === 'importItems') {
      if (t.dataset.map) {
        if (t.value === '') delete s.mapping[t.dataset.map];
        else s.mapping[t.dataset.map] = Number(t.value);
        renderSheet();
      } else if (t.dataset.bind === 'imp-update') { s.update = t.checked; }
      else if (t.dataset.bind === 'imp-addnew') { s.addNew = t.checked; }
      else if (t.dataset.file === 'imp') { ACTIONS['imp-read'](); }
      return;
    }
    if (s.type === 'importBookings') {
      if (t.dataset.bind === 'impb-replace') s.replace = t.checked;
      else if (t.dataset.file === 'impb') ACTIONS['impb-read']();
      return;
    }
    if (s.type === 'importBackup' && t.dataset.file === 'bk') {
      try {
        const parsed = JSON.parse(await readFileText(t));
        if (!parsed || parsed.app !== 'komat-backoffice' || !parsed.data) throw new Error('not a backup');
        const counts = ['items', 'suppliers', 'orders', 'reservations'].map(function (c) { return plural((parsed.data[c] || []).length, c.replace(/s$/, '').replace('reservation', 'booking')); });
        s.data = parsed;
        s.summary = 'Backup from ' + String(parsed.exportedAt || '').slice(0, 10) + ': ' + counts.join(', ') + '.';
        s.error = null;
      } catch (err) {
        s.data = null;
        s.summary = null;
        s.error = 'That file is not a Komat Back Office backup.';
      }
      renderSheet();
    }
  });

  document.addEventListener('submit', function (e) {
    const form = e.target;
    const kind = form.dataset.form;
    if (!kind || !FORMS[kind]) return;
    e.preventDefault();
    if (store.readOnly) { toast('This page is view only for you.', 'bad'); return; }
    const result = FORMS[kind](formObject(form), ui.sheet || {});
    if (typeof result === 'string') { toast(result, 'bad'); return; }
    if (result !== false) closeSheet();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && ui.sheet) { e.preventDefault(); closeSheet(); }
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.count) {
      // Enter moves to the next count box, like a spreadsheet.
      e.preventDefault();
      const boxes = Array.from(document.querySelectorAll('[data-count]'));
      const next = boxes[boxes.indexOf(e.target) + 1];
      if (next) { next.focus(); next.select(); }
    }
  });

  /* ---------- render ---------- */

  function withFocus(container, fn) {
    const a = document.activeElement;
    const id = a && a.id && container.contains(a) ? a.id : null;
    let sel = null;
    try { sel = id && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null; } catch (e) { sel = null; }
    fn();
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.focus({ preventScroll: true });
    if (sel) { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not a text field */ } }
  }

  function renderChrome(d) {
    const counts = { orders: d.toOrderIds.length, stock: d.out.length, bar: d.sellable.filter(function (i) { return d.status[i.id] === 'out'; }).length };
    const navView = OFFICE.indexOf(ui.view) > -1 ? 'office' : ui.view;
    document.querySelectorAll('[data-nav]').forEach(function (a) {
      const v = a.dataset.nav;
      if (v === navView) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
      const c = a.querySelector('.count');
      if (c) {
        const n = counts[v] || 0;
        c.textContent = n;
        c.hidden = !n;
      }
    });
    const badge = document.getElementById('mode-badge');
    if (badge) {
      badge.className = 'mode-badge' + (store.mode === 'shared' ? ' live' : '');
      badge.innerHTML = '<span class="dot"></span>' + (store.mode === 'shared' ? (store.readOnly ? 'View only' : 'Live') : store.mode === 'local' ? 'This device' : '…');
      badge.title = store.mode === 'shared' ? 'Shared with your team and updated live' : 'Saved in this browser only';
    }
    const name = store.settings.restaurant || 'Komat';
    document.getElementById('brand-word').textContent = name.toUpperCase();
  }

  // Once per visit: fold month-old stock movements into the counted figures (see L.consolidation).
  let consolidated = false;
  function consolidate() {
    if (store.readOnly) return;
    L.consolidation(store.list('items'), store.list('moves'), new Date()).forEach(function (f) {
      store.patch('items', f.id, { onHand: f.onHand, baseAt: f.baseAt });
    });
  }

  function render() {
    renderPending = false;
    if (!store.ready) {
      viewEl.innerHTML = '<div class="loading"><div class="spinner"></div><span>Opening the back office…</span></div>';
      return;
    }
    if (!consolidated) { consolidated = true; setTimeout(consolidate, 1500); }
    const d = derive();
    renderChrome(d);
    const html = {
      today: viewToday, stock: viewStock, orders: viewOrders, bar: viewBar, bookings: viewBookings, cash: viewCash, invoices: viewInvoices, inbox: viewInbox, setup: viewSetup
    }[ui.view](d);
    // Setup is a form: don't wipe what someone is typing when another person's change arrives.
    const a = document.activeElement;
    if (ui.view === 'setup' && viewEl.dataset.view === 'setup' && a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && viewEl.contains(a)) return;
    withFocus(viewEl, function () { viewEl.innerHTML = html; });
    viewEl.dataset.view = ui.view;
    syncWatches();
  }

  // A redraw between press and release would swallow the tap (e.g. a fast second "+"),
  // so redraws wait while a pointer is down.
  let renderPending = false, pointerDown = false, renderDeferred = false;
  function scheduleRender() {
    if (pointerDown) { renderDeferred = true; return; }
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(render);
  }
  document.addEventListener('pointerdown', function () { pointerDown = true; }, true);
  ['pointerup', 'pointercancel'].forEach(function (type) {
    document.addEventListener(type, function () {
      pointerDown = false;
      if (renderDeferred) { renderDeferred = false; scheduleRender(); }
    }, true);
  });

  function route() {
    const v = location.hash.replace('#', '');
    const next = VIEWS.indexOf(v) > -1 ? v : 'today';
    if (next !== ui.view) {
      if (ui.sheet) closeSheet();
      ui.view = next;
      ui.confirm = null;
      if (next !== 'stock') { ui.stock.counting = false; ui.stock.draft = {}; }
      window.scrollTo(0, 0);
    }
    render();
  }

  store.onChange(scheduleRender);
  store.onError(function (message) { toast(message, 'bad'); });
  window.addEventListener('hashchange', route);

  route();
  Promise.all([store.start(), net.start()]).then(function () {
    if (!net.gmail()) ui.gmailOn = false;
    render();
  });
})();
