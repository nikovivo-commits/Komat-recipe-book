/* Schedule: the weekly rota, with the same shift codes as the kitchen's spreadsheet. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const QUICK = ['P', 'X', '1', '2', 'BR', 'BR+P', '0', '12', '13', 'DO 21'];
  const EMPTY = () => ['', '', '', '', '', '', ''];
  K.getMe = () => K.store.get('me', '');

  function newWeekFrom(wk, copy) {
    const prevKey = Object.keys(D.weeks).filter((k) => k < wk).sort().pop(), prev = prevKey ? D.weeks[prevKey] : null;
    const people = prev ? prev.people.slice() : D.staff.people.map((p) => p.id), rows = {};
    people.forEach((id) => { rows[id] = copy && prev && prev.rows && prev.rows[id] ? prev.rows[id].slice() : EMPTY(); });
    K.saveWeek(wk, { week: wk, people: people, rows: rows, updated: Date.now() });
  }
  const range = (mon) => { const sun = K.addDays(mon, 6); return mon.getDate() + '.' + (mon.getMonth() + 1) + ' – ' + sun.getDate() + '.' + (sun.getMonth() + 1); };

  K.V.schedule = function () {
    const wk = ui.week || K.thisWeek(), mon = K.parseYmd(wk), doc = D.weeks[wk], isNow = wk === K.thisWeek(), ti = K.todayIdx();
    const body = h('div', { class: 'page' });
    body.append(K.pageHead('Schedule', null, h('div', { class: 'phead-side' },
      h('p', { class: 'psub' }, range(mon) + (isNow ? ' · this week' : '')),
      h('div', { class: 'weeknav' },
        h('button', { class: 'icon-btn on-dark', type: 'button', 'aria-label': 'Previous week', onclick: () => { ui.week = K.ymd(K.addDays(mon, -7)); K.render(); } }, K.icon('back')),
        h('button', { class: 'btn small ghost-light', type: 'button', disabled: isNow, onclick: () => { ui.week = K.thisWeek(); K.render(); } }, 'This week'),
        h('button', { class: 'icon-btn on-dark', type: 'button', 'aria-label': 'Next week', onclick: () => { ui.week = K.ymd(K.addDays(mon, 7)); K.render(); } }, K.icon('next'))))));
    const w = h('div', { class: 'wrap schedule' });
    body.append(w);
    if (!doc) {
      w.append(h('div', { class: 'empty' }, h('strong', null, 'No schedule for this week yet'),
        K.me.admin ? h('div', { class: 'btns center' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => newWeekFrom(wk, true) }, 'Copy the week before'),
          h('button', { class: 'btn', type: 'button', onclick: () => newWeekFrom(wk, false) }, 'Start a blank week')) : 'The head chef has not posted it yet.'));
      w.append(legend());
      return { body: body };
    }
    const people = doc.people || [], me = K.getMe();

    /* my week */
    if (people.length) {
      const pick = K.select([['', 'Pick your name']].concat(people.map((id) => [id, K.personName(id)])), people.includes(me) ? me : '', (v) => { K.store.set('me', v); K.render(); }, { id: 'mesel', class: 'input' });
      const mine = h('section', { class: 'myweek card' }, h('div', { class: 'myweek-head' }, h('h2', { class: 'block-title' }, 'Your week'), h('label', { class: 'mepick' }, h('span', { class: 'sr' }, 'I am'), pick)));
      if (me && people.includes(me)) {
        const r = (doc.rows || {})[me] || [];
        mine.append(h('div', { class: 'mydays' }, K.DAYS.map((d, i) => {
          const c = r[i] || '', dd = K.addDays(mon, i);
          return h('div', { class: 'myday ' + K.codeClass(c) + (isNow && i === ti ? ' now' : '') },
            h('span', { class: 'myday-d' }, h('span', { class: 'daydot', style: { background: K.DAY_DOTS[i] }, 'aria-hidden': 'true' }), d, ' ', dd.getDate()),
            h('b', { class: 'mono' }, c || '–'), K.codeLabel(c) ? h('small', null, K.codeLabel(c)) : null);
        })));
      } else mine.append(h('p', { class: 'hint' }, 'Pick your name once and your shifts show here. This phone remembers it.'));
      w.append(mine);
    }

    /* the grid */
    const table = h('table', { class: 'rota' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, h('span', { class: 'sr' }, 'Person')), K.DAYS.map((d, i) => {
        const dd = K.addDays(mon, i);
        return h('th', { scope: 'col', class: isNow && i === ti ? 'now' : null }, h('span', { class: 'daydot', style: { background: K.DAY_DOTS[i] }, 'aria-hidden': 'true' }), h('span', null, d), h('small', null, dd.getDate() + '.' + (dd.getMonth() + 1)));
      }))),
      h('tbody', null, people.map((id) => {
        const r = (doc.rows || {})[id] || [], allOff = r.length && r.every((c) => ['0', 'X'].includes(String(c).trim().toUpperCase()));
        return h('tr', { class: (id === me ? 'me ' : '') + (allOff ? 'alloff' : '') },
          h('th', { scope: 'row' }, K.me.admin ? h('button', { class: 'pname', type: 'button', onclick: () => { ui.sheet = { type: 'row', wk: wk, id: id }; K.render(); } }, K.personName(id)) : K.personName(id)),
          K.DAYS.map((d, i) => {
            const c = r[i] || '', inner = h('span', { class: 'mono' }, c);
            return h('td', { class: K.codeClass(c) + (isNow && i === ti ? ' now' : '') },
              K.me.admin ? h('button', { type: 'button', 'aria-label': K.personName(id) + ', ' + d + ': ' + (c || 'empty'), onclick: () => { ui.sheet = { type: 'cell', wk: wk, id: id, i: i }; K.render(); } }, inner) : inner);
          }));
      })));
    w.append(h('div', { class: 'rota-wrap card' }, table));
    if (K.me.admin) w.append(h('p', { class: 'hint' }, 'Tap a cell to set a shift. Tap a name to rename, reorder or remove.'));
    if (K.me.admin) {
      const note = h('textarea', { class: 'input', id: 'wknote', rows: '2', value: doc.note || '', placeholder: 'e.g. Stock count Monday 10:00', onchange: (e) => { const b = K.clone(doc); b.note = e.target.value; b.updated = Date.now(); K.saveWeek(wk, b); } });
      w.append(K.field('Note for the team', note));
      const notIn = D.staff.people.filter((p) => !people.includes(p.id));
      w.append(h('div', { class: 'field' }, h('span', { class: 'legend' }, 'People this week'),
        h('div', { class: 'btns' }, notIn.map((p) => h('button', { class: 'btn small', type: 'button', onclick: () => { const b = K.clone(doc); b.people.push(p.id); b.rows[p.id] = EMPTY(); b.updated = Date.now(); K.saveWeek(wk, b); } }, K.icon('plus'), p.name)),
          h('button', { class: 'btn small', type: 'button', onclick: () => { ui.sheet = { type: 'person', wk: wk, name: '' }; K.render(); } }, K.icon('plus'), 'New person'))));
    } else if (doc.note) w.append(h('div', { class: 'banner' }, h('b', null, 'Note: '), doc.note));
    w.append(legend());
    return { body: body };
  };

  function legend() {
    const list = D.codes.codes || [];
    const box = h('section', { class: 'block codes-box' }, h('h2', { class: 'block-title' }, 'Shift codes'),
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
    const cur = ((doc.rows || {})[c.id] || [])[c.i] || '';
    const put = (v) => {
      const b = K.clone(doc);
      if (!b.rows[c.id]) b.rows[c.id] = EMPTY();
      b.rows[c.id][c.i] = v;
      b.updated = Date.now();
      ui.sheet = c.i < 6 ? { type: 'cell', wk: c.wk, id: c.id, i: c.i + 1 } : null;
      K.saveWeek(c.wk, b);
    };
    const codes = QUICK.concat((D.codes.codes || []).map((x) => x.code)).filter((v, i, a) => a.indexOf(v) === i);
    return K.sheet(K.personName(c.id) + ' · ' + K.DAYS[c.i] + ' ' + K.addDays(K.parseYmd(c.wk), c.i).getDate(), [
      h('div', { class: 'quick' }, codes.map((v) => h('button', { type: 'button', class: 'codechip big ' + K.codeClass(v) + (String(cur).toUpperCase() === v.toUpperCase() ? ' on' : ''), title: K.codeLabel(v) || null, onclick: () => put(v) }, h('b', { class: 'mono' }, v)))),
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
