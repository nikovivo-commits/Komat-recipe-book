/* Schedule: the floor's week, with shift codes like the kitchen's. Week (everyone, every day), Day (who is on
   and when) and Mine (your next shift and your seven days). The floor manager taps a day to set a shift. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const EMPTY = () => ['', '', '', '', '', '', ''];
  const DEFAULT_CODES = [
    { c: 'M', l: 'Morning 08:00–16:00', k: 'am' }, { c: 'L', l: 'Lunch 11:00–16:00', k: 'am' }, { c: 'E', l: 'Evening 16:00–close', k: 'pm' },
    { c: 'D', l: 'Double 11:00–close', k: 'dbl' }, { c: 'B', l: 'Bar 16:00–close', k: 'bar' }, { c: 'H', l: 'Host 17:00–close', k: 'pm' }, { c: 'X', l: 'Day off', k: 'off' },
  ];
  K.ROLES_FOH = [['waiter', 'Waiter'], ['bar', 'Bar'], ['host', 'Host'], ['runner', 'Runner'], ['manager', 'Manager']];
  const codes = () => (D.codes && D.codes.codes && D.codes.codes.length ? D.codes.codes : DEFAULT_CODES);
  const codeOf = (c) => codes().find((x) => x.c.toUpperCase() === String(c || '').trim().toUpperCase()) || null;
  const isOff = (c) => /^(x|0|off)$/i.test(String(c || '').trim());
  const kindOf = (c) => { c = String(c || '').trim(); if (!c) return 'empty'; if (isOff(c)) return 'off'; const x = codeOf(c); return (x && x.k) || 'plain'; };
  const labelOf = (c) => { const x = codeOf(c); return x ? x.l : String(c || ''); };
  const range = (mon) => { const sun = K.addDays(mon, 6); return mon.getDate() + '.' + (mon.getMonth() + 1) + ' – ' + sun.getDate() + '.' + (sun.getMonth() + 1); };
  const nameOf = (id) => { const p = D.staff.people.find((x) => x.id === id); return p ? p.name : id; };
  const plain = (s) => K.latin(String(s || '')).split(' ')[0].replace(/[^a-z ]/g, '');
  /* who you are on the schedule: your name in the floor book, else what this phone picked */
  K.fohMe = function () {
    const ppl = D.staff.people;
    if (K.mode === 'firebase' && K.me.name) {
      const n = K.normName(K.me.name), ex = ppl.filter((p) => K.normName(p.name) === n);
      if (ex.length === 1) return ex[0].id;
      const f = plain(n.split(' ')[0]), fs = ppl.filter((p) => plain(K.normName(p.name).split(' ')[0]) === f);
      if (fs.length === 1) return fs[0].id;
    }
    const s = K.store.get('fohMe', '');
    return ppl.some((p) => p.id === s) ? s : '';
  };

  function weekSrc(wk) {
    const d = D.weeks[wk];
    if (!d) return null;
    return { rows: d.rows || {}, people: (d.people || []).filter((id) => d.rows && d.rows[id]), note: d.note || '' };
  }
  function newWeek(wk, copy) {
    const prevKey = Object.keys(D.weeks).filter((k) => k < wk).sort().pop(), prev = prevKey ? D.weeks[prevKey] : null;
    const people = prev && prev.people && prev.people.length ? prev.people.filter((id) => D.staff.people.some((p) => p.id === id)) : D.staff.people.map((p) => p.id);
    D.staff.people.forEach((p) => { if (!people.includes(p.id)) people.push(p.id); });
    const rows = {};
    people.forEach((id) => { rows[id] = copy && prev && prev.rows && prev.rows[id] ? prev.rows[id].slice() : EMPTY(); });
    K.saveWeek(wk, { week: wk, people: people, rows: rows, note: '', updated: Date.now() });
  }

  K.V.schedule = function () {
    const thisWk = K.thisWeek(), wk = ui.week || thisWk, mon = K.parseYmd(wk), isNow = wk === thisWk, ti = K.todayIdx(), src = weekSrc(wk);
    const body = h('div', { class: 'page' });
    body.append(K.pageHead('Schedule', null, h('div', { class: 'phead-side' },
      h('p', { class: 'psub' }, range(mon) + (isNow ? ' · this week' : '')),
      h('div', { class: 'weeknav' },
        h('button', { class: 'icon-btn on-dark', type: 'button', 'aria-label': 'Previous week', onclick: () => { ui.week = K.ymd(K.addDays(mon, -7)); K.render(); } }, K.icon('back')),
        h('button', { class: 'btn small ghost-light', type: 'button', disabled: isNow, onclick: () => { ui.week = thisWk; K.render(); } }, 'This week'),
        h('button', { class: 'icon-btn on-dark', type: 'button', 'aria-label': 'Next week', onclick: () => { ui.week = K.ymd(K.addDays(mon, 7)); K.render(); } }, K.icon('next')))), '', 'sched-head'));
    const w = h('div', { class: 'wrap fsched' });
    body.append(w);
    const view = ui.schedView || K.store.get('fohSchedView', 'week'), me = K.fohMe();
    w.append(K.seg([['week', 'Week'], ['day', 'Day'], ['mine', 'Mine']], view, (v) => { ui.schedView = v; K.store.set('fohSchedView', v); K.render(); }, { class: 'seg sv-seg', 'aria-label': 'Show' }));
    if (!D.staff.people.length) {
      w.append(h('section', { class: 'sv-card' }, h('p', null, K.canEdit() ? 'First add the floor team: the people on the schedule.' : 'The floor manager has not set up the schedule yet.'),
        K.canEdit() ? h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { ui.sheet = { type: 'team' }; K.render(); } }, K.icon('plus'), 'The floor team'),
          h('button', { class: 'btn', type: 'button', onclick: () => { ui.sheet = { type: 'pasteweek', wk: wk }; K.render(); } }, K.icon('list'), 'Paste a week')) : null));
      return { body: body };
    }
    if (!src) {
      w.append(h('section', { class: 'sv-card' }, h('p', null, K.canEdit() ? 'Nothing on the schedule for this week yet.' : 'This week is not out yet.'),
        K.canEdit() ? h('div', { class: 'btns' },
          h('button', { class: 'btn', type: 'button', onclick: () => newWeek(wk, true) }, 'Copy the week before'),
          h('button', { class: 'btn', type: 'button', onclick: () => newWeek(wk, false) }, 'Start a blank week')) : null));
    } else {
      const at = (id, i) => String((src.rows[id] || [])[i] || '').trim();
      if (src.note) w.append(h('div', { class: 'banner' }, h('b', null, 'Note: '), src.note));
      if (view === 'day') w.append(dayView(src, at, mon, isNow, ti, me, wk));
      else if (view === 'mine') w.append(mineView(src, at, mon, isNow, ti, me));
      else w.append(weekView(src, at, mon, isNow, ti, me, wk));
    }
    w.append(legend());
    if (K.canEdit()) {
      w.append(h('div', { class: 'btns sv-acts' },
        h('button', { class: 'btn small', type: 'button', onclick: () => { ui.sheet = { type: 'team' }; K.render(); } }, K.icon('edit'), 'The floor team'),
        h('button', { class: 'btn small', type: 'button', onclick: () => { ui.sheet = { type: 'codes' }; K.render(); } }, 'Shift codes'),
        h('button', { class: 'btn small', type: 'button', onclick: () => { ui.sheet = { type: 'pasteweek', wk: wk }; K.render(); } }, K.icon('list'), 'Paste a week'),
        src ? h('button', { class: 'btn small', type: 'button', onclick: () => { ui.sheet = { type: 'weeknote', wk: wk }; K.render(); } }, K.icon('note'), 'Note for the team') : null));
    }
    return { body: body };
  };

  function cell(code, onTap, cls) {
    const k = kindOf(code);
    return h(onTap ? 'button' : 'span', { type: onTap ? 'button' : null, class: 'fs-cell k-' + k + (String(code || '').length > 3 ? ' long' : '') + (cls ? ' ' + cls : ''), title: code ? labelOf(code) : '', onclick: onTap || null }, code || (onTap ? '+' : ''));
  }
  function weekView(src, at, mon, isNow, ti, me, wk) {
    const edit = K.canEdit();
    const tap = (id, i) => (edit ? () => { ui.sheet = { type: 'shift', wk: wk, id: id, i: i }; K.render(); } : null);
    const people = src.people.slice().sort((a, b) => (a === me ? -1 : b === me ? 1 : 0));
    return h('div', { class: 'fs-week', role: 'table', 'aria-label': 'The week' },
      h('div', { class: 'fs-row fs-headrow', role: 'row' }, h('span', { class: 'fs-name' }),
        K.DAYS.map((d, i) => h('span', { class: 'fs-day' + (isNow && i === ti ? ' today' : ''), role: 'columnheader' }, h('b', null, d), h('small', null, String(K.addDays(mon, i).getDate()))))),
      people.map((id) => h('div', { class: 'fs-row' + (id === me ? ' me' : ''), role: 'row' },
        h('span', { class: 'fs-name', role: 'rowheader' }, nameOf(id)),
        K.DAYS.map((d, i) => h('span', { class: 'fs-c' + (isNow && i === ti ? ' today' : ''), role: 'cell' }, cell(at(id, i), tap(id, i)))))));
  }
  function dayView(src, at, mon, isNow, ti, me, wk) {
    const di = ui.fsDay == null ? (isNow ? ti : 0) : ui.fsDay;
    const on = src.people.filter((id) => at(id, di) && !isOff(at(id, di)));
    const off = src.people.filter((id) => isOff(at(id, di)) || !at(id, di));
    const groups = {};
    on.forEach((id) => { const c = at(id, di).toUpperCase(); (groups[c] = groups[c] || []).push(id); });
    const order = codes().map((c) => c.c.toUpperCase());
    return h('div', null,
      h('div', { class: 'fs-days', role: 'group', 'aria-label': 'Day' }, K.DAYS.map((d, i) => h('button', { type: 'button', class: 'fs-dbtn' + (isNow && i === ti ? ' today' : ''), 'aria-pressed': i === di ? 'true' : 'false', onclick: () => { ui.fsDay = i; K.render(); } }, h('b', null, d), h('small', null, String(K.addDays(mon, i).getDate()))))),
      h('section', { class: 'sv-card' },
        h('h2', { class: 'fs-dtitle' }, K.prettyDate(K.ymd(K.addDays(mon, di))), h('span', { class: 'muted' }, ' · ' + on.length + ' on')),
        on.length ? Object.keys(groups).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99)).map((c) => h('div', { class: 'fs-group' },
          cell(c, null), h('div', null, h('span', { class: 'muted' }, labelOf(c)), h('p', null, groups[c].map((id) => h('span', { class: 'fs-person' + (id === me ? ' me' : '') }, nameOf(id))))))) : h('p', { class: 'muted' }, 'Nobody on.'),
        off.length ? h('p', { class: 'muted fs-off' }, 'Off: ' + off.map(nameOf).join(', ')) : null));
  }
  function mineView(src, at, mon, isNow, ti, me) {
    const pick = h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Who are you?'),
      K.select([['', 'Pick your name']].concat(D.staff.people.map((p) => [p.id, p.name])), me, (v) => { K.store.set('fohMe', v); K.render(); }, { 'aria-label': 'Your name on the schedule' }));
    if (!me) return h('section', { class: 'sv-card' }, h('p', null, K.mode === 'firebase' ? 'Your name in the floor book (' + (K.me.name || '?') + ') is not on the schedule. Pick yourself:' : 'Pick yourself to see your shifts.'), pick);
    const days = K.DAYS.map((d, i) => ({ i: i, d: d, c: at(me, i), date: K.addDays(mon, i) }));
    const next = isNow ? days.find((x) => x.i >= ti && x.c && !isOff(x.c)) : days.find((x) => x.c && !isOff(x.c));
    const n = days.filter((x) => x.c && !isOff(x.c)).length;
    return h('div', null,
      h('section', { class: 'sv-card fs-next' },
        h('span', { class: 'label' }, isNow ? 'Your next shift' : 'Your first shift that week'),
        next ? [h('h2', null, next.i === ti && isNow ? 'Today' : next.i === ti + 1 && isNow ? 'Tomorrow' : K.prettyDate(K.ymd(next.date), { weekday: 'long', day: 'numeric', month: 'short' })), h('p', null, cell(next.c, null), ' ', labelOf(next.c))]
          : h('h2', null, 'Nothing more this week'),
        h('p', { class: 'muted' }, n + (n === 1 ? ' shift' : ' shifts') + ' this week · ' + nameOf(me))),
      h('div', { class: 'fs-mine' }, days.map((x) => h('div', { class: 'fs-mrow' + (isNow && x.i === ti ? ' today' : '') },
        h('span', { class: 'fs-md' }, h('b', null, x.d), h('small', null, x.date.getDate() + '.' + (x.date.getMonth() + 1))),
        cell(x.c, null), h('span', null, x.c ? labelOf(x.c) : 'Not set')))),
      K.mode !== 'firebase' ? pick : null);
  }
  function legend() {
    return h('section', { class: 'fs-legend' }, h('h2', { class: 'sec-title' }, 'Shift codes'),
      h('div', { class: 'fs-codes' }, codes().map((c) => h('span', { class: 'fs-code' }, cell(c.c, null), c.l))));
  }

  /* ---------- the floor manager's sheets ---------- */
  K.SHEETS.shift = function (S) {
    const doc = D.weeks[S.wk];
    if (!doc) return null;
    const cur = ((doc.rows || {})[S.id] || [])[S.i] || '';
    const set = (c) => {
      const b = K.clone(doc);
      b.rows[S.id] = (b.rows[S.id] || EMPTY()).slice(); b.rows[S.id][S.i] = c; b.updated = Date.now();
      K.saveWeek(S.wk, b);
      ui.sheet = null; K.render();
    };
    const custom = h('input', { class: 'input mono', id: 'sh-c', value: codeOf(cur) ? '' : cur, placeholder: 'Or type: 12–20', maxlength: 16 });
    return K.sheet(nameOf(S.id) + ' · ' + K.prettyDate(K.ymd(K.addDays(K.parseYmd(S.wk), S.i)), { weekday: 'long', day: 'numeric', month: 'short' }), h('div', { class: 'stack' },
      h('div', { class: 'fs-pick' }, codes().map((c) => h('button', { type: 'button', class: 'fs-pbtn' + (String(cur).toUpperCase() === c.c.toUpperCase() ? ' on' : ''), onclick: () => set(c.c) }, cell(c.c, null), h('span', null, c.l)))),
      h('form', { class: 'inline-form', onsubmit: (e) => { e.preventDefault(); if (custom.value.trim()) set(custom.value.trim()); } }, custom, h('button', { class: 'btn', type: 'submit' }, 'Set')),
      cur ? h('button', { class: 'btn', type: 'button', onclick: () => set('') }, 'Clear the day') : null));
  };
  K.SHEETS.team = function (S) {
    const ppl = D.staff.people;
    const save = (list) => K.saveSetting('staff', { people: list });
    const add = (e) => {
      e.preventDefault();
      const el = document.getElementById('tm-new'), name = el.value.trim();
      if (!name) return;
      let id = K.normName(name).replace(/ /g, '-') || K.uid();
      if (ppl.some((p) => p.id === id)) id += '-' + K.uid().slice(-3);
      save(ppl.concat([{ id: id, name: name, role: S.role || 'waiter' }]));
      /* on this week's and next week's schedule straight away */
      [K.thisWeek(), K.ymd(K.addDays(K.parseYmd(K.thisWeek()), 7))].forEach((wk) => {
        const d = D.weeks[wk];
        if (d && !(d.people || []).includes(id)) { const b = K.clone(d); b.people = (b.people || []).concat([id]); b.rows = b.rows || {}; b.rows[id] = EMPTY(); b.updated = Date.now(); K.saveWeek(wk, b); }
      });
      el.value = '';
    };
    return K.sheet('The floor team', h('div', { class: 'stack' },
      h('p', { class: 'hint' }, 'The people on the floor schedule. Write each name the way they joined the floor book, so their Mine view finds them.'),
      h('ul', { class: 'people' }, ppl.map((p) => h('li', { class: 'person' },
        h('span', { class: 'p-name' }, h('b', null, p.name)),
        K.select(K.ROLES_FOH, p.role || 'waiter', (v) => save(ppl.map((x) => (x.id === p.id ? Object.assign({}, x, { role: v }) : x))), { class: 'input small', 'aria-label': 'Role of ' + p.name }),
        h('button', { class: 'btn small danger', type: 'button', onclick: () => {
          if (S.sure !== p.id) { S.sure = p.id; K.render(); return; }
          save(ppl.filter((x) => x.id !== p.id)); S.sure = '';
        } }, S.sure === p.id ? 'Tap again' : 'Remove')))),
      h('form', { class: 'inline-form', onsubmit: add },
        h('input', { class: 'input', id: 'tm-new', placeholder: 'Name', maxlength: 40, 'aria-label': 'New person' }),
        K.select(K.ROLES_FOH, S.role || 'waiter', (v) => { S.role = v; }, { class: 'input small', 'aria-label': 'Role' }),
        h('button', { class: 'btn primary', type: 'submit' }, K.icon('plus'), 'Add'))));
  };
  /* A whole week at once, from the sheet the schedule is made in: one line a person, the name and then the seven
     days from Monday, with a tab, a semicolon or an upright line between them (copying the rows out of a
     spreadsheet gives tabs). New names join the floor team; the people already there who are not in the text
     keep what they have. A day left empty stays empty. */
  K.parseWeek = function (text) {
    return String(text || '').split(/\n+/).map((l) => l.split(/\t|;|\|/).map((c) => c.trim())).filter((c) => c[0] && c.length > 1)
      .map((c) => ({ name: c[0].slice(0, 40), days: EMPTY().map((x, i) => String(c[i + 1] || '').slice(0, 16)) }));
  };
  K.SHEETS.pasteweek = function (S) {
    const mon = K.parseYmd(S.wk), rows = K.parseWeek(S.t);
    const save = (e) => {
      e.preventDefault();
      if (!rows.length) { K.toast('Nothing to read: one line a person, the name, then the seven days.', { tone: 'bad' }); return; }
      let ppl = D.staff.people.slice();
      const ids = rows.map((r) => {
        const n = K.normName(r.name), ex = ppl.find((p) => K.normName(p.name) === n);
        if (ex) return ex.id;
        let id = n.replace(/ /g, '-') || K.uid();
        if (ppl.some((p) => p.id === id)) id += '-' + K.uid().slice(-3);
        ppl = ppl.concat([{ id: id, name: r.name, role: 'waiter' }]);
        return id;
      });
      if (ppl.length !== D.staff.people.length) K.saveSetting('staff', { people: ppl });
      const old = D.weeks[S.wk], doc = old ? K.clone(old) : { week: S.wk, people: [], rows: {}, note: '' };
      doc.people = doc.people || []; doc.rows = doc.rows || {};
      ids.forEach((id, i) => { if (!doc.people.includes(id)) doc.people.push(id); doc.rows[id] = rows[i].days; });
      doc.updated = Date.now();
      K.saveWeek(S.wk, doc);
      ui.sheet = null; K.render(); K.toast('The week is on the schedule');
    };
    return K.sheet('Paste a week · ' + range(mon), h('form', { class: 'stack', onsubmit: save },
      h('p', { class: 'hint' }, 'One line a person: the name, then Monday to Sunday, with a semicolon or a tab between them. Rows copied from a spreadsheet work as they are.'),
      h('textarea', { class: 'input mono', id: 'pw-t', rows: '9', value: S.t || '', placeholder: 'Maria; E; E; X; D; E; X; L', oninput: (e) => { S.t = e.target.value; K.render(); } }),
      rows.length ? h('div', { class: 'pw-prev' }, h('table', null, h('tbody', null, rows.map((r) => h('tr', null, h('th', null, r.name), r.days.map((d) => h('td', null, cell(d, null)))))))) : null,
      h('button', { class: 'btn primary', type: 'submit', disabled: !rows.length }, rows.length ? 'Put ' + rows.length + ' people on this week' : 'Put on this week')));
  };
  K.SHEETS.codes = function (S) {
    if (S.t == null) S.t = codes().map((c) => c.c + ' = ' + c.l).join('\n');
    const save = (e) => {
      e.preventDefault();
      const list = S.t.split('\n').map((l) => l.match(/^\s*([^=]{1,8}?)\s*=\s*(.+)$/)).filter(Boolean).map((m) => {
        const c = m[1].trim(), l = m[2].trim(), old = codeOf(c);
        return { c: c, l: l, k: isOff(c) ? 'off' : old ? old.k : /bar/i.test(l) ? 'bar' : /double|11:00–close/i.test(l) ? 'dbl' : /morning|lunch|0[6-9]:|1[0-1]:/i.test(l) ? 'am' : 'pm' };
      });
      if (!list.length) { K.toast('Write at least one code, like E = Evening 16:00–close.', { tone: 'bad' }); return; }
      K.saveSetting('codes', { codes: list }).then(() => K.toast('Shift codes saved'));
      ui.sheet = null; K.render();
    };
    return K.sheet('Shift codes', h('form', { class: 'stack', onsubmit: save },
      h('p', { class: 'hint' }, 'One per line: the code, an equals sign, what it means. X is a day off.'),
      h('textarea', { class: 'input mono', id: 'codes-t', rows: '9', value: S.t, oninput: (e) => { S.t = e.target.value; } }),
      h('button', { class: 'btn primary', type: 'submit' }, 'Save')));
  };
  K.SHEETS.weeknote = function (S) {
    const doc = D.weeks[S.wk];
    if (!doc) return null;
    const t = h('textarea', { class: 'input', id: 'wk-note', rows: '3', value: doc.note || '', placeholder: 'Wine training Tuesday 15:00' });
    return K.sheet('Note for the team', h('form', { class: 'stack', onsubmit: (e) => { e.preventDefault(); const b = K.clone(doc); b.note = t.value.trim(); b.updated = Date.now(); K.saveWeek(S.wk, b); ui.sheet = null; K.render(); } },
      t, h('button', { class: 'btn primary', type: 'submit' }, 'Save')));
  };
})();
