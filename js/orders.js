/* The whiteboard: what the kitchen needs, written by everyone in their own hand.
   One order per calendar day. At midnight it goes to the head chef and a clean board starts. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;

  /* every station's lines for one order, the same product written twice kept as one line */
  function combined(date) {
    const comb = {};
    K.STATIONS.forEach((s) => {
      const d = K.orderFor(s[0], date);
      if (!d) return;
      d.items.forEach((i) => {
        const k = i.n.toLowerCase();
        if (!comb[k]) comb[k] = { n: i.n, s: 'low', rows: [] };
        if (i.s === 'out') comb[k].s = 'out';
        comb[k].rows.push({ st: s[0], s: i.s, note: i.note, by: i.by || d.by, ink: i.ink, hand: i.hand, at: i.at || d.at });
      });
    });
    return Object.keys(comb).map((k) => comb[k]).sort((a, b) => a.n.localeCompare(b.n));
  }
  const shortSt = (st) => K.ST[st].split(' ')[0];
  const who = (r) => shortSt(r.st) + (K.nameOf(r.by) ? ', ' + K.nameOf(r.by).split(' ')[0] : '');
  function orderText(date, list) {
    const line = (x) => '- ' + x.n + ':' + x.rows.map((r) => ' ' + (r.note || '?') + ' [' + K.ST[r.st] + (K.nameOf(r.by) ? ', ' + K.nameOf(r.by) : '') + ']').join(';');
    return 'Komat order · written ' + K.prettyDate(date) + '\n' + list.map(line).join('\n');
  }
  /* one handwritten line on the board */
  function boardLine(x, canWipe) {
    const r0 = x.rows[0] || {};
    return h('div', { class: 'oline wb-line ' + x.s + ' ' + K.inkClass(r0.ink) + ' ' + K.handClass(r0.hand) },
      h('span', { class: 'wb-name' }, x.n),
      x.rows.map((r) => h('span', { class: 'wb-amt ' + K.inkClass(r.ink) + ' ' + K.handClass(r.hand) }, r.note || '…')),
      h('span', { class: 'wb-by' }, x.rows.map((r) => h('span', { class: 'wb-who' }, shortSt(r.st), K.nameOf(r.by) ? h('span', { class: 'wb-sig ' + K.inkClass(r.ink) + ' ' + K.handClass(r.hand) }, K.nameOf(r.by).split(' ')[0]) : null))),
      canWipe ? h('button', { type: 'button', class: 'wb-wipe', 'aria-label': 'Wipe ' + x.n + ' off the board', onclick: () => wipe(x) }, K.icon('close')) : null);
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
      const cur = ((K.orderFor(st) || {}).items || []).filter((i) => i.n.toLowerCase() !== name.toLowerCase()   );
      const item = { n: name, s: 'out', note: amt, extra: true, by: K.me.id || '', ink: K.myInk() || 'blue', hand: K.myHand() || 'caveat', at: Date.now() };
      cur.push(item);
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
  /* the head chef's copy: the phone's mail app opens with the whole order, and it is copied too */
  function emailOrder(date, list) {
    const to = K.kitchen().orderEmail || '', body = orderText(date, list);
    try { navigator.clipboard.writeText(body).catch(() => {}); } catch (e) { /* no clipboard here */ }
    try { window.location.href = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent('Komat order · ' + K.prettyDate(date)) + '&body=' + encodeURIComponent(body); } catch (e) { /* no mail app */ }
    K.toast('The order is copied' + (to ? ' and an email to ' + to + ' is open.' : '.'), { tone: 'good' });
  }

  K.V.orders = function () {
    const cur = K.orderDay(), prev = K.orderDay(-1);
    const date = ui.orderDate === prev ? prev : cur, isCur = date === cur;
    const list = combined(date), board = D.boards[date];
    const body = h('div', { class: 'page' });
    body.append(K.pageHead('Whiteboard', null, h('div', { class: 'phead-side' }, h('p', { class: 'psub' }, 'Order written ' + K.sheetDate(date)),
      K.seg([[cur, 'This order'], [prev, 'The one before']], date, (v) => { ui.orderDate = v; K.render(); }, { 'aria-label': 'Which order', class: 'seg on-dark' })), 'orders'));
    const w = h('div', { class: 'wrap orders' });
    body.append(w);
    const grid = h('div', { class: 'orders-grid' });
    w.append(grid);
    const main = h('section', { class: 'block' });
    grid.append(main);

    /* where we are on the order's clock */
    const next = K.sheetDate(K.ymd(K.addDays(K.parseYmd(date), 1)));
    main.append(h('div', { class: 'daystamp board-stamp' },
      h('span', { class: 'ds-k' }, !isCur ? 'The order before' : 'Today’s order · open'),
      h('b', { class: 'ds-d' }, K.sheetDate(date)),
      h('span', { class: 'ds-t' }, !isCur ? 'Sent at 00:00 on ' + next + '.' : 'Write what we need until midnight. At 00:00 it goes to the chef and a clean board starts.')));

    const wb = h('div', { class: 'wboard' + (list.length || isCur ? '' : ' empty') });
    list.forEach((x) => wb.append(boardLine(x, isCur)));
    if (isCur) wb.append(writeForm());
    main.append(wb);
    if (list.length && K.me.admin) {
      main.append(h('div', { class: 'wb-send' },
        h('button', { class: 'btn wide', type: 'button', onclick: () => emailOrder(date, list) }, K.icon('send'), 'Email me this order'),
        K.kitchen().orderEmail ? null : h('p', { class: 'hint' }, 'Set the address in Settings → Kitchen rules.')));
    }

    const side = h('section', { class: 'block card board' },
      h('div', { class: 'block-top' }, h('h2', { class: 'block-title' }, 'Photo of a paper list'),
        isCur ? h('button', { class: 'btn small' + (board ? '' : ' primary'), type: 'button', disabled: !!ui.boardBusy, onclick: K.addBoardPhoto }, K.icon('camera'), ui.boardBusy ? 'Saving…' : board ? 'Replace' : 'Add photo') : null),
      h('p', { class: 'muted' }, board ? 'Added ' + K.hm(board.at) + (K.nameOf(board.by) ? ' by ' + K.nameOf(board.by) : '') : isCur ? 'If someone wrote the order on paper, add a photo of it here.' : 'No photo for that order.'),
      board ? h('a', { href: board.photo, target: '_blank', rel: 'noopener', class: 'board-link' }, h('img', { class: 'board-img', src: board.photo, alt: 'Photo of the kitchen whiteboard' })) : null);
    grid.append(side);

    /* each station's ingredient check sits under the board */
    if (isCur) {
      w.append(h('h2', { class: 'block-title ost-title' }, 'Check a station’s ingredients'), h('div', { class: 'ostations' }, K.STATIONS.map((s) => {
        const d = K.orderFor(s[0], date);
        return h('div', { class: 'ost card' + (d ? ' in' : '') }, h('span', { class: 'ost-name' }, K.icon(K.ST_ICON[s[0]]), s[1]),
          h('span', { class: 'muted' }, d ? 'Written ' + K.hm(d.at) + (K.nameOf(d.by) ? ' by ' + K.nameOf(d.by) : '') + ' · ' + d.items.length + (d.items.length === 1 ? ' line' : ' lines') : 'Not checked yet'),
          h('button', { class: 'btn small' + (d ? '' : ' primary'), type: 'button', onclick: () => K.startStock(s[0], false) }, d ? 'Change' : 'Check'));
      })));
    }
    return { body: body };
  };
})();
