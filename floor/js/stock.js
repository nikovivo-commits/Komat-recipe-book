/* Stock: what is out, what is low, what is in. A drink paired with Hype (the till) starts from Hype's number; a
   count replaces it, and from then on what Hype sells is taken off the count. The Stock tab is for everyone on
   the floor; counting, ordering and the link with Hype sit on the Manage page, for the owner and floor managers. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const WHY = { open: 'opened for glasses', ok: 'tasted: still good', gone: 'open bottle finished', bin: 'open bottle thrown away', sold: 'sold', glass: 'opened for glasses', in: 'delivered', broken: 'broken or corked', comp: 'on the house', out: 'taken out' };
  const title = (w) => (w.stockOnly ? w.name : K.wineTitle(w));
  const when = (t) => { const d = K.ymd(new Date(t)); return (d === K.day(0) ? 'today' : d === K.day(-1) ? 'yesterday' : K.prettyDate(d, { day: 'numeric', month: 'short' })) + ' ' + K.hm(t); };
  const age = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 60 ? m + ' min ago' : m < 48 * 60 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  /* read the Hype sheet again, from anywhere there is a button for it */
  const readHype = () => {
    ui.hypeBusy = true; K.render();
    K.refreshHype().then((d) => { ui.hypeBusy = false; K.render(); K.toast('Stock refreshed: ' + d.rows.length + ' products'); },
      (e) => { ui.hypeBusy = false; K.render(); K.toast(e && e.message === 'nolink' ? 'The Hype sheet is not connected yet.' : 'The sheet could not be read. Check the connection.', { tone: 'bad' }); });
  };
  const sub = (label, onBack) => K.subbar(label, onBack, null, '');

  /* ---------- the Stock tab ---------- */
  K.V.stock = function () {
    const body = h('div', { class: 'page' }), w = h('div', { class: 'wrap st' });
    body.append(w);
    w.append(h('div', { class: 'st-top' }, h('h1', { class: 'ptitle' }, 'Stock'),
      K.canEdit() ? h('button', { type: 'button', class: 'btn st-manage', onclick: () => K.go('manage') }, K.icon('sliders'), 'Manage') : null));
    if (!D.winesLoaded) { w.append(K.loadingBox('Loading the stock')); return { body: body, solid: true }; }
    const all = K.takeList();
    if (!all.length) {
      w.append(h('div', { class: 'empty' }, h('strong', null, 'No drinks to keep stock of yet'), 'Add the wines and drinks in the Drinks tab; their bottles show here.',
        h('div', { class: 'btns center' }, h('button', { class: 'btn primary', type: 'button', onclick: () => K.go('wine') }, 'Go to the drinks'))));
      return { body: body, solid: true };
    }
    w.append(hypeLine(), takeBar());
    const by = { out: [], low: [], none: [], ok: [] };
    all.forEach((x) => by[K.stockState(x)].push(x));
    const tile = (st, label) => h('button', { type: 'button', class: 'st-tile t-' + st, 'aria-pressed': ui.stockF === st ? 'true' : 'false', onclick: () => { ui.stockF = ui.stockF === st ? '' : st; K.render(); } },
      h('b', null, String(by[st].length)), h('span', null, label));
    w.append(h('div', { class: 'st-tiles', role: 'group', 'aria-label': 'Show' }, tile('out', 'Out'), tile('low', 'Running low'), tile('ok', 'In stock')));
    w.append(K.searchBox('sq', ui.sq, 'Search in English or Bulgarian', (v) => { ui.sq = v; K.render(); }));
    const open = K.openBottles(), due = open.filter((o) => o.due).length;
    if (open.length || K.canWrite()) w.append(h('button', { type: 'button', class: 'st-open' + (due ? ' due' : ''), onclick: () => K.go('open') }, K.icon('clock'),
      h('span', { class: 'to-txt' }, h('b', null, open.length ? open.length + (open.length === 1 ? ' bottle open' : ' bottles open') : 'No bottle is open'),
        h('span', { class: due ? 'st-due' : 'muted' }, due ? due + ' to taste today' : open.length ? 'All fine' : 'Tap here when you open one for glasses')), K.icon('next')));
    const shown = (x) => K.matches([title(x), x.hype, x.grapes, x.style, K.COL[x.colour]].join(' '), ui.sq) && (!ui.stockF || K.stockState(x) === ui.stockF);
    const head = { out: 'Out', low: 'Running low', none: 'Not counted yet', ok: 'In stock' };
    let any = false;
    ['out', 'low', 'none', 'ok'].forEach((st) => {
      const rows = by[st].filter(shown);
      if (!rows.length) return;
      any = true;
      w.append(h('section', { class: 'group st-group g-' + st }, h('h2', { class: 'group-title' }, head[st], h('span', { class: 'n' }, String(rows.length))),
        h('div', { class: 'st-list' }, rows.map(row))));
    });
    if (!any) w.append(h('div', { class: 'empty' }, h('strong', null, ui.sq ? 'No drink like that' : 'Nothing here'), ui.sq ? 'Try the other language.' : 'Tap the number again to see everything.'));
    return { body: body, solid: true };
  };
  function row(x) {
    const n = K.stockOf(x.id), st = K.stockState(x);
    const says = st === 'none' && K.canEdit() ? K.hypeSays(x) : null;
    const right = st === 'none' ? h('span', { class: 'st-n none', 'aria-label': 'not counted' }, '–', says != null ? h('small', null, 'Hype ' + K.qtyText(says)) : null)
      : n < 0 ? h('span', { class: 'st-n neg' }, K.qtyText(n), h('small', null, 'below zero'))
        : st === 'out' ? h('span', { class: 'to-tag out' }, 'Out')
          : h('span', { class: 'st-n ' + st }, String(n), st === 'low' ? h('small', null, 'keep ' + x.par) : null);
    return h('button', { type: 'button', class: 'st-row', onclick: () => K.go('winepage', { id: x.id }) }, K.wineLabel(x, 'mini'),
      h('span', { class: 'to-txt' }, h('b', null, title(x)), h('span', { class: 'muted' }, x.stockOnly ? x.style || K.COL[x.colour] : x.hype || K.COL[x.colour])), right);
  }
  /* when Hype was read: one quiet line, loud only when it is old */
  function hypeLine() {
    const hs = D.hypeStock;
    if (!hs) return h('span');
    const t = hs.exported || hs.modified || hs.at, old = K.hypeOld();
    return h('div', { class: 'st-hype' + (old ? ' old' : '') }, h('span', { class: 'st-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'st-hype-txt' }, old ? [h('b', null, 'Hype was read ' + age(t) + '. '), 'More than 12 hours: the numbers may be wrong.'] : 'From Hype ' + when(t) + ' · ' + age(t)),
      D.hypeUrl ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Read Hype again', disabled: ui.hypeBusy ? true : null, onclick: readHype }, K.icon('refresh')) : null);
  }
  /* a physical count is running: how far it is, and the way back into it */
  function takeBar() {
    const take = K.takeOn();
    if (!take) return h('span');
    const all = K.takeList(), done = all.filter((x) => K.countedIn(x, take)).length;
    return h('button', { type: 'button', class: 'to-card to-link', onclick: () => K.go('count') }, K.icon('clipboard'),
      h('span', { class: 'to-txt' }, h('b', null, 'A count is running: ' + done + ' of ' + all.length), h('span', { class: 'muted' }, 'Tap to keep counting.')), K.icon('next'));
  }

  /* ---------- open bottles: opened for glasses, tasted again after three days ---------- */
  K.V.open = function () {
    const body = h('div', { class: 'wrap page op' }), list = K.openBottles().slice().sort((a, b) => (b.due ? 1 : 0) - (a.due ? 1 : 0) || a.at - b.at);
    body.append(h('h1', { class: 'ptitle' }, 'Open bottles'), h('p', { class: 'psub' }, 'A wine open for glasses is tasted again after ' + K.OPEN_DAYS + ' days.'));
    if (K.canWrite()) body.append(h('button', { type: 'button', class: 'btn primary wide op-add', onclick: () => { ui.sheet = { type: 'openadd' }; K.render(); } }, K.icon('plus'), 'I opened a bottle'));
    if (!list.length) body.append(h('div', { class: 'empty' }, h('strong', null, 'No bottle is open'), 'When you open a wine for glasses, add it here. After ' + K.OPEN_DAYS + ' days it asks to be tasted.'));
    body.append(h('div', { class: 'op-list' }, list.map((o) => {
      const dayNo = o.days + 1, past = o.days >= K.OPEN_DAYS;
      const txt = past ? 'Open ' + o.days + ' days · ' + (o.due ? 'taste it today' : 'tasted, still good')
        : (o.days === 0 ? 'Opened today' : o.days === 1 ? 'Opened yesterday' : 'Opened ' + o.days + ' days ago') + ' · day ' + dayNo + ' of ' + K.OPEN_DAYS;
      const bar = [];
      for (let i = 1; i <= K.OPEN_DAYS; i++) bar.push(h('span', { class: i <= dayNo ? 'on' : '' }));
      bar.push(h('span', { class: past ? 'over' : 'none' }));
      return h('section', { class: 'op-card' + (o.due ? ' due' : '') },
        h('button', { type: 'button', class: 'op-head', onclick: () => K.go('winepage', { id: o.w.id }) }, K.wineLabel(o.w, 'mini'),
          h('span', { class: 'to-txt' }, h('b', null, title(o.w)), h('span', { class: o.due ? 'st-due' : 'muted' }, txt + (o.who ? ' · ' + o.who : '')))),
        h('div', { class: 'op-bar', role: 'img', 'aria-label': 'Day ' + dayNo + ', tasted again after ' + K.OPEN_DAYS }, bar),
        K.canWrite() && o.due ? h('button', { type: 'button', class: 'btn wide op-good', onclick: () => { K.openNote(o.w, 'ok', o.id); K.toast(o.w.name + ': still good. It asks again tomorrow.'); } }, K.icon('check'), 'Tasted it: still good') : null,
        K.canWrite() ? h('div', { class: 'op-two' },
          h('button', { type: 'button', class: 'btn', onclick: () => { K.openNote(o.w, 'gone', o.id); K.toast(o.w.name + ': finished'); } }, 'Finished'),
          h('button', { type: 'button', class: 'btn' + (o.due ? ' op-bin' : ''), onclick: () => { ui.sheet = { type: 'openbin', id: o.id, w: o.w.id }; K.render(); } }, K.icon('trash'), 'Throw away')) : null);
    })));
    return { top: sub('Stock', () => K.back('stock')), body: body, tabs: false };
  };
  /* which wine was just opened: the ones poured by the glass first */
  K.SHEETS.openadd = function (S) {
    const all = K.winesSorted().filter((w) => !w.off && !K.isDrink(w) && K.matches(K.wineTitle(w) + ' ' + w.grapes, S.q || ''));
    all.sort((a, b) => (b.byGlass ? 1 : 0) - (a.byGlass ? 1 : 0));
    const pick = (w) => { K.openNote(w, 'open'); ui.sheet = null; K.render(); K.toast(w.name + ' opened. It asks to be tasted in ' + K.OPEN_DAYS + ' days.'); };
    return K.sheet('Which bottle did you open?', h('div', { class: 'stack' },
      K.searchBox('oq', S.q || '', 'Search a wine', (v) => { S.q = v; K.render(); }),
      h('div', { class: 'hy-list' }, all.slice(0, 40).map((w) => h('button', { type: 'button', class: 'hy-row', onclick: () => pick(w) },
        h('span', null, h('b', null, K.wineTitle(w)), h('span', { class: 'muted' }, K.COL[w.colour] + (w.byGlass ? ' · by the glass' : ''))), K.icon('next'))))), { wide: true });
  };
  /* the rest of an open bottle is no good: how much goes down the sink comes off the stock */
  K.SHEETS.openbin = function (S) {
    const w = K.wine(S.w);
    if (!w) return null;
    const bin = (frac, label) => { K.openNote(w, 'bin', S.id, -frac); ui.sheet = null; K.render(); K.toast(w.name + ': thrown away' + (frac ? ', ' + label + ' off the stock' : '')); };
    return K.sheet('Throw away · ' + w.name, h('div', { class: 'stack' },
      h('p', null, 'How much was left in the bottle?'),
      h('div', { class: 'bin-grid' },
        [[0.25, 'A quarter'], [0.5, 'Half'], [0.75, 'Three quarters'], [1, 'Almost full']].map((x) => h('button', { type: 'button', class: 'btn bin-btn', onclick: () => bin(x[0], x[1].toLowerCase()) }, h('span', { class: 'bin-glass', style: '--f:' + x[0] }), x[1]))),
      h('button', { type: 'button', class: 'btn wide', onclick: () => bin(0, '') }, 'Only a drop'),
      h('p', { class: 'hint' }, 'What was left is taken off the stock as waste, so the numbers stay right.')));
  };

  /* ---------- the manager's page: the count, the order list, what the count found, the link with Hype ---------- */
  const toOrder = () => K.takeList().filter((w) => K.stockOf(w.id) != null && (w.par || 0) > 0 && K.stockOf(w.id) <= w.par)
    .map((w) => ({ w: w, n: K.stockOf(w.id), q: Math.max(1, Math.ceil(w.par - Math.max(0, K.stockOf(w.id)))) }));
  K.V.manage = function () {
    if (!K.canEdit()) return K.V.stock();
    const body = h('div', { class: 'wrap page mg' }), take = K.takeOn(), last = D.take && D.take.done ? D.take : null, hs = D.hypeStock;
    const all = K.takeList(), done = take ? all.filter((x) => K.countedIn(x, take)).length : 0;
    body.append(h('h1', { class: 'ptitle' }, 'Manage stock'), h('p', { class: 'psub' }, 'Only the owner and floor managers see this.'));
    body.append(h('section', { class: 'mg-count' },
      h('div', { class: 'mg-count-h' }, K.icon('clipboard'), h('div', null, h('h2', null, 'Physical count'),
        h('span', null, take ? 'Running · ' + done + ' of ' + all.length + ' counted' : last ? 'Last count ended ' + when(last.done) : 'Count what is really on the shelf'))),
      take ? h('div', { class: 'mg-bar', role: 'img', 'aria-label': done + ' of ' + all.length + ' counted' }, h('span', { style: 'width:' + (all.length ? Math.round((done / all.length) * 100) : 0) + '%' })) : null,
      h('button', { type: 'button', class: 'btn light wide', onclick: () => K.go('count') }, take ? 'Keep counting' : 'Start a count')));
    const need = toOrder(), paired = all.filter((x) => K.hypeRow(x)).length;
    const item = (icon, name, note, onclick) => h('button', { type: 'button', class: 'mg-row', onclick: onclick }, K.icon(icon),
      h('span', { class: 'to-txt' }, h('b', null, name), h('span', { class: 'muted' }, note)), K.icon('next'));
    const sheet = (type, extra) => () => { ui.sheet = Object.assign({ type: type }, extra || {}); K.render(); };
    body.append(h('div', { class: 'mg-list' },
      item('truck', 'To order', need.length ? need.length + (need.length === 1 ? ' drink is' : ' drinks are') + ' under the minimum' : 'Nothing is under its minimum', () => K.go('order')),
      item('scale', 'What the count found', 'Missing bottles and extra ones', sheet('diffs')),
      item('sliders', 'Minimums and suppliers', 'How many to keep, who delivers it', sheet('memo', { f: {} })),
      hs ? item('link', 'Match with Hype', paired + ' of ' + all.length + ' drinks matched', sheet('hype', { fromSheet: true }))
        : item('link', 'Connect Hype', 'Read the stock from the Google Sheet', sheet('hypesheet')),
      hs ? item('list', 'Everything Hype has', (D.hypeRows || []).length + ' products, ' + (D.hypeRows || []).filter((r) => r.qty < 0).length + ' below zero', () => K.go('hypelist')) : null,
      item('swap', 'Bottles in and out', 'Every change, newest first', sheet('moves'))));
    if (hs) {
      const t = hs.exported || hs.modified || hs.at, old = K.hypeOld();
      body.append(h('div', { class: 'mg-hype' + (old ? ' old' : '') }, h('span', { class: 'st-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'to-txt' }, h('b', null, 'Hype read ' + when(t)), h('span', { class: 'muted' }, old ? 'More than 12 hours ago' : age(t) + ' · read at 07:00, 16:00 and 23:00')),
        D.hypeUrl ? h('button', { type: 'button', class: 'btn small', disabled: ui.hypeBusy ? true : null, onclick: readHype }, ui.hypeBusy ? 'Reading…' : 'Read again') : null,
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'The link to the Hype sheet', onclick: sheet('hypesheet') }, K.icon('gear'))));
    }
    return { top: sub('Stock', () => K.back('stock')), body: body, tabs: false };
  };

  /* what to order: every drink at or under its minimum, one list per supplier, to bundle deliveries */
  K.V.order = function () {
    if (!K.canEdit()) return K.V.stock();
    const body = h('div', { class: 'wrap page or' }), need = toOrder(), by = {};
    need.forEach((x) => { const k = x.w.supplier || ''; (by[k] = by[k] || []).push(x); });
    const keys = Object.keys(by).sort((a, b) => (a === '') - (b === '') || a.localeCompare(b));
    const uncounted = K.takeList().filter((w) => K.stockOf(w.id) == null).length;
    body.append(h('h1', { class: 'ptitle' }, 'To order'),
      h('p', { class: 'psub' }, need.length ? need.length + (need.length === 1 ? ' drink is' : ' drinks are') + ' at or under the minimum. One list per supplier.' : 'Nothing is at or under its minimum.'));
    if (K.hypeOld()) body.append(h('p', { class: 'banner' }, h('b', null, 'Hype was read more than 12 hours ago. '), 'The list may miss what sold since.'));
    if (uncounted) body.append(h('p', { class: 'hint' }, uncounted + ' drinks are not counted yet, so they cannot be on this list.'));
    const text = (k) => (k || 'Order') + '\n' + by[k].map((x) => '- ' + x.q + ' x ' + title(x.w)).join('\n');
    const copy = (k) => navigator.clipboard.writeText(text(k)).then(() => K.toast('List copied'), () => K.toast('This device would not copy.'));
    const send = (k) => (navigator.share ? navigator.share({ text: text(k) }).catch(() => {}) : copy(k));
    body.append(h('div', { class: 'or-list' }, keys.map((k) => h('section', { class: 'or-card' + (k ? '' : ' none') },
      h('div', { class: 'or-h' }, h('h2', null, k || 'No supplier yet'), h('span', { class: 'muted' }, by[k].length + (by[k].length === 1 ? ' line' : ' lines'))),
      h('ul', { class: 'or-lines' }, by[k].map((x) => h('li', null, h('b', null, x.q + ' ×'), h('span', { class: 'to-txt' }, h('span', null, title(x.w)), h('span', { class: 'muted' }, 'have ' + K.qtyText(x.n) + ' · keep ' + x.w.par))))),
      k ? h('div', { class: 'op-two' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => copy(k) }, K.icon('copy'), 'Copy list'),
        h('button', { type: 'button', class: 'btn', onclick: () => send(k) }, K.icon('share'), 'Send'))
        : h('button', { type: 'button', class: 'btn wide or-who', onclick: () => { ui.sheet = { type: 'memo', f: {} }; K.render(); } }, 'Say who delivers these')))));
    if (!need.length) body.append(h('button', { type: 'button', class: 'btn wide', onclick: () => { ui.sheet = { type: 'memo', f: {} }; K.render(); } }, 'Set minimums and suppliers'));
    return { top: sub('Manage', () => K.back('manage')), body: body, tabs: false };
  };

  /* everything Hype knows, as it stands in the sheet: for looking things up, numbers below zero included */
  K.V.hypelist = function () {
    if (!K.canEdit()) return K.V.stock();
    const body = h('div', { class: 'wrap page hl' });
    body.append(h('h1', { class: 'ptitle' }, 'Everything in Hype'), h('p', { class: 'psub' }, 'Hype’s own numbers, as the sheet has them. The Stock tab only shows your drinks menu.'));
    hypeList(body);
    return { top: sub('Manage', () => K.back('manage')), body: body, tabs: false };
  };
  /* every drink Hype knows, as it stands in the sheet: by category, filtered by warehouse */
  function hypeList(w) {
    const rows = D.hypeRows || [], whs = [], cats = [];
    rows.forEach((r) => { if (r.wh && !whs.includes(r.wh)) whs.push(r.wh); if (r.cat && !cats.includes(r.cat)) cats.push(r.cat); });
    cats.sort((a, b) => a.localeCompare(b));
    w.append(K.searchBox('hq', ui.hq, 'Search Hype, in Bulgarian or English', (v) => { ui.hq = v; K.render(); }));
    w.append(h('div', { class: 'chips filters' },
      K.seg([['', 'All']].concat(whs.map((x) => [x, x])), ui.hyWh || '', (v) => { ui.hyWh = v; K.render(); }, { class: 'seg small-seg', 'aria-label': 'Warehouse' }),
      K.seg([['', 'All'], ['neg', 'Below zero'], ['zero', 'At zero']], ui.hyF || '', (v) => { ui.hyF = v; K.render(); }, { class: 'seg small-seg', 'aria-label': 'Show' })));
    w.append(K.select([['', 'All categories (' + cats.length + ')']].concat(cats.map((c) => [c, c + ' (' + rows.filter((r) => r.cat === c).length + ')'])), ui.hyCat || '', (v) => { ui.hyCat = v; K.render(); }, { 'aria-label': 'Category', class: 'input hy-cat' }));
    const list = rows.filter((r) => (!ui.hyWh || r.wh === ui.hyWh) && (!ui.hyCat || r.cat === ui.hyCat) && (ui.hyF === 'neg' ? r.qty < 0 : ui.hyF === 'zero' ? r.qty === 0 : true) && K.matches(r.name + ' ' + r.cat, ui.hq));
    const neg = list.filter((r) => r.qty < 0).length;
    w.append(h('p', { class: 'muted hy-count', role: 'status' }, list.length + ' of ' + rows.length + ' products' + (neg ? ' · ' + neg + ' below zero' : '')));
    if (!list.length) { w.append(h('div', { class: 'empty' }, h('strong', null, 'Nothing like that in Hype'), 'Try another word or filter.')); return; }
    const by = {};
    list.forEach((r) => { (by[r.cat || 'No category'] = by[r.cat || 'No category'] || []).push(r); });
    Object.keys(by).sort((a, b) => a.localeCompare(b)).forEach((c) => {
      w.append(h('section', { class: 'group' }, h('h2', { class: 'group-title' }, c, h('span', { class: 'n' }, String(by[c].length))),
        h('div', { class: 'stock-list' }, by[c].sort((a, b) => a.name.localeCompare(b.name)).map((r) => h('div', { class: 'hy-item' + (r.qty < 0 ? ' neg' : r.qty === 0 ? ' zero' : '') },
          h('span', { class: 'sr-txt' }, h('b', null, r.name), h('span', { class: 'muted' }, r.wh)),
          h('span', { class: 'hy-q mono' }, K.qtyText(r.qty, r.unit), r.qty < 0 ? h('small', null, 'below zero') : r.qty === 0 ? h('small', null, 'none') : null))))));
    });
  }

  /* one wine: bottles in, bottles out for a reason, or a fresh count */
  K.SHEETS.count = function (S) {
    const w = K.wine(S.id);
    if (!w) return null;
    const n = K.stockOf(w.id);
    const hyped = !!K.hypeRow(w);
    S.k = hyped ? 'count' : S.k || 'in';
    const num = h('input', { class: 'input big mono', id: 'cnt-n', inputmode: 'decimal', value: S.v == null ? (S.k === 'count' && n != null ? String(n) : '') : S.v, placeholder: S.k === 'count' ? 'Bottles there now' : 'How many', oninput: (e) => { S.v = e.target.value; } });
    const go = (e) => {
      e.preventDefault();
      const v = Math.round(+String(S.v || num.value).replace(',', '.') * 10) / 10;
      if (!(v >= 0) || (S.k !== 'count' && !v)) { K.toast('Write a number of bottles.', { tone: 'bad' }); return; }
      ui.sheet = null;
      if (S.k === 'count') { K.countBottles(w, v).then(() => K.toast(w.name + ': counted ' + v)); }
      else K.moveBottles(w, S.k === 'in' ? v : -v, S.k);
      K.render();
    };
    return K.sheet(K.wineTitle(w), h('form', { class: 'stack', onsubmit: go },
      h('div', { class: 'count-now' }, K.wineLabel(w, 'mini'), h('div', null, h('span', { class: 'label' }, 'Now'), K.stockBadge(w, true))),
      hyped ? h('p', { class: 'hint' }, 'This bottle follows Hype: sales and deliveries entered there are taken off and added by themselves. Here you only count.') : K.seg([['in', 'Delivered'], ['broken', 'Broken / corked'], ['comp', 'On the house'], ['count', 'Count']], S.k, (v) => { S.k = v; S.v = null; K.render(); }, { class: 'seg wrap-seg', 'aria-label': 'What happened' }),
      K.field(S.k === 'count' ? 'Bottles on the shelf now' : S.k === 'in' ? 'Bottles in' : 'Bottles out', num,
        S.k === 'count' ? 'A count replaces the number; the sales after it are taken off as they happen.' : null),
      h('button', { class: 'btn primary wide', type: 'submit' }, S.k === 'count' ? 'Save the count' : 'Save')));
  };

  /* what each stock check found: the book expected one number, the shelf had another. Losses first. */
  K.SHEETS.diffs = function () {
    const rows = Object.keys(D.cellar).map((id) => ({ w: K.wine(id), c: D.cellar[id] })).filter((x) => x.w && x.c.was != null)
      .map((x) => Object.assign(x, { d: Math.round((x.c.n - x.c.was) * 10) / 10 })).filter((x) => x.d !== 0).sort((a, b) => a.d - b.d);
    const lost = rows.filter((x) => x.d < 0), found = rows.filter((x) => x.d > 0);
    const sum = (l) => Math.round(l.reduce((s, x) => s + Math.abs(x.d), 0) * 10) / 10;
    const line = (x) => h('li', { class: x.d < 0 ? 'lost' : 'found' }, h('b', { class: 'mono' }, (x.d > 0 ? '+' : '−') + Math.abs(x.d)),
      h('span', null, x.w.stockOnly ? x.w.name : K.wineTitle(x.w), h('small', { class: 'muted' }, ' expected ' + K.qtyText(x.c.was) + ', ' + (x.c.auto ? 'not found on the shelf' : 'counted ' + x.c.n) + ' · ' + K.prettyDate(K.ymd(new Date(x.c.at)), { day: 'numeric', month: 'short' }) + (x.c.name ? ' · ' + x.c.name : ''))));
    return K.sheet('Differences', h('div', { class: 'stack' },
      h('p', { class: 'hint' }, 'From each bottle’s last stock check: what the book expected against what was on the shelf. A minus is missing bottles: not rung up, broken, poured freely, or a delivery Hype has that never arrived. A plus is usually a delivery not entered in Hype.'),
      D.take && D.take.done && !rows.length ? h('p', { class: 'banner' }, h('b', null, 'The count ended ' + when(D.take.done) + '. '), 'A first count sets the starting numbers, so it has nothing to be compared with. From the next count on, this shows what went missing and what turned up.') : null,
      !rows.length && !(D.take && D.take.done) ? h('p', { class: 'muted' }, 'No differences yet. They show from the second count on.') : null,
      lost.length ? h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'Missing', h('span', { class: 'n' }, sum(lost) + ' bottles')), h('ul', { class: 'ord-list diff' }, lost.map(line))) : null,
      found.length ? h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'More than expected', h('span', { class: 'n' }, sum(found) + ' bottles')), h('ul', { class: 'ord-list diff' }, found.map(line))) : null), { wide: true });
  };
  /* the memo: for every bottle, how many to keep and who delivers it */
  K.SHEETS.memo = function (S) {
    const all = K.takeList();
    const val = (w, k) => (S.f[w.id] && S.f[w.id][k] != null ? S.f[w.id][k] : String(w[k] == null ? '' : w[k]));
    const set = (w, k, v) => { (S.f[w.id] = S.f[w.id] || {})[k] = v; };
    const save = (e) => {
      e.preventDefault();
      let n = 0;
      Object.keys(S.f).forEach((id) => {
        const w = K.wine(id), f = S.f[id];
        if (!w) return;
        const par = f.par == null ? w.par : Math.max(0, +String(f.par).replace(',', '.') || 0), supplier = f.supplier == null ? w.supplier : String(f.supplier).trim();
        if (par !== w.par || supplier !== w.supplier) { K.saveWine(Object.assign({}, w, { par: par, supplier: supplier })); n++; }
      });
      ui.sheet = null; K.render(); K.toast(n ? n + ' bottles updated' : 'Nothing changed');
    };
    return K.sheet('Minimums & suppliers', h('form', { class: 'stack', onsubmit: save },
      h('p', { class: 'hint' }, 'For each bottle: how many to keep at least, and who you order it from. A bottle at or under its minimum goes on the order list, under its supplier.'),
      h('datalist', { id: 'memo-sup' }, K.suppliers().map((x) => h('option', { value: x }))),
      h('div', { class: 'take-list' }, all.map((w) => h('div', { class: 'memo-row' },
        h('span', { class: 'sr-txt' }, h('b', null, w.name + (w.vintage ? ' ' + w.vintage : '')), h('span', { class: 'muted' }, w.producer || K.COL[w.colour])),
        h('input', { class: 'input mono memo-par', inputmode: 'decimal', value: val(w, 'par'), 'aria-label': 'Keep at least, ' + w.name, oninput: (e) => set(w, 'par', e.target.value) }),
        h('input', { class: 'input memo-sup', value: val(w, 'supplier'), placeholder: 'Supplier', list: 'memo-sup', 'aria-label': 'Supplier of ' + w.name, oninput: (e) => set(w, 'supplier', e.target.value) })))),
      h('button', { class: 'btn primary wide', type: 'submit' }, 'Save')), { wide: true });
  };

  /* what happened lately: every bottle in or out, newest first */
  K.SHEETS.moves = function () {
    const ev = D.moves.map((m) => ({ at: m.at, w: K.wine(m.w), txt: (['open', 'ok', 'gone', 'bin'].includes(m.why) ? (m.frac ? m.frac + ' ' : '') : (m.n > 0 ? '+' : '') + m.n + ' ') + (WHY[m.why] || ''), who: m.name || '' }))
      .concat(Object.keys(D.cellar).map((id) => ({ at: D.cellar[id].at, w: K.wine(id), txt: 'counted ' + D.cellar[id].n, who: D.cellar[id].name || '', count: true })))
      .filter((x) => x.w).sort((a, b) => b.at - a.at).slice(0, 80);
    const day = (t) => { const d = K.ymd(new Date(t)); return d === K.day(0) ? 'Today' : d === K.day(-1) ? 'Yesterday' : K.prettyDate(d, { weekday: 'short', day: 'numeric', month: 'short' }); };
    let last = '';
    return K.sheet('Bottles in and out', ev.length ? h('ul', { class: 'moves' }, ev.map((x) => {
      const d = day(x.at), headRow = d !== last ? h('li', { class: 'mv-day' }, d) : null;
      last = d;
      return [headRow, h('li', { class: 'mv' + (x.count ? ' count' : '') }, h('span', { class: 'mono mv-t' }, K.hm(x.at)), h('b', null, x.w.name), h('span', null, x.txt), x.who ? h('span', { class: 'muted' }, x.who) : null)];
    })) : h('p', { class: 'muted' }, 'Nothing yet. Sales and counts show here.'));
  };
})();
