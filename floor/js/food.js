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
    w.append(K.searchBox('fq', ui.q, ui.foodTab === 'ings' ? 'Search an ingredient, in Bulgarian or English' : 'Search a dish, ingredient or allergen', (v) => { ui.q = v; results(); }));
    w.append(h('div', { class: 'chips filters' },
      K.seg([['dishes', 'Dishes'], ['ings', 'Ingredients']], ui.foodTab, (v) => { ui.foodTab = v; K.render(); }, { 'aria-label': 'Show', class: 'seg small-seg' }),
      K.canEdit() ? h('button', { type: 'button', class: 'chip', onclick: () => { ui.sheet = { type: 'adddish' }; K.render(); } }, K.icon('plus'), 'Add') : null));
    if (ui.foodTab !== 'ings' && D.loaded && all.length) {
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
    return [d.name, d.en, d.section, d.ings.join(' '), d.ings.map(K.en).join(' '), al.join(' '), (d.n.niche || []).map((x) => x.n + ' ' + x.what).join(' '), d.parts.join(' ')].join(' ');
  }
  function results() {
    const box = document.getElementById('results');
    if (!box) return;
    box.textContent = '';
    if (!D.loaded) { box.append(K.loadingBox('Loading the menu')); return; }
    if (ui.foodTab === 'ings') { box.append(ingList()); return; }
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
  /* the menu's order: breakfast, starters, mains, desserts; anything else after, by name */
  const ORDER = ['breakfast', 'brunch', 'bread', 'starter', 'salad', 'soup', 'main', 'meat', 'fish', 'side', 'garnish', 'dessert', 'pastry'];
  const rank = (s) => { s = String(s).toLowerCase(); const i = ORDER.findIndex((k) => s.includes(k)); return i < 0 ? 99 : i; };
  const secOrder = (a, b) => rank(a) - rank(b) || a.localeCompare(b);
  function card(d) {
    const al = K.dishAllergens(d).keys, pairs = (d.n.pairs || []).map(K.wine).filter(Boolean);
    return h('button', { class: 'rcard', type: 'button', onclick: (e) => { if (K.morphFrom) K.morphFrom(e.currentTarget); K.go('dish', { id: d.id }); } },
      K.dishThumb(d),
      h('div', { class: 'card-txt' },
        h('span', { class: 'kicker dish' }, d.section + (d.price ? ' · ' + K.price(d.price) : '')),
        h('span', { class: 'card-name' }, d.name),
        d.en && d.en !== d.name ? h('span', { class: 'card-en' }, d.en) : null,
        h('span', { class: 'card-meta' },
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
    const row = (e) => h('button', { type: 'button', class: 'ing-row', onclick: () => { ui.sheet = { type: 'ingredient', key: e.key }; K.render(); } },
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
    const body = h('div', { class: 'stack' },
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
        h('div', { class: 'meta-chips' },
          !d.onMenu ? h('span', { class: 'mchip off' }, 'Off the menu') : null,
          d.hide ? h('span', { class: 'mchip off' }, 'Hidden from the floor') : null,
          d.example ? h('span', { class: 'mchip' }, 'Example') : null),
        n.pitch ? h('blockquote', { class: 'say' }, K.icon('quote'), h('div', null, h('span', { class: 'label' }, 'What to say at the table'), h('p', null, n.pitch)))
          : h('p', { class: 'say empty-say' }, K.canEdit() ? 'Nothing written yet for the table. Tap Edit to add what to say.' : 'The floor manager has not written what to say yet.'),
        h('section', { class: 'allergens' },
          h('div', { class: 'al-head' }, h('span', { class: 'label' }, 'Allergens'),
            d.r ? h('span', { class: 'al-status' + (al.checked ? ' ok' : '') }, al.checked ? 'Checked by the head chef' : 'Found from the kitchen’s ingredients · not yet checked') : null),
          al.keys.length ? alChips(al.keys, true) : h('p', { class: 'none' }, 'None of the 14 allergens found.'),
          h('p', { class: 'hint' }, 'Always check with the kitchen for a guest with an allergy.')))));

    if (n.story) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'The story'), h('p', { class: 'prose' }, n.story)));
    if ((n.niche || []).length) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'Ingredients guests ask about'),
      h('dl', { class: 'niche' }, n.niche.map((x) => [h('dt', null, x.n, K.en(x.n) ? h('span', { class: 'ing-en' }, K.en(x.n)) : null), h('dd', null, x.what || '')]))));
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

  /* ---------- editing (floor managers and chefs) ---------- */
  K.SHEETS.dishedit = function (S) {
    const d = K.dish(S.id), n = (d && d.n) || {}, own = d && !d.r;
    if (!S.f) {
      S.f = { name: n.name || (d ? d.name : ''), en: n.en || (d ? d.en : ''), section: n.section || '', price: n.price || '', order: n.order || '', pitch: n.pitch || '', story: n.story || '',
        facts: n.facts || '', niche: (n.niche || []).map((x) => x.n + (x.what ? ' — ' + x.what : '')).join('\n'), pairs: (n.pairs || []).slice(), pairText: n.pairText || '',
        hide: !!n.hide, ings: (n.ings || []).join('\n'), allergens: (n.allergens || []).slice() };
    }
    const f = S.f;
    const inp = (k, attrs) => h('input', Object.assign({ class: 'input', id: 'de-' + k, value: f[k], oninput: (e) => { f[k] = e.target.value; } }, attrs || {}));
    const area = (k, rows, ph) => h('textarea', { class: 'input', id: 'de-' + k, rows: String(rows), value: f[k], placeholder: ph || '', oninput: (e) => { f[k] = e.target.value; } });
    const save = (e) => {
      e.preventDefault();
      const niche = lines(f.niche).map((l) => { const m = l.match(/^(.+?)\s*(?:—|–| - |:)\s*(.+)$/); return m ? { n: m[1].trim(), what: m[2].trim() } : { n: l, what: '' }; });
      const patch = { en: f.en.trim(), section: f.section.trim(), price: f.price.trim(), order: f.order === '' ? undefined : +f.order || 0, pitch: f.pitch.trim(), story: f.story.trim(), facts: f.facts.trim(), niche: niche, pairs: f.pairs, pairText: f.pairText.trim(), hide: f.hide };
      if (own || !d) { patch.name = f.name.trim(); patch.ings = lines(f.ings); patch.allergens = f.allergens; if (!patch.name) { K.toast('Give the dish a name.', { tone: 'bad' }); return; } }
      else patch.recipe = d.r.id;
      const id = d ? d.id : 'own-' + K.uid();
      K.saveNote(id, patch).then(() => K.toast('Saved'));
      ui.sheet = null;
      if (!d) K.go('dish', { id: id }); else K.render();
    };
    const wines = K.winesSorted();
    return K.sheet(d ? 'Edit ' + d.name : 'A dish of the floor’s own', h('form', { class: 'stack', onsubmit: save },
      own || !d ? K.field('Name on the menu', inp('name', { required: true })) : h('p', { class: 'hint' }, 'The name, the photo and the ingredients come from the kitchen book. Here you write what the floor needs.'),
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
