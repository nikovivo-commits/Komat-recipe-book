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
  function writeForm(S, after, withPhoto) {
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
        h('input', { class: 'input', id: 'wb-in', value: S.text || '', list: 'wb-names', autocomplete: 'off', enterkeyhint: 'next', placeholder: 'What, e.g. лимони', 'aria-label': 'What we need', oninput: (e) => { S.text = e.target.value; } }),
        h('input', { class: 'input wb-amt-in', id: 'wb-amt', value: S.amt || '', autocomplete: 'off', enterkeyhint: 'done', placeholder: '2 kg', 'aria-label': 'How much (if you know)', oninput: (e) => { S.amt = e.target.value; } }),
        h('button', { class: 'btn primary wb-add', type: 'submit', 'aria-label': 'Write it on the board' }, K.icon('plus')),
        withPhoto && (K.mode === 'firebase' || K.mode === 'local') ? h('button', { class: 'btn wb-cam', type: 'button', disabled: !!ui.wbPhotoBusy, 'aria-label': 'Photo of the board or a paper list', title: 'Photo of the board or a paper list', onclick: K.wbPhoto }, K.icon('camera')) : null),
      h('datalist', { id: 'wb-names' }, suggestions().map((n) => h('option', { value: n }))));
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
      writeForm(S.f, null, true),
      S.f.last ? h('p', { class: 'wb-ok' }, K.icon('check'), 'On the board: ' + S.f.last + '. Anything else?') : null,
      open.length ? h('p', { class: 'muted' }, open.length + (open.length === 1 ? ' thing' : ' things') + ' on the board: ' + open.slice(-6).map((i) => i.n).join(', ') + (open.length > 6 ? '…' : '')) : null,
      h('div', { class: 'btns' }, h('button', { class: 'btn wide', type: 'button', onclick: () => { ui.sheet = null; K.go('orders'); } }, 'See the whole board', K.icon('next')))));
  };

  /* ---------- a supplier's day and deadline ---------- */
  const todayIdx = () => (new Date().getDay() + 6) % 7;
  /* a deadline in minutes from midnight; 00:00 means midnight at the end of the day */
  const dlMin = (t) => { const [hh, mm] = String(t || '23:59').split(':').map(Number); const m = (hh || 0) * 60 + (mm || 0); return m === 0 ? 1440 : m; };
  const dlText = (t) => (t === '00:00' ? 'midnight' : t);
  function when(s) {
    const days = (s.days || []).slice().sort();
    if (!days.length) return s.deadline ? 'Order by ' + dlText(s.deadline) : '';
    const t = todayIdx(), now = new Date();
    const open = days.includes(t) && (now.getHours() * 60 + now.getMinutes()) < dlMin(s.deadline);
    if (open) return s.deadline ? 'Order by ' + dlText(s.deadline) + ' today' : 'Order today';
    for (let k = 1; k <= 7; k++) { const d = (t + k) % 7; if (days.includes(d)) return 'Next order: ' + (k === 1 ? 'tomorrow' : DAYS[d]) + (s.deadline ? ' by ' + dlText(s.deadline) : ''); }
    return '';
  }
  const urgent = (s) => /today/.test(when(s));
  /* can we order from them today: an order day (or no days set) and before the deadline */
  const openToday = (s) => {
    if ((s.days || []).length && !s.days.includes(todayIdx())) return false;
    if (!s.deadline) return true;
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes() < dlMin(s.deadline);
  };
  const sentToday = (s) => (D.wbSent || []).some((x) => x.sup === s.id && x.date === K.day(0));
  const lastSent = (s) => (D.wbSent || []).filter((x) => x.sup === s.id && x.date === K.day(0)).sort((a, b) => b.at - a.at)[0];
  const usual = (s) => String(s.usual || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const usualDue = (s) => !s.paused && usual(s).length && openToday(s) && !sentToday(s);
  /* a supplier kept on top shows on its order days even before anything is written for it (bread) */
  const pinnedDue = (s) => !s.paused && s.top && (s.days || []).length && openToday(s) && !sentToday(s);
  /* what each supplier brings: the colour of their card and the photo behind its name */
  const THEMES = {
    greens: ['Greens', '#2E7A4E', 'greens'], bread: ['Bread', '#A86F32', 'bread'], veg: ['Vegetables & fruit', '#4F7D2A', 'veg'],
    meat: ['Meat', '#9B2C24', 'meat'], charcuterie: ['Charcuterie & cheese', '#7E3F33', 'charcuterie'], mushrooms: ['Mushrooms', '#65503C', 'mushrooms'],
    dairy: ['Dairy', '#A07E14', 'dairy'], pantry: ['Oil & pantry', '#5E6B22', 'pantry'], pastry: ['Pastry & stabilisers', '#5D4F86', 'pastry'], other: ['Other', '#3A3B3A', ''],
  };
  K.WB_THEMES = THEMES;
  const theme = (s) => THEMES[s.kind] || THEMES.other;

  /* ---------- the message to the supplier ---------- */
  function message(s, list, withUsual) {
    /* the way the kitchen writes it: "Здравейте, за утре" and then one line each, amount first ("2бр латинка") */
    const rows = (withUsual ? usual(s) : []).concat(list.map((i) => (i.qty ? i.qty + ' ' : '') + i.n));
    if (s.app === 'shop') return rows.join('\n'); /* a shop (Metro): just the list to take along */
    return (s.greeting || 'Здравейте, за утре') + '\n' + rows.join('\n');
  }
  const phoneDigits = (p) => { let d = String(p || '').replace(/[^\d+]/g, ''); if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '359' + d.slice(1); return d; };
  K.SHEETS.wbsend = function (S) {
    const s = supById(S.sup), list = lines('need').filter((i) => K.wbSupOf(i) === S.sup);
    if (!s) return null;
    if (S.withUsual == null) S.withUsual = !!usualDue(s);
    if (S.text == null) S.text = message(s, list, S.withUsual);
    const viber = s.app === 'viber', shop = s.app === 'shop';
    const go = () => {
      try { navigator.clipboard.writeText(S.text).catch(() => {}); } catch (e) { /* no clipboard */ }
      /* Viber cannot fill in a message for a chosen chat: with a number it opens that chat (paste the copied message), without one it lets you pick the contact */
      const url = viber ? (s.phone ? 'viber://chat?number=' + encodeURIComponent('+' + phoneDigits(s.phone)) : 'viber://forward?text=' + encodeURIComponent(S.text)) : 'https://wa.me/' + phoneDigits(s.phone) + '?text=' + encodeURIComponent(S.text);
      if (shop) { if (s.link) window.open(s.link, '_blank', 'noopener'); /* the website to order on (Metro); the list is copied to paste or follow */ } else if (viber) window.location.href = url; else window.open(url, '_blank', 'noopener');
      const at = Date.now(), ids = list.map((i) => i.id);
      list.forEach((i) => setLine(i, { status: 'ordered', orderedAt: at, orderedBy: K.me.id || '', sup: S.sup }));
      /* remember it went today, so the usual order does not ask again */
      const sid = 'sent' + K.uid(), sent = { kind: 'sent', sup: S.sup, date: K.day(0), at: at, by: K.me.id || '', text: S.text };
      D.wbSent = (D.wbSent || []).concat([Object.assign({ id: sid }, sent)]);
      K.db.doc('boards/' + sid).set(sent).catch(K.writeFailed);
      ui.sheet = null; K.render();
      K.toast('Ordered from ' + s.name, { undo: () => { D.wb.filter((i) => ids.includes(i.id)).forEach((i) => setLine(i, { status: 'need', orderedAt: 0 })); D.wbSent = D.wbSent.filter((x) => x.id !== sid); K.db.doc('boards/' + sid).delete().catch(() => {}); K.render(); } });
    };
    if (shop) {
      return K.sheet('Shopping list · ' + s.name, h('div', { class: 'wb-sendbox' },
        h('p', { class: 'muted' }, (s.link ? 'The list is copied and ' + s.name + '’s website opens to order the delivery.' : 'Copy it for whoever goes to ' + s.name + '.') + ' The lines move to On the way; tick them when they arrive.'),
        h('textarea', { class: 'input wb-msg', rows: String(Math.min(16, list.length + 2)), 'aria-label': 'Shopping list', oninput: (e) => { S.text = e.target.value; } }, S.text),
        h('button', { class: 'btn primary wide big', type: 'button', onclick: go }, K.icon(s.link ? 'link' : 'copy'), s.link ? 'Copy the list and open the website' : 'Copy the list')));
    }
    return K.sheet('Order from ' + s.name, h('div', { class: 'wb-sendbox' },
      h('p', { class: 'muted' }, (viber ? (s.phone ? 'Viber opens the chat with ' + s.name + ' and the message is copied: hold the text box and tap Paste.' : 'Viber opens to pick ' + s.name + ', with the message.') : 'WhatsApp opens with the message to ' + (s.phone || 'the contact you pick') + '.') + ' Change anything first.'),
      h('textarea', { class: 'input wb-msg', rows: String(Math.min(16, list.length + 4)), 'aria-label': 'Message to ' + s.name, oninput: (e) => { S.text = e.target.value; } }, S.text),
      h('button', { class: 'btn primary wide big', type: 'button', onclick: go }, K.icon('send'), viber ? 'Open Viber' : 'Open WhatsApp'),
      h('button', { class: 'btn wide', type: 'button', onclick: () => { try { navigator.clipboard.writeText(S.text).then(() => K.toast('Copied'), () => K.toast('Select the text and copy it')); } catch (e) { K.toast('Select the text and copy it'); } } }, K.icon('copy'), 'Only copy it')));
  };

  /* ---------- the page ---------- */
  /* one line: what, how much, who wrote it; the chefs tap it to change the amount or the supplier */
  function line(it, opts) {
    const who = opts.done && it.orderedAt ? 'ordered ' + K.hm(it.orderedAt) : [it.st && K.ST[it.st] ? K.ST[it.st].split(' ')[0] : '', first(it.by), it.via === 'photo' ? 'photo' : ''].filter(Boolean).join(' · ');
    const main = [h('span', { class: 'wbr-n' }, it.n), it.qty ? h('span', { class: 'wbr-q' }, it.qty) : null, who ? h('span', { class: 'wbr-who' }, who) : null];
    return h('div', { class: 'wbr' + (opts.done ? ' done' : '') },
      K.me.admin && !opts.done ? h('button', { type: 'button', class: 'wbr-main', 'aria-label': 'Change ' + it.n, onclick: () => { ui.sheet = { type: 'wbline', id: it.id, n: it.n, qty: it.qty || '', sup: K.wbSupOf(it) }; K.render(); } }, main) : h('span', { class: 'wbr-main' }, main),
      opts.pick || null,
      opts.done
        ? h('button', { type: 'button', class: 'wbr-btn got', 'aria-label': it.n + ' arrived', title: 'Arrived', onclick: () => setLine(it, { status: 'got', gotAt: Date.now(), date: K.day(0) }) }, K.icon('check'))
        : h('button', { type: 'button', class: 'wbr-btn', 'aria-label': 'Wipe ' + it.n + ' off the board', onclick: () => wipe(it) }, K.icon('close')));
  }
  K.SHEETS.wbline = function (S) {
    const it = (D.wb || []).find((x) => x.id === S.id);
    if (!it) return null;
    const save = () => {
      const n = (S.n || '').trim(); if (!n) return;
      setLine(it, { n: n, qty: (S.qty || '').trim(), sup: S.sup || '' });
      if (S.sup) { const next = { list: sups(), map: Object.assign({}, smap(), { [key(n)]: S.sup }) }; D.suppliers = next; K.db.doc('settings/suppliers').set(next).catch(K.writeFailed); }
      ui.sheet = null; K.render();
    };
    const opts = sups().filter((x) => !x.paused || x.id === S.sup);
    return K.sheet(it.n, h('div', { class: 'wb-sendbox' },
      h('div', { class: 'two' },
        K.field('What', h('input', { class: 'input', value: S.n, oninput: (e) => { S.n = e.target.value; } })),
        K.field('How much', h('input', { class: 'input', value: S.qty, placeholder: '2 kg', oninput: (e) => { S.qty = e.target.value; } }))),
      K.field('Supplier', K.select([['', 'Nobody yet']].concat(opts.map((x) => [x.id, x.name])), S.sup || '', (v) => { S.sup = v; }, { 'aria-label': 'Supplier', class: 'input' }), 'The board remembers it for next time.'),
      h('button', { class: 'btn primary wide', type: 'button', onclick: save }, 'Save'),
      h('button', { class: 'btn wide danger', type: 'button', onclick: () => { ui.sheet = null; wipe(it); } }, K.icon('close'), 'Wipe it off')));
  };
  function supPick(it) {
    if (!K.me.admin || !sups().length) return null;
    const cur = K.wbSupOf(it), opts = sups().filter((s) => !s.paused || s.id === cur);
    return K.select([['', cur ? 'Move to…' : 'Who sells it?']].concat(opts.map((s) => [s.id, s.name])), cur, (v) => {
      setLine(it, { sup: v });
      if (v) { const next = { list: sups(), map: Object.assign({}, smap(), { [key(it.n)]: v }) }; D.suppliers = next; K.db.doc('settings/suppliers').set(next).catch(K.writeFailed); }
    }, { 'aria-label': 'Supplier for ' + it.n, class: 'input small wbr-pick' });
  }

  K.V.orders = function () {
    const need = lines('need'), out = lines('ordered');
    const body = h('div', { class: 'page' });
    body.append(K.pageHead('Whiteboard', need.length ? need.length + ' to order' + (out.length ? ' · ' + out.length + ' on the way' : '') : out.length ? out.length + ' on the way' : 'What the kitchen needs',
      K.me.admin ? h('button', { class: 'btn light', type: 'button', onclick: () => { ui.sheet = { type: 'suppliers' }; K.render(); } }, K.icon('chef'), 'Suppliers') : null, 'orders'));
    const w = h('div', { class: 'wrap orders wbx' });
    body.append(w);
    ui.wbForm = ui.wbForm || { text: '', amt: '' };
    w.append(h('section', { class: 'wb-write' }, writeForm(ui.wbForm, null, true), ui.wbPhotoBusy ? h('p', { class: 'muted' }, 'Saving the photo…') : null));
    const sc = scanCards(); if (sc.length) w.append(h('div', { class: 'wb-scans' }, sc));

    /* to order, by supplier; the ones we cannot place yet last */
    const groups = {};
    need.forEach((i) => { const s = K.wbSupOf(i); (groups[s] = groups[s] || []).push(i); });
    /* suppliers with lines, and the ones whose usual order is due today; pinned and due first */
    const rank = (s) => (sentToday(s) && !groups[s.id] ? 9 : (usualDue(s) || pinnedDue(s)) && s.top ? 0 : usualDue(s) || (groups[s.id] && openToday(s) && (s.days || []).length) ? 1 : groups[s.id] ? 2 : 3);
    /* sent today: the card drops to the bottom, ticked */
    const order = sups().filter((s) => groups[s.id] || usualDue(s) || pinnedDue(s) || sentToday(s)).sort((a, b) => rank(a) - rank(b) || String(a.deadline || '99').localeCompare(String(b.deadline || '99')));
    order.forEach((s) => {
      const list = groups[s.id] || [], th = theme(s), u = usualDue(s) ? usual(s) : [], pin = pinnedDue(s), done = sentToday(s) && !list.length;
      w.append(h('section', { class: 'block card wb-sup themed' + (done ? ' sent' : urgent(s) || u.length || pin ? ' due' : '') + (!done && s.top && (u.length || pin) ? ' pinned' : ''), style: '--sup-c:' + th[1] + ';--sup-img:' + (th[2] ? 'url("' + new URL('assets/photos/suppliers/' + th[2] + '.jpg', document.baseURI).href + '")' : 'none') },
        h('div', { class: 'wb-sup-head' }, h('div', null, h('span', { class: 'wb-kind' }, th[0]), h('h2', { class: 'block-title' }, s.name),
          sentToday(s) ? h('span', { class: 'wb-due' }, K.icon('check'), 'Sent today' + (lastSent(s) ? ' ' + K.hm(lastSent(s).at) : '')) : when(s) || u.length ? h('span', { class: 'wb-due' }, when(s) || 'Order today') : null),
          K.me.admin ? h('button', { class: 'btn small wb-sendbtn', type: 'button', onclick: () => { ui.sheet = { type: 'wbsend', sup: s.id }; K.render(); } }, K.icon(s.app === 'shop' ? (s.link ? 'link' : 'list') : 'send'), s.app === 'shop' ? (s.link ? 'Website' : 'List') : s.app === 'viber' ? 'Viber' : 'WhatsApp') : null),
        u.length ? h('p', { class: 'wb-usual' }, h('b', null, 'The usual: '), u.join(' · ')) : null,
        list.length ? h('div', { class: 'wbl' }, list.map((i) => line(i, {}))) : !u.length && !done ? h('p', { class: 'wb-usual' }, 'Order day. Write what we need for ' + s.name + ' above.') : null));
    });
    if (groups['']) {
      w.append(h('section', { class: 'block card wb-sup none' },
        h('div', { class: 'wb-sup-head' }, h('div', null, h('h2', { class: 'block-title' }, sups().length ? 'Who sells it?' : 'On the board'),
          h('span', { class: 'wb-due' }, K.me.admin ? (sups().length ? 'Pick the supplier once; the board remembers it' : 'Add your suppliers to send ready messages') : 'The chefs order these'))),
        h('div', { class: 'wbl' }, groups[''].map((i) => line(i, { pick: supPick(i) }))),
        K.me.admin && !sups().length ? h('button', { class: 'btn', type: 'button', onclick: () => { ui.sheet = { type: 'suppliers' }; K.render(); } }, K.icon('plus'), 'Add a supplier') : null));
    }
    if (!need.length && !order.length) w.append(h('p', { class: 'none wb-empty' }, 'The board is clean. Write what runs low the moment you see it, from any page: the marker at the top.'));

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
          h('div', { class: 'wbl' }, list.map((i) => line(i, { done: true }))),
          h('p', { class: 'hint' }, 'Tick each line as it arrives. Not delivered? Wipe the tick by writing it on the board again.')));
      });
    }
    return { body: body };
  };

  /* ---------- the chefs' list of suppliers ---------- */
  K.SHEETS.suppliers = function (S) {
    S.list = S.list || K.clone(sups());
    const save = () => {
      const list = S.list.filter((s) => (s.name || '').trim()).map((s) => ({ id: s.id, name: s.name.trim(), app: s.app === 'viber' || s.app === 'shop' ? s.app : 'whatsapp', phone: (s.phone || '').trim(), days: (s.days || []).slice().sort(), deadline: (s.deadline || '').trim(), greeting: (s.greeting || '').trim(), sells: (s.sells || '').trim(), paused: !!s.paused, kind: s.kind || 'other', usual: (s.usual || '').trim(), top: !!s.top, link: (s.link || '').trim() }));
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
          K.field('Send by', K.seg([['whatsapp', 'WhatsApp'], ['viber', 'Viber'], ['shop', 'Shop']], s.app === 'viber' || s.app === 'shop' ? s.app : 'whatsapp', (v) => { s.app = v; K.render(); }, { 'aria-label': 'Send by', class: 'seg small-seg' })),
          K.field('Phone', h('input', { class: 'input mono', value: s.phone || '', inputmode: 'tel', placeholder: '0888 123 456', oninput: (e) => { s.phone = e.target.value; } }))),
        s.app === 'shop' ? K.field('Website', h('input', { class: 'input', type: 'url', value: s.link || '', placeholder: 'https://…', oninput: (e) => { s.link = e.target.value; } }), 'Where you order the delivery. The button copies the list and opens it.') : null,
        h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Order days'),
          h('div', { class: 'rp-days' }, DAYS.map((d, j) => h('button', { type: 'button', class: 'chip', 'aria-pressed': (s.days || []).includes(j) ? 'true' : 'false', onclick: () => { const l = (s.days || []).slice(), k = l.indexOf(j); if (k >= 0) l.splice(k, 1); else l.push(j); s.days = l; K.render(); } }, d)))),
        h('div', { class: 'two' },
          K.field('Order by', h('input', { class: 'input mono', type: 'time', value: s.deadline || '', oninput: (e) => { s.deadline = e.target.value; } })),
          K.field('Message starts', h('input', { class: 'input', value: s.greeting || '', placeholder: 'Здравейте, за утре', oninput: (e) => { s.greeting = e.target.value; } }))),
        h('div', { class: 'two' },
          K.field('Type', K.select(Object.keys(THEMES).map((k) => [k, THEMES[k][0]]), s.kind || 'other', (v) => { s.kind = v; }, { 'aria-label': 'Type of supplier', class: 'input' })),
          h('label', { class: 'check wb-topcheck' }, h('input', { type: 'checkbox', checked: !!s.top, onchange: (e) => { s.top = e.target.checked; } }), h('span', null, 'On top on order days'))),
        K.field('The usual order', h('textarea', { class: 'input', rows: '3', placeholder: '2бр латинка\n2бр киселец\n1бр ядливи цветя', oninput: (e) => { s.usual = e.target.value; } }, s.usual || ''), 'One line each. It goes in the message on every order day, with whatever is on the board.'),
        K.field('Sells', h('textarea', { class: 'input', rows: '2', placeholder: 'e.g. смръчкули, шийтаке, лъвска грива', oninput: (e) => { s.sells = e.target.value; } }, s.sells || ''), 'Products, separated by commas. Lines that mention one go to this supplier.'),
        h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!s.paused, onchange: (e) => { s.paused = e.target.checked; } }), h('span', null, 'Not ordering from them now')),
        products(s.id).length ? h('p', { class: 'muted' }, 'Also picked by hand: ' + products(s.id).join(', ')) : null,
        h('button', { class: 'btn small danger', type: 'button', onclick: () => { if (!s.del) { s.del = true; K.render(); return; } S.list.splice(i, 1); K.render(); } }, s.del ? 'Tap again to remove' : 'Remove'))),
      h('button', { class: 'btn wide', type: 'button', onclick: () => { S.list.push({ id: 's' + K.uid(), name: '', app: 'whatsapp', phone: '', days: [], deadline: '' }); K.render(); } }, K.icon('plus'), 'Add a supplier'),
      h('button', { class: 'btn primary wide', type: 'button', onclick: save }, 'Save')), { wide: true });
  };
})();
