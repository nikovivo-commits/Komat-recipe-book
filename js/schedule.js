/* Schedule: the weekly rota, with the same shift codes as the kitchen's spreadsheet. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const QUICK = ['P', 'X', '1', '2', 'BR', 'BR+P', '0', '12', '13', 'DO 21'];
  const EMPTY = () => ['', '', '', '', '', '', ''];
  /* Latin letters for a Bulgarian name, so "Ali", "али" and "Али" are the same person */
  const LAT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: 'y', ю: 'yu', я: 'ya' };
  const plain = (s) => String(s || '').toLowerCase().replace(/[а-я]/g, (c) => LAT[c] || '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
  /* the rota person a kitchen name belongs to: the same name, or the same first name when only one person has it */
  K.rotaIdFor = function (name) {
    const n = plain(name);
    if (!n) return '';
    const ppl = ((D.staff && D.staff.people) || []).map((p) => ({ id: p.id, full: plain(p.name) }));
    const exact = ppl.filter((p) => p.full === n || p.id === n.replace(/ /g, ''));
    if (exact.length === 1) return exact[0].id;
    const f = n.split(' ')[0], first = ppl.filter((p) => p.full.split(' ')[0] === f || p.id === f);
    return first.length === 1 ? first[0].id : '';
  };
  /* in the kitchen's own database your week is locked to the name you joined with; elsewhere this phone remembers a pick */
  const locked = () => K.mode === 'firebase';
  K.getMe = () => (locked() ? K.rotaIdFor(K.me.name) : K.store.get('me', ''));

  function newWeekFrom(wk, copy) {
    const prevKey = Object.keys(D.weeks).filter((k) => k < wk).sort().pop(), prev = prevKey ? D.weeks[prevKey] : null;
    const people = prev ? prev.people.slice() : D.staff.people.map((p) => p.id), rows = {};
    people.forEach((id) => { rows[id] = copy && prev && prev.rows && prev.rows[id] ? prev.rows[id].slice() : EMPTY(); });
    K.saveWeek(wk, { week: wk, people: people, rows: rows, updated: Date.now() });
  }
  const range = (mon) => { const sun = K.addDays(mon, 6); return mon.getDate() + '.' + (mon.getMonth() + 1) + ' – ' + sun.getDate() + '.' + (sun.getMonth() + 1); };

  /* the day the rota points at is the real calendar date: it changes at midnight, like every other day in the app.
     After midnight on a Sunday the new week is only used once it has been posted. */
  function focus() {
    const d = new Date(), wk = K.ymd(K.mondayOf(d));
    if (wk !== K.thisWeek() && !D.weeks[wk]) return { wk: K.thisWeek(), idx: K.todayIdx() };
    return { wk: wk, idx: (d.getDay() + 6) % 7 };
  }
  /* ---------- the page: one week, three ways to read it ----------
     Week: everyone, every day, one block per shift coloured by station (it fits a phone without scrolling).
     Day: one day, station by station, and who is off. Mine: your next shift, then your seven days. */
  const HOURS = { P: '11:00–23:00', '2': '15:00–close', '1': 'first shift', '10:30': '10:30–19:00', BR: 'until 16:00', 'BR+P': 'breakfast, then until close' };
  const isOff = (c) => /^(0|X)$/i.test(String(c || '').trim());
  const hoursOf = (c) => { const lab = K.codeLabel(c), m = lab.match(/\d{1,2}[:.]\d{2}\s*[–-]\s*\d{1,2}[:.]\d{2}/); return m ? m[0].replace('-', '–') : HOURS[String(c).trim().toUpperCase()] || HOURS[String(c).trim()] || lab || ''; };
  /* the colour a cell gets: its station, else breakfast or a plain shift for weeks without stations */
  function kindOf(c, st) {
    c = String(c || '').trim();
    if (!c) return 'empty';
    if (isOff(c)) return 'off';
    if (st) return /^learn/.test(st) ? 'learn' : st;
    return /^BR\b/i.test(c) && !/\+/.test(c) ? 'br' : 'plain';
  }
  const STN = () => K.STL || { hot: 'Hot', cold: 'Cold', pass: 'Pass', prep: 'Prep', float: 'Filler', br: 'Breakfast', learn: 'Hot · learning' };
  const setView = (v, day) => { ui.schedView = v; K.store.set('schedView', v); if (day != null) ui.schedDay = day; K.render(); };

  K.V.schedule = function () {
    const fc = focus(), wk = ui.week || fc.wk, mon = K.parseYmd(wk), doc = D.weeks[wk], isNow = wk === fc.wk, ti = fc.idx;
    const body = h('div', { class: 'page' });
    body.append(K.pageHead('Schedule', null, h('div', { class: 'phead-side' },
      h('p', { class: 'psub' }, range(mon) + (isNow ? ' · this week' : '')),
      h('div', { class: 'weeknav' },
        h('button', { class: 'icon-btn on-dark', type: 'button', 'aria-label': 'Previous week', onclick: () => { ui.week = K.ymd(K.addDays(mon, -7)); K.render(); } }, K.icon('back')),
        h('button', { class: 'btn small ghost-light', type: 'button', disabled: isNow, onclick: () => { ui.week = focus().wk; K.render(); } }, 'This week'),
        h('button', { class: 'icon-btn on-dark', type: 'button', 'aria-label': 'Next week', onclick: () => { ui.week = K.ymd(K.addDays(mon, 7)); K.render(); } }, K.icon('next')))), 'schedule'));
    const w = h('div', { class: 'wrap schedule sv' });
    body.append(w);
    const genLink = () => (K.me.admin && K.V.rotaplan ? h('button', { class: 'btn small', type: 'button', onclick: () => { ui.rpWeek = wk > K.thisWeek() ? wk : K.ymd(K.addDays(K.parseYmd(K.thisWeek()), 7)); ui.rpTab = 'draft'; K.go('rotaplan'); } }, K.icon('rota'), 'Rota generator') : null);

    /* what the week holds: the saved rota, or for a week still being planned the generator's draft */
    let src = null;
    if (doc) src = { rows: doc.rows || {}, st: doc.st || {}, order: (doc.people || []).slice(), draft: false };
    else if (wk >= fc.wk && K.rotaReady && K.rotaReady() && (K.calendarOn || K.me.admin)) {
      const r = K.rotaDraft(wk, K.requestsFor ? K.requestsFor(wk) : []);
      src = { rows: r.rows, st: r.st, order: r.order, draft: true, holes: r.issues.filter((x) => x.sev === 'red').length };
    }
    const view = ui.schedView || K.store.get('schedView', 'week'), me = K.getMe();
    w.append(K.seg([['week', 'Week'], ['day', 'Day'], ['mine', 'Mine'], ['month', 'Month']], view, (v) => setView(v), { 'aria-label': 'Show the week, one day, your shifts or the month', class: 'seg sv-seg' }));
    /* days off waiting for the chef: a nudge on every view, the requests themselves are in Month */
    const waiting = K.me.admin && K.calendarOn && K.waitingCount ? K.waitingCount() : 0;
    if (waiting && view !== 'month') w.append(h('button', { type: 'button', class: 'sv-wait', onclick: () => setView('month') }, h('b', null, String(waiting)), waiting === 1 ? 'day off waiting for you' : 'days off waiting for you', K.icon('next')));
    if (view === 'month') { if (K.monthView) w.append(K.monthView()); return { body: body }; }

    if (!src) {
      w.append(h('section', { class: 'sv-card sv-empty' }, h('p', null, K.me.admin ? 'No rota for this week yet.' : 'The head chef has not posted this week yet.'),
        K.me.admin ? h('div', { class: 'btns' }, genLink(),
          h('button', { class: 'btn small', type: 'button', onclick: () => newWeekFrom(wk, true) }, 'Copy the week before'),
          h('button', { class: 'btn small', type: 'button', onclick: () => newWeekFrom(wk, false) }, 'Start a blank week')) : null));
      w.append(legend());
      return { body: body };
    }
    if (src.draft) w.append(h('p', { class: 'sv-draft' }, (K.calendarOn ? 'Draft · it changes as days off come in' : 'Draft · only the chefs see it until it is saved') + (src.holes ? ' · ' + src.holes + (src.holes === 1 ? ' hole' : ' holes') : '')));
    const at = (id, i) => String(((src.rows[id] || [])[i]) || '').trim(), stAt = (id, i) => ((src.st[id] || [])[i]) || '';
    /* not fair: a shift on a day that person should have had (asked off, fixed or kept day off, an extra day, a backup station) */
    const uf = K.unfairWeek ? K.unfairWeek(wk, src.rows, src.st) : {}, ufAt = (id, i) => (uf[id] || {})[i] || null;

    if (view === 'day') w.append(dayView(src, at, stAt, mon, isNow, ti, me, ufAt));
    else if (view === 'mine') w.append(mineView(src, at, stAt, mon, isNow, ti, me, ufAt));
    else w.append(weekView(src, at, stAt, mon, isNow, ti, me, wk, ufAt));

    if (doc && doc.note && !K.me.admin) w.append(h('div', { class: 'banner' }, h('b', null, 'Note: '), doc.note));
    if (K.me.admin) w.append(h('div', { class: 'btns sv-acts' }, genLink()));
    if (K.me.admin && doc) {
      const people = doc.people || [];
      const note = h('textarea', { class: 'input', id: 'wknote', rows: '2', value: doc.note || '', placeholder: 'e.g. Stock count Monday 10:00', onchange: (e) => { const b = K.clone(doc); b.note = e.target.value; b.updated = Date.now(); K.saveWeek(wk, b); } });
      w.append(K.field('Note for the team', note));
      const notIn = D.staff.people.filter((p) => !people.includes(p.id));
      w.append(h('div', { class: 'field' }, h('span', { class: 'legend' }, 'People this week'),
        h('div', { class: 'btns' }, notIn.map((p) => h('button', { class: 'btn small', type: 'button', onclick: () => { const b = K.clone(doc); b.people.push(p.id); b.rows[p.id] = EMPTY(); b.updated = Date.now(); K.saveWeek(wk, b); } }, K.icon('plus'), p.name)),
          h('button', { class: 'btn small', type: 'button', onclick: () => { ui.sheet = { type: 'person', wk: wk, name: '' }; K.render(); } }, K.icon('plus'), 'New person'))));
    }
    w.append(legend());
    return { body: body };
  };

  function stationKey() {
    return h('div', { class: 'sv-key', 'aria-hidden': 'true' }, [['hot', 'Hot'], ['cold', 'Cold'], ['pass', 'Pass'], ['br', 'Breakfast'], ['prep', 'Prep'], ['float', 'Filler'], ['learn', 'Learning']].map((x) =>
      h('span', null, h('i', { class: 'svc-' + x[0] }), x[1])));
  }

  /* Week: the whole team, every day */
  function weekView(src, at, stAt, mon, isNow, ti, me, wk, ufAt) {
    const edit = K.me.admin && !src.draft;
    const head = h('tr', null, h('th', { scope: 'col', class: 'sv-nm' }, h('span', { class: 'sr' }, 'Person')), K.DAYS.map((d, i) => {
      const dd = K.addDays(mon, i), ev = K.dayEvents ? K.dayEvents(K.ymd(dd)) : [];
      return h('th', { scope: 'col', class: isNow && i === ti ? 'now' : null },
        h('button', { type: 'button', class: 'sv-dh', 'aria-label': 'Who is on ' + d + ' ' + dd.getDate(), onclick: () => setView('day', i) },
          h('span', null, d), h('b', null, String(dd.getDate())), ev.length ? h('i', { class: 'sv-ev', title: ev.map((e) => e.title).join(', ') }, '★') : null));
    }));
    const rows = src.order.map((id) => {
      const nm = h('span', { class: 'sv-name' }, K.personName(id));
      return h('tr', { class: id === me ? 'me' : null, 'aria-current': id === me ? 'true' : null },
        h('th', { scope: 'row', class: 'sv-nm' }, edit ? h('button', { type: 'button', class: 'sv-nb', onclick: () => { ui.sheet = { type: 'row', wk: wk, id: id }; K.render(); } }, nm) : nm),
        K.DAYS.map((d, i) => {
          const c = at(id, i), k = kindOf(c, stAt(id, i)), txt = k === 'off' ? '–' : c;
          const u = ufAt(id, i);
          const lab = K.personName(id) + ', ' + d + ': ' + (k === 'off' ? 'off' : c + (stAt(id, i) ? ', ' + (STN()[stAt(id, i)] || stAt(id, i)) : '')) + (u ? '. Not fair: ' + u.why : '');
          const blk = h('span', { class: 'svc svc-' + k + (c.length > 3 ? ' long' : '') }, txt, u ? h('span', { class: 'uf', title: 'Not fair: ' + u.why }, K.icon('sad')) : null);
          return h('td', { class: isNow && i === ti ? 'now' : null }, edit ? h('button', { type: 'button', class: 'sv-cb', 'aria-label': lab, onclick: () => { ui.sheet = { type: 'cell', wk: wk, id: id, i: i }; K.render(); } }, blk) : h('span', { 'aria-label': lab }, blk));
        }));
    });
    const anyUf = src.order.some((id) => [0, 1, 2, 3, 4, 5, 6].some((i) => ufAt(id, i)));
    const key = stationKey();
    if (anyUf) key.append(h('span', { class: 'uf-k' }, K.icon('sad'), K.calendarOn ? 'Not fair · earns more' : 'Not fair'));
    return h('section', { class: 'sv-card' }, key,
      h('table', { class: 'sv-week' }, h('thead', null, head), h('tbody', null, rows)),
      h('p', { class: 'sv-hint' }, edit ? 'Tap a day for who stands where. Tap a shift to change it, a name to rename or move it.' : 'Tap a day for who stands where.'));
  }

  /* Day: one day, station by station */
  function dayView(src, at, stAt, mon, isNow, ti, me, ufAt) {
    let di = ui.schedDay;
    if (di == null) di = isNow ? ti : 0;
    const strip = h('div', { class: 'sv-days', role: 'group', 'aria-label': 'Pick a day' }, K.DAYS.map((d, i) => {
      const dd = K.addDays(mon, i), mine = me && at(me, i) && !isOff(at(me, i));
      return h('button', { type: 'button', class: 'sv-day' + (isNow && i === ti ? ' today' : ''), 'aria-pressed': i === di ? 'true' : 'false', onclick: () => { ui.schedDay = i; K.render(); } },
        h('span', null, d), h('b', null, String(dd.getDate())), h('i', { class: mine ? 'on' : '', 'aria-label': mine ? 'you work' : null }));
    }));
    const ds = K.ymd(K.addDays(mon, di)), groups = {}, off = [];
    const plan = K.rotaPlan ? K.rotaPlan().people || {} : {};
    const add = (st, x) => { (groups[st] = groups[st] || []).push(x); };
    src.order.forEach((id) => {
      const c = at(id, di), st = stAt(id, di);
      if (!c) return;
      if (isOff(c)) { off.push(id); return; }
      if (/^BR\+/i.test(c)) add('br', { id: id, tag: 'until 16:00' });
      const k = st || (/^BR\b/i.test(c) && !/\+/.test(c) ? 'br' : 'other');
      add(k, { id: id, uf: ufAt(id, di), tag: k === 'other' ? c : c === 'P' || k === 'br' || /^BR\+/i.test(c) ? '' : c === '2' ? 'from 15:00' : c === '10:30' ? '10:30–19:00' : c });
      /* someone on a fixed week who also covers a station at lunch (breakfast cook on Hot) */
      (((plan[id] || {}).lunch) || []).forEach((x) => add(x, { id: id, tag: 'lunch' }));
    });
    const ORDER = [['br', 'Breakfast'], ['hot', 'Hot'], ['cold', 'Cold'], ['pass', 'Pass'], ['float', 'Filler'], ['prep', 'Prep'], ['learn', 'Learning Hot'], ['learn-hot', 'Learning Hot'], ['learn-cold', 'Learning Cold'], ['learn-pass', 'Learning Pass'], ['other', 'Also on']];
    const evs = K.dayEvents ? K.dayEvents(ds) : [];
    return h('section', { class: 'sv-dayview' }, strip,
      h('h2', { class: 'sv-dtitle' }, K.prettyDate(ds, { weekday: 'long', day: 'numeric', month: 'long' })),
      evs.map((e) => h('div', { class: 'sv-evbox' }, h('b', null, '★ ' + (e.title || 'Event')), h('span', null, [e.time, e.guests ? e.guests + ' guests' : '', +e.cooks ? 'needs ' + e.cooks + ' cooks' : ''].filter(Boolean).join(' · ')))),
      h('div', { class: 'sv-card sv-lines' }, ORDER.filter((o) => groups[o[0]]).map((o) => h('div', { class: 'sv-line' },
        h('span', { class: 'sv-lab' }, h('i', { class: 'svc-' + (/^learn/.test(o[0]) ? 'learn' : o[0] === 'other' ? 'plain' : o[0]) }), o[1]),
        h('span', { class: 'sv-who' }, groups[o[0]].map((x) => h('span', { class: 'sv-p' + (x.id === me ? ' me' : ''), title: x.uf ? 'Not fair: ' + x.uf.why : null }, x.uf ? h('span', { class: 'uf-mini', 'aria-label': 'not fair: ' + x.uf.why }, K.icon('sad')) : null, K.personName(x.id), x.tag ? h('small', null, x.tag) : null))))),
        Object.keys(groups).length ? null : h('p', { class: 'sv-none' }, 'Nobody is on the rota this day.')),
      h('p', { class: 'sv-off' }, h('b', null, 'Off: '), off.length ? off.map((id) => K.personName(id)).join(', ') : 'nobody'));
  }

  /* Mine: your next shift, then your seven days and who you are with */
  function mineView(src, at, stAt, mon, isNow, ti, me, ufAt) {
    const box = h('section', { class: 'sv-mine' });
    if (!locked()) box.append(h('label', { class: 'mepick' }, h('span', { class: 'legend' }, 'I am'), K.select([['', 'Pick your name']].concat(src.order.map((id) => [id, K.personName(id)])), src.order.includes(me) ? me : '', (v) => { K.store.set('me', v); K.render(); }, { id: 'mesel', class: 'input' })));
    if (!me || !src.order.includes(me)) {
      box.append(h('p', { class: 'hint' }, locked() ? (me ? 'You are not on this week’s rota.' : 'Your kitchen name, “' + (K.me.name || '') + '”, does not match anyone on the rota. ' + (K.me.admin ? 'Link it in Settings → People and kitchen code.' : 'Ask the head chef to link it in Settings.')) : 'Pick your name once and your shifts show here. This phone remembers it.'));
      return box;
    }
    const S = STN(), from = isNow ? ti : 0, works = (i) => at(me, i) && !isOff(at(me, i));
    const ni = [0, 1, 2, 3, 4, 5, 6].find((i) => i >= from && works(i)), n = [0, 1, 2, 3, 4, 5, 6].filter(works).length;
    if (ni != null) {
      const day = K.ymd(K.addDays(mon, ni)), t0 = new Date(), when = day === K.ymd(t0) ? 'Today' : day === K.ymd(K.addDays(t0, 1)) ? 'Tomorrow' : K.prettyDate(day, { weekday: 'long', day: 'numeric', month: 'short' });
      const st = stAt(me, ni);
      box.append(h('div', { class: 'sv-next' }, h('span', null, 'Your next shift'), h('b', null, when), h('span', null, [st ? S[st] || st : '', hoursOf(at(me, ni))].filter(Boolean).join(' · '))));
    }
    box.append(h('div', { class: 'sv-card sv-mydays' }, K.DAYS.map((d, i) => {
      const c = at(me, i), st = stAt(me, i), k = kindOf(c, st), dd = K.addDays(mon, i);
      const mates = works(i) && st ? src.order.filter((id) => id !== me && works(i) && at(id, i) && !isOff(at(id, i)) && stAt(id, i) === st).map((id) => K.personName(id)) : [];
      return h('div', { class: 'sv-myday' + (k === 'off' || k === 'empty' ? ' off' : '') + (isNow && i === ti ? ' today' : '') },
        h('span', { class: 'sv-md' }, h('span', null, d), h('b', null, String(dd.getDate()))),
        h('span', { class: 'svc svc-' + k + (c.length > 3 ? ' long' : ''), title: st ? S[st] || st : null }, k === 'off' || k === 'empty' ? 'off' : c),
        h('span', { class: 'sv-mt' }, h('b', null, k === 'off' || k === 'empty' ? 'Day off' : [st ? S[st] || st : '', hoursOf(c)].filter(Boolean).join(' · ') || c),
          mates.length ? h('small', null, 'with ' + mates.join(', ')) : null,
          ufAt(me, i) ? h('span', { class: 'uf-line' }, K.icon('sad'), 'Not fair: ' + ufAt(me, i).why + (K.calendarOn ? ' · +' + ufAt(me, i).n + ' points' : '')) : null));
    })),
    h('p', { class: 'sv-sum' }, n + (n === 1 ? ' shift' : ' shifts') + ' this week'));
    return box;
  }

  function legend() {
    const list = D.codes.codes || [];
    const box = h('details', { class: 'block codes-box sv-codes' }, h('summary', { class: 'block-title' }, 'Shift codes'),
      h('div', { class: 'codes' }, list.map((c, i) => h('div', { class: 'coderow' },
        h('span', { class: 'codechip ' + K.codeClass(c.code) }, h('b', { class: 'mono' }, c.code)),
        K.me.admin ? h('input', { class: 'input small', id: 'code' + i, value: c.label || '', 'aria-label': 'Meaning of ' + c.code, placeholder: 'What does it mean?', onchange: (e) => { const n = K.clone(D.codes); n.codes[i].label = e.target.value.trim(); K.saveCodes(n); } }) : h('span', null, c.label || '–'),
        K.me.admin ? h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove code ' + c.code, onclick: () => { const n = K.clone(D.codes); n.codes.splice(i, 1); K.saveCodes(n); } }, K.icon('close')) : null))));
    if (K.me.admin) box.append(h('form', { class: 'inline-form', onsubmit: (e) => { e.preventDefault(); const v = document.getElementById('newcode').value.trim(); if (!v) return; const n = K.clone(D.codes); n.codes.push({ code: v, label: '' }); K.saveCodes(n); } },
      h('input', { class: 'input', id: 'newcode', placeholder: 'New code, e.g. SER2', 'aria-label': 'New code' }), h('button', { class: 'btn', type: 'submit' }, 'Add code')));
    return box;
  }

  K.SHEETS.cell = function (c) {
    const doc = D.weeks[c.wk];
    if (!doc) return null;
    const cur = ((doc.rows || {})[c.id] || [])[c.i] || '', curSt = ((doc.st || {})[c.id] || [])[c.i] || '';
    const putSt = (v) => { const b = K.clone(doc); b.st = b.st || {}; b.st[c.id] = (b.st[c.id] || EMPTY()).slice(); b.st[c.id][c.i] = v; b.updated = Date.now(); K.saveWeek(c.wk, b); };
    const put = (v) => {
      const b = K.clone(doc);
      if (!b.rows[c.id]) b.rows[c.id] = EMPTY();
      b.rows[c.id][c.i] = v;
      if (['0', 'X', ''].includes(String(v).trim().toUpperCase()) && b.st && b.st[c.id]) b.st[c.id][c.i] = '';
      b.updated = Date.now();
      ui.sheet = c.i < 6 ? { type: 'cell', wk: c.wk, id: c.id, i: c.i + 1 } : null;
      K.saveWeek(c.wk, b);
    };
    const codes = QUICK.concat((D.codes.codes || []).map((x) => x.code)).filter((v, i, a) => a.indexOf(v) === i);
    return K.sheet(K.personName(c.id) + ' · ' + K.DAYS[c.i] + ' ' + K.addDays(K.parseYmd(c.wk), c.i).getDate(), [
      h('div', { class: 'quick' }, codes.map((v) => h('button', { type: 'button', class: 'codechip big ' + K.codeClass(v) + (String(cur).toUpperCase() === v.toUpperCase() ? ' on' : ''), title: K.codeLabel(v) || null, onclick: () => put(v) }, h('b', { class: 'mono' }, v)))),
      K.STL ? h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Station'), K.seg([['', 'None']].concat(['hot', 'cold', 'pass', 'float', 'prep', 'learn', 'learn-pass', 'br'].map((s) => [s, K.STL[s]])), curSt, putSt, { 'aria-label': 'Station', class: 'seg small-seg st-seg' })) : null,
      h('form', { class: 'inline-form', onsubmit: (e) => { e.preventDefault(); put(document.getElementById('cellv').value.trim()); } },
        h('input', { class: 'input', id: 'cellv', value: cur, placeholder: 'Anything else, e.g. 10:30 or BR+4H', 'aria-label': 'Shift' }), h('button', { class: 'btn primary', type: 'submit' }, 'Set')),
      h('div', { class: 'btns' }, h('button', { class: 'btn small', type: 'button', onclick: () => put('') }, 'Clear'),
        c.i > 0 ? h('button', { class: 'btn small', type: 'button', onclick: () => { ui.sheet = { type: 'cell', wk: c.wk, id: c.id, i: c.i - 1 }; K.render(); } }, K.icon('back'), K.DAYS[c.i - 1]) : null,
        c.i < 6 ? h('span', { class: 'hint' }, 'After you pick, it moves on to ' + K.DAYS[c.i + 1] + '.') : null),
    ]);
  };
  K.SHEETS.row = function (c) {
    const doc = D.weeks[c.wk];
    if (!doc) return null;
    const idx = doc.people.indexOf(c.id), p = D.staff.people.find((x) => x.id === c.id) || { id: c.id, name: '' };
    const mv = (d) => { const b = K.clone(doc), j = idx + d; if (j < 0 || j >= b.people.length) return; b.people.splice(j, 0, b.people.splice(idx, 1)[0]); b.updated = Date.now(); K.saveWeek(c.wk, b); };
    return K.sheet(p.name || 'Person', [
      K.field('Name', h('input', { class: 'input', id: 'pname-edit', value: p.name, onchange: (e) => { const v = e.target.value.trim(); if (!v) return; const n = K.clone(D.staff); n.people.forEach((x) => { if (x.id === c.id) x.name = v; }); K.saveStaff(n); } })),
      h('div', { class: 'btns' }, h('button', { class: 'btn small', type: 'button', disabled: idx <= 0, onclick: () => mv(-1) }, K.icon('up'), 'Move up'),
        h('button', { class: 'btn small', type: 'button', disabled: idx >= doc.people.length - 1, onclick: () => mv(1) }, K.icon('down'), 'Move down')),
      h('button', { class: 'btn danger small', type: 'button', onclick: () => { const b = K.clone(doc); b.people.splice(idx, 1); delete b.rows[c.id]; b.updated = Date.now(); ui.sheet = null; K.saveWeek(c.wk, b); } }, 'Remove from this week'),
    ]);
  };
  K.SHEETS.person = function (c) {
    return K.sheet('New person', h('form', { class: 'inline-form', onsubmit: (e) => {
      e.preventDefault();
      const v = document.getElementById('pname').value.trim();
      if (!v) return;
      const id = 'p' + K.uid(), n = K.clone(D.staff), doc = D.weeks[c.wk];
      n.people.push({ id: id, name: v });
      K.saveStaff(n);
      if (doc) { const b = K.clone(doc); b.people.push(id); b.rows[id] = EMPTY(); b.updated = Date.now(); K.saveWeek(c.wk, b); }
      ui.sheet = null; K.render();
    } }, h('input', { class: 'input', id: 'pname', placeholder: 'Name', 'aria-label': 'Name', autofocus: true }), h('button', { class: 'btn primary', type: 'submit' }, 'Add')));
  };
})();
