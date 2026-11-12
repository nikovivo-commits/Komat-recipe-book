/* Planning tomorrow from covers. The head chef gives a mise en place row a quantity per 10 covers
   in the list editor. Whoever writes tomorrow's list types the covers, says what is already in the
   walk-in, checks the amounts and puts them on the list: each row that needs making is marked DO
   with how much to make. A plain calculator the chef checks before anything changes, not a forecast.
   Rows without a quantity stay as they are and are marked by hand, as before. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;

  /* ---------- the sums ---------- */
  const tidy = (n) => Math.round(n * 1000) / 1000;
  /* amounts are rounded up to what a cook would weigh out: 10 g or ml, 0.1 kg or L, whole pieces and portions */
  K.planStep = (u) => { const x = String(u || '').trim().toLowerCase(); return x === 'g' || x === 'ml' ? 10 : x === 'kg' || x === 'l' ? 0.1 : 1; };
  /* how much the covers need: the quantity per 10 covers, times covers / 10 */
  K.planNeed = (par, covers) => (par && +par.q > 0 && covers > 0 ? tidy(+par.q * covers / 10) : 0);
  /* what to make: what is needed less what is already there, rounded up to the step; never below nothing */
  K.planMake = (need, have, u) => {
    const left = tidy(need - (have > 0 ? have : 0)), step = K.planStep(u);
    return left <= 0 ? 0 : tidy(Math.ceil(tidy(left / step)) * step);
  };
  K.fmtPlan = (q, u) => K.fmtQty(String(q), u || '', 1);
  /* in the plan sheet every number stays in the row's own unit, so Need, Have and Make line up */
  const inUnit = (q, u) => K.fmtNum(q) + (u ? ' ' + u : '');
  /* how many batches of a recipe an amount is (0 when the units can't be compared): 4.5 L of a recipe
     that makes 1.5 L is 3 batches; 2 kg of one that makes 500 g is 4 */
  K.planFactor = (q, qu, yq, yu) => {
    q = +q; const y = K.parseQty(yq);
    if (!(q > 0) || !(y > 0)) return 0;
    const a = K.unitInfo(qu), b = K.unitInfo(yu);
    if (a && b) return a[0] === b[0] ? tidy((q * a[1]) / (y * b[1])) : 0;
    const one = (u) => String(u || '').trim().toLowerCase().replace(/s$/, '');
    return !a && !b && one(qu) === one(yu) ? tidy(q / y) : 0;
  };
  /* a number typed on a phone: 4,5 and 4.5 are the same; empty is nothing */
  const num = (v) => { const n = K.parseQty(v); return n > 0 ? n : 0; };

  /* ---------- reading the plan ---------- */
  K.planOf = (st, day) => { const d = D.checks[K.checkId(st, day)]; return d && d.plan && d.plan.covers > 0 ? d.plan : null; };
  /* the covers already planned for a day on any station: the whole kitchen cooks for the same covers */
  K.coversFor = (day) => {
    let c = null;
    K.STATIONS.forEach((s) => { const p = K.planOf(s[0], day); if (c == null && p && p.covers > 0) c = p.covers; });
    return c;
  };
  K.parRows = (st, day) => K.checkItems(st, day).filter((it) => it.par);
  /* the amount written on a DO row, e.g. "4.6 L" */
  K.markQty = (m) => (m && (m.d === 'do' || m.d === 'urg') && m.q > 0 ? K.fmtPlan(m.q, m.qu) : '');
  K.qtyTag = (m) => { const q = K.markQty(m); return q ? h('span', { class: 'mqty ' + K.inkClass(m.ink) + ' ' + K.handClass(m.hand) }, q) : null; };
  const eventsOn = (day) => (D.events || []).filter((e) => e.date === day && K.isLive(e) && +e.guests > 0);

  /* ---------- the card at the top of tomorrow's list ---------- */
  K.planCard = function (st, day) {
    const rows = K.parRows(st, day), p = K.planOf(st, day);
    if (!rows.length) {
      if (!K.me.admin) return null;
      return h('div', { class: 'plancard card tt-tmr empty' },
        h('p', null, h('b', null, 'Plan from covers. '), 'Give rows a quantity per 10 covers and this list fills itself in from tomorrow’s covers.'),
        h('button', { class: 'btn small', type: 'button', onclick: () => { ui.listDraft = null; K.go('lists'); } }, K.icon('edit'), 'Set quantities'));
    }
    const key = st + '|' + day, typed = ui.planCovers && ui.planCovers.key === key ? ui.planCovers.v : null;
    const start = typed != null ? typed : p ? String(p.covers) : String(K.coversFor(day) || '');
    const open = () => {
      const v = (document.getElementById('pc-cov') || {}).value;
      const cov = Math.round(num(v));
      if (!cov) { K.toast('Type how many covers first.'); const el = document.getElementById('pc-cov'); if (el) el.focus(); return; }
      const have = {};
      ((p && p.have) || []).forEach((x) => { if (x && x.id) have[x.id] = String(x.n); });
      ui.planCovers = null;
      ui.sheet = { type: 'plan', st: st, day: day, covers: String(cov), have: have, over: {} };
      K.render();
    };
    const evs = eventsOn(day);
    return h('form', { class: 'plancard card tt-tmr' + (p ? ' planned' : ''), onsubmit: (e) => { e.preventDefault(); open(); } },
      h('div', { class: 'pc-row' },
        h('label', { class: 'pc-k', for: 'pc-cov' }, 'Covers tomorrow'),
        h('input', { class: 'input pc-cov mono', id: 'pc-cov', type: 'text', inputmode: 'numeric', autocomplete: 'off', enterkeyhint: 'go', value: start,
          oninput: (e) => { ui.planCovers = { key: key, v: e.target.value }; } }),
        h('button', { class: 'btn ' + (p ? '' : 'primary'), type: 'submit' }, p ? 'Plan again' : 'Plan the list')),
      h('p', { class: 'pc-note' }, p
        ? 'Planned for ' + p.covers + ' covers' + (K.nameOf(p.by) ? ' by ' + K.nameOf(p.by) : '') + ' at ' + K.hm(p.at) + '.'
        : rows.length + (rows.length === 1 ? ' row has' : ' rows have') + ' a quantity per 10 covers. You check the amounts before they go on the list.'),
      evs.length ? h('p', { class: 'pc-note ev' }, K.icon('event'), evs.map((e) => (e.title || 'Event') + ': ' + e.guests + ' guests').join(' · ') + '. Add them if they eat from this prep.') : null);
  };

  /* ---------- the plan: covers, what's there, what to make ---------- */
  function calc(S) {
    const cov = num(S.covers);
    return K.parRows(S.st, S.day).map((it) => {
      const need = K.planNeed(it.par, cov), have = num(S.have[it.id]), auto = K.planMake(need, have, it.par.u);
      const over = S.over[it.id], make = over != null && String(over).trim() !== '' ? tidy(num(over)) : auto;
      return { it: it, u: it.par.u || '', need: need, have: have, auto: auto, make: make, over: over != null && String(over).trim() !== '' };
    });
  }
  /* typing changes the numbers in place: no redraw, so the phone keyboard stays up */
  function recount(S) {
    const rows = calc(S);
    rows.forEach((x) => {
      const need = document.getElementById('pl-need-' + x.it.id), mk = document.getElementById('pl-make-' + x.it.id);
      if (need) need.textContent = x.need ? inUnit(x.need, x.u) : '–';
      if (mk && !x.over && mk !== document.activeElement) mk.value = x.auto ? K.fmtNum(x.auto) : '';
      if (mk) mk.closest('.pl-row').classList.toggle('zero', !x.make);
    });
    const go = document.getElementById('pl-go'), n = rows.filter((x) => x.make > 0).length;
    if (go) { go.disabled = !num(S.covers); go.lastChild.textContent = goWords(n, rows.length); }
  }
  const goWords = (n, all) => (n ? 'Put ' + n + ' on tomorrow’s list' : all ? 'Nothing to make: put it on the list' : 'Put it on the list');

  K.SHEETS.plan = function (S) {
    const rows = calc(S), all = K.checkItems(S.st, S.day).length, n = rows.filter((x) => x.make > 0).length;
    const field = (id, val, label, on) => h('input', { class: 'input pl-in mono', id: id, type: 'text', inputmode: 'decimal', autocomplete: 'off', value: val, 'aria-label': label, oninput: (e) => { on(e.target.value); recount(S); } });
    const body = h('form', { class: 'plan', onsubmit: (e) => { e.preventDefault(); apply(S); } },
      h('div', { class: 'pl-top' },
        K.field('Covers', h('input', { class: 'input big mono pl-cov', id: 'pl-cov', type: 'text', inputmode: 'numeric', autocomplete: 'off', value: S.covers,
          oninput: (e) => { S.covers = e.target.value; recount(S); } })),
        h('p', { class: 'hint' }, K.ST[S.st] + ' · ' + K.sheetDate(S.day) + '. ', h('b', null, 'Need'), ' comes from the covers. Type what’s already in the walk-in under ', h('b', null, 'Have'), '. Change ', h('b', null, 'Make'), ' if you know better.')),
      h('div', { class: 'pl-list', role: 'table', 'aria-label': 'Amounts for tomorrow' },
        h('div', { class: 'pl-row pl-head', role: 'row' }, h('span', { role: 'columnheader' }, 'Item'), h('span', { role: 'columnheader' }, 'Need'), h('span', { role: 'columnheader' }, 'Have'), h('span', { role: 'columnheader' }, 'Make')),
        rows.map((x) => h('div', { class: 'pl-row' + (x.make ? '' : ' zero'), role: 'row' },
          h('span', { class: 'pl-name', role: 'cell' }, h('b', null, K.trName(x.it.name, x.it.en)),
            h('small', null, inUnit(x.it.par.q, x.u) + ' per 10 covers · ' + K.trName(x.it.group, x.it.gen))),
          h('span', { class: 'pl-need mono', role: 'cell', id: 'pl-need-' + x.it.id }, x.need ? inUnit(x.need, x.u) : '–'),
          h('span', { class: 'pl-cell' + (x.u.length > 3 ? ' long' : ''), role: 'cell' }, field('pl-have-' + x.it.id, S.have[x.it.id] || '', 'Have of ' + x.it.name + ', in ' + (x.u || 'units'), (v) => { S.have[x.it.id] = v; }), h('i', null, x.u)),
          h('span', { class: 'pl-cell' + (x.u.length > 3 ? ' long' : ''), role: 'cell' }, field('pl-make-' + x.it.id, x.over ? S.over[x.it.id] : x.auto ? K.fmtNum(x.auto) : '', 'Make of ' + x.it.name + ', in ' + (x.u || 'units'), (v) => { S.over[x.it.id] = v; }), h('i', null, x.u))))),
      all > rows.length ? h('p', { class: 'hint' }, (all - rows.length) + (all - rows.length === 1 ? ' row has' : ' rows have') + ' no quantity per 10 covers. ' + (all - rows.length === 1 ? 'It stays' : 'They stay') + ' as ' + (all - rows.length === 1 ? 'it is' : 'they are') + ': mark by hand.') : null,
      h('button', { class: 'btn primary wide', id: 'pl-go', type: 'submit', disabled: !num(S.covers) }, K.icon('check'), h('span', null, goWords(n, rows.length))));
    if (!S.focused) { S.focused = true; setTimeout(() => { const el = document.getElementById('pl-have-' + (rows[0] && rows[0].it.id)); if (el && !matchMedia('(pointer: coarse)').matches) el.focus({ preventScroll: true }); }, 60); }
    return K.sheet('Plan from covers', body, { wide: true });
  };

  /* every row with a quantity is written: DO with its amount, or nothing when there is enough.
     A note on the row stays. Undo puts every row and the old plan back */
  function apply(S) {
    const cov = Math.round(num(S.covers));
    if (!cov) return;
    const rows = calc(S), st = S.st, day = S.day, hand = (K.myHand && K.myHand()) || 'caveat';
    const before = rows.map((x) => ({ it: x.it, m: K.clone(K.mark(st, x.it.id, day) || {}) })), oldPlan = K.clone(K.planOf(st, day));
    const list = rows.map((x) => {
      const m = K.mark(st, x.it.id, day) || {};
      return { it: x.it, patch: x.make > 0
        ? { d: 'do', k: m.d === 'do' ? m.k || '' : '', q: x.make, qu: x.u, hand: hand }
        : { d: '', q: null, qu: null } };
    });
    const have = rows.filter((x) => x.have > 0).map((x) => ({ id: x.it.id, n: x.have }));
    const n = rows.filter((x) => x.make > 0).length;
    ui.sheet = null;
    K.vibrate([10, 30, 10]);
    K.setMarks(st, list, day, { plan: { covers: cov, have: have, at: Date.now(), by: K.me.id || '' } });
    K.toast(n ? n + ' to make for ' + cov + ' covers' : 'Enough of everything for ' + cov + ' covers', { tone: 'good', undo: () => {
      K.setMarks(st, before.map((x) => ({ it: x.it, patch: { d: x.m.d || '', u: !!x.m.u, k: x.m.k || '', q: x.m.q > 0 ? x.m.q : null, qu: x.m.qu || null } })), day,
        { plan: oldPlan || { covers: 0, have: [], at: 0, by: '' } });
    } });
    K.render();
  }
})();
