/* App shell: boot, routing, header and tab bar, and redraws that keep scroll and typing intact. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D;
  K.V = K.V || {};
  K.SHEETS = K.SHEETS || {};
  K.mode = 'pending';
  K.me = { id: '', admin: false, canWrite: null };
  K.ui = {
    view: 'recipes', id: null, comp: -1, q: '', cat: '', type: '', onMenu: false,
    station: K.store.get('station', '') || '', sheet: null, cook: null, edit: null, stock: null,
    factors: {}, scaleFrom: {}, ticks: {}, noteFor: null, addTo: null, showDone: false, leftOnly: false,
  };
  const ui = K.ui;

  const TABS = [['recipes', 'Recipes', 'book'], ['today', 'Today', 'today'], ['orders', 'Orders', 'order'], ['schedule', 'Schedule', 'rota'], ['events', 'Events', 'event']];
  const TAB_OF = { recipe: 'recipes', edit: 'recipes', brand: 'recipes', stock: 'today', lists: 'today' };

  /* ---------- navigation ---------- */
  function hashFor() {
    if (ui.view === 'recipe' && ui.id) return 'r.' + ui.id + (ui.comp >= 0 ? '.' + ui.comp : '');
    return TABS.some((t) => t[0] === ui.view) ? ui.view : '';
  }
  function fromHash(hs) {
    hs = String(hs || '').replace(/^#/, '');
    const m = hs.match(/^r\.([A-Za-z0-9_\-~]+)(?:\.(\d+))?$/);
    if (m) { ui.view = 'recipe'; ui.id = m[1]; ui.comp = m[2] ? +m[2] : -1; return true; }
    if (TABS.some((t) => t[0] === hs)) { ui.view = hs; return true; }
    return false;
  }
  /* K.go('today') or K.go('recipe', {id, comp}) */
  const scrollMem = {};
  const pageKey = () => (ui.view === 'recipe' ? 'r.' + ui.id + '.' + ui.comp : ui.view);
  /* the stand-alone site (device copy or the kitchen's own database) has real browser history */
  const site = () => K.mode === 'local' || K.mode === 'firebase';
  K.go = function (view, opts) {
    opts = opts || {};
    if (ui.wake && view !== 'recipe') K.releaseWake();
    scrollMem[pageKey()] = window.scrollY;
    ui.view = view;
    if (view === 'recipe') {
      ui.id = opts.id; ui.comp = typeof opts.comp === 'number' ? opts.comp : -1;
      ui.factors = opts.factors || {}; ui.scaleFrom = opts.scaleFrom || {}; ui.ticks = {};
      K.rememberRecent(opts.id);
    }
    ui.sheet = null;
    if (site()) {
      const hs = hashFor();
      try { if (hs && location.hash !== '#' + hs) history.pushState({ k: 1 }, '', '#' + hs); } catch (e) { /* file:// */ }
    }
    const draw = () => { render(true); if (opts.restore && scrollMem[pageKey()]) window.scrollTo(0, scrollMem[pageKey()]); };
    if (K.transition) K.transition(draw); else draw();
  };
  window.addEventListener('popstate', () => {
    if (!site()) return;
    ui.sheet = null; ui.cook = null;
    scrollMem[pageKey()] = window.scrollY;
    if (!fromHash(location.hash)) ui.view = 'recipes';
    render(true);
    if (scrollMem[pageKey()]) window.scrollTo(0, scrollMem[pageKey()]);
  });
  /* back from a sub-page: browser history on the stand-alone site, else the parent tab */
  K.back = function (fallback) {
    if (site() && history.state && history.state.k) { history.back(); return; }
    K.go(fallback || TAB_OF[ui.view] || 'recipes', { restore: true });
  };

  /* ---------- rendering ---------- */
  const app = document.getElementById('app');
  let lastTouch = 0, bgT = null, bgTries = 0;
  ['pointerdown', 'keydown', 'input', 'touchstart'].forEach((n) => document.addEventListener(n, () => { lastTouch = Date.now(); }, true));
  function userBusy() {
    const a = document.activeElement, tg = a && a.tagName;
    return Date.now() - lastTouch < 1500 || ((tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') && !a.readOnly);
  }
  /* data changed: redraw now (after a tap) or when the person stops typing (live data) */
  K.refresh = function (now) {
    if (now) { clearTimeout(bgT); bgT = null; render(); return; }
    if (userBusy() && bgTries < 30) { bgTries++; clearTimeout(bgT); bgT = setTimeout(() => K.refresh(), 900); return; }
    bgTries = 0; clearTimeout(bgT); bgT = null; render();
  };

  function render(toTop) {
    const ae = document.activeElement, fid = ae && ae.id;
    let sel = null;
    try { if (fid && typeof ae.selectionStart === 'number') sel = [ae.selectionStart, ae.selectionEnd]; } catch (e) { /* not a text field */ }
    const y = window.scrollY, sb = document.querySelector('.sheet-body'), sy = sb ? sb.scrollTop : 0, hadSheet = !!sb;
    /* an overlay that is only being redrawn should not slide in again */
    const hadOverlay = !!document.querySelector('.sheet-back, .lightbox, .ready-back');
    app.textContent = '';
    const out = view();
    app.append(out.top || header());
    document.body.classList.toggle('over-photo', !out.top);
    if (D.noWrite && K.mode === 'cloud') app.append(noWriteBanner());
    app.append(h('main', { id: 'main', class: 'main' + (out.wide ? ' wide' : '') + (ui.pageIn ? ' page-in' : '') }, out.body));
    ui.pageIn = false;
    if (out.tabs !== false) app.append(tabbar());
    if (out.bar) app.append(h('div', { class: 'actionbar' }, h('div', { class: 'actionbar-in' }, out.bar)));
    document.body.classList.toggle('has-tabs', out.tabs !== false);
    document.body.classList.toggle('has-bar', !!out.bar);
    if (ui.sheet && K.SHEETS[ui.sheet.type]) { const s = K.SHEETS[ui.sheet.type](ui.sheet); if (s) { if (hadOverlay) s.classList.add('still'); app.append(s); } }
    if (ui.cook && K.V.cook) app.append(K.V.cook());
    document.body.classList.toggle('locked', !!(ui.sheet || ui.cook));
    document.body.classList.toggle('cooking', !!ui.cook);
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
  }
  K.render = render;
  const onScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function view() {
    if (K.mode === 'pending') return { body: loading('Opening the kitchen book…') };
    if (K.mode === 'none') return { body: unavailable() };
    if (K.mode === 'firebase' && ui.auth) return K.V.login();
    if (ui.view === 'recipe' && (!D.loaded || !K.find(ui.id))) {
      if (!D.loaded) return { body: loading('Loading recipes…') };
      ui.view = 'recipes';
    }
    if ((ui.view === 'edit' && !ui.edit) || (ui.view === 'stock' && !ui.stock) || (ui.view === 'brand' && !K.me.admin)) ui.view = TAB_OF[ui.view];
    return (K.V[ui.view] || K.V.recipes)();
  }
  function loading(msg) {
    return h('div', { class: 'boot' }, h('div', { class: 'boot-mark' }, brandMark()), h('p', { class: 'muted' }, msg));
  }
  function unavailable() {
    return h('div', { class: 'boot' }, h('div', { class: 'boot-mark' }, brandMark()),
      h('h1', { class: 'display' }, 'Open the book in Claude'),
      h('p', { class: 'muted measure' }, 'This copy keeps its recipes in Claude. Open the link from the Claude app or claude.ai while signed in, then reload.'),
      h('button', { class: 'btn primary', type: 'button', onclick: () => location.reload() }, 'Reload'));
  }

  /* ---------- header and tabs ---------- */
  function brandMark() {
    const logo = D.branding && D.branding.logo;
    return logo ? h('img', { class: 'logo', src: K.media(logo), alt: 'Komat' }) : h('span', { class: 'wordmark' }, 'KOMAT');
  }
  K.brandMark = brandMark;
  function badge(tab) {
    if (K.mode === 'pending' || K.mode === 'none' || ui.auth) return null;
    if (tab === 'today') { const n = K.openUrgents().length; return n ? h('span', { class: 'badge', 'aria-label': n + ' urgent' }, String(n)) : null; }
    if (tab === 'events') { const n = K.upcomingEvents().filter((e) => K.isLive(e) && K.daysUntil(e.date) <= 1).length; return n ? h('span', { class: 'badge dot', 'aria-label': 'Event today or tomorrow' }) : null; }
    return null;
  }
  function tabButtons(cls) {
    const cur = TAB_OF[ui.view] || ui.view;
    return TABS.map((t) => h('button', { type: 'button', class: cls, 'aria-current': cur === t[0] ? 'page' : null, onclick: () => tabTap(t[0]) },
      h('span', { class: 'tab-ico' }, K.icon(t[2]), badge(t[0])), h('span', { class: 'tab-lbl' }, t[1])));
  }
  /* with a mouse and keyboard the search is ready to type into; phones keep the keyboard down until asked */
  const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
  /* tapping the tab you are on goes back to its top; on Recipes it opens the search */
  function tabTap(tab) {
    if (ui.view !== tab) { if (tab === 'recipes') ui.focusSearch = finePointer(); K.go(tab); return; }
    if (tab === 'recipes' && K.focusSearch) { K.focusSearch(); return; }
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  K.langSwitch = function () {
    return h('div', { class: 'langsw', role: 'group', 'aria-label': 'Recipe language' },
      [['bg', 'БГ'], ['en', 'EN']].map((l) => h('button', { type: 'button', 'aria-pressed': K.lang === l[0] ? 'true' : 'false', title: l[0] === 'bg' ? 'Recipes in Bulgarian' : 'Recipes in English', onclick: () => K.setLang(l[0]) }, l[1])));
  };
  function header() {
    return h('header', { class: 'top over' }, h('div', { class: 'top-in' },
      h('button', { type: 'button', class: 'brand', 'aria-label': 'Komat recipes', onclick: () => K.go('recipes') }, brandMark()),
      h('nav', { class: 'tabs-desk', 'aria-label': 'Sections' }, tabButtons('dtab')),
      h('span', { class: 'grow' }),
      K.langSwitch(),
      h('button', { type: 'button', class: 'icon-btn on-dark', 'aria-label': 'Settings', onclick: () => { ui.sheet = { type: 'settings' }; render(); } }, K.icon('gear'))));
  }
  /* the top bar for sub-pages: back, title, actions */
  K.subbar = function (backLabel, onBack, actions, title) {
    return h('header', { class: 'top sub' }, h('div', { class: 'top-in' },
      h('button', { type: 'button', class: 'back-btn', onclick: onBack }, K.icon('back'), h('span', null, backLabel)),
      title ? h('span', { class: 'sub-title' }, title) : h('span', { class: 'grow' }),
      h('div', { class: 'sub-acts' }, actions)));
  };
  function tabbar() {
    return h('nav', { class: 'tabbar', 'aria-label': 'Sections' }, tabButtons('mtab'));
  }
  function noWriteBanner() {
    return h('div', { class: 'banner bad', role: 'alert' },
      h('b', null, 'Your ticks and tasks are not being saved'),
      h('span', null, 'You can only view this book. Ask the head chef to open Share and give you Contributor access, then sign in to Claude with that email and reopen the book.'));
  }

  /* ---------- recently opened (this device) ---------- */
  K.recent = () => K.store.get('recent', []);
  K.rememberRecent = (id) => { if (!id) return; const l = K.recent().filter((x) => x !== id); l.unshift(id); K.store.set('recent', l.slice(0, 8)); };

  /* ---------- screen wake lock (cook mode, recipe pages) ---------- */
  K.toggleWake = function () {
    if (ui.wake) { K.releaseWake(); render(); return; }
    if (!('wakeLock' in navigator)) { K.toast('This device will not keep the screen on.'); return; }
    navigator.wakeLock.request('screen').then((l) => { ui.wake = l; l.addEventListener('release', () => { ui.wake = null; }); render(); }, () => K.toast('This device will not keep the screen on.'));
  };
  K.releaseWake = function () { if (ui.wake) { try { ui.wake.release(); } catch (e) { /* already gone */ } ui.wake = null; } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ui.cook && !ui.wake && 'wakeLock' in navigator) navigator.wakeLock.request('screen').then((l) => { ui.wake = l; }, () => {}); });

  /* ---------- boot ---------- */
  function seed(docs) {
    const S = window.KOMAT_SEED || {}, st = S.settings || {};
    (S.recipes || []).forEach((r) => { const o = K.clone(r); delete o.id; docs['recipes/' + r.id] = o; });
    if (st.checklists) docs['settings/checklists'] = K.clone(st.checklists);
    if (st.shiftcodes) docs['settings/shiftcodes'] = K.clone(st.shiftcodes);
    if (st.kitchen) docs['settings/kitchen'] = K.clone(st.kitchen);
    docs['settings/branding'] = { logo: 'assets/brand/logo.png', heroes: [], approve: '' };
  }
  K.seedDocs = () => { const d = {}; seed(d); return d; };

  async function boot() {
    render();
    const cl = window.claude && typeof window.claude.use === 'function' ? window.claude : null;
    const db = cl ? await cl.use('db').catch(() => null) : null;
    if (db) {
      K.mode = 'cloud';
      K.db = db;
      cl.use('user').then(async (u) => {
        K.user = u;
        if (!u) return;
        const r = await Promise.all([u.id(), u.isOwner(), u.canEdit(), typeof u.can === 'function' ? u.can('data.write') : null]);
        K.me = { id: r[0] || '', admin: !!(r[1] || r[2]), canWrite: r[3] };
        if (r[3] === false) D.noWrite = true;
        K.subscribeBugs();
        K.refresh();
      }).catch(() => {});
      cl.use('assets').then((a) => { K.assets = a; K.refresh(); }).catch(() => {});
      cl.use('sample').then((s) => {
        K.sample = s;
        if (s && typeof s.limits === 'function') s.limits().then((l) => { K.sampleImages = l && l.images ? Math.min(4, l.images.maxCount || 1) : 0; K.refresh(); }).catch(() => {});
      }).catch(() => {});
    } else if (K.Fire) {
      /* the kitchen's own database: data starts flowing once this phone has joined (cloud.js) */
      K.mode = 'firebase';
      K.db = K.Fire.db;
      K.assets = K.Fire.assets;
      ui.auth = 'wait';
      if (location.hash === '#setup') ui.authWant = 'setup';
      else fromHash(location.hash);
      try { history.replaceState({ k: 0 }, '', location.hash === '#setup' ? '#recipes' : location.hash || '#' + hashFor()); } catch (e) { /* file:// */ }
      ui.focusSearch = ui.view === 'recipes' && finePointer();
      K.Fire.start();
      render(true);
      K.paintTimers();
      return;
    } else if (K.BUILD === 'artifact') {
      K.mode = 'none';
      render();
      return;
    } else {
      K.mode = 'local';
      K.db = new K.LocalDB(seed);
      await K.LocalAssets.init();
      K.assets = K.LocalAssets;
      K.me = { id: '', admin: true, canWrite: true };
      K.subscribeBugs();
      fromHash(location.hash);
      try { history.replaceState({ k: 0 }, '', location.hash || '#' + hashFor()); } catch (e) { /* file:// */ }
    }
    if (K.mode === 'cloud') fromHash(location.hash);
    ui.focusSearch = ui.view === 'recipes' && finePointer();
    K.subscribe();
    render(true);
    K.paintTimers();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
