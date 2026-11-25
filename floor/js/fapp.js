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
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    team: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.3A6 6 0 0 1 21 20"/>',
    shield: '<path d="M12 3l7 3v5.5c0 4.4-3 7.7-7 9.5-4-1.8-7-5.1-7-9.5V6z"/><path d="M9 12l2.2 2.2L15.2 10"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>',
    sliders: '<path d="M5 7h7M18 7h1M5 12h2M12 12h7M5 17h9M19 17h0"/><circle cx="15" cy="7" r="2"/><circle cx="9.5" cy="12" r="2"/><circle cx="16.5" cy="17" r="2"/>',
    truck: '<path d="M3 6h11v10H3zM14 9h4l3 3.5V16h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
    scale: '<path d="M12 4v16M6 20h12M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z"/>',
    swap: '<path d="M7 4v14M3.5 14.5L7 18l3.5-3.5M17 20V6M13.5 9.5L17 6l3.5 3.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    backspace: '<path d="M9 6h10a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 18H9l-6-6z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/>',
    share: '<path d="M12 15V4M8 7.5L12 3.5l4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M8.5 10h7M8.5 14h7M8.5 18h4"/>',
    kitchen: '<path d="M7 14.5V20h10v-5.5"/><path d="M7 14.5a4 4 0 0 1-1.6-7.6A4.5 4.5 0 0 1 12 4a4.5 4.5 0 0 1 6.6 2.9A4 4 0 0 1 17 14.5z"/><path d="M7 17h10"/>',
  });

  /* five tabs; the quiz and the schedule share the last one */
  const TABS = [['tonight', 'Tonight', 'moon'], ['food', 'Food', 'plate'], ['wine', 'Drinks', 'glass'], ['stock', 'Stock', 'bottle'], ['team', 'Team', 'team']];
  const TAB_OF = { dish: 'food', winepage: 'wine', count: 'stock', open: 'stock', manage: 'stock', order: 'stock', hypelist: 'stock', quiz: 'team', schedule: 'team' };
  /* pages with an address of their own (the dish and drink pages carry an id and are handled apart) */
  const VIEWS = ['tonight', 'food', 'wine', 'stock', 'quiz', 'schedule', 'count', 'open', 'manage', 'order', 'hypelist'];
  const teamView = () => (ui.team = ui.team || K.store.get('fohTeam', 'schedule'));

  /* ---------- navigation ---------- */
  function hashFor() {
    if (ui.view === 'dish' && ui.id) return 'd.' + ui.id;
    if (ui.view === 'winepage' && ui.id) return 'w.' + ui.id;
    return VIEWS.includes(ui.view) ? ui.view : '';
  }
  function fromHash(hs) {
    hs = String(hs || '').replace(/^#/, '');
    let m = hs.match(/^d\.(.+)$/);
    if (m) { ui.view = 'dish'; ui.id = decodeURIComponent(m[1]); return true; }
    m = hs.match(/^w\.(.+)$/);
    if (m) { ui.view = 'winepage'; ui.id = decodeURIComponent(m[1]); return true; }
    if (hs === 'team') { ui.view = teamView(); return true; }
    if (VIEWS.includes(hs)) { ui.view = hs; return true; }
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
    if (!fromHash(location.hash)) ui.view = 'tonight';
    render(true);
    if (scrollMem[pageKey()]) window.scrollTo(0, scrollMem[pageKey()]);
  });
  K.back = function (fallback) {
    if (history.state && history.state.k) { history.back(); return; }
    const to = fallback || TAB_OF[ui.view] || 'tonight';
    K.go(to === 'team' ? teamView() : to, { restore: true });
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
    if (K.demo) app.append(h('div', { class: 'viewer-note' }, K.icon('sparkle'), h('span', null, 'Demo with sample numbers. It lives in this browser only; nothing here reaches the restaurant.')));
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
    const out = (K.V[ui.view] || K.V.tonight)();
    /* the quiz and the schedule live under one tab: a switch under the page's title goes from one to the other */
    if ((ui.view === 'quiz' || ui.view === 'schedule') && out.tabs !== false && !out.top && out.body && out.body.children) {
      ui.team = ui.view; K.store.set('fohTeam', ui.view);
      const sw = h('div', { class: 'wrap team-switch' }, K.seg([['schedule', 'Schedule'], ['quiz', 'Quiz']], ui.view, (v) => { if (v !== ui.view) K.go(v); }, { class: 'seg', 'aria-label': 'Team' }));
      out.body.insertBefore(sw, out.body.children[1] || null);
    }
    return out;
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
    if (tab === 'stock') { const n = K.takeList().filter((w) => K.stockState(w) === 'out').length; return n ? h('span', { class: 'badge', 'aria-label': n + ' drinks out' }, String(n)) : null; }
    return null;
  }
  function tabButtons(cls) {
    const cur = TAB_OF[ui.view] || ui.view;
    return TABS.map((t) => h('button', { type: 'button', class: cls, 'aria-current': cur === t[0] ? 'page' : null, onclick: () => tabTap(t[0]) },
      h('span', { class: 'tab-ico' }, K.icon(t[2]), badge(t[0])), h('span', { class: 'tab-lbl' }, t[1])));
  }
  function tabTap(tab) {
    const to = tab === 'team' ? teamView() : tab;
    if (ui.view !== to) { if (ui.quiz && ui.quiz.stage === 'play' && to !== 'quiz') K.quitQuiz && K.quitQuiz(); K.go(to); return; }
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function header() {
    return h('header', { class: 'top over' }, h('div', { class: 'top-in' },
      h('button', { type: 'button', class: 'brand', 'aria-label': 'Komat floor book', onclick: () => K.go('tonight') }, brandMark(), h('span', { class: 'floor-tag' }, 'Floor')),
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

  /* what the demo starts with: the printed menu as dishes, the drinks list, a count for every bottle (a few out,
     a few low) and two wines open for glasses. All of it is sample data in this browser. */
  function demoSeed(docs, house) {
    const now = Date.now(), day = 86400000;
    Object.keys(house.docs || {}).forEach((p) => { docs[p] = K.clone(house.docs[p]); });
    (house.menu || []).forEach((m, i) => {
      const e = K.clone(m), name = e.menuName || e.en || 'Dish';
      delete e.menuName; delete e.match;
      /* the menu line stands in for the recipe, so the allergy check has ingredients to read */
      docs['dishnotes/own-demo-' + i] = Object.assign(e, { name: name, onMenu: true, ings: m.ings || String(m.menuBg || m.menuEn || '').split(/,\s*/).filter(Boolean) });
    });
    (house.pairings || []).forEach((pr) => {
      const i = (house.menu || []).findIndex((m) => m.en === pr.dish), why = {};
      if (i < 0) return;
      const whyBg = {}, note = docs['dishnotes/own-demo-' + i];
      pr.wines.forEach((x) => { if (x.why) why[x.id] = x.why; if (x.whyBg) whyBg[x.id] = x.whyBg; });
      Object.assign(note, { pairs: pr.wines.map((x) => x.id), pairWhy: why, bg: Object.assign({}, note.bg, { pairWhy: whyBg }) });
    });
    (house.quiz || []).forEach((q, i) => { const doc = Object.assign({ topic: 'food', house: true }, q); delete doc.id; docs['quizq/house-' + (q.id || i)] = doc; });
    /* what was confirmed in an earlier version of the demo is kept: the answers move onto the fresh sample dishes */
    (K.demoAnswers ? K.demoAnswers() : []).forEach((n) => {
      const i = (house.menu || []).findIndex((m) => (n.menuBg && m.menuBg === n.menuBg) || (n.en && m.en === n.en));
      if (i < 0) return;
      ['checked', 'allergens', 'notAl', 'diet', 'butterOnly', 'bread', 'breadAl', 'canDiet', 'canHow', 'canAl', 'updated'].forEach((k) => { if (n[k] !== undefined) docs['dishnotes/own-demo-' + i][k] = n[k]; });
    });
    const t = K.tastingFrom(house, (e) => { const i = (house.menu || []).indexOf(e); return i < 0 ? '' : 'own-demo-' + i; });
    if (t) docs['fohsettings/tasting'] = t;
    const ids = Object.keys(docs).filter((p) => p.indexOf('wines/') === 0 && !docs[p].nostock && !docs[p].off).map((p) => p.slice(6));
    ids.forEach((id, i) => {
      const par = docs['wines/' + id].par == null ? 3 : +docs['wines/' + id].par;
      docs['cellar/' + id] = { n: i % 17 === 3 ? 0 : i % 9 === 4 ? Math.max(1, par - 1) : par + 2 + (i % 7), at: now - day, name: 'Demo' };
    });
    const wines = ids.filter((id) => !K.DRINK_KINDS.includes(docs['wines/' + id].colour));
    if (wines[0]) docs['cellarmoves/demo-open-1'] = { w: wines[0], n: 0, at: now - 4 * day, by: 'demo', name: 'Demo', why: 'open' };
    if (wines[5]) docs['cellarmoves/demo-open-2'] = { w: wines[5], n: 0, at: now - day, by: 'demo', name: 'Demo', why: 'open' };
  }

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
    K.demo = !!window.KOMAT_DEMO;
    /* the demo is built from the house menu and drinks list that come with the app, plus made-up stock */
    const house = K.demo ? await fetch('floor/data/house.json').then((r) => (r.ok ? r.json() : null)).catch(() => null) : null;
    K.db = new K.LocalDB(house ? (docs) => demoSeed(docs, house) : seed, K.demo ? 'komat.floor.demo.v8' : 'komat.floor.db.v1');
    await K.LocalAssets.init();
    K.assets = K.LocalAssets;
    K.me = { id: '', admin: true, canWrite: true, name: K.demo ? 'Demo' : K.store.get('fohName', '') };
    fromHash(location.hash);
    try { history.replaceState({ k: 0 }, '', here(location.hash.slice(1) || hashFor())); } catch (e) { /* file:// */ }
    K.subscribe();
    render(true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
