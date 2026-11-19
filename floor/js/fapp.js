/* The floor book's shell: boot, routing, header and tab bar, redraws that keep scroll and typing.
   It looks and works like the kitchen book (same styles, same helpers), with the floor's own tabs. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  K.mode = 'pending';
  K.me = { id: '', admin: false, canWrite: null };

  /* icons the floor needs on top of the kitchen's */
  Object.assign(K.ICONS, {
    plate: '<path d="M4 17a8 8 0 0 1 16 0z"/><path d="M2.5 17h19M12 7V5.3M10.3 5.3h3.4M5 20h14"/>',
    glass: '<path d="M7.5 3h9l-.6 6.2a3.9 3.9 0 0 1-7.8 0z"/><path d="M8 7.5h8M12 13.2v7.3M8.5 20.5h7"/>',
    bottle: '<path d="M10 2.5h4M10.5 2.5v4.3c0 .8-.4 1.3-1 1.8A4 4 0 0 0 8 11.7V20a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 20v-8.3a4 4 0 0 0-1.5-3.1c-.6-.5-1-1-1-1.8V2.5"/><path d="M8 13.5h8v4.5H8z"/>',
    trophy: '<path d="M8 3.5h8v5.5a4 4 0 0 1-8 0z"/><path d="M8 5.5H4.5a3.5 3.5 0 0 0 3.7 4.4M16 5.5h3.5a3.5 3.5 0 0 1-3.7 4.4M12 13v3.5M9 20.5h6M10 16.5h4l.6 4h-5.2z"/>',
    leaf: '<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19l8-8"/>',
    quote: '<path d="M10 7H6a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v1a3 3 0 0 1-3 3M20 7h-4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2v1a3 3 0 0 1-3 3"/>',
    kitchen: '<path d="M7 14.5V20h10v-5.5"/><path d="M7 14.5a4 4 0 0 1-1.6-7.6A4.5 4.5 0 0 1 12 4a4.5 4.5 0 0 1 6.6 2.9A4 4 0 0 1 17 14.5z"/><path d="M7 17h10"/>',
  });

  const TABS = [['food', 'Food', 'plate'], ['wine', 'Wine', 'glass'], ['stock', 'Stock', 'bottle'], ['quiz', 'Quiz', 'trophy'], ['schedule', 'Schedule', 'rota']];
  const TAB_OF = { dish: 'food', winepage: 'wine' };

  /* ---------- navigation ---------- */
  function hashFor() {
    if (ui.view === 'dish' && ui.id) return 'd.' + ui.id;
    if (ui.view === 'winepage' && ui.id) return 'w.' + ui.id;
    return TABS.some((t) => t[0] === ui.view) ? ui.view : '';
  }
  function fromHash(hs) {
    hs = String(hs || '').replace(/^#/, '');
    let m = hs.match(/^d\.(.+)$/);
    if (m) { ui.view = 'dish'; ui.id = decodeURIComponent(m[1]); return true; }
    m = hs.match(/^w\.(.+)$/);
    if (m) { ui.view = 'winepage'; ui.id = decodeURIComponent(m[1]); return true; }
    if (TABS.some((t) => t[0] === hs)) { ui.view = hs; return true; }
    return false;
  }
  /* the page sits under <base href="../">, so history entries name this page's own address */
  const here = (hs) => location.pathname + location.search + (hs ? '#' + hs : '');
  const scrollMem = {};
  const pageKey = () => ui.view + (ui.id ? '.' + ui.id : '');
  K.go = function (view, opts) {
    opts = opts || {};
    scrollMem[pageKey()] = window.scrollY;
    ui.view = view;
    ui.id = opts.id || null;
    ui.sheet = null;
    const hs = hashFor();
    try { if (hs && location.hash !== '#' + hs) history.pushState({ k: 1 }, '', here(hs)); } catch (e) { /* file:// */ }
    const draw = () => { render(true); if (opts.restore && scrollMem[pageKey()]) window.scrollTo(0, scrollMem[pageKey()]); };
    if (K.transition) K.transition(draw); else draw();
  };
  window.addEventListener('popstate', () => {
    ui.sheet = null;
    scrollMem[pageKey()] = window.scrollY;
    if (!fromHash(location.hash)) ui.view = 'food';
    render(true);
    if (scrollMem[pageKey()]) window.scrollTo(0, scrollMem[pageKey()]);
  });
  K.back = function (fallback) {
    if (history.state && history.state.k) { history.back(); return; }
    K.go(fallback || TAB_OF[ui.view] || 'food', { restore: true });
  };

  /* ---------- rendering ---------- */
  const app = document.getElementById('app');
  let lastTouch = 0, bgT = null, bgTries = 0;
  ['pointerdown', 'keydown', 'input', 'touchstart'].forEach((n) => document.addEventListener(n, () => { lastTouch = Date.now(); }, true));
  function userBusy() {
    const a = document.activeElement, tg = a && a.tagName;
    return Date.now() - lastTouch < 1500 || ((tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') && !a.readOnly);
  }
  K.refresh = function (now) {
    if (now) { clearTimeout(bgT); bgT = null; render(); return; }
    /* the quiz clock redraws on its own; live data waits until nobody is typing */
    if (userBusy() && bgTries < 30) { bgTries++; clearTimeout(bgT); bgT = setTimeout(() => K.refresh(), 900); return; }
    bgTries = 0; clearTimeout(bgT); bgT = null; render();
  };
  function render(toTop) {
    const ae = document.activeElement, fid = ae && ae.id;
    let sel = null;
    try { if (fid && typeof ae.selectionStart === 'number') sel = [ae.selectionStart, ae.selectionEnd]; } catch (e) { /* not a text field */ }
    const y = window.scrollY, sb = document.querySelector('.sheet-body'), sy = sb ? sb.scrollTop : 0, hadSheet = !!sb;
    const hadOverlay = !!document.querySelector('.sheet-back, .lightbox');
    app.textContent = '';
    const out = view();
    app.append(out.top || header());
    document.body.classList.toggle('over-photo', !out.top && !out.solid);
    if (K.me && K.me.viewer) app.append(h('div', { class: 'viewer-note' }, K.icon('lock'), h('span', null, 'View only: you can look at everything; nothing you tap changes the book.')));
    app.append(h('main', { id: 'main', class: 'main' + (out.wide ? ' wide' : '') }, out.body));
    if (out.tabs !== false) app.append(tabbar());
    if (out.bar) app.append(h('div', { class: 'actionbar' }, h('div', { class: 'actionbar-in' }, out.bar)));
    document.body.classList.toggle('has-tabs', out.tabs !== false);
    document.body.classList.toggle('viewer', !!(K.me && K.me.viewer));
    document.body.classList.toggle('has-bar', !!out.bar);
    if (ui.sheet && K.SHEETS[ui.sheet.type]) { const s = K.SHEETS[ui.sheet.type](ui.sheet); if (s) { if (hadOverlay) s.classList.add('still'); app.append(s); } }
    document.body.classList.toggle('locked', !!ui.sheet);
    window.scrollTo(0, toTop ? 0 : y);
    const nsb = document.querySelector('.sheet-body');
    if (nsb && hadSheet) nsb.scrollTop = sy;
    if (fid) {
      const el = document.getElementById(fid);
      if (el && el !== document.activeElement) {
        try { el.focus({ preventScroll: true }); if (sel && typeof el.setSelectionRange === 'function') el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* not focusable */ }
      }
    }
    if (out.after) out.after();
    if (K.namePrompt && K.namePrompt()) setTimeout(() => render(), 0);
  }
  K.render = render;
  const onScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function view() {
    if (K.mode === 'pending') return { body: loading('Opening the floor book…'), tabs: false };
    if (K.mode === 'firebase' && ui.auth) return K.V.login();
    if (ui.view === 'dish' && D.loaded && !K.dish(ui.id)) ui.view = 'food';
    if (ui.view === 'winepage' && D.winesLoaded && !K.wine(ui.id)) ui.view = 'wine';
    return (K.V[ui.view] || K.V.food)();
  }
  function loading(msg) {
    return h('div', { class: 'boot' }, h('div', { class: 'boot-mark' }, brandMark()), h('p', { class: 'muted' }, msg));
  }
  K.loadingBox = (msg) => h('div', { class: 'empty' }, h('strong', null, msg || 'Loading'), 'One moment.');

  /* ---------- header and tabs ---------- */
  function brandMark() { return h('img', { class: 'logo', src: 'assets/brand/logo.png', alt: 'Komat' }); }
  K.brandMark = brandMark;
  function badge(tab) {
    if (K.mode === 'pending' || ui.auth) return null;
    if (tab === 'stock') { const n = D.wines.filter((w) => !w.off && K.stockState(w) === 'out').length; return n ? h('span', { class: 'badge', 'aria-label': n + ' wines out' }, String(n)) : null; }
    return null;
  }
  function tabButtons(cls) {
    const cur = TAB_OF[ui.view] || ui.view;
    return TABS.map((t) => h('button', { type: 'button', class: cls, 'aria-current': cur === t[0] ? 'page' : null, onclick: () => tabTap(t[0]) },
      h('span', { class: 'tab-ico' }, K.icon(t[2]), badge(t[0])), h('span', { class: 'tab-lbl' }, t[1])));
  }
  function tabTap(tab) {
    if (ui.view !== tab) { if (ui.quiz && ui.quiz.stage === 'play' && tab !== 'quiz') K.quitQuiz && K.quitQuiz(); K.go(tab); return; }
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function header() {
    return h('header', { class: 'top over' }, h('div', { class: 'top-in' },
      h('button', { type: 'button', class: 'brand', 'aria-label': 'Komat floor book', onclick: () => K.go('food') }, brandMark(), h('span', { class: 'floor-tag' }, 'Floor')),
      h('nav', { class: 'tabs-desk', 'aria-label': 'Sections' }, tabButtons('dtab')),
      h('span', { class: 'grow' }),
      h('a', { class: 'icon-btn on-dark', href: '../', 'aria-label': 'Open the kitchen book', title: 'The kitchen book' }, K.icon('kitchen')),
      h('button', { type: 'button', class: 'icon-btn on-dark', 'aria-label': 'Settings', onclick: () => { ui.sheet = { type: 'settings' }; render(); } }, K.icon('gear'))));
  }
  K.subbar = function (backLabel, onBack, actions, title) {
    return h('header', { class: 'top sub' }, h('div', { class: 'top-in' },
      h('button', { type: 'button', class: 'back-btn', onclick: onBack }, K.icon('back'), h('span', null, backLabel)),
      title ? h('span', { class: 'sub-title' }, title) : h('span', { class: 'grow' }),
      h('div', { class: 'sub-acts' }, actions)));
  };
  function tabbar() { return h('nav', { class: 'tabbar', 'aria-label': 'Sections' }, tabButtons('mtab')); }
  /* a page head like the kitchen's: a photo or the dark speckle, the K rays, a title */
  K.pageHead = function (title, sub, extra, photo, cls) {
    return h('section', { class: 'phead' + (photo ? ' photo' : ' speckle') + (cls ? ' ' + cls : '') }, K.photoLayer(photo || ''), K.rays('ph-rays'),
      h('div', { class: 'wrap phead-in' },
        h('div', null, h('h1', { class: 'ptitle' }, title), sub ? h('p', { class: 'psub' }, sub) : null),
        extra || null));
  };
  /* the search box, the same as the kitchen book's */
  K.searchBox = function (id, value, placeholder, onInput) {
    const q = h('input', { class: 'search-in', id: id, type: 'search', placeholder: placeholder, 'aria-label': placeholder, value: value,
      autocomplete: 'off', autocapitalize: 'off', spellcheck: false, enterkeyhint: 'search',
      oninput: (e) => onInput(e.target.value), onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); } });
    return h('div', { class: 'search-dock' }, h('div', { class: 'search' }, K.icon('search'), q,
      value ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Clear search', onclick: () => { onInput(''); K.render(); const el = document.getElementById(id); if (el) el.focus(); } }, K.icon('close')) : null));
  };
  /* Latin letters find Cyrillic ("mavrud" finds Мавруд) */
  K.matches = function (text, q) {
    text = String(text || '').toLowerCase(); q = String(q || '').trim().toLowerCase();
    if (!q) return true;
    if (text.includes(q)) return true;
    return /[a-z]/.test(q) && K.latin(text).includes(q);
  };
  K.canEdit = () => !!(K.me && K.me.admin);
  K.canWrite = () => !(K.me && K.me.viewer);

  /* ---------- boot ---------- */
  function seed(docs) {
    const S = window.KOMAT_SEED || {}, F = window.KOMAT_FLOOR_SEED || {};
    (S.recipes || []).forEach((r) => { const o = K.clone(r); delete o.id; docs['recipes/' + r.id] = o; });
    const E = window.KOMAT_FLOOR_DEVICE || {};
    Object.keys(F).concat(Object.keys(E)).forEach((p) => { docs[p] = K.clone(F[p] || E[p]); });
  }
  K.floorSeed = () => { const d = {}; Object.keys(window.KOMAT_FLOOR_SEED || {}).forEach((p) => { d[p] = K.clone(window.KOMAT_FLOOR_SEED[p]); }); return d; };

  async function boot() {
    render();
    if (K.Fire) {
      K.mode = 'firebase';
      K.db = K.Fire.db;
      K.assets = K.Fire.assets;
      ui.auth = 'wait';
      fromHash(location.hash);
      try { history.replaceState({ k: 0 }, '', here(location.hash.slice(1) || hashFor())); } catch (e) { /* file:// */ }
      K.Fire.start();
      render(true);
      return;
    }
    K.mode = 'local';
    K.db = new K.LocalDB(seed, 'komat.floor.db.v1');
    await K.LocalAssets.init();
    K.assets = K.LocalAssets;
    K.me = { id: '', admin: true, canWrite: true, name: K.store.get('fohName', '') };
    fromHash(location.hash);
    try { history.replaceState({ k: 0 }, '', here(location.hash.slice(1) || hashFor())); } catch (e) { /* file:// */ }
    K.subscribe();
    render(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
