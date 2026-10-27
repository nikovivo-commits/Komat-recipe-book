/* Today: the station's day. Daily brief, to-do, mise en place checklist, notes for
   tomorrow, the closing stock check, and the head chef's list editor. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;

  K.getStation = () => (K.ST[ui.station] ? ui.station : 'hot');
  K.pickStation = (st) => { ui.station = st; K.store.set('station', st); ui.noteFor = null; ui.addTo = null; K.render(); };
  K.dayDot = (ds) => h('span', { class: 'daydot', style: { background: K.DAY_DOTS[(K.parseYmd(ds).getDay() + 6) % 7] }, 'aria-hidden': 'true' });
  /* page head: a restaurant photo (per page, chosen in Branding) under the title */
  K.pageHead = function (title, sub, extra, photo) {
    const src = photo ? K.pagePhoto(photo) : '';
    return h('section', { class: 'phead' + (src ? ' photo' : ' speckle') }, K.photoLayer(src), K.rays('ph-rays'),
      h('div', { class: 'wrap phead-in' },
        h('div', null, h('h1', { class: 'ptitle' }, title), sub ? h('p', { class: 'psub' }, sub) : null),
        extra || null));
  };
  /* the whole station ticked off: a moment for it (Ready for service) */
  function maybeCelebrate(st) {
    const items = K.checkItems(st);
    if (!items.length || !items.every((it) => K.markState(st, it.id) === 'ok')) return false;
    K.vibrate([20, 40, 20]);
    ui.sheet = { type: 'ready', st: st, n: items.length, at: Date.now() };
    K.render();
    return true;
  }
  const firstName = () => String(K.me.name || '').trim().split(/\s+/)[0];
  K.SHEETS.ready = function (S) {
    const close = () => { ui.sheet = null; K.render(); }, name = firstName(), print = K.canPrint && K.canPrint();
    const burst = h('span', { class: 'ready-burst', 'aria-hidden': 'true' });
    burst.innerHTML = K.burstSvg();
    if (!S.shown) { S.shown = true; setTimeout(() => { const b = document.getElementById('ready-ok'); if (b) b.focus({ preventScroll: true }); }, 60); }
    return h('div', { class: 'ready-back', role: 'dialog', 'aria-modal': 'true', 'aria-label': K.ST[S.st] + ' is ready for service', onkeydown: (e) => { if (e.key === 'Escape') close(); } },
      h('div', { class: 'ready-in' }, burst,
        h('p', { class: 'ready-kick mono' }, S.n + ' of ' + S.n + ' ready · ' + K.hm(S.at)),
        h('h2', { class: 'ready-title' }, 'Ready for', h('br'), 'service'),
        h('p', { class: 'ready-line' }, 'Every line on ' + K.ST[S.st] + ' is set. Beautiful work' + (name ? ', ' + name : '') + '.'),
        h('div', { class: 'ready-btns' },
          h('button', { class: 'btn primary wide', type: 'button', id: 'ready-ok', onclick: close }, 'Back to Today'),
          print ? h('button', { class: 'btn wide ready-print', type: 'button', onclick: () => { ui.sheet = { type: 'print', n: 1, st: S.st }; K.render(); } }, K.icon('print'), 'Print tomorrow’s list') : null)));
  };
  function markReady(st, it) {
    ui.pop = it.id;
    K.setMark(st, it, { d: 'ok' });
    return maybeCelebrate(st);
  }
  /* the time words of an event: "19:30 арт тур · 20:00 вечеря" -> 19:30 арт тур, 20:00 вечеря */
  function eventTimes(e) {
    const out = [], re = /(\d{1,2})[:.](\d{2})\s*([^·,;|\d]*)/g;
    let m;
    while ((m = re.exec(e.time || ''))) out.push({ t: m[1].padStart(2, '0') + ':' + m[2], what: m[3].trim() });
    return out;
  }
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const evWhen = (e, ts) => (K.daysUntil(e.date) === 0 ? (ts.length && ts[0].t >= '17:00' ? 'tonight' : 'today') : 'tomorrow');
  const openEvent = (e) => () => { ui.calSel = e.date; ui.calMonth = e.date.slice(0, 7); K.go('events'); };
  function hello() {
    const m = K.kitchenMinutes();
    return m < 12 * 60 ? 'Good morning' : m < 17 * 60 ? 'Good afternoon' : m < 23 * 60 ? 'Good evening' : 'Late shift';
  }
  /* the top of Today: a greeting under the Komat rays (they draw in once per visit) and the station picker */
  function welcome(st, feat) {
    const name = firstName(), draw = !ui.raysDrawn, urg = K.openUrgents().length;
    ui.raysDrawn = true;
    let line;
    if (feat) {
      const ts = eventTimes(feat);
      line = (feat.title || 'An event') + ' is ' + evWhen(feat, ts) + (feat.guests ? ': ' + feat.guests + ' guests' : '') + (ts.length ? ', from ' + ts[0].t : '') + '.';
    } else line = urg ? urg + ' urgent ' + (urg === 1 ? 'item' : 'items') + ' across the kitchen.' : 'Nothing urgent so far.';
    const rays = h('span', { class: 'w-rays', 'aria-hidden': 'true' });
    rays.innerHTML = K.welcomeRaysSvg();
    return h('section', { class: 'phead welcome' + (draw ? ' draw' : '') }, rays,
      h('div', { class: 'wrap welcome-in' },
        h('div', { class: 'wtext' },
          h('span', { class: 'wdate mono' }, K.parseYmd(K.day(0)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })),
          h('span', { class: 'wkick' }, greeting() + ' · ' + K.ST[st]),
          h('h1', { class: 'whello' }, hello() + (name ? ',' : ''), name ? h('span', { class: 'wname' }, name) : null),
          h('p', { class: 'wline' }, line)),
        stationPicker()));
  }
  /* the next event, today or tomorrow: when, how many, the run of the evening and a taste of the menu */
  function tonightCard(e) {
    const ts = eventTimes(e), d = K.parseYmd(e.date);
    const dishes = K.evDishes(e).map((x) => x.name || (K.linkTarget(x.link) || {}).name).filter(Boolean).map((n) => n.replace(/\s*\([^)]*\)\s*$/, ''));
    return h('section', { class: 'tonight card' },
      h('button', { type: 'button', class: 'tn-head', onclick: openEvent(e) },
        h('span', { class: 'tn-date' }, h('span', { class: 'mono' }, d.toLocaleDateString('en-GB', { month: 'short' })), h('b', null, String(d.getDate()))),
        h('span', { class: 'tn-txt' },
          h('span', { class: 'tn-kick' }, cap(evWhen(e, ts))),
          h('span', { class: 'tn-title' }, e.title || 'Event'),
          h('span', { class: 'muted' }, [e.guests ? e.guests + ' guests' : '', e.kind || ''].filter(Boolean).join(' · '))),
        K.icon('next')),
      ts.length ? h('ol', { class: 'tn-line' + (ts.length === 1 ? ' one' : '') }, ts.map((x, i) => h('li', { class: ts.length > 1 && i === ts.length - 1 ? 'tn-main' : null },
        h('span', { class: 'tn-dot', 'aria-hidden': 'true' }), h('b', { class: 'mono' }, x.t), x.what ? h('span', null, cap(x.what)) : null))) : null,
      dishes.length ? h('div', { class: 'tn-dishes' }, dishes.slice(0, 5).map((n) => h('span', { class: 'tn-dish' }, n)),
        dishes.length > 5 ? h('span', { class: 'tn-dish more' }, '+' + (dishes.length - 5) + ' more') : null) : null);
  }
  function greeting() {
    const m = K.kitchenMinutes();
    return m < 11 * 60 ? 'Morning prep' : m < 16 * 60 ? 'Afternoon' : m < 23 * 60 ? 'Evening service' : 'Closing time';
  }
  function stationPicker() {
    const cur = K.getStation();
    return h('div', { class: 'stpick', role: 'group', 'aria-label': 'I am on' },
      h('span', { class: 'label on-dark' }, 'I’m on'),
      h('div', { class: 'stpick-btns' }, K.STATIONS.map((s) => h('button', { type: 'button', class: 'st-' + s[0], 'aria-pressed': cur === s[0] ? 'true' : 'false', onclick: () => K.pickStation(s[0]) }, K.icon(K.ST_ICON[s[0]]), h('span', null, s[1])))));
  }

  K.addBoardPhoto = function () {
    K.pickFile('image/*', false, (f) => {
      ui.boardBusy = true; K.render();
      K.photoDataUrl(f[0]).then(K.saveBoard).then(() => { ui.boardBusy = false; K.render(); K.toast('Whiteboard photo added'); }, (e) => {
        ui.boardBusy = false; K.render();
        if (e && e.message === 'read') K.toast('That photo could not be read. Try another.', { tone: 'bad' }); else K.writeFailed(e);
      });
    });
  };

  /* ---------- the daily brief ---------- */
  function brief(feat) {
    const urg = K.openUrgents(), os = K.onToday();
    const ev = K.upcomingEvents().filter((e) => K.daysUntil(e.date) <= 3 && K.isLive(e) && e !== feat);
    const box = h('section', { class: 'brief card' }, h('div', { class: 'brief-head' }, h('h2', null, 'Daily brief'), h('span', { class: 'muted' }, greeting())));
    box.append(h('div', { class: 'brief-sec' }, h('span', { class: 'label' + (urg.length ? ' bad' : '') }, urg.length ? 'Urgent · ' + urg.length : 'Urgent'),
      urg.length ? h('div', { class: 'urglist' }, urg.map((d) => h('div', { class: 'urgrow' },
        h('button', { type: 'button', class: 'urgname', onclick: () => K.pickStation(d.station) },
          h('b', null, d.name), d.note ? h('span', { class: 'tnote' }, d.note) : null,
          h('span', { class: 'urgmeta' }, [K.ST[d.station] || d.station, d.urgentAt || d.at ? 'since ' + K.hm(d.urgentAt || d.at) : '', K.nameOf(d.by)].filter(Boolean).join(' · '))),
        h('button', { type: 'button', class: 'pbtn done', onclick: () => (d.check ? doneMark(d.station, d.it) : doneTask(d.station, { key: d.key, name: d.name }, d._id)) }, K.icon('check'), 'Done'))))
        : h('p', { class: 'none' }, 'Nothing urgent. Smooth so far.')));
    if (ev.length) box.append(h('div', { class: 'brief-sec' }, h('span', { class: 'label' }, 'Events coming up'),
      h('div', { class: 'evmini' }, ev.map((e) => h('button', { type: 'button', class: 'evchip', onclick: () => { ui.calSel = e.date; ui.calMonth = e.date.slice(0, 7); K.go('events'); } },
        h('b', null, K.countdown(e)), h('span', null, (e.title || 'Event') + (e.time ? ' · ' + e.time : '') + (e.guests ? ' · ' + e.guests + ' guests' : '')))))));
    if (os.length) box.append(h('div', { class: 'brief-sec' }, h('span', { class: 'label' }, 'On today'),
      h('div', { class: 'tags' }, os.map((x) => h('span', { class: 'codechip ' + K.codeClass(x.code) }, K.personName(x.id), h('b', { class: 'mono' }, x.code))))));
    return box;
  }

  /* ---------- actions with undo ---------- */
  function doneMark(st, it) {
    const prev = K.mark(st, it.id) || {};
    K.vibrate(15);
    if (markReady(st, it)) return;
    K.toast('Ready: ' + it.name, { tone: 'good', undo: () => K.setMark(st, it, { d: prev.d || 'do', u: !!prev.u }) });
  }
  function doneTask(st, it, id) {
    const before = id && D.prep[id] ? K.clone(D.prep[id]) : null;
    K.setPrep(st, it, 'done');
    K.vibrate(15);
    K.toast('Done: ' + it.name, { tone: 'good', undo: () => {
      if (!before) { K.setPrep(st, it, ''); return; }
      if (id !== K.prepId(it.key)) K.removePrep(K.prepId(it.key));
      K.restorePrep(id, before);
    } });
  }

  /* inline comment editor under a row */
  function noteForm(key, cur, save) {
    if (ui.noteFor !== key) return null;
    return h('form', { class: 'noteform', onsubmit: (e) => { e.preventDefault(); ui.noteFor = null; save((document.getElementById('noteedit').value || '').trim()); } },
      h('input', { class: 'input', id: 'noteedit', value: cur || '', placeholder: 'Comment, e.g. use the old batch first', 'aria-label': 'Comment', autofocus: true }),
      h('button', { class: 'btn primary small', type: 'submit' }, 'Save'),
      cur ? h('button', { class: 'btn small', type: 'button', onclick: () => { ui.noteFor = null; save(''); } }, 'Clear')
        : h('button', { class: 'btn small', type: 'button', onclick: () => { ui.noteFor = null; K.render(); } }, 'Cancel'));
  }
  function noteToggle(key) { ui.noteFor = ui.noteFor === key ? null : key; K.render(); }
  function groupDish(gname, items) {
    const ids = {};
    (items || []).forEach((it) => { if (it.link) { const id = String(it.link).split('~')[0]; if (K.find(id)) ids[id] = (ids[id] || 0) + 1; } });
    const best = Object.keys(ids).sort((a, b) => ids[b] - ids[a])[0];
    if (best) return best;
    const hit = D.recipes.find((r) => r.type === 'dish' && K.nameMatch(r.name, gname, true));
    return hit ? hit.id : null;
  }
  /* where a row leads: its own recipe, else the dish its group belongs to */
  function rowTarget(st, it) {
    const lk = K.linkTarget(it.link);
    if (lk) return { id: lk.r.id, ci: lk.ci, own: true };
    let g = null;
    K.sections(st).forEach((sec) => sec.groups.forEach((x) => { if (!g && x.key === it.gkey) g = x; }));
    const d = g ? groupDish(g.name, g.items) : null;
    return d ? { id: d, ci: -1, own: false } : null;
  }
  function openLink(tg) { K.go('recipe', { id: tg.id, comp: tg.ci }); }

  /* ---------- to-do rows ---------- */
  /* a to-do: tap the circle (or swipe right) when it's done, swipe left to remove,
     tap the words to add a comment, ! flags it urgent for everyone */
  function todoRow(o) {
    const nkey = o.noteKey;
    const done = (btn) => { if (btn) btn.classList.add('ticked'); K.vibrate(12); setTimeout(o.onDone, btn ? 160 : 0); };
    const row = h('div', { class: 'todo' + (o.urgent ? ' urgent' : '') + (o.kind ? ' ' + o.kind : '') },
      h('div', { class: 'sw-bg', 'aria-hidden': 'true' }, h('span', { class: 'sw-ready' }, K.icon('check'), 'Done'), o.onRemove ? h('span', { class: 'sw-del' }, 'Remove', K.icon('close')) : h('span')),
      h('div', { class: 'sw-in' },
        h('button', { type: 'button', class: 'tcheck', 'aria-label': 'Done: ' + o.name, onclick: (e) => done(e.currentTarget) }, K.icon('check')),
        h(nkey ? 'button' : 'div', { class: 'todo-main', type: nkey ? 'button' : null, onclick: nkey ? () => noteToggle(nkey) : null, 'aria-label': nkey ? o.name + (o.note ? '. Comment: ' + o.note + '. Tap to edit the comment' : '. Tap to add a comment') : null },
          h('span', { class: 'todo-name' }, o.urgent ? h('span', { class: 'urgtag' }, 'Urgent') : null, o.name),
          o.note ? h('span', { class: 'tnote' }, o.note) : null,
          h('span', { class: 'todo-meta' }, o.meta.filter(Boolean).map((m) => h('span', null, m)),
            o.link ? h('span', { class: 'recipelink', role: 'link', tabindex: '0', onclick: (e) => { e.stopPropagation(); openLink(o.link); }, onkeydown: (e) => { if (e.key === 'Enter') { e.stopPropagation(); openLink(o.link); } } }, o.link.own ? 'Recipe' : 'Dish', K.icon('next')) : null,
            nkey && !o.note ? h('span', { class: 'addnote' }, '+ comment') : null)),
        o.onUrgent ? h('button', { type: 'button', class: 'mflag' + (o.urgent ? ' on' : ''), 'aria-pressed': o.urgent ? 'true' : 'false', 'aria-label': (o.urgent ? 'Unmark ' : 'Mark ') + o.name + ' as urgent', onclick: o.onUrgent }, '!') : null));
    K.swipeable(row, { right: { run: () => done(null) }, left: o.onRemove ? { run: o.onRemove } : null });
    const f = nkey ? noteForm(nkey, o.note, o.onNote) : null;
    return f ? h('div', { class: 'todo-wrap' }, row, f) : row;
  }
  function carryLabel(d) {
    const who = K.nameOf(d.leftBy || d.by);
    if (d._from === K.day(-1) && d.leftAt) { const hr = new Date(d.leftAt).getHours(); if (hr >= 18 || hr < 4) return 'Left last night' + (who ? ' by ' + who : ''); }
    return 'Still open from ' + (d._from === K.day(-1) ? 'yesterday' : K.prettyDate(d._from, { weekday: 'long' }));
  }

  /* ---------- the Today page ---------- */
  K.V.today = function () {
    const st = K.getStation(), body = h('div', { class: 'page' });
    const feat = K.upcomingEvents().find((e) => K.isLive(e) && K.daysUntil(e.date) <= 1);
    body.append(welcome(st, feat));
    const w = h('div', { class: 'wrap today' });
    body.append(w);
    const items = K.checkItems(st);
    const ready = items.filter((it) => K.markState(st, it.id) === 'ok').length;
    const doItems = items.filter((it) => K.markState(st, it.id) === 'do' || K.isUrgent(st, it.id)).sort((a, b) => (K.isUrgent(st, b.id) ? 1 : 0) - (K.isUrgent(st, a.id) ? 1 : 0));
    const tasks = K.dayTasks(st);
    const todoTasks = tasks.filter((d) => d.status === 'need' && !String(d.key).startsWith('evt-') && !String(d.key).startsWith('auto-')).sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));
    const doneTasks = tasks.filter((d) => d.status === 'done' && !String(d.key).startsWith('evt-'));
    const evTodo = K.eventTasksToday(st).filter((k) => K.evTaskStatus(k.key) !== 'done');
    const reps = K.repeatsToday(st).filter((x) => !x.done);
    const todoN = doItems.length + todoTasks.length + evTodo.length + reps.length;

    /* phones: a sticky bar to jump between the parts of the page */
    const jumpTo = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); };
    /* three tiles under the greeting: the list, the to-do, and the evening (or what is urgent) */
    const urgN = K.openUrgents().length, fts = feat ? eventTimes(feat) : [];
    const tile = (cls, big, label, onclick) => h('button', { type: 'button', class: 'tile' + (cls ? ' ' + cls : ''), onclick: onclick }, h('span', { class: 'tile-n mono' }, big), h('span', { class: 'tile-l' }, label));
    w.append(h('div', { class: 'tiles' },
      tile('tile-mep' + (items.length && ready === items.length ? ' done' : ''), [String(ready), h('span', { class: 'of' }, '/' + items.length)], items.length && ready === items.length ? 'Ready for service' : 'Mise en place', () => jumpTo('t-mep')),
      tile('', String(todoN), 'To do', () => jumpTo('t-todo')),
      feat ? tile('accent', fts.length ? fts[0].t : K.countdown(feat), fts.length && fts[0].what ? cap(fts[0].what) : feat.title || 'Event', openEvent(feat))
        : tile(urgN ? 'bad' : '', String(urgN), 'Urgent', () => jumpTo('t-brief'))));
    if (feat) w.append(tonightCard(feat));
    w.append(h('nav', { class: 'tjump', 'aria-label': 'Jump to' },
      h('button', { type: 'button', onclick: () => jumpTo('t-todo') }, 'To do', h('b', { class: 'mono' }, String(todoN))),
      h('button', { type: 'button', onclick: () => jumpTo('t-mep') }, 'Mise en place', h('b', { class: 'mono' }, ready + '/' + items.length)),
      h('button', { type: 'button', onclick: () => jumpTo('t-tmr') }, 'Tomorrow')));
    const grid = h('div', { class: 'today-grid' });
    w.append(grid);
    const left = h('div', { class: 'today-main' }), right = h('aside', { class: 'today-side' });
    grid.append(left, right);
    left.append(h('div', { class: 'only-narrow', id: 't-brief' }, brief(feat)));
    right.append(h('div', { class: 'only-wide' }, brief(feat)));

    /* to do */
    const todo = h('section', { class: 'block', id: 't-todo' }, h('div', { class: 'block-top' }, h('h2', { class: 'block-title' }, 'To do', h('span', { class: 'n' }, String(todoN))),
      K.canPrint && K.canPrint() ? h('button', { class: 'icon-btn print-btn', type: 'button', 'aria-label': 'Print the to-do list', title: 'Print the to-do list', onclick: () => K.openPrint() }, K.icon('print')) : null));
    const rows = [];
    reps.forEach((x) => rows.push(todoRow({ name: x.name, kind: 'repeat', urgent: true, meta: ['Every ' + K.daysLabel(x.days)], onDone: () => doneTask(st, { key: x.key, name: x.name }, null) })));
    evTodo.forEach((k) => rows.push(todoRow({ name: k.name, kind: 'event', meta: [(k.late ? 'Overdue · ' : '') + 'Event: ' + (k.event.title || '') + ' · ' + K.countdown(k.event)],
      onDone: () => { K.setPrep(st, { key: k.key, name: k.name }, 'done'); K.toast('Done: ' + k.name, { tone: 'good', undo: () => K.setPrep(st, { key: k.key, name: k.name }, '') }); } })));
    todoTasks.forEach((d) => {
      const it = { key: d.key, name: d.name, note: d.note || '', origId: d._orig };
      rows.push(todoRow({
        name: d.name, note: d.note, urgent: !!d.urgent, noteKey: 'p:' + d._id,
        meta: [d._from ? carryLabel(d) : d.leftBy !== undefined ? 'Left from yesterday' + (K.nameOf(d.leftBy) ? ' by ' + K.nameOf(d.leftBy) : '') : 'Task', d.urgent && K.nameOf(d.by) ? 'flagged by ' + K.nameOf(d.by) : ''],
        onUrgent: () => K.setPrep(st, it, 'need', !d.urgent),
        onRemove: () => { const before = K.clone(D.prep[d._id]); K.removePrep(d._id); K.toast('Removed: ' + d.name, { undo: () => K.restorePrep(d._id, before) }); },
        onDone: () => doneTask(st, it, d._id),
        onNote: (t) => K.setPrepNote(d._id, t),
      }));
    });
    doItems.forEach((it) => {
      const m = K.mark(st, it.id) || {}, u = K.isUrgent(st, it.id);
      rows.push(todoRow({
        name: it.name, note: m.c, urgent: u, noteKey: 'm:' + it.id, link: rowTarget(st, it),
        meta: [it.group, m.from ? 'Still open from ' + (m.from === K.day(-1) ? 'yesterday' : K.prettyDate(m.from, { weekday: 'long' })) : '', u && K.nameOf(m.by) ? 'flagged by ' + K.nameOf(m.by) : ''],
        onUrgent: () => K.setMark(st, it, { u: !u }),
        onDone: () => doneMark(st, it),
        onNote: (t) => K.setMark(st, it, { c: t }),
      }));
    });
    if (rows.length) todo.append(h('p', { class: 'hint todo-hint' }, 'Tap the circle when it’s done, or swipe right. Swipe left to remove a task.'));
    todo.append(rows.length ? h('div', { class: 'todos' }, rows) : K.catRest('All clear', 'Nothing is waiting on you. Mark a row DO in the list below, or add a task.'));
    todo.append(addTaskForm('new', 'Add a task, e.g. portion 20 sea bass', 'Add', (t, urg, note) => K.setPrep(st, { key: 'task-' + K.uid(), name: t, note: note }, 'need', urg)));
    left.append(todo);

    /* order: only what tomorrow's prep list needs */
    const order = K.orderFor(st), nTmr = K.checkItems(st, K.day(1)).filter((it) => K.markState(st, it.id, K.day(1)) === 'do').length;
    left.append(h('button', { class: 'askorder' + (order ? ' sent' : ''), type: 'button', onclick: () => K.startStock(st, false) },
      K.icon('order'),
      h('span', { class: 'ask-txt' }, h('b', null, order ? 'Order sent for ' + K.ST[st] : 'Anything to order?'),
        h('span', null, order ? order.items.length + (order.items.length === 1 ? ' item' : ' items') + ' · tap to change' : nTmr ? 'Ingredients for the ' + nTmr + (nTmr === 1 ? ' thing' : ' things') + ' on tomorrow’s prep list' : 'Mark tomorrow’s prep list first, then check its ingredients')),
      K.icon('next')));

    /* mise en place: today's list, or (after closing time) tomorrow's prep list */
    const tmr = K.planningTomorrow(), listDay = K.listDay();
    const dayName = (ds) => K.parseYmd(ds).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
    const pickDay = (v) => { ui.listFor = { v: v, day: K.day(0) }; ui.addTo = null; K.render(); };
    left.append(h('div', { class: 'block-top', id: 't-mep' }, h('h2', { class: 'block-title' }, tmr ? 'Tomorrow’s prep list' : 'Mise en place'),
      h('div', { class: 'btns' },
        items.length && !tmr ? h('button', { type: 'button', class: 'chip', 'aria-pressed': ui.leftOnly ? 'true' : 'false', onclick: () => { ui.leftOnly = !ui.leftOnly; K.render(); } }, 'Hide ready') : null,
        K.me.admin ? h('button', { class: 'btn small', type: 'button', onclick: () => { ui.listDraft = null; K.go('lists'); } }, K.icon('edit'), 'Edit list') : null)),
      h('div', { class: 'daypick-row' }, K.seg([['today', 'Today · ' + dayName(K.day(0))], ['tomorrow', 'Tomorrow · ' + dayName(K.day(1))]], tmr ? 'tomorrow' : 'today', pickDay, { 'aria-label': 'Which day’s list', class: 'seg daypick-seg' })),
      tmr ? h('p', { class: 'plan-note' }, h('b', null, 'Closing check for ' + K.prettyDate(K.day(1), { weekday: 'long' }) + '. '), 'Mark DO on everything the next shift needs to make. It is waiting on their list in the morning.')
        : items.length ? h('p', { class: 'hint legend-row' }, 'Tap the box: ', h('span', { class: 'mbox sample do' }, 'DO'), ' then ', h('span', { class: 'mbox sample ok' }, K.icon('check')), ' ready. Or swipe a row: right for ready, left for DO. ', h('b', { class: 'flagtxt' }, '!'), ' flags it urgent for everyone.') : null);
    left.append(checklist(st, tmr ? listDay : null));
    const cl = K.closedInfo(st);
    left.append(h('div', { class: 'finish' + (cl ? ' done' : '') },
      cl ? h('p', null, h('b', null, 'Mise en place finished'), ' at ' + K.hm(cl.at) + (K.nameOf(cl.by) ? ' by ' + K.nameOf(cl.by) : '') + '.') : null,
      tmr ? h('button', { class: 'btn ' + (cl ? '' : 'primary') + ' wide', type: 'button', onclick: () => K.startStock(st, true) }, cl ? 'Check ingredients again' : nTmr ? 'Done: check ingredients for these ' + nTmr : 'Done: nothing to make tomorrow')
        : h('button', { class: 'btn wide', type: 'button', onclick: () => { pickDay('tomorrow'); setTimeout(() => { const el = document.getElementById('t-mep'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); K.toast('Now mark what has to be made tomorrow'); } }, K.icon('next'), 'Closing? Write tomorrow’s prep list')));

    right.append(tomorrowBlock(st));
    if (doneTasks.length) right.append(h('details', { class: 'block card donebox' }, h('summary', null, 'Done today', h('span', { class: 'n' }, String(doneTasks.length))),
      h('div', { class: 'donelist' }, doneTasks.map((d) => h('div', { class: 'doneitem' }, K.icon('check'), h('span', null, d.name),
        h('button', { type: 'button', class: 'link-btn', onclick: () => K.setPrep(st, { key: d.key, name: d.name }, 'need') }, 'Undo'))))));
    return { body: body };
  };

  function addTaskForm(id, placeholder, label, onAdd) {
    const S = (ui.taskForms = ui.taskForms || {})[id] || (ui.taskForms[id] = { text: '', note: '', urgent: false, showNote: false });
    return h('form', { class: 'addtask', onsubmit: (ev) => {
      ev.preventDefault();
      const t = S.text.trim();
      if (!t) { K.toast('Write the task first.'); return; }
      onAdd(t, S.urgent, S.note.trim());
      ui.taskForms[id] = { text: '', note: '', urgent: false, showNote: false };
      K.render();
    } },
    h('div', { class: 'addtask-row' },
      h('input', { class: 'input', id: id + '-task', placeholder: placeholder, 'aria-label': 'New task', value: S.text, oninput: (e) => { S.text = e.target.value; } }),
      h('button', { type: 'button', class: 'pbtn flag' + (S.urgent ? ' on' : ''), 'aria-pressed': S.urgent ? 'true' : 'false', 'aria-label': 'Urgent', title: 'Urgent', onclick: () => { S.urgent = !S.urgent; K.render(); } }, '!'),
      h('button', { class: 'btn primary', type: 'submit' }, label)),
    S.showNote ? h('input', { class: 'input', id: id + '-note', placeholder: 'Comment (optional), e.g. 2 for the event, the rest for service', 'aria-label': 'Comment', value: S.note, oninput: (e) => { S.note = e.target.value; } })
      : h('button', { type: 'button', class: 'link-btn', onclick: () => { S.showNote = true; K.render(); const el = document.getElementById(id + '-note'); if (el) el.focus(); } }, '+ Add a comment'));
  }

  /* ---------- checklist ---------- */
  /* day: null for today's list, or tomorrow's date while writing tomorrow's prep list */
  function checklist(st, day) {
    const secs = K.sections(st), doc = D.checks[K.checkId(st, day)], when = day ? 'tomorrow' : 'today';
    if (!secs.length) return h('div', { class: 'empty' }, h('strong', null, 'No list for ' + K.ST[st] + ' yet'), K.me.admin ? 'Tap Edit list to add dishes and their prep.' : 'The head chef has not set it up yet.');
    return h('div', { class: 'mep' + (day ? ' planning' : '') }, secs.map((sec) => h('section', { class: 'mep-sec' },
      secs.length > 1 ? h('h3', { class: 'mep-title' }, sec.title) : null,
      h('div', { class: 'mep-groups' }, sec.groups.map((g) => {
        const extra = ((doc && doc.extra && doc.extra[g.key]) || []).map((x) => Object.assign({ extra: true }, x));
        let its = g.items.concat(extra).map((it) => Object.assign({ group: g.name, gkey: g.key }, it));
        const total = its.length, done = its.filter((it) => K.markState(st, it.id) === 'ok').length;
        const toMake = day ? its.filter((it) => K.markState(st, it.id, day) === 'do').length : 0;
        if (ui.leftOnly && !day) its = its.filter((it) => K.markState(st, it.id) !== 'ok');
        const adding = ui.addTo === st + '|' + g.key;
        const dish = groupDish(g.name, g.items);
        return h('div', { class: 'mep-group card' + (!day && total && done === total ? ' complete' : '') },
          h('div', { class: 'mep-gname' },
            dish ? h('button', { type: 'button', class: 'gname-link', onclick: () => K.go('recipe', { id: dish }) }, g.name) : h('b', null, g.name),
            day ? (toMake ? h('span', { class: 'gcount tomake' }, toMake + ' to make') : null) : total ? h('span', { class: 'gcount mono' }, done + '/' + total) : null,
            h('button', { class: 'mep-add', type: 'button', 'aria-label': 'Add an item to ' + g.name + ' for ' + when, 'aria-expanded': adding ? 'true' : 'false', onclick: () => { ui.addTo = adding ? null : st + '|' + g.key; K.render(); if (!adding) { const el = document.getElementById('addx'); if (el) el.focus(); } } }, K.icon(adding ? 'close' : 'plus'))),
          its.map((it) => mrow(st, it, day)),
          !total && !adding ? h('p', { class: 'hint pad' }, 'Changes daily. Tap + to add ' + (day ? 'tomorrow’s' : 'today’s') + ' items.') : null,
          ui.leftOnly && !day && total && !its.length ? h('p', { class: 'hint pad' }, 'All ready.') : null,
          adding ? h('form', { class: 'addx', onsubmit: (e) => { e.preventDefault(); const v = document.getElementById('addx').value.trim(); if (!v) return; ui.addTo = null; K.addExtra(st, g.key, v, day || undefined); } },
            h('input', { class: 'input', id: 'addx', placeholder: 'Item for ' + when + ' only', 'aria-label': 'Item for ' + when }), h('button', { class: 'btn primary small', type: 'submit' }, 'Add')) : null);
      })))));
  }
  function mrow(st, it, day) {
    if (day) return planRow(st, it, day);
    const s = K.markState(st, it.id), u = K.isUrgent(st, it.id), note = K.markNote(st, it.id), tg = rowTarget(st, it);
    const next = s === '' ? 'do' : s === 'do' ? 'ok' : '';
    const word = s === 'do' ? 'to do' : s === 'ok' ? 'ready' : 'not checked';
    const pop = ui.pop === it.id;
    if (pop) setTimeout(() => { if (ui.pop === it.id) ui.pop = null; }, 0);
    const row = h('div', { class: 'mrow' + (s ? ' ' + s : '') + (u ? ' urgent' : '') + (it.extra ? ' extra' : '') },
      h('div', { class: 'sw-bg', 'aria-hidden': 'true' }, h('span', { class: 'sw-ready' }, K.icon('check'), 'Ready'), h('span', { class: 'sw-do' }, 'DO')),
      h('div', { class: 'sw-in' },
      h('button', { type: 'button', class: 'mbox' + (s ? ' ' + s : '') + (pop ? ' pop' : ''), 'aria-label': it.name + ': ' + word + '. Tap for ' + (next === 'do' ? 'to do' : next === 'ok' ? 'ready' : 'not checked') + '.',
        onclick: () => { if (next === 'ok') { K.vibrate(12); markReady(st, it); } else K.setMark(st, it, { d: next }); } }, s === 'do' ? 'DO' : s === 'ok' ? K.icon('check') : ''),
      h('div', { class: 'mname' },
        tg ? h('button', { type: 'button', class: 'mlink', title: tg.own ? 'Open the recipe' : 'Open the dish', onclick: () => openLink(tg) }, it.name) : h('span', null, it.name),
        it.extra ? h('span', { class: 'xtag' }, 'today') : null,
        note ? h('span', { class: 'tnote' }, note) : null),
      it.extra ? h('button', { type: 'button', class: 'mflag', 'aria-label': 'Remove ' + it.name, onclick: () => K.removeExtra(st, it.gkey, it.id) }, K.icon('close')) : null,
      h('button', { type: 'button', class: 'mflag' + (u ? ' on' : ''), 'aria-pressed': u ? 'true' : 'false', 'aria-label': (u ? 'Unmark ' : 'Mark ') + it.name + ' as urgent', onclick: () => K.setMark(st, it, { u: !u }) }, '!')));
    return K.swipeable(row, {
      right: s === 'ok' ? null : { run: () => markReady(st, it) },
      left: s === 'do' ? null : { run: () => K.setMark(st, it, { d: 'do' }) },
    });
  }
  /* a row on tomorrow's prep list: DO = make it tomorrow, empty = we have enough */
  function planRow(st, it, day) {
    const m = K.mark(st, it.id, day) || {}, s = m.d === 'do' ? 'do' : '', u = K.isUrgent(st, it.id, day), note = m.c || '', tg = rowTarget(st, it);
    const set = (v) => { K.vibrate(v ? 10 : 6); K.setMark(st, it, { d: v }, day); };
    const row = h('div', { class: 'mrow' + (s ? ' do' : '') + (u ? ' urgent' : '') + (it.extra ? ' extra' : '') },
      h('div', { class: 'sw-bg', 'aria-hidden': 'true' }, h('span', { class: 'sw-ready' }, K.icon('check'), 'Enough'), h('span', { class: 'sw-do' }, 'DO')),
      h('div', { class: 'sw-in' },
        h('button', { type: 'button', class: 'mbox' + (s ? ' do' : ''), 'aria-label': it.name + (s ? ': needed tomorrow. Tap if there is enough.' : ': enough. Tap if it is needed tomorrow.'), onclick: () => set(s ? '' : 'do') }, s ? 'DO' : ''),
        h('div', { class: 'mname' },
          tg ? h('button', { type: 'button', class: 'mlink', title: tg.own ? 'Open the recipe' : 'Open the dish', onclick: () => openLink(tg) }, it.name) : h('span', null, it.name),
          it.extra ? h('span', { class: 'xtag' }, 'tomorrow') : null,
          m.from ? h('span', { class: 'xtag' }, 'not finished today') : null,
          note ? h('span', { class: 'tnote' }, note) : null),
        it.extra ? h('button', { type: 'button', class: 'mflag', 'aria-label': 'Remove ' + it.name, onclick: () => K.removeExtra(st, it.gkey, it.id, day) }, K.icon('close')) : null,
        h('button', { type: 'button', class: 'mflag' + (u ? ' on' : ''), 'aria-pressed': u ? 'true' : 'false', 'aria-label': (u ? 'Unmark ' : 'Mark ') + it.name + ' as urgent for tomorrow', onclick: () => K.setMark(st, it, { u: !u }, day) }, '!')));
    return K.swipeable(row, {
      right: s ? { run: () => set('') } : null,
      left: s ? null : { run: () => set('do') },
    });
  }

  /* ---------- for tomorrow ---------- */
  function tomorrowBlock(st) {
    const list = K.tomorrowTasks(st);
    return h('section', { class: 'block card tmr', id: 't-tmr' },
      h('h2', { class: 'block-title' }, 'For tomorrow', h('span', { class: 'n' }, K.prettyDate(K.day(1), { weekday: 'long' }))),
      h('p', { class: 'hint' }, 'Leave a note for whoever is on ' + K.ST[st] + ' tomorrow. It lands on their to-do list.'),
      list.length ? h('div', { class: 'todos' }, list.map((x) => K.swipeable(h('div', { class: 'todo' + (x.d.urgent ? ' urgent' : '') },
        h('div', { class: 'sw-bg', 'aria-hidden': 'true' }, h('span'), h('span', { class: 'sw-del' }, 'Remove', K.icon('close'))),
        h('div', { class: 'sw-in no-check' },
          h('div', { class: 'todo-main' }, h('span', { class: 'todo-name' }, x.d.urgent ? h('span', { class: 'urgtag' }, 'Urgent') : null, x.d.name), x.d.note ? h('span', { class: 'tnote' }, x.d.note) : null,
            h('span', { class: 'todo-meta' }, K.nameOf(x.d.leftBy) ? 'From ' + K.nameOf(x.d.leftBy) : 'Left today')),
          h('button', { class: 'mflag', type: 'button', 'aria-label': 'Remove ' + x.d.name, onclick: () => K.removePrep(x.id) }, K.icon('close')))),
        { left: { run: () => K.removePrep(x.id) } }))) : null,
      addTaskForm('tmr', 'e.g. Defrost 4 lamb saddles', 'Leave it', (t, urg, note) => K.leaveForTomorrow(st, t, urg, note)),
      h('p', { class: 'hint' }, 'For another station? Switch “I’m on” at the top first.'));
  }

  /* ---------- the head chef's list editor ---------- */
  K.V.lists = function () {
    const st = K.getStation();
    if (!ui.listDraft || ui.listDraft.st !== st) ui.listDraft = { st: st, secs: K.clone(K.sections(st)) };
    const L = ui.listDraft;
    const saveList = () => {
      const n = K.clone(D.checklists || { stations: {} });
      n.stations = n.stations || {};
      L.secs.forEach((sec) => {
        sec.title = (sec.title || '').trim() || 'Mise en place';
        sec.groups = sec.groups.filter((g) => g.name.trim());
        sec.groups.forEach((g) => { g.name = g.name.trim(); g.items = g.items.filter((i) => i.name.trim()).map((i) => { const o = { id: i.id, name: i.name.trim() }; if (i.link) o.link = i.link; return o; }); });
      });
      n.stations[st] = { sections: L.secs };
      ui.listDraft = null;
      K.saveChecklists(n, 'List saved');
      K.go('today');
    };
    const top = K.subbar('Today', () => { ui.listDraft = null; K.go('today'); }, [h('button', { class: 'btn small primary', type: 'button', onclick: saveList }, 'Save list')], 'Edit ' + K.ST[st] + ' list');
    const w = h('div', { class: 'wrap page form' });
    w.append(h('h1', { class: 'rtitle' }, K.ST[st] + ' mise en place'),
      h('p', { class: 'muted measure' }, 'The standing list the team ticks every day. Link a row to its recipe so the recipe opens from the list and its ingredients show up in the order check. When you change a dish, linked rows can follow.'),
      stationPicker());
    L.secs.forEach((sec, si) => {
      w.append(h('section', { class: 'lsec' },
        h('div', { class: 'xrow' }, h('input', { class: 'input big', id: 'ls' + si, value: sec.title, 'aria-label': 'Section title', oninput: (e) => { sec.title = e.target.value; } }),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove section ' + sec.title, onclick: () => { if (!sec.confirm) { sec.confirm = true; K.render(); return; } L.secs.splice(si, 1); K.render(); } }, sec.confirm ? 'Sure?' : K.icon('trash'))),
        sec.groups.map((g, gi) => h('div', { class: 'lgroup card' },
          h('div', { class: 'xrow' }, h('input', { class: 'input strong', id: 'lg' + si + '-' + gi, value: g.name, placeholder: 'Dish or group', 'aria-label': 'Dish or group', oninput: (e) => { g.name = e.target.value; } }),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move ' + g.name + ' up', disabled: gi === 0, onclick: () => { sec.groups.splice(gi - 1, 0, sec.groups.splice(gi, 1)[0]); K.render(); } }, K.icon('up')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove ' + g.name, onclick: () => { sec.groups.splice(gi, 1); K.render(); } }, K.icon('trash'))),
          g.items.map((it, ii) => h('div', { class: 'litem' },
            h('input', { class: 'input', id: 'li' + si + '-' + gi + '-' + ii, value: it.name, placeholder: 'Item', 'aria-label': 'Item', oninput: (e) => { it.name = e.target.value; } }),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move ' + it.name + ' up', disabled: ii === 0, onclick: () => { g.items.splice(ii - 1, 0, g.items.splice(ii, 1)[0]); K.render(); } }, K.icon('up')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move ' + it.name + ' down', disabled: ii === g.items.length - 1, onclick: () => { g.items.splice(ii + 1, 0, g.items.splice(ii, 1)[0]); K.render(); } }, K.icon('down')),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove ' + it.name, onclick: () => { g.items.splice(ii, 1); K.render(); } }, K.icon('close')),
            K.select(K.recipeOptions('No recipe linked').concat(it.link && !K.linkTarget(it.link) ? [[it.link, '(recipe was deleted)']] : []), it.link || '', (v) => { it.link = v; }, { class: 'input small linksel', 'aria-label': 'Recipe for ' + (it.name || 'item') }),
            it.link && !K.linkTarget(it.link) ? h('span', { class: 'linkwarn' }, 'The linked recipe is gone. Pick it again or remove the row.') : null)),
          h('button', { class: 'btn small', type: 'button', onclick: () => { g.items.push({ id: 'i' + K.uid(), name: '' }); K.render(); } }, K.icon('plus'), 'Item'))),
        h('button', { class: 'btn small', type: 'button', onclick: () => { sec.groups.push({ key: 'g' + K.uid(), name: '', items: [] }); K.render(); } }, K.icon('plus'), 'Dish or group')));
    });
    w.append(h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', onclick: () => { L.secs.push({ title: 'New section', groups: [] }); K.render(); } }, K.icon('plus'), 'Section')));
    return { top: top, body: w, tabs: false, bar: h('button', { class: 'btn primary wide', type: 'button', onclick: saveList }, K.icon('check'), 'Save list') };
  };
})();
