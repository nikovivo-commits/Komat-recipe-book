/* The order check: the ingredients for tomorrow’s prep list, each with a quantity and a basket button.
   The list at the bottom takes anything else, and one button sends the order. */
(function () {
  'use strict';
  const K = window.K, h = K.h, ui = K.ui;

  K.startStock = function (st, closing) {
    const prev = K.orderFor(st), m = {}, extras = [];
    if (prev) prev.items.forEach((i) => { if (i.extra) extras.push({ n: i.n, note: i.note || '' }); else m[i.n.toLowerCase()] = { s: i.s, note: i.note || '' }; });
    ui.stock = { st: st, day: K.sday(st, 1), m: m, extras: extras, q: '', close: !!closing, start: Date.now(), anyway: !!prev && !closing, base: prev ? prev.items.slice() : [] };
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

  K.V.stock = function () {
    const S = ui.stock, sl = K.stockList(S.st, S.day);
    const top = K.subbar(K.ST[S.st], () => K.go('today'), [], S.close ? 'Finish mise en place' : 'Order check');
    if (!sl.toMake.length && !S.anyway) return nothingPlanned(S, sl, top);
    return listMode(S, sl, top);
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
        h('button', { class: 'btn primary', type: 'button', onclick: () => { ui.listFor = { v: 'tomorrow', day: K.day(0) }; ui.todayTab = 'tmr'; ui.stock = null; K.go('today'); setTimeout(() => { const el = document.getElementById('t-plan'); if (el) el.scrollIntoView({ block: 'start' }); }, 60); } }, K.icon('list'), 'Open tomorrow’s list'),
        h('button', { class: 'btn', type: 'button', onclick: () => { S.anyway = true; K.render(true); } }, sl.ings.length ? 'Check bread and daily products' : 'Order something else'))));
    return { top: top, body: w, tabs: false };
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
      h('p', { class: 'muted' }, sl.toMake.length ? 'The ingredients for tomorrow’s prep list: ' + planLine(sl) + '. Write how much you need and tap the basket.' : 'Bread and the products checked every day.'));
    w.append(h('div', { class: 'search small' }, K.icon('search'), h('input', { class: 'search-in', id: 'stockq', type: 'search', enterkeyhint: 'search', placeholder: 'Find a product', value: S.q, 'aria-label': 'Find a product',
      oninput: (e) => { S.q = e.target.value; const l = document.getElementById('stocklist'); if (l) l.replaceWith(rows(ings)); } })));
    if (sl.unlinked.length) w.append(h('details', { class: 'unlinked' }, h('summary', null, sl.unlinked.length + (sl.unlinked.length === 1 ? ' item on tomorrow’s list has' : ' items on tomorrow’s list have') + ' no recipe, so check those yourself'),
      h('p', { class: 'hint' }, sl.unlinked.join(', ')), h('p', { class: 'hint' }, 'Link them to a recipe in Edit list and their ingredients join the check.')));
    w.append(rows(ings));
    const bk = basket(S, ings);
    if (bk) w.append(bk);
    w.append(extrasBlock(S));
    return { top: top, body: w, tabs: false, bar: sendBar(S) };
  }
  /* the unit a product is ordered in: grams are bought by the kilo, millilitres by the litre */
  const UNITS = ['kg', 'g', 'L', 'pcs', 'box', 'bunch'];
  const BUY = { g: 'kg', kg: 'kg', ml: 'L', l: 'L', pcs: 'pcs', bunch: 'bunch', tin: 'tin', 'пакет': 'пакет' };
  const unitOf = (S, k, g) => (S.unit && S.unit[k]) || BUY[String(g.u || '').toLowerCase()] || 'pcs';
  function rows(ings) {
    const S = ui.stock, q = S.q.trim().toLowerCase();
    S.unit = S.unit || {};
    const open = ings.filter((g) => !S.m[g.name.toLowerCase()]);
    const list = open.filter((g) => !q || g.name.toLowerCase().includes(q) || K.latin(g.name).includes(q));
    if (!list.length) return h('div', { id: 'stocklist' }, h('p', { class: 'none' }, !ings.length ? 'No products in this station’s recipes yet. Use “Something else” below.' : open.length ? 'No product matches.' : 'Everything is in the basket or covered.'));
    return h('div', { id: 'stocklist', class: 'stocklist' }, list.map((g) => {
      const k = g.name.toLowerCase(), id = 'bq' + ings.indexOf(g);
      const add = (e) => {
        const row = e.target.closest('.stock'), inp = row && row.querySelector('input');
        const v = inp ? inp.value.trim().replace(',', '.') : '';
        S.m[k] = { s: 'out', note: v ? v + ' ' + unitOf(S, k, g) : '' };
        K.vibrate(12);
        toBasket(row, () => K.render());
      };
      return h('div', { class: 'stock buy' + (g.flag ? ' flag-' + g.flag : '') },
        h('div', { class: 'stock-name' }, K.produceThumb(g.name), h('span', { class: 'stock-txt' }, h('b', null, g.name), h('span', { class: 'muted' }, g.usedIn.join(', ')))),
        h('div', { class: 'buy-acts' },
          h('span', { class: 'buy-qty' },
            h('input', { class: 'buy-in', id: id, type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '0', enterkeyhint: 'done', 'aria-label': 'How much ' + g.name,
              onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); add(e); } } }),
            h('button', { type: 'button', class: 'buy-unit', title: 'Change the unit', 'aria-label': 'Unit for ' + g.name + ': ' + unitOf(S, k, g) + '. Tap to change',
              onclick: (e) => { const u = unitOf(S, k, g), l = UNITS.includes(u) ? UNITS : [u].concat(UNITS); S.unit[k] = l[(l.indexOf(u) + 1) % l.length]; e.currentTarget.textContent = S.unit[k]; e.currentTarget.setAttribute('aria-label', 'Unit for ' + g.name + ': ' + S.unit[k] + '. Tap to change'); } }, unitOf(S, k, g))),
          h('button', { type: 'button', class: 'buy-go', 'aria-label': 'Add ' + g.name + ' to the order', title: 'Add to the order', onclick: add }, K.icon('order'))));
    }));
  }
  /* the product's photo flies down into the order button while its row folds away */
  function toBasket(row, done) {
    if (!row || K.reducedMotion() || !row.animate) { done(); return; }
    const pic = row.querySelector('.stock-name > *'), bar = document.querySelector('.btn.primary.wide');
    if (pic && bar) {
      const a = pic.getBoundingClientRect(), b = bar.getBoundingClientRect(), fly = pic.cloneNode(true);
      Object.assign(fly.style, { position: 'fixed', left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', margin: 0, zIndex: 60, pointerEvents: 'none', borderRadius: '12px' });
      document.body.append(fly);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      fly.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - 60) + 'px) scale(.8)', opacity: 1, offset: .55 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.25)', opacity: .2 }],
        { duration: 520, easing: 'cubic-bezier(.3,.6,.4,1)' }).onfinish = () => { fly.remove(); bar.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'ease-out' }); };
    }
    const h0 = row.offsetHeight;
    row.style.overflow = 'hidden';
    row.animate([{ height: h0 + 'px', opacity: 1, transform: 'translateX(0)' }, { height: h0 + 'px', opacity: 0, transform: 'translateX(18%)', offset: .45 }, { height: '0px', opacity: 0, transform: 'translateX(18%)', paddingTop: '0px', paddingBottom: '0px', borderBottomWidth: '0px' }],
      { duration: 420, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => setTimeout(done, 120);
  }
  function basket(S, ings) {
    const byKey = {};
    ings.forEach((g) => { byKey[g.name.toLowerCase()] = g.name; });
    const ks = Object.keys(S.m);
    if (!ks.length) return null;
    return h('section', { class: 'block basket' },
      h('h2', { class: 'block-title' }, K.icon('order'), 'In the order (' + ks.length + ')'),
      h('div', { class: 'basket-list' }, ks.map((k) => h('div', { class: 'basket-row' },
        K.produceThumb(byKey[k] || k),
        h('b', null, byKey[k] || k),
        h('span', { class: 'mono muted' }, S.m[k].note || (S.m[k].s === 'low' ? 'running low' : 'out')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Take ' + (byKey[k] || k) + ' out of the order', title: 'Take it out', onclick: () => { delete S.m[k]; K.render(); } }, K.icon('close'))))));
  }

  /* ---------- send ---------- */
  function send() {
    const S = ui.stock, st = S.st, byKey = {};
    K.stockList(st, S.day).ings.forEach((g) => { byKey[g.name.toLowerCase()] = g.name; });
    const items = Object.keys(S.m).map((k) => ({ n: byKey[k] || k, s: S.m[k].s, note: (S.m[k].note || '').trim() }))
      .concat(S.extras.filter((x) => (x.n || '').trim()).map((x) => ({ n: x.n.trim(), s: 'out', note: (x.note || '').trim(), extra: true })));
    /* each line keeps the hand it was written in: unchanged lines stay with whoever wrote them */
    const prev = {};
    ((K.orderFor(st) || {}).items || []).forEach((i) => { prev[i.n.toLowerCase()] = i; });
    items.forEach((i) => {
      const p = prev[i.n.toLowerCase()];
      if (p && p.s === i.s && (p.note || '') === i.note && p.by !== undefined) { i.by = p.by; i.ink = p.ink; i.hand = p.hand; if (p.late) i.late = true; if (p.at) i.at = p.at; }
      else { i.by = K.me.id || ''; i.ink = K.myInk() || 'blue'; i.hand = K.myHand() || 'caveat'; i.at = Date.now(); if (K.orderPhase() === 'late') i.late = true; }
    });
    if (!items.length && !K.orderFor(st) && !S.close) { ui.stock = null; K.go('today'); K.toast('Fully stocked. Nice.', { tone: 'good' }); return; }
    ui.busy = true; K.render();
    const was = K.sday(st);
    K.sendOrder(st, items, S.close, S.base).then(() => {
      ui.busy = false; ui.stock = null;
      K.go('today');
      if (S.close) { ui.todayTab = 'today'; K.tossSheet(() => K.flash('lights-off', 4200), was); }
      else if (items.length) K.sentMoment(items, 'Order sent for ' + K.ST[st] + ' · ' + items.length + (items.length === 1 ? ' item' : ' items'));
      if (S.close) K.celebrate('Mise en place finished' + (items.length ? ' · ' + items.length + ' on the order' : '') + '. Thank you!');
      else K.toast(items.length ? 'Order sent for ' + K.ST[st] + '. Thank you!' : 'Order cleared', { tone: 'good' });
    }, (e) => { ui.busy = false; K.render(); K.writeFailed(e); });
  }
})();
