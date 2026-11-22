/* Stock: how many bottles of each wine are left. A count sets a wine's bottles outright; after that every
   bottle sold, opened for glasses or delivered is a move, so two phones never overwrite each other.
   What shows = the last count + the moves since. The wine bible reads the same numbers. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const WHY = { sold: 'sold', glass: 'opened for glasses', in: 'delivered', broken: 'broken or corked', comp: 'on the house', out: 'taken out' };

  K.V.stock = function () {
    const body = h('div', { class: 'page' }), all = K.winesSorted().filter((w) => !w.off && !w.nostock);
    const by = { out: [], low: [], ok: [], none: [] };
    all.forEach((w) => by[K.stockState(w)].push(w));
    const bottles = all.reduce((s, w) => s + (K.stockOf(w.id) || 0), 0);
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
    w.append(K.searchBox('sq', ui.sq, 'Search a wine or drink', (v) => { ui.sq = v; K.render(); }));
    w.append(h('div', { class: 'chips filters' },
      K.seg([['', 'All'], ['need', 'Low & out'], ['glass', 'By the glass']], ui.stockF, (v) => { ui.stockF = v; K.render(); }, { class: 'seg small-seg', 'aria-label': 'Show' }),
      K.canWrite() ? h('button', { type: 'button', class: 'chip', onclick: () => { ui.sheet = { type: 'stocktake', n: {} }; K.render(); } }, K.icon('list'), 'Stock take') : null,
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
  function tile(n, label, st) { return h('div', { class: 'stile st-' + st }, h('b', null, String(n)), h('span', null, label)); }
  function row(w) {
    const n = K.stockOf(w.id), st = K.stockState(w);
    return h('div', { class: 'stock-row st-' + st },
      h('button', { type: 'button', class: 'sr-main', onclick: () => K.go('winepage', { id: w.id }) },
        K.wineLabel(w, 'mini'),
        h('span', { class: 'sr-txt' }, h('b', null, w.name + (w.vintage ? ' ' + w.vintage : '')), h('span', { class: 'muted' }, [w.producer, K.COL[w.colour], w.byGlass ? 'by the glass' : ''].filter(Boolean).join(' · ')))),
      h('span', { class: 'sr-n mono', 'aria-label': n == null ? 'not counted' : n + ' bottles' }, n == null ? '–' : String(n)),
      K.canWrite() ? h('span', { class: 'sr-btns' },
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'One bottle out of ' + w.name, disabled: !n, onclick: () => K.moveBottles(w, -1, 'sold') }, K.icon('minus')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Bottles in or a count for ' + w.name, onclick: () => { ui.sheet = { type: 'count', id: w.id }; K.render(); } }, K.icon('plus'))) : null);
  }

  /* one wine: bottles in, bottles out for a reason, or a fresh count */
  K.SHEETS.count = function (S) {
    const w = K.wine(S.id);
    if (!w) return null;
    const n = K.stockOf(w.id);
    S.k = S.k || 'in';
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
      K.seg([['in', 'Delivered'], ['broken', 'Broken / corked'], ['comp', 'On the house'], ['count', 'Count']], S.k, (v) => { S.k = v; S.v = null; K.render(); }, { class: 'seg wrap-seg', 'aria-label': 'What happened' }),
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
    return K.sheet('Stock take', h('form', { class: 'stack', onsubmit: save },
      h('p', { class: 'hint' }, 'Count the shelf and write what is there. Leave a box empty to keep its number. Grey numbers are what the book thinks is there.'),
      h('div', { class: 'take-list' }, all.map((w) => h('label', { class: 'take-row' }, K.wineLabel(w, 'mini'),
        h('span', { class: 'sr-txt' }, h('b', null, w.name + (w.vintage ? ' ' + w.vintage : '')), h('span', { class: 'muted' }, w.producer || K.COL[w.colour])),
        h('input', { class: 'input mono take-in', id: 'tk-' + w.id, inputmode: 'numeric', placeholder: K.stockOf(w.id) == null ? '–' : String(K.stockOf(w.id)), value: S.n[w.id] || '', oninput: (e) => { S.n[w.id] = e.target.value; }, 'aria-label': 'Bottles of ' + w.name })))),
      h('button', { class: 'btn primary wide', type: 'submit' }, 'Save the counts')), { wide: true });
  };

  /* what happened lately: every bottle in or out, newest first */
  K.SHEETS.moves = function () {
    const ev = D.moves.map((m) => ({ at: m.at, w: K.wine(m.w), txt: (m.n > 0 ? '+' : '') + m.n + ' ' + (WHY[m.why] || ''), who: m.name || '' }))
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
