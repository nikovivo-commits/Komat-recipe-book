/* Orders: every station's Low / Out marks combined, plus the whiteboard photo. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;

  function combined(date) {
    const comb = {};
    K.STATIONS.forEach((s) => {
      const d = K.orderFor(s[0], date);
      if (!d) return;
      d.items.forEach((i) => {
        const k = i.n.toLowerCase();
        if (!comb[k]) comb[k] = { n: i.n, s: 'low', rows: [] };
        if (i.s === 'out') comb[k].s = 'out';
        comb[k].rows.push({ st: s[0], s: i.s, note: i.note });
      });
    });
    return Object.keys(comb).map((k) => comb[k]).sort((a, b) => (a.s === b.s ? 0 : a.s === 'out' ? -1 : 1) || a.n.localeCompare(b.n));
  }
  function orderText(date, list) {
    return 'Komat order · ' + K.prettyDate(date) + '\n' + list.map((x) => '- ' + x.n + ' (' + (x.s === 'out' ? 'OUT' : 'low') + ')' +
      x.rows.filter((r) => r.note).map((r) => ' ' + r.note).join(';')).join('\n');
  }

  K.V.orders = function () {
    const date = ui.orderDate === K.day(-1) ? K.day(-1) : K.day(0), isToday = date === K.day(0);
    const list = combined(date), board = D.boards[date];
    const body = h('div', { class: 'page' });
    body.append(K.pageHead('Orders', null, h('div', { class: 'phead-side' }, h('p', { class: 'psub' }, K.dayDot(date), K.prettyDate(date)),
      K.seg([[K.day(0), 'Today'], [K.day(-1), 'Yesterday']], date, (v) => { ui.orderDate = v; K.render(); }, { 'aria-label': 'Day', class: 'seg on-dark' })), 'orders'));
    const w = h('div', { class: 'wrap orders' });
    body.append(w);
    w.append(h('div', { class: 'ostations' }, K.STATIONS.map((s) => {
      const d = K.orderFor(s[0], date);
      return h('div', { class: 'ost card' + (d ? ' in' : '') }, h('span', { class: 'ost-name' }, K.icon(K.ST_ICON[s[0]]), s[1]),
        h('span', { class: 'muted' }, d ? 'Sent ' + K.hm(d.at) + (K.nameOf(d.by) ? ' by ' + K.nameOf(d.by) : '') + ' · ' + d.items.length + (d.items.length === 1 ? ' item' : ' items') : isToday ? 'Not checked yet' : 'Nothing sent'),
        isToday ? h('button', { class: 'btn small' + (d ? '' : ' primary'), type: 'button', onclick: () => K.startStock(s[0], false) }, d ? 'Change' : 'Check') : null);
    })));
    const grid = h('div', { class: 'orders-grid' });
    w.append(grid);
    const main = h('section', { class: 'block' });
    grid.append(main);
    main.append(h('div', { class: 'block-top' }, h('h2', { class: 'block-title' }, 'Order list', h('span', { class: 'n' }, list.length ? list.length + ' all day' : '')),
      list.length ? h('button', { class: 'btn small', type: 'button', onclick: () => K.copyText(orderText(date, list)) }, K.icon('copy'), 'Copy list') : null));
    if (!list.length) {
      main.append(K.catRest(isToday ? 'Nothing ordered yet' : 'No app orders that day', 'Each station can check its products with a quick swipe and send what is low or out.',
        isToday ? h('div', { class: 'btns center' }, h('button', { class: 'btn primary', type: 'button', onclick: () => K.startStock(K.getStation(), false) }, K.icon('order'), 'Check ' + K.ST[K.getStation()] + ' now')) : null));
    } else {
      main.append(h('div', { class: 'olist card' }, list.map((x) => h('div', { class: 'oline ' + x.s },
        K.produceThumb(x.n),
        h('span', { class: 'obadge' }, x.s === 'out' ? 'Out' : 'Low'),
        h('div', { class: 'oline-txt' }, h('b', null, x.n),
          h('span', { class: 'muted' }, x.rows.map((r) => K.ST[r.st] + (r.note ? ': ' + r.note : '')).join(' · ')))))));
    }
    const side = h('section', { class: 'block card board' },
      h('div', { class: 'block-top' }, h('h2', { class: 'block-title' }, 'Whiteboard'),
        isToday ? h('button', { class: 'btn small' + (board ? '' : ' primary'), type: 'button', disabled: !!ui.boardBusy, onclick: K.addBoardPhoto }, K.icon('camera'), ui.boardBusy ? 'Saving…' : board ? 'Replace' : 'Add photo') : null),
      h('p', { class: 'muted' }, board ? 'Added ' + K.hm(board.at) + (K.nameOf(board.by) ? ' by ' + K.nameOf(board.by) : '') : isToday ? 'If the order is written on the board, add a photo of it here.' : 'No photo that day.'),
      board ? h('a', { href: board.photo, target: '_blank', rel: 'noopener', class: 'board-link' }, h('img', { class: 'board-img', src: board.photo, alt: 'Photo of the kitchen whiteboard' })) : null);
    grid.append(side);
    return { body: body };
  };
})();
