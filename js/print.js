/* Printing the to-do list: a clean black-and-white sheet per station for the wall or an apron
   pocket, with boxes to tick by pen and lines to write on. Stand-alone site only: the Claude
   version cannot open the print dialog. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  K.canPrint = () => (K.mode === 'local' || K.mode === 'firebase') && typeof window.print === 'function';

  /* everything on a station's to-do list for today (n = 0) or tomorrow (n = 1) */
  K.todoFor = function (st, n) {
    const day = K.day(n), wd = K.parseYmd(day).getDay(), tasks = [], groups = [], byName = {};
    const short = (ds) => K.prettyDate(ds, { weekday: 'short', day: 'numeric', month: 'short' });
    (K.kitchen().repeats || []).filter((rp) => rp.station === st && (rp.days || []).includes(wd)).forEach((rp) => {
      const d = D.prep[K.prepId('auto-' + rp.id, day)];
      if (!(d && d.status === 'done')) tasks.push({ name: rp.name, urgent: true, meta: 'Every ' + K.daysLabel(rp.days) });
    });
    D.events.forEach((e) => {
      if (e.status === 'cancelled' || e.status === 'pending' || e.date < day) return;
      K.evTasks(e).forEach((k) => {
        const key = 'evt-' + e.id + '-' + k.id;
        if (k.station === st && K.dueDate(e, k) <= day && K.evTaskStatus(key) !== 'done') tasks.push({ name: k.text, meta: 'Event: ' + (e.title || '') + ' · ' + short(e.date) });
      });
    });
    /* free tasks still open today; from tomorrow's side they carry over, with the notes left for it */
    K.dayTasks(st).filter((d) => d.status === 'need' && !/^(evt|auto)-/.test(String(d.key)))
      .forEach((d) => tasks.push({ name: d.name, note: d.note, urgent: !!d.urgent, meta: n ? 'Still open today' : d._from ? 'Still open from ' + short(d._from) : '' }));
    if (n) K.tomorrowTasks(st).forEach((x) => tasks.push({ name: x.d.name, note: x.d.note, urgent: !!x.d.urgent, meta: 'Left for tomorrow' + (K.nameOf(x.d.leftBy) ? ' by ' + K.nameOf(x.d.leftBy) : '') }));
    tasks.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
    const date = n ? day : undefined;
    K.checkItems(st, date).forEach((it) => {
      if (K.markState(st, it.id, date) !== 'do' && !K.isUrgent(st, it.id, date)) return;
      if (!byName[it.group]) groups.push(byName[it.group] = { name: it.group, items: [] });
      byName[it.group].items.push({ name: it.name, note: K.markNote(st, it.id, date), urgent: K.isUrgent(st, it.id, date) });
    });
    groups.forEach((g) => g.items.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)));
    return { tasks: tasks, groups: groups, count: tasks.length + groups.reduce((s, g) => s + g.items.length, 0) };
  };

  /* ---------- the paper ---------- */
  const box = () => h('span', { class: 'pr-box', 'aria-hidden': 'true' });
  function line(x) {
    return h('li', { class: x.urgent ? 'urg' : null }, box(),
      h('span', { class: 'pr-txt' }, h('b', null, x.name), x.urgent ? h('em', null, 'Urgent') : null,
        x.note ? h('span', { class: 'pr-note' }, x.note) : null, x.meta ? h('span', { class: 'pr-meta' }, x.meta) : null));
  }
  function page(st, n) {
    const t = K.todoFor(st, n), many = t.groups.reduce((s, g) => s + g.items.length, 0) > 12;
    return h('section', { class: 'pr-page' },
      h('header', { class: 'pr-head' },
        h('img', { class: 'pr-logo', src: 'assets/brand/logo-black.png', alt: 'Komat' }),
        h('div', { class: 'pr-title' },
          h('span', { class: 'pr-kicker' }, n ? 'Prep list for tomorrow' : 'To do today'),
          h('h1', null, K.ST[st]),
          h('p', null, K.prettyDate(K.day(n))))),
      t.tasks.length ? h('div', { class: 'pr-sec' }, h('h2', null, 'Tasks', h('span', null, String(t.tasks.length))), h('ul', null, t.tasks.map(line))) : null,
      t.groups.length ? h('div', { class: 'pr-sec' }, h('h2', null, 'Mise en place to make', h('span', null, String(t.count - t.tasks.length))),
        h('div', { class: 'pr-groups' + (many ? ' two' : '') }, t.groups.map((g) => h('div', { class: 'pr-group' }, h('h3', null, g.name), h('ul', null, g.items.map(line)))))) : null,
      !t.count ? h('p', { class: 'pr-none' }, 'Nothing on the list yet.') : null,
      h('div', { class: 'pr-sec' }, h('h2', null, 'Also'), h('ul', { class: 'pr-blank' }, [0, 1, 2, 3, 4].map(() => h('li', null, box(), h('span', { class: 'pr-txt' }))))),
      h('footer', { class: 'pr-foot' },
        h('span', null, 'Tick it here, then in the app when you can.'),
        h('span', null, 'Printed ' + K.prettyDate(K.ymd(new Date()), { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + K.hm(Date.now()))));
  }
  K.printTodos = function (n, sts) {
    const old = document.getElementById('printsheet');
    if (old) old.remove();
    const sheet = h('div', { id: 'printsheet', 'aria-hidden': 'true' }, sts.map((st) => page(st, n)));
    document.body.append(sheet);
    /* print once the logo has loaded, so it is on the paper */
    Promise.all(Array.from(sheet.querySelectorAll('img')).map((im) => (im.complete ? null : new Promise((r) => { im.onload = r; im.onerror = r; }))))
      .then(() => setTimeout(() => window.print(), 30));
  };
  window.addEventListener('afterprint', () => { const s = document.getElementById('printsheet'); if (s) s.remove(); });

  /* ---------- choosing what to print ---------- */
  K.openPrint = function () { ui.sheet = { type: 'print', n: K.planningTomorrow() ? 1 : 0, st: K.getStation() }; K.render(); };
  K.SHEETS.print = function (S) {
    const sts = S.st === 'all' ? K.STATIONS.map((s) => s[0]) : [S.st];
    const count = sts.reduce((a, st) => a + K.todoFor(st, S.n).count, 0);
    const dayName = (n) => K.parseYmd(K.day(n)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
    const paper = page(sts[0], S.n);
    return K.sheet('Print the to-do list', h('div', { class: 'print-opts' },
      h('div', { class: 'print-pick' },
        h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Day'),
          K.seg([[0, 'Today · ' + dayName(0)], [1, 'Tomorrow · ' + dayName(1)]], S.n, (v) => { S.n = v; K.render(); }, { 'aria-label': 'Day', class: 'seg daypick-seg' })),
        h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Station'),
          K.seg(K.STATIONS.map((s) => [s[0], s[0] === 'pass' ? 'Pass' : s[1]]).concat([['all', 'All']]), S.st, (v) => { S.st = v; K.render(); }, { 'aria-label': 'Station' })),
        h('p', { class: 'muted' }, (count ? count + (count === 1 ? ' thing' : ' things') + ' to do' : 'Nothing on this list yet; it prints with lines to write on') + (sts.length > 1 ? ', one page per station.' : '.')),
        h('button', { class: 'btn primary wide', type: 'button', onclick: () => { ui.sheet = null; K.render(); K.printTodos(S.n, sts); } }, K.icon('print'), sts.length > 1 ? 'Print 3 pages' : 'Print')),
      h('div', { class: 'pr-preview', 'aria-hidden': 'true' }, h('div', { class: 'pr-paper' }, paper))), { wide: true });
  };
})();
