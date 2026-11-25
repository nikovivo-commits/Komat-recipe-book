/* Tonight: the page a waitress opens before the first table. What is not available and what to offer instead,
   what is running low, which open bottles to taste, and the two things asked for most: the allergy check and
   finding a dish or a drink. Everything here is read from the other tabs; nothing is kept twice. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const title = (w) => (w.stockOnly ? w.name : K.wineTitle(w));
  const inStock = (x) => ['ok', 'low'].includes(K.stockState(x));
  /* what to offer when a drink is out: the same kind of spirit, or for wine, beer and soft drinks the same colour */
  K.offerInstead = function (w) {
    const pool = K.listWines().filter((x) => x.id !== w.id && !x.off && !x.nostock && x.colour === w.colour && inStock(x));
    const same = pool.find((x) => w.style && x.style === w.style);
    return same || (['spirit', 'liqueur'].includes(w.colour) ? null : pool[0]) || null;
  };
  const left = (n) => (n < 1 ? 'under one bottle' : n + ' left');

  K.V.tonight = function () {
    const body = h('div', { class: 'page' }), w = h('div', { class: 'wrap to' });
    body.append(w);
    const day = new Date().toLocaleDateString(K.locale || 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    w.append(h('div', { class: 'to-top' }, h('p', { class: 'label' }, day), h('h1', { class: 'ptitle' }, 'Tonight'), h('p', { class: 'psub' }, 'What to know before the first table.')));
    w.append(h('div', { class: 'to-acts' },
      h('button', { type: 'button', class: 'to-act primary', onclick: () => { ui.foodTab = 'allergy'; K.go('food'); } }, K.icon('shield'), h('span', null, 'Allergy check')),
      h('button', { type: 'button', class: 'to-act', onclick: () => { ui.sheet = { type: 'find', q: '' }; K.render(); const el = document.getElementById('findq'); if (el) el.focus(); } }, K.icon('search'), h('span', null, 'Find a dish or a drink'))));
    if (!D.winesLoaded) { w.append(K.loadingBox('Loading tonight')); return { body: body, solid: true }; }

    const take = K.takeOn();
    if (take) {
      const all = K.takeList(), done = all.filter((x) => K.countedIn(x, take)).length;
      w.append(h('button', { type: 'button', class: 'to-card to-link', onclick: () => K.go('count') }, K.icon('clipboard'),
        h('span', { class: 'to-txt' }, h('b', null, 'A stock count is running'), h('span', { class: 'muted' }, done + ' of ' + all.length + ' counted. Tap to count.')), K.icon('next')));
    }

    /* answers given in the demo on this device, waiting to be brought into the real book */
    const waiting = K.canEdit() && K.demoPending && !ui.demoLater ? K.demoPending() : 0;
    if (waiting) w.append(h('section', { class: 'to-card to-demo' },
      h('span', { class: 'to-txt' }, h('h2', null, 'You confirmed ' + waiting + ' dishes in the demo'), h('span', { class: 'muted' }, 'Their allergens and food preferences can come into the real book now. You check the list first.')),
      h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn primary', onclick: () => { ui.sheet = { type: 'fromdemo' }; K.render(); } }, 'Bring them over'),
        h('button', { type: 'button', class: 'btn', onclick: () => { ui.demoLater = true; K.render(); } }, 'Not now'))));
    const weekly = K.canEdit() ? K.countDue() : null;
    if (weekly && !weekly.never) w.append(h('button', { type: 'button', class: 'to-card to-link', onclick: () => K.go('count') }, K.icon('clipboard'),
      h('span', { class: 'to-txt' }, h('b', null, 'Time for the weekly count'), h('span', { class: 'muted' }, 'The last one was ' + weekly.days + ' days ago. It shows what went missing.')), K.icon('next')));
    const list = K.takeList(), out = list.filter((x) => K.stockState(x) === 'out'), low = list.filter((x) => K.stockState(x) === 'low');
    const known = list.some((x) => K.stockState(x) !== 'none');
    if (!known) {
      if (K.canEdit() && list.length) w.append(h('button', { type: 'button', class: 'to-card to-link', onclick: () => K.go('manage') }, K.icon('bottle'),
        h('span', { class: 'to-txt' }, h('b', null, 'The stock is not counted yet'), h('span', { class: 'muted' }, 'Count it once and this page shows what is out and what is low.')), K.icon('next')));
    } else {
      w.append(h('section', { class: 'to-card' },
        h('div', { class: 'to-h' }, h('span', { class: 'to-dot out', 'aria-hidden': 'true' }), h('h2', null, 'Not available tonight'), out.length ? h('span', { class: 'to-n out' }, String(out.length)) : null),
        out.length ? h('div', { class: 'to-rows' }, out.slice(0, 5).map((x) => {
          const alt = K.offerInstead(x);
          return h('button', { type: 'button', class: 'to-row', onclick: () => K.go('winepage', { id: x.id }) }, K.wineLabel(x, 'mini'),
            h('span', { class: 'to-txt' }, h('b', null, title(x)), h('span', { class: 'muted' }, alt ? 'Offer ' + title(alt) + ' instead' : 'Nothing close to it in stock')),
            h('span', { class: 'to-tag out' }, 'Out'));
        })) : h('p', { class: 'to-fine' }, K.icon('check'), 'Everything on the drinks list is available.'),
        out.length > 5 ? h('button', { type: 'button', class: 'to-more', onclick: () => { ui.stockF = 'out'; K.go('stock'); } }, 'See all ' + out.length + ' in Stock') : null));
      if (low.length) w.append(h('section', { class: 'to-card' },
        h('div', { class: 'to-h' }, h('span', { class: 'to-dot low', 'aria-hidden': 'true' }), h('h2', null, 'Running low'), h('span', { class: 'to-n low' }, String(low.length))),
        h('div', { class: 'to-lines' }, low.slice(0, 5).map((x) => h('button', { type: 'button', class: 'to-line', onclick: () => K.go('winepage', { id: x.id }) },
          h('span', null, title(x)), h('b', null, left(K.stockOf(x.id)))))),
        low.length > 5 ? h('button', { type: 'button', class: 'to-more', onclick: () => { ui.stockF = 'low'; K.go('stock'); } }, 'See all ' + low.length + ' in Stock') : null));
    }

    const open = K.openBottles(), due = open.filter((o) => o.due);
    if (open.length) w.append(h('section', { class: 'to-card' },
      h('div', { class: 'to-h' }, K.icon('clock'), h('h2', null, 'Open bottles'), h('button', { type: 'button', class: 'to-see', onclick: () => K.go('open') }, 'See all ' + open.length)),
      due.length ? due.slice(0, 3).map((o) => h('div', { class: 'to-due' },
        h('span', { class: 'to-txt' }, h('b', null, title(o.w)), h('span', null, 'Open ' + o.days + ' days · taste before pouring')),
        h('button', { type: 'button', class: 'btn light', onclick: () => K.go('open') }, 'Taste')))
        : h('p', { class: 'to-fine' }, K.icon('check'), open.length === 1 ? 'One bottle is open, and it is fine.' : open.length + ' bottles are open, all fine.')));

    const t = K.tasting();
    if (t.courses.length) w.append(h('button', { type: 'button', class: 'to-card to-link', onclick: () => { ui.foodTab = 'tasting'; K.go('food'); } }, K.icon('list'),
      h('span', { class: 'to-txt' }, h('b', null, t.name), h('span', { class: 'muted' }, t.courses.length + ' courses' + (t.price ? ' · ' + K.price(t.price) : '')), h('span', { class: 'muted' }, 'Build it for a guest with allergies')), K.icon('next')));

    w.append(h('section', { class: 'to-card to-quiz' },
      h('span', { class: 'to-txt' }, h('h2', null, 'The quiz'), h('span', { class: 'muted' }, 'Ten questions, twenty seconds each')),
      h('button', { type: 'button', class: 'btn', onclick: () => K.go('quiz') }, 'Play')));
    return { body: body, solid: true };
  };

  /* one search over the menu and the drinks list */
  K.SHEETS.find = function (S) {
    const q = String(S.q || '').trim();
    const dishes = q ? K.dishes().filter((d) => d.onMenu && K.matches([d.name, d.en, d.n.menuEn, d.n.menuBg, d.ings.join(' ')].join(' '), q)).slice(0, 6) : [];
    const drinks = q ? K.listWines().filter((x) => !x.off && K.matches([K.wineTitle(x), x.grapes, x.region, x.style, x.hype, K.COL[x.colour]].join(' '), q)).slice(0, 8) : [];
    const go = (view, id) => () => K.go(view, { id: id });
    return K.sheet('Find a dish or a drink', h('div', { class: 'stack' },
      K.searchBox('findq', S.q || '', 'A name, a grape, an ingredient', (v) => { S.q = v; K.render(); }),
      !q ? h('p', { class: 'muted' }, 'Type a few letters, in English or Bulgarian.') : null,
      q && !dishes.length && !drinks.length ? h('p', { class: 'muted' }, 'Nothing on the menu or the drinks list like that.') : null,
      dishes.length ? h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'Dishes', h('span', { class: 'n' }, String(dishes.length))),
        h('div', { class: 'to-rows' }, dishes.map((d) => h('button', { type: 'button', class: 'to-row framed', onclick: go('dish', d.id) }, K.dishThumb(d, 'sm'),
          h('span', { class: 'to-txt' }, h('b', null, d.name), d.en && d.en !== d.name ? h('span', { class: 'muted' }, d.en) : null), K.icon('next'))))) : null,
      drinks.length ? h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'Drinks', h('span', { class: 'n' }, String(drinks.length))),
        h('div', { class: 'to-rows' }, drinks.map((x) => h('button', { type: 'button', class: 'to-row framed', onclick: go('winepage', x.id) }, K.wineLabel(x, 'mini'),
          h('span', { class: 'to-txt' }, h('b', null, title(x)), h('span', { class: 'muted' }, [K.COL[x.colour], x.nostock ? '' : K.stockState(x) === 'out' ? 'out' : K.stockState(x) === 'low' ? 'running low' : ''].filter(Boolean).join(' · '))), K.icon('next'))))) : null), { wide: true });
  };
})();
