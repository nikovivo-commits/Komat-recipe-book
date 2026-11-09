/* The rota generator. From the team setup, what each station needs every day and the days people
   asked off, it fills one week (Monday = 0 ... Sunday = 6). It has no randomness of its own: the
   same inputs give the same week on every phone and in the Saturday job, so a draft never jumps
   around just because someone else opened the app.

   gen({ week, plan, people, requests, keep }) -> { order, rows, st, issues, cost }
     week      'YYYY-MM-DD', the Monday
     plan      { people: { id: setup }, needs: { hot: [7], cold: [7], pass: [7] }, busy: [days], brDays: [days], brCode }
       setup   { mode: 'auto' | 'fixed' | 'hand' | 'off', stations: ['cold', 'hot', 'prep'], days: 4, code: '2',
                 off: [days], avoid: [days] (off if at all possible: worked only to stop a hole), avoidMore: [days] (the same, even later), special: { code: '10:30', n: 2 }, br: 0 | rank, learner: bool, mentor: bool, together: bool,
                 emergency: ['hot'] (stations they can do, but only when the place would otherwise be empty),
                 learn: ['pass'], learnDays: 1 (a station they are learning and how many days a week: on those days
                 they stand next to a teacher there, someone whose main station it is, instead of taking a place),
                 pattern: [7 codes], patternSt: 'br' }
     people    [{ id, name }] in the order the rota lists them
     requests  [{ person, date, kind: 'ask' | 'urgent' | 'paid' | 'unpaid', status: 'ok' | 'waiting' | 'approved' | 'refused' }]
               paid and unpaid leave, once approved, also take that day out of the person's days for the week
     keep      { id: [7 codes] } the rows of people filled in by hand (the week as it stands)
     events    [{ date, cooks, when, before, title }] an event that needs at least that many cooks working that day
               (when: 'day' counts lunch, 'night' counts the night, otherwise the whole day), and before: cooks the day before
     pins      [{ person, date, st, extra }] the head chef's word: this person works that day at that station
               (even on a day they are usually off); extra: true adds it on top of their days instead of swapping one
   A person filled in by hand can have cover: ['pass'], a station they take only when nobody else can.

   Lunch and night (plan.periods): a full shift (P) counts for lunch and night, a late shift (plan.lateCode, '2',
   from 15:00) for night only. plan.lunch says how many each station needs at lunch; the night needs the places
   in plan.needs plus, ideally, one filler on top. A person's late: n is how many of their days are late shifts.
   Someone on a fixed week can cover stations at lunch on the days they work (lunch: ['hot']), and a prep day
   (10:30) covers that person's station at lunch. */
(function (root) {
  'use strict';
  const STS = ['hot', 'cold', 'pass'];
  /* what each thing costs: a place left empty is far worse than anything else */
  const W = { lateDay: 15, avoid: 4000, avoidMore: 7000, lunchHole: 6000, noFiller: 400, mix: 200, learnMiss: 150, noTeacher: 300, busyEmergency: 1500, emergency: 2500, hand: 3000, unfilled: 10000, brUnfilled: 4000, short: 3000, wish: 900, rank: 60, learnerAlone: 500, extra: 30, special: 600, split: 40, brRank: 40, brHand: 700, crowd: 350, lateRare: 900, avoidNeeded: 250 };
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

    /* pins: the head chef says who works where on a day; it beats a day off */
    const pin = {}, extraDays = {};
    (input.pins || []).forEach((p) => {
      const d = dates.indexOf(p.date), s = setup[p.person];
      if (d < 0 || !s || s.mode !== 'auto') return;
      (pin[p.person] = pin[p.person] || [])[d] = p.st || (s.stations || [])[0] || 'float';
      hardOff[p.person][d] = 0; wish[p.person][d] = 0;
      if (p.extra) extraDays[p.person] = (extraDays[p.person] || 0) + 1;
    });
    const pinned = (id, d) => !!(pin[id] && pin[id][d]);
    const lrnN = (id) => ((S(id) || {}).learn || []).length ? +(S(id).learnDays || 0) : 0;
    let LRN = {};
    const lrnOf = (id, d) => !!(LRN[id] && LRN[id][d]);
    const PER = !!plan.periods, lunch = plan.lunch || {}, lateCode = plan.lateCode || '2';
    /* a late shift is about two thirds of a full one: 3 lates and 2 full days make 4 full days */
    const lateOK = (id) => PER && S(id).mode === 'auto' && !!S(id).late;
    /* someone who offered set weeks (options: [[7 codes], ...]) gets one of them whole: the days and which are
       special (10:30) come from the week picked; a week that clashes with a day they must have off is left out */
    const optsOf = (id) => { const o = S(id).options; if (!Array.isArray(o) || !o.length) return null; const ok = o.filter((w) => Array.isArray(w) && w.every((c, d) => OFF.test(String(c || '0').trim() || '0') || !hardOff[id][d])); return ok.length ? ok : null; };
    const isSp = (id, c) => !!(S(id).special && String(c).trim() === String(S(id).special.code));
    let LATE = {};
    const lateOf = (id, d) => !!(LATE[id] && LATE[id][d]);
    /* lunch: which stations nobody covers, given who is where at night */
    function lunchMiss(d, on, extras, work, special) {
      const need = {};
      STS.forEach((x) => { need[x] = (lunch[x] || [])[d] || 0; });
      order.forEach((id) => {
        const p = S(id);
        if (p.mode !== 'fixed' || !(p.lunch || []).length || hardOff[id][d]) return;
        const c = String((p.pattern || [])[d] || '').trim();
        if (!c || OFF.test(c)) return;
        p.lunch.forEach((x) => { if (need[x] > 0) need[x]--; });
      });
      auto.forEach((id) => { if (work[id][d] && special[id][d]) { const x = (S(id).stations || []).find((y) => STS.includes(y)); if (x && need[x] > 0) need[x]--; } });
      Object.keys(on).forEach((id) => { if (!lateOf(id, d) && need[on[id]] > 0) need[on[id]]--; });
      const spare = Object.keys(extras).filter((id) => !lateOf(id, d)), miss = [];
      STS.forEach((x) => { while (need[x] > 0) { const k = spare.findIndex((id) => rank(id, x) >= 0); if (k >= 0) spare.splice(k, 1); else miss.push(x); need[x]--; } });
      /* and enough hands at lunch: full shifts, prep days and whoever covers lunch on a fixed week */
      const min = Math.max((plan.lunchMin || [])[d] || 0, minLunch[d]);
      if (min) {
        let n = auto.filter((id) => work[id][d] && (special[id][d] || !lateOf(id, d))).length;
        order.forEach((id) => { const p = S(id), c = String((p.pattern || [])[d] || '').trim(); if (p.mode === 'fixed' && (p.lunch || []).length && !hardOff[id][d] && c && !OFF.test(c)) n++; });
        for (; n < min; n++) miss.push('cook');
      }
      return miss;
    }
    const S = (id) => setup[id];
    const target = (id) => Math.max(0, (S(id).days || 0) - (leave[id] || 0) + (extraDays[id] || 0));
    const rank = (id, st) => (S(id).stations || []).indexOf(st);
    const places = (d) => { const out = []; STS.forEach((s) => { for (let k = 0; k < ((needs[s] || [])[d] || 0); k++) out.push(s); }); return out; };
    const placeList = [0, 1, 2, 3, 4, 5, 6].map(places);
    /* events: the most cooks any event that day needs */
    const minCooks = [0, 0, 0, 0, 0, 0, 0], evName = ['', '', '', '', '', '', ''], minLunch = [0, 0, 0, 0, 0, 0, 0], minNight = [0, 0, 0, 0, 0, 0, 0], evAt = ['', '', '', '', '', '', ''];
    (input.events || []).forEach((e) => {
      const d = dates.indexOf(e.date), n = +e.cooks || 0, b = +e.before || 0, t = e.title || 'the event';
      if (d >= 0 && n) {
        if (PER && e.when === 'day') { if (n > minLunch[d]) { minLunch[d] = n; evAt[d] = t; } }
        else if (PER && e.when === 'night') { if (n > minNight[d]) { minNight[d] = n; evAt[d] = t; } }
        else if (n > minCooks[d]) { minCooks[d] = n; evName[d] = t; }
      }
      const db = dates.indexOf(addDays(e.date, -1));
      if (db >= 0 && b > minCooks[db]) { minCooks[db] = b; evName[db] = t + ' (prep, the day before)'; }
    });

    /* ---------- one day: who stands where, given who works ---------- */
    function solveDay(d, work, special) {
      if (work.__lrn) LRN = work.__lrn;
      if (work.__late) LATE = work.__late;
      const pins = auto.filter((id) => work[id][d] && pinned(id, d)), pl = placeList[d].slice();
      pins.forEach((id) => { const k = pl.indexOf(pin[id][d]); if (k >= 0) pl.splice(k, 1); });
      const here = auto.filter((id) => work[id][d] && !special[id][d] && !lrnOf(id, d) && !pinned(id, d));
      let best = null;
      const pick = new Array(pl.length).fill(null), used = {};
      (function dfs(i, cost) {
        if (best && cost >= best.cost) return;
        if (i === pl.length) {
          let c = cost;
          const on = {}, extras = {};
          pl.forEach((s, k) => { if (pick[k]) on[pick[k]] = s; });
          pins.forEach((id) => { if (STS.includes(pin[id][d])) on[id] = pin[id][d]; else extras[id] = pin[id][d]; });
          const mentorOnHot = Object.keys(on).some((id) => on[id] === 'hot' && S(id).mentor);
          /* a teacher on a station: someone whose main station it is (or a mentor on Hot) */
          const teach = (x) => Object.keys(on).some((id) => on[id] === x && ((S(id).stations || [])[0] === x || (x === 'hot' && S(id).mentor)));
          here.forEach((id) => {
            if (on[id]) return;
            if (S(id).learner && mentorOnHot && rank(id, 'hot') >= 0) extras[id] = 'learn';
            else if (rank(id, 'prep') >= 0) extras[id] = 'prep';
            else { extras[id] = 'float'; c += W.extra; }
          });
          auto.forEach((id) => { if (work[id][d] && lrnOf(id, d)) { const x = S(id).learn[0]; extras[id] = 'learn-' + x; if (!teach(x)) c += W.noTeacher; } });
          if (PER) c += lunchMiss(d, on, extras, work, special).length * W.lunchHole + (Object.keys(extras).length ? 0 : W.noFiller);
          if (!best || c < best.cost) best = { cost: c, on: on, extras: extras };
          return;
        }
        const s = pl[i];
        for (const id of here) {
          if (used[id]) continue;
          const r = rank(id, s);
          if (r < 0) continue;
          const em = (S(id).emergency || []).includes(s);
          let c = r * W.rank + (em ? W.emergency + (busy.includes(d) ? W.busyEmergency : 0) : 0);
          if (s === 'hot' && S(id).learner && busy.includes(d)) c += W.learnerAlone;
          used[id] = 1; pick[i] = id;
          dfs(i + 1, cost + c);
          used[id] = 0; pick[i] = null;
        }
        dfs(i + 1, cost + W.unfilled);
      })(0, 0);

      /* a place still empty: someone filled in by hand who covers that station, as the very last resort */
      const handOn = {};
      let handCost = 0;
      STS.forEach((s) => {
        let miss = placeList[d].filter((x) => x === s).length - Object.keys(best.on).filter((id) => best.on[id] === s).length;
        order.forEach((id) => {
          const p = S(id);
          if (miss <= 0 || p.mode !== 'hand' || !(p.cover || []).includes(s) || handOn[id] || hardOff[id][d] || /^(0|X)$/i.test(String((keep[id] || [])[d] || '').trim())) return;
          handOn[id] = s; miss--; handCost += W.hand - W.unfilled;
        });
      });
      /* weekend breakfast: whoever works that day and covers it, in your order; people set by hand last */
      let br = null, brCost = 0;
      if (brDays.includes(d)) {
        let bestR = Infinity;
        /* brOn: the weekend days someone would rather do the breakfast; on the other day they come after the rest */
        auto.forEach((id) => { const on0 = S(id).brOn, r = (S(id).br || 0) && (S(id).br + (Array.isArray(on0) && on0.length && !on0.includes(d) ? 1.5 : 0)); if (r && work[id][d] && !special[id][d] && !lateOf(id, d) && r < bestR) { bestR = r; br = id; } });
        if (br) brCost = (bestR - 1) * W.brRank;
        else {
          order.forEach((id) => {
            const s = S(id);
            if (s.mode === 'auto' || !s.br || hardOff[id][d] || handOn[id]) return;
            const cell = String((s.mode === 'fixed' ? (s.pattern || [])[d] : (keep[id] || [])[d]) || '').trim();
            if (/^(0|X)$/i.test(cell)) return;
            if (s.br < bestR) { bestR = s.br; br = id; }
          });
          brCost = br ? W.brHand + (bestR - 1) * W.brRank : W.brUnfilled;
        }
      }
      const heads = auto.filter((id) => work[id][d]).length;
      const nightHeads = auto.filter((id) => work[id][d] && !special[id][d]).length;
      /* a quiet day with more cooks than its stations and one filler: someone could be off instead */
      const crowd = !busy.includes(d) && !minCooks[d] && !minNight[d] ? Math.max(0, heads - placeList[d].length - 1) * W.crowd : 0;
      const evCost = crowd + (minCooks[d] > heads ? (minCooks[d] - heads) * W.unfilled : 0) + (minNight[d] > nightHeads ? (minNight[d] - nightHeads) * W.unfilled : 0);
      return { cost: best.cost + handCost + brCost + evCost, on: best.on, extras: best.extras, br: br, heads: heads, handOn: handOn };
    }

    /* ---------- one person's week: days short, wishes not met, days off split up ---------- */
    function personCost(id, work, special) {
      const s = S(id), w = work[id], n = w.reduce((a, b) => a + b, 0);
      const lt = lateOK(id) ? w.reduce((a, b, d) => a + (b && work.__late[id][d] ? 1 : 0), 0) : 0;
      let c = optsOf(id) ? 0 : lateOK(id) ? Math.abs(3 * target(id) - (3 * (n - lt) + 2 * lt)) / 3 * W.short + lt * (s.late === 'rare' ? W.lateRare : W.lateDay) : Math.max(0, target(id) - n) * W.short;
      if (lt > 3) c += (lt - 3) * W.short; /* at most 3 late shifts a week */
      /* days off-if-possible: when the other days cannot make up their week, the ones needed cost only a little,
         so the generator picks among them by what the kitchen needs (Wed or Sun) instead of leaving them short */
      const av = (s.avoid || []).filter((d) => !hardOff[id][d]), freeN = [0, 1, 2, 3, 4, 5, 6].filter((d) => !hardOff[id][d] && !av.includes(d) && !(s.avoidMore || []).includes(d)).length;
      let need = Math.max(0, target(id) - freeN);
      for (let d = 0; d < 7; d++) {
        if (w[d] && wish[id][d]) c += W.wish;
        if (w[d] && av.includes(d)) { if (need > 0) { need--; c += W.avoidNeeded; } else c += W.avoid; }
        if (w[d] && (s.avoidMore || []).includes(d)) c += W.avoidMore;
      }
      if (s.special && s.special.n && !optsOf(id)) c += Math.abs(Math.min(s.special.n, n) - special[id].reduce((a, b) => a + b, 0)) * W.special;
      if (lrnN(id)) c += Math.max(0, Math.min(lrnN(id), n) - (work.__lrn[id] || []).reduce((a, b) => a + (b ? 1 : 0), 0)) * W.learnMiss;
      let blocks = 0;
      for (let d = 0; d < 7; d++) if (!w[d] && (d === 0 || w[d - 1])) blocks++;
      /* days off kept together only for whoever asked for it; filling the kitchen always comes first */
      if (blocks > 1 && s.together) c += (blocks - 1) * W.split;
      return c;
    }

    const R = rng(week + '|' + JSON.stringify(plan) + '|' + JSON.stringify(input.requests || []) + '|' + order.join(','));
    const free = (id) => [0, 1, 2, 3, 4, 5, 6].filter((d) => !hardOff[id][d]);

    function start() {
      const work = {}, special = {}, lrn = {}, late = {};
      work.__lrn = lrn; work.__late = late;
      const opt = {}; work.__opt = opt;
      auto.forEach((id) => {
        const os = optsOf(id);
        if (os) {
          const k = Math.floor(R() * os.length), wk0 = os[k];
          opt[id] = S(id).options.indexOf(wk0);
          work[id] = wk0.map((c) => (OFF.test(String(c || '0').trim() || '0') ? 0 : 1)); special[id] = wk0.map((c) => (isSp(id, c) ? 1 : 0));
          lrn[id] = [0, 0, 0, 0, 0, 0, 0]; late[id] = [0, 0, 0, 0, 0, 0, 0];
          return;
        }
        let f = free(id).slice();
        for (let i = f.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = f[i]; f[i] = f[j]; f[j] = t; }
        /* pinned days first, days off-if-possible last */
        const av = (S(id).avoid || []).concat(S(id).avoidMore || []);
        const avm = S(id).avoidMore || [];
        f = f.filter((d) => pinned(id, d)).concat(f.filter((d) => !pinned(id, d) && !av.includes(d)), f.filter((d) => !pinned(id, d) && av.includes(d) && !avm.includes(d)), f.filter((d) => !pinned(id, d) && avm.includes(d)));
        const n = Math.max(Math.min(target(id), f.filter((d) => pinned(id, d) || !(S(id).avoidMore || []).includes(d)).length), f.filter((d) => pinned(id, d)).length);
        work[id] = [0, 0, 0, 0, 0, 0, 0]; special[id] = [0, 0, 0, 0, 0, 0, 0];
        f.slice(0, n).forEach((d) => { work[id][d] = 1; });
        const loose = f.slice(0, n).filter((d) => !pinned(id, d)), sn = S(id).special && S(id).special.n ? Math.min(S(id).special.n, loose.length) : 0;
        loose.slice(0, sn).forEach((d) => { special[id][d] = 1; });
        lrn[id] = [0, 0, 0, 0, 0, 0, 0];
        loose.slice(sn, sn + Math.min(lrnN(id), Math.max(0, loose.length - sn))).forEach((d) => { lrn[id][d] = 1; });
        late[id] = [0, 0, 0, 0, 0, 0, 0];
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
    const copy = (st) => { const w = JSON.parse(JSON.stringify(st.work)); return { work: w, special: JSON.parse(JSON.stringify(st.special)) }; };

    let best = null;
    for (let run = 0; run < 3 && auto.length; run++) {
      let st = start(), ev = evalAll(st);
      const ITER = 1800;
      for (let it = 0; it < ITER; it++) {
        const id = auto[Math.floor(R() * auto.length)], w = st.work[id], sp = st.special[id], L = st.work.__lrn[id], LT = st.work.__late[id];
        const on = [], offd = [];
        for (let d = 0; d < 7; d++) { if (w[d]) { if (!pinned(id, d)) on.push(d); } else if (!hardOff[id][d]) offd.push(d); }
        const touched = [];
        let undo;
        const mv = R();
        const os = optsOf(id);
        if (os) {
          if (os.length < 2) continue;
          const O = st.work.__opt, was = O[id], wW = w.slice(), wS = sp.slice();
          const k = os[Math.floor(R() * os.length)], ki = S(id).options.indexOf(k);
          if (ki === was) continue;
          for (let d = 0; d < 7; d++) { w[d] = OFF.test(String(k[d] || '0').trim() || '0') ? 0 : 1; sp[d] = isSp(id, k[d]) ? 1 : 0; if (w[d] !== wW[d] || sp[d] !== wS[d]) touched.push(d); }
          O[id] = ki;
          undo = () => { for (let d = 0; d < 7; d++) { w[d] = wW[d]; sp[d] = wS[d]; } O[id] = was; };
          if (!touched.length) { undo(); continue; }
        } else
        if (S(id).special && S(id).special.n && mv < 0.25) {
          const a = on.filter((d) => sp[d]), b = on.filter((d) => !sp[d] && !L[d]);
          if (!a.length || !b.length) continue;
          const x = a[Math.floor(R() * a.length)], y = b[Math.floor(R() * b.length)];
          sp[x] = 0; sp[y] = 1; touched.push(x, y);
          undo = () => { sp[x] = 1; sp[y] = 0; };
        } else if (lateOK(id) && mv < 0.4) {
          /* turn a day into a late shift or back, come in one more day on a late shift, or one day fewer */
          const r2 = R(), pool = on.filter((d) => !sp[d]);
          if (r2 < 0.45 && pool.length) {
            const x = pool[Math.floor(R() * pool.length)], was = LT[x];
            LT[x] = was ? 0 : 1; touched.push(x);
            undo = () => { LT[x] = was; };
          } else if (r2 < 0.75 && offd.length) {
            const y = offd[Math.floor(R() * offd.length)];
            w[y] = 1; LT[y] = 1; touched.push(y);
            undo = () => { w[y] = 0; LT[y] = 0; };
          } else if (on.length) {
            const x = on[Math.floor(R() * on.length)], wasLt = LT[x], wasSp = sp[x], wasL = L[x];
            w[x] = 0; LT[x] = 0; sp[x] = 0; L[x] = 0; touched.push(x);
            undo = () => { w[x] = 1; LT[x] = wasLt; sp[x] = wasSp; L[x] = wasL; };
          } else continue;
        } else if (!lateOK(id) && mv < 0.5 && R() < 0.3) {
          const n = w.reduce((a, b) => a + b, 0);
          if (n < target(id) && offd.length && R() < 0.6) {
            const y = offd[Math.floor(R() * offd.length)];
            w[y] = 1; touched.push(y);
            undo = () => { w[y] = 0; };
          } else if (on.length) {
            const x = on[Math.floor(R() * on.length)], wasSp = sp[x], wasL = L[x], wasLt = LT[x];
            w[x] = 0; sp[x] = 0; L[x] = 0; LT[x] = 0; touched.push(x);
            undo = () => { w[x] = 1; sp[x] = wasSp; L[x] = wasL; LT[x] = wasLt; };
          } else continue;
        } else if (lrnN(id) && mv < 0.55) {
          /* move a learning day, or drop one / add one back */
          const a = on.filter((d) => L[d]), b = on.filter((d) => !L[d] && !sp[d]);
          if (a.length && b.length && R() < 0.7) {
            const x = a[Math.floor(R() * a.length)], y = b[Math.floor(R() * b.length)];
            L[x] = 0; L[y] = 1; touched.push(x, y);
            undo = () => { L[x] = 1; L[y] = 0; };
          } else if (a.length && R() < 0.5) {
            const x = a[Math.floor(R() * a.length)];
            L[x] = 0; touched.push(x);
            undo = () => { L[x] = 1; };
          } else if (b.length && a.length < lrnN(id)) {
            const y = b[Math.floor(R() * b.length)];
            L[y] = 1; touched.push(y);
            undo = () => { L[y] = 0; };
          } else continue;
        } else {
          if (!on.length || !offd.length) continue;
          const x = on[Math.floor(R() * on.length)], y = offd[Math.floor(R() * offd.length)];
          const wasSp = sp[x], wasL = L[x], wasLt = LT[x];
          w[x] = 0; w[y] = 1; sp[x] = 0; sp[y] = wasSp; L[x] = 0; L[y] = wasL; LT[x] = 0; LT[y] = wasLt;
          touched.push(x, y);
          undo = () => { w[x] = 1; w[y] = 0; sp[x] = wasSp; sp[y] = 0; L[x] = wasL; L[y] = 0; LT[x] = wasLt; LT[y] = 0; };
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
        if (day.on[id]) { rows[id][d] = lateOf(id, d) ? lateCode : s.code || '2'; stOf[id][d] = day.on[id]; return; }
        /* on top of the station's main cook: the filler, helping wherever it is needed */
        rows[id][d] = lateOf(id, d) ? lateCode : s.code || '2'; stOf[id][d] = day.extras[id] || 'float';
      });
      if (PER) {
        const lm = lunchMiss(d, day.on, day.extras, best.st.work, best.st.special), short = lm.filter((x) => x === 'cook').length;
        lm.filter((x) => x !== 'cook').forEach((x) => issues.push({ sev: 'red', day: d, lunch: true, st: x, text: DAY[d] + ' lunch: nobody on ' + x }));
        if (short) issues.push({ sev: 'red', day: d, lunch: true, text: DAY[d] + ' lunch: ' + short + (short === 1 ? ' cook' : ' cooks') + ' short (needs ' + Math.max((plan.lunchMin || [])[d] || 0, minLunch[d]) + (minLunch[d] > ((plan.lunchMin || [])[d] || 0) ? ' for ' + evAt[d] : '') + ')' });
        if (!Object.keys(day.extras).length) issues.push({ sev: 'amber', day: d, text: DAY[d] + ' night: no filler, just one cook per station' });
      }
      Object.keys(day.handOn || {}).forEach((id) => {
        rows[id][d] = S(id).coverCode || 'P'; stOf[id][d] = day.handOn[id];
        issues.push({ sev: 'amber', day: d, person: id, text: name(id) + ' covers ' + day.handOn[id] + ' on ' + DAY[d] + ' (last resort)' });
      });
      placeList[d].forEach((s) => {
        const n = Object.keys(day.on).filter((id) => day.on[id] === s).length + Object.keys(day.handOn || {}).filter((id) => day.handOn[id] === s).length, need = placeList[d].filter((x) => x === s).length;
        if (n < need && !issues.some((x) => x.day === d && x.st === s)) issues.push({ sev: 'red', day: d, st: s, text: DAY[d] + ': nobody on ' + s });
      });
      Object.keys(day.on).forEach((id) => { if ((S(id).emergency || []).includes(day.on[id])) issues.push({ sev: 'amber', day: d, person: id, text: name(id) + ' covers ' + day.on[id] + ' on ' + DAY[d] + ' (emergency only)' }); });
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
      const nh = auto.filter((id) => best.st.work[id][d] && !best.st.special[id][d]).length;
      if (minNight[d] > nh) issues.push({ sev: 'red', day: d, event: true, text: DAY[d] + ' night: ' + evAt[d] + ' needs ' + minNight[d] + ' cooks, ' + nh + ' in' });
    }
    /* a hole is for the head chef or the sous chef: who could step in, and what it costs them */
    const askedOff = {};
    (input.requests || []).forEach((r) => { const d = dates.indexOf(r.date); if (d >= 0 && r.kind !== 'urgent' && r.status !== 'refused') (askedOff[r.person] = askedOff[r.person] || {})[d] = true; });
    issues.forEach((x) => {
      if (x.sev !== 'red' || x.day == null) return;
      const d = x.day, want = x.event ? 'any' : x.st || 'br';
      if (x.lunch) {
        x.could = auto.filter((id) => (!x.st || rank(id, x.st) >= 0) && !hardOff[id][d] && (!best.st.work[id][d] || lateOf(id, d)))
          .map((id) => ({ id: id, why: best.st.work[id][d] ? 'on a late shift that day, could come in at 11' : 'off that day', score: best.st.work[id][d] ? 0 : 2 }))
          .sort((p, q) => p.score - q.score).slice(0, 4).map((c) => ({ id: c.id, why: c.why }));
        return;
      }
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
      const lt = lateOK(id) ? best.st.work[id].reduce((a, b, d) => a + (b && best.st.work.__late[id][d] ? 1 : 0), 0) : 0, thirds = 3 * (n - lt) + 2 * lt;
      const fmt = (t) => Math.floor(t / 3) + (t % 3 === 1 ? '⅓' : t % 3 === 2 ? '⅔' : '');
      if (lateOK(id) ? thirds !== 3 * target(id) : n < target(id)) issues.push({ sev: 'amber', person: id, text: name(id) + ' gets ' + (lateOK(id) ? fmt(thirds) + ' of ' + target(id) + ' full days' : n + ' of ' + target(id) + ' days') + (thirds < 3 * target(id) ? ' (not enough free days)' : ' (more than usual)') });
      if (lrnN(id)) {
        const got = (best.st.work.__lrn[id] || []).reduce((a, x, d) => a + (x && best.st.work[id][d] ? 1 : 0), 0), want = Math.min(lrnN(id), n);
        if (got < want) issues.push({ sev: 'amber', person: id, text: name(id) + ': ' + (got ? 'only ' + got + ' of ' + want : 'no') + ' ' + s.learn[0] + ' learning day' + (want - got === 1 && !got ? '' : 's') + ' this week (nobody spare to cover their own station)' });
      }
      {
        const av = (s.avoid || []).filter((d) => !hardOff[id][d]), freeN = [0, 1, 2, 3, 4, 5, 6].filter((d) => !hardOff[id][d] && !av.includes(d) && !(s.avoidMore || []).includes(d)).length;
        let need = Math.max(0, target(id) - freeN);
        for (let d = 0; d < 7; d++) if (best.st.work[id][d] && ((s.avoid || []).includes(d) || (s.avoidMore || []).includes(d)) && !pinned(id, d)) {
          if (av.includes(d) && need > 0) { need--; issues.push({ sev: 'info', day: d, person: id, text: name(id) + ' works ' + DAY[d] + ' to make up the week (of the days off if possible, the kitchen needs this one most)' }); }
          else issues.push({ sev: 'amber', day: d, person: id, text: name(id) + ' comes in on ' + DAY[d] + ', a day off if possible (last resort)' });
        }
      }
      for (let d = 0; d < 7; d++) if (best.st.work[id][d] && wish[id][d]) issues.push({ sev: 'amber', day: d, person: id, text: name(id) + ' works ' + DAY[d] + ' but asked for it off (waiting for approval)' });
    });
    return { order: order, rows: rows, st: stOf, issues: issues, cost: best.ev.total };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = gen;
  else root.K.rotaGen = gen;
})(typeof window !== 'undefined' ? window : globalThis);
