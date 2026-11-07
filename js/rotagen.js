/* The rota generator. From the team setup, what each station needs every day and the days people
   asked off, it fills one week (Monday = 0 ... Sunday = 6). It has no randomness of its own: the
   same inputs give the same week on every phone and in the Saturday job, so a draft never jumps
   around just because someone else opened the app.

   gen({ week, plan, people, requests, keep }) -> { order, rows, st, issues, cost }
     week      'YYYY-MM-DD', the Monday
     plan      { people: { id: setup }, needs: { hot: [7], cold: [7], pass: [7] }, busy: [days], brDays: [days], brCode }
       setup   { mode: 'auto' | 'fixed' | 'hand' | 'off', stations: ['cold', 'hot', 'prep'], days: 4, code: '2',
                 off: [days], special: { code: '10:30', n: 2 }, br: 0 | rank, learner: bool, mentor: bool, together: bool,
                 pattern: [7 codes], patternSt: 'br' }
     people    [{ id, name }] in the order the rota lists them
     requests  [{ person, date, kind: 'ask' | 'urgent' | 'paid' | 'unpaid', status: 'ok' | 'waiting' | 'approved' | 'refused' }]
               paid and unpaid leave, once approved, also take that day out of the person's days for the week
     keep      { id: [7 codes] } the rows of people filled in by hand (the week as it stands)
     events    [{ date, cooks, title }] an event that needs at least that many cooks working that day */
(function (root) {
  'use strict';
  const STS = ['hot', 'cold', 'pass'];
  /* what each thing costs: a place left empty is far worse than anything else */
  const W = { unfilled: 10000, brUnfilled: 4000, short: 3000, wish: 900, rank: 60, learnerAlone: 500, extra: 250, special: 600, split: 40, brRank: 40, brHand: 700 };
  const OFF = /^(0|X|)$/i;

  function rng(seed) {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
    if (!h) h = 1;
    return function () { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  }
  const addDays = (ymd, n) => { const p = ymd.split('-'); const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return d.toISOString().slice(0, 10); };

  function gen(input) {
    const week = input.week, plan = input.plan || {}, setup = plan.people || {}, keep = input.keep || {};
    const needs = plan.needs || {}, busy = plan.busy || [], brDays = plan.brDays || [], brCode = plan.brCode || 'BR+P';
    const order = (input.people || []).map((p) => p.id).filter((id) => setup[id] && setup[id].mode && setup[id].mode !== 'off');
    const auto = order.filter((id) => setup[id].mode === 'auto');
    const dates = [0, 1, 2, 3, 4, 5, 6].map((d) => addDays(week, d));

    /* days off: fixed ones and granted requests are a must; a request still waiting is a strong wish */
    const hardOff = {}, wish = {}, leave = {};
    order.forEach((id) => { hardOff[id] = [0, 0, 0, 0, 0, 0, 0]; wish[id] = [0, 0, 0, 0, 0, 0, 0]; leave[id] = 0; (setup[id].off || []).forEach((d) => { hardOff[id][d] = 1; }); });
    (input.requests || []).forEach((r) => {
      const d = dates.indexOf(r.date);
      if (d < 0 || !hardOff[r.person] || r.status === 'refused') return;
      const isLeave = r.kind === 'paid' || r.kind === 'unpaid';
      if (isLeave && r.status === 'approved') { if (!hardOff[r.person][d]) leave[r.person]++; hardOff[r.person][d] = 1; }
      else if (!isLeave && (r.kind === 'urgent' || r.status === 'ok' || r.status === 'approved')) hardOff[r.person][d] = 1; else wish[r.person][d] = 1;
    });

    const S = (id) => setup[id];
    const target = (id) => Math.max(0, (S(id).days || 0) - (leave[id] || 0));
    const rank = (id, st) => (S(id).stations || []).indexOf(st);
    const places = (d) => { const out = []; STS.forEach((s) => { for (let k = 0; k < ((needs[s] || [])[d] || 0); k++) out.push(s); }); return out; };
    const placeList = [0, 1, 2, 3, 4, 5, 6].map(places);
    /* events: the most cooks any event that day needs */
    const minCooks = [0, 0, 0, 0, 0, 0, 0], evName = ['', '', '', '', '', '', ''];
    (input.events || []).forEach((e) => { const d = dates.indexOf(e.date), n = +e.cooks || 0; if (d >= 0 && n > minCooks[d]) { minCooks[d] = n; evName[d] = e.title || 'the event'; } });

    /* ---------- one day: who stands where, given who works ---------- */
    function solveDay(d, work, special) {
      const pl = placeList[d], here = auto.filter((id) => work[id][d] && !special[id][d]);
      let best = null;
      const pick = new Array(pl.length).fill(null), used = {};
      (function dfs(i, cost) {
        if (best && cost >= best.cost) return;
        if (i === pl.length) {
          let c = cost;
          const on = {};
          pl.forEach((s, k) => { if (pick[k]) on[pick[k]] = s; });
          const mentorOnHot = pl.some((s, k) => s === 'hot' && pick[k] && S(pick[k]).mentor);
          const extras = {};
          here.forEach((id) => {
            if (on[id]) return;
            if (S(id).learner && mentorOnHot && rank(id, 'hot') >= 0) extras[id] = 'learn';
            else if (rank(id, 'prep') >= 0) extras[id] = 'prep';
            else { extras[id] = 'prep'; c += W.extra; }
          });
          if (!best || c < best.cost) best = { cost: c, on: on, extras: extras };
          return;
        }
        const s = pl[i];
        for (const id of here) {
          if (used[id]) continue;
          const r = rank(id, s);
          if (r < 0) continue;
          let c = r * W.rank;
          if (s === 'hot' && S(id).learner && busy.includes(d)) c += W.learnerAlone;
          used[id] = 1; pick[i] = id;
          dfs(i + 1, cost + c);
          used[id] = 0; pick[i] = null;
        }
        dfs(i + 1, cost + W.unfilled);
      })(0, 0);

      /* weekend breakfast: whoever works that day and covers it, in your order; people set by hand last */
      let br = null, brCost = 0;
      if (brDays.includes(d)) {
        let bestR = Infinity;
        auto.forEach((id) => { const r = S(id).br || 0; if (r && work[id][d] && !special[id][d] && r < bestR) { bestR = r; br = id; } });
        if (br) brCost = (bestR - 1) * W.brRank;
        else {
          order.forEach((id) => {
            const s = S(id);
            if (s.mode === 'auto' || !s.br || hardOff[id][d]) return;
            const cell = String((s.mode === 'fixed' ? (s.pattern || [])[d] : (keep[id] || [])[d]) || '').trim();
            if (/^(0|X)$/i.test(cell)) return;
            if (s.br < bestR) { bestR = s.br; br = id; }
          });
          brCost = br ? W.brHand + (bestR - 1) * W.brRank : W.brUnfilled;
        }
      }
      const heads = auto.filter((id) => work[id][d]).length;
      const evCost = minCooks[d] > heads ? (minCooks[d] - heads) * W.unfilled : 0;
      return { cost: best.cost + brCost + evCost, on: best.on, extras: best.extras, br: br, heads: heads };
    }

    /* ---------- one person's week: days short, wishes not met, days off split up ---------- */
    function personCost(id, work, special) {
      const s = S(id), w = work[id], n = w.reduce((a, b) => a + b, 0);
      let c = Math.max(0, target(id) - n) * W.short;
      for (let d = 0; d < 7; d++) if (w[d] && wish[id][d]) c += W.wish;
      if (s.special && s.special.n) c += Math.abs(Math.min(s.special.n, n) - special[id].reduce((a, b) => a + b, 0)) * W.special;
      let blocks = 0;
      for (let d = 0; d < 7; d++) if (!w[d] && (d === 0 || w[d - 1])) blocks++;
      /* days off kept together only for whoever asked for it; filling the kitchen always comes first */
      if (blocks > 1 && s.together) c += (blocks - 1) * W.split;
      return c;
    }

    const R = rng(week + '|' + JSON.stringify(plan) + '|' + JSON.stringify(input.requests || []) + '|' + order.join(','));
    const free = (id) => [0, 1, 2, 3, 4, 5, 6].filter((d) => !hardOff[id][d]);

    function start() {
      const work = {}, special = {};
      auto.forEach((id) => {
        const f = free(id).slice(), n = Math.min(target(id), f.length);
        for (let i = f.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = f[i]; f[i] = f[j]; f[j] = t; }
        work[id] = [0, 0, 0, 0, 0, 0, 0]; special[id] = [0, 0, 0, 0, 0, 0, 0];
        f.slice(0, n).forEach((d) => { work[id][d] = 1; });
        const sn = S(id).special && S(id).special.n ? Math.min(S(id).special.n, n) : 0;
        f.slice(0, sn).forEach((d) => { special[id][d] = 1; });
      });
      return { work: work, special: special };
    }
    function evalAll(st) {
      const days = [0, 1, 2, 3, 4, 5, 6].map((d) => solveDay(d, st.work, st.special));
      const pc = {};
      auto.forEach((id) => { pc[id] = personCost(id, st.work, st.special); });
      const total = days.reduce((a, x) => a + x.cost, 0) + auto.reduce((a, id) => a + pc[id], 0);
      return { days: days, pc: pc, total: total };
    }
    const copy = (st) => ({ work: JSON.parse(JSON.stringify(st.work)), special: JSON.parse(JSON.stringify(st.special)) });

    let best = null;
    for (let run = 0; run < 3 && auto.length; run++) {
      let st = start(), ev = evalAll(st);
      const ITER = 1800;
      for (let it = 0; it < ITER; it++) {
        const id = auto[Math.floor(R() * auto.length)], w = st.work[id], sp = st.special[id];
        const on = [], offd = [];
        for (let d = 0; d < 7; d++) { if (w[d]) on.push(d); else if (!hardOff[id][d]) offd.push(d); }
        const touched = [];
        let undo;
        const mv = R();
        if (S(id).special && S(id).special.n && mv < 0.25) {
          const a = on.filter((d) => sp[d]), b = on.filter((d) => !sp[d]);
          if (!a.length || !b.length) continue;
          const x = a[Math.floor(R() * a.length)], y = b[Math.floor(R() * b.length)];
          sp[x] = 0; sp[y] = 1; touched.push(x, y);
          undo = () => { sp[x] = 1; sp[y] = 0; };
        } else {
          if (!on.length || !offd.length) continue;
          const x = on[Math.floor(R() * on.length)], y = offd[Math.floor(R() * offd.length)];
          const wasSp = sp[x];
          w[x] = 0; w[y] = 1; sp[x] = 0; sp[y] = wasSp;
          touched.push(x, y);
          undo = () => { w[x] = 1; w[y] = 0; sp[x] = wasSp; sp[y] = 0; };
        }
        const nd = touched.map((d) => solveDay(d, st.work, st.special)), np = personCost(id, st.work, st.special);
        const delta = touched.reduce((a, d, k) => a + nd[k].cost - ev.days[d].cost, 0) + np - ev.pc[id];
        const temp = 300 * (1 - it / ITER) + 1;
        if (delta <= 0 || R() < Math.exp(-delta / temp)) {
          touched.forEach((d, k) => { ev.days[d] = nd[k]; });
          ev.pc[id] = np; ev.total += delta;
          if (!best || ev.total < best.ev.total) best = { st: copy(st), ev: { days: ev.days.slice(), pc: Object.assign({}, ev.pc), total: ev.total } };
        } else undo();
      }
      if (!best || ev.total < best.ev.total) best = { st: copy(st), ev: { days: ev.days.slice(), pc: Object.assign({}, ev.pc), total: ev.total } };
    }
    if (!best) { const st = start(); best = { st: st, ev: evalAll(st) }; }
    /* re-solve the winning week from scratch so every day matches it exactly */
    best.ev = evalAll(best.st);

    /* ---------- the week on paper, and what could not be done ---------- */
    const rows = {}, stOf = {}, issues = [], DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const name = (id) => ((input.people || []).find((p) => p.id === id) || {}).name || id;
    order.forEach((id) => {
      const s = S(id);
      rows[id] = ['', '', '', '', '', '', '']; stOf[id] = ['', '', '', '', '', '', ''];
      if (s.mode === 'fixed') for (let d = 0; d < 7; d++) { const c = hardOff[id][d] ? '0' : String((s.pattern || [])[d] || ''); rows[id][d] = c; stOf[id][d] = c && !OFF.test(c) ? s.patternSt || '' : ''; }
      if (s.mode === 'hand') for (let d = 0; d < 7; d++) rows[id][d] = String((keep[id] || [])[d] || '');
    });
    for (let d = 0; d < 7; d++) {
      const day = best.ev.days[d];
      auto.forEach((id) => {
        const s = S(id);
        if (!best.st.work[id][d]) { rows[id][d] = '0'; return; }
        if (best.st.special[id][d]) { rows[id][d] = s.special.code; stOf[id][d] = 'prep'; return; }
        if (day.on[id]) { rows[id][d] = s.code || '2'; stOf[id][d] = day.on[id]; return; }
        rows[id][d] = s.code || '2'; stOf[id][d] = day.extras[id] || 'prep';
        if (stOf[id][d] === 'prep' && rank(id, 'prep') < 0) issues.push({ sev: 'info', day: d, person: id, text: name(id) + ' is spare on ' + DAY[d] + ', put on prep' });
      });
      placeList[d].forEach((s) => {
        const n = Object.keys(day.on).filter((id) => day.on[id] === s).length, need = placeList[d].filter((x) => x === s).length;
        if (n < need && !issues.some((x) => x.day === d && x.st === s)) issues.push({ sev: 'red', day: d, st: s, text: DAY[d] + ': nobody on ' + s });
      });
      Object.keys(day.on).forEach((id) => { if (day.on[id] === 'hot' && S(id).learner && busy.includes(d)) issues.push({ sev: 'amber', day: d, person: id, text: name(id) + ' is alone on Hot on ' + DAY[d] + ' (a busy day)' }); });
      if (brDays.includes(d)) {
        if (!day.br) issues.push({ sev: 'red', day: d, text: DAY[d] + ': nobody for breakfast' });
        else {
          const id = day.br;
          if (S(id).mode === 'auto') rows[id][d] = brCode;
          else { rows[id][d] = 'BR'; stOf[id][d] = 'br'; issues.push({ sev: 'amber', day: d, person: id, text: name(id) + ' does breakfast on ' + DAY[d] + ' (last choice)' }); }
        }
      }
    }
    for (let d = 0; d < 7; d++) {
      const heads = auto.filter((id) => best.st.work[id][d]).length;
      if (minCooks[d] > heads) issues.push({ sev: 'red', day: d, event: true, text: DAY[d] + ': ' + evName[d] + ' needs ' + minCooks[d] + ' cooks, ' + heads + ' working' });
    }
    /* a hole is for the head chef or the sous chef: who could step in, and what it costs them */
    const askedOff = {};
    (input.requests || []).forEach((r) => { const d = dates.indexOf(r.date); if (d >= 0 && r.kind !== 'urgent' && r.status !== 'refused') (askedOff[r.person] = askedOff[r.person] || {})[d] = true; });
    issues.forEach((x) => {
      if (x.sev !== 'red' || x.day == null) return;
      const d = x.day, want = x.event ? 'any' : x.st || 'br';
      x.could = auto.filter((id) => (x.event ? !best.st.work[id][d] : !(best.st.work[id][d] && !best.st.special[id][d] && best.ev.days[d].on[id])))
        .filter((id) => (want === 'any' ? (S(id).stations || []).length : want === 'br' ? S(id).br : rank(id, want) >= 0) && !(setup[id].off || []).includes(d) && !(input.requests || []).some((r) => r.person === id && r.kind === 'urgent' && r.status !== 'refused' && dates.indexOf(r.date) === d))
        .map((id) => {
          const n = best.st.work[id].reduce((a, b) => a + b, 0), works = best.st.work[id][d];
          const why = works ? 'working that day on ' + (best.st.special[id][d] ? 'prep' : (best.ev.days[d].extras[id] || 'prep')) + ', could move'
            : askedOff[id] && askedOff[id][d] ? 'asked for this day off' : n >= (S(id).days || 0) ? 'off that day, would be ' + (n + 1) + ' days (usually ' + S(id).days + ')' : 'off that day';
          return { id: id, why: why, score: (works ? 0 : 2) + (askedOff[id] && askedOff[id][d] ? 3 : 0) + (want === 'any' ? 0 : want === 'br' ? S(id).br : rank(id, want)) };
        })
        .sort((a, b) => a.score - b.score).slice(0, 4).map((c) => ({ id: c.id, why: c.why }));
    });
    auto.forEach((id) => {
      const s = S(id), n = best.st.work[id].reduce((a, b) => a + b, 0);
      if (n < target(id)) issues.push({ sev: 'amber', person: id, text: name(id) + ' gets ' + n + ' of ' + target(id) + ' days (not enough free days)' });
      for (let d = 0; d < 7; d++) if (best.st.work[id][d] && wish[id][d]) issues.push({ sev: 'amber', day: d, person: id, text: name(id) + ' works ' + DAY[d] + ' but asked for it off (waiting for approval)' });
    });
    return { order: order, rows: rows, st: stOf, issues: issues, cost: best.ev.total };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = gen;
  else root.K.rotaGen = gen;
})(typeof window !== 'undefined' ? window : globalThis);
