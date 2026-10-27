/* Recipe book: list and search, recipe and component pages, scaling, cook mode. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;

  /* ---------- list ---------- */
  function tally() {
    const d = D.recipes.filter((r) => r.type === 'dish').length, r = D.recipes.length - d, out = [];
    if (d) out.push(d + (d === 1 ? ' dish' : ' dishes'));
    if (r) out.push(r + (r === 1 ? ' recipe' : ' recipes'));
    return out.join(' · ');
  }
  const countIn = (c) => D.recipes.filter((r) => r.category === c).length;
  /* adding lives in Settings and in empty folders, so the list stays clear for searching */
  K.openAdd = function (cat) { ui.sheet = { type: 'add', cat: cat || '' }; K.render(); };
  K.SHEETS.add = function (S) {
    const pick = (fn) => () => { ui.sheet = null; fn(); };
    return K.sheet('Add to the book', h('div', { class: 'settings' },
      K.sample ? h('button', { class: 'set-link', type: 'button', onclick: pick(() => K.scanNew(S.cat)) }, K.icon('camera'),
        h('span', null, h('b', null, 'Scan a recipe sheet'), h('span', { class: 'muted' }, 'Take a photo; Claude types it up for you to check')), K.icon('next')) : null,
      h('button', { class: 'set-link', type: 'button', onclick: pick(() => K.startEdit(null, S.cat, 'dish')) }, K.icon('chef'),
        h('span', null, h('b', null, 'New dish'), h('span', { class: 'muted' }, 'A plate on the menu, built from several recipes')), K.icon('next')),
      h('button', { class: 'set-link', type: 'button', onclick: pick(() => K.startEdit(null, S.cat, 'recipe')) }, K.icon('note'),
        h('span', null, h('b', null, 'New recipe'), h('span', { class: 'muted' }, 'One prep: a sauce, a dough, a stock')), K.icon('next'))));
  };
  const addBtn = (cat) => h('div', { class: 'btns center' }, h('button', { class: 'btn primary', type: 'button', onclick: () => K.openAdd(cat) }, K.icon('plus'), 'Add a recipe'));

  K.V.recipes = function () {
    const body = h('div', { class: 'page' });
    const src = K.pagePhoto('recipes');
    body.append(h('section', { class: 'hero photo slim' + (src ? '' : ' speckle') }, K.photoLayer(src), K.rays('ph-rays'),
      h('div', { class: 'wrap hero-in' },
        h('h1', { class: 'hero-title' }, 'What are we ', h('em', null, 'cooking'), '?'),
        D.recipes.length ? h('p', { class: 'hero-sub' }, tally()) : null)));
    const w = h('div', { class: 'wrap' });
    body.append(w);
    const q = h('input', {
      class: 'search-in', id: 'q', type: 'search', placeholder: 'Search a dish, prep or ingredient', 'aria-label': 'Search recipes', value: ui.q,
      autocomplete: 'off', autocapitalize: 'off', spellcheck: false, enterkeyhint: 'search',
      oninput: (e) => { ui.q = e.target.value; results(); },
      onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); },
    });
    /* the search rides along under the header, so it is always one tap away */
    w.append(h('div', { class: 'search-dock', id: 'sdock' }, h('div', { class: 'search' }, K.icon('search'), q,
      ui.q ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Clear search', onclick: () => { ui.q = ''; K.render(); const el = document.getElementById('q'); if (el) el.focus(); } }, K.icon('close')) : null)));
    if (D.loaded && D.recipes.length) {
      const fs = K.folders().filter((c) => countIn(c) > 0 || ui.cat === c);
      w.append(h('div', { class: 'chips', role: 'group', 'aria-label': 'Folder' },
        [['', 'All', D.recipes.length]].concat(fs.map((c) => [c, c, countIn(c)])).map((c) =>
          h('button', { class: 'chip', type: 'button', 'aria-pressed': ui.cat === c[0] ? 'true' : 'false', onclick: () => { ui.cat = c[0]; K.render(); } }, c[1], h('span', { class: 'cn' }, String(c[2]))))));
      w.append(h('div', { class: 'chips filters' },
        K.seg([['', 'Everything'], ['dish', 'Dishes'], ['recipe', 'Recipes']], ui.type, (v) => { ui.type = v; K.render(); }, { 'aria-label': 'Show', class: 'seg small-seg' }),
        h('button', { type: 'button', class: 'chip', 'aria-pressed': ui.onMenu ? 'true' : 'false', onclick: () => { ui.onMenu = !ui.onMenu; K.render(); } }, 'On the menu')));
    }
    w.append(h('div', { id: 'results' }));
    return { body: body, after: () => { results(); dockState(); if (ui.focusSearch) { ui.focusSearch = false; const el = document.getElementById('q'); if (el) el.focus(); } } };
  };
  /* a soft backdrop behind the search once it sticks under the header */
  function dockState() {
    const d = document.getElementById('sdock'), top = document.querySelector('.top');
    if (d && top) d.classList.toggle('stuck', d.getBoundingClientRect().top <= top.getBoundingClientRect().bottom + 1);
  }
  window.addEventListener('scroll', dockState, { passive: true });
  /* tapping Recipes again jumps straight into the search */
  K.focusSearch = function () {
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const el = document.getElementById('q');
    if (el) el.focus({ preventScroll: true });
  };

  function hay(r, c) {
    if (c) return (c.name + ' ' + c.ingredients.map((i) => i.n).join(' ') + ' ' + (c._alt || '')).toLowerCase();
    return (r.name + ' ' + r.category + ' ' + r.ingredients.map((i) => i.n).join(' ') + ' ' + r.components.map((x) => x.name + ' ' + x.ingredients.map((i) => i.n).join(' ')).join(' ') + ' ' + (r._alt || '')).toLowerCase();
  }
  function matchesQ(text, q) { return text.includes(q) || (/[a-z]/.test(q) && K.latin(text).includes(q)); }
  /* the first ingredient that matched, to show why a result is here */
  function whyMatch(r, c, q) {
    const nm = (c ? c.name : r.name).toLowerCase();
    if (matchesQ(nm, q)) return '';
    const lists = c ? [c.ingredients] : K.allIngLists(r);
    for (const l of lists) for (const i of l) { const t = (i.n + ' ' + (i.o || '') + ' ' + K.tx(i.n)).toLowerCase(); if (matchesQ(t, q)) return i.n; }
    if (!c) for (const x of r.components) if (matchesQ(x.name.toLowerCase(), q)) return x.name;
    return '';
  }
  function entries() {
    const q = ui.q.trim().toLowerCase(), out = [], showComps = !!q || ui.type === 'recipe';
    D.recipes.forEach((r) => {
      out.push({ r: r, ci: -1, name: r.name, type: r.type });
      if (showComps) r.components.forEach((c, i) => out.push({ r: r, ci: i, c: c, name: c.name, type: 'recipe' }));
    });
    return out.filter((en) => {
      if (ui.cat && en.r.category !== ui.cat) return false;
      if (ui.type && en.type !== ui.type) return false;
      if (ui.onMenu && en.r.onMenu === false) return false;
      if (!q) return true;
      return matchesQ(hay(en.r, en.c), q);
    }).sort((a, b) => {
      if (q) {
        const rank = (x) => { const n = x.name.toLowerCase(); return n.startsWith(q) ? 0 : n.includes(q) ? 1 : 2; };
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
      }
      return a.name.localeCompare(b.name);
    });
  }
  const TINTS = 6;
  function tint(s) { let x = 0; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return 't' + (x % TINTS); }
  /* an illustration for a recipe that has no photo yet (a real photo always wins) */
  K.artFor = (r) => (r && !r.photo && (window.KOMAT_ART || []).includes(r.id) ? 'assets/photos/art/' + r.id + '.jpg' : '');
  K.artSrc = (r) => (r && (window.KOMAT_ART_SRC || {})[r.id]) || '';
  /* the parts of a dish have their own illustrations (assets/photos/art/parts/<part id>.jpg) */
  K.partArt = (r, ci) => { const c = r && r.components[ci]; return c && c.cid && (window.KOMAT_PART_ART || []).includes(c.cid) ? 'assets/photos/art/parts/' + c.cid + '.jpg' : ''; };
  function thumb(r, name) {
    const letter = () => h('div', { class: 'thumb ph ' + tint((r && r.category) || name), 'aria-hidden': 'true' }, (name || '?').charAt(0).toUpperCase());
    const ph = r && (r.photo || (r.gallery[0] && r.gallery[0].id));
    const src = ph ? K.media(ph) : K.artFor(r);
    return src ? K.photoWithFallback(src, ph ? '' : K.artSrc(r), letter(), { class: 'thumb', alt: '', loading: 'lazy', decoding: 'async' }) : letter();
  }
  function card(en, q) {
    const r = en.r, c = en.c, why = q ? whyMatch(r, c, q) : '';
    const part = c || r, isDish = !c && r.type === 'dish';
    return h('button', { class: 'rcard', type: 'button', onclick: () => K.go('recipe', { id: r.id, comp: en.ci }) },
      c ? thumb(null, c.name) : thumb(r, r.name),
      h('div', { class: 'card-txt' },
        h('span', { class: 'kicker' + (isDish ? ' dish' : '') }, isDish ? 'Dish' : 'Recipe'),
        h('span', { class: 'card-name' }, part.name),
        h('span', { class: 'card-meta' },
          part.yieldQty ? h('span', null, K.yieldText(part.yieldQty, part.yieldUnit)) : null,
          isDish && r.components.length ? h('span', null, r.components.length + (r.components.length === 1 ? ' part' : ' parts')) : part.ingredients.length ? h('span', null, part.ingredients.length + ' ingredients') : null,
          K.stationOf(r, c) && K.ST[K.stationOf(r, c)] ? h('span', null, K.ST[K.stationOf(r, c)]) : null),
        c ? h('span', { class: 'card-in' }, 'In ' + r.name) : null,
        why ? h('span', { class: 'card-why' }, 'Has ' + why) : null,
        !c && (r.onMenu === false || r.videos.length) ? h('span', { class: 'card-pills' },
          r.onMenu === false ? h('span', { class: 'pill muted' }, 'Off the menu') : null,
          r.videos.length ? h('span', { class: 'pill' }, K.icon('play'), 'Plating video') : null) : null));
  }
  function results() {
    const box = document.getElementById('results');
    if (!box) return;
    box.textContent = '';
    if (!D.loaded) { box.append(h('div', { class: 'empty' }, h('strong', null, 'Loading recipes'), 'One moment.')); return; }
    if (!D.recipes.length) {
      /* a brand-new kitchen database: bring the book in from a backup, or start from the recipes built into the app */
      if (K.mode === 'firebase' && K.me.admin) {
        box.append(K.catRest('The book is ready for its recipes', 'Load the backup from the Claude version to bring everything across, or start with the recipes built into the app.',
          h('div', { class: 'btns center' },
            h('button', { class: 'btn primary', type: 'button', disabled: !!ui.backupBusy, onclick: () => K.importBackup() }, K.icon('upload'), ui.backupBusy ? 'Loading…' : 'Load a backup'),
            h('button', { class: 'btn', type: 'button', disabled: !!ui.backupBusy, onclick: () => {
              ui.backupBusy = true; K.render();
              K.db.importAll(K.seedDocs(), { keep: true }).then(() => { ui.backupBusy = false; K.render(); K.toast('The built-in recipes are in'); }, (e) => { ui.backupBusy = false; K.render(); K.writeFailed(e); });
            } }, 'Start with the built-in recipes'))));
        return;
      }
      box.append(K.catRest('The book is ready for its first recipe', K.me.admin ? 'Add a dish, a prep, or scan a recipe sheet.' : 'Recipes appear here as soon as the head chef adds them.',
        K.me.admin ? addBtn('') : null));
      return;
    }
    const q = ui.q.trim().toLowerCase(), list = entries();
    if (!list.length) {
      box.append(h('div', { class: 'empty' }, h('strong', null, q ? 'Nothing called “' + ui.q.trim() + '” yet' : 'This folder is empty'),
        q ? 'Try a shorter word or an ingredient. Latin letters work too, like "gyozi".' : 'Pick another folder above.'));
      return;
    }
    if (q) {
      box.append(h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'Results', h('span', { class: 'n' }, String(list.length))), h('div', { class: 'grid' }, list.map((en) => card(en, q)))));
      return;
    }
    if (!ui.cat && !ui.type && !ui.onMenu) {
      const dd = dishOfDay();
      if (dd) box.append(dd);
      const rec = K.recent().map(K.find).filter(Boolean).slice(0, 6);
      if (rec.length) box.append(h('section', { class: 'group recent' }, h('h2', { class: 'group-title' }, 'Opened lately'),
        h('div', { class: 'strip' }, rec.map((r) => h('button', { type: 'button', class: 'mini', onclick: () => K.go('recipe', { id: r.id }) }, thumb(r, r.name), h('span', null, r.name))))));
    }
    const groups = {};
    list.forEach((en) => { const k = en.r.category || 'Other'; (groups[k] = groups[k] || []).push(en); });
    Object.keys(groups).sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b))).forEach((k) => {
      box.append(h('section', { class: 'group' }, h('h2', { class: 'group-title' }, k, h('span', { class: 'n' }, String(groups[k].length))), h('div', { class: 'grid' }, groups[k].map((en) => card(en, '')))));
    });
  }

  /* one dish a day at the top of the book: a dish on the menu, one with a real plating photo first */
  function dishOfDay() {
    const menu = D.recipes.filter((r) => r.type === 'dish' && r.onMenu !== false), real = menu.filter((r) => r.photo);
    const pool = real.length ? real : menu.filter((r) => K.artFor(r));
    if (!pool.length) return null;
    const r = pool[Math.floor(K.parseYmd(K.day(0)).getTime() / 864e5) % pool.length], P = parts(r);
    const cookable = P.comps.some((c) => c.steps.length) || P.main.steps.length;
    const src = r.photo ? K.media(r.photo) : K.artFor(r);
    const chips = [K.ST[r.station], r.yieldQty ? K.yieldText(r.yieldQty, r.yieldUnit) : '', r.components.length > 1 ? r.components.length + ' parts' : ''].filter(Boolean);
    return h('section', { class: 'dotd-wrap', 'aria-label': 'Dish of the day' },
      h('div', { class: 'dotd-kick' }, h('span', null, 'Dish of the day'), h('span', { class: 'mono' }, K.parseYmd(K.day(0)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))),
      h('article', { class: 'dotd' },
        K.photoWithFallback(src, r.photo ? K.artFor(r) : '', (im) => im.remove(), { class: 'dotd-img', alt: (r.photo ? 'Plated ' : 'Illustration of ') + r.name }),
        h('div', { class: 'dotd-shade', 'aria-hidden': 'true' }), K.rays('dotd-rays'),
        r.photo ? null : h('span', { class: 'art-tag dotd-tag' }, 'Illustration, not our plating'),
        h('div', { class: 'dotd-in' },
          chips.length ? h('div', { class: 'dotd-chips' }, chips.map((c) => h('span', null, c))) : null,
          h('h2', { class: 'dotd-title' }, r.name),
          h('div', { class: 'dotd-btns' },
            h('button', { class: 'btn dotd-open', type: 'button', onclick: () => K.go('recipe', { id: r.id }) }, 'Open recipe'),
            cookable ? h('button', { class: 'btn primary', type: 'button', onclick: () => { K.go('recipe', { id: r.id }); K.openCook(r.id); } }, K.icon('cook'), 'Cook') : null))));
  }

  /* ---------- scaling ---------- */
  const factor = (part) => { const f = ui.factors[part.key]; return f > 0 ? f : 1; };
  function setFactor(part, f, from) {
    ui.factors[part.key] = f > 0 ? f : 1;
    if (from) ui.scaleFrom[part.key] = from; else delete ui.scaleFrom[part.key];
  }
  function scaleNote(part) {
    const f = factor(part), fr = ui.scaleFrom[part.key], b = parseFloat(part.yieldQty);
    if (Math.abs(f - 1) < 0.0005) return '';
    return 'Scaled ×' + K.fmtNum(f) + (fr ? ' because you have ' + fr : '') + (b > 0 ? ' · original yield ' + K.fmtNum(b) + ' ' + part.yieldUnit : '');
  }
  /* redraw one part's numbers in place, so typing in the yield box keeps the keyboard up */
  function updateScaled(part) {
    const box = document.getElementById('ings-' + part.key);
    if (box) box.replaceWith(ingList(part));
    const n = document.getElementById('snote-' + part.key);
    if (n) n.textContent = scaleNote(part);
    document.querySelectorAll('.preset[data-p="' + part.key + '"]').forEach((b) => b.setAttribute('aria-pressed', Math.abs(factor(part) - parseFloat(b.dataset.k)) < 0.0005 ? 'true' : 'false'));
    const y = document.getElementById('yin-' + part.key), base = parseFloat(part.yieldQty);
    if (y && document.activeElement !== y && base > 0) y.value = K.fmtNum(base * factor(part));
    const m = document.getElementById('mul-' + part.key);
    if (m && document.activeElement !== m) m.value = K.fmtNum(factor(part));
  }
  function scaler(part, compact) {
    const base = parseFloat(part.yieldQty);
    if (!(base > 0) && !part.ingredients.length) return null;
    const f = factor(part);
    return h('section', { class: 'scaler' + (compact ? ' compact' : ''), 'aria-label': 'Scale ' + (part.name || 'recipe') },
      h('div', { class: 'sc-row' },
        base > 0 ? h('label', { class: 'sc-yield' }, h('span', { class: 'label' }, 'Make'),
          h('input', {
            class: 'sc-in mono', id: 'yin-' + part.key, type: 'number', inputmode: 'decimal', step: 'any', min: '0', 'aria-label': 'Amount to make, in ' + part.yieldUnit, value: K.fmtNum(base * f),
            oninput: (e) => { const t = parseFloat(e.target.value); if (t > 0) { setFactor(part, t / base); updateScaled(part); } },
          }), h('span', { class: 'sc-unit' }, part.yieldUnit)) : h('span', { class: 'label' }, 'Scale'),
        h('div', { class: 'presets', role: 'group', 'aria-label': 'Multiply' },
          [[0.5, '½'], [1, '×1'], [2, '×2'], [3, '×3'], [4, '×4']].map((s) => h('button', {
            class: 'preset', type: 'button', 'data-p': part.key, 'data-k': s[0], 'aria-pressed': Math.abs(f - s[0]) < 0.0005 ? 'true' : 'false',
            onclick: () => { setFactor(part, s[0]); updateScaled(part); },
          }, s[1])),
          h('label', { class: 'mul' }, h('span', null, '×'), h('input', {
            id: 'mul-' + part.key, class: 'mono', type: 'number', inputmode: 'decimal', step: 'any', min: '0', 'aria-label': 'Custom multiplier', value: K.fmtNum(f),
            oninput: (e) => { const v = parseFloat(e.target.value); if (v > 0) { setFactor(part, v); updateScaled(part); } },
          })))),
      h('p', { class: 'sc-note', id: 'snote-' + part.key, 'aria-live': 'polite' }, scaleNote(part)));
  }

  /* tap a line to cross it off while working */
  function tickable(key, el) {
    el.classList.add('tick');
    el.setAttribute('role', 'checkbox');
    el.tabIndex = 0;
    const set = () => { el.classList.toggle('done', !!ui.ticks[key]); el.setAttribute('aria-checked', ui.ticks[key] ? 'true' : 'false'); };
    const tog = () => { ui.ticks[key] = !ui.ticks[key]; set(); if (ui.ticks[key]) K.vibrate(8); };
    set();
    el.addEventListener('click', tog);
    el.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tog(); } });
    return el;
  }
  function ingList(part) {
    const f = factor(part);
    return h('ul', { class: 'ings', id: 'ings-' + part.key }, part.ingredients.map((g, i) => {
      const num = K.parseQty(g.q) > 0;
      const amt = num
        ? h('button', { class: 'amt mono', type: 'button', title: 'Scale from how much you have', onclick: (e) => { e.stopPropagation(); ui.sheet = { type: 'have', part: part, i: i }; K.render(); } }, K.fmtQty(g.q, g.u, f))
        : h('span', { class: 'amt mono' }, K.fmtQty(g.q, g.u, f));
      return tickable(part.key + 'i' + i, h('li', { class: 'ing' }, amt, h('span', { class: 'iname' }, g.n)));
    }));
  }
  function stepList(part, ctx) {
    return h('ol', { class: 'steps' }, part.steps.map((s, i) => tickable(part.key + 's' + i, h('li', { class: 'step' }, h('span', { class: 'sn' }, String(i + 1)), h('span', { class: 'stext' }, K.stepNodes(s, ctx))))));
  }
  function partCols(part, ingTitle, methodTitle, ctx) {
    return h('div', { class: 'cols' },
      h('div', { class: 'col' }, h('h3', { class: 'col-title' }, ingTitle),
        part.ingredients.length ? ingList(part) : h('p', { class: 'none' }, 'No ingredients listed.'),
        part.ingredients.some((g) => K.parseQty(g.q) > 0) ? h('p', { class: 'hint' }, 'Tap an amount to scale from what you have.') : null),
      h('div', { class: 'col' }, h('h3', { class: 'col-title' }, methodTitle),
        part.steps.length ? stepList(part, ctx) : h('p', { class: 'none' }, 'No method written yet.')));
  }

  K.SHEETS.have = function (S) {
    const part = S.part, g = part.ingredients[S.i];
    if (!g) return null;
    const fam = (K.unitInfo(g.u) || [])[0], units = fam === 'g' ? ['g', 'kg'] : fam === 'ml' ? ['ml', 'L'] : [g.u || ''];
    const short = g.n.split(',')[0];
    const go = (ev) => {
      ev.preventDefault();
      const have = K.parseQty(document.getElementById('havev').value);
      if (!(have > 0)) { K.toast('Type how much you have, like 1 or 750.'); return; }
      const hu = document.getElementById('haveu').value, a = K.unitInfo(hu), b = K.unitInfo(g.u);
      const f = (have * (a ? a[1] : 1)) / (K.parseQty(g.q) * (b ? b[1] : 1));
      setFactor(part, f, K.fmtNum(have) + ' ' + hu + ' ' + short);
      ui.sheet = null;
      K.render();
      K.toast('Scaled ×' + K.fmtNum(f));
    };
    const unitSel = h('select', { class: 'input', id: 'haveu', 'aria-label': 'Unit' }, units.map((u) => h('option', { value: u }, u || '—')));
    unitSel.value = units.find((u) => u.toLowerCase() === String(g.u || '').toLowerCase()) || units[0];
    return K.sheet('How much ' + short + ' do you have?', [
      h('p', { class: 'hint' }, 'The recipe uses ' + K.fmtQty(g.q, g.u, 1) + '. Everything else in this part is scaled to match.'),
      h('form', { class: 'havef', onsubmit: go },
        h('input', { class: 'input mono', id: 'havev', inputmode: 'decimal', placeholder: 'e.g. 750', 'aria-label': 'Amount you have', autofocus: true }), unitSel,
        h('button', { class: 'btn primary', type: 'submit' }, 'Scale')),
    ]);
  };

  /* ---------- allergens ---------- */
  function allergenBlock(found, manual, checked, label, also) {
    const keys = K.orderAl(Object.keys(found).concat(manual || []));
    const extra = also ? K.orderAl(also).filter((k) => !keys.includes(k)) : [];
    return h('section', { class: 'allergens' },
      h('div', { class: 'al-head' }, h('span', { class: 'label' }, label),
        h('span', { class: 'al-status' + (checked ? ' ok' : '') }, checked ? 'Checked by the head chef' : 'Found automatically · not yet checked')),
      keys.length ? h('div', { class: 'al-chips' }, keys.map((k) => h('span', { class: 'al' }, K.AL[k] || k))) : h('p', { class: 'none' }, 'None of the 14 allergens found in the ingredients.'),
      keys.length ? h('details', { class: 'al-src' }, h('summary', null, 'Where they come from'),
        h('ul', null, keys.map((k) => h('li', null, h('b', null, (K.AL[k] || k) + ': '), found[k] ? found[k].join(', ') : 'added by the head chef')))) : null,
      extra.length ? h('p', { class: 'hint' }, 'The rest of the dish also has: ' + extra.map((k) => K.AL[k]).join(', ') + '.') : null);
  }
  function miniAllergens(list) {
    const keys = K.orderAl(Object.keys(K.detectAllergens([list])));
    return keys.length ? h('div', { class: 'al-chips mini' }, keys.map((k) => h('span', { class: 'al' }, K.AL[k]))) : null;
  }

  /* ---------- recipe page ---------- */
  function parts(r) {
    const comps = r.components.map((c, i) => ({ key: 'c' + i, ci: i, name: c.name, station: c.station, yieldQty: c.yieldQty, yieldUnit: c.yieldUnit, ingredients: c.ingredients, steps: c.steps, notes: c.notes }));
    const main = { key: 'm', ci: -1, name: comps.length ? 'Assembly' : r.name, yieldQty: r.yieldQty, yieldUnit: r.yieldUnit, ingredients: r.ingredients, steps: r.steps };
    return { comps: comps, main: main, hasMain: !!(main.ingredients.length || main.steps.length) };
  }
  K.recipeParts = parts;
  function topbar(r, cookable, onEdit) {
    return K.subbar('Recipes', () => K.back('recipes'), [
      'wakeLock' in navigator ? h('button', { type: 'button', class: 'icon-btn' + (ui.wake ? ' on' : ''), 'aria-pressed': ui.wake ? 'true' : 'false', title: ui.wake ? 'Screen stays on' : 'Keep the screen on', 'aria-label': 'Keep the screen on', onclick: K.toggleWake }, K.icon('sun')) : null,
      K.me.admin ? h('button', { type: 'button', class: 'btn small', onclick: onEdit }, K.icon('edit'), h('span', { class: 'hide-xs' }, 'Edit')) : null,
      cookable ? h('button', { type: 'button', class: 'btn small primary', onclick: () => K.openCook(r.id, ui.comp) }, K.icon('cook'), 'Cook') : null,
    ], r.name);
  }
  function metaChips(r, part) {
    const st = K.stationOf(r, part && part.ci >= 0 ? r.components[part.ci] : null);
    return h('div', { class: 'meta-chips' },
      st && K.ST[st] ? h('span', { class: 'mchip st-' + st }, K.icon(K.ST_ICON[st]), K.ST[st]) : null,
      (r.services.length ? r.services : r.type === 'dish' ? ['alacarte'] : []).map((s) => K.SV[s] ? h('span', { class: 'mchip' }, K.SV[s]) : null),
      r.onMenu === false ? h('span', { class: 'mchip off' }, 'Off the menu') : null);
  }
  const CLEAN = () => h('p', { class: 'clean' }, h('b', null, 'Clean weights. '), 'Every amount is prepped product: 50 g onion means 50 g peeled and trimmed.');

  K.V.recipe = function () {
    const r = K.find(ui.id);
    if (ui.comp >= 0 && r.components[ui.comp]) return compPage(r, r.components[ui.comp]);
    const P = parts(r), comps = P.comps, main = P.main;
    const cookable = comps.some((c) => c.steps.length) || main.steps.length;
    const body = h('div', { class: 'wrap page recipe' });
    const al = allergenBlock(K.detectAllergens(K.allIngLists(r)), r.allergens, r.allergensChecked, r.type === 'dish' ? 'Allergens in the whole dish' : 'Allergens');
    const index = comps.length ? h('nav', { class: 'parts', 'aria-label': 'Parts of the dish' },
      h('span', { class: 'label' }, comps.length + ' parts' + (P.hasMain ? ' + assembly' : '')),
      h('ol', null, comps.map((c) => {
        const pa = K.partArt(r, c.ci), n = h('span', { class: 'pn mono' }, String(c.ci + 1));
        return h('li', null, h('button', { type: 'button', class: pa ? 'has-thumb' : null, onclick: () => jump('s-' + c.key) },
          pa ? h('span', { class: 'pthumb-wrap' }, K.photoWithFallback(pa, '', (im) => im.remove(), { class: 'part-thumb', alt: '', loading: 'lazy', decoding: 'async' }), n) : n,
          h('span', { class: 'pname' }, c.name), c.yieldQty ? h('span', { class: 'muted mono' }, K.yieldText(c.yieldQty, c.yieldUnit)) : null));
      }))) : null;
    const art = K.artFor(r);
    body.append(h('div', { class: 'rhead' + (r.photo || art ? ' has-photo' : '') },
      r.photo ? h('button', { type: 'button', class: 'dish-photo-btn', 'aria-label': 'Open photos of ' + r.name, onclick: () => K.openPhotos([{ id: r.photo, title: r.name }].concat(r.gallery), 0) },
        h('img', { class: 'dish-photo', src: K.media(r.photo), alt: 'Plated ' + r.name }),
        r.gallery.length ? h('span', { class: 'photo-count' }, K.icon('photo'), String(r.gallery.length + 1)) : null)
        : art ? h('figure', { class: 'dish-photo-btn art' }, K.photoWithFallback(art, K.artSrc(r), (im) => im.parentNode.remove(), { class: 'dish-photo', alt: '' }),
          h('figcaption', { class: 'art-tag' }, 'Illustration, not our plating')) : null,
      h('div', { class: 'rhead-txt' },
        h('p', { class: 'kicker' + (r.type === 'dish' ? ' dish' : '') }, (r.type === 'dish' ? 'Dish' : 'Recipe') + (r.category ? ' · ' + r.category : '')),
        h('h1', { class: 'rtitle' }, r.name),
        metaChips(r, null),
        comps.length ? null : scaler(main, false),
        index, al, CLEAN())));
    if (comps.length > 1) body.append(h('nav', { class: 'jump', 'aria-label': 'Jump to' }, comps.map((c) => h('button', { type: 'button', onclick: () => jump('s-' + c.key) }, c.name)),
      P.hasMain ? h('button', { type: 'button', onclick: () => jump('s-m') }, 'Assembly') : null,
      r.plating || r.videos.length || r.gallery.length ? h('button', { type: 'button', onclick: () => jump('s-plating') }, 'Plating') : null));
    comps.forEach((c) => {
      const st = K.stationOf(r, r.components[c.ci]);
      body.append(h('section', { class: 'part', id: 's-' + c.key },
        h('div', { class: 'part-head' }, h('span', { class: 'part-n mono' }, String(c.ci + 1)),
          h('h2', null, h('button', { type: 'button', class: 'part-link', title: 'Open this part on its own', onclick: () => K.go('recipe', { id: r.id, comp: c.ci }) }, c.name)),
          st && K.ST[st] ? h('span', { class: 'mchip st-' + st }, K.icon(K.ST_ICON[st]), K.ST[st]) : null),
        miniAllergens(c.ingredients),
        scaler(c, true),
        partCols(c, 'Ingredients', 'Method', c.name),
        c.notes ? h('p', { class: 'prose note' }, c.notes) : null));
    });
    if (P.hasMain) {
      body.append(h('section', { class: 'part' + (comps.length ? '' : ' solo'), id: 's-m' },
        comps.length ? h('div', { class: 'part-head' }, h('span', { class: 'part-n' }, K.icon('check')), h('h2', null, 'Assembly')) : null,
        comps.length ? scaler(main, true) : null,
        partCols(main, comps.length ? 'Extra ingredients' : 'Ingredients', comps.length ? 'Assembly' : 'Method', r.name)));
    } else if (!comps.length) body.append(h('p', { class: 'none' }, 'No ingredients or method written yet.'));
    if (r.plating || r.videos.length || r.gallery.length) {
      body.append(h('section', { class: 'part', id: 's-plating' }, h('h2', { class: 'sec-title' }, 'Plating for service'),
        K.gallery(r.gallery, 'Plating photos of ' + r.name),
        r.videos.length ? h('div', { class: 'videos' }, r.videos.map((v) => h('figure', { class: 'vid' },
          h('video', { src: K.media(v.id), controls: true, playsinline: true, preload: 'metadata' }), v.title ? h('figcaption', null, v.title) : null))) : null,
        r.plating ? h('p', { class: 'prose' }, r.plating) : null));
    }
    if (r.notes) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'Notes'), h('p', { class: 'prose' }, r.notes)));
    return { top: topbar(r, cookable, () => K.startEdit(r)), body: body };
  };

  function compPage(r, c) {
    const ci = ui.comp, part = { key: 'x', ci: ci, name: c.name, yieldQty: c.yieldQty, yieldUnit: c.yieldUnit, ingredients: c.ingredients, steps: c.steps };
    const body = h('div', { class: 'wrap page recipe' }), pa = K.partArt(r, ci);
    body.append(h('div', { class: 'rhead' + (pa ? ' has-photo' : '') },
      pa ? h('figure', { class: 'dish-photo-btn art' }, K.photoWithFallback(pa, '', (im) => im.parentNode.remove(), { class: 'dish-photo', alt: '' }),
        h('figcaption', { class: 'art-tag' }, 'Illustration, not our prep')) : null,
      h('div', { class: 'rhead-txt' },
      h('p', { class: 'kicker' }, 'Recipe · part ' + (ci + 1) + ' of ' + r.components.length),
      h('h1', { class: 'rtitle' }, c.name),
      h('button', { class: 'partof', type: 'button', onclick: () => K.go('recipe', { id: r.id }) }, h('span', { class: 'muted' }, 'Part of the dish'), h('b', null, r.name), K.icon('next')),
      metaChips(r, part),
      scaler(part, false),
      allergenBlock(K.detectAllergens([c.ingredients]), [], r.allergensChecked, 'Allergens in this part', Object.keys(K.detectAllergens(K.allIngLists(r))).concat(r.allergens)),
      CLEAN())));
    body.append(h('section', { class: 'part solo' }, partCols(part, 'Ingredients', 'Method', c.name)));
    if (c.notes) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'Notes'), h('p', { class: 'prose' }, c.notes)));
    const pager = h('div', { class: 'pager' },
      ci > 0 ? h('button', { type: 'button', class: 'btn', onclick: () => K.go('recipe', { id: r.id, comp: ci - 1 }) }, K.icon('back'), r.components[ci - 1].name) : h('span'),
      ci < r.components.length - 1 ? h('button', { type: 'button', class: 'btn', onclick: () => K.go('recipe', { id: r.id, comp: ci + 1 }) }, r.components[ci + 1].name, K.icon('next')) : h('span'));
    body.append(pager);
    return {
      top: topbar(r, c.steps.length > 0, () => { K.startEdit(r); const ec = ui.edit && ui.edit.components[ci]; if (ec) { ec.open = true; K.render(true); } }),
      body: body,
    };
  }
  function jump(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }

  /* ---------- cook mode: one big step at a time ---------- */
  K.openCook = function (id, comp) {
    ui.cook = { id: id, comp: comp >= 0 ? comp : -1, idx: 0, ings: false };
    if (!ui.wake && 'wakeLock' in navigator) navigator.wakeLock.request('screen').then((l) => { ui.wake = l; l.addEventListener('release', () => { ui.wake = null; }); }, () => {});
    K.render();
  };
  function cookSteps(r, comp) {
    const P = parts(r), list = [];
    const add = (p, label) => p.steps.forEach((s, i) => list.push({ part: p, label: label, n: i + 1, of: p.steps.length, text: s }));
    if (comp >= 0) { const c = P.comps[comp]; add(Object.assign({}, c, { key: 'x' }), c.name); }
    else { P.comps.forEach((c) => add(c, (c.ci + 1) + ' · ' + c.name)); if (P.main.steps.length) add(P.main, P.comps.length ? 'Assembly' : r.name); }
    return list;
  }
  K.V.cook = function () {
    const C = ui.cook, r = K.find(C.id);
    if (!r) { ui.cook = null; return null; }
    const list = cookSteps(r, C.comp);
    if (!list.length) { ui.cook = null; return null; }
    C.idx = Math.max(0, Math.min(C.idx, list.length - 1));
    const s = list[C.idx], last = C.idx === list.length - 1;
    const close = () => { ui.cook = null; K.render(); };
    const go = (d) => { const n = C.idx + d; if (n < 0 || n >= list.length) return; C.idx = n; K.render(); };
    const box = h('div', { class: 'cook', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Cook mode: ' + r.name, tabindex: '-1',
      onkeydown: (e) => { if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'Escape') close(); } },
      h('div', { class: 'cook-top' },
        h('button', { type: 'button', class: 'icon-btn on-dark', 'aria-label': 'Close cook mode', onclick: close }, K.icon('close')),
        h('div', { class: 'cook-title' }, h('span', null, r.name), h('b', null, s.label)),
        h('button', { type: 'button', class: 'btn small light', 'aria-pressed': C.ings ? 'true' : 'false', onclick: () => { C.ings = !C.ings; K.render(); } }, K.icon('list'), 'Ingredients')),
      h('div', { class: 'cook-progress', 'aria-hidden': 'true' }, list.map((x, i) => h('span', { class: i < C.idx ? 'past' : i === C.idx ? 'now' : '' }))),
      C.ings ? h('div', { class: 'cook-ings' }, h('p', { class: 'label' }, s.part.name + (Math.abs(factor(s.part) - 1) > 0.0005 ? ' · ×' + K.fmtNum(factor(s.part)) : '')),
        s.part.ingredients.length ? h('ul', null, s.part.ingredients.map((g) => h('li', null, h('span', { class: 'mono' }, K.fmtQty(g.q, g.u, factor(s.part))), h('span', null, g.n)))) : h('p', { class: 'none' }, 'No ingredients listed for this part.')) : null,
      h('div', { class: 'cook-step' },
        h('p', { class: 'cook-n mono' }, 'Step ' + s.n + ' of ' + s.of),
        h('p', { class: 'cook-text' }, K.stepNodes(s.text, s.part.name))),
      h('div', { class: 'cook-nav' },
        h('button', { type: 'button', class: 'btn big ghost-light', disabled: C.idx === 0, onclick: () => go(-1) }, K.icon('back'), 'Back'),
        last ? h('button', { type: 'button', class: 'btn big light', onclick: () => { close(); K.toast('All steps done. Nice work.'); } }, K.icon('check'), 'Finish')
          : h('button', { type: 'button', class: 'btn big light', onclick: () => go(1) }, 'Next', K.icon('next'))));
    let x0 = null;
    box.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 70) go(dx < 0 ? 1 : -1); });
    setTimeout(() => { if (!box.contains(document.activeElement)) box.focus({ preventScroll: true }); }, 0);
    return box;
  };
})();
