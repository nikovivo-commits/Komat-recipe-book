/* Prices and stock from Hype, the till. Hype has no feed, so someone exports a file in its back office (an article or
   stock report, as CSV) and opens it here. Each of our bottles is paired with an article by name; the pairing is
   remembered on the bottle (`hype`), so the next file needs no checking. Nothing is saved until you press Save. */
(function () {
  'use strict';
  const K = window.K, h = K.h, ui = K.ui, D = K.D;

  /* ---------- reading the file ---------- */
  function decode(buf) {
    const u = new Uint8Array(buf);
    if (u[0] === 0xD0 && u[1] === 0xCF || u[0] === 0x50 && u[1] === 0x4B) return null; /* a real Excel file */
    if (u[0] === 0xFF && u[1] === 0xFE) return new TextDecoder('utf-16le').decode(u);
    if (u[0] === 0xFE && u[1] === 0xFF) return new TextDecoder('utf-16be').decode(u);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u); } catch (e) { return new TextDecoder('windows-1251').decode(u); }
  }
  function table(text) {
    text = String(text || '').replace(/^﻿/, '');
    if (/<table/i.test(text)) {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      return Array.from(doc.querySelectorAll('tr')).map((tr) => Array.from(tr.querySelectorAll('th,td')).map((c) => c.textContent.trim()));
    }
    const head = text.split(/\r?\n/).slice(0, 8).join('\n');
    const sep = [';', '\t', ','].map((c) => [c, head.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"' && !cell) q = true;
      else if (c === sep) { row.push(cell.trim()); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
    return rows.filter((r) => r.some(Boolean));
  }
  const num = (s) => {
    s = String(s == null ? '' : s).replace(/[^\d.,-]/g, '');
    if (!/\d/.test(s)) return null;
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else s = s.replace(',', '.');
    const v = parseFloat(s);
    return isFinite(v) ? v : null;
  };
  const RX = {
    name: /item|article|product|name|артикул|наименование|име|стока|продукт/i,
    qty: /qty|quant|stock|balance|налич|колич|к-во|остат|салдо/i,
    price: /price|цена/i,
    sales: /bill|receipt|сметка|бон|operator|оператор/i,
  };
  /* the header line and which columns hold the name, the quantity and the price */
  function shape(rows) {
    let hi = rows.slice(0, 20).findIndex((r) => r.filter(Boolean).length >= 2 && r.some((c) => RX.name.test(c)));
    if (hi < 0) hi = 0;
    const head = rows[hi] || [], find = (rx, not) => head.findIndex((c, i) => rx.test(c) && i !== not);
    const name = Math.max(0, find(RX.name));
    const sell = head.findIndex((c) => RX.price.test(c) && /прод|sale|sell|retail/i.test(c));
    return { hi: hi, head: head, cols: { name: name, qty: find(RX.qty, name), price: sell >= 0 ? sell : find(RX.price, name) }, sales: head.some((c) => RX.sales.test(c)) };
  }
  function items(S) {
    const c = S.cols, by = {}, out = [];
    S.rows.slice(S.hi + 1).forEach((r) => {
      const name = String(r[c.name] || '').trim();
      if (!name || num(name) !== null && !/[a-zа-я]/i.test(name)) return;
      const qty = c.qty >= 0 ? num(r[c.qty]) : null, price = c.price >= 0 ? num(r[c.price]) : null;
      let it = by[name];
      if (!it) { it = by[name] = { name: name, qty: null, price: null, tok: tokens(name) }; out.push(it); }
      if (qty !== null) it.qty = (it.qty || 0) + qty;
      if (price !== null && price > 0) it.price = price;
    });
    return out;
  }

  /* ---------- pairing names: Hype writes Bulgarian, the wine list English ---------- */
  const CYR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: '', ю: 'yu', я: 'ya' };
  const STOP = /^(vino|wine|butilka|bottle|chasha|glass|cherveno|bialo|byalo|red|white|rose|roze|the|and|years?|god|let|dzhin|gin|uiski|viski|vhiski|vodka|rom|rum|rakia|koniak|konak|liker|likior|bira|ber|tekila|bezalkoholno)$/;
  /* written the way it sounds, so "Хендрикс" and "Hendrick's" come out alike */
  const sound = (s) => String(s || '').toLowerCase().replace(/й/g, 'и').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, '')
    .replace(/[а-я]/g, (c) => (CYR[c] == null ? '' : CYR[c]))
    .replace(/ph/g, 'f').replace(/ck|qu|q/g, 'k').replace(/c(?=[eiy])/g, 's').replace(/c/g, 'k').replace(/w/g, 'v').replace(/x/g, 'ks').replace(/th/g, 't').replace(/y/g, 'i').replace(/sch/g, 'sh')
    .replace(/([a-z])\1/g, '$1');
  function tokens(s) { return sound(s).split(/[^a-z0-9]+/).filter((t) => t.length >= 3 && !STOP.test(t) && !/^\d+(ml|l|g)?$/.test(t)); }
  const grams = (t) => { const g = []; for (let i = 0; i < t.length - 1; i++) g.push(t.slice(i, i + 2)); return g; };
  function dice(a, b) {
    if (a === b) return 1;
    const A = grams(a), B = grams(b);
    let n = 0;
    A.forEach((g) => { const i = B.indexOf(g); if (i >= 0) { n++; B.splice(i, 1); } });
    return (2 * n) / (A.length + grams(b).length || 1);
  }
  /* two words are also alike when only their vowels differ: "tankerei" and "tankerai" */
  const bones = (t) => t.replace(/[aeiou]/g, '');
  const like = (a, b) => { const d = dice(a, b), x = bones(a); return x.length >= 3 && x === bones(b) ? Math.max(d, 0.85) : d; };
  /* how many of these words are found among those: 1 when all of them are */
  function cover(from, among) {
    if (!from.length || !among.length) return 0;
    let sum = 0, strong = 0;
    from.forEach((t) => { let best = 0; among.forEach((x) => { const d = like(t, x); if (d > best) best = d; }); sum += best; if (best >= 0.75) strong++; });
    return strong ? sum / from.length : 0;
  }
  /* how well an article fits a bottle: the bottle's words are in the article, or the article's words in the bottle */
  const score = (wt, it) => Math.max(cover(wt, it.tok), cover(it.tok, wt) * 0.9);
  const wtok = (w) => { const n = tokens(w.name), p = tokens(w.producer).filter((t) => !n.includes(t)); return { n: n, all: n.concat(p) }; };
  function fit(w, it) { const t = wtok(w); return Math.max(score(t.n, it) * 0.95, score(t.all, it)); }
  function pair(S) {
    S.map = {}; S.guess = {};
    K.winesSorted().forEach((w) => {
      const saved = w.hype ? S.items.findIndex((it) => it.name === w.hype) : -1;
      if (saved >= 0) { S.map[w.id] = saved; return; }
      let best = -1, bs = 0;
      S.items.forEach((it, i) => { const s = fit(w, it); if (s > bs) { bs = s; best = i; } });
      S.map[w.id] = bs >= 0.7 ? best : -1;
      if (bs >= 0.7) S.guess[w.id] = true;
    });
  }
  K.hypeTest = { table: table, num: num, shape: shape, tokens: tokens, dice: dice };

  function take(S, text) {
    if (text == null) { K.toast('That is an Excel file. In Hype, use the CSV button instead.', { tone: 'bad' }); return; }
    const rows = table(text);
    if (rows.length < 2) { K.toast('Nothing to read in that file.', { tone: 'bad' }); return; }
    const sh = shape(rows);
    Object.assign(S, { rows: rows, hi: sh.hi, head: sh.head, cols: sh.cols, sales: sh.sales });
    S.items = items(S);
    S.doStock = S.cols.qty >= 0 && !S.sales; S.doPrice = S.cols.price >= 0;
    pair(S);
    K.render();
  }
  const money = (p) => String(+(+p).toFixed(2));
  /* a wine's article can be the bottle or the glass; a drink is priced by the measure */
  const priceField = (w, it) => (K.isDrink(w) || /чаша|glass|\b(100|125|150|175)\s?(мл|ml)/i.test(it.name) ? 'glassPrice' : 'bottlePrice');

  /* the script that hands the drinks on the Stock tab to the app (wines, spirits, beer and soft drinks; no coffee or tea, nothing
     from the kitchen): names, warehouses, quantities, units, categories, barcodes.
     Prices stay in the sheet. Whoever has its link can read the stock, so the link is kept in the database, not here. */
  const SCRIPT = [
    'function doGet() {',
    '  var ss = SpreadsheetApp.getActiveSpreadsheet();',
    '  var bar = ss.getSheetByName("Bar_Stock");',
    '  var v = (bar || ss.getSheetByName("Stock")).getDataRange().getValues();',
    '  var head = v[0].map(function (x) { return String(x).toLowerCase(); });',
    '  var col = function (rx, not) { for (var i = 0; i < head.length; i++) if (rx.test(head[i]) && !(not && not.test(head[i]))) return i; return -1; };',
    '  var c = [col(/name|product|артикул|наимен/, /id/), col(/warehouse|склад/, /id/), col(/quant|qty|колич|налич/, /raw/), col(/^unit|мерна|мярка/), col(/categ|катег|група/, /id/), col(/barcode|баркод/)];',
    '  var ex = col(/export/), exported = "";',
    '  var drinks = /вин|алкохол|бира|раки|уиски|джин|водка|коняк|бренди|ром|ликьор|анасон|напитк|wine|beer|spirit|drink/i;',
    '  var rows = v.slice(1).filter(function (r) {',
    '    if (ex >= 0 && r[ex] && !exported) exported = r[ex] instanceof Date ? r[ex].getTime() : String(r[ex]);',
    '    var k = String(r[c[4]]); return bar || c[4] < 0 || (drinks.test(k) && !/топли|hot/i.test(k));',
    '  }).map(function (r) { return c.map(function (i) { return i < 0 ? "" : r[i]; }); });',
    '  var out = { bar: !!bar, exported: exported, modified: DriveApp.getFileById(ss.getId()).getLastUpdated().getTime(), rows: rows };',
    '  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);',
    '}',
  ].join('\n');
  K.SHEETS.hypesheet = function (S) {
    if (S.url == null) S.url = D.hypeUrl || '';
    const save = (e) => {
      e.preventDefault();
      const url = String(S.url).trim();
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) { K.toast('That is not the web app link. It starts with https://script.google.com/macros/s/ and ends with /exec.', { tone: 'bad' }); return; }
      K.saveHypeUrl(url);
      K.toast('Reading the sheet…');
      K.refreshHype().then((d) => { ui.sheet = { type: 'hype', fromSheet: true }; K.render(); K.toast(d.rows.length + ' products read from the sheet'); },
        (e) => K.toast(e && /http|shape|fetch/i.test(String(e.message)) ? 'Saved, but the sheet could not be read. Check that the web app is set to “Anyone”.' : 'The sheet was read, but something went wrong showing it. Close this and press Refresh stock.', { tone: 'bad' }));
    };
    return K.sheet('The Hype stock sheet', h('form', { class: 'stack', onsubmit: save },
      h('p', null, 'The app reads the “Bar_Stock” tab of your Google Sheet (or “Stock”, drinks only, when there is no such tab) through a small script that lives in the sheet. You set it up once:'),
      h('ol', { class: 'prose' },
        h('li', null, 'Open the sheet “Komat Hype Database” on a computer. Menu ', h('b', null, 'Extensions → Apps Script'), '.'),
        h('li', null, 'Delete what is there, paste the script below, and press Save.'),
        h('li', null, h('b', null, 'Deploy → New deployment → Web app'), '. Execute as: ', h('b', null, 'Me'), '. Who has access: ', h('b', null, 'Anyone'), '. Press Deploy and allow it when Google asks.'),
        h('li', null, 'Copy the ', h('b', null, 'Web app URL'), ' and paste it here.')),
      h('textarea', { class: 'input mono', rows: '6', readonly: true, 'aria-label': 'The script', value: SCRIPT }),
      h('button', { class: 'btn', type: 'button', onclick: () => navigator.clipboard.writeText(SCRIPT).then(() => K.toast('Script copied'), () => K.toast('Select the text and copy it by hand.')) }, 'Copy the script'),
      K.field('Web app URL', h('input', { class: 'input', id: 'hy-url', value: S.url, placeholder: 'https://script.google.com/macros/s/…/exec', inputmode: 'url', oninput: (e) => { S.url = e.target.value; } }),
        'Anyone with this link can read the stock list (no prices), so it is kept in the database and only shown to people who joined.'),
      h('button', { class: 'btn primary wide', type: 'submit' }, 'Save and read the sheet')), { wide: true });
  };

  K.SHEETS.hype = function (S) {
    /* pairing against the sheet's products: the numbers then follow the sheet, nothing is counted by hand */
    if (S.fromSheet && !S.items && D.hypeIdx) {
      S.items = Object.keys(D.hypeIdx).map((n) => ({ name: n, qty: D.hypeIdx[n].qty, price: null, unit: D.hypeIdx[n].unit, tok: tokens(n) }));
      Object.assign(S, { live: true, cols: { name: 0, qty: 0, price: -1 }, head: [], doStock: false, doPrice: false });
      pair(S);
    }
    if (!S.items) {
      return K.sheet('Prices and stock from Hype', h('div', { class: 'stack' },
        h('p', null, 'Hype has no live feed, so the numbers come over as a file:'),
        h('ol', { class: 'prose' },
          h('li', null, 'In Hype’s back office open the report that lists every article with its ', h('b', null, 'quantity in stock'), ' and ', h('b', null, 'price'), '.'),
          h('li', null, 'Press ', h('b', null, 'CSV'), ' to save it.'),
          h('li', null, 'Open that file here.')),
        h('button', { class: 'btn primary wide', type: 'button', onclick: () => K.pickFile('.csv,.txt,.xls,.html,text/csv,text/plain', false, (f) => f[0].arrayBuffer().then((b) => take(S, decode(b)), () => K.toast('That file could not be read.', { tone: 'bad' }))) }, K.icon('upload'), 'Open the Hype file'),
        h('p', { class: 'hint' }, 'You check every pairing before anything is saved. Bottles already paired stay paired, so the next time is two taps.')));
    }
    const wines = K.winesSorted().filter((w) => !w.off && !w.stockOnly);
    /* choosing the article for one bottle */
    if (S.pick) {
      const w = K.wine(S.pick), q = tokens(S.q || '');
      const list = S.items.map((it, i) => ({ it: it, i: i, s: q.length ? score(q, it) : fit(w, it) })).filter((x) => !q.length || x.s > 0.4).sort((a, b) => b.s - a.s).slice(0, 40);
      const set = (i) => { S.map[w.id] = i; delete S.guess[w.id]; S.pick = null; S.q = ''; K.render(); };
      return K.sheet(K.wineTitle(w), h('div', { class: 'stack' },
        K.searchBox('hyq', S.q || '', 'Search the Hype articles', (v) => { S.q = v; K.render(); }),
        h('div', { class: 'hy-list' },
          h('button', { type: 'button', class: 'hy-row none', onclick: () => set(-1) }, h('span', null, h('b', null, 'Not in this file'))),
          list.map((x) => h('button', { type: 'button', class: 'hy-row', onclick: () => set(x.i) }, h('span', null, h('b', null, x.it.name)), meta(x.it)))),
        h('button', { class: 'btn wide', type: 'button', onclick: () => { S.pick = null; S.q = ''; K.render(); } }, 'Back')), { wide: true });
    }
    const paired = wines.filter((w) => S.map[w.id] >= 0), rest = wines.filter((w) => !(S.map[w.id] >= 0));
    const colSel = (k, label) => K.field(label, K.select([['-1', 'Not in the file']].concat(S.head.map((c, i) => [String(i), c || 'Column ' + (i + 1)])), String(S.cols[k]), (v) => { S.cols[k] = +v; S.items = items(S); pair(S); K.render(); }));
    const row = (w) => {
      const it = S.items[S.map[w.id]];
      return h('button', { type: 'button', class: 'hy-row' + (it ? (S.guess[w.id] ? ' guess' : '') : ' none'), onclick: () => { S.pick = w.id; K.render(); } },
        h('span', null, h('b', null, K.wineTitle(w)), it ? h('span', { class: 'muted' }, it.name) : h('span', { class: 'muted' }, 'No article · tap to choose'),
          it && S.guess[w.id] ? h('span', { class: 'hy-tag' }, 'A guess · check it') : null), it ? meta(it) : null);
    };
    const save = () => {
      let st = 0, pr = 0;
      paired.forEach((w) => {
        const it = S.items[S.map[w.id]], patch = { hype: it.name };
        if (S.doPrice && it.price) { const k = priceField(w, it), v = money(it.price); if (String(w[k]) !== v) { patch[k] = v; pr++; } }
        if (patch.hype !== w.hype || Object.keys(patch).length > 1) K.saveWine(Object.assign({}, w, patch));
        if (!S.live && S.doStock && it.qty !== null && !w.nostock) { K.countBottles(w, it.qty); st++; }
      });
      ui.sheet = null; K.render();
      K.toast(paired.length + ' bottles paired' + (st ? ' · ' + st + ' counts set' : '') + (pr ? ' · ' + pr + ' prices changed' : ''));
    };
    return K.sheet('Prices and stock from Hype', h('div', { class: 'stack' },
      h('p', { class: 'muted' }, S.items.length + ' articles in the file · ' + paired.length + ' of ' + wines.length + ' bottles paired'),
      S.sales ? h('p', { class: 'banner' }, h('b', null, 'This looks like a sales report. '), 'Its quantities are what was sold, not what is on the shelf, so stock is switched off. Prices can still be taken.') : null,
      S.live ? h('p', { class: 'hint' }, 'Pair each bottle with its product in Hype. Then count it once: from that count on, what Hype sells is taken off by itself.') : h('div', { class: 'hy-opts' },
        h('label', null, h('input', { type: 'checkbox', checked: S.doStock ? true : null, disabled: S.cols.qty < 0 ? true : null, onchange: (e) => { S.doStock = e.target.checked; } }), 'Set the bottles in stock from Hype'),
        h('label', null, h('input', { type: 'checkbox', checked: S.doPrice ? true : null, disabled: S.cols.price < 0 ? true : null, onchange: (e) => { S.doPrice = e.target.checked; } }), 'Set the prices from Hype')),
      S.live ? null : h('details', null, h('summary', null, 'Wrong numbers? Choose the columns'),
        h('div', { class: 'hy-cols' }, colSel('name', 'Article name'), colSel('qty', 'Quantity in stock'), colSel('price', 'Selling price'))),
      paired.length ? h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'Paired', h('span', { class: 'n' }, String(paired.length))),
        h('p', { class: 'hint' }, 'Tap a bottle to change its article. Orange ones were guessed from the name.'), h('div', { class: 'hy-list' }, paired.map(row))) : null,
      rest.length ? h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'No article found', h('span', { class: 'n' }, String(rest.length))), h('div', { class: 'hy-list' }, rest.map(row))) : null,
      h('button', { class: 'btn primary wide', type: 'button', disabled: paired.length ? null : true, onclick: save }, 'Save ' + paired.length + ' bottles')), { wide: true });
  };
  function meta(it) {
    return h('span', { class: 'hy-n mono' }, it.qty !== null ? h('div', null, String(Math.round(it.qty * 100) / 100) + (it.unit && it.unit !== 'pc' ? ' ' + it.unit : '') + ' in stock') : null, it.price ? h('div', null, K.price(money(it.price))) : null);
  }
})();
