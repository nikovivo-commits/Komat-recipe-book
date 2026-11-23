/* The physical count: walk the shelves and type what is really there. Hype's numbers are not shown while counting
   (a blind count is an honest one); each bottle is saved the moment it is typed, so a phone can be put down, and
   several phones can count at once. The count runs from "Start" to "Finish"; a bottle counted in between is done. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const C = () => (ui.count = ui.count || { n: {}, keep: {}, f: 'todo', kind: '', q: '' });
  const when = (t) => { const d = K.ymd(new Date(t)); return (d === K.day(0) ? 'today' : d === K.day(-1) ? 'yesterday' : K.prettyDate(d, { day: 'numeric', month: 'short' })) + ' ' + K.hm(t); };
  const mins = (t) => Math.max(0, Math.round((Date.now() - t) / 60000));
  const ago = (t) => { const m = mins(t); return m < 60 ? m + ' min ago' : m < 48 * 60 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' days ago'; };
  const title = (w) => (w.stockOnly ? w.name : K.wineTitle(w));
  /* "2,5" and "2.5" are both two and a half; anything else is not a number of bottles */
  const num = (v) => { const t = String(v == null ? '' : v).trim().replace(',', '.'); return /^\d+(\.\d+)?$/.test(t) ? Math.round(parseFloat(t) * 10) / 10 : null; };

  K.V.count = function () {
    const top = K.subbar('Stock', () => K.back('stock'), null, 'Physical count');
    const body = h('div', { class: 'wrap page count-page' });
    if (!D.winesLoaded) { body.append(K.loadingBox('Loading the bottles')); return { top: top, body: body, tabs: false }; }
    const take = K.takeOn();
    if (!take) start(body); else running(body, take);
    return { top: top, body: body, tabs: false };
  };

  /* ---------- before the count ---------- */
  function start(body) {
    const all = K.takeList(), last = D.take && D.take.done ? D.take : null, hs = D.hypeStock, t = hs ? hs.exported || hs.at : 0;
    const stale = t && mins(t) > 30;
    const refresh = () => { ui.hypeBusy = true; K.render(); K.refreshHype().then(() => { ui.hypeBusy = false; K.render(); K.toast('Stock refreshed from the sheet'); }, () => { ui.hypeBusy = false; K.render(); K.toast('The sheet could not be read.', { tone: 'bad' }); }); };
    body.append(h('section', { class: 'ct-start' },
      h('h1', { class: 'ct-h1' }, 'Count what is really on the shelf'),
      h('p', { class: 'muted' }, 'The list is your drinks menu: ' + all.length + ' bottles and drinks. A bottle on the shelf that is not on it, you add as you go. Each number is saved as you type it, and several phones can count at the same time.'),
      last ? h('p', { class: 'hint' }, 'The last count ended ' + when(last.done) + (last.endName ? ' · ' + last.endName : '') + '. ',
        h('button', { type: 'button', class: 'linkish', onclick: () => { ui.sheet = { type: 'diffs' }; K.render(); } }, 'See what it found')) : null,
      h('ol', { class: 'ct-steps' },
        h('li', null, h('b', null, 'Count while the bar is closed.'), ' A bottle sold in the middle of the count makes the numbers wrong.'),
        h('li', null, h('b', null, 'Get a fresh read of Hype first.'), ' Ask for it on the restaurant computer, then press Refresh.',
          hs ? h('div', { class: 'ct-hype' + (stale ? ' old' : '') },
            h('span', null, 'Hype was read ' + when(t) + ' · ' + ago(t) + (stale ? '. Anything sold since then will be taken off twice.' : '. Fresh enough.')),
            D.hypeUrl ? h('button', { type: 'button', class: 'btn small', disabled: ui.hypeBusy ? true : null, onclick: refresh }, ui.hypeBusy ? 'Reading…' : 'Refresh stock') : null)
            : h('div', { class: 'ct-hype' }, h('span', null, 'The Hype sheet is not connected. The count still works; sales are then taken off by hand.'))),
        h('li', null, h('b', null, 'Count every place a bottle is kept:'), ' the bar, the cellar, the kitchen. One number for all of it.'),
        h('li', null, h('b', null, 'An open bottle counts as a part:'), ' two full ones and a half-full one is 2.5. The pad has a “+ half” key for it.')),
      K.canEdit() ? h('button', { class: 'btn primary wide big', type: 'button', onclick: () => { ui.count = null; K.startTake(); } }, 'Start the count')
        : h('p', { class: 'banner' }, 'The owner or a floor manager starts the count. Once it is started, you can count here.')));
  }

  /* ---------- while it runs ---------- */
  function hay(w) { return [title(w), w.producer, w.hype, w.grapes, w.style, K.COL[w.colour]].join(' '); }
  function resText(w, take) {
    const c = D.cellar[w.id];
    if (!K.countedIn(w, take)) return '';
    const d = c.was == null ? null : Math.round((c.n - c.was) * 10) / 10;
    return 'Counted ' + c.n + (c.name ? ' · ' + c.name : '') + (d == null ? '' : d === 0 ? ' · as expected' : ' · the book said ' + K.qtyText(c.was) + ' (' + (d > 0 ? '+' : '−') + Math.abs(d) + ')');
  }
  function progress(take) {
    const all = K.takeList(), done = all.filter((w) => K.countedIn(w, take)).length;
    return { all: all.length, done: done, pct: all.length ? Math.round((done / all.length) * 100) : 0 };
  }
  function running(body, take) {
    const S = C(), all = K.takeList(), p = progress(take);
    const finish = () => { ui.sheet = { type: 'takeend' }; K.render(); };
    /* the progress and the search stay in view together, one under the other */
    body.append(h('div', { class: 'ct-sticky' },
      h('section', { class: 'ct-prog', id: 'ct-prog', role: 'status' },
        h('b', { id: 'ct-done' }, p.done + ' of ' + p.all + ' counted'),
        h('span', { class: 'ct-prog-btns' },
          h('button', { type: 'button', class: 'icon-btn ct-find', 'aria-label': 'Search a bottle', onclick: () => { hidePad(); const el = document.getElementById('cq'); if (el) el.focus(); } }, K.icon('search')),
          K.canEdit() ? h('button', { type: 'button', class: 'btn small', onclick: finish }, 'Finish') : null),
        h('div', { class: 'ct-bar', 'aria-hidden': 'true' }, h('span', { id: 'ct-fill', style: 'width:' + p.pct + '%' }))),
      K.searchBox('cq', S.q, 'Search a bottle', (v) => { S.q = v; S.keep = {}; K.render(); })));
    body.append(h('p', { class: 'muted ct-since' }, 'Started ' + when(take.at) + (take.name ? ' by ' + take.name : '') + '. Search in English or Bulgarian.'));
    const todo = all.filter((w) => !K.countedIn(w, take)).length;
    body.append(h('div', { class: 'chips filters' },
      K.seg([['todo', 'To count · ' + todo], ['done', 'Counted · ' + (all.length - todo)], ['', 'All']], S.f, (v) => { S.f = v; S.keep = {}; K.render(); }, { class: 'seg small-seg', 'aria-label': 'Show' })));
    const kinds = K.COLOURS.filter((c) => all.some((w) => w.colour === c[0]));
    body.append(h('div', { class: 'chips ct-kinds', role: 'group', 'aria-label': 'Kind' },
      [['', 'Everything']].concat(kinds).map((c) => h('button', { type: 'button', class: 'chip', 'aria-pressed': S.kind === c[0] ? 'true' : 'false', onclick: () => { S.kind = c[0]; S.keep = {}; K.render(); } }, c[1]))));
    /* a bottle just counted stays where it is until the list is filtered again, so nothing jumps under the finger */
    const list = all.filter((w) => (!S.kind || w.colour === S.kind) && K.matches(hay(w), S.q)
      && (S.f === 'todo' ? !K.countedIn(w, take) || S.keep[w.id] : S.f === 'done' ? K.countedIn(w, take) : true));
    if (S.active && !list.some((w) => w.id === S.active)) S.active = null;
    body.classList.toggle('pad-on', !!S.active);
    if (!list.length) {
      body.append(h('div', { class: 'empty' }, h('strong', null, S.q ? 'No bottle like that' : S.f === 'todo' ? 'Everything here is counted' : 'Nothing counted yet'),
        S.q ? (K.canEdit() ? 'Try the other language. If Hype knows it, it shows below.' : 'Try the other language. If it is not on the list, tell the manager: they can add it.') : S.f === 'todo' ? 'Look at another kind, or finish the count.' : 'Type a number next to a bottle.'));
    }
    const by = {};
    list.forEach((w) => { (by[w.colour] = by[w.colour] || []).push(w); });
    K.COLOURS.forEach((c) => {
      if (!by[c[0]]) return;
      const rows = by[c[0]].slice().sort((a, b) => title(a).localeCompare(title(b)));
      body.append(h('section', { class: 'group' }, h('h2', { class: 'group-title' }, c[1], h('span', { class: 'n' }, String(rows.length))),
        h('div', { class: 'ct-list' }, rows.map((w) => row(w, take)))));
    });
    /* searched for something the menu does not have: Hype may know it, one tap puts it on the count */
    const off = S.q.trim().length >= 2 && K.canEdit() ? K.hypeOffList(S.q).slice(0, 8) : [];
    if (off.length) {
      body.append(h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'In Hype, not on the menu', h('span', { class: 'n' }, String(off.length))),
        h('p', { class: 'hint' }, 'Is it on the shelf? Add it and count it.'),
        h('div', { class: 'ct-list' }, off.map((r) => h('button', { type: 'button', class: 'ct-off', onclick: () => {
          const id = K.countExtra(r);
          S.keep[id] = true; S.f = 'todo'; K.render();
          const el = document.getElementById('ct-' + id);
          if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
        } }, h('span', { class: 'ct-txt' }, h('b', null, r.name), h('span', { class: 'muted' }, [r.cat, r.wh].filter(Boolean).join(' · '))), h('span', { class: 'ct-add' }, K.icon('plus'), 'Add'))))));
    }
    body.append(h('div', { class: 'ct-foot' },
      K.canEdit() ? h('button', { type: 'button', class: 'btn wide', onclick: () => { ui.sheet = { type: 'takeadd', f: { name: S.q || '', colour: S.kind || 'red', n: '' } }; K.render(); } }, K.icon('plus'), 'A bottle that is in no list at all') : null,
      K.canEdit() ? h('button', { type: 'button', class: 'btn primary wide', onclick: finish }, 'Finish the count') : h('p', { class: 'hint' }, 'The owner or a floor manager finishes the count.')));
    if (K.canWrite()) body.append(pad());
  }

  /* ---------- the number pad: big keys under the thumb, so the phone's own keyboard never opens ---------- */
  const saver = {};   /* how to save each row on the page, by bottle id */
  const field = () => (C().active ? document.getElementById('ct-' + C().active) : null);
  function activate(id) {
    const S = C();
    const p0 = document.getElementById('ct-pad');
    if (!p0 || (S.active === id && !p0.hidden)) return;
    S.active = id;
    document.querySelectorAll('.ct-row.active').forEach((r) => r.classList.remove('active'));
    const r = document.getElementById('ctr-' + id), w = K.wine(id), p = document.getElementById('ct-pad');
    if (r) r.classList.add('active');
    if (p) { p.hidden = false; const nm = document.getElementById('ct-pad-name'); if (nm) nm.textContent = w ? title(w) : ''; }
    const page = document.querySelector('.count-page');
    if (page) page.classList.add('pad-on');
    /* the row sits in the gap between the progress strip and the pad */
    if (r) { const y = r.getBoundingClientRect().top; if (y < 150 || y > window.innerHeight - 470) window.scrollTo({ top: Math.max(0, window.scrollY + y - 170) }); }
  }
  function hidePad() {
    const S = C(), p = document.getElementById('ct-pad'), page = document.querySelector('.count-page'), el = field();
    S.active = null;
    document.querySelectorAll('.ct-row.active').forEach((r) => r.classList.remove('active'));
    if (p) p.hidden = true;
    if (page) page.classList.remove('pad-on');
    if (el) el.blur();
  }
  function setValue(v) {
    const S = C(), el = field();
    if (!el) return;
    el.value = v; S.n[S.active] = v; el.classList.remove('bad');
    el.focus({ preventScroll: true });
  }
  function press(k) {
    const el = field();
    if (!el) return;
    const v = String(el.value || '');
    if (k === 'back') setValue(v.slice(0, -1));
    else if (k === '.') { if (!v.includes('.') && !v.includes(',')) setValue((v || '0') + '.'); }
    else if (k === 'half') { const n = num(v.replace(/[.,]$/, '')) || 0; setValue(String(Math.round((n + 0.5) * 10) / 10)); }
    else if (k === 'none') { setValue('0'); next(); }
    else if (v.replace(/\D/g, '').length < 5) setValue(v === '0' ? k : v + k);
  }
  /* save what is typed (an empty box is skipped) and go to the next bottle on the page */
  function next() {
    const S = C(), el = field();
    if (!el) return;
    if (String(el.value).trim() !== '' && saver[S.active]) saver[S.active](el);
    if (el.classList.contains('bad')) return;
    const ins = Array.from(document.querySelectorAll('.ct-in')), nx = ins[ins.indexOf(el) + 1];
    if (nx) nx.focus(); else { hidePad(); K.toast('That was the last one here. Look at another kind, or finish the count.'); }
  }
  function pad() {
    const S = C(), w = S.active ? K.wine(S.active) : null;
    const key = (label, k, attrs) => h('button', Object.assign({ type: 'button', class: 'ct-key', onpointerdown: (e) => e.preventDefault(), onclick: () => press(k) }, attrs || {}), label);
    return h('div', { class: 'ct-pad', id: 'ct-pad', hidden: w ? null : true },
      h('div', { class: 'ct-pad-top' },
        h('span', { class: 'ct-pad-name', id: 'ct-pad-name' }, w ? title(w) : ''),
        h('button', { type: 'button', class: 'ct-quick', onpointerdown: (e) => e.preventDefault(), onclick: () => press('none') }, 'None'),
        h('button', { type: 'button', class: 'ct-quick', onpointerdown: (e) => e.preventDefault(), onclick: () => press('half') }, '+ half'),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Hide the number pad', onclick: hidePad }, K.icon('down'))),
      h('div', { class: 'ct-keys', role: 'group', 'aria-label': 'Number pad' },
        ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => key(d, d)),
        key('.', '.', { 'aria-label': 'Decimal point' }), key('0', '0'), key(K.icon('backspace'), 'back', { 'aria-label': 'Delete the last digit' })),
      h('button', { type: 'button', class: 'btn primary ct-next', onpointerdown: (e) => e.preventDefault(), onclick: next }, 'Save and next bottle', K.icon('next')));
  }
  function row(w, take) {
    const S = C(), c = D.cellar[w.id], done = K.countedIn(w, take), hr = K.hypeRow(w);
    const sub = [w.stockOnly ? w.style : w.producer, !w.stockOnly && w.hype ? w.hype : '', hr && hr.unit === 'L' ? 'bottles of ' + K.bottleL(w) + ' L' : ''].filter(Boolean).join(' · ');
    const save = (el) => {
      const raw = String(el.value).trim();
      if (raw === '' || (done && S.n[w.id] == null)) return;
      const v = num(raw);
      if (v == null) { el.classList.add('bad'); K.toast('Write a number of bottles, like 3 or 2.5.', { tone: 'bad' }); return; }
      el.classList.remove('bad');
      if (K.countedIn(w, take) && D.cellar[w.id].n === v) { delete S.n[w.id]; return; }
      delete S.n[w.id]; S.keep[w.id] = true;
      K.countBottles(w, v, true);
      /* this row and the progress change in place: a redraw would close the keyboard */
      const r = document.getElementById('ctr-' + w.id);
      if (r) { r.classList.add('done'); const t = r.querySelector('.ct-res'); if (t) t.textContent = K.T(resText(w, take)); }
      const p = progress(take), dn = document.getElementById('ct-done'), fl = document.getElementById('ct-fill');
      if (dn) dn.textContent = K.T(p.done + ' of ' + p.all + ' counted');
      if (fl) fl.style.width = p.pct + '%';
    };
    saver[w.id] = save;
    const input = h('input', { class: 'input mono ct-in', id: 'ct-' + w.id, inputmode: 'none', enterkeyhint: 'next', autocomplete: 'off', placeholder: '–', onfocus: () => activate(w.id),
      'aria-label': 'Bottles of ' + title(w), value: S.n[w.id] != null ? S.n[w.id] : done ? String(c.n) : '', disabled: K.canWrite() ? null : true,
      oninput: (e) => { S.n[w.id] = e.target.value; e.target.classList.remove('bad'); }, onchange: (e) => save(e.target),
      /* Enter goes to the next bottle, like a till */
      onkeydown: (e) => { if (e.key !== 'Enter') return; e.preventDefault(); const ins = Array.from(document.querySelectorAll('.ct-in')), nx = ins[ins.indexOf(e.target) + 1]; if (nx) nx.focus(); else e.target.blur(); } });
    return h('div', { class: 'ct-row' + (done ? ' done' : '') + (S.active === w.id ? ' active' : ''), id: 'ctr-' + w.id },
      h('label', { class: 'ct-txt', for: 'ct-' + w.id }, h('b', null, title(w)), sub ? h('span', { class: 'muted' }, sub) : null, h('span', { class: 'ct-res' }, resText(w, take))),
      h('span', { class: 'ct-tick', 'aria-hidden': 'true' }, K.icon('check')), input);
  }

  /* something on the shelf that no list knows: it joins the stock and is counted straight away */
  K.SHEETS.takeadd = function (S) {
    const f = S.f, kinds = K.COLOURS.filter((c) => c[0] !== 'hot');
    const save = (e) => {
      e.preventDefault();
      const name = String(f.name).trim(), v = num(f.n);
      if (!name) { K.toast('Write what it is.', { tone: 'bad' }); return; }
      if (v == null) { K.toast('Write how many there are, like 3 or 2.5.', { tone: 'bad' }); return; }
      K.saveWine({ name: name, colour: f.colour, stockOnly: true, extra: true, par: 0, order: 950, byGlass: false, label: '' }).then((id) => {
        const w = K.wine(id);
        if (w) { C().keep[id] = true; K.countBottles(w, v); }
        K.toast(name + ' added and counted: ' + v);
      });
      ui.sheet = null; K.render();
    };
    return K.sheet('Not in the list', h('form', { class: 'stack', onsubmit: save },
      h('p', { class: 'hint' }, 'Search first, in English and in Bulgarian. The search also shows what Hype knows, to add with one tap. If the bottle is nowhere, add it here.'),
      K.field('What is it', h('input', { class: 'input', id: 'ta-name', value: f.name, placeholder: 'Name on the bottle', oninput: (e) => { f.name = e.target.value; } })),
      K.field('Kind', K.select(kinds, f.colour, (v) => { f.colour = v; }, { 'aria-label': 'Kind' })),
      K.field('How many are there', h('input', { class: 'input mono', id: 'ta-n', inputmode: 'decimal', value: f.n, placeholder: '–', oninput: (e) => { f.n = e.target.value; } }), 'An open bottle counts as a part: 2.5.'),
      h('button', { class: 'btn primary wide', type: 'submit' }, 'Add and count')));
  };

  /* closing the count: what nobody found is either not on the shelf, or was simply skipped */
  K.SHEETS.takeend = function () {
    const take = K.takeOn();
    if (!take) return null;
    const p = progress(take), rest = p.all - p.done;
    const end = (zero) => {
      ui.sheet = null; ui.count = null;
      K.endTake(zero).then((n) => K.toast('The count is finished' + (n ? ' · ' + n + ' set to 0' : '')));
      K.go('stock');
      ui.sheet = { type: 'diffs' }; K.render();
    };
    return K.sheet('Finish the count', h('div', { class: 'stack' },
      h('p', null, h('b', null, p.done + ' of ' + p.all + ' counted. '), rest ? rest + ' were not counted.' : 'Nothing was left out.'),
      rest ? h('div', { class: 'stack' },
        h('p', { class: 'hint' }, 'If you walked every shelf, what is left on the list was not there.'),
        h('button', { class: 'btn primary wide wrap-btn', type: 'button', onclick: () => end(true) }, 'Not on the shelf: set those ' + rest + ' to 0'),
        h('button', { class: 'btn wide wrap-btn', type: 'button', onclick: () => end(false) }, 'Leave those ' + rest + ' as they are'))
        : h('button', { class: 'btn primary wide', type: 'button', onclick: () => end(false) }, 'Finish the count'),
      h('button', { class: 'btn wide', type: 'button', onclick: () => { ui.sheet = null; K.render(); } }, 'Keep counting')));
  };
})();
