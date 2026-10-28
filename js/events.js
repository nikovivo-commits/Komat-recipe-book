/* Events: groups, breakfast events and private dinners, with their food and prep tasks. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const KINDS = ['Group', 'Breakfast event', 'Private dinner', 'Catering', 'Other'];
  const STATUS = [['confirmed', 'Confirmed'], ['pending', 'Awaiting confirmation'], ['cancelled', 'Cancelled']];

  function whenLabel(n) { n = +n || 0; const w = K.WHEN.find((x) => x[0] === n); return w ? w[1] : n + ' days before'; }
  function openScaled(d) {
    const lk = K.linkTarget(d.link);
    if (!lk) return;
    const f = K.scaleFor(d), factors = {}, from = {};
    if (f) {
      if (lk.ci >= 0) { factors.x = f; from.x = d.qty + ' portions'; }
      else { factors.m = f; from.m = d.qty + ' portions'; lk.r.components.forEach((c, i) => { factors['c' + i] = f; from['c' + i] = d.qty + ' portions'; }); }
    }
    K.go('recipe', { id: lk.r.id, comp: lk.ci, factors: factors, scaleFrom: from });
  }

  function eventCard(e) {
    const d = K.daysUntil(e.date), dishes = K.evDishes(e), tasks = K.evTasks(e);
    const doneN = tasks.filter((k) => K.evTaskStatus('evt-' + e.id + '-' + k.id) === 'done').length;
    const when = K.countdown(e) + (d > 1 ? ' · ' + K.prettyDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' }) : '') + (e.time ? ' · ' + e.time : '');
    const card = h('article', { class: 'evt card' + (d === 0 ? ' today' : d > 0 && d <= 3 ? ' soon' : '') + (e.status === 'cancelled' ? ' cancelled' : '') },
      h('div', { class: 'evt-head' },
        h('div', { class: 'evt-when-box' }, h('span', { class: 'evt-day mono' }, String(K.parseYmd(e.date).getDate())), h('span', { class: 'evt-mon' }, K.prettyDate(e.date, { month: 'short' }))),
        h('div', { class: 'evt-txt' },
          h('span', { class: 'evt-when' }, when),
          h('h3', { class: 'evt-title' }, e.title || 'Event'),
          h('span', { class: 'evt-meta' }, [e.kind, e.guests ? e.guests + ' guests' : '', e.contact].filter(Boolean).join(' · ')),
          e.status === 'cancelled' || e.status === 'pending' || e.source === 'email' ? h('span', { class: 'evt-badges' },
            e.status === 'cancelled' ? h('span', { class: 'ebadge bad' }, 'Cancelled') : null,
            e.status === 'pending' ? h('span', { class: 'ebadge warn' }, 'Awaiting confirmation') : null,
            e.source === 'email' ? h('span', { class: 'ebadge' }, 'From the booking email') : null) : null),
        K.me.admin ? h('button', { class: 'btn small', type: 'button', onclick: () => { const x = K.clone(e); x.dishes = K.evDishes(e); x.tasks = K.evTasks(e); ui.sheet = { type: 'event', e: x }; K.render(); } }, K.icon('edit'), 'Edit') : null));
    if (dishes.length) card.append(h('div', { class: 'evt-block' }, h('span', { class: 'label' }, 'Food'),
      h('ul', { class: 'evt-dishes' }, dishes.map((x) => {
        const lk = K.linkTarget(x.link), f = K.scaleFor(x);
        return h('li', null, lk ? h('button', { class: 'linkish', type: 'button', onclick: () => openScaled(x) }, x.name || lk.name, K.icon('next')) : h('span', null, x.name),
          x.qty ? h('span', { class: 'muted' }, ' · ' + x.qty + ' portions' + (f ? ' (recipe ×' + K.fmtNum(f) + ')' : '')) : null);
      }))));
    if (e.menu) card.append(h('div', { class: 'evt-block' }, h('span', { class: 'label' }, 'Menu notes'), h('p', { class: 'prose' }, e.menu)));
    if (e.notes) card.append(h('div', { class: 'evt-block' }, h('span', { class: 'label' }, 'Notes for the kitchen'), h('p', { class: 'prose' }, e.notes)));
    if (e.emailNotes) card.append(h('details', { class: 'evt-block' }, h('summary', { class: 'label' }, 'From the booking email'), h('p', { class: 'prose' }, e.emailNotes)));
    if (e.source === 'email' && !dishes.length && K.me.admin && e.status !== 'cancelled') card.append(h('p', { class: 'banner warn' }, 'Added from the booking email. Tap Edit to add the food, then “Make the prep list from the food”.'));
    if (tasks.length) card.append(h('div', { class: 'evt-block' }, h('span', { class: 'label' }, 'Prep list · ' + doneN + ' of ' + tasks.length + ' done'),
      h('ul', { class: 'evt-tasks' }, tasks.slice().sort((a, b) => (b.before || 0) - (a.before || 0)).map((k) => {
        const st = K.evTaskStatus('evt-' + e.id + '-' + k.id), due = K.dueDate(e, k);
        return h('li', { class: st === 'done' ? 'done' : '' }, h('span', { class: 'evt-tick' }, st === 'done' ? K.icon('check') : h('span', { class: 'ring-dot' })),
          h('span', null, k.text, h('small', null, (K.ST[k.station] || k.station) + ' · ' + whenLabel(k.before) + (due === K.day(0) ? ' · due today' : due < K.day(0) && st !== 'done' && e.date >= K.day(0) ? ' · overdue' : ''))));
      }))));
    return card;
  }

  function calendar() {
    const ym = ui.calMonth || K.day(0).slice(0, 7), p = ym.split('-'), first = new Date(+p[0], +p[1] - 1, 1);
    const start = K.mondayOf(first), today = K.day(0), sel = ui.calSel || '';
    const weeks = Math.ceil(((first.getDay() + 6) % 7 + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7);
    const shift = (n) => { const d = new Date(first.getFullYear(), first.getMonth() + n, 1); ui.calMonth = K.ymd(d).slice(0, 7); ui.calSel = ''; K.render(); };
    const cells = [];
    for (let i = 0; i < weeks * 7; i++) cells.push(K.addDays(start, i));
    return h('section', { class: 'cal card' },
      h('div', { class: 'cal-head' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous month', onclick: () => shift(-1) }, K.icon('back')),
        h('h2', null, first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Next month', onclick: () => shift(1) }, K.icon('next'))),
      h('div', { class: 'cal-grid' }, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((x, i) => h('span', { class: 'cal-dow' }, h('span', { class: 'daydot', style: { background: K.DAY_DOTS[i] }, 'aria-hidden': 'true' }), x)),
        cells.map((d) => {
          const ds = K.ymd(d), ev = K.eventsOn(ds).filter(K.isLive), out = d.getMonth() !== first.getMonth();
          return h('button', { type: 'button', class: 'cal-day' + (out ? ' out' : '') + (ds === today ? ' today' : '') + (ds === sel ? ' sel' : '') + (ev.length ? ' has' : ''),
            'aria-label': K.prettyDate(ds) + (ev.length ? ', ' + ev.length + (ev.length === 1 ? ' event' : ' events') : ''), 'aria-pressed': ds === sel ? 'true' : 'false',
            onclick: () => { ui.calSel = ds === sel ? '' : ds; K.render(); } },
          h('span', { class: 'cal-n mono' }, String(d.getDate())),
          ev.slice(0, 2).map((e) => h('span', { class: 'cal-ev' }, e.title || 'Event')),
          ev.length > 2 ? h('span', { class: 'cal-ev more' }, '+' + (ev.length - 2)) : null);
        })));
  }
  function blankEvent(ds) { return { id: '', date: ds || K.day(0), time: '', title: '', kind: 'Group', guests: '', contact: '', menu: '', notes: '', status: 'confirmed', dishes: [], tasks: [] }; }

  /* this week as seven buttons: today ringed, a dot under days with an event */
  function weekStrip() {
    const mon = K.mondayOf(K.kitchenNow()), today = K.day(0), sel = ui.calSel || '';
    return h('div', { class: 'wkstrip', role: 'group', 'aria-label': 'This week' }, Array.from({ length: 7 }, (_, i) => {
      const d = K.addDays(mon, i), ds = K.ymd(d), n = K.eventsOn(ds).filter(K.isLive).length;
      return h('button', { type: 'button', class: 'wk' + (ds === today ? ' today' : '') + (ds === sel ? ' sel' : ''), 'aria-pressed': ds === sel ? 'true' : 'false',
        'aria-label': K.prettyDate(ds, { weekday: 'long', day: 'numeric', month: 'long' }) + (n ? ', ' + n + (n === 1 ? ' event' : ' events') : ''),
        onclick: () => { ui.calSel = ds === sel ? '' : ds; ui.calMonth = ds.slice(0, 7); K.render(); } },
        h('span', { class: 'wk-d' }, d.toLocaleDateString('en-GB', { weekday: 'short' })), h('b', { class: 'mono' }, String(d.getDate())), h('i', { class: n ? 'on' : '' }));
    }));
  }
  /* tonight's event first: when, how many, the run of the evening, and what has to be done for it */
  function tonightHero(e) {
    const dishes = K.evDishes(e), tasks = K.evTasks(e), times = [], re = /(\d{1,2})[:.](\d{2})\s*([^·,;|\d]*)/g;
    let m;
    while ((m = re.exec(e.time || ''))) times.push({ t: m[1].padStart(2, '0') + ':' + m[2], what: m[3].trim() });
    const done = tasks.filter((k) => K.evTaskStatus('evt-' + e.id + '-' + k.id) === 'done').length;
    return h('section', { class: 'tnhero' },
      h('p', { class: 'tnh-kick mono' }, 'Tonight'),
      h('h2', { class: 'tnh-title' }, e.title || 'Event'),
      h('p', { class: 'tnh-meta' }, [e.guests ? e.guests + ' guests' : '', e.kind || '', e.status === 'confirmed' ? 'confirmed' : e.status || ''].filter(Boolean).join(' · ')),
      times.length ? h('ol', { class: 'tnh-line' }, times.map((x) => h('li', null, h('b', { class: 'mono' }, x.t), x.what ? ' ' + x.what : ''))) : null,
      h('div', { class: 'tnh-stats' },
        h('span', null, h('b', { class: 'mono' }, String(dishes.length)), 'dishes'),
        h('span', null, h('b', { class: 'mono' }, tasks.length ? done + '/' + tasks.length : '0'), 'prep tasks')),
      h('button', { class: 'btn light wide', type: 'button', onclick: () => { ui.calSel = e.date; ui.calMonth = e.date.slice(0, 7); K.render(); } }, 'Open the event', K.icon('next')));
  }
  K.V.events = function () {
    const up = K.upcomingEvents().filter(K.isLive), sel = ui.calSel;
    const body = h('div', { class: 'page' });
    body.append(K.pageHead('Events', up.length ? up.length + ' coming up · next: ' + (up[0].title || 'Event') + ', ' + K.countdown(up[0]).toLowerCase() : 'Groups, breakfast events and private dinners',
      K.me.admin ? h('button', { class: 'btn light', type: 'button', onclick: () => { ui.sheet = { type: 'event', e: blankEvent(sel) }; K.render(); } }, K.icon('plus'), 'Add event') : null, 'events'));
    const w = h('div', { class: 'wrap events' });
    body.append(w);
    w.append(weekStrip());
    const tonight = K.eventsOn(K.day(0)).filter(K.isLive)[0];
    if (tonight && !sel) w.append(tonightHero(tonight));
    const grid = h('div', { class: 'events-grid' });
    w.append(grid);
    grid.append(h('div', null, calendar()));
    const list = h('div', { class: 'evlist' });
    grid.append(list);
    if (sel) {
      const evs = K.eventsOn(sel);
      list.append(h('div', { class: 'block-top' }, h('h2', { class: 'block-title' }, K.prettyDate(sel)), h('button', { class: 'link-btn', type: 'button', onclick: () => { ui.calSel = ''; K.render(); } }, 'Show all coming up')));
      if (!evs.length) list.append(h('p', { class: 'none' }, 'No events this day.'));
      evs.forEach((e) => list.append(eventCard(e)));
      if (K.me.admin) list.append(h('button', { class: 'btn', type: 'button', onclick: () => { ui.sheet = { type: 'event', e: blankEvent(sel) }; K.render(); } }, K.icon('plus'), 'Add an event on this day'));
    } else {
      list.append(h('h2', { class: 'block-title' }, 'Coming up'));
      const all = K.upcomingEvents();
      if (!all.length) list.append(K.catRest('No events booked yet', K.me.admin ? 'Tap a day in the calendar, or Add event, when the next one comes in.' : 'They show up here as soon as they are booked.'));
      all.forEach((e) => list.append(eventCard(e)));
      const past = D.events.filter((e) => e.date < K.day(0) && e.date >= K.day(-30)).sort((a, b) => b.date.localeCompare(a.date));
      if (past.length) list.append(h('details', { class: 'past' }, h('summary', null, 'Last 30 days · ' + past.length), past.map(eventCard)));
    }
    return { body: body };
  };

  /* a starting prep list: order 3 days ahead, each part of each dish the day before, a briefing on the day */
  function genTasks(e) {
    const out = [], seen = {}, title = e.title || 'the event';
    const add = (text, station, before) => { const k = text + '|' + station; if (seen[k]) return; seen[k] = 1; out.push({ id: 't' + K.uid(), text: text, station: station, before: before }); };
    add('Check and place the order for ' + title, 'pass', 3);
    K.evDishes(e).forEach((d) => {
      const lk = K.linkTarget(d.link), qty = d.qty ? ' (' + d.qty + ' portions)' : '';
      if (lk && lk.ci < 0 && lk.r.type === 'dish' && lk.r.components.length) lk.r.components.forEach((c) => add('Prep ' + c.name + ' for ' + (d.name || lk.r.name) + qty, K.stationOf(lk.r, c) || 'hot', 1));
      else if (lk) add('Prep ' + (d.name || lk.name) + qty, (lk.ci >= 0 ? K.stationOf(lk.r, lk.r.components[lk.ci]) : lk.r.station) || 'hot', 1);
      else if (d.name) add('Prep ' + d.name + qty, 'hot', 1);
    });
    add('Plate-up briefing and final check for ' + title, 'pass', 0);
    return out;
  }
  K.SHEETS.event = function (S) {
    const e = S.e;
    const inp = (label, key, attrs) => K.field(label, h('input', Object.assign({ class: 'input', id: 'ev-' + key, value: e[key] || '', oninput: (ev) => { e[key] = ev.target.value; } }, attrs || {})));
    const save = (ev) => {
      ev.preventDefault();
      if (!(e.title || '').trim()) { K.toast('Give the event a name.'); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) { K.toast('Pick a date.'); return; }
      const id = e.id || 'e' + K.uid();
      const body = {
        title: e.title.trim(), date: e.date, time: (e.time || '').trim(), kind: e.kind || '', guests: String(e.guests || '').trim(), contact: (e.contact || '').trim(),
        menu: (e.menu || '').trim(), notes: (e.notes || '').trim(), status: e.status || 'confirmed',
        dishes: e.dishes.filter((d) => (d.name || '').trim() || d.link).map((d) => ({ name: (d.name || '').trim(), link: d.link || '', qty: String(d.qty || '').trim() })),
        tasks: e.tasks.filter((k) => (k.text || '').trim()).map((k) => ({ id: k.id || 't' + K.uid(), text: k.text.trim(), station: k.station || 'hot', before: +k.before || 0 })),
        updated: Date.now(),
      };
      ['source', 'uid', 'emailNotes', 'emailLink', 'emailSubject', 'createdAt'].forEach((k) => { if (e[k] !== undefined) body[k] = e[k]; });
      ui.sheet = null; ui.calSel = body.date; ui.calMonth = body.date.slice(0, 7);
      K.saveEvent(id, body);
    };
    const dishes = h('div', { class: 'stack' }, e.dishes.map((d, i) => h('div', { class: 'evdish' },
      h('input', { class: 'input', id: 'evd' + i, value: d.name || '', placeholder: 'Dish, e.g. Shakshuka', 'aria-label': 'Dish ' + (i + 1), oninput: (ev) => { d.name = ev.target.value; } }),
      h('input', { class: 'input mono', id: 'evq' + i, value: d.qty || '', inputmode: 'numeric', placeholder: 'Portions', 'aria-label': 'Portions for dish ' + (i + 1), oninput: (ev) => { d.qty = ev.target.value; } }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove dish ' + (i + 1), onclick: () => { e.dishes.splice(i, 1); K.render(); } }, K.icon('close')),
      K.select(K.recipeOptions('Not in the book'), d.link || '', (v) => { d.link = v; const lk = K.linkTarget(v); if (lk && !d.name) { d.name = lk.name; K.render(); } }, { class: 'input small', 'aria-label': 'Recipe for dish ' + (i + 1) }))));
    const tasks = h('div', { class: 'stack' }, e.tasks.map((k, i) => h('div', { class: 'evtask' },
      h('input', { class: 'input', id: 'evt' + i, value: k.text || '', placeholder: 'Task', 'aria-label': 'Task ' + (i + 1), oninput: (ev) => { k.text = ev.target.value; } }),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove task ' + (i + 1), onclick: () => { e.tasks.splice(i, 1); K.render(); } }, K.icon('close')),
      K.select(K.STATIONS, k.station || 'hot', (v) => { k.station = v; }, { class: 'input small', 'aria-label': 'Station for task ' + (i + 1) }),
      K.select(K.WHEN.map((x) => [String(x[0]), x[1]]), String(+k.before || 0), (v) => { k.before = +v; }, { class: 'input small', 'aria-label': 'When' }))));
    return K.sheet(e.id ? 'Edit event' : 'New event', h('form', { class: 'stack', onsubmit: save },
      inp('Name', 'title', { placeholder: 'e.g. Company breakfast' }),
      h('div', { class: 'two' }, inp('Date', 'date', { type: 'date' }), inp('Time', 'time', { placeholder: 'e.g. 09:00–11:00' })),
      h('div', { class: 'two' }, K.field('Type', K.select(KINDS.map((x) => [x, x]).concat(KINDS.includes(e.kind) || !e.kind ? [] : [[e.kind, e.kind]]), e.kind || 'Group', (v) => { e.kind = v; }), null, 'ev-kind'),
        inp('Guests', 'guests', { inputmode: 'numeric', placeholder: '40' })),
      K.field('Status', K.select(STATUS, e.status || 'confirmed', (v) => { e.status = v; }), null, 'ev-status'),
      inp('Contact or organiser', 'contact', { placeholder: 'Optional' }),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Food'), h('p', { class: 'hint' }, 'Each dish, how many portions, and the recipe if it is in the book. Linked recipes open already scaled when their yield is in portions.'),
        dishes, h('button', { class: 'btn small', type: 'button', onclick: () => { e.dishes.push({ name: '', link: '', qty: e.guests || '' }); K.render(); } }, K.icon('plus'), 'Dish')),
      K.field('Menu notes', h('textarea', { class: 'input', id: 'ev-menu', rows: '3', value: e.menu || '', placeholder: 'Anything about the menu that is not a dish', oninput: (ev) => { e.menu = ev.target.value; } })),
      K.field('Notes for the kitchen', h('textarea', { class: 'input', id: 'ev-notes', rows: '3', value: e.notes || '', placeholder: 'Allergies, timings, extra staff', oninput: (ev) => { e.notes = ev.target.value; } })),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Prep list'), h('p', { class: 'hint' }, 'Each task lands on that station’s Today list on the day it is due.'),
        tasks,
        h('div', { class: 'btns' }, h('button', { class: 'btn small', type: 'button', onclick: () => { e.tasks.push({ id: 't' + K.uid(), text: '', station: 'hot', before: 1 }); K.render(); } }, K.icon('plus'), 'Task'),
          h('button', { class: 'btn small', type: 'button', onclick: () => { const g = genTasks(e), have = {}; e.tasks.forEach((k) => { have[k.text] = 1; }); g.forEach((k) => { if (!have[k.text]) e.tasks.push(k); }); K.render(); K.toast(K.evDishes(e).length ? 'Prep list made from the food' : 'Add dishes first, then make the list'); } }, K.icon('sparkle'), 'Make the prep list from the food'))),
      h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'submit' }, 'Save event'),
        e.id ? h('button', { class: 'btn danger', type: 'button', onclick: () => { if (!S.del) { S.del = true; K.render(); return; } ui.sheet = null; K.deleteEvent(e.id); } }, S.del ? 'Tap again to delete' : 'Delete') : null)), { wide: true });
  };
})();
