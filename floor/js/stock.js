/* Stock: how many bottles of each wine are left. A count sets a wine's bottles outright; after that every
   bottle sold, opened for glasses or delivered is a move, so two phones never overwrite each other.
   What shows = the last count + the moves since. The wine bible reads the same numbers. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const WHY = { open: 'opened for glasses', ok: 'tasted: still good', gone: 'open bottle finished', bin: 'open bottle thrown away', sold: 'sold', glass: 'opened for glasses', in: 'delivered', broken: 'broken or corked', comp: 'on the house', out: 'taken out' };

  K.V.stock = function () {
    const body = h('div', { class: 'page' }), all = K.winesSorted().filter((w) => !w.off && !w.nostock);
    const by = { out: [], low: [], ok: [], none: [] };
    all.forEach((w) => by[K.stockState(w)].push(w));
    const bottles = Math.round(all.reduce((s, w) => s + Math.max(0, K.stockOf(w.id) || 0), 0));
    body.append(K.pageHead('Stock', all.length ? bottles + ' bottles · ' + by.out.length + ' out · ' + by.low.length + ' low' : 'Bottles in the cellar',
      all.length ? h('div', { class: 'phead-side stock-tiles' },
        tile(by.ok.length, 'in stock', 'ok'), tile(by.low.length, 'low', 'low'), tile(by.out.length, 'out', 'out')) : null, '', 'stock-head has-search'));
    const w = h('div', { class: 'wrap' });
    body.append(w);
    if (!D.winesLoaded) { w.append(K.loadingBox('Loading the cellar')); return { body: body }; }
    if (!all.length) {
      w.append(K.catRest('No wines to count yet', 'Add the wines in the Wine tab; their bottles are counted here.', h('div', { class: 'btns center' }, h('button', { class: 'btn primary', type: 'button', onclick: () => K.go('wine') }, 'Go to the wine list'))));
      return { body: body };
    }
    w.append(openBox());
    w.append(hypeBar());
    if (D.hypeStock) {
      w.append(K.seg([['', 'Our drinks list'], ['hype', 'Hype’s own numbers']], ui.stockView || '', (v) => { ui.stockView = v; K.render(); }, { class: 'seg hy-view', 'aria-label': 'Which list' }));
      if (ui.stockView === 'hype') { hypeList(w); return { body: body }; }
    }
    w.append(K.searchBox('sq', ui.sq, 'Search a wine or drink', (v) => { ui.sq = v; K.render(); }));
    w.append(h('div', { class: 'chips filters' },
      K.seg([['', 'All'], ['need', 'Low & out'], ['glass', 'By the glass']], ui.stockF, (v) => { ui.stockF = v; K.render(); }, { class: 'seg small-seg', 'aria-label': 'Show' }),
      K.canWrite() ? h('button', { type: 'button', class: 'chip', onclick: () => { ui.sheet = { type: 'stocktake', n: {} }; K.render(); } }, K.icon('list'), 'Stock check') : null,
      h('button', { type: 'button', class: 'chip', onclick: () => { ui.sheet = { type: 'diffs' }; K.render(); } }, 'Differences'),
      h('button', { type: 'button', class: 'chip', onclick: () => { ui.sheet = { type: 'orderlist' }; K.render(); } }, 'To order'),
      K.canEdit() ? h('button', { type: 'button', class: 'chip', onclick: () => { ui.sheet = { type: 'memo', f: {} }; K.render(); } }, 'Minimums & suppliers') : null,
      h('button', { type: 'button', class: 'chip', onclick: () => { ui.sheet = { type: 'moves' }; K.render(); } }, 'Moves')));
    let list = all.filter((x) => K.matches(K.wineTitle(x) + ' ' + x.grapes + ' ' + x.region, ui.sq));
    if (ui.stockF === 'need') list = list.filter((x) => ['out', 'low'].includes(K.stockState(x)));
    if (ui.stockF === 'glass') list = list.filter((x) => x.byGlass);
    if (!list.length) { w.append(h('div', { class: 'empty' }, h('strong', null, ui.stockF === 'need' ? 'Nothing low or out' : 'No wine like that'), ui.stockF === 'need' ? 'Every wine has more than its minimum.' : 'Try another word.')); return { body: body }; }
    /* out first, then low, so the 86 list is the first thing a waiter sees */
    const rank = { out: 0, low: 1, none: 2, ok: 3 };
    list.sort((a, b) => rank[K.stockState(a)] - rank[K.stockState(b)]);
    const head = (st) => ({ out: 'Out · 86', low: 'Running low', none: 'Not counted yet', ok: 'In stock' })[st];
    let cur = null, grid = null;
    list.forEach((x) => {
      const st = K.stockState(x);
      if (st !== cur) { cur = st; grid = h('div', { class: 'stock-list' }); w.append(h('section', { class: 'group' }, h('h2', { class: 'group-title' }, head(st), h('span', { class: 'n' }, String(by[st].filter((y) => list.includes(y)).length))), grid)); }
      grid.append(row(x));
    });
    return { body: body };
  };
  /* open bottles of wine: how long each has been open, and the ones to taste today */
  const dayWord = (d) => (d === 0 ? 'Opened today' : d === 1 ? 'Opened yesterday' : 'Open ' + d + ' days');
  function openBox() {
    const list = K.openBottles(), due = list.filter((o) => o.due);
    const add = K.canWrite() ? h('button', { type: 'button', class: 'btn small', onclick: () => { ui.sheet = { type: 'openadd' }; K.render(); } }, K.icon('plus'), 'Open a bottle') : null;
    if (!list.length) return h('section', { class: 'open-box empty-open' }, h('div', { class: 'ob-head' }, h('b', null, 'Open bottles'), add), h('p', { class: 'muted' }, 'No wine is open for glasses. Tap “Open a bottle” when you open one, and it reminds you to taste it after ' + K.OPEN_DAYS + ' days.'));
    return h('section', { class: 'open-box' + (due.length ? ' due' : '') },
      h('div', { class: 'ob-head' }, h('b', null, 'Open bottles', h('span', { class: 'n' }, String(list.length))), add),
      due.length ? h('p', { class: 'ob-warn', role: 'alert' }, K.icon('alert'), h('span', null, h('b', null, due.length + (due.length === 1 ? ' bottle' : ' bottles') + ' to taste today. '), 'Open ' + K.OPEN_DAYS + ' days or more: taste before pouring for a guest.')) : null,
      h('div', { class: 'ob-list' }, list.map((o) => h('div', { class: 'ob-row' + (o.due ? ' due' : '') },
        h('button', { type: 'button', class: 'ob-main', onclick: () => K.go('winepage', { id: o.w.id }) }, K.wineLabel(o.w, 'mini'),
          h('span', { class: 'sr-txt' }, h('b', null, o.w.name + (o.w.vintage ? ' ' + o.w.vintage : '')),
            h('span', { class: o.due ? 'ob-age due' : 'ob-age' }, dayWord(o.days) + (o.who ? ' · ' + o.who : '') + (o.ok && !o.due ? ' · tasted, still good' : '')))),
        K.canWrite() ? h('div', { class: 'ob-btns' },
          o.days >= K.OPEN_DAYS ? h('button', { type: 'button', class: 'btn small ok', onclick: () => { K.openNote(o.w, 'ok', o.id); K.toast(o.w.name + ': still good. It asks again tomorrow.'); } }, K.icon('check'), 'Still good') : null,
          h('button', { type: 'button', class: 'btn small', onclick: () => { K.openNote(o.w, 'gone', o.id); K.toast(o.w.name + ': finished'); } }, 'Finished'),
          h('button', { type: 'button', class: 'btn small bad', onclick: () => { ui.sheet = { type: 'openbin', id: o.id, w: o.w.id }; K.render(); } }, K.icon('trash'), 'Throw away')) : null))));
  }
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

  /* where the numbers come from: the Hype sheet, when it was read and when it last changed */
  const when = (t) => { const d = K.ymd(new Date(t)); return (d === K.day(0) ? 'today' : d === K.day(-1) ? 'yesterday' : K.prettyDate(d, { day: 'numeric', month: 'short' })) + ' ' + K.hm(t); };
  const age = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 60 ? m + ' min ago' : m < 48 * 60 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  function hypeBar() {
    const hs = D.hypeStock, linked = K.winesSorted().filter((x) => K.hypeRow(x)).length;
    if (!D.hypeUrl && !hs) return K.canEdit() ? h('button', { type: 'button', class: 'al-nudge plain', onclick: () => { ui.sheet = { type: 'hypesheet' }; K.render(); } },
      K.icon('download'), h('span', null, h('b', null, 'Take the stock from Hype'), h('span', null, 'Connect the Google Sheet with the Hype stock, once.')), K.icon('next')) : h('span');
    const old = K.hypeOld();
    const go = () => { ui.hypeBusy = true; K.render(); K.refreshHype().then((d) => { ui.hypeBusy = false; K.render(); K.toast('Stock refreshed: ' + d.rows.length + ' products'); }, (e) => { ui.hypeBusy = false; K.render(); K.toast(e && e.message === 'nolink' ? 'The Hype sheet is not connected yet.' : 'The sheet could not be read. Check the connection, or the link in Settings.', { tone: 'bad' }); }); };
    const t = hs ? hs.exported || 0 : 0;
    return h('section', { class: 'hype-bar' + (old ? ' old' : '') },
      h('div', { class: 'hb-txt' }, h('b', null, 'Stock from Hype'),
        hs ? h('span', { class: 'hb-exp' }, t ? 'Exported from Hype ' + when(t) + ' · ' + age(t) : hs.exportedRaw ? 'Exported from Hype ' + hs.exportedRaw : hs.modified ? 'Sheet last changed ' + when(hs.modified) : 'No export time in the sheet') : h('span', null, 'Not read yet'),
        hs ? h('span', { class: 'muted' }, 'Read by the app ' + when(hs.at) + (hs.by ? ' · ' + hs.by : '')) : null),
      old ? h('p', { class: 'hb-warn', role: 'alert' }, K.icon('alert'), h('span', null, h('b', null, 'More than 12 hours old. '), 'These numbers may be wrong. Hype is read at 07:00, 16:00 and 23:00 when the restaurant computer is on; ask for a refresh there.')) : null,
      h('div', { class: 'hb-btns' },
        D.hypeUrl ? h('button', { type: 'button', class: 'btn primary small', disabled: ui.hypeBusy ? true : null, onclick: go }, ui.hypeBusy ? 'Reading…' : 'Refresh stock') : null,
        K.canEdit() && hs ? h('button', { type: 'button', class: 'btn small', onclick: () => { ui.sheet = { type: 'hype', fromSheet: true }; K.render(); } }, 'Pair bottles') : null,
        K.canEdit() ? h('button', { type: 'button', class: 'btn small', onclick: () => { ui.sheet = { type: 'hypesheet' }; K.render(); } }, 'Link') : null));
  }
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
  function tile(n, label, st) { return h('div', { class: 'stile st-' + st }, h('b', null, String(n)), h('span', null, label)); }
  function row(w) {
    const n = K.stockOf(w.id), st = K.stockState(w), hr = K.hypeRow(w), sold = K.soldSince(w);
    return h('div', { class: 'stock-row st-' + st + (n < 0 ? ' neg' : '') },
      h('button', { type: 'button', class: 'sr-main', onclick: () => K.go('winepage', { id: w.id }) },
        K.wineLabel(w, 'mini'),
        h('span', { class: 'sr-txt' }, h('b', null, w.name + (w.vintage ? ' ' + w.vintage : '')),
          h('span', { class: 'muted' }, [w.producer, K.COL[w.colour], w.supplier].filter(Boolean).join(' · ')),
          hr ? h('span', { class: 'hy-tag' }, sold == null ? 'Hype’s number · not checked yet' : 'Checked ' + D.cellar[w.id].n + ' · Hype took off ' + sold + ' since') : null)),
      h('span', { class: 'sr-n mono', 'aria-label': n == null ? 'not counted' : n + ' bottles' }, n == null ? '–' : K.qtyText(n), n < 0 ? h('small', { class: 'neg-tag' }, 'below zero') : null),
      K.canWrite() ? h('span', { class: 'sr-btns' },
        hr ? null : h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'One bottle out of ' + w.name, disabled: !n, onclick: () => K.moveBottles(w, -1, 'sold') }, K.icon('minus')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Bottles in or a count for ' + w.name, onclick: () => { ui.sheet = { type: 'count', id: w.id }; K.render(); } }, K.icon('plus'))) : null);
  }

  /* one wine: bottles in, bottles out for a reason, or a fresh count */
  K.SHEETS.count = function (S) {
    const w = K.wine(S.id);
    if (!w) return null;
    const n = K.stockOf(w.id);
    const hyped = !!K.hypeRow(w);
    S.k = hyped ? 'count' : S.k || 'in';
    const num = h('input', { class: 'input big mono', id: 'cnt-n', inputmode: 'numeric', value: S.v == null ? (S.k === 'count' && n != null ? String(n) : '') : S.v, placeholder: S.k === 'count' ? 'Bottles there now' : 'How many', oninput: (e) => { S.v = e.target.value; } });
    const go = (e) => {
      e.preventDefault();
      const v = Math.round(+String(S.v || num.value).replace(',', '.'));
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

  /* the whole cellar in one go: a box per wine, only the ones you fill in are saved */
  K.SHEETS.stocktake = function (S) {
    const all = K.winesSorted().filter((w) => !w.off && !w.nostock);
    const save = (e) => {
      e.preventDefault();
      const ids = Object.keys(S.n).filter((id) => String(S.n[id]).trim() !== '' && +S.n[id] >= 0);
      if (!ids.length) { K.toast('Write the bottles for at least one wine.', { tone: 'bad' }); return; }
      ids.forEach((id) => { const w = K.wine(id); if (w) K.countBottles(w, +S.n[id]); });
      ui.sheet = null; K.render();
      K.toast(ids.length + (ids.length === 1 ? ' wine counted' : ' wines counted'));
    };
    return K.sheet('Stock check', h('form', { class: 'stack', onsubmit: save },
      K.hypeOld() ? h('p', { class: 'banner' }, h('b', null, 'Hype was read more than 12 hours ago. '), 'Ask for a fresh read before counting, or the sales in between are taken off twice.') : null,
      h('p', { class: 'hint' }, 'Count the shelf and write what is there. Leave a box empty to keep its number. Grey numbers are what the book thinks is there.'),
      h('div', { class: 'take-list' }, all.map((w) => h('label', { class: 'take-row' }, K.wineLabel(w, 'mini'),
        h('span', { class: 'sr-txt' }, h('b', null, w.name + (w.vintage ? ' ' + w.vintage : '')), h('span', { class: 'muted' }, w.producer || K.COL[w.colour])),
        h('input', { class: 'input mono take-in', id: 'tk-' + w.id, inputmode: 'numeric', placeholder: K.stockOf(w.id) == null ? '–' : String(K.stockOf(w.id)), value: S.n[w.id] || '', oninput: (e) => { S.n[w.id] = e.target.value; }, 'aria-label': 'Bottles of ' + w.name })))),
      h('button', { class: 'btn primary wide', type: 'submit' }, 'Save the counts')), { wide: true });
  };

  /* what each stock check found: the book expected one number, the shelf had another. Losses first. */
  K.SHEETS.diffs = function () {
    const rows = Object.keys(D.cellar).map((id) => ({ w: K.wine(id), c: D.cellar[id] })).filter((x) => x.w && x.c.was != null)
      .map((x) => Object.assign(x, { d: Math.round((x.c.n - x.c.was) * 10) / 10 })).filter((x) => x.d !== 0).sort((a, b) => a.d - b.d);
    const lost = rows.filter((x) => x.d < 0), found = rows.filter((x) => x.d > 0);
    const sum = (l) => Math.round(l.reduce((s, x) => s + Math.abs(x.d), 0) * 10) / 10;
    const line = (x) => h('li', { class: x.d < 0 ? 'lost' : 'found' }, h('b', { class: 'mono' }, (x.d > 0 ? '+' : '−') + Math.abs(x.d)),
      h('span', null, K.wineTitle(x.w), h('small', { class: 'muted' }, ' expected ' + K.qtyText(x.c.was) + ', counted ' + x.c.n + ' · ' + K.prettyDate(K.ymd(new Date(x.c.at)), { day: 'numeric', month: 'short' }) + (x.c.name ? ' · ' + x.c.name : ''))));
    return K.sheet('Differences', h('div', { class: 'stack' },
      h('p', { class: 'hint' }, 'From each bottle’s last stock check: what the book expected against what was on the shelf. A minus is missing bottles: not rung up, broken, poured freely, or a delivery Hype has that never arrived. A plus is usually a delivery not entered in Hype.'),
      !rows.length ? h('p', { class: 'muted' }, 'No differences yet. They show after a stock check.') : null,
      lost.length ? h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'Missing', h('span', { class: 'n' }, sum(lost) + ' bottles')), h('ul', { class: 'ord-list diff' }, lost.map(line))) : null,
      found.length ? h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'More than expected', h('span', { class: 'n' }, sum(found) + ' bottles')), h('ul', { class: 'ord-list diff' }, found.map(line))) : null), { wide: true });
  };
  /* what to order, by supplier: every bottle at or under its minimum, with how many bring it back to the minimum */
  K.SHEETS.orderlist = function () {
    const need = K.winesSorted().filter((w) => !w.off && !w.nostock && K.stockOf(w.id) != null && K.stockOf(w.id) <= (w.par || 0) && (w.par || 0) > 0)
      .map((w) => ({ w: w, n: K.stockOf(w.id), q: Math.max(1, Math.ceil((w.par || 0) - Math.max(0, K.stockOf(w.id)))) }));
    const by = {};
    need.forEach((x) => { const k = x.w.supplier || 'No supplier written'; (by[k] = by[k] || []).push(x); });
    const keys = Object.keys(by).sort((a, b) => (a === 'No supplier written') - (b === 'No supplier written') || a.localeCompare(b));
    const text = keys.map((k) => k + '\n' + by[k].map((x) => '- ' + x.q + ' x ' + K.wineTitle(x.w)).join('\n')).join('\n\n');
    const uncounted = K.winesSorted().filter((w) => !w.off && !w.nostock && K.stockOf(w.id) == null).length;
    return K.sheet('To order', h('div', { class: 'stack' },
      K.hypeOld() ? h('p', { class: 'banner' }, h('b', null, 'Hype was read more than 12 hours ago. '), 'The list may be missing what sold since.') : null,
      uncounted ? h('p', { class: 'hint' }, uncounted + ' bottles are not counted yet, so they cannot be on this list.') : null,
      !need.length ? h('p', { class: 'muted' }, 'Nothing is at or under its minimum.') : keys.map((k) => h('section', { class: 'group' },
        h('h2', { class: 'group-title' }, k, h('span', { class: 'n' }, String(by[k].length))),
        h('ul', { class: 'ord-list' }, by[k].map((x) => h('li', null, h('b', { class: 'mono' }, x.q + ' ×'), h('span', null, K.wineTitle(x.w), h('small', { class: 'muted' }, ' have ' + K.qtyText(x.n) + ', keep ' + x.w.par))))))),
      need.length ? h('button', { class: 'btn primary wide', type: 'button', onclick: () => navigator.clipboard.writeText(text).then(() => K.toast('Order list copied'), () => K.toast('This device would not copy.')) }, 'Copy the list') : null,
      h('p', { class: 'hint' }, 'The amount brings each bottle back up to its minimum. Set minimums and suppliers under “Minimums & suppliers”.')), { wide: true });
  };
  /* the memo: for every bottle, how many to keep and who delivers it */
  K.SHEETS.memo = function (S) {
    const all = K.winesSorted().filter((w) => !w.off && !w.nostock);
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
