/* The rota generator's screens, for the head chef and the sous chef: the draft week with its holes,
   who works where (Team) and what each station needs every day (Needs). Everything lives in
   settings/rotaplan in the kitchen's own database; the repo holds no names. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const STL = { hot: 'Hot', cold: 'Cold', pass: 'Pass', prep: 'Prep', learn: 'Hot · learning', float: 'Filler', 'learn-hot': 'Hot · learning', 'learn-cold': 'Cold · learning', 'learn-pass': 'Pass · learning', br: 'Breakfast' };
  K.STL = STL;
  const PLACES = [['hot', 'Hot'], ['cold', 'Cold & pastry'], ['pass', 'Pass']];

  K.rotaPlan = function () {
    const p = D.rotaplan ? K.clone(D.rotaplan) : {};
    const ones = () => [1, 1, 1, 1, 1, 1, 1];
    p.people = p.people || {};
    p.needs = p.needs || { hot: ones(), cold: ones(), pass: ones() };
    PLACES.forEach((s) => { if (!Array.isArray(p.needs[s[0]])) p.needs[s[0]] = ones(); });
    if (!Array.isArray(p.busy)) p.busy = [4, 5];
    if (!Array.isArray(p.brDays)) p.brDays = [5, 6];
    p.brCode = p.brCode || 'BR+P';
    return p;
  };
  const save = (p) => { D.rotaplan = p; K.refresh(true); return K.db.doc('settings/rotaplan').set(p).catch(K.writeFailed); };
  const person = (p, id) => (p.people[id] = p.people[id] || { mode: 'off' });
  const range = (wk) => { const m = K.parseYmd(wk), s = K.addDays(m, 6); return m.getDate() + '.' + (m.getMonth() + 1) + ' – ' + s.getDate() + '.' + (s.getMonth() + 1); };
  const nextWeek = () => K.ymd(K.addDays(K.mondayOf(new Date()), 7));
  /* the stations someone can work, as small coloured letters under their name: always in the same order,
     so the team sees where people can work but not the head chef's order of preference */
  K.stDots = function (id) {
    const s = (D.rotaplan && D.rotaplan.people || {})[id];
    if (!s || (s.mode !== 'auto' && !(s.mode === 'hand' && (s.cover || []).length))) return null;
    const list = s.mode === 'hand' ? s.cover || [] : s.stations || [];
    const can = [['hot', 'H'], ['cold', 'C'], ['pass', 'P']].filter((x) => list.includes(x[0]));
    if (!can.length) return null;
    const em = (st) => s.mode === 'hand' || (s.emergency || []).includes(st), lab = (x) => STL[x[0]] + (em(x[0]) ? ' (emergency only)' : '');
    return h('span', { class: 'stdots', title: 'Can work: ' + can.map(lab).join(', ') },
      h('span', { class: 'sr' }, 'Can work ' + can.map(lab).join(', ')),
      can.map((x) => h('i', { class: 'sd-' + x[0] + (em(x[0]) ? ' em' : ''), 'aria-hidden': 'true' }, x[1])));
  };
  K.stTag = (st) => (st && STL[st] ? h('small', { class: 'stag st-' + st }, STL[st]) : null);

  /* the draft for a week; worked out again only when something it depends on changes */
  const memo = new Map();
  K.rotaInput = function (wk, requests) {
    const plan = K.rotaPlan(), doc = D.weeks[wk], keep = {}, pins = ((plan.pins || {})[wk] || []).slice();
    delete plan.pins;
    if (doc) Object.keys(doc.rows || {}).forEach((id) => { keep[id] = doc.rows[id]; });
    const people = (D.staff.people || []).map((p) => ({ id: p.id, name: p.name }));
    const end = K.ymd(K.addDays(K.parseYmd(wk), 6));
    const nextMon = K.ymd(K.addDays(K.parseYmd(wk), 7));
    const events = (D.events || []).filter((e) => K.isLive(e) && e.status !== 'pending' && e.date >= wk && e.date <= nextMon && (+e.cooks > 0 || +e.before > 0)).map((e) => ({ date: e.date, cooks: e.date <= end ? +e.cooks || 0 : 0, when: e.when || '', before: +e.before || 0, title: e.title || 'Event' }));
    return { week: wk, plan: plan, people: people, requests: requests || [], keep: keep, events: events, pins: pins };
  };
  K.rotaReady = () => { const p = K.rotaPlan().people; return Object.keys(p).some((id) => p[id].mode === 'auto'); };
  K.rotaDraft = function (wk, requests) {
    const input = K.rotaInput(wk, requests);
    const key = JSON.stringify(input);
    if (!memo.has(key)) { memo.set(key, K.rotaGen(input)); if (memo.size > 12) memo.delete(memo.keys().next().value); }
    return memo.get(key);
  };
  /* the head chef's word on a hole: this person works that day at that station. Saved with the setup, so every
     phone's draft follows it, and the generator re-plans the rest of the week around it */
  K.rotaPins = (wk) => ((K.rotaPlan().pins || {})[wk] || []);
  function addPin(wk, pin) {
    const p = K.rotaPlan(), l = ((p.pins = p.pins || {})[wk] = (p.pins[wk] || []).filter((x) => !(x.person === pin.person && x.date === pin.date)));
    l.push(pin);
    save(p);
  }
  function dropPin(wk, pin) {
    const p = K.rotaPlan();
    p.pins = p.pins || {};
    p.pins[wk] = (p.pins[wk] || []).filter((x) => !(x.person === pin.person && x.date === pin.date));
    if (!p.pins[wk].length) delete p.pins[wk];
    save(p);
  }

  K.V.rotaplan = function () {
    if (!K.me.admin) { ui.view = 'schedule'; return K.V.schedule(); }
    const wk = ui.rpWeek || nextWeek(), tab = ui.rpTab || 'draft';
    const top = K.subbar('Schedule', () => K.go('schedule'), [], 'Rota generator');
    const w = h('div', { class: 'wrap page rplan' });
    w.append(h('div', { class: 'rp-head' },
      h('div', { class: 'weeknav' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous week', onclick: () => { ui.rpWeek = K.ymd(K.addDays(K.parseYmd(wk), -7)); K.render(); } }, K.icon('back')),
        h('b', { class: 'rp-week' }, 'Week ' + range(wk)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Next week', onclick: () => { ui.rpWeek = K.ymd(K.addDays(K.parseYmd(wk), 7)); K.render(); } }, K.icon('next'))),
      K.seg([['draft', 'Draft'], ['team', 'Team'], ['needs', 'Needs']], tab, (v) => { ui.rpTab = v; K.render(); }, { 'aria-label': 'Part of the generator' })));
    if (tab === 'team') w.append(team());
    else if (tab === 'needs') w.append(needsView());
    else w.append(draft(wk));
    return { top: top, body: w, tabs: false };
  };

  /* ---------- the draft ---------- */
  function draft(wk) {
    const plan = K.rotaPlan(), box = h('div', { class: 'rp-draft' });
    if (!Object.keys(plan.people).some((id) => plan.people[id].mode && plan.people[id].mode !== 'off')) {
      box.append(K.catRest('Nobody in the generator yet', 'Open Team and say who works where, then come back here.',
        h('div', { class: 'btns center' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { ui.rpTab = 'team'; K.render(); } }, 'Open Team'))));
      return box;
    }
    const r = K.rotaDraft(wk, K.requestsFor ? K.requestsFor(wk) : []), pins = K.rotaPins(wk), me = K.getMe(), mine = me && plan.people[me] && plan.people[me].mode === 'auto' ? plan.people[me] : null;
    const red = r.issues.filter((x) => x.sev === 'red');
    const dateOf = (d) => K.ymd(K.addDays(K.parseYmd(wk), d));
    const stFor = (x, id) => (x.st && !x.event ? x.st : ((plan.people[id] || {}).stations || [])[0] || 'float');
    const amber = r.issues.filter((x) => x.sev === 'amber'), info = r.issues.filter((x) => x.sev === 'info');
    if (red.length) {
      box.append(h('section', { class: 'rp-holes' }, h('h2', { class: 'block-title' }, K.icon('flag'), red.length + (red.length === 1 ? ' hole' : ' holes') + ' to fill'),
        h('p', { class: 'hint' }, 'The generator could not fill these. Pick who steps in and it re-plans the rest of the week around it.'),
        red.map((x) => {
          const canMe = mine && x.day != null && (!x.st || x.event || (mine.stations || []).includes(x.st)) && !(x.could || []).some((c) => c.id === me);
          return h('div', { class: 'rp-hole' }, h('b', null, x.text),
            canMe ? h('div', { class: 'rp-could' },
              h('button', { class: 'btn small primary', type: 'button', onclick: () => addPin(wk, { person: me, date: dateOf(x.day), st: stFor(x, me) }) }, h('span', null, 'I’ll cover it'), h('small', null, 'and take another day off')),
              h('button', { class: 'btn small', type: 'button', onclick: () => addPin(wk, { person: me, date: dateOf(x.day), st: stFor(x, me), extra: true }) }, h('span', null, 'I’ll cover it'), h('small', null, 'as an extra day'))) : null,
            x.could && x.could.length ? h('div', { class: 'rp-could' }, x.could.map((c) => h('button', { class: 'btn small', type: 'button', onclick: () => addPin(wk, { person: c.id, date: dateOf(x.day), st: stFor(x, c.id) }) },
              h('span', null, K.personName(c.id)), h('small', null, c.why))))
              : canMe ? null : h('p', { class: 'hint' }, 'Nobody who can work there is free. This one is for you or the head chef.'));
        })));
    } else box.append(h('p', { class: 'rp-ok' }, K.icon('check'), 'Every place is filled.'));
    if (pins.length) box.append(h('section', { class: 'rp-pins' }, h('h2', { class: 'block-title' }, 'Your calls this week'),
      pins.map((p) => h('div', { class: 'rp-pin' }, h('span', null, h('b', null, K.personName(p.person)), ' on ' + (STL[p.st] || p.st) + ', ' + K.prettyDate(p.date, { weekday: 'short', day: 'numeric' }) + (p.extra ? ' (extra day)' : '')),
        h('button', { class: 'btn small', type: 'button', onclick: () => dropPin(wk, p) }, 'Undo')))));
    if (amber.length) box.append(h('section', { class: 'rp-warn' }, h('h2', { class: 'block-title' }, 'Worth a look'), h('ul', null, amber.map((x) => h('li', null, x.text)))));
    if (info.length) box.append(h('details', { class: 'rp-info' }, h('summary', null, info.length + ' small notes'), h('ul', null, info.map((x) => h('li', null, x.text)))));

    const mon = K.parseYmd(wk);
    box.append(h('div', { class: 'rota-wrap card' }, h('table', { class: 'rota' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, h('span', { class: 'sr' }, 'Person')), DAYS.map((d, i) => h('th', { scope: 'col' }, h('span', null, d), h('small', null, K.addDays(mon, i).getDate() + '.' + (K.addDays(mon, i).getMonth() + 1)))))),
      h('tbody', null, r.order.map((id) => h('tr', null, h('th', { scope: 'row' }, h('span', { class: 'rname' }, K.personName(id)), K.stDots(id)),
        DAYS.map((d, i) => {
          const c = r.rows[id][i] || '', s = r.st[id][i] || '', hand = pins.some((p) => p.person === id && p.date === dateOf(i));
          return h('td', { class: K.codeClass(c) + (hand ? ' fixed' : '') }, h('span', { class: 'mono' }, c || '–'), K.stTag(s));
        })))))));
    const has = !!D.weeks[wk];
    box.append(h('div', { class: 'rp-use' },
      ui.rpConfirm === wk ? h('div', { class: 'banner warn' }, h('b', null, 'Replace the rota already saved for ' + range(wk) + '?'),
        h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => use(wk, r) }, 'Yes, replace it'), h('button', { class: 'btn', type: 'button', onclick: () => { ui.rpConfirm = ''; K.render(); } }, 'Cancel')))
        : h('button', { class: 'btn primary wide', type: 'button', onclick: () => { if (has) { ui.rpConfirm = wk; K.render(); } else use(wk, r); } }, K.icon('check'), 'Use this draft for ' + range(wk)),
      h('p', { class: 'hint' }, 'You can still change any cell on the Schedule afterwards.')));
    return box;
  }
  function use(wk, r) {
    const old = D.weeks[wk] || {}, people = r.order.slice(), rows = K.clone(r.rows), st = K.clone(r.st);
    (old.people || []).forEach((id) => { if (!people.includes(id)) { people.push(id); rows[id] = (old.rows || {})[id] || ['', '', '', '', '', '', '']; } });
    ui.rpConfirm = '';
    K.saveWeek(wk, { week: wk, people: people, rows: rows, st: st, note: old.note || '', updated: Date.now(), made: 'generator' });
    ui.week = wk;
    K.go('schedule');
    K.toast('Rota for ' + range(wk) + ' saved', { tone: 'good' });
  }

  /* ---------- who works where ---------- */
  function team() {
    const plan = K.rotaPlan(), list = D.staff.people || [];
    const set = (fn) => { fn(plan); save(plan); };
    const box = h('div', { class: 'rp-team' }, h('p', { class: 'hint' }, 'Tap the stations in your order: 1 is where you would rather have them, then the alternatives. Stations not tapped are ones they cannot work.'));
    if (!list.length) box.append(h('p', { class: 'none' }, 'Add people on the Schedule first.'));
    list.forEach((pp) => {
      const s = plan.people[pp.id] || { mode: 'off' }, id = pp.id;
      if (ui.rpOpen !== id) {
        box.append(h('button', { type: 'button', class: 'card rp-sum' + (s.mode === 'off' || !s.mode ? ' is-off' : ''), onclick: () => { ui.rpOpen = id; K.render(); } },
          h('b', null, pp.name, K.stDots(id)), h('span', null, summary(s)), K.icon('next')));
        return;
      }
      const card = h('section', { class: 'card rp-person' + (s.mode === 'off' || !s.mode ? ' is-off' : '') },
        h('div', { class: 'rp-ph' }, h('h3', null, pp.name), h('button', { class: 'btn small', type: 'button', onclick: () => { ui.rpOpen = ''; K.render(); } }, 'Done')),
        h('div', null,
          K.seg([['auto', 'Generator'], ['fixed', 'Fixed week'], ['hand', 'By hand'], ['off', 'Not on the rota']], s.mode || 'off', (v) => set((p) => { person(p, id).mode = v; }), { 'aria-label': 'How ' + pp.name + ' is planned', class: 'seg small-seg' })));
      if (s.mode === 'auto') {
        const sts = s.stations || [];
        card.append(...[
          row('Stations', h('div', { class: 'rp-order' }, [['hot', 'Hot'], ['cold', 'Cold'], ['pass', 'Pass'], ['prep', 'Prep']].map((o) => {
            const i = sts.indexOf(o[0]);
            return h('button', { type: 'button', class: 'chip', 'aria-pressed': i >= 0 ? 'true' : 'false', onclick: () => set((p) => { const q = person(p, id), l = (q.stations || []).slice(), j = l.indexOf(o[0]); if (j >= 0) l.splice(j, 1); else l.push(o[0]); q.stations = l; }) },
              i >= 0 ? h('b', { class: 'rp-n' }, String(i + 1)) : null, o[1]);
          }))),
          sts.filter((x) => x !== 'prep').length > 1 ? row('Only in an emergency', h('div', { class: 'rp-order' }, sts.filter((x) => x !== 'prep').slice(1).map((st) => {
            const on = (s.emergency || []).includes(st);
            return h('button', { type: 'button', class: 'chip', 'aria-pressed': on ? 'true' : 'false', onclick: () => set((p) => { const q = person(p, id), l = (q.emergency || []).slice(), j = l.indexOf(st); if (j >= 0) l.splice(j, 1); else l.push(st); q.emergency = l; }) }, on ? '! ' : '', STL[st]);
          }))) : null,
          row('Learning', h('div', { class: 'rp-order' }, [['hot', 'Hot'], ['cold', 'Cold'], ['pass', 'Pass']].filter((o) => !sts.includes(o[0])).map((o) => {
            const on = (s.learn || []).includes(o[0]);
            return h('button', { type: 'button', class: 'chip', 'aria-pressed': on ? 'true' : 'false', onclick: () => set((p) => { const q = person(p, id), l = (q.learn || []).slice(), j = l.indexOf(o[0]); if (j >= 0) l.splice(j, 1); else l.push(o[0]); q.learn = l; }) }, o[1]);
          }))),
          (s.learn || []).length ? row('Learning days', K.select([0, 1, 2, 3].map((n) => [n, n ? n + ' a week' : 'None this week']), s.learnDays || 0, (v) => set((p) => { person(p, id).learnDays = +v; }), { 'aria-label': 'Learning days a week', class: 'input small' })) : null,
          row('Days a week', K.seg([1, 2, 3, 4, 5, 6, 7].map((n) => [n, String(n)]), s.days || 0, (v) => set((p) => { person(p, id).days = v; }), { 'aria-label': 'Days a week', class: 'seg small-seg' })),
          plan.periods ? row('Late shifts', K.select([0, 1, 2, 3, 4].map((n) => [n, n ? n + ' a week (from 15:00)' : 'None, all full']), s.late || 0, (v) => set((p) => { person(p, id).late = +v; }), { 'aria-label': 'Late shifts a week', class: 'input small' })) : null,
          row('Normal shift', h('input', { class: 'input small rp-code', value: s.code || '2', 'aria-label': 'Normal shift code', onchange: (e) => set((p) => { person(p, id).code = e.target.value.trim() || '2'; }) })),
          row('Always off', days(s.off || [], (l) => set((p) => { person(p, id).off = l; }))),
          row('Prep days', h('div', { class: 'rp-inline' },
            K.select([0, 1, 2, 3, 4].map((n) => [n, n ? n + ' a week' : 'None']), (s.special && s.special.n) || 0, (v) => set((p) => { const q = person(p, id); q.special = Object.assign({ code: '10:30' }, q.special, { n: +v }); }), { 'aria-label': 'Prep days a week', class: 'input small' }),
            s.special && s.special.n ? h('input', { class: 'input small rp-code', value: s.special.code || '10:30', 'aria-label': 'Shift on prep days', onchange: (e) => set((p) => { person(p, id).special.code = e.target.value.trim() || '10:30'; }) }) : null)),
          row('Weekend breakfast', brPick(s, (v) => set((p) => { person(p, id).br = v; }))),
          h('div', { class: 'rp-flags' },
            check('Learning Hot: not alone on busy days, learns next to a mentor when spare', !!s.learner, (v) => set((p) => { person(p, id).learner = v; })),
            check('Mentor on Hot', !!s.mentor, (v) => set((p) => { person(p, id).mentor = v; })),
            check('Keep days off together when possible', !!s.together, (v) => set((p) => { person(p, id).together = v; })))].filter(Boolean));
      } else if (s.mode === 'fixed') {
        card.append(...[row('Every week', h('div', { class: 'rp-pattern' }, DAYS.map((d, i) => h('label', null, h('span', null, d),
          h('input', { class: 'input small mono', value: (s.pattern || [])[i] || '', 'aria-label': pp.name + ' ' + d, onchange: (e) => set((p) => { const q = person(p, id); q.pattern = (q.pattern || ['', '', '', '', '', '', '']).slice(); q.pattern[i] = e.target.value.trim(); }) }))))),
        plan.periods ? row('Covers at lunch', h('div', { class: 'rp-order' }, [['hot', 'Hot'], ['cold', 'Cold'], ['pass', 'Pass']].map((o) => {
          const on = (s.lunch || []).includes(o[0]);
          return h('button', { type: 'button', class: 'chip', 'aria-pressed': on ? 'true' : 'false', onclick: () => set((p) => { const q = person(p, id), l = (q.lunch || []).slice(), j = l.indexOf(o[0]); if (j >= 0) l.splice(j, 1); else l.push(o[0]); q.lunch = l; }) }, o[1]);
        }))) : null,
        row('Station', K.select([['', 'None'], ['br', 'Breakfast'], ['hot', 'Hot'], ['cold', 'Cold'], ['pass', 'Pass'], ['prep', 'Prep']], s.patternSt || '', (v) => set((p) => { person(p, id).patternSt = v; }), { 'aria-label': 'Station', class: 'input small' })),
        row('Weekend breakfast', brPick(s, (v) => set((p) => { person(p, id).br = v; })))].filter(Boolean));
      } else if (s.mode === 'hand') {
        card.append(h('p', { class: 'hint' }, 'You fill this row yourself. The generator leaves it alone, unless a place would be empty.'),
          row('Can cover, last resort', h('div', { class: 'rp-order' }, [['hot', 'Hot'], ['cold', 'Cold'], ['pass', 'Pass']].map((o) => {
            const on = (s.cover || []).includes(o[0]);
            return h('button', { type: 'button', class: 'chip', 'aria-pressed': on ? 'true' : 'false', onclick: () => set((p) => { const q = person(p, id), l = (q.cover || []).slice(), j = l.indexOf(o[0]); if (j >= 0) l.splice(j, 1); else l.push(o[0]); q.cover = l; }) }, on ? '! ' : '', o[1]);
          }))),
          row('Weekend breakfast', brPick(s, (v) => set((p) => { person(p, id).br = v; }))));
      }
      box.append(card);
    });
    return box;
  }
  function summary(s) {
    if (s.mode === 'fixed') return 'Same every week: ' + (s.pattern || []).map((c, i) => c && !/^(0|X)$/i.test(c) ? DAYS[i] : '').filter(Boolean).join(' ') + (s.br ? ' · breakfast ' + s.br + '.' : '');
    if (s.mode === 'hand') return 'Filled by hand' + ((s.cover || []).length ? ' · covers ' + s.cover.map((x) => STL[x]).join(', ') + ' as the last resort' : '') + (s.br ? ' · breakfast, choice ' + s.br : '');
    if (s.mode !== 'auto') return 'Not on the rota';
    const st = (s.stations || []).map((x) => STL[x] + ((s.emergency || []).includes(x) ? ' (emergency)' : '')).join(' → ') || 'no station yet';
    return [st, (s.days || 0) + ' days' + (s.late ? ' (' + s.late + ' late)' : ''), (s.off || []).length ? 'off ' + s.off.map((d) => DAYS[d]).join(' ') : '', s.special && s.special.n ? s.special.n + ' prep days' : '',
      s.br ? 'breakfast, choice ' + s.br : '', s.learner ? 'learning Hot' : '', (s.learn || []).length ? 'learning ' + s.learn.map((x) => STL[x]).join(', ') + ' ' + (s.learnDays || 0) + ' day' + (s.learnDays === 1 ? '' : 's') + ' a week' : '', s.mentor ? 'mentor' : '', s.together ? 'days off together' : ''].filter(Boolean).join(' · ');
  }
  const row = (label, ctrl) => h('div', { class: 'rp-row' }, h('span', { class: 'legend' }, label), ctrl);
  function days(sel, onpick) {
    return h('div', { class: 'rp-days' }, DAYS.map((d, i) => h('button', { type: 'button', class: 'chip', 'aria-pressed': sel.includes(i) ? 'true' : 'false', onclick: () => onpick(sel.includes(i) ? sel.filter((x) => x !== i) : sel.concat([i]).sort()) }, d)));
  }
  function brPick(s, onpick) {
    return K.select([[0, 'Never']].concat([1, 2, 3, 4, 5, 6].map((n) => [n, n === 1 ? '1st choice' : n === 2 ? '2nd choice' : n === 3 ? '3rd choice' : n + 'th choice'])), s.br || 0, (v) => onpick(+v), { 'aria-label': 'Weekend breakfast', class: 'input small' });
  }
  function check(label, on, onpick) {
    return h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: on, onchange: (e) => onpick(e.target.checked) }), h('span', null, label));
  }

  /* ---------- what each station needs ---------- */
  function needsView() {
    const plan = K.rotaPlan(), set = (fn) => { fn(plan); save(plan); };
    return h('div', { class: 'rp-needs' },
      h('p', { class: 'hint' }, 'How many people each station needs on each day, not counting prep or anyone learning.'),
      h('div', { class: 'rota-wrap card' }, h('table', { class: 'rota rp-ntable' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, h('span', { class: 'sr' }, 'Station')), DAYS.map((d) => h('th', { scope: 'col' }, d)))),
        h('tbody', null, PLACES.map((s) => h('tr', null, h('th', { scope: 'row' }, s[1]), DAYS.map((d, i) => h('td', null,
          K.select([0, 1, 2, 3].map((n) => [n, String(n)]), plan.needs[s[0]][i], (v) => set((p) => { p.needs[s[0]][i] = +v; }), { 'aria-label': s[1] + ' on ' + d, class: 'input small rp-n-in' })))))))),
      h('div', { class: 'rp-row' }, h('span', { class: 'legend' }, 'Lunch and night'),
        check('Plan lunch and night separately: a full shift (P) counts for both, a late shift for the night only', !!plan.periods, (v) => set((p) => { p.periods = v; if (v && !Array.isArray(p.lunchMin)) p.lunchMin = [3, 3, 3, 3, 3, 3, 3]; }))),
      plan.periods ? h('div', { class: 'rota-wrap card' }, h('table', { class: 'rota rp-ntable' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, h('span', { class: 'sr' }, 'Need')), DAYS.map((d) => h('th', { scope: 'col' }, d)))),
        h('tbody', null, h('tr', null, h('th', { scope: 'row' }, 'Cooks at lunch'), DAYS.map((d, i) => h('td', null,
          K.select([0, 1, 2, 3, 4, 5].map((n) => [n, String(n)]), (plan.lunchMin || [])[i] || 0, (v) => set((p) => { p.lunchMin = (p.lunchMin || [0, 0, 0, 0, 0, 0, 0]).slice(); p.lunchMin[i] = +v; }), { 'aria-label': 'Cooks at lunch on ' + d, class: 'input small rp-n-in' }))))))) : null,
      plan.periods ? row('Late shift code', h('input', { class: 'input small rp-code', value: plan.lateCode || '2', 'aria-label': 'Shift code for a late shift', onchange: (e) => set((p) => { p.lateCode = e.target.value.trim() || '2'; }) })) : null,
      plan.periods ? h('p', { class: 'hint' }, 'At night each station needs its cook and, ideally, one filler on top; a night without a filler is flagged.') : null,
      row('Busy days', days(plan.busy, (l) => set((p) => { p.busy = l; }))),
      h('p', { class: 'hint' }, 'Someone still learning Hot is only put there alone on a busy day if nobody else can.'),
      row('Weekend breakfast on', days(plan.brDays, (l) => set((p) => { p.brDays = l; }))),
      row('Breakfast cover code', h('input', { class: 'input small rp-code', value: plan.brCode, 'aria-label': 'Shift code for whoever covers breakfast', onchange: (e) => set((p) => { p.brCode = e.target.value.trim() || 'BR+P'; }) })));
  }
})();
