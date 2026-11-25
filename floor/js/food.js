/* The food bible: every dish on the menu with what to say at the table, the translation, the unusual
   ingredients, the stories and facts, the allergens (from the kitchen's own ingredients) and the wines
   that go with it; and every ingredient a guest might ask about. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const TINTS = 6;
  function tint(s) { let x = 0; for (const ch of String(s)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return 't' + (x % TINTS); }
  const lines = (t) => String(t || '').split(/\n+/).map((x) => x.replace(/^[-•·*]\s*/, '').trim()).filter(Boolean);

  K.dishThumb = function (d, cls) {
    const letter = () => h('div', { class: 'thumb ph ' + tint(d.section) + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' }, d.name.charAt(0).toUpperCase());
    const src = d.photo ? K.media(d.photo) : K.dishArt(d);
    return src ? K.photoWithFallback(src, '', letter(), { class: 'thumb' + (cls ? ' ' + cls : ''), alt: '', loading: 'lazy', decoding: 'async' }) : letter();
  };

  /* ---------- the list ---------- */
  K.V.food = function () {
    const body = h('div', { class: 'page' });
    const all = K.dishes(K.canEdit()), n = all.filter((d) => !d.hide).length;
    body.append(h('section', { class: 'hero photo slim' }, K.photoLayer('assets/photos/theme/recipes.jpg'), K.rays('ph-rays'),
      h('div', { class: 'wrap hero-in' },
        h('h1', { class: 'hero-title' }, 'What are we ', h('em', null, 'serving'), '?'),
        n ? h('p', { class: 'hero-sub' }, n + (n === 1 ? ' dish' : ' dishes') + ' · ' + K.ingredients().length + ' ingredients') : null)));
    const w = h('div', { class: 'wrap' });
    body.append(w);
    const allergy = ui.foodTab === 'allergy' || ui.foodTab === 'tasting';
    /* the allergy view is the whole menu at a glance: no search box to cover the boxes */
    if (!allergy) w.append(K.searchBox('fq', ui.q, ui.foodTab === 'ings' ? 'Search an ingredient, in Bulgarian or English' : 'Search a dish, ingredient or allergen', (v) => { ui.q = v; results(); }));
    w.append(h('div', { class: 'chips filters' },
      K.seg([['dishes', 'Dishes'], ['allergy', 'Allergies'], ['tasting', 'Tasting'], ['ings', 'Ingredients']], ui.foodTab, (v) => { ui.foodTab = v; K.render(); }, { 'aria-label': 'Show', class: 'seg small-seg' }),
      K.canEdit() && !allergy ? h('button', { type: 'button', class: 'chip', onclick: () => { ui.sheet = { type: 'adddish' }; K.render(); } }, K.icon('plus'), 'Add') : null));
    if (ui.foodTab === 'allergy') { w.append(checkNudge()); w.append(allergyPicker()); }
    if (ui.foodTab === 'tasting') {
      /* the tasting menu, and the same menu for a guest: tick what they cannot eat and every course answers */
      const t = K.tasting();
      if (!t.courses.length) w.append(h('div', { class: 'empty' }, h('strong', null, 'The tasting menu is not set up yet'),
        K.canEdit() ? 'Load it with the house menu (Settings → Load the house menu and drinks), or pick its courses yourself.' : 'The floor manager sets it up.',
        K.canEdit() ? h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { ui.sheet = { type: 'tasting' }; K.render(); } }, K.icon('list'), 'Set up the tasting menu')) : null));
      else {
        w.append(h('div', { class: 'tb-head' }, h('h2', null, 'For a guest with an allergy or a diet'), h('p', { class: 'hint' }, 'Tick what the guest cannot eat. Each course then shows if it is fine, fine with a change, or what to serve in its place, with a note to copy for the kitchen.')));
        w.append(allergyPicker());
      }
    }
    if (ui.foodTab === 'dishes' && D.loaded && all.length) {
      const secs = Array.from(new Set(all.map((d) => d.section))).sort(secOrder);
      w.append(h('div', { class: 'chips', role: 'group', 'aria-label': 'Section' },
        [['', 'All', all.length]].concat(secs.map((s) => [s, s, all.filter((d) => d.section === s).length])).map((c) =>
          h('button', { class: 'chip', type: 'button', 'aria-pressed': ui.sect === c[0] ? 'true' : 'false', onclick: () => { ui.sect = c[0]; K.render(); } }, c[1], h('span', { class: 'cn' }, String(c[2]))))));
    }
    w.append(h('div', { id: 'results' }));
    return { body: body, after: results };
  };

  function dishHay(d) {
    const al = K.dishAllergens(d).keys.map((k) => K.AL[k] || k);
    return [d.name, d.kname, d.en, d.n.menuBg, d.n.menuEn, d.section, d.ings.join(' '), d.ings.map(K.en).join(' '), al.join(' '), (d.n.niche || []).map((x) => x.n + ' ' + x.what).join(' '), d.parts.join(' ')].join(' ');
  }
  function results() {
    const box = document.getElementById('results');
    if (!box) return;
    box.textContent = '';
    if (!D.loaded) { box.append(K.loadingBox('Loading the menu')); return; }
    if (ui.foodTab === 'ings') { box.append(ingList()); return; }
    if (ui.foodTab === 'tasting') { if (K.tasting().courses.length) box.append(alSel().length ? tastingFor(alSel()) : tastingCard(true)); return; }
    if (ui.foodTab === 'allergy') { box.append(allergyResults()); return; }
    const all = K.dishes(K.canEdit()).filter((d) => (!ui.sect || d.section === ui.sect) && K.matches(dishHay(d), ui.q));
    if (!all.length) {
      box.append(ui.q ? h('div', { class: 'empty' }, h('strong', null, 'Nothing for “' + ui.q.trim() + '”'), 'Try a shorter word, an ingredient or an allergen. Latin letters work too.')
        : K.catRest('No dishes on the menu yet', 'Dishes the kitchen puts on the menu show up here by themselves.', K.canEdit() ? h('div', { class: 'btns center' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { ui.sheet = { type: 'adddish' }; K.render(); } }, K.icon('plus'), 'Add a dish')) : null));
      return;
    }
    const groups = {};
    all.forEach((d) => { (groups[d.section] = groups[d.section] || []).push(d); });
    Object.keys(groups).sort(secOrder).forEach((s) => {
      box.append(h('section', { class: 'group' }, h('h2', { class: 'group-title' }, s, h('span', { class: 'n' }, String(groups[s].length))),
        h('div', { class: 'grid' }, groups[s].map(card))));
    });
  }
  /* ---------- a guest with allergies: tick them, see what they can and cannot eat ---------- */
  const alSel = () => (ui.alSel = ui.alSel || []);
  /* "Milk in butter, cream" or "Gluten (ticked by hand)" */
  const whereText = (hit, max) => {
    if (hit.txt) return hit.txt;
    const l = hit.where.filter((x) => x !== 'ticked by hand'), more = max && l.length > max;
    return l.length ? ' in ' + (max ? l.slice(0, max) : l).join(', ') + (more ? '…' : '') : ' (ticked by hand)';
  };
  function allergyPicker() {
    const sel = alSel();
    return h('section', { class: 'al-pick' },
      h('div', { class: 'alp-head' }, h('b', null, 'The guest is allergic to'),
        sel.length ? h('button', { type: 'button', class: 'btn small', onclick: () => { ui.alSel = []; K.render(); } }, K.icon('close'), 'Next table') : null),
      h('div', { class: 'alp-grid', role: 'group', 'aria-label': 'Allergies' }, (K.ALLERGENS || []).concat([['lactose', 'Lactose', 'eats butter']]).map((a) => h('button', {
        type: 'button', class: 'alp' + (a[2] ? ' two' : ''), 'aria-pressed': sel.includes(a[0]) ? 'true' : 'false',
        onclick: () => { ui.alSel = sel.includes(a[0]) ? sel.filter((x) => x !== a[0]) : sel.concat([a[0]]); K.render(); },
      }, h('span', { class: 'alp-box', 'aria-hidden': 'true' }, K.icon('check')), a[2] ? h('span', null, a[1], h('small', null, a[2])) : a[1]))),
      h('div', { class: 'alp-head' }, h('b', null, 'The guest eats')),
      h('div', { class: 'alp-grid diet', role: 'group', 'aria-label': 'Diet' }, ['pesc', 'veg', 'vegan'].map((k) => h('button', {
        type: 'button', class: 'alp', 'aria-pressed': sel.includes(k) ? 'true' : 'false',
        onclick: () => { const on = sel.includes(k); ui.alSel = sel.filter((x) => !K.DIET[x]).concat(on ? [] : [k]); K.render(); },
      }, h('span', { class: 'alp-box', 'aria-hidden': 'true' }, K.icon('check')), K.DIET[k]))));
  }
  function allergyResults() {
    const sel = alSel();
    const all = K.dishes().filter((d) => d.onMenu && d.n.only !== 'tasting').sort((a, b) => secOrder(a.section, b.section) || a.name.localeCompare(b.name));
    if (!sel.length) return h('div', { class: 'empty' }, h('strong', null, 'Tick the guest’s allergies or diet'), 'The menu splits into what they can eat, what the kitchen should confirm, and what they cannot have.');
    const v = all.map((d) => ({ d: d, v: K.allergyVerdict(d, sel) }));
    const ok = v.filter((x) => x.v.state === 'ok'), mod = v.filter((x) => x.v.state === 'mod'), ask = v.filter((x) => x.v.state === 'ask'), no = v.filter((x) => x.v.state === 'no');
    const names = sel.map(K.alName).join(', ');
    const row = (x) => h('button', { type: 'button', class: 'alr alr-' + x.v.state, onclick: () => K.go('dish', { id: x.d.id }) },
      K.dishThumb(x.d, 'sm'),
      h('span', { class: 'alr-txt' },
        h('b', null, x.d.name), x.d.en && x.d.en !== x.d.name ? h('span', { class: 'card-en' }, x.d.en) : null,
        x.v.notes.length ? h('span', { class: 'alr-fix' }, x.v.notes.join(' · ')) : null,
        x.v.hits.length ? h('span', { class: 'alr-why' }, x.v.hits.map((hh) => h('span', null, h('b', null, K.alName(hh.k)), hh.bread ? ' only in the bread' : hh.swap && !hh.txt ? ' leaves with the change' : whereText(hh, 3)))) : null),
      h('span', { class: 'alr-mark', 'aria-hidden': 'true' }, K.icon(x.v.state === 'ok' ? 'check' : x.v.state === 'mod' ? 'edit' : x.v.state === 'no' ? 'close' : 'alert')));
    const block = (cls, title, sub, list) => (list.length ? h('section', { class: 'group alg alg-' + cls }, h('h2', { class: 'group-title' }, title, h('span', { class: 'n' }, String(list.length))), sub ? h('p', { class: 'hint' }, sub) : null, h('div', { class: 'alr-list' }, list.map(row))) : null);
    return h('div', null,
      h('p', { class: 'al-sum', role: 'status' }, h('b', null, names + ': '), ok.length + ' can eat · ' + (mod.length ? mod.length + ' with a change · ' : '') + (ask.length ? ask.length + ' to confirm · ' : '') + no.length + ' cannot'),
      sel.includes('sulphites') ? h('p', { class: 'banner' }, h('b', null, 'Sulphites: '), 'every wine has them, and so do vinegar dressings. Check the drinks too.') : null,
      block('ok', 'Can eat', 'None of these allergens, and the dish’s allergens have been confirmed.', ok),
      block('mod', 'Can eat with a change', 'Write the change on the order, so the kitchen sees it.', mod),
      sel.includes('lactose') ? h('p', { class: 'hint' }, h('b', null, 'Lactose: '), 'for a guest who avoids lactose but eats butter. For a milk allergy, tick Milk instead.') : null,
      block('ask', 'Ask the kitchen first', 'Nothing against ' + names.toLowerCase() + ' found, but this dish’s allergens or diet label have not been confirmed yet.', ask),
      block('no', 'Cannot eat', 'Some may be made without it: ask the kitchen before promising.', no),
      h('p', { class: 'hint al-foot' }, 'Worked out from the kitchen book’s ingredients. Cross-contact in the kitchen is always possible: for a severe allergy, tell the kitchen when you send the order.'));
  }

  /* ---------- confirming allergens, dish by dish ---------- */
  /* the dishes this person may confirm, in the order of the menu */
  K.checkList = () => K.dishes().filter((d) => d.onMenu && K.canCheck(d)).sort((x, y) => secOrder(x.section, y.section) || (+x.n.order || 0) - (+y.n.order || 0) || x.name.localeCompare(y.name));
  /* every one of them, one after the other: the ones already confirmed too, to go over them again */
  K.checkAll = function () {
    const l = K.checkList();
    if (!l.length) { K.toast('There is no dish for you to confirm. The chefs and the owner confirm the kitchen’s dishes.'); return; }
    ui.sheet = { type: 'alcheck', ids: l.map((d) => d.id), i: 0 };
    K.render();
  };
  function checkNudge() {
    const mine = K.checkList(), todo = mine.filter((d) => !K.dishChecked(d));
    const total = K.dishes().filter((d) => d.onMenu).length, done = K.dishes().filter((d) => d.onMenu && K.dishChecked(d)).length;
    const all = mine.length ? h('button', { type: 'button', class: 'btn al-all', onclick: K.checkAll }, K.icon('list'), 'Check all ' + mine.length + ' dishes, one by one') : null;
    if (!todo.length) return h('div', { class: 'al-nudges' }, total && done < total ? h('p', { class: 'hint al-progress' }, done + ' of ' + total + ' dishes have confirmed allergens. The chefs or the owner confirm the rest.') : total ? h('p', { class: 'hint al-progress' }, 'All ' + total + ' dishes have confirmed allergens.') : null, all);
    return h('div', { class: 'al-nudges' }, h('button', { type: 'button', class: 'al-nudge', onclick: () => { ui.sheet = { type: 'alcheck', ids: todo.map((d) => d.id), i: 0 }; K.render(); } },
      K.icon('check'), h('span', null, h('b', null, 'Confirm the allergens: ' + todo.length + (todo.length === 1 ? ' dish' : ' dishes') + ' to go'),
        h('span', null, done + ' of ' + total + ' confirmed. One dish at a time, a few seconds each.')), K.icon('next')), all);
  }
  K.SHEETS.alcheck = function (S) {
    const d = K.dish(S.ids[S.i]);
    if (!d) { ui.sheet = null; return null; }
    const where = K.allergenWhere(d);
    /* found in the ingredients: fixed. Read off the menu line only: ticked, but whoever confirms can untick it */
    const found = Object.keys(where).filter((k) => where[k].some((x) => x !== 'ticked by hand' && !K.fromMenu(x)));
    const soft = Object.keys(K.menuAllergens(d)).filter((k) => !found.includes(k));
    if (S.forId !== d.id) {
      S.forId = d.id; S.extra = ((d.r && d.r.allergens) || d.n.allergens || []).filter((k) => !found.includes(k));
      soft.forEach((k) => { if (!(d.n.notAl || []).includes(k) && !S.extra.includes(k)) S.extra.push(k); });
      S.butter = d.n.butterOnly ? '1' : ''; S.diet = d.n.diet || ''; S.bread = d.n.bread ? '1' : ''; S.breadAl = d.n.bread ? (d.n.breadAl || []).slice() : null;
      S.can = d.n.canDiet || ''; S.canHow = d.n.canHow || ''; S.canAl = d.n.canDiet ? (d.n.canAl || []).slice() : null;
    }
    const isOn = (k) => found.includes(k) || S.extra.includes(k), onKeys = (K.ALLERGENS || []).map((a) => a[0]).filter(isOn);
    /* gluten is the usual one that leaves with the bread */
    const breadAl = (S.breadAl || (isOn('gluten') ? ['gluten'] : [])).filter(isOn);
    const butterSrc = (where.milk || []).filter((x) => x !== 'ticked by hand');
    /* made for a stricter diet on request: only a diet stricter than the dish's own counts */
    const stricter = K.DIETS.slice(1).filter((k) => !S.diet || K.DIETS.indexOf(k) > K.DIETS.indexOf(S.diet));
    const can = stricter.includes(S.can) ? S.can : '';
    const canAl = (S.canAl || K.CAN_GONE[can] || []).filter(isOn);
    const last = S.i >= S.ids.length - 1;
    const go = (save) => {
      if (save) {
        const flags = { butterOnly: !!(S.butter && isOn('milk')), bread: !!S.bread, breadAl: S.bread ? breadAl : [], diet: S.diet, canDiet: can, canHow: can ? S.canHow.trim() : '', canAl: can ? canAl : [], notAl: soft.filter((k) => !S.extra.includes(k)) };
        if (flags.butterOnly || flags.bread || flags.diet || flags.canDiet || flags.notAl.length || D.notes[d.id]) K.saveNote(d.id, flags);
        K.confirmAllergens(d, S.extra.slice());
      }
      if (last) { ui.sheet = null; K.toast(save ? 'Allergens confirmed' : 'Done'); } else S.i++;
      K.render();
    };
    return K.sheet(S.ids.length > 1 ? 'Allergens · ' + (S.i + 1) + ' of ' + S.ids.length : 'Allergens', h('div', { class: 'stack alc' },
      h('div', { class: 'alc-dish' }, K.dishThumb(d, 'sm'), h('div', null, h('b', null, d.name), d.en && d.en !== d.name ? h('span', { class: 'card-en' }, d.en) : null)),
      d.ings.length ? h('details', { class: 'alc-ings' }, h('summary', null, 'What is in it (' + d.ings.length + ')'), h('p', null, d.ings.join(', '))) : h('p', { class: 'muted' }, 'No ingredients written for this dish: tick everything it has.'),
      h('p', { class: 'hint' }, 'Tick every allergen in this dish. The ones found in the ingredients are already on.'),
      h('div', { class: 'alp-grid alc-grid', role: 'group', 'aria-label': 'Allergens in ' + d.name }, (K.ALLERGENS || []).map((a) => {
        const auto = found.includes(a[0]), on = auto || S.extra.includes(a[0]);
        return h('button', { type: 'button', class: 'alp' + (auto ? ' auto' : ''), 'aria-pressed': on ? 'true' : 'false', disabled: auto ? true : null,
          onclick: () => { S.extra = on ? S.extra.filter((x) => x !== a[0]) : S.extra.concat([a[0]]); K.render(); },
        }, h('span', { class: 'alp-box', 'aria-hidden': 'true' }, K.icon('check')), h('span', null, a[1], auto ? h('small', null, where[a[0]].filter((x) => x !== 'ticked by hand' && !K.fromMenu(x)).slice(0, 2).join(', ')) : soft.includes(a[0]) && on ? h('small', null, 'on the menu') : null));
      })),
      found.length ? h('p', { class: 'hint' }, 'One found by mistake? Correct the ingredient in the kitchen book; it cannot be switched off here.') : null,
      isOn('milk') ? h('div', { class: 'alc-q' }, h('b', null, 'The dairy in this dish is'),
        butterSrc.length ? h('span', { class: 'muted' }, 'Found: ' + butterSrc.slice(0, 4).join(', ')) : null,
        K.seg([['1', 'Only butter'], ['', 'More than butter']], S.butter, (v) => { S.butter = v; K.render(); }, { class: 'seg', 'aria-label': 'The dairy in this dish' }),
        h('span', { class: 'hint' }, 'Only butter: guests who avoid lactose but eat butter can have it.')) : null,
      h('div', { class: 'alc-q' }, h('b', null, 'Who can eat it?'),
        K.seg([['meat', 'Has meat'], ['pesc', 'Pescatarian'], ['veg', 'Vegetarian'], ['vegan', 'Vegan']], S.diet, (v) => { S.diet = S.diet === v ? '' : v; K.render(); }, { class: 'seg wrap-seg', 'aria-label': 'Who can eat it' }),
        h('span', { class: 'hint' }, (K.dietGuess(d) ? 'From the ingredients it looks like: ' + K.DIET[K.dietGuess(d)].toLowerCase() + '. ' : '') + 'Think of stock, gelatine, fish sauce, honey and what it is fried in.')),
      stricter.length ? h('div', { class: 'alc-q' }, h('b', null, 'Can the kitchen make it for a stricter diet?'),
        K.seg([['', 'No']].concat(stricter.map((k) => [k, K.DIET[k]])), can, (v) => { S.can = v; S.canAl = null; K.render(); }, { class: 'seg wrap-seg', 'aria-label': 'Can be made on request' }),
        can ? h('div', { class: 'alc-bread' },
          K.field('What changes', h('input', { class: 'input', id: 'alc-how', value: S.canHow, placeholder: 'without the cheese', oninput: (e) => { S.canHow = e.target.value; } })),
          onKeys.length ? h('span', { class: 'hint' }, 'Which of its allergens leave the dish with that change?') : null,
          onKeys.length ? h('div', { class: 'chips' }, onKeys.map((k) => h('button', { type: 'button', class: 'chip', 'aria-pressed': canAl.includes(k) ? 'true' : 'false',
            onclick: () => { S.canAl = canAl.includes(k) ? canAl.filter((x) => x !== k) : canAl.concat([k]); K.render(); } }, K.AL[k]))) : null)
          : h('span', { class: 'hint' }, 'For example a salad with cheese that can go out without it: vegan on request.')) : null,
      h('div', { class: 'alc-q' }, h('b', null, 'Is it served with bread?'),
        K.seg([['', 'No bread'], ['1', 'Yes, and it can go without']], S.bread, (v) => { S.bread = v; K.render(); }, { class: 'seg', 'aria-label': 'Served with bread' }),
        S.bread && onKeys.length ? h('div', { class: 'alc-bread' }, h('span', { class: 'hint' }, 'Which of its allergens are only in the bread? Without the bread, the dish no longer has them.'),
          h('div', { class: 'chips' }, onKeys.map((k) => h('button', { type: 'button', class: 'chip', 'aria-pressed': breadAl.includes(k) ? 'true' : 'false',
            onclick: () => { S.breadAl = breadAl.includes(k) ? breadAl.filter((x) => x !== k) : breadAl.concat([k]); K.render(); } }, K.AL[k])))) : null),
      h('div', { class: 'btns' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => go(true) }, K.icon('check'), last ? 'Confirm' : 'Confirm and next'),
        S.ids.length > 1 ? h('button', { class: 'btn', type: 'button', onclick: () => go(false) }, 'Skip') : null,
        S.i > 0 ? h('button', { class: 'btn', type: 'button', onclick: () => { S.i--; K.render(); } }, 'Back') : null),
      S.ids.length > 1 ? h('p', { class: 'hint alc-left' }, K.dishChecked(d) ? 'Already confirmed: change what is wrong, or just confirm again.' : 'Not confirmed yet.') : null));
  };

  /* ---------- the tasting menu ---------- */
  /* the wine poured with a course: the line as the menu prints it; a tap opens the bottle when it is on the list */
  function wineLine(label, wn) {
    const w = wn.id ? K.wine(wn.id) : null, txt = [K.icon('glass'), h('span', null, label ? h('b', null, label + ': ') : null, wn.text)];
    return w ? h('button', { type: 'button', class: 'ts-wine', onclick: () => K.go('winepage', { id: w.id }) }, txt) : h('p', { class: 'ts-wine' }, txt);
  }
  /* a course's line as the tasting menu prints it: its own where the menu has one, else the dish's line */
  const courseLine = (t, d) => { const own = t.lines[d.id]; return own ? (K.flang === 'bg' ? own.bg || own.en : own.en) : (K.flang === 'bg' ? d.n.menuBg : d.n.menuEn || d.n.menuBg) || ''; };
  function tastingCard(plain) {
    const t = K.tasting();
    if (!t.courses.length) return K.canEdit() ? h('button', { type: 'button', class: 'al-nudge plain', onclick: () => { ui.sheet = { type: 'tasting' }; K.render(); } },
      K.icon('list'), h('span', null, h('b', null, 'Set up the tasting menu'), h('span', null, 'Pick its courses from the dishes, in order.')), K.icon('next')) : null;
    return h('section', { class: 'tasting' },
      h('div', { class: 'ts-head' }, h('div', null, h('span', { class: 'kicker dish ts-kick' }, h('span', null, t.courses.length + ' courses' + (t.price ? ' · ' + K.price(t.price) : '')), t.pairing ? h('span', null, K.T(t.pairingName).toLowerCase() + ' ' + K.price(t.pairing)) : null), h('h2', null, t.name)),
        K.canEdit() ? h('button', { class: 'btn small', type: 'button', onclick: () => { ui.sheet = { type: 'tasting' }; K.render(); } }, K.icon('edit'), 'Edit') : null),
      t.note ? h('p', { class: 'muted' }, t.note) : null,
      t.pairing ? h('p', { class: 'ts-pour' }, K.icon('glass'), h('span', null, h('b', null, 'Pairing pour: about ' + K.PAIR_ML + ' ml of each wine. '), 'A bottle gives ' + Math.floor(750 / K.PAIR_ML) + ' pours. A normal glass is ' + K.GLASS_ML + ' ml.')) : null,
      t.welcome ? wineLine('To start', t.welcome) : null,
      h('ol', { class: 'ts-list' }, t.courses.map((d, i) => h('li', null, h('button', { type: 'button', onclick: () => K.go('dish', { id: d.id }) },
        h('span', { class: 'ts-n mono' }, String(i + 1)), h('span', { class: 'ts-name' }, h('b', null, d.name), d.en && d.en !== d.name ? h('span', { class: 'card-en' }, d.en) : null,
          /* its line, as the menu prints it */
          courseLine(t, d) ? h('span', { class: 'ts-line' }, courseLine(t, d)) : null)),
        t.wines[d.id] ? wineLine('', t.wines[d.id]) : null))),
      plain ? null : h('button', { type: 'button', class: 'btn ts-build', onclick: () => { ui.foodTab = 'tasting'; K.render(); window.scrollTo(0, 0); } }, K.icon('shield'), 'Build it for a guest with allergies'),
      t.extra ? h('button', { type: 'button', class: 'ts-extra', onclick: () => K.go('dish', { id: t.extra.dish.id }) }, h('span', null, h('b', null, 'Can be added: ' + K.dn(t.extra.dish)), t.extra.price ? ' · ' + K.price(t.extra.price) : ''), K.icon('next')) : null);
  }
  /* what kind of course a dish is, for swapping: 'main', 'starter', 'sweet', or 'mezze' (dips and the bread, to share).
     From its place on the menu; a course only the tasting menu has says it itself (`course`), or its name does. */
  const courseKind = (d) => {
    const s = String(d.n.course || d.section || '').toLowerCase(), nm = String(d.en || d.name || '').toLowerCase() + ' ' + String(d.name || '').toLowerCase();
    if (/main|основн/.test(s)) return 'main';
    if (/dessert|finish|sweet|pastry|десерт|край/.test(s)) return 'sweet';
    if (/mezze|dip|мезе|разядк/.test(s)) return 'mezze';
    if (/starter|salad|soup|предяст|салат/.test(s)) return 'starter';
    return /wagyu|уагиу|beef|телешк|duck|патиц|патешк|lamb|агне|goat|яре|sea bass|милокоп/.test(nm) ? 'main' : /sorbet|сорбе|dessert|десерт/.test(nm) ? 'sweet' : /bread|хляб/.test(nm) ? 'mezze' : 'starter';
  };
  /* which stand-in comes first: one that is fine as it is, then one that is fine with a change, then one still to confirm */
  const RANK = { ok: 0, mod: 1, ask: 2 };
  K.courseKind = courseKind;
  const NO_SWAP = { main: 'No other main course is safe: ask the kitchen to adapt it', starter: 'No other starter is safe: ask the kitchen to adapt it', sweet: 'No other dessert is safe: ask the kitchen to adapt it', mezze: 'Nothing to serve in its place: ask the kitchen to adapt it' };
  /* for a guest with allergies: each course as it is, or what to serve in its place */
  function tastingFor(sel) {
    const t = K.tasting();
    if (!t.courses.length) return null;
    const inMenu = t.courses.map((d) => d.id), pick = (ui.tfPick = ui.tfPick || {});
    /* what can stand in: the à la carte dishes, without the one sold as an extra to the menu (the caviar) */
    const extraId = t.extra && t.extra.dish ? t.extra.dish.id : '';
    const pool = K.dishes().filter((d) => d.onMenu && d.n.only !== 'tasting' && !inMenu.includes(d.id) && d.id !== extraId).map((d) => ({ d: d, v: K.allergyVerdict(d, sel) })).filter((x) => x.v.state !== 'no');
    /* the menu as this guest gets it: each course as it is, changed, or replaced by the dish chosen for it */
    const used = {};
    const plan = t.courses.map((d) => {
      const v = K.allergyVerdict(d, sel);
      /* swaps: the same section first, confirmed dishes before unconfirmed ones */
      /* only a dish of the same kind stands in: a main for a main, a starter for a starter, a dessert for a dessert.
         A dip is a plate to share, so it replaces the bread course at most, never a plated one. */
      const swaps = v.state !== 'no' ? [] : pool.filter((x) => courseKind(x.d) === courseKind(d)).sort((a, b) => (b.d.section === d.section) - (a.d.section === d.section) || RANK[a.v.state] - RANK[b.v.state]).slice(0, 4);
      /* unless one was tapped, the first dish no earlier course already took: a guest should not get the same plate twice */
      const chosen = swaps.find((x) => x.d.id === pick[d.id]) || swaps.find((x) => !used[x.d.id]) || swaps[0] || null;
      if (chosen) used[chosen.d.id] = 1;
      return { d: d, v: v, swaps: swaps, chosen: chosen };
    });
    const rows = plan.map((c, i) => {
      const d = c.d, v = c.v;
      return h('li', { class: 'tf-row alr-' + v.state },
        h('span', { class: 'ts-n mono' }, String(i + 1)),
        h('div', { class: 'tf-txt' },
          h('button', { type: 'button', class: 'tf-name' + (v.state === 'no' ? ' struck' : ''), onclick: () => K.go('dish', { id: d.id }) }, d.name),
          v.state === 'mod' ? h('span', { class: 'alr-fix' }, v.notes.join(' · ')) : v.hits.length ? h('span', { class: 'alr-why' }, v.hits.map((hh) => h('span', null, h('b', null, K.alName(hh.k)), whereText(hh, 2)))) : v.state === 'ask' ? h('span', { class: 'muted tf-ask' }, 'Not confirmed yet: ask the kitchen') : null,
          c.swaps.length ? h('div', { class: 'tf-swap', role: 'group', 'aria-label': 'Serve instead of ' + d.name }, h('span', { class: 'label' }, 'Serve instead'),
            c.swaps.map((x) => h('button', { type: 'button', class: 'tf-chip' + (x.v.state === 'ask' ? ' ask' : ''), 'aria-pressed': c.chosen === x ? 'true' : 'false', onclick: () => { pick[d.id] = x.d.id; K.render(); } }, K.dn(x.d), x.v.state === 'ask' ? ' ?' : '')))
            : v.state === 'no' ? h('span', { class: 'muted tf-ask' }, NO_SWAP[courseKind(d)]) : null),
        h('span', { class: 'alr-mark', 'aria-hidden': 'true' }, K.icon(v.state === 'ok' ? 'check' : v.state === 'mod' ? 'edit' : v.state === 'no' ? 'close' : 'alert')));
    });
    const asIs = plan.filter((c) => c.v.state !== 'no').length;
    /* the note for the kitchen: who it is for and every course, with what changes */
    /* the note for the kitchen, in the language on screen: Bulgarian names for a Bulgarian kitchen */
    const nm = (d) => (K.bgMode() ? d.name : K.dn(d)), up = (v) => K.T(v.notes.join(' · ')).toUpperCase();
    const kitchenLine = (c, i) => (i + 1) + '. ' + (c.v.state === 'no'
      ? (c.chosen ? nm(c.chosen.d) + K.T(' (instead of ') + nm(c.d) + ')' + (c.chosen.v.state === 'ask' ? K.T(' - CONFIRM') : c.chosen.v.state === 'mod' ? ' - ' + up(c.chosen.v) : '') : nm(c.d) + K.T(' - CANNOT, kitchen to adapt'))
      : nm(c.d) + (c.v.state === 'mod' ? ' - ' + up(c.v) : c.v.state === 'ask' ? K.T(' - CONFIRM') : ''));
    const text = K.T(t.name + ' for a guest: ') + sel.map((k) => K.T(K.alName(k))).join(', ') + '\n' + plan.map((c, i) => kitchenLine(c, i)).join('\n');
    const changed = plan.filter((c) => c.v.state !== 'ok').length;
    return h('section', { class: 'group tf' }, h('h2', { class: 'group-title' }, t.name + ' for this guest', h('span', { class: 'n' }, asIs + ' of ' + t.courses.length + ' as they are')),
      h('p', { class: 'hint' }, 'Tap a dish under “Serve instead” to choose the swap. “?” means its allergens are not confirmed yet. The kitchen has the last word.'),
      h('p', { class: 'hint' }, 'A course is only replaced by one of its kind: a main by a main, a starter by a starter, a dessert by a dessert. A dip never replaces a plated course.'),
      h('ol', { class: 'tf-list' }, rows),
      h('div', { class: 'tf-out' },
        h('span', { class: 'label' }, 'For the kitchen'),
        h('ol', { class: 'tf-final' }, plan.map((c) => h('li', { class: c.v.state === 'ok' ? '' : 'chg' },
          c.v.state === 'no' ? (c.chosen ? [h('b', null, K.dn(c.chosen.d)), h('small', null, ' instead of ' + K.dn(c.d) + (c.chosen.v.state === 'ask' ? ' · confirm' : c.chosen.v.state === 'mod' ? ' · ' + c.chosen.v.notes.join(' · ').toLowerCase() : ''))] : [h('b', null, K.dn(c.d)), h('small', null, ' cannot have it · kitchen to adapt')])
            : [h('b', null, K.dn(c.d)), c.v.state === 'mod' ? h('small', null, ' ' + c.v.notes.join(' · ').toLowerCase()) : c.v.state === 'ask' ? h('small', null, ' confirm') : null]))),
        h('button', { type: 'button', class: 'btn primary wide', onclick: () => navigator.clipboard.writeText(text).then(() => K.toast('Copied: paste it to the kitchen'), () => K.toast('This device would not copy.')) }, K.icon('copy'), changed ? 'Copy this menu for the kitchen' : 'Copy for the kitchen')));
  }
  K.SHEETS.tasting = function (S) {
    const cur = D.tasting || {};
    if (!S.f) S.f = { name: cur.name || 'Tasting menu', price: cur.price || '', pairing: cur.pairing || '', note: cur.note || '', courses: (cur.courses || []).filter((id) => K.dish(id)) };
    const f = S.f, all = K.dishes().filter((d) => !f.courses.includes(d.id));
    const move = (i, by) => { const c = f.courses, j = i + by; if (j < 0 || j >= c.length) return; const t = c[i]; c[i] = c[j]; c[j] = t; K.render(); };
    const inp = (k, attrs) => h('input', Object.assign({ class: 'input', id: 'ts-' + k, value: f[k], oninput: (e) => { f[k] = e.target.value; } }, attrs || {}));
    return K.sheet('The tasting menu', h('form', { class: 'stack', onsubmit: (e) => {
      e.preventDefault();
      K.saveSetting('tasting', Object.assign({}, cur, { name: f.name.trim() || 'Tasting menu', price: f.price.trim(), pairing: f.pairing.trim(), note: f.note.trim(), courses: f.courses })).then(() => K.toast('Tasting menu saved'));
      ui.sheet = null; K.render();
    } },
      h('div', { class: 'two' }, K.field('Name', inp('name')), K.field('Price', inp('price', { inputmode: 'decimal' }))),
      K.field('Wine pairing price', inp('pairing', { inputmode: 'decimal' })),
      K.field('Note', inp('note', { placeholder: 'For the whole table · wine pairing +45' })),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Courses, in order'),
        f.courses.length ? h('ol', { class: 'ts-edit' }, f.courses.map((id, i) => h('li', null, h('span', { class: 'ts-n mono' }, String(i + 1)), h('b', null, K.dish(id).name),
          h('span', { class: 'sr-btns' },
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, K.icon('up')),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Move down', disabled: i === f.courses.length - 1, onclick: () => move(i, 1) }, K.icon('down')),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove', onclick: () => { f.courses.splice(i, 1); K.render(); } }, K.icon('close')))))) : h('p', { class: 'muted' }, 'No courses yet.'),
        all.length ? K.select([['', 'Add a course…']].concat(all.map((d) => [d.id, d.name])), '', (v) => { if (v) { f.courses.push(v); K.render(); } }, { 'aria-label': 'Add a course' }) : null,
        h('p', { class: 'hint' }, 'A course that is not in the list yet? Add it to the food bible first (Food → Add).')),
      h('button', { class: 'btn primary', type: 'submit' }, 'Save')), { wide: true });
  };

  /* the menu's order: breakfast, starters, mains, desserts; anything else after, by name */
  const ORDER = ['breakfast', 'brunch', 'bread', 'mezze', 'starter', 'salad', 'soup', 'main', 'meat', 'fish', 'side', 'garnish', 'dessert', 'pastry', 'finish'];
  const rank = (s) => { s = String(s).toLowerCase(); const i = ORDER.findIndex((k) => s.includes(k)); return i < 0 ? 99 : i; };
  const secOrder = (a, b) => rank(a) - rank(b) || a.localeCompare(b);
  const dietTag = (d) => [d.n.diet && d.n.diet !== 'meat' ? h('span', { class: 'diet-tag d-' + d.n.diet }, K.DIET[d.n.diet]) : null,
    d.n.canDiet ? h('span', { class: 'diet-tag can d-' + d.n.canDiet }, K.DIET[d.n.canDiet] + ' on request') : null];
  function card(d) {
    const al = K.dishAllergens(d).keys, pairs = (d.n.pairs || []).map(K.wine).filter(Boolean);
    return h('button', { class: 'rcard', type: 'button', onclick: (e) => { if (K.morphFrom) K.morphFrom(e.currentTarget); K.go('dish', { id: d.id }); } },
      K.dishThumb(d),
      h('div', { class: 'card-txt' },
        h('span', { class: 'kicker dish' }, d.section + (d.price ? ' · ' + K.price(d.price) : '')),
        h('span', { class: 'card-name' }, d.name),
        d.en && d.en !== d.name ? h('span', { class: 'card-en' }, d.en) : null,
        h('span', { class: 'card-meta' },
          dietTag(d),
          al.length ? h('span', null, al.length + (al.length === 1 ? ' allergen' : ' allergens')) : h('span', null, 'No allergens found'),
          pairs.length ? h('span', null, K.icon('glass'), pairs.length === 1 ? pairs[0].name : pairs.length + ' wines') : null),
        d.hide || !d.onMenu || d.example || (K.canEdit() && !d.n.pitch) ? h('span', { class: 'card-pills' },
          d.hide ? h('span', { class: 'pill muted' }, 'Hidden from the floor') : null,
          !d.onMenu ? h('span', { class: 'pill muted' }, 'Off the menu') : null,
          d.example ? h('span', { class: 'pill muted' }, 'Example') : null,
          K.canEdit() && !d.n.pitch ? h('span', { class: 'pill' }, 'Needs what to say') : null) : null));
  }

  /* ---------- ingredients ---------- */
  function ingList() {
    const all = K.ingredients().filter((e) => K.matches(e.name + ' ' + e.en + ' ' + e.what + ' ' + e.dishes.map((d) => d.name).join(' '), ui.q));
    if (!all.length) return h('div', { class: 'empty' }, h('strong', null, ui.q ? 'No ingredient called “' + ui.q.trim() + '”' : 'No ingredients yet'), ui.q ? 'Try the Bulgarian or the English name.' : 'They come from the dishes on the menu.');
    const explained = all.filter((e) => e.what), rest = all.filter((e) => !e.what);
    const row = (e) => h('button', { type: 'button', class: 'ing-row' + (K.ingArt(e.key) ? ' has-art' : ''), onclick: () => { ui.sheet = { type: 'ingredient', key: e.key }; K.render(); } },
      K.ingArt(e.key) ? h('img', { class: 'ing-thumb', src: K.ingArt(e.key), alt: '', loading: 'lazy' }) : null,
      h('span', { class: 'ing-name' }, h('b', null, e.name), e.en ? h('span', { class: 'ing-en' }, e.en) : null),
      e.what ? h('span', { class: 'ing-what' }, e.what) : null,
      h('span', { class: 'ing-in' }, 'In ' + e.dishes.map((d) => d.name).join(', ')),
      alChips(K.allergensIn ? K.allergensIn(e.name) : []));
    return h('div', null,
      explained.length ? h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'Explained', h('span', { class: 'n' }, String(explained.length))), h('div', { class: 'ing-list' }, explained.map(row))) : null,
      rest.length ? h('section', { class: 'group' }, h('h2', { class: 'group-title' }, explained.length ? 'Everything else' : 'Ingredients', h('span', { class: 'n' }, String(rest.length))), h('div', { class: 'ing-list' }, rest.map(row))) : null);
  }
  function alChips(keys, big) {
    keys = K.orderAl ? K.orderAl(keys || []) : keys || [];
    return keys.length ? h('span', { class: 'al-chips' + (big ? '' : ' mini') }, keys.map((k) => h('span', { class: 'al' }, K.AL[k] || k))) : null;
  }
  K.SHEETS.ingredient = function (S) {
    const e = K.ingredients().find((x) => x.key === S.key);
    if (!e) return null;
    const al = K.allergensIn ? K.allergensIn(e.name) : [];
    const art = K.ingArt(e.key);
    const body = h('div', { class: 'stack' },
      art ? h('figure', { class: 'ing-art' }, h('img', { src: art, alt: e.en || e.name }), h('figcaption', { class: 'art-tag' }, 'Illustration')) : null,
      e.en ? h('p', { class: 'ing-en big' }, e.en) : null,
      e.what ? h('p', { class: 'prose' }, e.what) : h('p', { class: 'muted' }, 'Nothing written about it yet.'),
      al.length ? h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Allergens'), alChips(al, true)) : null,
      e.dishes.length ? h('div', { class: 'field' }, h('span', { class: 'legend' }, 'In these dishes'),
        h('div', { class: 'mini-list' }, e.dishes.map((d) => h('button', { type: 'button', class: 'mini-dish', onclick: () => K.go('dish', { id: d.id }) }, K.dishThumb(d, 'sm'), h('span', null, d.name))))) : null);
    if (K.canEdit()) {
      const en = h('input', { class: 'input', id: 'g-en', value: e.g.en || e.en || '', placeholder: 'English name' });
      const what = h('textarea', { class: 'input', id: 'g-what', rows: '4', value: e.g.what || e.what || '', placeholder: 'What it is, where it comes from, what it tastes like' });
      body.append(h('form', { class: 'stack edit-box', onsubmit: (ev) => {
        ev.preventDefault();
        K.saveGloss(e.key, { name: e.name, en: en.value.trim(), what: what.value.trim() }).then(() => K.toast('Saved'));
      } }, h('h3', null, 'Explain it for the floor'), K.field('In English', en), K.field('What to tell a guest', what), h('button', { class: 'btn primary', type: 'submit' }, 'Save')));
    }
    return K.sheet(e.name, body);
  };

  /* ---------- a dish ---------- */
  K.V.dish = function () {
    const d = K.dish(ui.id);
    if (!d) return { body: K.loadingBox() };
    const n = d.n, al = K.dishAllergens(d), pairs = (n.pairs || []).map(K.wine).filter(Boolean);
    const body = h('div', { class: 'wrap page recipe dish-page' });
    const art = K.dishArt(d);
    body.append(h('div', { class: 'rhead' + (d.photo || art ? ' has-photo' : '') },
      d.photo ? h('button', { type: 'button', class: 'dish-photo-btn', 'aria-label': 'Open photos of ' + d.name, onclick: () => K.openPhotos([{ id: d.photo, title: d.name }].concat((d.r && d.r.gallery) || []), 0) },
        K.morphTo ? K.morphTo(h('img', { class: 'dish-photo', src: K.media(d.photo), alt: d.name })) : h('img', { class: 'dish-photo', src: K.media(d.photo), alt: d.name }))
        : art ? h('figure', { class: 'dish-photo-btn art' }, h('img', { class: 'dish-photo', src: art, alt: '' }), h('figcaption', { class: 'art-tag' }, 'Illustration, not our plating')) : null,
      h('div', { class: 'rhead-txt' },
        h('p', { class: 'kicker dish' }, d.section + (d.price ? ' · ' + K.price(d.price) : '')),
        h('h1', { class: 'rtitle' }, d.name),
        d.en && d.en !== d.name ? h('p', { class: 'en-name' }, d.en) : null,
        n.menuBg || n.menuEn ? h('p', { class: 'menu-line' }, h('span', { class: 'label' }, 'On the menu'), n.menuBg ? h('span', null, n.menuBg) : null, n.menuEn ? h('span', { class: 'ing-en' }, n.menuEn) : null) : null,
        h('div', { class: 'meta-chips' },
          dietTag(d),
          !d.onMenu ? h('span', { class: 'mchip off' }, 'Off the menu') : null,
          d.hide ? h('span', { class: 'mchip off' }, 'Hidden from the floor') : null,
          d.example ? h('span', { class: 'mchip' }, 'Example') : null),
        guestBanner(d),
        K.pairFor(d).house.length || (n.only !== 'tasting' && K.pairFor(d).style.length) ? h('button', { type: 'button', class: 'btn pour-btn', onclick: () => { ui.sheet = { type: 'pair', id: d.id }; K.render(); } }, K.icon('glass'), 'What to pour with it') : null,
        n.pitch ? h('blockquote', { class: 'say' }, K.icon('quote'), h('div', null, h('span', { class: 'label' }, 'What to say at the table'), h('p', null, n.pitch)))
          : h('p', { class: 'say empty-say' }, K.canEdit() ? 'Nothing written yet for the table. Tap Edit to add what to say.' : 'The floor manager has not written what to say yet.'),
        h('section', { class: 'allergens' },
          h('div', { class: 'al-head' }, h('span', { class: 'label' }, 'Allergens'),
            h('span', { class: 'al-status' + (al.checked ? ' ok' : '') }, al.checked ? 'Confirmed' : 'Found from the ingredients · not confirmed yet')),
          al.keys.length ? alChips(al.keys, true) : h('p', { class: 'none' }, 'None of the 14 allergens found.'),
          n.butterOnly || n.bread || n.canDiet ? h('ul', { class: 'al-notes' },
            n.canDiet ? h('li', null, h('b', null, 'Can be made ' + K.DIET[n.canDiet].toLowerCase() + (n.canHow ? ': ' + n.canHow + '. ' : ' on request. ')), (n.canAl || []).length ? 'Then it has no ' + n.canAl.map((k) => K.AL[k].toLowerCase()).join(', ') + '.' : 'Its allergens stay the same.') : null,
            n.butterOnly ? h('li', null, h('b', null, 'The only dairy is butter. '), 'Fine for guests who avoid lactose but eat butter; not for a milk allergy.') : null,
            n.bread ? h('li', null, h('b', null, 'Can be served without the bread. '), (n.breadAl || []).length ? 'Then it has no ' + n.breadAl.map((k) => K.AL[k].toLowerCase()).join(', ') + '.' : 'Its allergens stay the same.') : null) : null,
          h('p', { class: 'hint' }, 'Always check with the kitchen for a guest with an allergy.'),
          K.canCheck(d) ? h('div', { class: 'btns' }, h('button', { class: 'btn small', type: 'button', onclick: () => { ui.sheet = { type: 'alcheck', ids: [d.id], i: 0 }; K.render(); } }, K.icon('check'), al.checked ? 'Check again' : 'Confirm the allergens')) : null))));

    if (n.story) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'The story'), h('p', { class: 'prose' }, n.story)));
    if ((n.niche || []).length) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'Ingredients guests ask about'),
      h('dl', { class: 'niche' }, n.niche.map((x) => [h('dt', null, K.ingArt(K.ingKey(x.n)) ? h('button', { type: 'button', class: 'niche-art', 'aria-label': 'About ' + x.n, onclick: () => { ui.sheet = { type: 'ingredient', key: K.ingKey(x.n) }; K.render(); } }, h('img', { src: K.ingArt(K.ingKey(x.n)), alt: '', loading: 'lazy' })) : null, x.n, K.en(x.n) ? h('span', { class: 'ing-en' }, K.en(x.n)) : null), h('dd', null, x.what || '')]))));
    if (lines(n.facts).length) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'Good to know'), h('ul', { class: 'facts' }, lines(n.facts).map((f) => h('li', null, f)))));
    if (pairs.length || n.pairText) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'Wine with it'),
      n.pairText ? h('p', { class: 'prose' }, n.pairText) : null,
      pairs.length ? h('div', { class: 'grid' }, pairs.map((w) => K.wineCard(w))) : null));
    if (d.ings.length) {
      body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'What is in it'),
        d.parts.length ? h('p', { class: 'muted' }, d.parts.length + ' parts: ' + d.parts.join(', ')) : null,
        h('div', { class: 'ing-chips' }, d.ings.map((x) => {
          const key = K.ingKey(x), en = K.en(x);
          return h('button', { type: 'button', class: 'ing-chip', onclick: () => { ui.sheet = { type: 'ingredient', key: key }; K.render(); } }, String(x).split(/[,(]/)[0].trim(), en ? h('span', null, en) : null);
        }))));
    }
    if (d.r) body.append(h('p', { class: 'kitchen-link' }, h('a', { href: K.kitchenLink(d.r.id), class: 'btn' }, K.icon('kitchen'), 'Open the recipe in the kitchen book')));
    return {
      top: K.subbar('Food', () => K.back('food'), [K.canEdit() ? h('button', { type: 'button', class: 'btn small', onclick: () => { ui.sheet = { type: 'dishedit', id: d.id }; K.render(); } }, K.icon('edit'), 'Edit') : null], d.name),
      body: body, tabs: false,
    };
  };

  /* with allergies ticked, a dish page says straight away whether it is for this guest */
  function guestBanner(d) {
    const sel = alSel();
    if (!sel.length) return null;
    const v = K.allergyVerdict(d, sel);
    const none = 'Nothing against ' + sel.map((k) => K.alName(k).toLowerCase()).join(', ');
    return h('div', { class: 'al-verdict alr-' + v.state, role: 'status' }, K.icon(v.state === 'ok' ? 'check' : v.state === 'mod' ? 'edit' : v.state === 'no' ? 'close' : 'alert'),
      h('div', null,
        h('b', null, v.state === 'no' ? 'Not for this guest' : v.state === 'ok' ? 'Fine for this guest' : v.state === 'mod' ? 'Fine with a change' : 'Ask the kitchen first'),
        h('p', null, v.state === 'no' ? v.hits.map((x) => K.alName(x.k) + whereText(x)).join('; ') + '.'
          : v.state === 'mod' ? v.notes.join('. ') + '. Write it on the order, so the kitchen sees it.'
            : (v.notes.length ? v.notes.join('. ') + '. ' : '') + (v.state === 'ok' ? none + ' (confirmed).' : none + ' found, but the dish is not checked yet.'))));
  }

  /* ---------- editing (floor managers and chefs) ---------- */
  K.SHEETS.dishedit = function (S) {
    const d = K.dish(S.id), n = (d && d.n) || {}, own = d && !d.r;
    if (!S.f) {
      /* in Bulgarian the texts for the table are the dish's Bulgarian ones; the English stay as they are */
      const bgm = K.bgMode() && !!d, b = n.bg || {}, tx = (k) => (bgm ? b[k] || '' : n[k] || '');
      S.f = { menuName: n.menuName || '', name: n.name || (d ? d.name : ''), en: n.en || (d ? d.en : ''), section: n.section || '', price: n.price || '', order: n.order || '', pitch: tx('pitch'), story: tx('story'),
        facts: tx('facts'), niche: (n.niche || []).map((x) => { const what = bgm ? (b.niche || {})[x.n] || '' : x.what; return x.n + (what ? ' — ' + what : ''); }).join('\n'), pairs: (n.pairs || []).slice(), pairText: tx('pairText'),
        hide: !!n.hide, ings: (n.ings || []).join('\n'), allergens: (n.allergens || []).slice() };
    }
    const f = S.f;
    const inp = (k, attrs) => h('input', Object.assign({ class: 'input', id: 'de-' + k, value: f[k], oninput: (e) => { f[k] = e.target.value; } }, attrs || {}));
    const area = (k, rows, ph) => h('textarea', { class: 'input', id: 'de-' + k, rows: String(rows), value: f[k], placeholder: ph || '', oninput: (e) => { f[k] = e.target.value; } });
    const save = (e) => {
      e.preventDefault();
      const niche = lines(f.niche).map((l) => { const m = l.match(/^(.+?)\s*(?:—|–| - |:)\s*(.+)$/); return m ? { n: m[1].trim(), what: m[2].trim() } : { n: l, what: '' }; });
      const patch = { en: f.en.trim(), section: f.section.trim(), price: f.price.trim(), order: f.order === '' ? undefined : +f.order || 0, pitch: f.pitch.trim(), story: f.story.trim(), facts: f.facts.trim(), niche: niche, pairs: f.pairs, pairText: f.pairText.trim(), hide: f.hide };
      if (K.bgMode() && d) {
        /* what was typed is the Bulgarian; the English texts go back as they were (a text with no English yet is kept in both) */
        const was = {}, whats = {};
        (n.niche || []).forEach((x) => { was[x.n] = x.what; });
        niche.forEach((x) => { if (x.what) whats[x.n] = x.what; });
        patch.bg = Object.assign({}, n.bg, { pitch: patch.pitch, story: patch.story, facts: patch.facts, pairText: patch.pairText, niche: whats });
        ['pitch', 'story', 'facts', 'pairText'].forEach((k) => { patch[k] = n[k] || patch[k]; });
        patch.niche = niche.map((x) => ({ n: x.n, what: was[x.n] || x.what }));
      }
      if (own || !d) { patch.name = f.name.trim(); patch.ings = lines(f.ings); patch.allergens = f.allergens; if (!patch.name) { K.toast('Give the dish a name.', { tone: 'bad' }); return; } }
      else { patch.recipe = d.r.id; patch.menuName = f.menuName.trim(); }
      const id = d ? d.id : 'own-' + K.uid();
      K.saveNote(id, patch).then(() => K.toast('Saved'));
      ui.sheet = null;
      if (!d) K.go('dish', { id: id }); else K.render();
    };
    const wines = K.listWines();
    return K.sheet(d ? 'Edit ' + d.name : 'A dish of the floor’s own', h('form', { class: 'stack', onsubmit: save },
      K.bgMode() && d ? h('p', { class: 'banner' }, 'You are writing the Bulgarian texts. The English ones stay as they are; switch the language in Settings to change them.') : null,
      own || !d ? K.field('Name on the menu', inp('name', { required: true })) : K.field('Name on the menu', inp('menuName', { placeholder: d.kname }), 'The kitchen calls it “' + d.kname + '”. Leave empty to use that; write the name as printed on the menu to correct it for the floor.'),
      own || !d ? null : h('p', { class: 'hint' }, 'The name, the photo and the ingredients come from the kitchen book. Here you write what the floor needs.'),
      K.field('In English', inp('en'), d && d.r && K.en(d.name) ? 'From the kitchen’s translation list: ' + K.en(d.name) : 'How you say it to a guest who does not speak Bulgarian.'),
      h('div', { class: 'two' }, K.field('Section', inp('section', { placeholder: (d && d.r && d.r.category) || 'Starters' })), K.field('Price', inp('price', { inputmode: 'decimal', placeholder: '18' }))),
      K.field('What to say at the table', area('pitch', 4, 'Two or three sentences a waiter says when bringing it.')),
      K.field('The story', area('story', 3, 'Where the dish comes from, why it is on our menu.')),
      K.field('Ingredients guests ask about', area('niche', 4, 'One per line: name — what it is\nлевурда — wild garlic, picked in spring'), 'One per line, the name, a dash, then what to tell the guest.'),
      K.field('Good to know', area('facts', 3, 'One fact per line'), 'Interesting facts, one per line. They also go into the quiz.'),
      own || !d ? K.field('What is in it', area('ings', 3, 'One ingredient per line'), 'Allergens are found from these.') : null,
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Wines that go with it'),
        wines.length ? h('div', { class: 'check-list' }, wines.map((w) => h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: f.pairs.includes(w.id), onchange: (e) => { f.pairs = e.target.checked ? f.pairs.concat([w.id]) : f.pairs.filter((x) => x !== w.id); } }),
          h('span', null, K.wineTitle(w))))) : h('p', { class: 'hint' }, 'Add wines in the Wine tab first.')),
      K.field('Why they go together', area('pairText', 2, 'The acidity cuts through the hollandaise…')),
      h('div', { class: 'two' }, K.field('Order in the section', inp('order', { inputmode: 'numeric', placeholder: '1' })),
        h('label', { class: 'check big' }, h('input', { type: 'checkbox', checked: f.hide, onchange: (e) => { f.hide = e.target.checked; } }), h('span', null, 'Hide from the floor'))),
      h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'submit' }, 'Save'),
        d && D.notes[d.id] ? h('button', { class: 'btn danger', type: 'button', onclick: () => {
          if (!S.sure) { S.sure = true; K.render(); return; }
          K.deleteNote(d.id); ui.sheet = null; if (own) K.go('food'); else K.render(); K.toast('Floor notes removed');
        } }, S.sure ? 'Tap again to remove' : own ? 'Delete this dish' : 'Clear the floor notes') : null)), { wide: true });
  };

  /* add: a kitchen dish or recipe that is not showing yet, or a dish of the floor's own */
  K.SHEETS.adddish = function (S) {
    const shown = {};
    K.dishes(true).forEach((d) => { shown[d.id] = 1; });
    const more = D.recipes.filter((r) => !shown[r.id] && K.matches(r.name + ' ' + r.category, S.q || '')).sort((a, b) => a.name.localeCompare(b.name));
    return K.sheet('Add to the food bible', h('div', { class: 'stack' },
      h('button', { class: 'set-link', type: 'button', onclick: () => { ui.sheet = { type: 'dishedit', id: null }; K.render(); } }, K.icon('plus'),
        h('span', null, h('b', null, 'A dish of the floor’s own'), h('span', { class: 'muted' }, 'Bread, the amuse-bouche, anything not in the kitchen book')), K.icon('next')),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'From the kitchen book'),
        h('input', { class: 'input', id: 'ad-q', type: 'search', placeholder: 'Search the kitchen’s recipes', value: S.q || '', oninput: (e) => { S.q = e.target.value; K.render(); } }),
        h('p', { class: 'hint' }, 'Dishes on the menu are already in. Add a recipe the kitchen keeps as a recipe (a cake, the gyoza) so the floor can talk about it.'),
        more.length ? h('div', { class: 'mini-list col' }, more.slice(0, 40).map((r) => h('button', { type: 'button', class: 'set-link', onclick: () => {
          K.saveNote(r.id, { recipe: r.id }); ui.sheet = { type: 'dishedit', id: r.id }; K.render();
        } }, h('span', null, h('b', null, r.name), h('span', { class: 'muted' }, (r.category || '') + (r.onMenu ? '' : ' · off the menu'))), K.icon('plus')))) : h('p', { class: 'muted' }, 'Nothing else in the kitchen book.'))));
  };
})();
