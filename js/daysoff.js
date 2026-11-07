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
  const kindIcon = (r) => (r.kind === 'urgent' ? '!' : r.kind === 'paid' ? '☀' : r.kind === 'unpaid' ? '–' : '');

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
  function send(f) {
    const person = f.person, from = f.from, to = f.to && f.to >= from ? f.to : from, dates = [];
    for (let d = from; d <= to && dates.length < 31; d = K.ymd(K.addDays(K.parseYmd(d), 1))) dates.push(d);
    const status = decide(person, dates, f.kind), group = dates.length > 1 ? 'g' + K.uid() : '', at = Date.now();
    ui.busy = true; K.render();
    Promise.all(dates.map((d) => {
      const body = { date: d, person: person, uid: K.me.id || '', kind: f.kind, note: (f.note || '').trim().slice(0, 300), status: status, at: at, group: group };
      D.dayoff[d + '_' + person] = Object.assign({ id: d + '_' + person }, body);
      return K.db.doc('dayoff/' + d + '_' + person).set(body);
    })).then(() => {
      ui.busy = false; ui.sheet = null; ui.offForm = null; K.render();
      const span = dates.length > 1 ? pretty(from) + ' – ' + pretty(to) : pretty(from);
      if (status === 'ok') K.toast((f.kind === 'urgent' ? 'Urgent, noted: ' : 'Accepted: ') + span + (f.kind === 'urgent' ? '. The head chef sees it in red.' : '. Enjoy it.'), { tone: 'good' });
      else K.toast('Sent for approval: ' + span + '. The head chef or sous chef decides.');
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
    K.toast((status === 'refused' ? 'Refused: ' : 'Approved: ') + K.personName(rs[0].person) + ', ' + span(rs), { tone: status === 'refused' ? '' : 'good' });
  }
  function withdraw(rs) {
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
  K.daysOffView = function () {
    const box = h('div', { class: 'offpage' }), me = K.getMe(), today = K.day(0);
    /* waiting for the head chef */
    if (K.me.admin) {
      const wait = grouped(K.waitingDayoff());
      if (wait.length) box.append(h('section', { class: 'off-wait' }, h('h2', { class: 'off-h' }, h('span', { class: 'off-count' }, String(wait.length)), 'Waiting for you'),
        wait.map((rs) => card(rs, true))));
    }
    box.append(calendar());
    box.append(h('p', { class: 'hint' }, 'Everyone sees the calendar and your reason, so the team can plan around it. Tap a day to see who is on.'));
    const my = grouped(all().filter((r) => mine(r) && r.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1)));
    if (my.length) box.append(h('section', { class: 'off-mine' }, h('h2', { class: 'off-h' }, 'Your requests'), my.map((rs) => card(rs, false))));
    if (me) {
      const yr = String(new Date().getFullYear()), paid = all().filter((r) => r.person === me && r.kind === 'paid' && r.status === 'approved' && r.date.slice(0, 4) === yr).length;
      if (paid) box.append(h('p', { class: 'hint' }, 'Paid vacation approved for you in ' + yr + ': ' + paid + (paid === 1 ? ' day.' : ' days.')));
    }
    return box;
  };
  function card(rs, forChef) {
    const r = rs[0], urgent = r.kind === 'urgent';
    return h('article', { class: 'off-card k-' + r.kind + ' s-' + r.status },
      face(r.person, 'big'),
      h('div', { class: 'off-card-txt' },
        h('b', null, K.personName(r.person)),
        h('span', { class: 'off-when' }, span(rs) + (rs.length > 1 ? ' · ' + rs.length + ' days' : '')),
        h('span', { class: 'off-kind' }, urgent ? h('b', { class: 'off-bang' }, '!') : null, KIND[r.kind] + ' · ' + STATUS[r.status]),
        r.note ? h('q', { class: 'off-note' }, r.note) : null),
      h('div', { class: 'off-acts' },
        forChef ? [h('button', { class: 'btn small primary', type: 'button', onclick: () => setStatus(rs, 'approved') }, 'Approve'), h('button', { class: 'btn small', type: 'button', onclick: () => setStatus(rs, 'refused') }, 'Refuse')]
          : r.date >= K.day(0) ? h('button', { class: 'btn small', type: 'button', onclick: () => withdraw(rs) }, 'Withdraw') : null));
  }

  /* ---------- the calendar: a month, or the whole year at a glance ---------- */
  function calendar() {
    const year = !!ui.offYear, cur = ui.offMonth || K.day(0).slice(0, 7);
    const [y, m] = cur.split('-').map(Number);
    const move = (n) => { const d = new Date(y, m - 1 + (year ? n * 12 : n), 1); ui.offMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); K.render(); };
    const title = year ? String(y) : new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const head = h('div', { class: 'dc-head' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': year ? 'Previous year' : 'Previous month', onclick: () => move(-1) }, K.icon('back')),
      h('h2', { class: 'dc-title' }, title),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': year ? 'Next year' : 'Next month', onclick: () => move(1) }, K.icon('next')),
      K.seg([[false, 'Month'], [true, 'Year']], year, (v) => { ui.offYear = v; K.render(); }, { 'aria-label': 'Show a month or the year', class: 'seg small-seg' }));
    const legend = h('div', { class: 'dc-legend' }, K.getMe() ? h('span', { class: 'dc-me lg' }, '2 Hot = your shift') : null, [['ask', 'ok', 'Day off'], ['urgent', 'ok', 'Urgent'], ['paid', 'approved', 'Paid vacation'], ['ask', 'waiting', 'Waiting']].map((x) =>
      h('span', { class: 'dc-note lg k-' + x[0] + ' s-' + x[1] }, x[0] === 'urgent' ? h('b', null, '!') : x[0] === 'paid' ? h('b', null, '☀') : null, x[2])));
    return h('section', { class: 'dcal slate' }, h('h2', { class: 'chalk-title' }, 'Days off'), head, year ? yearGrid(y) : monthGrid(y, m), legend,
      h('button', { class: 'chalk-btn', type: 'button', onclick: () => openAsk(K.ymd(K.addDays(new Date(), 1))) }, K.icon('plus'), 'Ask for a day off'));
  }
  /* my own shifts for a week: the saved rota, or the generator's draft for a week still being planned */
  function myWeek(ds7) {
    const me = K.getMe(), wk = ds7[0], doc = D.weeks[wk];
    if (!me) return null;
    if (doc && doc.rows && doc.rows[me]) return { rows: doc.rows[me], st: (doc.st || {})[me] || [], draft: false };
    if (wk < K.thisWeek() || !K.rotaReady || !K.rotaReady()) return null;
    const r = K.rotaDraft(wk, K.requestsFor(wk));
    return r.rows[me] ? { rows: r.rows[me], st: r.st[me] || [], draft: true } : null;
  }
  const SHORT = { hot: 'Hot', cold: 'Cold', pass: 'Pass', prep: 'Prep', learn: 'Learn', br: 'BR' };
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
      const strip = h('div', { class: 'dc-week' }), my = myWeek(ds7);
      ds7.forEach((ds, i) => {
        const d = K.addDays(mon, i), inMonth = d.getMonth() === m - 1, rs = (single[ds] || []).concat(runs.filter((x) => x.from <= i && x.to >= i).map((x) => x.r));
        strip.append(h('button', { type: 'button', style: { gridColumn: String(i + 1), gridRow: '1 / span ROWS' }, class: 'dc-day' + (inMonth ? '' : ' out') + (ds === today ? ' today' : '') + (ds < today ? ' past' : ''),
          'aria-label': pretty(ds) + (rs.length ? ', off: ' + rs.map((r) => K.personName(r.person) + (r.kind === 'urgent' ? ' (urgent)' : '')).join(', ') : ''), onclick: () => { ui.sheet = { type: 'dayoff', date: ds }; K.render(); } },
          h('span', { class: 'dc-n' }, String(d.getDate())), (() => {
            const c = my ? String(my.rows[i] || '').trim() : '';
            if (!c || /^(0|X)$/i.test(c)) return null;
            return h('span', { class: 'dc-me' + (my.draft ? ' draft' : ''), title: (my.draft ? 'Draft: ' : '') + 'you work ' + c + (my.st[i] ? ' on ' + (K.STL[my.st[i]] || my.st[i]) : '') }, c + (my.st[i] ? ' ' + (SHORT[my.st[i]] || '') : ''));
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
    const g = { hot: [], cold: [], pass: [], learn: [], prep: [], br: [], other: [], off: [] };
    order.forEach((id) => {
      const c = String((rows[id] || [])[i] || '').trim(), s = (st[id] || [])[i] || '';
      if (!c) return;
      if (/^(0|X)$/i.test(c)) { g.off.push({ id: id, c: c }); return; }
      (g[s] || g.other).push({ id: id, c: c });
    });
    const LAB = [['hot', 'Hot'], ['cold', 'Cold & pastry'], ['pass', 'Pass'], ['br', 'Breakfast'], ['prep', 'Prep'], ['learn', 'Learning Hot'], ['other', 'Also in']];
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
    const lu = K.dayLineup(ds);
    if (lu) body.push(lu);
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
      if (!me && !K.me.admin) body.push(h('p', { class: 'hint' }, 'Your name is not linked to the rota yet, so you cannot ask from this phone. Pick your name on the Rota tab, or ask the head chef to link it.'));
      else body.push(askForm(ds, me));
    }
    return K.sheet(K.prettyDate(ds, { weekday: 'long', day: 'numeric', month: 'long' }), body, { wide: true });
  };
  function askForm(ds, me) {
    const f = (ui.offForm = ui.offForm && ui.offForm.from === ds ? ui.offForm : { from: ds, to: ds, kind: 'ask', note: '', person: me || '' });
    const people = (D.staff.people || []).map((p) => [p.id, p.name]);
    const hint = { ask: 'Accepted straight away if the week still works without you. If not, the head chef or the sous chef decides.',
      urgent: 'For something you cannot move. It goes straight in, in red, and the head chef sorts out the gap.',
      paid: 'Paid vacation. The head chef or the sous chef approves it.', unpaid: 'Unpaid leave, the last resort. The head chef or the sous chef approves it.' }[f.kind];
    return h('form', { class: 'off-form k-' + f.kind, onsubmit: (e) => { e.preventDefault(); if (!f.person || ui.busy) return; send(f); } },
      h('h3', { class: 'off-h' }, 'Ask for a day off'),
      K.me.admin ? K.field('Who', K.select([['', 'Pick a person']].concat(people), f.person, (v) => { f.person = v; K.render(); }, { class: 'input' })) : null,
      h('div', { class: 'two tight' },
        K.field('From', h('input', { class: 'input', type: 'date', value: f.from, min: K.day(0), onchange: (e) => { f.from = e.target.value || ds; if (f.to < f.from) f.to = f.from; ui.offForm = f; K.render(); } })),
        K.field('Until', h('input', { class: 'input', type: 'date', value: f.to, min: f.from, onchange: (e) => { f.to = e.target.value || f.from; K.render(); } }))),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'What kind'),
        h('div', { class: 'off-kinds' }, [['ask', 'Day off', ''], ['urgent', 'Urgent', '!'], ['paid', 'Paid vacation', '☀']].map((k) => h('button', { type: 'button', class: 'off-kbtn k-' + k[0], 'aria-pressed': f.kind === k[0] ? 'true' : 'false', onclick: () => { f.kind = k[0]; K.render(); } }, k[2] ? h('b', null, k[2]) : null, k[1]))),
        h('details', { class: 'off-more', open: f.kind === 'unpaid' }, h('summary', null, 'More options'),
          h('button', { type: 'button', class: 'off-kbtn k-unpaid', 'aria-pressed': f.kind === 'unpaid' ? 'true' : 'false', onclick: () => { f.kind = 'unpaid'; K.render(); } }, 'Unpaid leave'))),
      h('p', { class: 'hint off-hint' }, hint),
      K.field('Why?', h('textarea', { class: 'input', rows: '2', maxlength: '300', value: f.note, placeholder: 'e.g. my sister’s wedding. The team sees this.', oninput: (e) => { f.note = e.target.value; } }), 'Optional, but it helps the team get behind it.'),
      h('button', { class: 'btn primary wide', type: 'submit', disabled: !f.person || ui.busy }, ui.busy ? 'Sending…' : 'Send'));
  }
})();
