/* Orders: every station's Low / Out marks combined, plus the whiteboard photo. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;

  function combined(date) {
    const comb = {};
    K.STATIONS.forEach((s) => {
      const d = K.orderFor(s[0], date, date !== K.day(0));
      if (!d) return;
      d.items.forEach((i) => {
        const k = i.n.toLowerCase();
        if (!comb[k]) comb[k] = { n: i.n, s: 'low', rows: [] };
        if (i.s === 'out') comb[k].s = 'out';
        comb[k].rows.push({ st: s[0], s: i.s, note: i.note, by: i.by || d.by, ink: i.ink, hand: i.hand });
      });
    });
    return Object.keys(comb).map((k) => comb[k]).sort((a, b) => (a.s === b.s ? 0 : a.s === 'out' ? -1 : 1) || a.n.localeCompare(b.n));
  }
  /* send the board: the phone's mail app opens with the whole order, and the board is wiped */
  function sendBoard(list, to, el) {
    const date = K.day(0), body = orderText(date, list);
    const href = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent('Komat order · ' + K.prettyDate(date)) + '&body=' + encodeURIComponent(body);
    try { window.location.href = href; } catch (e) { /* no mail app */ }
    try { navigator.clipboard.writeText(body).catch(() => {}); } catch (e) { /* no clipboard here */ }
    K.vibrate([10, 40, 10]);
    (K.wipeBoard ? K.wipeBoard(el) : Promise.resolve()).then(() => K.markBoardSent(to)).then(() => K.toast(to ? 'Order sent to ' + to + '. The board is clean.' : 'The order is copied. The board is clean.', { tone: 'good' }));
  }
  /* write a line on the board: it goes on your station's order, in your hand */
  function writeForm() {
    const S = (ui.wbForm = ui.wbForm || { text: '', amt: '' });
    const st = K.getStation(), hand = 'input hand ' + K.inkClass(K.myInk()) + ' ' + K.handClass(K.myHand());
    return h('form', { class: 'wb-form', onsubmit: (e) => {
      e.preventDefault();
      const name = (S.text || '').trim(), amt = (S.amt || '').trim();
      if (!name) { const el = document.getElementById('wb-in'); if (el) el.focus(); return; }
      if (!amt) { K.toast('How much? Write the amount too.'); const el = document.getElementById('wb-amt'); if (el) el.focus(); return; }
      const cur = ((K.orderFor(st) || {}).items || []).filter((i) => i.n.toLowerCase() !== name.toLowerCase());
      cur.push({ n: name, s: 'out', note: amt, extra: true, by: K.me.id || '', ink: K.myInk() || 'blue', hand: K.myHand() || 'caveat' });
      S.text = ''; S.amt = '';
      K.vibrate(10);
      K.sendOrder(st, cur, false).then(() => K.render(), (er) => K.writeFailed(er));
      K.render();
    } },
      h('div', { class: 'wb-row' },
        h('input', { class: hand, id: 'wb-in', value: S.text, autocomplete: 'off', enterkeyhint: 'next', placeholder: 'What, e.g. лимони', 'aria-label': 'What we need', oninput: (e) => { S.text = e.target.value; } }),
        h('input', { class: hand + ' wb-amt-in', id: 'wb-amt', value: S.amt, autocomplete: 'off', enterkeyhint: 'done', placeholder: '2 kg', 'aria-label': 'How much', oninput: (e) => { S.amt = e.target.value; } })),
      h('button', { class: 'btn primary', type: 'submit' }, 'Write for ' + K.ST[st]));
  }
  /* wipe a line off the board: it comes off every station's order that has it */
  function wipe(x) {
    const k = x.n.toLowerCase(), before = {};
    K.STATIONS.forEach((s) => {
      const d = K.orderFor(s[0]);
      if (!d || !d.items.some((i) => i.n.toLowerCase() === k)) return;
      before[s[0]] = d.items.slice();
      K.sendOrder(s[0], d.items.filter((i) => i.n.toLowerCase() !== k), false).then(() => K.render(), (er) => K.writeFailed(er));
    });
    K.toast('Wiped: ' + x.n, { undo: () => Object.keys(before).forEach((st) => K.sendOrder(st, before[st], false).then(() => K.render())) });
  }
  function orderText(date, list) {
    return 'Komat order · ' + K.prettyDate(date) + '\n' + list.map((x) => '- ' + x.n + ':' +
      x.rows.map((r) => ' ' + (r.note || '?') + ' [' + K.ST[r.st] + (K.nameOf(r.by) ? ', ' + K.nameOf(r.by) : '') + ']').join(';')).join('\n');
  }

  K.V.orders = function () {
    const date = ui.orderDate === K.day(-1) ? K.day(-1) : K.day(0), isToday = date === K.day(0);
    const list = combined(date), board = D.boards[date];
    const body = h('div', { class: 'page' });
    body.append(K.pageHead('Whiteboard', null, h('div', { class: 'phead-side' }, h('p', { class: 'psub' }, K.dayDot(date), K.prettyDate(date)),
      K.seg([[K.day(0), 'Today'], [K.day(-1), 'Yesterday']], date, (v) => { ui.orderDate = v; K.render(); }, { 'aria-label': 'Day', class: 'seg on-dark' })), 'orders'));
    const w = h('div', { class: 'wrap orders' });
    body.append(w);
    /* each station's ingredient check sits under the board */
    const stations = h('div', { class: 'ostations' }, K.STATIONS.map((s) => {
      const d = K.orderFor(s[0], date);
      return h('div', { class: 'ost card' + (d ? ' in' : '') }, h('span', { class: 'ost-name' }, K.icon(K.ST_ICON[s[0]]), s[1]),
        h('span', { class: 'muted' }, d ? 'Sent ' + K.hm(d.at) + (K.nameOf(d.by) ? ' by ' + K.nameOf(d.by) : '') + ' · ' + d.items.length + (d.items.length === 1 ? ' item' : ' items') : isToday ? 'Not checked yet' : 'Nothing sent'),
        isToday ? h('button', { class: 'btn small' + (d ? '' : ' primary'), type: 'button', onclick: () => K.startStock(s[0], false) }, d ? 'Change' : 'Check') : null);
    }));
    const grid = h('div', { class: 'orders-grid' });
    w.append(grid);
    const main = h('section', { class: 'block' });
    grid.append(main);
    main.append(h('div', { class: 'block-top' }, h('h2', { class: 'block-title' }, 'What we need', h('span', { class: 'n' }, list.length ? list.length + ' all day' : '')),
      list.length ? h('button', { class: 'btn small', type: 'button', onclick: () => K.copyText(orderText(date, list)) }, K.icon('copy'), 'Copy list') : null));
    if (!list.length && !isToday) {
      main.append(K.catRest(isToday ? 'Nothing ordered yet' : 'No app orders that day', 'Each station can check its products with a quick swipe and send what is low or out.',
        isToday ? h('div', { class: 'btns center' }, h('button', { class: 'btn primary', type: 'button', onclick: () => K.startStock(K.getStation(), false) }, K.icon('order'), 'Check ' + K.ST[K.getStation()] + ' now')) : null));
    }
    /* the whiteboard: every line in the hand and colour of whoever wrote it */
    const wb = h('div', { class: 'wboard' + (list.length ? '' : ' empty') });
    if (isToday) main.append(h('div', { class: 'daystamp board-stamp' }, h('span', { class: 'ds-k' }, 'Today’s board'), h('b', { class: 'ds-d' }, K.sheetDate(date)), h('span', { class: 'ds-t' }, 'Write what we need for the next delivery.')));
    list.forEach((x) => {
      const r0 = x.rows[0] || {};
      wb.append(h('div', { class: 'oline wb-line ' + x.s + ' ' + K.inkClass(r0.ink) + ' ' + K.handClass(r0.hand) },
        h('span', { class: 'wb-name' }, x.n),
        x.rows.map((r) => h('span', { class: 'wb-amt ' + K.inkClass(r.ink) + ' ' + K.handClass(r.hand) }, r.note || '…')),
        h('span', { class: 'wb-by' }, x.rows.map((r) => K.ST[r.st].split(' ')[0] + (K.nameOf(r.by) ? ', ' + K.nameOf(r.by).split(' ')[0] : '')).join(' · ')),
        isToday ? h('button', { type: 'button', class: 'wb-wipe', 'aria-label': 'Wipe ' + x.n + ' off the board', onclick: () => wipe(x) }, K.icon('close')) : null));
    });
    /* after it was sent: the board is clean, with a faint note of when */
    const sent = isToday ? K.STATIONS.map((x) => D.orders[date + '_' + x[0]]).filter((x) => x && x.sent).sort((a, b) => b.sent - a.sent)[0] : null;
    if (!list.length && sent) wb.append(h('p', { class: 'wb-clean' }, 'Board cleaned · sent at ' + K.hm(sent.sent) + (K.nameOf(sent.sentBy) ? ' by ' + K.nameOf(sent.sentBy).split(' ')[0] : '')));
    if (isToday) wb.append(writeForm());
    main.append(wb);
    if (isToday && list.length) {
      const to = K.kitchen().orderEmail || '';
      main.append(h('div', { class: 'wb-send' },
        h('button', { class: 'btn primary wide', type: 'button', onclick: () => sendBoard(list, to, wb) }, K.icon('send'), to ? 'Send to ' + to + ' and clean the board' : 'Send the order and clean the board'),
        to ? null : h('p', { class: 'hint' }, K.me.admin ? 'Add the email it goes to in Settings → Kitchen rules.' : 'The head chef can set where it goes in Settings → Kitchen rules.')));
    }
    const side = h('section', { class: 'block card board' },
      h('div', { class: 'block-top' }, h('h2', { class: 'block-title' }, 'Photo of a paper list'),
        isToday ? h('button', { class: 'btn small' + (board ? '' : ' primary'), type: 'button', disabled: !!ui.boardBusy, onclick: K.addBoardPhoto }, K.icon('camera'), ui.boardBusy ? 'Saving…' : board ? 'Replace' : 'Add photo') : null),
      h('p', { class: 'muted' }, board ? 'Added ' + K.hm(board.at) + (K.nameOf(board.by) ? ' by ' + K.nameOf(board.by) : '') : isToday ? 'If someone wrote the order on paper, add a photo of it here.' : 'No photo that day.'),
      board ? h('a', { href: board.photo, target: '_blank', rel: 'noopener', class: 'board-link' }, h('img', { class: 'board-img', src: board.photo, alt: 'Photo of the kitchen whiteboard' })) : null);
    grid.append(side);
    w.append(h('h2', { class: 'block-title ost-title' }, 'Check a station’s ingredients'), stations);
    return { body: body };
  };
})();
