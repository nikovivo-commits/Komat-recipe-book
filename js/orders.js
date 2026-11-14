/* The whiteboard: what the kitchen needs, written by everyone in their own hand, from any page (the marker
   in the header). A line stays until it arrives: written -> ordered -> arrived. The chefs say once which
   supplier sells a product and the board remembers; each supplier gets a ready message for WhatsApp or Viber,
   and a reminder comes before that supplier's order deadline (sent by tools/notify/send.mjs).
   Lines live in boards/{id} with kind 'item'; the suppliers in settings/suppliers. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const key = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const sups = () => (D.suppliers && D.suppliers.list) || [];
  const smap = () => (D.suppliers && D.suppliers.map) || {};
  const supById = (id) => sups().find((s) => s.id === id) || null;
  const active = () => sups().filter((s) => !s.paused);
  /* who sells a product, from what each supplier's "Sells" list says: the longest word found in the line wins
     ("консервирани домати" goes to the tins supplier, plain "домати" to the vegetables) */
  K.wbGuess = function (n) {
    const k = key(n); let best = '', len = 0;
    active().forEach((s) => String(s.sells || '').split(/[,;\n]/).map(key).filter((w) => w.length >= 3).forEach((w) => { if (k.includes(w) && w.length > len) { best = s.id; len = w.length; } }));
    return best;
  };
  K.wbSupOf = (it) => (it.sup && supById(it.sup) ? it.sup : smap()[key(it.n)] && supById(smap()[key(it.n)]) ? smap()[key(it.n)] : K.wbGuess(it.n));
  const lines = (status) => (D.wb || []).filter((i) => i.status === status).sort((a, b) => (a.at || 0) - (b.at || 0));
  K.wbOpen = () => lines('need');
  const first = (id) => (K.nameOf(id) || '').split(' ')[0];
  const photoBtn = () => (K.mode === 'firebase' || K.mode === 'local' ? h('button', { class: 'btn wide wb-photo', type: 'button', disabled: !!ui.wbPhotoBusy, onclick: K.wbPhoto }, K.icon('camera'), ui.wbPhotoBusy ? 'Saving the photo…' : 'Photo of the board or a paper list') : null);

  /* ---------- writing on the board ---------- */
  K.wbAdd = function (n, qty) {
    n = String(n || '').trim(); qty = String(qty || '').trim();
    if (!n) return Promise.resolve();
    const dup = lines('need').find((i) => key(i.n) === key(n));
    if (dup) {
      const q = dup.qty && qty && dup.qty !== qty ? dup.qty + ' + ' + qty : qty || dup.qty || '';
      dup.qty = q; K.refresh(true);
      return K.db.doc('boards/' + dup.id).update({ qty: q, at: Date.now() }).catch(K.writeFailed);
    }
    const id = 'wb' + K.uid(), it = { kind: 'item', n: n, qty: qty, status: 'need', sup: smap()[key(n)] || '', by: K.me.id || '', ink: K.myInk() || 'blue', hand: K.myHand() || 'caveat', st: K.getStation(), at: Date.now() };
    D.wb = (D.wb || []).concat([Object.assign({ id: id }, it)]); K.refresh(true);
    return K.db.doc('boards/' + id).set(it).catch(K.writeFailed);
  };
  const setLine = (it, patch) => { Object.assign(it, patch); K.refresh(true); return K.db.doc('boards/' + it.id).update(patch).catch(K.writeFailed); };
  function wipe(it) {
    const keep = Object.assign({}, it); delete keep.id;
    D.wb = D.wb.filter((x) => x.id !== it.id); K.refresh(true);
    K.db.doc('boards/' + it.id).delete().catch(K.writeFailed);
    K.toast('Wiped: ' + it.n, { undo: () => { D.wb = D.wb.concat([Object.assign({ id: it.id }, keep)]); K.refresh(true); K.db.doc('boards/' + it.id).set(keep).catch(K.writeFailed); } });
  }
  /* the names we have written before, to pick from while writing */
  function suggestions() {
    const seen = {};
    (D.wb || []).forEach((i) => { seen[key(i.n)] = i.n; });
    Object.keys(smap()).forEach((k) => { if (!seen[k]) seen[k] = k; });
    return Object.keys(seen).sort().map((k) => seen[k]);
  }
  function writeForm(S, after) {
    const hand = 'input hand ' + K.inkClass(K.myInk()) + ' ' + K.handClass(K.myHand());
    return h('form', { class: 'wb-form', onsubmit: (e) => {
      e.preventDefault();
      const name = (S.text || '').trim();
      if (!name) { const el = document.getElementById('wb-in'); if (el) el.focus(); return; }
      K.wbAdd(name, S.amt);
      K.vibrate && K.vibrate(10);
      S.text = ''; S.amt = ''; S.last = name;
      if (after) after(name);
      K.render();
      setTimeout(() => { const el = document.getElementById('wb-in'); if (el) el.focus(); }, 30);
    } },
      h('div', { class: 'wb-row' },
        h('input', { class: hand, id: 'wb-in', value: S.text || '', list: 'wb-names', autocomplete: 'off', enterkeyhint: 'next', placeholder: 'What, e.g. лимони', 'aria-label': 'What we need', oninput: (e) => { S.text = e.target.value; } }),
        h('input', { class: hand + ' wb-amt-in', id: 'wb-amt', value: S.amt || '', autocomplete: 'off', enterkeyhint: 'done', placeholder: '2 kg', 'aria-label': 'How much (if you know)', oninput: (e) => { S.amt = e.target.value; } })),
      h('datalist', { id: 'wb-names' }, suggestions().map((n) => h('option', { value: n }))),
      h('button', { class: 'btn primary', type: 'submit' }, K.icon('plus'), 'Write it'));
  }
  /* a photo of the kitchen's whiteboard or a paper list: Claude reads it in the background (tools/notify/send.mjs)
     and writes its lines on this board, in the photographer's hand */
  K.wbPhoto = function () {
    K.pickFile('image/*', false, (files) => {
      if (!files || !files[0]) return;
      ui.wbPhotoBusy = true; K.render();
      K.shrinkImage(files[0], 1600).then((b) => K.assets.upload(b)).then((r) => {
        const id = 'scan' + K.uid(), doc = { kind: 'scan', status: 'pending', photo: r.id, by: K.me.id || '', ink: K.myInk() || 'blue', hand: K.myHand() || 'caveat', st: K.getStation(), at: Date.now(), date: K.day(0) };
        D.wbScans = (D.wbScans || []).concat([Object.assign({ id: id }, doc)]);
        return K.db.doc('boards/' + id).set(doc);
      }).then(() => { ui.wbPhotoBusy = false; K.render(); K.toast('Photo saved. Its lines appear on the board in a few minutes.'); },
        (e) => { ui.wbPhotoBusy = false; K.render(); K.writeFailed(e); });
    });
  };
  function scanCards() {
    const day = Date.now() - 36 * 3600 * 1000;
    const list = (D.wbScans || []).filter((s) => (s.at || 0) > day && !s.hidden).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 3);
    return list.map((s) => {
      const txt = s.status === 'done' ? (s.added ? 'Read: ' + s.added + (s.added === 1 ? ' line' : ' lines') + ' added' + (s.names && s.names.length ? ' (' + s.names.slice(0, 6).join(', ') + (s.names.length > 6 ? '…' : '') + ')' : '') : 'Read it: nothing new to add') + (s.note ? '. ' + s.note : '')
        : s.status === 'failed' ? 'Could not read it' + (s.error ? ': ' + s.error : '') + '. Write the lines by hand.'
          : 'Reading it… the lines appear here in a few minutes.';
      return h('div', { class: 'wb-scan ' + (s.status || 'pending') },
        h('img', { class: 'wb-scan-img', src: K.media(s.photo), alt: 'Photo of the board', loading: 'lazy', onclick: () => K.openPhotos([{ id: s.photo, title: 'Photo of the board' }], 0) }),
        h('span', null, h('b', null, 'Photo · ' + K.hm(s.at) + (first(s.by) ? ' · ' + first(s.by) : '')), h('span', null, txt)),
        s.status === 'pending' ? null : h('button', { type: 'button', class: 'wb-wipe', 'aria-label': 'Hide this photo', onclick: () => { s.hidden = true; K.render(); K.db.doc('boards/' + s.id).update({ hidden: true }).catch(() => {}); } }, K.icon('close')));
    });
  }

  /* the marker in the header: write on the board from any page */
  K.wbQuick = function () { ui.sheet = { type: 'wbadd', f: { text: '', amt: '' } }; K.render(); setTimeout(() => { const el = document.getElementById('wb-in'); if (el) el.focus(); }, 60); };
  K.SHEETS.wbadd = function (S) {
    const open = lines('need');
    return K.sheet('Write on the whiteboard', h('div', { class: 'wb-quick' },
      h('p', { class: 'muted' }, 'Something running low or missing? Write it; the chefs order it.'),
      writeForm(S.f),
      photoBtn(),
      S.f.last ? h('p', { class: 'wb-ok' }, K.icon('check'), 'On the board: ' + S.f.last + '. Anything else?') : null,
      open.length ? h('p', { class: 'muted' }, open.length + (open.length === 1 ? ' thing' : ' things') + ' on the board: ' + open.slice(-6).map((i) => i.n).join(', ') + (open.length > 6 ? '…' : '')) : null,
      h('div', { class: 'btns' }, h('button', { class: 'btn wide', type: 'button', onclick: () => { ui.sheet = null; K.go('orders'); } }, 'See the whole board', K.icon('next')))));
  };

  /* ---------- a supplier's day and deadline ---------- */
  const todayIdx = () => (new Date().getDay() + 6) % 7;
  function when(s) {
    const days = (s.days || []).slice().sort();
    if (!days.length) return s.deadline ? 'Order by ' + s.deadline : '';
    const t = todayIdx(), now = new Date(), [hh, mm] = String(s.deadline || '23:59').split(':').map(Number);
    const open = days.includes(t) && (now.getHours() * 60 + now.getMinutes()) < hh * 60 + (mm || 0);
    if (open) return 'Order by ' + (s.deadline || 'tonight') + ' today';
    for (let k = 1; k <= 7; k++) { const d = (t + k) % 7; if (days.includes(d)) return 'Next order: ' + (k === 1 ? 'tomorrow' : DAYS[d]) + (s.deadline ? ' by ' + s.deadline : ''); }
    return '';
  }
  const urgent = (s) => /today/.test(when(s));

  /* ---------- the message to the supplier ---------- */
  function message(s, list) {
    const d = K.addDays(K.parseYmd(K.day(0)), 1);
    const day = d.toLocaleDateString('bg-BG', { weekday: 'long', day: 'numeric', month: 'numeric' });
    return (s.greeting || 'Здравейте!') + ' Поръчка за Комат за утре (' + day + '):\n' +
      list.map((i) => '• ' + i.n + (i.qty ? ' – ' + i.qty : '')).join('\n') + '\nБлагодаря!';
  }
  const phoneDigits = (p) => { let d = String(p || '').replace(/[^\d+]/g, ''); if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '359' + d.slice(1); return d; };
  K.SHEETS.wbsend = function (S) {
    const s = supById(S.sup), list = lines('need').filter((i) => K.wbSupOf(i) === S.sup);
    if (!s) return null;
    if (S.text == null) S.text = message(s, list);
    const viber = s.app === 'viber';
    const go = () => {
      try { navigator.clipboard.writeText(S.text).catch(() => {}); } catch (e) { /* no clipboard */ }
      /* Viber cannot fill in a message for a chosen chat: with a number it opens that chat (paste the copied message), without one it lets you pick the contact */
      const url = viber ? (s.phone ? 'viber://chat?number=' + encodeURIComponent('+' + phoneDigits(s.phone)) : 'viber://forward?text=' + encodeURIComponent(S.text)) : 'https://wa.me/' + phoneDigits(s.phone) + '?text=' + encodeURIComponent(S.text);
      if (viber) window.location.href = url; else window.open(url, '_blank', 'noopener');
      const at = Date.now(), ids = list.map((i) => i.id);
      list.forEach((i) => setLine(i, { status: 'ordered', orderedAt: at, orderedBy: K.me.id || '', sup: S.sup }));
      ui.sheet = null; K.render();
      K.toast(list.length + (list.length === 1 ? ' line' : ' lines') + ' ordered from ' + s.name, { undo: () => D.wb.filter((i) => ids.includes(i.id)).forEach((i) => setLine(i, { status: 'need', orderedAt: 0 })) });
    };
    return K.sheet('Order from ' + s.name, h('div', { class: 'wb-sendbox' },
      h('p', { class: 'muted' }, (viber ? (s.phone ? 'Viber opens the chat with ' + s.name + ' and the message is copied: hold the text box and tap Paste.' : 'Viber opens to pick ' + s.name + ', with the message.') : 'WhatsApp opens with the message to ' + (s.phone || 'the contact you pick') + '.') + ' Change anything first.'),
      h('textarea', { class: 'input wb-msg', rows: String(Math.min(16, list.length + 4)), 'aria-label': 'Message to ' + s.name, oninput: (e) => { S.text = e.target.value; } }, S.text),
      h('button', { class: 'btn primary wide big', type: 'button', onclick: go }, K.icon('send'), viber ? 'Open Viber' : 'Open WhatsApp'),
      h('button', { class: 'btn wide', type: 'button', onclick: () => { try { navigator.clipboard.writeText(S.text).then(() => K.toast('Copied'), () => K.toast('Select the text and copy it')); } catch (e) { K.toast('Select the text and copy it'); } } }, K.icon('copy'), 'Only copy it')));
  };

  /* ---------- the page ---------- */
  function line(it, opts) {
    const wb = K.inkClass(it.ink) + ' ' + K.handClass(it.hand);
    return h('div', { class: 'oline wb-line ' + wb + (opts.done ? ' wb-ordered' : '') },
      h('span', { class: 'wb-name' }, it.n),
      it.qty ? h('span', { class: 'wb-amt ' + wb }, it.qty) : h('span', { class: 'wb-amt wb-noamt' }, '…'),
      h('span', { class: 'wb-by' }, h('span', { class: 'wb-who' }, it.st && K.ST[it.st] ? K.ST[it.st].split(' ')[0] : '', first(it.by) ? h('span', { class: 'wb-sig ' + wb }, first(it.by)) : null),
        opts.done && it.orderedAt ? h('span', { class: 'wb-when' }, 'ordered ' + K.hm(it.orderedAt)) : null),
      opts.pick ? opts.pick : null,
      opts.done
        ? h('button', { type: 'button', class: 'wb-got', 'aria-label': it.n + ' arrived', title: 'Arrived', onclick: () => setLine(it, { status: 'got', gotAt: Date.now(), date: K.day(0) }) }, K.icon('check'))
        : h('button', { type: 'button', class: 'wb-wipe', 'aria-label': 'Wipe ' + it.n + ' off the board', onclick: () => wipe(it) }, K.icon('close')));
  }
  function supPick(it) {
    if (!K.me.admin || !sups().length) return null;
    const cur = K.wbSupOf(it), opts = sups().filter((s) => !s.paused || s.id === cur);
    return K.select([['', cur ? 'Move to…' : 'Who sells it?']].concat(opts.map((s) => [s.id, s.name])), cur, (v) => {
      setLine(it, { sup: v });
      if (v) { const next = { list: sups(), map: Object.assign({}, smap(), { [key(it.n)]: v }) }; D.suppliers = next; K.db.doc('settings/suppliers').set(next).catch(K.writeFailed); }
    }, { 'aria-label': 'Supplier for ' + it.n, class: 'input small wb-pick' + (cur ? ' compact' : '') });
  }

  K.V.orders = function () {
    const need = lines('need'), out = lines('ordered');
    const body = h('div', { class: 'page' });
    body.append(K.pageHead('Whiteboard', need.length ? need.length + ' to order' + (out.length ? ' · ' + out.length + ' on the way' : '') : out.length ? out.length + ' on the way' : 'What the kitchen needs',
      K.me.admin ? h('button', { class: 'btn light', type: 'button', onclick: () => { ui.sheet = { type: 'suppliers' }; K.render(); } }, K.icon('chef'), 'Suppliers') : null, 'orders'));
    const w = h('div', { class: 'wrap orders wbx' });
    body.append(w);
    ui.wbForm = ui.wbForm || { text: '', amt: '' };
    w.append(h('section', { class: 'block wboard' }, writeForm(ui.wbForm), photoBtn()));
    const sc = scanCards(); if (sc.length) w.append(h('div', { class: 'wb-scans' }, sc));

    /* to order, by supplier; the ones we cannot place yet last */
    const groups = {};
    need.forEach((i) => { const s = K.wbSupOf(i); (groups[s] = groups[s] || []).push(i); });
    const order = sups().filter((s) => groups[s.id]).sort((a, b) => (urgent(b) ? 1 : 0) - (urgent(a) ? 1 : 0));
    order.forEach((s) => {
      const list = groups[s.id];
      w.append(h('section', { class: 'block card wb-sup' + (urgent(s) ? ' due' : '') },
        h('div', { class: 'wb-sup-head' }, h('div', null, h('h2', { class: 'block-title' }, s.name), when(s) ? h('span', { class: 'wb-due' }, when(s)) : null),
          K.me.admin ? h('button', { class: 'btn small primary', type: 'button', onclick: () => { ui.sheet = { type: 'wbsend', sup: s.id }; K.render(); } }, K.icon('send'), s.app === 'viber' ? 'Viber' : 'WhatsApp') : null),
        s.sells ? h('p', { class: 'wb-sells' }, s.sells) : null,
        h('div', { class: 'wboard' }, list.map((i) => line(i, { pick: supPick(i) })))));
    });
    if (groups['']) {
      w.append(h('section', { class: 'block card wb-sup none' },
        h('div', { class: 'wb-sup-head' }, h('div', null, h('h2', { class: 'block-title' }, sups().length ? 'Who sells it?' : 'On the board'),
          h('span', { class: 'wb-due' }, K.me.admin ? (sups().length ? 'Pick the supplier once; the board remembers it' : 'Add your suppliers to send ready messages') : 'The chefs order these'))),
        h('div', { class: 'wboard' }, groups[''].map((i) => line(i, { pick: supPick(i) }))),
        K.me.admin && !sups().length ? h('button', { class: 'btn', type: 'button', onclick: () => { ui.sheet = { type: 'suppliers' }; K.render(); } }, K.icon('plus'), 'Add a supplier') : null));
    }
    if (!need.length) w.append(h('p', { class: 'none wb-empty' }, 'The board is clean. Write what runs low the moment you see it, from any page: the marker at the top.'));

    /* ordered, waiting for the delivery */
    if (out.length) {
      const og = {};
      out.forEach((i) => { const s = i.sup || ''; (og[s] = og[s] || []).push(i); });
      w.append(h('h2', { class: 'sec-title wb-way' }, 'On the way'));
      Object.keys(og).forEach((sid) => {
        const s = supById(sid), list = og[sid];
        w.append(h('section', { class: 'block card wb-sup way' },
          h('div', { class: 'wb-sup-head' }, h('h2', { class: 'block-title' }, s ? s.name : 'Ordered'),
            h('button', { class: 'btn small', type: 'button', onclick: () => list.forEach((i) => setLine(i, { status: 'got', gotAt: Date.now(), date: K.day(0) })) }, K.icon('check'), 'All arrived')),
          h('div', { class: 'wboard' }, list.map((i) => line(i, { done: true }))),
          h('p', { class: 'hint' }, 'Tick each line as it arrives. Not delivered? Wipe the tick by writing it on the board again.')));
      });
    }
    return { body: body };
  };

  /* ---------- the chefs' list of suppliers ---------- */
  K.SHEETS.suppliers = function (S) {
    S.list = S.list || K.clone(sups());
    const save = () => {
      const list = S.list.filter((s) => (s.name || '').trim()).map((s) => ({ id: s.id, name: s.name.trim(), app: s.app === 'viber' ? 'viber' : 'whatsapp', phone: (s.phone || '').trim(), days: (s.days || []).slice().sort(), deadline: (s.deadline || '').trim(), greeting: (s.greeting || '').trim(), sells: (s.sells || '').trim(), paused: !!s.paused }));
      const ids = list.map((s) => s.id), map = {};
      Object.keys(smap()).forEach((k) => { if (ids.includes(smap()[k])) map[k] = smap()[k]; });
      D.suppliers = { list: list, map: map }; ui.sheet = null; K.render();
      K.db.doc('settings/suppliers').set(D.suppliers).then(() => K.toast('Suppliers saved'), K.writeFailed);
    };
    const products = (id) => Object.keys(smap()).filter((k) => smap()[k] === id);
    return K.sheet('Suppliers', h('div', { class: 'wb-sups' },
      h('p', { class: 'muted' }, 'Who you order from, how, and by when. A reminder goes to the chefs an hour before the deadline on order days if something is still on the board.'),
      S.list.map((s, i) => h('div', { class: 'card wb-supedit' },
        K.field('Name', h('input', { class: 'input', value: s.name || '', placeholder: 'e.g. Fish – Ivan', oninput: (e) => { s.name = e.target.value; } })),
        h('div', { class: 'two' },
          K.field('Send by', K.seg([['whatsapp', 'WhatsApp'], ['viber', 'Viber']], s.app === 'viber' ? 'viber' : 'whatsapp', (v) => { s.app = v; K.render(); }, { 'aria-label': 'Send by', class: 'seg small-seg' })),
          K.field('Phone', h('input', { class: 'input mono', value: s.phone || '', inputmode: 'tel', placeholder: '0888 123 456', oninput: (e) => { s.phone = e.target.value; } }))),
        h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Order days'),
          h('div', { class: 'rp-days' }, DAYS.map((d, j) => h('button', { type: 'button', class: 'chip', 'aria-pressed': (s.days || []).includes(j) ? 'true' : 'false', onclick: () => { const l = (s.days || []).slice(), k = l.indexOf(j); if (k >= 0) l.splice(k, 1); else l.push(j); s.days = l; K.render(); } }, d)))),
        h('div', { class: 'two' },
          K.field('Order by', h('input', { class: 'input mono', type: 'time', value: s.deadline || '', oninput: (e) => { s.deadline = e.target.value; } })),
          K.field('Message starts', h('input', { class: 'input', value: s.greeting || '', placeholder: 'Здравейте!', oninput: (e) => { s.greeting = e.target.value; } }))),
        K.field('Sells', h('textarea', { class: 'input', rows: '2', placeholder: 'e.g. смръчкули, шийтаке, лъвска грива', oninput: (e) => { s.sells = e.target.value; } }, s.sells || ''), 'Products, separated by commas. Lines that mention one go to this supplier.'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!s.paused, onchange: (e) => { s.paused = e.target.checked; } }), h('span', null, 'Not ordering from them now')),
        products(s.id).length ? h('p', { class: 'muted' }, 'Also picked by hand: ' + products(s.id).join(', ')) : null,
        h('button', { class: 'btn small danger', type: 'button', onclick: () => { if (!s.del) { s.del = true; K.render(); return; } S.list.splice(i, 1); K.render(); } }, s.del ? 'Tap again to remove' : 'Remove'))),
      h('button', { class: 'btn wide', type: 'button', onclick: () => { S.list.push({ id: 's' + K.uid(), name: '', app: 'whatsapp', phone: '', days: [], deadline: '' }); K.render(); } }, K.icon('plus'), 'Add a supplier'),
      h('button', { class: 'btn primary wide', type: 'button', onclick: save }, 'Save')), { wide: true });
  };
})();
