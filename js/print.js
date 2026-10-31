/* Printing the to-do list: a clean black-and-white sheet per station for the wall or an apron
   pocket, with boxes to tick by pen and lines to write on. Stand-alone site only: the Claude
   version cannot open the print dialog. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  K.canPrint = () => (K.mode === 'local' || K.mode === 'firebase') && typeof window.print === 'function';

  /* everything on a station's to-do list for today (n = 0) or tomorrow (n = 1) */
  K.todoFor = function (st, n) {
    /* repeats and events follow the calendar; the prep list and tasks follow the station's sheet */
    const day = K.day(n), sheet = K.sday(st, n), wd = K.parseYmd(day).getDay(), tasks = [], groups = [], byName = {};
    const short = (ds) => K.prettyDate(ds, { weekday: 'short', day: 'numeric', month: 'short' });
    (K.kitchen().repeats || []).filter((rp) => rp.station === st && (rp.days || []).includes(wd)).forEach((rp) => {
      const d = D.prep[K.prepId('auto-' + rp.id, day)];
      if (!(d && d.status === 'done')) tasks.push({ name: rp.name, urgent: true, meta: 'Every ' + K.daysLabel(rp.days) });
    });
    D.events.forEach((e) => {
      if (e.status === 'cancelled' || e.status === 'pending' || e.date < day) return;
      K.evTasks(e).forEach((k) => {
        const key = 'evt-' + e.id + '-' + k.id;
        if (k.station === st && K.dueDate(e, k) === day && K.evTaskStatus(key) !== 'done') tasks.push({ name: k.text, meta: 'Event: ' + (e.title || '') + ' · ' + short(e.date) });
      });
    });
    /* today's open tasks, or for tomorrow only the notes left for it: nothing carries over */
    if (!n) K.dayTasks(st).filter((d) => d.status === 'need' && !/^(evt|auto)-/.test(String(d.key)))
      .forEach((d) => tasks.push({ name: d.name, note: d.note, urgent: !!d.urgent }));
    if (n) K.tomorrowTasks(st).forEach((x) => tasks.push({ name: x.d.name, note: x.d.note, urgent: !!x.d.urgent, meta: 'Left for tomorrow' + (K.nameOf(x.d.leftBy) ? ' by ' + K.nameOf(x.d.leftBy) : '') }));
    tasks.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
    const date = sheet;
    K.checkItems(st, date).forEach((it) => {
      if (K.markState(st, it.id, date) !== 'do' && !K.isUrgent(st, it.id, date)) return;
      if (!byName[it.group]) groups.push(byName[it.group] = { name: it.group, items: [] });
      const m = K.mark(st, it.id, date) || {};
      byName[it.group].items.push({ name: it.name, note: K.markNote(st, it.id, date), urgent: K.isUrgent(st, it.id, date), words: K.kindWords(K.markKind(st, it.id, date)), written: true, hand: m.hand });
    });
    groups.forEach((g) => g.items.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0)));
    /* the whole prep list, in the list's own order: marked rows carry their words, ready rows are struck */
    const all = [], allBy = {};
    K.checkItems(st, date).forEach((it) => {
      const m = K.mark(st, it.id, date) || {}, state = K.markState(st, it.id, date);
      if (!allBy[it.group]) all.push(allBy[it.group] = { name: it.group, items: [] });
      allBy[it.group].items.push({ name: it.name, note: m.c || '', urgent: K.isUrgent(st, it.id, date), written: state === 'do' || state === 'ok', done: state === 'ok', words: K.kindWords(K.kindsOf(m)), hand: m.hand });
    });
    return { sheet: sheet, tasks: tasks, groups: groups, all: all, count: tasks.length + groups.reduce((s, g) => s + g.items.length, 0) };
  };

  /* ---------- the paper ----------
     The same sheet as on the phone: each line starts with the box the cook wrote in (DO, OPT, DEF…),
     printed in their hand, to be crossed out by pen. Urgent lines are banded grey and labelled. */
  function box(x) {
    const words = x && x.written ? (x.words && x.words.length ? x.words : ['DO']) : [];
    return h('span', { class: 'pr-box' + (words.length ? ' w' + Math.min(words.length, 3) + (words.length === 1 && words[0].length > 4 ? ' long' : '') + ' ' + K.handClass(x.hand) : ''), 'aria-hidden': 'true' }, words.map((w) => h('i', null, w)));
  }
  function line(x) {
    return h('li', { class: (x.urgent && !x.done ? 'urg' : '') + (x.done ? ' done' : '') }, box(x),
      h('span', { class: 'pr-txt' }, x.urgent ? h('em', null, 'Urgent') : null, h('b', null, x.name),
        x.note ? h('span', { class: 'pr-note' }, x.note) : null, x.meta ? h('span', { class: 'pr-meta' }, x.meta) : null));
  }
  function page(st, n, full) {
    const t = K.todoFor(st, n), marked = t.count - t.tasks.length;
    const groups = full ? t.all : t.groups, rows = t.tasks.length + groups.reduce((a, g) => a + g.items.length, 0), two = rows > 14, three = rows > 46;
    const when = K.prettyDate(t.sheet, { weekday: 'long', day: 'numeric', month: 'long' });
    return h('section', { class: 'pr-page' + (full ? ' full' : '') },
      h('header', { class: 'pr-head' },
        h('img', { class: 'pr-logo', src: 'assets/brand/logo-black.png', alt: 'Komat' }),
        h('div', { class: 'pr-title' },
          h('span', { class: 'pr-kicker' }, K.ST[st] + ' · ' + (n ? 'Tomorrow’s sheet' : 'Today’s sheet')),
          h('h1', null, when),
          h('p', null, (t.tasks.length + marked) + ' to do' + (full ? ' · the whole list, so nothing is missed' : '')))),
      h('div', { class: 'pr-sec' }, h('h2', null, full ? 'Prep list' : 'To do', h('span', null, full ? marked + ' marked of ' + (rows - t.tasks.length) : String(rows))),
        h('div', { class: 'pr-cols' + (three ? ' pr-c3' : two ? ' pr-c2' : '') },
          t.tasks.length ? h('div', { class: 'pr-group tasks' }, h('h3', null, 'Tasks'), h('ul', null, t.tasks.map(line))) : null,
          groups.map((g) => h('div', { class: 'pr-group' }, h('h3', null, g.name), h('ul', null, g.items.map(line)))))),
      h('div', { class: 'pr-sec' }, h('h2', null, 'Also'), h('ul', { class: 'pr-blank' }, (full ? [0, 1, 2] : [0, 1, 2, 3, 4, 5]).map(() => h('li', null, box(), h('span', { class: 'pr-txt' }))))),
      h('footer', { class: 'pr-foot' },
        h('span', null, 'Cross out the box when it’s done, then in the app.'),
        h('span', null, 'Komat · ' + K.ST[st] + ' · printed ' + K.prettyDate(K.ymd(new Date()), { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + K.hm(Date.now()))));
  }
  /* one station, one A4 page, however long the list: lay each page out wider and scale it down until it fits the paper */
  function fitOnePage(sheet) {
    const mm = (v) => v * 96 / 25.4, W = mm(182), H = mm(264);
    sheet.style.cssText = 'display:block;position:fixed;left:-10000px;top:0;visibility:hidden;width:' + W + 'px';
    Array.from(sheet.querySelectorAll('.pr-page')).forEach((pg) => {
      let sc = 1;
      pg.style.width = W + 'px';
      if (pg.offsetHeight > H) {
        for (sc = 0.95; sc > 0.4; sc -= 0.03) {
          pg.style.width = (W / sc) + 'px';
          if (pg.offsetHeight * sc <= H) break;
        }
      }
      if (sc < 1) {
        pg.style.transform = 'scale(' + sc.toFixed(3) + ')';
        pg.style.transformOrigin = '0 0';
        const fit = document.createElement('div');
        fit.className = 'pr-fit';
        fit.style.height = H + 'px';
        pg.replaceWith(fit);
        fit.append(pg);
      } else pg.style.width = '';
    });
    sheet.style.cssText = '';
  }
  K.printTodos = function (n, sts, full) {
    const old = document.getElementById('printsheet');
    if (old) old.remove();
    const sheet = h('div', { id: 'printsheet', 'aria-hidden': 'true' }, sts.map((st) => page(st, n, full)));
    document.body.append(sheet);
    /* print once the logo has loaded, so it is on the paper */
    Promise.all(Array.from(sheet.querySelectorAll('img')).map((im) => (im.complete ? null : new Promise((r) => { im.onload = r; im.onerror = r; }))))
      .then(() => { fitOnePage(sheet); setTimeout(() => window.print(), 30); });
  };
  window.addEventListener('afterprint', () => { const s = document.getElementById('printsheet'); if (s) s.remove(); });

  /* ---------- choosing what to print ---------- */
  K.openPrint = function () { ui.sheet = { type: 'print', full: true, n: ui.todayTab === 'tmr' || (!ui.todayTab && K.planningTomorrow()) ? 1 : 0, st: K.getStation() }; K.render(); };
  K.SHEETS.print = function (S) {
    const sts = S.st === 'all' ? K.STATIONS.map((s) => s[0]) : [S.st];
    const count = sts.reduce((a, st) => a + K.todoFor(st, S.n).count, 0);
    const dayName = (n) => K.parseYmd(K.sday(S.st === 'all' ? K.getStation() : S.st, n)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
    const paper = page(sts[0], S.n, S.full);
    return K.sheet('Print the sheet', h('div', { class: 'print-opts' },
      h('div', { class: 'print-pick' },
        h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Day'),
          K.seg([[0, 'Today · ' + dayName(0)], [1, 'Tomorrow · ' + dayName(1)]], S.n, (v) => { S.n = v; K.render(); }, { 'aria-label': 'Day', class: 'seg daypick-seg' })),
        h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Station'),
          K.seg(K.STATIONS.map((s) => [s[0], s[0] === 'pass' ? 'Pass' : s[1]]).concat([['all', 'All']]), S.st, (v) => { S.st = v; K.render(); }, { 'aria-label': 'Station' })),
        h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Print'),
          K.seg([[true, 'The whole list'], [false, 'Only what’s marked']], S.full, (v) => { S.full = v; K.render(); }, { 'aria-label': 'What to print' })),
        h('p', { class: 'muted' }, (count ? count + (count === 1 ? ' thing' : ' things') + ' to do' : 'Nothing on this list yet; it prints with lines to write on') + (sts.length > 1 ? ', one page per station.' : '.')),
        h('button', { class: 'btn primary wide', type: 'button', onclick: () => { ui.sheet = null; K.render(); K.printTodos(S.n, sts, S.full); } }, K.icon('print'), sts.length > 1 ? 'Print 3 pages' : 'Print')),
      h('div', { class: 'pr-preview', 'aria-hidden': 'true' }, h('div', { class: 'pr-paper' }, paper))), { wide: true });
  };
})();
