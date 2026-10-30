/* Photos of the restaurant: page headers, the napkin's K-ray mark, the courtyard cat for
   quiet moments, plating galleries and a full-screen photo viewer. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const DIR = 'assets/photos/theme/';
  const PAGE = { today: 'today', orders: 'orders', schedule: 'schedule-rota', events: 'events' };
  /* the recipe book opens on a different dish each day */
  const DAILY = ['recipes', 'salmon', 'soup', 'chocolate', 'cauliflower', 'fishcakes', 'sandwiches', 'herring'];
  K.PAGE_PHOTO_TABS = [['recipes', 'Recipes'], ['today', 'Today'], ['orders', 'Whiteboard'], ['schedule', 'Schedule'], ['events', 'Events']];

  K.defaultPagePhoto = function (tab) {
    if (tab === 'recipes') {
      const d = Math.floor(K.kitchenNow().getTime() / 86400000);
      return DIR + DAILY[d % DAILY.length] + '.jpg';
    }
    return PAGE[tab] ? DIR + PAGE[tab] + '.jpg' : '';
  };
  /* the head chef can pick a photo per page in Branding; the recipe book also takes the first header photo */
  K.pagePhoto = function (tab) {
    const b = D.branding || {}, p = (b.pages || {})[tab];
    if (p) return K.media(p);
    if (tab === 'recipes' && b.heroes && b.heroes[0]) return K.media(b.heroes[0]);
    return K.defaultPagePhoto(tab);
  };
  /* an image that tries a second address, then gives way to a stand-in */
  K.photoWithFallback = function (src, alt, standIn, attrs) {
    return h('img', Object.assign({}, attrs, { src: src, onerror: (e) => {
      const im = e.target;
      if (alt && im.getAttribute('src') !== alt) im.src = alt;
      else if (typeof standIn === 'function') standIn(im);
      else if (standIn) im.replaceWith(standIn); else im.remove();
    } }));
  };
  K.photoLayer = function (src) {
    if (!src) return [];
    return [
      h('img', { class: 'ph-img', src: src, alt: '', fetchpriority: 'high', onerror: (e) => { e.target.remove(); } }),
      h('div', { class: 'ph-shade', 'aria-hidden': 'true' }),
    ];
  };

  /* the K mark from the napkins: a stem with rays fanning out */
  K.rays = function (cls) {
    const span = h('span', { class: 'rays' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
    const lines = [[0, 100, 0, 0], [0, 46, 100, 0], [0, 46, 100, 26], [0, 46, 92, 58], [0, 46, 70, 92], [0, 46, 38, 100]];
    span.innerHTML = '<svg viewBox="-4 -4 108 108" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
      lines.map((l) => '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '"/>').join('') + '</svg>';
    return span;
  };

  /* the big K-ray fan behind the greeting on Today: the K's upright and seven rays rising to the right */
  K.welcomeRaysSvg = function () {
    const ends = [[390, 52], [390, 118], [390, 178], [390, 236], [390, 300], [352, 336], [300, 336]];
    return '<svg viewBox="0 0 390 336" preserveAspectRatio="xMaxYMax meet" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">' +
      '<line class="w-up" x1="250" y1="120" x2="250" y2="336"/>' +
      ends.map((e, i) => '<line class="w-ray" style="animation-delay:' + (0.05 + i * 0.1).toFixed(2) + 's" x1="250" y1="250" x2="' + e[0] + '" y2="' + e[1] + '"/>').join('') + '</svg>';
  };
  /* rays bursting around a big tick, for a station that is ready for service */
  K.burstSvg = function () {
    const lines = [];
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6, long = i % 2 === 0, r1 = 82, r2 = long ? 150 : 124;
      lines.push('<line class="b-ray' + (long ? '' : ' short') + '" style="animation-delay:' + (0.3 + i * 0.04).toFixed(2) + 's" x1="' + (195 + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (235 + r1 * Math.sin(a)).toFixed(1) + '" x2="' + (195 + r2 * Math.cos(a)).toFixed(1) + '" y2="' + (235 + r2 * Math.sin(a)).toFixed(1) + '"/>');
    }
    return '<svg viewBox="0 0 390 470" width="390" height="470"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' + lines.join('') + '</g>' +
      '<g class="b-tick"><circle cx="195" cy="235" r="58"/><path d="M170 236l17 17 34-36" fill="none" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
  };

  /* quiet states: the courtyard cat asleep on the steps */
  K.catRest = function (title, text, extra) {
    return h('div', { class: 'rest' },
      h('img', { class: 'rest-cat', src: DIR + 'cat.jpg', alt: 'The courtyard cat asleep on the steps', loading: 'lazy' }),
      h('strong', null, title), text ? h('p', null, text) : null, extra || null);
  };

  /* ---------- galleries ---------- */
  K.gallery = function (list, label) {
    if (!list || !list.length) return null;
    return h('div', { class: 'gallery', role: 'list', 'aria-label': label || 'Photos' }, list.map((p, i) =>
      h('button', { type: 'button', class: 'gal-item', role: 'listitem', 'aria-label': 'Open photo ' + (i + 1) + (p.title ? ': ' + p.title : ''), onclick: () => K.openPhotos(list, i) },
        h('img', { src: K.media(p.id), alt: p.title || '', loading: 'lazy', decoding: 'async' }),
        p.title ? h('span', { class: 'gal-cap' }, p.title) : null)));
  };
  K.openPhotos = function (list, i) { ui.sheet = { type: 'photos', list: list, i: i || 0 }; K.render(); };

  K.SHEETS.photos = function (S) {
    const list = S.list, n = list.length, p = list[S.i];
    if (!p) return null;
    const close = () => { ui.sheet = null; K.render(); };
    const go = (d) => { if (n < 2) return; S.i = (S.i + d + n) % n; K.render(); };
    const img = h('img', { class: 'lb-img', src: K.media(p.id), alt: p.title || 'Photo ' + (S.i + 1) });
    const box = h('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Photo ' + (S.i + 1) + ' of ' + n, tabindex: '-1',
      onkeydown: (e) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); },
      onclick: (e) => { if (e.target === e.currentTarget || e.target.classList.contains('lb-stage')) close(); } },
      h('div', { class: 'lb-top' },
        n > 1 ? h('span', { class: 'lb-count mono' }, (S.i + 1) + ' / ' + n) : h('span'),
        h('button', { type: 'button', class: 'icon-btn on-dark', 'aria-label': 'Close', onclick: close }, K.icon('close'))),
      h('div', { class: 'lb-stage' }, img),
      p.title ? h('p', { class: 'lb-cap' }, p.title) : null,
      n > 1 ? h('div', { class: 'lb-nav' },
        h('button', { type: 'button', class: 'icon-btn on-dark', 'aria-label': 'Previous photo', onclick: () => go(-1) }, K.icon('back')),
        h('div', { class: 'lb-dots', 'aria-hidden': 'true' }, list.map((x, j) => h('span', { class: j === S.i ? 'on' : '' }))),
        h('button', { type: 'button', class: 'icon-btn on-dark', 'aria-label': 'Next photo', onclick: () => go(1) }, K.icon('next'))) : null);
    let x0 = null, y0 = 0;
    box.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    box.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
    });
    setTimeout(() => { if (!box.contains(document.activeElement)) box.focus({ preventScroll: true }); }, 0);
    return box;
  };
})();
