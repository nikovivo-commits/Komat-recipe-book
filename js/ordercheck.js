/* The order check: one product card at a time. Swipe right = have it, left = out,
   up = running low. A summary at the end takes amounts and sends the order.
   The classic list stays available for anyone who prefers it. */
(function () {
  'use strict';
  const K = window.K, h = K.h, ui = K.ui;

  K.startStock = function (st, closing) {
    const prev = K.orderFor(st), m = {}, extras = [];
    if (prev) prev.items.forEach((i) => { if (i.extra) extras.push({ n: i.n, note: i.note || '' }); else m[i.n.toLowerCase()] = { s: i.s, note: i.note || '' }; });
    ui.stock = { st: st, day: K.day(1), m: m, extras: extras, q: '', close: !!closing, mode: K.store.get('stockMode', 'swipe') === 'list' ? 'list' : 'swipe', idx: 0, hist: [], start: Date.now(), summary: !!prev && !closing };
    K.go('stock');
  };

  /* a product's photo: the book's own file, else where it was generated, else its first letter */
  K.produceThumb = function (name, cls) {
    const P = window.KOMAT_PRODUCE || {}, n = String(name || '').toLowerCase(), slug = P[n] || P[K.ordKey(n)];
    const letter = h('span', { class: (cls || 'pthumb') + ' ph t' + (String(name).charCodeAt(0) % 6), 'aria-hidden': 'true' }, String(name).charAt(0));
    if (!slug) return letter;
    return K.photoWithFallback('assets/photos/produce/' + slug + '.jpg', (window.KOMAT_PRODUCE_SRC || {})[slug], letter, { class: cls || 'pthumb', alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' });
  };
  const count = (S) => Object.keys(S.m).length + S.extras.filter((x) => (x.n || '').trim()).length;
  const clock = (ms) => { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  K.V.stock = function () {
    const S = ui.stock, sl = K.stockList(S.st, S.day), ings = sl.ings;
    const modeSeg = K.seg([['swipe', 'Swipe'], ['list', 'List']], S.mode, (v) => { S.mode = v; K.store.set('stockMode', v); if (v === 'swipe' && S.idx >= ings.length) S.summary = true; K.render(true); }, { 'aria-label': 'Check by', class: 'seg on-dark small-seg' });
    const top = K.subbar(K.ST[S.st], () => K.go('today'), [modeSeg], S.close ? 'Finish mise en place' : 'Order check');
    if (!sl.toMake.length && !S.summary && !S.anyway) return nothingPlanned(S, sl, top);
    if (S.mode === 'list') return listMode(S, sl, top);
    if (S.summary || S.idx >= ings.length) return summary(S, sl, top);
    return deck(S, ings, top, sl);
  };
  /* what the check is for: the things marked DO on tomorrow's prep list */
  const dayWord = (S) => K.prettyDate(S.day, { weekday: 'long' });
  function planLine(sl) {
    const names = sl.toMake.map((it) => it.name);
    return names.slice(0, 3).join(', ') + (names.length > 3 ? ' +' + (names.length - 3) + ' more' : '');
  }
  function nothingPlanned(S, sl, top) {
    const w = h('div', { class: 'wrap page narrow' });
    w.append(K.catRest('Tomorrow’s prep list is empty',
      'Mark DO on what ' + K.ST[S.st] + ' has to make on ' + dayWord(S) + '. The check then asks only about the ingredients for those, like yolks and butter for a hollandaise.',
      h('div', { class: 'btns center' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => { ui.listFor = { v: 'tomorrow', day: K.day(0) }; ui.stock = null; K.go('today'); setTimeout(() => { const el = document.getElementById('t-mep'); if (el) el.scrollIntoView({ block: 'start' }); }, 60); } }, K.icon('list'), 'Open tomorrow’s list'),
        h('button', { class: 'btn', type: 'button', onclick: () => { S.anyway = true; S.summary = !sl.ings.length; K.render(true); } }, sl.ings.length ? 'Check bread and daily products' : 'Order something else'))));
    return { top: top, body: w, tabs: false };
  }

  /* ---------- the card deck ---------- */
  function deck(S, ings, top, sl) {
    const left = ings.length - S.idx, pct = Math.round((S.idx / Math.max(1, ings.length)) * 100);
    const wrap = h('div', { class: 'deck-page' });
    wrap.append(h('div', { class: 'deck-head wrap' },
      h('p', { class: 'deck-q' }, 'Do you have it for ' + dayWord(S) + '?'),
      sl.toMake.length ? h('p', { class: 'deck-for' }, 'For tomorrow’s prep list: ' + planLine(sl)) : null,
      h('div', { class: 'deck-prog', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(ings.length), 'aria-valuenow': String(S.idx) }, h('span', { style: { width: pct + '%' } })),
      h('div', { class: 'deck-meta' }, h('span', { class: 'mono' }, (S.idx + 1) + ' / ' + ings.length), h('span', null, count(S) ? count(S) + ' to order so far' : left + ' to go'))));
    const stack = h('div', { class: 'deck', id: 'deck' });
    for (let i = Math.min(ings.length - 1, S.idx + 2); i >= S.idx; i--) stack.append(card(ings[i], i - S.idx, S));
    wrap.append(stack);
    wrap.append(h('div', { class: 'deck-acts' },
      h('button', { type: 'button', class: 'dbtn out', onclick: () => fling('out') }, K.icon('close'), h('span', null, 'Out')),
      h('button', { type: 'button', class: 'dbtn low', onclick: () => fling('low') }, K.icon('up'), h('span', null, 'Low')),
      h('button', { type: 'button', class: 'dbtn have', onclick: () => fling('have') }, K.icon('check'), h('span', null, 'Have'))));
    wrap.append(h('div', { class: 'deck-foot' },
      h('button', { type: 'button', class: 'link-btn', disabled: !S.hist.length, onclick: undo }, K.icon('back'), 'Undo'),
      h('button', { type: 'button', class: 'link-btn', onclick: () => { S.summary = true; K.render(true); } }, 'Skip to the summary', K.icon('next'))));
    wrap.append(h('p', { class: 'deck-hint' }, 'Swipe right if you have it, left if it’s out, up if it’s running low.'));
    return { top: top, body: wrap, tabs: false, after: () => { const c = document.querySelector('.pcard.front'); if (c) drag(c); } };
  }
  function card(g, depth, S) {
    const k = g.name.toLowerCase(), cur = S.m[k];
    return h('article', { class: 'pcard d' + depth + (depth === 0 ? ' front' : '') + (g.flag ? ' flag-' + g.flag : ''), 'aria-hidden': depth ? 'true' : null, 'aria-label': depth ? null : g.name },
      h('span', { class: 'stamp have' }, 'Have'), h('span', { class: 'stamp out' }, 'Out'), h('span', { class: 'stamp low' }, 'Low'),
      K.produceThumb(g.name, 'pc-mono'),
      h('h2', { class: 'pc-name' }, g.name),
      g.flag === 'red' ? h('p', { class: 'pc-flag red' }, g.usedIn[0]) : g.flag === 'ask' ? h('p', { class: 'pc-flag' }, g.usedIn[0]) : null,
      !g.flag && g.usedIn.length ? h('p', { class: 'pc-used' }, h('span', { class: 'label' }, 'Needed for'), g.usedIn.slice(0, 3).map((u) => h('span', null, u)), g.usedIn.length > 3 ? h('span', null, '+' + (g.usedIn.length - 3) + ' more') : null) : null,
      cur ? h('p', { class: 'pc-prev' }, 'Marked ' + (cur.s === 'out' ? 'out' : 'low') + ' earlier' + (cur.note ? ': ' + cur.note : '')) : null,
      K.me.admin && !g.flag && depth === 0 ? h('button', { type: 'button', class: 'pc-never', onclick: () => neverAsk(g) }, 'Always in stock? Stop asking') : null);
  }
  /* the head chef can take a basic off the check for good (Kitchen rules lists them) */
  function neverAsk(g) {
    const before = (K.kitchen().basics || []).slice();
    K.saveKitchen({ basics: before.concat([g.name]) });
    K.vibrate(10);
    K.toast(g.name + ' won’t be asked again', { tone: 'good', undo: () => K.saveKitchen({ basics: before }) });
  }
  /* follow the finger; let go past the edge to decide */
  function drag(el) {
    let x0 = 0, y0 = 0, dx = 0, dy = 0, pid = null, t0 = 0;
    const stamps = { have: el.querySelector('.stamp.have'), out: el.querySelector('.stamp.out'), low: el.querySelector('.stamp.low') };
    const paint = () => {
      el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(' + dx / 16 + 'deg)';
      const up = -dy > Math.abs(dx);
      stamps.have.style.opacity = !up && dx > 0 ? Math.min(1, dx / 90) : 0;
      stamps.out.style.opacity = !up && dx < 0 ? Math.min(1, -dx / 90) : 0;
      stamps.low.style.opacity = up ? Math.min(1, -dy / 80) : 0;
    };
    el.addEventListener('pointerdown', (e) => {
      if (busy || e.target.closest('button')) return;
      pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = 0; dy = 0; t0 = Date.now();
      try { el.setPointerCapture(pid); } catch (err) { /* not capturable */ }
      el.style.transition = 'none';
      el.classList.add('held');
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId !== pid) return; dx = e.clientX - x0; dy = Math.min(40, e.clientY - y0); if (e.clientY - y0 < 0) dy = e.clientY - y0; paint(); });
    const end = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      el.classList.remove('held');
      const dt = Math.max(1, Date.now() - t0), vx = dx / dt, vy = dy / dt;
      const up = -dy > Math.abs(dx);
      let choice = null;
      if (up && (dy < -90 || (vy < -0.5 && dy < -40))) choice = 'low';
      else if (!up && (dx > 100 || (vx > 0.55 && dx > 40))) choice = 'have';
      else if (!up && (dx < -100 || (vx < -0.55 && dx < -40))) choice = 'out';
      if (choice) { decide(choice, el, dx, dy); return; }
      el.style.transition = 'transform .25s cubic-bezier(.2,1.4,.4,1)';
      dx = 0; dy = 0; paint();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  let busy = false;
  function fling(choice) {
    const el = document.querySelector('.pcard.front');
    if (!el || busy) return;
    const s = el.querySelector('.stamp.' + choice);
    if (s) s.style.opacity = 1;
    decide(choice, el, choice === 'have' ? 1 : choice === 'out' ? -1 : 0, choice === 'low' ? -1 : 0);
  }
  function decide(choice, el, dx, dy) {
    const S = ui.stock, ings = K.stockList(S.st, S.day).ings, g = ings[S.idx];
    if (!g || busy) return;
    busy = true;
    const k = g.name.toLowerCase();
    S.hist.push({ k: k, prev: S.m[k] ? K.clone(S.m[k]) : null });
    if (choice === 'have') delete S.m[k]; else S.m[k] = { s: choice, note: (S.m[k] && S.m[k].note) || '' };
    S.idx++;
    K.vibrate(choice === 'have' ? 8 : choice === 'low' ? [8, 30, 8] : 18);
    const W = innerWidth;
    const tx = choice === 'have' ? W * 1.1 : choice === 'out' ? -W * 1.1 : dx * 2, ty = choice === 'low' ? -innerHeight : dy * 2;
    el.style.transition = 'transform .2s ease-in, opacity .2s ease-in';
    el.style.transform = 'translate(' + tx + 'px,' + ty + 'px) rotate(' + (choice === 'have' ? 18 : choice === 'out' ? -18 : 0) + 'deg)';
    el.style.opacity = '0.6';
    setTimeout(() => {
      busy = false;
      if (S.idx >= ings.length) { S.summary = true; S.took = Date.now() - S.start; }
      K.render(true);
    }, 170);
  }
  function undo() {
    const S = ui.stock, last = S.hist.pop();
    if (!last) return;
    if (last.prev) S.m[last.k] = last.prev; else delete S.m[last.k];
    S.idx = Math.max(0, S.idx - 1);
    S.summary = false;
    K.render(true);
  }
  document.addEventListener('keydown', (e) => {
    const S = ui.stock;
    if (ui.view !== 'stock' || !S || S.mode !== 'swipe' || S.summary || ui.sheet) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) return;
    const map = { ArrowRight: 'have', ArrowLeft: 'out', ArrowUp: 'low' };
    if (map[e.key]) { e.preventDefault(); fling(map[e.key]); }
    else if (e.key === 'Backspace' || e.key === 'z') { e.preventDefault(); undo(); }
  });

  /* ---------- the summary ---------- */
  function summary(S, sl, top) {
    const ings = sl.ings, byKey = {};
    ings.forEach((g) => { byKey[g.name.toLowerCase()] = g; });
    const marked = Object.keys(S.m).map((k) => ({ k: k, g: byKey[k] || { name: k, usedIn: [] }, m: S.m[k] })).sort((a, b) => (a.m.s === b.m.s ? a.g.name.localeCompare(b.g.name) : a.m.s === 'out' ? -1 : 1));
    const outs = marked.filter((x) => x.m.s === 'out').length, lows = marked.length - outs;
    const n = count(S);
    const w = h('div', { class: 'wrap page narrow sum' });
    w.append(h('div', { class: 'sum-head' },
      h('span', { class: 'sum-badge' }, K.icon('check')),
      h('h1', { class: 'rtitle' }, S.idx >= ings.length ? 'All checked' : 'Your order so far'),
      h('p', { class: 'lead' }, n ? n + (n === 1 ? ' thing' : ' things') + ' to order. Everything else is covered.' : 'Fully stocked. Nothing to order.'),
      h('div', { class: 'sum-stats' },
        h('span', { class: 'sstat out' }, h('b', { class: 'mono' }, String(outs)), 'out'),
        h('span', { class: 'sstat low' }, h('b', { class: 'mono' }, String(lows)), 'low'),
        h('span', { class: 'sstat have' }, h('b', { class: 'mono' }, String(Math.max(0, Math.min(S.idx, ings.length) - marked.length))), 'have'),
        S.took && S.idx >= ings.length ? h('span', { class: 'sstat' }, h('b', { class: 'mono' }, clock(S.took)), 'to check') : null)));
    if (sl.toMake.length) w.append(h('p', { class: 'hint sum-for' }, 'Checked for tomorrow’s prep list: ' + planLine(sl) + '.'));
    if (sl.unlinked.length) w.append(h('details', { class: 'unlinked' }, h('summary', null, sl.unlinked.length + (sl.unlinked.length === 1 ? ' item on tomorrow’s list has' : ' items on tomorrow’s list have') + ' no recipe, so check those yourself'),
      h('p', { class: 'hint' }, sl.unlinked.join(', ')), h('p', { class: 'hint' }, 'Link them to a recipe in Edit list and their ingredients join the check.')));
    if (marked.length) {
      w.append(h('div', { class: 'olist card sum-list' }, marked.map((x) => h('div', { class: 'sum-row ' + x.m.s },
        K.produceThumb(x.g.name),
        h('div', { class: 'sum-name' }, h('b', null, x.g.name), x.g.usedIn && x.g.usedIn.length ? h('span', { class: 'muted' }, x.g.usedIn.slice(0, 2).join(', ')) : null),
        K.seg([['low', 'Low'], ['out', 'Out']], x.m.s, (v) => { x.m.s = v; K.render(); }, { 'aria-label': x.g.name, class: 'seg mini-seg' }),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'We have ' + x.g.name + ' after all', title: 'We have it', onclick: () => { delete S.m[x.k]; K.render(); } }, K.icon('close')),
        h('input', { class: 'input small', id: 'sq-' + K.safeId(x.k), placeholder: 'How much? e.g. 2 kg', 'aria-label': 'Amount of ' + x.g.name, enterkeyhint: 'done', value: x.m.note, oninput: (e) => { x.m.note = e.target.value; } })))));
    } else {
      w.append(K.catRest('All stocked up', 'You have everything for ' + dayWord(S) + '’s prep list.' + (S.close ? ' Enjoy the rest of your shift.' : '')));
    }
    w.append(extrasBlock(S));
    w.append(h('div', { class: 'btns center' }, h('button', { type: 'button', class: 'link-btn', onclick: () => { S.idx = 0; S.hist = []; S.summary = false; S.start = Date.now(); S.took = 0; K.render(true); } }, K.icon('back'), 'Check again from the start')));
    return { top: top, body: w, tabs: false, bar: sendBar(S) };
  }
  function extrasBlock(S) {
    return h('section', { class: 'block' }, h('h2', { class: 'block-title' }, 'Something else'),
      h('p', { class: 'hint' }, 'Cleaning products, packaging, anything not in a recipe.'),
      S.extras.map((x, i) => h('div', { class: 'xrow' },
        h('input', { class: 'input', id: 'xn' + i, placeholder: 'Product', 'aria-label': 'Product ' + (i + 1), value: x.n, enterkeyhint: 'next', oninput: (e) => { x.n = e.target.value; } }),
        h('input', { class: 'input', id: 'xq' + i, placeholder: 'How much', 'aria-label': 'Amount ' + (i + 1), value: x.note, enterkeyhint: 'done', oninput: (e) => { x.note = e.target.value; } }),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove ' + (x.n || 'product'), onclick: () => { S.extras.splice(i, 1); K.render(); } }, K.icon('close')))),
      h('button', { class: 'btn', type: 'button', onclick: () => { S.extras.push({ n: '', note: '' }); K.render(); const el = document.getElementById('xn' + (S.extras.length - 1)); if (el) el.focus(); } }, K.icon('plus'), 'Add a product'));
  }
  function sendBar(S) {
    const n = count(S);
    const label = S.close ? 'Confirm and finish' : n ? 'Send order (' + n + ')' : K.orderFor(S.st) ? 'Clear the order' : 'Done, nothing to order';
    return h('button', { class: 'btn primary wide', type: 'button', disabled: ui.busy, onclick: send }, ui.busy ? 'Saving…' : label);
  }

  /* ---------- the classic list ---------- */
  function listMode(S, sl, top) {
    const ings = sl.ings;
    const w = h('div', { class: 'wrap page narrow' });
    w.append(h('h1', { class: 'rtitle' }, 'Do you have it for ' + dayWord(S) + '?'),
      h('p', { class: 'muted' }, sl.toMake.length ? 'The ingredients for tomorrow’s prep list: ' + planLine(sl) + '. Tap Low or Out for what you need.' : 'Bread and the products checked every day.'));
    w.append(h('div', { class: 'search small' }, K.icon('search'), h('input', { class: 'search-in', id: 'stockq', type: 'search', enterkeyhint: 'search', placeholder: 'Find a product', value: S.q, 'aria-label': 'Find a product',
      oninput: (e) => { S.q = e.target.value; const l = document.getElementById('stocklist'); if (l) l.replaceWith(rows(ings)); } })));
    w.append(rows(ings));
    w.append(extrasBlock(S));
    return { top: top, body: w, tabs: false, bar: sendBar(S) };
  }
  function rows(ings) {
    const S = ui.stock, q = S.q.trim().toLowerCase();
    const list = ings.filter((g) => !q || g.name.toLowerCase().includes(q) || K.latin(g.name).includes(q));
    if (!list.length) return h('div', { id: 'stocklist' }, h('p', { class: 'none' }, ings.length ? 'No product matches.' : 'No products in this station’s recipes yet. Use “Something else” below.'));
    return h('div', { id: 'stocklist', class: 'stocklist' }, list.map((g) => {
      const k = g.name.toLowerCase(), cur = S.m[k] || { s: 'ok', note: '' };
      return h('div', { class: 'stock' + (cur.s !== 'ok' ? ' ' + cur.s : '') + (g.flag ? ' flag-' + g.flag : '') },
        h('div', { class: 'stock-name' }, K.produceThumb(g.name), h('span', { class: 'stock-txt' }, h('b', null, g.name), h('span', { class: 'muted' }, g.usedIn.join(', ')))),
        h('div', { class: 'stock-acts', role: 'group', 'aria-label': g.name }, [['ok', 'Have'], ['low', 'Low'], ['out', 'Out']].map((o) =>
          h('button', { type: 'button', class: 'sbtn ' + o[0], 'aria-pressed': cur.s === o[0] ? 'true' : 'false', onclick: () => {
            if (o[0] === 'ok') delete S.m[k]; else S.m[k] = { s: o[0], note: cur.note || '' };
            K.vibrate(8);
            K.render();
          } }, o[1]))),
        cur.s !== 'ok' ? h('input', { class: 'input small', id: 'sq-' + K.safeId(k), placeholder: 'How much? e.g. 2 kg', enterkeyhint: 'done', 'aria-label': 'Amount of ' + g.name, value: cur.note, oninput: (e) => { S.m[k].note = e.target.value; } }) : null);
    }));
  }

  /* ---------- send ---------- */
  function send() {
    const S = ui.stock, st = S.st, byKey = {};
    K.stockList(st, S.day).ings.forEach((g) => { byKey[g.name.toLowerCase()] = g.name; });
    const items = Object.keys(S.m).map((k) => ({ n: byKey[k] || k, s: S.m[k].s, note: (S.m[k].note || '').trim() }))
      .concat(S.extras.filter((x) => (x.n || '').trim()).map((x) => ({ n: x.n.trim(), s: 'out', note: (x.note || '').trim(), extra: true })));
    if (!items.length && !K.orderFor(st) && !S.close) { ui.stock = null; K.go('today'); K.toast('Fully stocked. Nice.', { tone: 'good' }); return; }
    ui.busy = true; K.render();
    K.sendOrder(st, items, S.close).then(() => {
      ui.busy = false; ui.stock = null;
      K.go('today');
      if (S.close) K.flash('lights-off', 4200);
      else if (items.length) K.sentMoment(items, 'Order sent for ' + K.ST[st] + ' · ' + items.length + (items.length === 1 ? ' item' : ' items'));
      if (S.close) K.celebrate('Mise en place finished' + (items.length ? ' · ' + items.length + ' on the order' : '') + '. Thank you!');
      else K.toast(items.length ? 'Order sent for ' + K.ST[st] + '. Thank you!' : 'Order cleared', { tone: 'good' });
    }, (e) => { ui.busy = false; K.render(); K.writeFailed(e); });
  }
})();
