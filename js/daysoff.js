/* Days off: a calendar the whole team shares. Anyone asks for a day off and says why; the team sees
   it. A normal day off is accepted straight away when the week still works without them, otherwise
   it waits for the head chef or the sous chef. Urgent ("I just can't") always goes in, in red, and
   paid vacation and unpaid leave are always approved by hand. Each request is one document per
   person per day in dayoff/<date>_<person>. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const KIND = { ask: 'Day off', urgent: 'Urgent', paid: 'Paid vacation', unpaid: 'Unpaid leave' };
  const STATUS = { ok: 'Accepted', waiting: 'Waiting for approval', approved: 'Approved', refused: 'Refused' };
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  K.DAYOFF_KIND = KIND;
  /* the calendar (asking for days off, cover points) is still being worked on: it is on only where the page
     turns it on (window.KOMAT_CALENDAR = true, the test copy); elsewhere the rota shows without it */
  K.calendarOn = window.KOMAT_CALENDAR === true;

  const all = () => Object.keys(D.dayoff || {}).map((k) => D.dayoff[k]);
  const live = (r) => r.status !== 'refused';
  const onDay = (ds) => all().filter((r) => r.date === ds).sort((a, b) => (a.at || 0) - (b.at || 0));
  K.requestsFor = function (wk) {
    const end = K.ymd(K.addDays(K.parseYmd(wk), 6));
    return all().filter((r) => r.date >= wk && r.date <= end).map((r) => ({ person: r.person, date: r.date, kind: r.kind, status: r.status }));
  };
  K.waitingDayoff = () => all().filter((r) => r.status === 'waiting' && r.date >= K.day(0));
  K.waitingCount = () => new Set(K.waitingDayoff().map((r) => r.group || r.id)).size;
  /* a short name for the calendar: the first name, cut to 4 letters (Ani and Ali stay apart) */
  const short = (id) => { const n = String(K.personName(id) || '?').trim().split(/\s+/)[0]; return n.length > 4 ? n.slice(0, 4) : n; };
  const initials = (id) => String(K.personName(id) || '?').trim().split(/\s+/).map((w) => w.charAt(0)).join('').slice(0, 2).toUpperCase();
  const hue = (id) => { let x = 0; for (const c of String(id)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % 360; };
  const face = (id, cls) => h('span', { class: 'off-face ' + (cls || ''), style: { '--h': hue(id) }, 'aria-hidden': 'true' }, initials(id));
  const pretty = (ds) => K.prettyDate(ds, { weekday: 'short', day: 'numeric', month: 'short' });
  const mondayOf = (ds) => K.ymd(K.mondayOf(K.parseYmd(ds)));
  /* the week we are in is set: days off are asked from next Monday on (urgent still goes in; the chefs can do anything) */
  const openFrom = () => K.ymd(K.addDays(K.parseYmd(K.thisWeek()), 7));
  K.dayLocked = (ds) => ds < openFrom();
  const kindIcon = (r) => (r.kind === 'urgent' ? '!' : r.kind === 'paid' ? '☀' : r.kind === 'unpaid' ? '–' : '');

  /* ---------- cover points: earned for stepping in, spent on priority; they never run out ---------- */
  /* prices: priority on a taken day 3, a guaranteed day off 6, a guaranteed weekend (Fri+Sat or Sat+Sun) 8;
     a thin day (one where you being off pushes someone onto a backup station or leaves the night without a filler)
     costs 2 more. Savings stop at 20. */
  const PRIORITY = 3, GUARANTEE = 6, WEEKEND = 8, THIN = 2, CAP = 20;
  K.POINTS = { priority: PRIORITY, guarantee: GUARANTEE, weekend: WEEKEND, thin: THIN, cap: CAP };
  const pts = () => Object.keys(D.points || {}).map((k) => D.points[k]);
  K.pointsOf = (id) => pts().filter((p) => p.person === id).reduce((a, p) => a + (+p.n || 0), 0);
  K.awardPoints = function (docId, body) {
    if (!K.calendarOn) return Promise.resolve();
    const b = Object.assign({ at: Date.now(), by: K.me.id || '' }, body);
    if (+b.n > 0) { const was = D.points[docId] && D.points[docId].person === b.person ? +D.points[docId].n || 0 : 0, room = Math.max(0, CAP - (K.pointsOf(b.person) - was)); if (+b.n > room) { b.wanted = +b.n; b.n = room; } }
    D.points[docId] = Object.assign({ id: docId }, b);
    K.db.doc('points/' + docId).set(b).catch(K.writeFailed);
    K.refresh();
  };
  K.removePoints = function (docId) {
    if (!K.calendarOn) return Promise.resolve();
    if (!D.points[docId]) return;
    delete D.points[docId];
    K.db.doc('points/' + docId).delete().catch(K.writeFailed);
    K.refresh();
  };
  /* a priority request withdrawn or refused: the points come back, and whoever gave way gets their day back */
  const refund = (rs) => {
    const r = rs[0];
    if (!r || !(r.priority || r.guaranteed)) return;
    K.removePoints('spend_' + r.date + '_' + r.person);
    const dates = rs.map((x) => x.date);
    all().filter((x) => x.bumpedBy === r.person && dates.includes(x.date)).forEach((x) => K.removePoints('gaveway_' + x.date + '_' + x.person));
    all().filter((x) => x.bumpedBy === r.person && x.status === 'waiting' && dates.includes(x.date)).forEach((x) => {
      const b = Object.assign({}, x, { status: 'ok' }); delete b.id; delete b.bumpedBy;
      D.dayoff[x.id] = Object.assign({ id: x.id }, b);
      K.db.doc('dayoff/' + x.id).set(b).catch(K.writeFailed);
    });
  };

  /* ---------- what happens to a request ---------- */
  function decide(person, dates, kind) {
    if (kind === 'urgent') return 'ok';
    if (kind === 'paid' || kind === 'unpaid') return 'waiting';
    if (!K.rotaReady || !K.rotaReady()) return 'waiting';
    const weeks = Array.from(new Set(dates.map(mondayOf)));
    for (const wk of weeks) {
      if (D.weeks[wk] && D.weeks[wk].final) return 'waiting';
      const base = K.requestsFor(wk);
      const mine = dates.filter((d) => mondayOf(d) === wk).map((d) => ({ person: person, date: d, kind: 'ask', status: 'ok' }));
      const holes = (reqs) => K.rotaGen(K.rotaInput(wk, reqs)).issues.filter((x) => x.sev === 'red').length;
      if (holes(base.filter((r) => !(r.person === person && dates.includes(r.date))).concat(mine)) > holes(base)) return 'waiting';
    }
    return 'ok';
  }
  /* priority: whose plain day off on the same days could go back to waiting so this one fits (the latest asked first) */
  function bumpFor(person, dates) {
    if (!K.rotaReady || !K.rotaReady()) return null;
    const out = [];
    for (const wk of Array.from(new Set(dates.map(mondayOf)))) {
      if (D.weeks[wk] && D.weeks[wk].final) return null;
      const base = K.requestsFor(wk), mine = dates.filter((d) => mondayOf(d) === wk).map((d) => ({ person: person, date: d, kind: 'ask', status: 'ok' }));
      const holes = (reqs) => K.rotaGen(K.rotaInput(wk, reqs)).issues.filter((x) => x.sev === 'red').length, h0 = holes(base);
      if (holes(base.concat(mine)) <= h0) continue;
      const rivals = all().filter((r) => r.person !== person && dates.includes(r.date) && mondayOf(r.date) === wk && r.kind === 'ask' && r.status === 'ok' && !r.priority).sort((a, b) => (b.at || 0) - (a.at || 0));
      const found = rivals.find((r) => holes(base.map((x) => (x.person === r.person && x.date === r.date ? Object.assign({}, x, { status: 'waiting' }) : x)).concat(mine)) <= h0);
      if (!found) return null;
      out.push(found);
    }
    return out;
  }
  /* a thin day: you being off that day pushes someone onto a backup station, a protected day, or leaves a
     night with no filler (the rota as it stands, with and without you) */
  const thinMemo = new Map();
  function thinDays(person, dates) {
    if (!K.rotaReady || !K.rotaReady()) return [];
    const key = person + '|' + dates.join(',') + '|' + JSON.stringify(Object.keys(D.dayoff).length) + '|' + JSON.stringify(D.rotaplan || {}).length;
    if (thinMemo.has(key)) return thinMemo.get(key);
    const out = [];
    Array.from(new Set(dates.map(mondayOf))).forEach((wk) => {
      const base = K.requestsFor(wk).filter((r) => !(r.person === person && dates.includes(r.date)));
      const bad = (reqs) => { const g = K.rotaGen(K.rotaInput(wk, reqs)); const c = {}; g.issues.forEach((x) => { if (x.day != null && (x.sev === 'red' || /emergency only|last resort|no filler/.test(x.text))) c[x.day] = (c[x.day] || 0) + 1; }); return c; };
      const a = bad(base), b = bad(base.concat(dates.filter((d) => mondayOf(d) === wk).map((d) => ({ person: person, date: d, kind: 'urgent', status: 'ok' }))));
      dates.filter((d) => mondayOf(d) === wk).forEach((d) => { const i = Math.round((K.parseYmd(d) - K.parseYmd(wk)) / 86400000); if ((b[i] || 0) > (a[i] || 0)) out.push(d); });
    });
    thinMemo.set(key, out); if (thinMemo.size > 20) thinMemo.delete(thinMemo.keys().next().value);
    return out;
  }
  /* what a request costs: priority 3 a day, a guarantee 6 a day (a weekend pair 8), 2 more for each thin day */
  K.offPrice = function (person, dates, mode) {
    const thin = thinDays(person, dates).length;
    const wd = dates.map((d) => (K.parseYmd(d).getDay() + 6) % 7), weekend = dates.length === 2 && ((wd[0] === 4 && wd[1] === 5) || (wd[0] === 5 && wd[1] === 6));
    const base = mode === 'priority' ? PRIORITY * dates.length : weekend ? WEEKEND : GUARANTEE * dates.length;
    return { n: base + THIN * thin, thin: thin, weekend: weekend && mode === 'guarantee' };
  };

  /* ---------- not fair: working a day you should have had ----------
     A shift is marked with a sad face, and earns more, when it lands on a day you asked off, on your fixed day
     off, on a day you keep off, on a day off-if-possible you did not need to give up, as a day more than your
     usual week, or on a backup station. */
  const UNFAIR = { asked: 5, fixed: 5, kept: 4, ifpossible: 3, extra: 3, backup: 3 };
  const WHY = { asked: 'you asked this day off', fixed: 'your usual day off', kept: 'a day you keep off', ifpossible: 'a day off if possible', extra: 'a day more than your usual week', backup: 'not your usual station' };
  K.unfairWeek = function (wk, rows, st) {
    const plan = K.rotaPlan ? K.rotaPlan() : { people: {} }, out = {};
    const works = (c) => { c = String(c || '').trim(); return !!c && !/^(0|X)$/i.test(c); };
    Object.keys(rows || {}).forEach((id) => {
      const s = plan.people[id] || {}, row = rows[id] || [], sts = (st || {})[id] || [], marks = {};
      const add = (i, k) => { if (!marks[i] || UNFAIR[k] > marks[i].n) marks[i] = { k: k, n: UNFAIR[k], why: WHY[k] }; };
      for (let i = 0; i < 7; i++) {
        if (!works(row[i])) continue;
        const date = K.ymd(K.addDays(K.parseYmd(wk), i));
        if (all().some((r) => r.person === id && r.date === date)) add(i, 'asked');
        if (s.mode !== 'auto') continue;
        if ((s.off || []).includes(i)) add(i, 'fixed');
        if (sts[i] && ((s.emergency || []).includes(sts[i]))) add(i, 'backup');
      }
      if (s.mode === 'auto') {
        /* off-if-possible days: only the ones beyond what was needed to make up the week */
        /* preset days off: only the ones beyond what was needed to make up the week, after the days they asked off */
        const asked = (d) => all().some((r) => r.person === id && r.date === K.ymd(K.addDays(K.parseYmd(wk), d)) && r.status !== 'refused');
        const av = (s.avoid || []).filter((d) => !asked(d)), am = (s.avoidMore || []).filter((d) => !asked(d) && !av.includes(d));
        const free = [0, 1, 2, 3, 4, 5, 6].filter((d) => !(s.off || []).includes(d) && !asked(d) && !av.includes(d) && !am.includes(d)).length;
        const need = Math.max(0, (s.days || 0) - free);
        let needA = Math.min(need, av.length), needM = Math.min(am.length, need - needA);
        for (let i = 0; i < 7; i++) {
          if (!works(row[i])) continue;
          if (av.includes(i)) { if (needA > 0) needA--; else add(i, 'ifpossible'); }
          if (am.includes(i)) { if (needM > 0) needM--; else add(i, 'kept'); }
        }
        /* a day more than usual: full shifts count 1, late shifts 2/3 */
        const thirds = row.reduce((a, c) => a + (!works(c) ? 0 : String(c).trim() === String((D.rotaplan || {}).lateCode || '2') ? 2 : 3), 0);
        if (s.days && !(s.options || []).length && thirds > 3 * s.days) { let last = -1; for (let i = 0; i < 7; i++) if (works(row[i])) last = i; if (last >= 0) add(last, 'extra'); }
      } else if (s.mode === 'hand') {
        for (let i = 0; i < 7; i++) if (works(row[i]) && sts[i] && (s.cover || []).includes(sts[i])) add(i, 'backup');
      }
      if (Object.keys(marks).length) out[id] = marks;
    });
    return out;
  };
  /* once a week is saved, the points that go with it: not-fair shifts and event days (2 for everyone working);
     worked out again whenever the week changes, so a shift moved back takes its points with it */
  K.syncWeekPoints = function (wk, doc) {
    if (!K.calendarOn || !K.me.admin || !doc || !doc.rows) return;
    const want = {}, uf = K.unfairWeek(wk, doc.rows, doc.st || {}), dates = [0, 1, 2, 3, 4, 5, 6].map((i) => K.ymd(K.addDays(K.parseYmd(wk), i)));
    Object.keys(uf).forEach((id) => Object.keys(uf[id]).forEach((i) => { const m = uf[id][i], date = dates[+i]; want['unfair_' + date + '_' + id] = { person: id, n: m.n, kind: 'unfair', date: date, reason: 'Worked ' + pretty(date) + ': ' + m.why }; }));
    dates.forEach((date, i) => (K.dayEvents ? K.dayEvents(date) : []).filter((e) => +e.cooks > 0 || e.status === 'confirmed').slice(0, 1).forEach((e) => {
      Object.keys(doc.rows).forEach((id) => { const c = String(doc.rows[id][i] || '').trim(); if (c && !/^(0|X)$/i.test(c) && !/^BR$/i.test(c)) want['event_' + date + '_' + id] = { person: id, n: 2, kind: 'event', date: date, reason: (e.title || 'Event') + ', ' + pretty(date) }; });
    }));
    Object.keys(D.points || {}).filter((k) => /^(unfair|event|auto)_/.test(k) && dates.includes(D.points[k].date) && !want[k]).forEach((k) => K.removePoints(k));
    Object.keys(want).forEach((k) => { const o = D.points[k]; if (!o || o.reason !== want[k].reason || (+o.n !== want[k].n && !o.wanted)) K.awardPoints(k, want[k]); });
  };
  /* ---------- your week moved: who a request shifted, kept on the request itself ----------
     moved: { person: [{ d: date, a: code before, as: station before, b: code after, bs: station after }] } */
  function noteMoves(person, firstDate, before) {
    const moved = {};
    Object.keys(before).forEach((wk) => {
      const r0 = before[wk], r1 = K.rotaDraft(wk, K.requestsFor(wk));
      Object.keys(r1.rows).forEach((id) => {
        if (id === person) return;
        for (let i = 0; i < 7; i++) {
          const a = String((r0.rows[id] || [])[i] || ''), b = String(r1.rows[id][i] || ''), as = ((r0.st[id] || [])[i]) || '', bs = (r1.st[id][i]) || '';
          if (a !== b || as !== bs) (moved[id] = moved[id] || []).push({ d: K.ymd(K.addDays(K.parseYmd(wk), i)), a: a, as: as, b: b, bs: bs });
        }
      });
    });
    const id0 = firstDate + '_' + person, doc = D.dayoff[id0];
    if (!doc || !Object.keys(moved).length) return;
    doc.moved = moved;
    const body = Object.assign({}, doc); delete body.id;
    K.db.doc('dayoff/' + id0).set(body).catch(K.writeFailed);
    K.refresh();
  }
  const shiftTxt = (c, st) => (!c || /^(0|X)$/i.test(c) ? 'off' : c + (st ? ' ' + (K.STL[st] || st) : ''));
  /* what this phone's person has not seen yet: weeks moved by someone's request, days off taken with priority */
  K.myMoves = function () {
    const me = K.getMe();
    if (!K.calendarOn || !me) return [];
    const seen = K.store.get('movesSeen', []), today = K.day(0), out = [];
    all().forEach((r) => {
      if (r.moved && r.moved[me] && r.person !== me && !seen.includes('m_' + r.id)) {
        const ch = r.moved[me].filter((x) => x.d >= today);
        if (ch.length) out.push({ key: 'm_' + r.id, who: r.person, at: r.at || 0, title: K.personName(r.person) + '’s day off moved your week', lines: ch.map((x) => pretty(x.d) + ': ' + shiftTxt(x.a, x.as) + ' → ' + shiftTxt(x.b, x.bs)), note: 'In the draft. It can still change before the week is posted.' });
      }
      if (r.person === me && r.bumpedBy && r.status === 'waiting' && r.date >= today && !seen.includes('b_' + r.id)) out.push({ key: 'b_' + r.id, who: r.bumpedBy, at: r.at || 0, title: K.personName(r.bumpedBy) + ' used priority on your day off', lines: [pretty(r.date) + ': your day off now waits for the head chef'], note: 'You got 2 points for giving way.' });
    });
    return out.sort((a, b) => b.at - a.at);
  };
  K.movesBox = function () {
    const list = K.myMoves();
    if (!list.length) return null;
    const seeAll = () => { K.store.set('movesSeen', K.store.get('movesSeen', []).concat(list.map((x) => x.key)).slice(-200)); K.render(); };
    return h('section', { class: 'mv-box', 'aria-label': 'Changes to your week' },
      h('div', { class: 'mv-head' }, h('b', null, list.length === 1 ? 'Your week changed' : list.length + ' changes to your week'), list.length > 1 ? h('button', { class: 'link-btn', type: 'button', onclick: seeAll }, 'Got them all') : null),
      list.map((x) => h('article', { class: 'mv-card' }, face(x.who),
        h('div', { class: 'mv-txt' }, h('b', null, x.title), x.lines.map((l) => h('span', { class: 'mv-line' }, l)), h('small', null, x.note)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Got it', onclick: () => { K.store.set('movesSeen', K.store.get('movesSeen', []).concat([x.key]).slice(-200)); K.render(); } }, K.icon('close')))));
  };
  function send(f) {
    if (f.kind !== 'urgent' && !K.me.admin && f.from < openFrom()) { K.toast('This week is set. Days off are asked from ' + pretty(openFrom()) + ' on; for something you cannot move, send it as urgent.', { tone: 'bad' }); return; }
    const person = f.person, from = f.from, to = f.to && f.to >= from ? f.to : from, dates = [];
    for (let d = from; d <= to && dates.length < 31; d = K.ymd(K.addDays(K.parseYmd(d), 1))) dates.push(d);
    let status = decide(person, dates, f.kind), bumped = [];
    const mode = f.kind === 'ask' ? f.mode || (f.priority ? 'priority' : 'ask') : 'ask', price = mode === 'ask' ? 0 : K.offPrice(person, dates, mode).n;
    const wantPrio = mode === 'priority' && status === 'waiting' && K.pointsOf(person) >= price;
    if (wantPrio) { const b = bumpFor(person, dates); if (b) { status = 'ok'; bumped = b; } }
    /* a guarantee: the day goes in whatever the week looks like; whoever ends up covering earns for it */
    const guar = mode === 'guarantee' && status === 'waiting' && K.pointsOf(person) >= price;
    if (guar) status = 'ok';
    const prio = wantPrio && status === 'ok', group = dates.length > 1 ? 'g' + K.uid() : '', at = Date.now();
    ui.busy = true; K.render();
    /* the drafts as they stand before this request, to tell anyone whose week it moves */
    const draftWks = Array.from(new Set(dates.map(mondayOf))).filter((wk) => wk >= K.thisWeek() && !D.weeks[wk] && K.rotaReady && K.rotaReady());
    const before = {};
    draftWks.forEach((wk) => { before[wk] = K.rotaDraft(wk, K.requestsFor(wk)); });
    Promise.all(dates.map((d) => {
      const body = { date: d, person: person, uid: K.me.id || '', kind: f.kind, note: (f.note || '').trim().slice(0, 300), status: status, at: at, group: group };
      if (prio) body.priority = true;
      if (guar) body.guaranteed = true;
      D.dayoff[d + '_' + person] = Object.assign({ id: d + '_' + person }, body);
      return K.db.doc('dayoff/' + d + '_' + person).set(body);
    })).then(() => {
      ui.busy = false; ui.sheet = null; ui.offForm = null; K.render();
      const span = dates.length > 1 ? pretty(from) + ' – ' + pretty(to) : pretty(from);
      if (prio) {
        bumped.forEach((r) => { const b = Object.assign({}, r, { status: 'waiting', bumpedBy: person }); delete b.id; D.dayoff[r.id] = Object.assign({ id: r.id }, b); K.db.doc('dayoff/' + r.id).set(b).catch(K.writeFailed);
          K.awardPoints('gaveway_' + r.date + '_' + r.person, { person: r.person, n: 2, kind: 'gaveway', date: r.date, reason: 'Gave way to ' + K.personName(person) + ' on ' + pretty(r.date) }); });
        K.awardPoints('spend_' + from + '_' + person, { person: person, n: -price, kind: 'spend', date: from, reason: 'Priority for ' + span });
        K.toast('Accepted with priority (' + price + ' points): ' + span + '. ' + Array.from(new Set(bumped.map((r) => K.personName(r.person)))).join(', ') + '’s day off now waits for the head chef.', { tone: 'good' });
      } else if (guar) {
        K.awardPoints('spend_' + from + '_' + person, { person: person, n: -price, kind: 'spend', date: from, reason: 'Guaranteed ' + span });
        K.toast('Guaranteed (' + price + ' points): ' + span + '. The head chef sorts out the cover.', { tone: 'good' });
      } else if (wantPrio) K.toast('Sent for approval: ' + span + '. Priority could not make room, so no points were used.');
      else if (status === 'ok') K.toast((f.kind === 'urgent' ? 'Urgent, noted: ' : 'Accepted: ') + span + (f.kind === 'urgent' ? '. The head chef sees it in red.' : '. Enjoy it.'), { tone: 'good' });
      else K.toast('Sent for approval: ' + span + '. The head chef or sous chef decides.');
      noteMoves(person, dates[0], before);
    }, (e) => { ui.busy = false; K.render(); K.writeFailed(e); });
  }
  function setStatus(rs, status) {
    rs.forEach((r) => {
      const body = Object.assign({}, r, { status: status, decidedBy: K.me.id || '', decidedAt: Date.now() });
      delete body.id;
      D.dayoff[r.id] = Object.assign({ id: r.id }, body);
      K.db.doc('dayoff/' + r.id).set(body).catch(K.writeFailed);
    });
    K.render();
    if (status === 'refused') refund(rs);
    K.toast((status === 'refused' ? 'Refused: ' : 'Approved: ') + K.personName(rs[0].person) + ', ' + span(rs), { tone: status === 'refused' ? '' : 'good' });
  }
  function withdraw(rs) {
    refund(rs);
    rs.forEach((r) => { delete D.dayoff[r.id]; K.db.doc('dayoff/' + r.id).delete().catch(K.writeFailed); });
    K.render();
    K.toast('Withdrawn: ' + span(rs));
  }
  const span = (rs) => { const d = rs.map((r) => r.date).sort(); return d.length > 1 ? pretty(d[0]) + ' – ' + pretty(d[d.length - 1]) : pretty(d[0]); };
  /* a run of days asked for together shows as one request */
  function grouped(list) {
    const g = {}, out = [];
    list.forEach((r) => { const k = r.group ? r.group : r.id; if (!g[k]) out.push(g[k] = []); g[k].push(r); });
    return out.map((rs) => rs.sort((a, b) => (a.date < b.date ? -1 : 1)));
  }
  const mine = (r) => r.person === K.getMe() || (r.uid && r.uid === K.me.id);

  /* ---------- the page ---------- */
  K.monthView = () => (K.calendarOn ? K.daysOffView() : calendar());
  K.daysOffView = function () {
    const box = h('div', { class: 'offpage' }), me = K.getMe(), today = K.day(0);
    /* waiting for the head chef */
    if (K.me.admin) {
      const wait = grouped(K.waitingDayoff());
      if (wait.length) box.append(h('section', { class: 'off-wait' }, h('h2', { class: 'off-h' }, h('span', { class: 'off-count' }, String(wait.length)), 'Waiting for you'),
        wait.map((rs) => card(rs, true))));
    }
    box.append(calendar());
    box.append(coverBoard());
    box.append(h('p', { class: 'hint' }, 'Everyone sees the calendar and your reason, so the team can plan around it. Tap a day to see who is on.'));
    const my = grouped(all().filter((r) => mine(r) && r.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1)));
    if (my.length) box.append(h('section', { class: 'off-mine' }, h('h2', { class: 'off-h' }, 'Your requests'), my.map((rs) => card(rs, false))));
    if (me) {
      const yr = String(new Date().getFullYear()), paid = all().filter((r) => r.person === me && r.kind === 'paid' && r.status === 'approved' && r.date.slice(0, 4) === yr).length;
      if (paid) box.append(h('p', { class: 'hint' }, 'Paid vacation approved for you in ' + yr + ': ' + paid + (paid === 1 ? ' day.' : ' days.')));
    }
    return box;
  };
  /* the cover board: who stepped in this month, and everyone's points */
  function coverBoard() {
    const month = K.day(0).slice(0, 7), me = K.getMe(), people = D.staff.people || [];
    const got = {};
    pts().forEach((p) => { if (+p.n > 0 && String(p.date || '').slice(0, 7) === month) got[p.person] = (got[p.person] || 0) + (+p.n); });
    const rows = people.map((p) => ({ id: p.id, month: got[p.id] || 0, bal: K.pointsOf(p.id) })).filter((x) => x.month || x.bal || x.id === me)
      .sort((a, b) => b.month - a.month || b.bal - a.bal);
    const box = h('section', { class: 'cover-board clean' }, h('h2', { class: 'chalk-title' }, 'Cover board'),
      h('p', { class: 'chalk-sub' }, 'Points for stepping in · ' + new Date().toLocaleDateString('en-GB', { month: 'long' })));
    if (!rows.length) box.append(h('p', { class: 'chalk-hint' }, 'No points yet. Covering a gap earns 3 (5 at short notice), a shift that is not fair 3–5, an event day 2, giving way 2.'));
    else box.append(h('ol', { class: 'cb-list' }, rows.map((x, i) => h('li', { class: x.id === me ? 'me' : '' },
      h('span', { class: 'cb-rank' }, x.month ? String(i + 1) : '–'), face(x.id),
      h('b', { class: 'cb-name' }, K.personName(x.id) + (x.id === me ? ' (you)' : '')),
      h('span', { class: 'cb-month' }, x.month ? '+' + x.month + ' this month' : ''),
      h('span', { class: 'cb-bal' }, '★ ' + x.bal)))));
    if (me) {
      const mine = pts().filter((p) => p.person === me).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 6);
      if (mine.length) box.append(h('details', { class: 'cb-hist' }, h('summary', null, 'Your points'),
        h('ul', null, mine.map((p) => h('li', null, h('b', null, (+p.n > 0 ? '+' : '') + p.n), ' ' + (p.reason || ''))))));
    }
    box.append(h('p', { class: 'chalk-hint' }, 'Spend them when a day is already taken: priority ' + PRIORITY + ', a guaranteed day off ' + GUARANTEE + ', a guaranteed weekend ' + WEEKEND + ', +' + THIN + ' on a thin day. Savings stop at ' + CAP + '.'));
    if (K.me.admin) {
      const g = (ui.giveForm = ui.giveForm || { person: '', n: 1, reason: '' });
      box.append(h('form', { class: 'cb-give', onsubmit: (e) => {
        e.preventDefault();
        if (!g.person || !(g.reason || '').trim()) { K.toast('Pick who and say why.'); return; }
        K.awardPoints('bonus_' + K.uid(), { person: g.person, n: +g.n, kind: 'bonus', date: K.day(0), reason: g.reason.trim().slice(0, 120) });
        K.toast('+' + g.n + ' for ' + K.personName(g.person), { tone: 'good' });
        ui.giveForm = { person: '', n: 1, reason: '' }; K.render();
      } },
        h('b', { class: 'cb-give-h' }, 'Give points'),
        K.select([['', 'Who']].concat(people.map((p) => [p.id, p.name])), g.person, (v) => { g.person = v; }, { class: 'input small', 'aria-label': 'Who' }),
        K.select([1, 2, 3, 4, 5].map((n) => [n, '+' + n]), g.n, (v) => { g.n = +v; }, { class: 'input small', 'aria-label': 'How many' }),
        h('input', { class: 'input small', value: g.reason, placeholder: 'Why, e.g. stayed late for the wedding', 'aria-label': 'Why', oninput: (e) => { g.reason = e.target.value; } }),
        h('button', { class: 'chalk-link', type: 'submit' }, '★ Give')));
    }
    return box;
  }
  function card(rs, forChef) {
    const r = rs[0], urgent = r.kind === 'urgent';
    return h('article', { class: 'off-card k-' + r.kind + ' s-' + r.status },
      face(r.person, 'big'),
      h('div', { class: 'off-card-txt' },
        h('b', null, K.personName(r.person)),
        h('span', { class: 'off-when' }, span(rs) + (rs.length > 1 ? ' · ' + rs.length + ' days' : '')),
        h('span', { class: 'off-kind' }, urgent ? h('b', { class: 'off-bang' }, '!') : null, KIND[r.kind] + ' · ' + STATUS[r.status] + (r.priority ? ' · ★ priority' : '') + (r.bumpedBy ? ' · gave way to ' + K.personName(r.bumpedBy) + '’s priority' : '')),
        r.note ? h('q', { class: 'off-note' }, r.note) : null),
      h('div', { class: 'off-acts' },
        forChef ? [h('button', { class: 'btn small primary', type: 'button', onclick: () => setStatus(rs, 'approved') }, 'Approve'), h('button', { class: 'btn small', type: 'button', onclick: () => setStatus(rs, 'refused') }, 'Refuse')]
          : r.date >= K.day(0) ? h('button', { class: 'btn small', type: 'button', onclick: () => withdraw(rs) }, 'Withdraw') : null));
  }

  /* ---------- the calendar: a month, or the whole year at a glance ---------- */
  function calendar() {
    const year = K.calendarOn && !!ui.offYear, cur = ui.offMonth || K.day(0).slice(0, 7);
    const [y, m] = cur.split('-').map(Number);
    const move = (n) => { const d = new Date(y, m - 1 + (year ? n * 12 : n), 1); ui.offMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); K.render(); };
    const title = year ? String(y) : new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const head = h('div', { class: 'dc-head' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': year ? 'Previous year' : 'Previous month', onclick: () => move(-1) }, K.icon('back')),
      h('h2', { class: 'dc-title' }, title),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': year ? 'Next year' : 'Next month', onclick: () => move(1) }, K.icon('next')),
      K.calendarOn ? K.seg([[false, 'Month'], [true, 'Year']], year, (v) => { ui.offYear = v; K.render(); }, { 'aria-label': 'Show a month or the year', class: 'seg small-seg' }) : null);
    const legend = h('div', { class: 'dc-legend' }, h('span', { class: 'dc-locklg' }, K.icon('lock'), 'This week is set'), K.getMe() ? h('span', { class: 'dc-legme' }, ['hot', 'cold', 'pass'].map((x) => h('span', { class: 'dc-me svc-' + x, 'aria-hidden': 'true' }, 'P')), ' your shifts') : null, [['ask', 'ok', 'Day off'], ['urgent', 'ok', 'Urgent'], ['paid', 'approved', 'Paid vacation'], ['ask', 'waiting', 'Waiting']].map((x) =>
      h('span', { class: 'dc-note lg k-' + x[0] + ' s-' + x[1] }, x[0] === 'urgent' ? h('b', null, '!') : x[0] === 'paid' ? h('b', null, '☀') : null, x[2])));
    /* with the calendar switched off the month still shows your shifts and the events, without days off */
    if (!K.calendarOn) return h('section', { class: 'dcal clean' }, head, monthGrid(y, m), h('div', { class: 'dc-legend' }, K.getMe() ? h('span', { class: 'dc-legme' }, ['hot', 'cold', 'pass'].map((x) => h('span', { class: 'dc-me svc-' + x, 'aria-hidden': 'true' }, 'P')), ' your shifts') : null, h('span', { class: 'dc-ev lg' }, '★ Event')),
      h('p', { class: 'chalk-hint' }, 'Tap a day to see who is on.'));
    return h('section', { class: 'dcal clean' }, head, year ? yearGrid(y) : monthGrid(y, m), legend,
      h('button', { class: 'chalk-btn', type: 'button', onclick: () => openAsk(K.me.admin ? K.ymd(K.addDays(new Date(), 1)) : openFrom()) }, K.icon('plus'), 'Ask for a day off'));
  }
  /* my own shifts for a week: the saved rota, or the generator's draft for a week still being planned */
  function myWeek(ds7) {
    const me = K.getMe(), wk = ds7[0], doc = D.weeks[wk];
    if (!me) return null;
    if (doc && doc.rows && doc.rows[me]) return { rows: doc.rows[me], st: (doc.st || {})[me] || [], draft: false };
    if (wk < K.thisWeek() || !K.rotaReady || !K.rotaReady() || !(K.calendarOn || K.me.admin)) return null;
    const r = K.rotaDraft(wk, K.requestsFor(wk));
    return r.rows[me] ? { rows: r.rows[me], st: r.st[me] || [], draft: true } : null;
  }
  const evs = (ds) => (K.eventsOn ? K.eventsOn(ds).filter(K.isLive) : []);
  K.dayEvents = evs;
  function evLine(e) {
    return h('div', { class: 'dc-evbox' }, h('b', null, '★ ' + (e.title || 'Event')),
      h('span', null, [e.time, e.guests ? e.guests + ' guests' : '', +e.cooks ? 'needs ' + e.cooks + ' cooks' + (e.when === 'day' ? ' at lunch' : e.when === 'night' ? ' in the evening' : '') : '', +e.before ? e.before + ' cooks the day before' : '', e.status === 'pending' ? 'not confirmed yet' : ''].filter(Boolean).join(' · ')));
  }
  const SHORT = { hot: 'Hot', cold: 'Cold', pass: 'Pass', prep: 'Prep', learn: 'Learn', float: 'Fill', 'learn-pass': 'Learn P', 'learn-cold': 'Learn C', 'learn-hot': 'Learn', br: 'BR' };
  /* a month as week strips: one-day requests are sticky notes in their day, a run of days asked for
     together (a vacation) is one long note across them */
  function monthGrid(y, m) {
    const first = new Date(y, m - 1, 1), start = K.mondayOf(first), today = K.day(0), weeks = [];
    for (let w = 0; w < 6; w++) {
      const mon = K.addDays(start, w * 7);
      if (w > 3 && mon.getMonth() !== m - 1) break;
      const ds7 = [0, 1, 2, 3, 4, 5, 6].map((i) => K.ymd(K.addDays(mon, i)));
      const reqs = all().filter((r) => live(r) && r.date >= ds7[0] && r.date <= ds7[6]);
      /* runs: requests of one group that sit next to each other this week */
      const runs = [], single = {};
      grouped(reqs).forEach((rs) => {
        if (rs.length < 2) { (single[rs[0].date] = single[rs[0].date] || []).push(rs[0]); return; }
        let cur = null;
        rs.forEach((r) => { const i = ds7.indexOf(r.date); if (cur && i === cur.to + 1) cur.to = i; else runs.push(cur = { r: r, from: i, to: i, n: 0 }); cur.n++; });
      });
      const set = ds7[6] < openFrom(), strip = h('div', { class: 'dc-week' + (set ? ' set' : '') + (ds7[0] === K.thisWeek() ? ' now' : '') }), my = myWeek(ds7);
      if (ds7[0] === K.thisWeek()) strip.append(h('span', { class: 'dc-lock', title: 'This week is set', 'aria-label': 'This week is set' }, K.icon('lock')));
      ds7.forEach((ds, i) => {
        const d = K.addDays(mon, i), inMonth = d.getMonth() === m - 1, rs = (single[ds] || []).concat(runs.filter((x) => x.from <= i && x.to >= i).map((x) => x.r));
        strip.append(h('button', { type: 'button', style: { gridColumn: String(i + 1), gridRow: '1 / span ROWS' }, class: 'dc-day' + (inMonth ? '' : ' out') + (ds === today ? ' today' : '') + (ds < today ? ' past' : ''),
          'aria-label': pretty(ds) + (rs.length ? ', off: ' + rs.map((r) => K.personName(r.person) + (r.kind === 'urgent' ? ' (urgent)' : '')).join(', ') : ''), onclick: () => { ui.sheet = { type: 'dayoff', date: ds }; K.render(); } },
          h('span', { class: 'dc-n' }, String(d.getDate())), evs(ds).map((e) => h('span', { class: 'dc-ev', title: e.title }, '★ ' + (e.title || 'Event'))), (() => {
            const c = my ? String(my.rows[i] || '').trim() : '';
            if (!c || /^(0|X)$/i.test(c)) return null;
            const sk = my.st[i] ? (/^learn/.test(my.st[i]) ? 'learn' : my.st[i]) : /^BR\b/i.test(c) && !/\+/.test(c) ? 'br' : 'plain';
            return h('span', { class: 'dc-me svc-' + sk + (my.draft ? ' draft' : ''), title: (my.draft ? 'Draft: ' : '') + 'you work ' + c + (my.st[i] ? ' on ' + (K.STL[my.st[i]] || my.st[i]) : '') }, c);
          })()));
      });
      let row = 2;
      ds7.forEach((ds, i) => (single[ds] || []).slice(0, 3).forEach((r, k) => strip.append(note(r, i + 1, 1, 2 + k))));
      ds7.forEach((ds, i) => { if ((single[ds] || []).length > 3) strip.append(h('span', { class: 'dc-more', style: { gridColumn: String(i + 1), gridRow: '5' } }, '+' + ((single[ds] || []).length - 3))); });
      runs.forEach((x) => { row = Math.max(row, 2 + Math.max.apply(null, [0].concat(ds7.slice(x.from, x.to + 1).map((ds) => Math.min(3, (single[ds] || []).length))))); strip.append(note(x.r, x.from + 1, x.to - x.from + 1, row++)); });
      /* the day cells reach down past the last note, so a week is only as tall as what is in it */
      let last = 1;
      ds7.forEach((ds) => { last = Math.max(last, 1 + Math.min(3, (single[ds] || []).length) + ((single[ds] || []).length > 3 ? 1 : 0)); });
      last = Math.max(last, row - 1, 2);
      strip.querySelectorAll('.dc-day').forEach((el) => { el.style.gridRow = '1 / span ' + last; });
      weeks.push(strip);
    }
    return h('div', { class: 'dc-month' }, h('div', { class: 'dc-dows' }, DAYS.map((d) => h('span', { class: 'dc-dow' }, d))), weeks);
  }
  function note(r, col, span, row) {
    return h('span', { class: 'dc-note k-' + r.kind + ' s-' + r.status + (span > 1 ? ' run' : ''), style: { gridColumn: col + ' / span ' + span, gridRow: String(row), '--tilt': ((hue(r.person + r.date) % 5) - 2) + 'deg' }, 'aria-hidden': 'true' },
      r.kind === 'urgent' ? h('b', null, '!') : r.kind === 'paid' ? h('b', null, '☀') : null, short(r.person), span > 1 && r.note ? h('small', null, ' – ' + r.note) : span > 1 ? h('small', null, ' – ' + KIND[r.kind].toLowerCase()) : null);
  }
  function yearGrid(y) {
    return h('div', { class: 'dc-year' }, Array.from({ length: 12 }, (_, mi) => {
      const first = new Date(y, mi, 1), start = K.mondayOf(first), today = K.day(0), cells = [];
      for (let i = 0; i < 42; i++) {
        const d = K.addDays(start, i);
        if (d.getMonth() !== mi) { cells.push(h('i', { class: 'yd blank' })); continue; }
        const ds = K.ymd(d), rs = onDay(ds).filter(live);
        const cls = rs.some((r) => r.kind === 'urgent') ? ' u' : rs.some((r) => r.status === 'waiting') ? ' w' : rs.some((r) => r.kind === 'paid' || r.kind === 'unpaid') ? ' v' : rs.length ? ' o' : '';
        cells.push(h('i', { class: 'yd' + cls + (ds === today ? ' t' : ''), title: rs.length ? pretty(ds) + ': ' + rs.map((r) => K.personName(r.person)).join(', ') : null }));
      }
      return h('button', { type: 'button', class: 'ym', onclick: () => { ui.offYear = false; ui.offMonth = y + '-' + String(mi + 1).padStart(2, '0'); K.render(); } },
        h('b', null, first.toLocaleDateString('en-GB', { month: 'short' })), h('span', { class: 'ym-grid' }, cells));
    }));
  }

  /* ---------- one day: who is off, and asking for it ---------- */
  /* who works where that day: the rota saved for the week, or the generator's draft until then */
  K.dayLineup = function (ds) {
    const wk = mondayOf(ds), i = Math.round((K.parseYmd(ds) - K.parseYmd(wk)) / 86400000), doc = D.weeks[wk];
    let rows, st, order, draft = false;
    if (doc && doc.rows) { rows = doc.rows; st = doc.st || {}; order = (doc.people || Object.keys(rows)).slice(); }
    else if (K.rotaReady && K.rotaReady()) { const r = K.rotaDraft(wk, K.requestsFor(wk)); rows = r.rows; st = r.st; order = r.order; draft = true; }
    else return null;
    const g = { hot: [], cold: [], pass: [], learn: [], 'learn-pass': [], 'learn-cold': [], 'learn-hot': [], prep: [], float: [], br: [], other: [], off: [] };
    order.forEach((id) => {
      const c = String((rows[id] || [])[i] || '').trim(), s = (st[id] || [])[i] || '';
      if (!c) return;
      if (/^(0|X)$/i.test(c)) { g.off.push({ id: id, c: c }); return; }
      (g[s] || g.other).push({ id: id, c: c });
    });
    const LAB = [['hot', 'Hot'], ['cold', 'Cold & pastry'], ['pass', 'Pass'], ['br', 'Breakfast'], ['float', 'Filler'], ['prep', 'Prep'], ['learn', 'Learning Hot'], ['learn-pass', 'Learning Pass'], ['learn-cold', 'Learning Cold'], ['learn-hot', 'Learning Hot'], ['other', 'Also in']];
    const offReq = onDay(ds).filter(live);
    return h('section', { class: 'lineup' },
      h('div', { class: 'lineup-h' }, h('h3', null, 'Who’s on'), draft ? h('span', { class: 'lineup-draft' }, 'Draft, not final yet') : null),
      h('div', { class: 'lineup-st' }, LAB.filter((l) => g[l[0]].length).map((l) => h('div', { class: 'lu-row lu-' + l[0] },
        h('span', { class: 'lu-lab' }, l[1]),
        h('span', { class: 'lu-who' }, g[l[0]].map((x) => h('span', { class: 'lu-p' }, face(x.id), h('b', null, K.personName(x.id)), h('span', { class: 'mono' }, x.c))))))),
      g.off.length || offReq.length ? h('p', { class: 'lu-off' }, h('b', null, 'Off: '), Array.from(new Set(g.off.map((x) => x.id).concat(offReq.map((r) => r.person)))).map((id) => K.personName(id)).join(', ')) : null);
  };
  function openAsk(ds) { ui.offForm = null; ui.sheet = { type: 'dayoff', date: ds, ask: true }; K.render(); }
  K.SHEETS.dayoff = function (c) {
    const ds = c.date, rs = onDay(ds), today = K.day(0), me = K.getMe();
    const body = [];
    evs(ds).forEach((e) => body.push(evLine(e)));
    body.push(h('button', { class: 'btn wide', type: 'button', onclick: () => { ui.sheet = null; ui.week = mondayOf(ds); ui.schedView = 'week'; K.go('schedule'); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, K.icon('rota'), 'See the whole week, ' + pretty(mondayOf(ds)) + ' – ' + pretty(K.ymd(K.addDays(K.parseYmd(mondayOf(ds)), 6)))));
    const lu = K.dayLineup(ds);
    if (lu) body.push(lu);
    if (K.calendarOn) {
    body.push(h('h3', { class: 'off-h small' }, 'Days off'));
    if (rs.length) body.push(h('div', { class: 'off-day-list' }, rs.map((r) => h('div', { class: 'off-row k-' + r.kind + ' s-' + r.status },
      face(r.person),
      h('div', { class: 'off-card-txt' }, h('b', null, K.personName(r.person)),
        h('span', { class: 'off-kind' }, r.kind === 'urgent' ? h('b', { class: 'off-bang' }, '!') : null, KIND[r.kind] + ' · ' + STATUS[r.status]),
        r.note ? h('q', { class: 'off-note' }, r.note) : null),
      K.me.admin && r.status === 'waiting' ? h('div', { class: 'off-acts' }, h('button', { class: 'btn small primary', type: 'button', onclick: () => setStatus([r], 'approved') }, 'Approve'), h('button', { class: 'btn small', type: 'button', onclick: () => setStatus([r], 'refused') }, 'Refuse'))
        : (mine(r) || K.me.admin) && ds >= today ? h('button', { class: 'btn small', type: 'button', onclick: () => withdraw([r]) }, mine(r) ? 'Withdraw' : 'Remove') : null))));
    else body.push(h('p', { class: 'none' }, 'Nobody has asked for this day off.'));
    if (ds >= today) {
      if (!me && !K.me.admin) body.push(h('p', { class: 'hint' }, 'Your name is not linked to The Brigade yet, so you cannot ask from this phone. Pick your name on The Brigade tab, or ask the head chef to link it.'));
      else if (K.dayLocked(ds) && !K.me.admin) body.push(h('div', { class: 'off-lock' }, K.icon('lock'),
        h('span', null, h('b', null, 'This week is set'), h('small', null, 'Days off are asked from ' + pretty(openFrom()) + ' on. For something you cannot move, send it as urgent: it goes straight in, in red.'))),
        h('details', { class: 'off-urgent', open: !!(ui.offForm && ui.offForm.from === ds) }, h('summary', null, 'Something urgent?'), askForm(ds, me, true)));
      else body.push(askForm(ds, me));
    }
    }
    return K.sheet(K.prettyDate(ds, { weekday: 'long', day: 'numeric', month: 'long' }), body, { wide: true });
  };
  function askForm(ds, me, urgentOnly) {
    const f = (ui.offForm = ui.offForm && ui.offForm.from === ds ? ui.offForm : { from: ds, to: ds, kind: urgentOnly ? 'urgent' : 'ask', note: '', person: me || '' });
    if (urgentOnly) f.kind = 'urgent';
    const minDay = K.me.admin || urgentOnly ? K.day(0) : openFrom();
    const people = (D.staff.people || []).map((p) => [p.id, p.name]);
    const hint = { ask: 'Accepted straight away if the week still works without you. If not, the head chef or the sous chef decides.',
      urgent: 'For something you cannot move. It goes straight in, in red, and the head chef sorts out the gap.',
      paid: 'Paid vacation. The head chef or the sous chef approves it.', unpaid: 'Unpaid leave, the last resort. The head chef or the sous chef approves it.' }[f.kind];
    return h('form', { class: 'off-form k-' + f.kind, onsubmit: (e) => { e.preventDefault(); if (!f.person || ui.busy) return; send(f); } },
      h('h3', { class: 'off-h' }, urgentOnly ? 'Urgent day off' : 'Ask for a day off'),
      K.me.admin ? K.field('Who', K.select([['', 'Pick a person']].concat(people), f.person, (v) => { f.person = v; K.render(); }, { class: 'input' })) : null,
      h('div', { class: 'two tight' },
        K.field('From', h('input', { class: 'input', type: 'date', value: f.from, min: minDay, max: urgentOnly ? K.ymd(K.addDays(K.parseYmd(openFrom()), -1)) : null, onchange: (e) => { f.from = e.target.value || ds; if (f.to < f.from) f.to = f.from; ui.offForm = f; K.render(); } })),
        K.field('Until', h('input', { class: 'input', type: 'date', value: f.to, min: f.from, onchange: (e) => { f.to = e.target.value || f.from; K.render(); } }))),
      urgentOnly ? null : h('div', { class: 'field' }, h('span', { class: 'legend' }, 'What kind'),
        h('div', { class: 'off-kinds' }, [['ask', 'Day off', ''], ['urgent', 'Urgent', '!'], ['paid', 'Paid vacation', '☀']].map((k) => h('button', { type: 'button', class: 'off-kbtn k-' + k[0], 'aria-pressed': f.kind === k[0] ? 'true' : 'false', onclick: () => { f.kind = k[0]; K.render(); } }, k[2] ? h('b', null, k[2]) : null, k[1]))),
        h('details', { class: 'off-more', open: f.kind === 'unpaid' }, h('summary', null, 'More options'),
          h('button', { type: 'button', class: 'off-kbtn k-unpaid', 'aria-pressed': f.kind === 'unpaid' ? 'true' : 'false', onclick: () => { f.kind = 'unpaid'; K.render(); } }, 'Unpaid leave'))),
      h('p', { class: 'hint off-hint' }, hint),
      (() => { const ev = []; for (let d = f.from; d <= (f.to || f.from) && ev.length < 3; d = K.ymd(K.addDays(K.parseYmd(d), 1))) evs(d).forEach((e) => ev.push(e)); return ev.length ? h('p', { class: 'banner warn' }, h('b', null, '★ Event: '), ev.map((e) => (e.title || 'Event') + ' on ' + pretty(e.date) + (+e.cooks ? ', needs ' + e.cooks + ' cooks' : '')).join('; ') + '. If the kitchen would be short, the head chef decides.') : null; })(),
      (() => {
        if (f.kind !== 'ask' || !f.person) return null;
        const have = K.pointsOf(f.person), dates = [];
        for (let d = f.from; d <= (f.to || f.from) && dates.length < 31; d = K.ymd(K.addDays(K.parseYmd(d), 1))) dates.push(d);
        const pr = K.offPrice(f.person, dates, 'priority'), gu = K.offPrice(f.person, dates, 'guarantee'), mode = f.mode || 'ask';
        const opt = (m, title, price, txt) => h('label', { class: 'off-opt' + (mode === m ? ' on' : '') + (price > have ? ' poor' : '') },
          h('input', { type: 'radio', name: 'offmode', checked: mode === m, disabled: price > have, onchange: () => { f.mode = m; K.render(); } }),
          h('span', null, h('b', null, title, price ? h('span', { class: 'off-price' }, '★ ' + price) : null), h('small', null, txt)));
        return h('fieldset', { class: 'off-opts' }, h('legend', { class: 'legend' }, 'If the day is already taken · you have ★ ' + have),
          opt('ask', 'Just ask', 0, 'Free. If the week cannot do without you, the head chef decides.'),
          opt('priority', 'Priority', pr.n, 'If someone else has this day off, you get it and theirs goes back to the head chef. They get 2 points for giving way.' + (pr.thin ? ' Includes +' + THIN * pr.thin + ' for a thin day.' : '')),
          opt('guarantee', gu.weekend ? 'Guaranteed weekend' : 'Guaranteed', gu.n, 'The day goes in, whatever the week looks like. Whoever covers earns for it.' + (gu.thin ? ' Includes +' + THIN * gu.thin + ' for a thin day.' : '')),
          h('small', { class: 'hint' }, 'Points are only used if the day would otherwise wait for the head chef.'));
      })(),
      K.field('Why?', h('textarea', { class: 'input', rows: '2', maxlength: '300', value: f.note, placeholder: 'e.g. my sister’s wedding. The team sees this.', oninput: (e) => { f.note = e.target.value; } }), 'Optional, but it helps the team get behind it.'),
      h('button', { class: 'btn primary wide', type: 'submit', disabled: !f.person || ui.busy }, ui.busy ? 'Sending…' : 'Send'));
  }
})();
