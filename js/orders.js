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
  /* who places the orders (people on The Brigade, chosen in Suppliers); nobody chosen = the chefs */
  const orderers = () => (D.suppliers && D.suppliers.orderers) || [];
  K.wbCanOrder = function () {
    const o = orderers();
    if (!o.length) return !!K.me.admin;
    return o.includes(K.getMe ? K.getMe() : '') || K.me.role === 'dev';
  };
  /* remember who sells a product (the settings are the chefs' to write; for the others the line keeps it) */
  const remember = (n, v) => {
    if (!K.me.admin || !v) return;
    D.suppliers = Object.assign({}, D.suppliers, { map: Object.assign({}, smap(), { [key(n)]: v }) });
    K.db.doc('settings/suppliers').set(D.suppliers).catch(K.writeFailed);
  };
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
      }).then(() => { ui.wbPhotoBusy = false; K.render(); K.toast('Photo saved. Its lines appear in Ordering in a minute or two.'); },
        (e) => { ui.wbPhotoBusy = false; K.render(); K.writeFailed(e); });
    });
  };
  function scanCards() {
    const day = Date.now() - 36 * 3600 * 1000;
    const list = (D.wbScans || []).filter((s) => (s.at || 0) > day && !s.hidden).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 3);
    return list.map((s) => {
      const txt = s.status === 'done' ? (s.added ? 'Read: ' + s.added + (s.added === 1 ? ' line' : ' lines') + ' added' + (s.names && s.names.length ? ' (' + s.names.slice(0, 6).join(', ') + (s.names.length > 6 ? '…' : '') + ')' : '') : 'Read it: nothing new to add') + (s.note ? '. ' + s.note : '')
        : s.status === 'failed' ? 'Could not read it' + (s.error ? ': ' + s.error : '') + '. Write the lines by hand.'
          : 'Reading it… the lines appear here in a minute or two.';
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
    return K.sheet('Add to the order list', h('div', { class: 'wb-quick' },
      h('p', { class: 'muted' }, 'Something running low or missing? Add it; it gets ordered.'),
      writeForm(S.f, null, true),
      S.f.last ? h('p', { class: 'wb-ok' }, K.icon('check'), 'Added: ' + S.f.last + '. Anything else?') : null,
      open.length ? h('p', { class: 'muted' }, open.length + (open.length === 1 ? ' thing' : ' things') + ' on the list: ' + open.slice(-6).map((i) => i.n).join(', ') + (open.length > 6 ? '…' : '')) : null,
      h('div', { class: 'btns' }, h('button', { class: 'btn wide', type: 'button', onclick: () => { ui.sheet = null; K.go('orders'); } }, 'Open Ordering', K.icon('next')))));
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
  /* the message goes out in Bulgarian: a name written in English becomes the kitchen's Bulgarian word */
  const BG = {
    'salad mix': 'салатен микс', 'chives': 'лук резанец', 'spring onion': 'пресен лук', 'spring onions': 'пресен лук', 'microgreens': 'микрозеленчуци', 'edible flowers': 'ядливи цветя',
    'lemon': 'лимони', 'lemons': 'лимони', 'lime': 'лайм', 'limes': 'лайм', 'orange': 'портокали', 'oranges': 'портокали', 'potatoes': 'картофи', 'new potatoes': 'пресни картофи', 'onion': 'лук', 'onions': 'лук',
    'red onion': 'червен лук', 'shallots': 'шалот', 'garlic': 'чесън', 'carrots': 'моркови', 'tomatoes': 'домати', 'cherry tomatoes': 'чери домати', 'cucumber': 'краставици', 'cucumbers': 'краставици',
    'avocado': 'авокадо', 'avocados': 'авокадо', 'parsley': 'магданоз', 'dill': 'копър', 'basil': 'босилек', 'mint': 'мента', 'coriander': 'кориандър', 'thyme': 'мащерка', 'rosemary': 'розмарин',
    'spinach': 'спанак', 'rocket': 'рукола', 'arugula': 'рукола', 'celery': 'целина', 'celeriac': 'целина', 'leek': 'праз', 'leeks': 'праз', 'fennel': 'резене', 'ginger': 'джинджифил', 'beetroot': 'цвекло',
    'pumpkin': 'тиква', 'pumpkin seeds': 'тиквено семе', 'hazelnuts': 'лешник', 'walnuts': 'орехи', 'broccolini': 'броколини', 'broccoli': 'броколи', 'cauliflower': 'карфиол', 'courgettes': 'тиквички', 'zucchini': 'тиквички',
    'peppers': 'чушки', 'chilli': 'люти чушки', 'apples': 'ябълки', 'green apples': 'зелени ябълки', 'strawberries': 'ягоди', 'raspberries': 'малини', 'blueberries': 'боровинки',
    'mushrooms': 'гъби', 'morels': 'смръчкули', 'shiitake': 'шийтаке', "lion's mane": 'лъвска грива', 'butter': 'масло', 'cream': 'сметана', 'milk': 'мляко', 'eggs': 'яйца', 'yogurt': 'кисело мляко',
    'flour': 'брашно', 'salt': 'сол', 'sugar': 'захар', 'olive oil': 'зехтин', 'oil': 'олио', 'sunflower oil': 'олио', 'vinegar': 'оцет', 'rice': 'ориз', 'buckwheat': 'елда', 'tomato paste': 'доматено пюре',
    'canned tomatoes': 'консервирани домати', 'baking soda': 'сода бикарбонат', 'baking powder': 'бакпулвер', 'bread': 'хляб', 'beef': 'говеждо', 'bones': 'кости', 'beef bones': 'говежди кости', 'pork': 'свинско', 'chicken': 'пилешко',
  };
  let trBack = null;
  function bgName(n) {
    const t = String(n || '').trim(), k = t.toLowerCase();
    if (!t || /[\u0400-\u04FF]/.test(t)) return t;
    if (BG[k]) return BG[k];
    if (!trBack) { trBack = {}; const TR = window.KOMAT_TR || {}; Object.keys(TR).forEach((bg) => { const en = String(TR[bg] || '').trim().toLowerCase(); if (bg.length < 40 && en && en.length < 40 && !trBack[en]) trBack[en] = bg; }); }
    return trBack[k] || t;
  }
  function message(s, list, withUsual) {
    /* the way the kitchen writes it: "Здравейте, за утре" and then one line each, amount first ("2бр латинка") */
    const rows = (withUsual ? usual(s) : []).concat(list.map((i) => (i.qty ? i.qty + ' ' : '') + bgName(i.n)));
    if (s.app === 'shop') return rows.join('\n'); /* a shop (Metro): just the list to take along */
    return (s.greeting || 'Здравейте, за утре') + '\n' + rows.join('\n');
  }
  const phoneDigits = (p) => { let d = String(p || '').replace(/[^\d+]/g, ''); if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '359' + d.slice(1); return d; };
  K.SHEETS.wbsend = function (S) {
    const s = supById(S.sup), list = lines('need').filter((i) => K.wbSupOf(i) === S.sup);
    if (!s) return null;
    if (S.withUsual == null) S.withUsual = !!usualDue(s);
    /* amounts typed here stay in the sheet while you type (no redraw, so the keyboard stays open) and are saved when it is sent */
    S.q = S.q || {};
    if (!S.missing) S.missing = list.filter((i) => !i.qty).map((i) => i.id);
    const draft = () => list.map((i) => (S.q[i.id] ? Object.assign({}, i, { qty: S.q[i.id].trim() }) : i));
    if (S.text == null || !S.edited) S.text = message(s, draft(), S.withUsual);
    const noQty = list.filter((i) => S.missing.includes(i.id));
    const qtyBox = noQty.length ? h('div', { class: 'wb-noqty' }, h('span', { class: 'label' }, 'No amount yet'),
      noQty.map((i, k) => h('label', { class: 'wb-noqty-row' }, h('span', null, i.n), h('input', {
        class: 'input small', id: 'wbq-' + k, value: S.q[i.id] || '', placeholder: 'how much', autocomplete: 'off', enterkeyhint: k < noQty.length - 1 ? 'next' : 'done',
        oninput: (e) => {
          S.q[i.id] = e.target.value;
          if (!S.edited) { S.text = message(s, draft(), S.withUsual); const ta = document.getElementById('wb-msg'); if (ta) ta.value = S.text; }
        },
        onkeydown: (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const nx = document.getElementById('wbq-' + (k + 1));
          if (nx) nx.focus(); else e.target.blur();
        },
      })))) : null;
    const viber = s.app === 'viber', shop = s.app === 'shop';
    /* opening the chat is not ordering: the lines count as ordered only when you say the message went */
    const openApp = () => {
      try { navigator.clipboard.writeText(S.text).catch(() => {}); } catch (e) { /* no clipboard */ }
      /* Viber cannot fill in a message for a chosen chat: with a number it opens that chat (paste the copied message), without one it lets you pick the contact */
      const url = viber ? (s.phone ? 'viber://chat?number=' + encodeURIComponent('+' + phoneDigits(s.phone)) : 'viber://forward?text=' + encodeURIComponent(S.text)) : 'https://wa.me/' + phoneDigits(s.phone) + '?text=' + encodeURIComponent(S.text);
      if (shop) { if (s.link) window.open(s.link, '_blank', 'noopener'); /* the website to order on (Metro); the list is copied to paste or follow */ } else if (viber) window.location.href = url; else window.open(url, '_blank', 'noopener');
      S.step = 'asked'; K.render();
    };
    const go = () => {
      const at = Date.now(), ids = list.map((i) => i.id);
      list.forEach((i) => { const q = (S.q[i.id] || '').trim(); setLine(i, Object.assign({ status: 'ordered', orderedAt: at, orderedBy: K.me.id || '', sup: S.sup, date: K.day(0) }, q ? { qty: q } : {})); });
      /* remember it went today, so the usual order does not ask again */
      const sid = 'sent' + K.uid(), sent = { kind: 'sent', sup: S.sup, date: K.day(0), at: at, by: K.me.id || '', text: S.text };
      D.wbSent = (D.wbSent || []).concat([Object.assign({ id: sid }, sent)]);
      K.db.doc('boards/' + sid).set(sent).catch(K.writeFailed);
      ui.sheet = null; K.render();
      K.toast('Ordered from ' + s.name, { undo: () => { D.wb.filter((i) => ids.includes(i.id)).forEach((i) => setLine(i, { status: 'need', orderedAt: 0 })); D.wbSent = D.wbSent.filter((x) => x.id !== sid); K.db.doc('boards/' + sid).delete().catch(() => {}); K.render(); } });
    };
    if (S.step === 'asked') {
      return K.sheet(s.name, h('div', { class: 'wb-sendbox wb-asked' },
        h('p', { class: 'wb-asked-q' }, shop ? 'Did you place the order on the website?' : 'Did the message go to ' + s.name + '?'),
        h('p', { class: 'muted' }, 'The lines count as ordered only when you say so, so nothing gets lost if the message did not go.'),
        h('button', { class: 'btn primary wide big', type: 'button', onclick: go }, K.icon('check'), shop ? 'Yes, it is ordered' : 'Yes, it is sent'),
        h('button', { class: 'btn wide', type: 'button', onclick: openApp }, K.icon(shop ? 'link' : 'send'), shop ? 'Open the website again' : viber ? 'Open Viber again' : 'Open WhatsApp again'),
        h('button', { class: 'btn wide', type: 'button', onclick: () => { ui.sheet = null; K.render(); K.toast('Still on the list for ' + s.name); } }, 'Not yet, keep it on the list')));
    }
    if (shop) {
      return K.sheet('Shopping list · ' + s.name, h('div', { class: 'wb-sendbox' },
        h('p', { class: 'muted' }, (s.link ? 'The list is copied and ' + s.name + '’s website opens to order the delivery.' : 'Copy it for whoever goes to ' + s.name + '.') + ' The lines move to On the way; tick them when they arrive.'),
        qtyBox,
        h('textarea', { class: 'input wb-msg', id: 'wb-msg', rows: String(Math.min(16, list.length + 2)), 'aria-label': 'Shopping list', oninput: (e) => { S.text = e.target.value; S.edited = true; } }, S.text),
        h('button', { class: 'btn primary wide big', type: 'button', onclick: openApp }, K.icon(s.link ? 'link' : 'copy'), s.link ? 'Copy the list and open the website' : 'Copy the list')));
    }
    return K.sheet('Order from ' + s.name, h('div', { class: 'wb-sendbox' },
      h('p', { class: 'muted' }, (viber ? (s.phone ? 'Viber opens the chat with ' + s.name + ' and the message is copied: hold the text box and tap Paste.' : 'Viber opens to pick ' + s.name + ', with the message.') : 'WhatsApp opens with the message to ' + (s.phone || 'the contact you pick') + '.') + ' Change anything first.'),
      qtyBox,
      h('textarea', { class: 'input wb-msg', id: 'wb-msg', rows: String(Math.min(16, list.length + 4)), 'aria-label': 'Message to ' + s.name, oninput: (e) => { S.text = e.target.value; S.edited = true; } }, S.text),
      h('button', { class: 'btn primary wide big', type: 'button', onclick: openApp }, K.icon('send'), viber ? 'Open Viber' : 'Open WhatsApp'),
      h('button', { class: 'btn wide', type: 'button', onclick: () => { try { navigator.clipboard.writeText(S.text).then(() => K.toast('Copied'), () => K.toast('Select the text and copy it')); } catch (e) { K.toast('Select the text and copy it'); } } }, K.icon('copy'), 'Only copy it')));
  };

  /* ---------- what was ordered, by day ---------- */
  const sentOn = (day) => (D.wbSent || []).filter((x) => x.date === day).sort((a, b) => (a.at || 0) - (b.at || 0));
  K.SHEETS.wbhist = function (S) {
    const day = K.day(S.day || 0), list = sentOn(day);
    const rows = (x) => {
      const sp = supById(x.sup), lines = String(x.text || '').split('\n').map((l) => l.trim()).filter(Boolean);
      const greet = ((sp && sp.greeting) || 'Здравейте').toLowerCase().slice(0, 9);
      return lines.filter((l, i) => !(i === 0 && l.toLowerCase().startsWith(greet.slice(0, 6))));
    };
    return K.sheet('Ordered ' + (S.day === -1 ? 'yesterday' : 'today'), h('div', { class: 'wb-sendbox' },
      K.seg([[-1, 'Yesterday'], [0, 'Today']], S.day, (v) => { S.day = v; K.render(); }, { 'aria-label': 'Which day', class: 'seg' }),
      h('div', { class: 'wb-date' }, h('span', { class: 'wb-date-k' }, (S.day === -1 ? 'Yesterday' : 'Today') + (list.length ? ' · ' + list.length + (list.length === 1 ? ' order' : ' orders') : '')), h('b', null, K.sheetDate(day))),
      list.length ? list.map((x) => {
        const sp = supById(x.sup), th = sp ? theme(sp) : THEMES.other;
        return h('section', { class: 'wb-histcard', style: '--sup-c:' + th[1] },
          h('div', { class: 'wb-histhead' }, h('b', null, sp ? sp.name : 'Supplier'), h('span', { class: 'muted' }, K.hm(x.at) + (first(x.by) ? ' · ' + first(x.by) : ''))),
          h('ul', null, rows(x).map((l) => h('li', null, l))));
      }) : h('p', { class: 'none' }, 'Nothing was ordered through the app ' + (S.day === -1 ? 'yesterday' : 'today') + '.')));
  };

  /* ---------- the page ---------- */
  /* one line: what, how much, who wrote it; the chefs tap it to change the amount or the supplier */
  function line(it, opts) {
    const who = opts.done && it.orderedAt ? 'ordered ' + K.hm(it.orderedAt) : [it.st && K.ST[it.st] ? K.ST[it.st].split(' ')[0] : '', first(it.by), it.via === 'photo' ? 'photo' : ''].filter(Boolean).join(' · ');
    const main = [h('span', { class: 'wbr-n' }, it.n), it.qty ? h('span', { class: 'wbr-q' }, it.qty) : null, who ? h('span', { class: 'wbr-who' }, who) : null];
    const addQ = !it.qty && !opts.done ? h('button', { type: 'button', class: 'wbr-addq', 'aria-label': 'How much ' + it.n, onclick: () => { ui.sheet = { type: 'wbqty', id: it.id, qty: '' }; K.render(); setTimeout(() => { const el = document.getElementById('wbq-in'); if (el) el.focus(); }, 60); } }, '+ amount') : null;
    return h('div', { class: 'wbr' + (opts.done ? ' done' : '') },
      K.wbCanOrder() && !opts.done ? h('button', { type: 'button', class: 'wbr-main', 'aria-label': 'Change ' + it.n, onclick: () => { ui.sheet = { type: 'wbline', id: it.id, n: it.n, qty: it.qty || '', sup: K.wbSupOf(it) }; K.render(); } }, main) : h('span', { class: 'wbr-main' }, main),
      addQ, opts.pick || null,
      opts.done
        ? h('button', { type: 'button', class: 'wbr-btn got', 'aria-label': it.n + ' arrived', title: 'Arrived', onclick: () => setLine(it, { status: 'got', gotAt: Date.now(), date: K.day(0) }) }, K.icon('check'))
        : h('button', { type: 'button', class: 'wbr-btn', 'aria-label': 'Wipe ' + it.n + ' off the board', onclick: () => wipe(it) }, K.icon('close')));
  }
  /* how much: a quick box for a line written (or read from a photo) without an amount */
  K.SHEETS.wbqty = function (S) {
    const it = (D.wb || []).find((x) => x.id === S.id);
    if (!it) return null;
    const save = (e) => { if (e) e.preventDefault(); const q = (S.qty || '').trim(); if (q) setLine(it, { qty: q }); ui.sheet = null; K.render(); };
    return K.sheet('How much ' + it.n + '?', h('form', { class: 'wb-sendbox', onsubmit: save },
      h('input', { class: 'input big', id: 'wbq-in', value: S.qty, placeholder: 'e.g. 2 кг, 3бр, 1 каса', autocomplete: 'off', enterkeyhint: 'done', oninput: (e) => { S.qty = e.target.value; } }),
      h('div', { class: 'rp-days' }, ['1бр', '2бр', '3бр', '5бр', '1 кг', '2 кг', '5 кг', '1 каса'].map((q) => h('button', { type: 'button', class: 'chip', onclick: () => { S.qty = q; save(); } }, q))),
      h('button', { class: 'btn primary wide', type: 'submit' }, 'Save')));
  };
  K.SHEETS.wbline = function (S) {
    const it = (D.wb || []).find((x) => x.id === S.id);
    if (!it) return null;
    const save = () => {
      const n = (S.n || '').trim(); if (!n) return;
      setLine(it, { n: n, qty: (S.qty || '').trim(), sup: S.sup || '' });
      remember(n, S.sup);
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
    if (!K.wbCanOrder() || !sups().length) return null;
    const cur = K.wbSupOf(it), opts = sups().filter((s) => !s.paused || s.id === cur);
    return K.select([['', cur ? 'Move to…' : 'Who sells it?']].concat(opts.map((s) => [s.id, s.name])), cur, (v) => {
      setLine(it, { sup: v });
      remember(it.n, v);
    }, { 'aria-label': 'Supplier for ' + it.n, class: 'input small wbr-pick' });
  }

  K.V.orders = function () {
    const need = lines('need'), out = lines('ordered');
    const body = h('div', { class: 'page' });
    body.append(K.pageHead('Ordering', need.length ? need.length + ' to order' : 'What the kitchen needs',
      K.me.admin ? h('button', { class: 'btn light', type: 'button', onclick: () => { ui.sheet = { type: 'suppliers' }; K.render(); } }, K.icon('chef'), 'Suppliers') : null, 'orders'));
    const w = h('div', { class: 'wrap orders wbx' });
    body.append(w);
    ui.wbForm = ui.wbForm || { text: '', amt: '' };
    /* the day, the way Today shows it: orders written today go out for tomorrow */
    w.append(h('div', { class: 'wb-date' }, h('span', { class: 'wb-date-k' }, 'Today · ordering for ' + K.sheetDate(K.day(1))), h('b', null, K.sheetDate(K.day(0)))));
    w.append(h('section', { class: 'wb-write' }, writeForm(ui.wbForm, null, true), ui.wbPhotoBusy ? h('p', { class: 'muted' }, 'Saving the photo…') : null));
    const yN = sentOn(K.day(-1)).length, tN = sentOn(K.day(0)).length;
    w.append(h('div', { class: 'wb-hist' },
      h('button', { class: 'btn small', type: 'button', onclick: () => { ui.sheet = { type: 'wbhist', day: -1 }; K.render(); } }, K.icon('list'), 'Ordered yesterday' + (yN ? ' · ' + yN : '')),
      tN ? h('button', { class: 'btn small', type: 'button', onclick: () => { ui.sheet = { type: 'wbhist', day: 0 }; K.render(); } }, 'Today · ' + tN) : null));
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
          K.wbCanOrder() ? h('button', { class: 'btn small wb-sendbtn', type: 'button', onclick: () => { ui.sheet = { type: 'wbsend', sup: s.id }; K.render(); } }, K.icon(s.app === 'shop' ? (s.link ? 'link' : 'list') : 'send'), s.app === 'shop' ? (s.link ? 'Website' : 'List') : s.app === 'viber' ? 'Viber' : 'WhatsApp') : null),
        u.length ? h('p', { class: 'wb-usual' }, h('b', null, 'The usual: '), u.join(' · ')) : null,
        list.length ? h('div', { class: 'wbl' }, list.map((i) => line(i, {}))) : !u.length && !done ? h('p', { class: 'wb-usual' }, 'Order day. Write what we need for ' + s.name + ' above.') : null));
    });
    if (groups['']) {
      w.append(h('section', { class: 'block card wb-sup none' },
        h('div', { class: 'wb-sup-head' }, h('div', null, h('h2', { class: 'block-title' }, sups().length ? 'Who sells it?' : 'On the board'),
          h('span', { class: 'wb-due' }, K.wbCanOrder() ? (sups().length ? 'Pick the supplier once; the board remembers it' : 'Add your suppliers to send ready messages') : 'The chefs order these'))),
        h('div', { class: 'wbl' }, groups[''].map((i) => line(i, { pick: supPick(i) }))),
        K.me.admin && !sups().length ? h('button', { class: 'btn', type: 'button', onclick: () => { ui.sheet = { type: 'suppliers' }; K.render(); } }, K.icon('plus'), 'Add a supplier') : null));
    }
    if (!need.length && !order.length) w.append(h('p', { class: 'none wb-empty' }, 'Nothing to order. Write what runs low the moment you see it, from any page: the button at the top.'));

    return { body: body };
  };

  /* ---------- the chefs' list of suppliers ---------- */
  K.SHEETS.suppliers = function (S) {
    S.list = S.list || K.clone(sups());
    const save = () => {
      const list = S.list.filter((s) => (s.name || '').trim()).map((s) => ({ id: s.id, name: s.name.trim(), app: s.app === 'viber' || s.app === 'shop' ? s.app : 'whatsapp', phone: (s.phone || '').trim(), days: (s.days || []).slice().sort(), deadline: (s.deadline || '').trim(), greeting: (s.greeting || '').trim(), sells: (s.sells || '').trim(), paused: !!s.paused, kind: s.kind || 'other', usual: (s.usual || '').trim(), top: !!s.top, link: (s.link || '').trim() }));
      const ids = list.map((s) => s.id), map = {};
      Object.keys(smap()).forEach((k) => { if (ids.includes(smap()[k])) map[k] = smap()[k]; });
      D.suppliers = { list: list, map: map, orderers: (S.orderers || orderers()).slice() }; ui.sheet = null; K.render();
      K.db.doc('settings/suppliers').set(D.suppliers).then(() => K.toast('Suppliers saved'), K.writeFailed);
    };
    const products = (id) => Object.keys(smap()).filter((k) => smap()[k] === id);
    S.orderers = S.orderers || orderers().slice();
    const team = (D.staff && D.staff.people) || [];
    return K.sheet('Suppliers', h('div', { class: 'wb-sups' },
      team.length ? h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Who can order'),
        h('div', { class: 'rp-days' }, team.map((p) => h('button', { type: 'button', class: 'chip', 'aria-pressed': S.orderers.includes(p.id) ? 'true' : 'false', onclick: () => { const i = S.orderers.indexOf(p.id); if (i >= 0) S.orderers.splice(i, 1); else S.orderers.push(p.id); K.render(); } }, p.name))),
        h('p', { class: 'hint' }, 'Only they see the order buttons and get the deadline reminders. Everyone can write on the board.')) : null,
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
