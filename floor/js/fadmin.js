/* Joining the floor, settings, people and the floor code, backups and files. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const lg = () => (ui.lg = ui.lg || { name: '', code: '', email: '', pw: '' });

  /* ---------- joining (the kitchen's own database) ---------- */
  function go(screen) { ui.auth = screen; ui.authErr = ''; ui.authNote = ''; K.render(true); }
  function run(fn, after) {
    ui.authBusy = true; ui.authErr = ''; ui.authNote = ''; K.render();
    fn().then(() => { ui.authBusy = false; if (after) after(); K.render(); },
      (e) => { ui.authBusy = false; ui.authErr = K.Fire.authErr(e).replace('kitchen code', 'floor code').replace('the head chef', 'the floor manager'); K.render(); });
  }
  const input = (key, attrs) => h('input', Object.assign({ class: 'input big', id: 'lg-' + key, value: lg()[key], required: true, oninput: (e) => { lg()[key] = e.target.value; } }, attrs));
  const linkBtn = (label, onclick) => h('button', { type: 'button', class: 'linkish', onclick: onclick }, label);
  const msg = () => [ui.authErr ? h('p', { class: 'banner bad', role: 'alert' }, ui.authErr) : null, ui.authNote ? h('p', { class: 'banner', role: 'status' }, ui.authNote) : null];
  const submit = (label, busy) => h('button', { class: 'btn primary wide', type: 'submit', disabled: !!ui.authBusy }, ui.authBusy ? busy : label);
  function joinForm() {
    const v = lg(), u = K.Fire.auth.currentUser, signedIn = u && !u.isAnonymous;
    return h('form', { class: 'login-card card', onsubmit: (e) => {
      e.preventDefault();
      const name = v.name.trim(), code = v.code.trim();
      if (!name || !code) { ui.authErr = 'Write your name and the floor code.'; K.render(); return; }
      run(() => K.Fire.join(name, code));
    } },
      h('h2', { class: 'login-title' }, 'Join the floor'),
      h('p', { class: 'muted' }, signedIn ? 'Signed in as ' + u.email + ', but not part of the team yet. Join with the floor code.' : 'Your name and the floor code from the floor manager. You only do this once on this phone.'),
      K.field('Your name', input('name', { autocomplete: 'given-name', maxlength: 40, placeholder: 'First name' }), 'As it is on the schedule, so your shifts find you.'),
      K.field('Floor code', input('code', { autocomplete: 'off', autocapitalize: 'off', spellcheck: false, class: 'input big mono' })),
      msg(), submit('Join', 'Joining…'),
      h('div', { class: 'login-alt' },
        signedIn ? linkBtn('Sign out', () => K.Fire.signOut()) : linkBtn('Manager or chef? Sign in with email', () => go('chef')),
        h('a', { class: 'linkish', href: '../' }, 'In the kitchen? Open the kitchen book')));
  }
  function chefForm() {
    const v = lg();
    return h('form', { class: 'login-card card', onsubmit: (e) => {
      e.preventDefault();
      if (!v.email.trim() || !v.pw) { ui.authErr = 'Write your email and password.'; K.render(); return; }
      run(() => K.Fire.signIn(v.email.trim(), v.pw), () => { lg().pw = ''; });
    } },
      h('h2', { class: 'login-title' }, 'Sign in'),
      h('p', { class: 'muted' }, 'The same account as in the kitchen book.'),
      K.field('Email', input('email', { type: 'email', autocomplete: 'username', autocapitalize: 'off', spellcheck: false })),
      K.field('Password', input('pw', { type: 'password', autocomplete: 'current-password' })),
      msg(), submit('Sign in', 'Signing in…'),
      h('div', { class: 'login-alt' },
        linkBtn('Forgot your password?', () => {
          if (!v.email.trim()) { ui.authErr = 'Write your email first, then tap Forgot your password.'; K.render(); return; }
          run(() => K.Fire.resetPassword(v.email.trim()), () => { ui.authNote = 'Check your email for a link to set a new password.'; });
        }),
        linkBtn('Waiter? Join with the floor code', () => go('join'))));
  }
  K.V.login = function () {
    const a = ui.auth, logo = h('img', { class: 'logo', src: 'assets/brand/logo.png', alt: 'Komat' });
    if (a === 'wait') return { top: h('span', { hidden: true }), body: h('div', { class: 'boot' }, h('div', { class: 'boot-mark' }, logo), h('p', { class: 'muted' }, 'Opening the floor book…')), tabs: false };
    const top = h('section', { class: 'hero photo login-hero' }, K.photoLayer('assets/photos/theme/recipes.jpg'), K.rays('ph-rays'),
      h('div', { class: 'wrap hero-in' }, h('span', { class: 'login-mark' }, logo),
        h('h1', { class: 'hero-title' }, 'The floor ', h('em', null, 'book')),
        h('p', { class: 'hero-sub' }, 'The food and wine bibles, the cellar, the quiz and the schedule, shared with the whole floor.')));
    let card;
    if (a === 'chef' || a === 'nokitchen' && !K.Fire.auth.currentUser) card = chefForm();
    else if (a === 'removed') card = h('div', { class: 'login-card card' }, h('h2', { class: 'login-title' }, 'This phone was taken off the team'),
      h('p', { class: 'muted' }, 'Ask the floor manager for the floor code to join again.'), h('button', { class: 'btn primary wide', type: 'button', onclick: () => K.Fire.signOut() }, 'OK'));
    else card = joinForm();
    return { top: top, body: h('div', { class: 'wrap login' }, h('div', { class: 'login-lang' }, K.langSwitch()), card), tabs: false };
  };

  /* ---------- your name (the device copy has no sign-in) ---------- */
  K.namePrompt = function () {
    if (K.mode !== 'local' || ui.sheet || ui.nameAsked || K.myName()) return false;
    ui.nameAsked = true;
    ui.sheet = { type: 'name' };
    return true;
  };
  K.SHEETS.name = function (S) {
    const inp = h('input', { class: 'input big', id: 'nm', value: K.myName(), maxlength: 40, placeholder: 'First name', autocomplete: 'given-name' });
    return K.sheet('What is your name?', h('form', { class: 'stack', onsubmit: (e) => {
      e.preventDefault();
      const v = inp.value.trim();
      if (!v) return;
      K.store.set('fohName', v); K.me.name = v;
      ui.sheet = null; K.render();
      if (S.then) S.then();
    } }, h('p', { class: 'muted' }, 'It goes on the quiz board and next to the bottles you sell. Write it as it is on the schedule.'), inp,
      h('button', { class: 'btn primary wide', type: 'submit' }, 'Save')));
  };

  /* ---------- settings ---------- */
  const link = (icon, title, sub, onclick, attrs) => h(attrs && attrs.href ? 'a' : 'button', Object.assign({ class: 'set-link', type: attrs && attrs.href ? null : 'button', onclick: onclick }, attrs || {}),
    K.icon(icon), h('span', null, h('b', null, title), sub ? h('span', { class: 'muted' }, sub) : null), K.icon('next'));
  const open = (type, extra) => () => { ui.sheet = Object.assign({ type: type }, extra || {}); K.render(); };
  K.SHEETS.settings = function () {
    const fire = K.mode === 'firebase', ex = D.wines.some((w) => w.example) || Object.keys(D.notes).some((id) => D.notes[id].example);
    return K.sheet('Settings', h('div', { class: 'settings' },
      h('p', { class: 'muted' }, fire ? (K.me.name || 'You') + ' · ' + K.Fire.roleName(K.me.role) : 'This copy keeps everything on this device.'),
      h('div', { class: 'set-lang' }, h('span', { class: 'label' }, 'Language'), K.langSwitch()),
      !fire ? link('edit', 'Your name', K.myName() || 'Not set', open('name')) : null,
      fire && K.me.admin ? link('lock', 'People and floor code', 'Who has joined, roles, the code waiters join with', () => K.openPeople()) : null,
      K.canEdit() ? link('glass', 'Add a wine', 'With a photo of its label', () => { ui.sheet = { type: 'wineedit', id: null }; K.render(); }) : null,
      K.canEdit() ? link('plate', 'Add to the food bible', 'A kitchen recipe, or a dish of the floor’s own', open('adddish')) : null,
      K.canEdit() ? link('trophy', 'Add a quiz question', null, open('qedit', { id: null })) : null,
      K.canEdit() ? link('rota', 'The floor team', 'The people on the schedule', open('team')) : null,
      K.canEdit() && !ex ? link('sparkle', 'Load the example wines', 'Six Bulgarian wines and notes, to see how it works', () => { ui.sheet = null; K.loadExamples(); K.render(); }) : null,
      K.canEdit() && ex ? link('trash', 'Remove the examples', 'The example wines, dish notes and questions', () => { ui.sheet = null; K.removeExamples(); K.render(); }) : null,
      !K.demo && K.canEdit() ? link('check', 'Bring over what I confirmed in the demo', K.demoAnswers().length ? K.demoAnswers().length + ' dishes: allergens, who can eat them, bread' : 'Allergens and food preferences set in the demo', open('fromdemo')) : null,
      K.demo && K.demoAnswers().length ? link('copy', 'Copy what I confirmed here', 'To bring it into the real book from another phone or computer', () => {
        navigator.clipboard.writeText(JSON.stringify({ komatDemo: K.demoAnswers() })).then(() => K.toast('Copied. In the real book: Settings → Bring over what I confirmed in the demo → paste.'), () => K.toast('This device would not copy.', { tone: 'bad' }));
      }) : null,
      K.checkList && K.checkList().length ? link('check', 'Check every dish’s allergens', 'All ' + K.checkList().length + ' dishes, one by one: allergens, who can eat it, bread', () => K.checkAll()) : null,
      K.canEdit() ? link('list', 'Load the house menu and drinks', 'The printed menu, wine list and drinks, already typed in. What you have changed is kept.', () => loadHouse(false)) : null,
      K.canEdit() ? link('download', 'Prices and stock from Hype', 'Read a file exported from the till: bottles in stock and prices', open('hype')) : null,
      K.canEdit() ? link('upload', 'Add from a file', 'Wines, notes or a week prepared as a file', importFile) : null,
      K.canEdit() ? link('download', 'Backup', 'Save everything in the floor book to a file', exportFile) : null,
      link('kitchen', 'The kitchen book', 'Recipes, prep lists and The Brigade', null, { href: '../' }),
      fire ? h('button', { class: 'btn wide', type: 'button', onclick: () => K.Fire.signOut() }, 'Sign out of this phone') : null));
  };

  /* a file prepared for the floor book: {docs: {"wines/id": {...}}}; it only adds and replaces */
  /* the restaurant's own menu and wine list, kept with the app (floor/data/house.json): wines that are not in yet
     are added, and the menu opens for checking against the kitchen's dishes */
  function loadHouse(quiet) {
    if (!quiet) K.toast('Loading the menu and wine list…');
    fetch('floor/data/house.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : Promise.reject(r))).then((j) => {
      /* by itself: an older file than this app expects (a stale copy from the network) is left for the next opening */
      if (quiet && (+j.v || 0) < HOUSE_V) return null;
      /* the screen is drawn once at the end, not once for every record written */
      K.hold = 1; setTimeout(K.release, 15000);
      const docs = j.docs || {}, add = Object.keys(docs).filter((p) => p.startsWith('wines/') && !K.wine(p.slice(6)));
      /* bottles already in the book keep everything; one that has no picture yet gets the one that comes with the list */
      const pics = Object.keys(docs).filter((p) => p.startsWith('wines/') && docs[p].label).map((p) => [K.wine(p.slice(6)), docs[p].label, docs[p].focus || null]).filter((x) => x[0] && !x[0].label);
      /* a bottle already in the book takes what it lacks from the list: its notes, how it is made, its grape, its appellation */
      const FILL = ['nose', 'palate', 'made', 'story', 'grapes', 'appellation', 'region', 'country', 'body'];
      let noted = 0;
      Object.keys(docs).filter((p) => p.startsWith('wines/')).forEach((p) => {
        const w = K.wine(p.slice(6)), patch = {};
        if (!w) return;
        FILL.forEach((k) => { if (!w[k] && docs[p][k]) patch[k] = docs[p][k]; });
        /* a line still exactly as the list first wrote it takes the list's new wording; one changed by hand is kept */
        const hb = docs[p].bg || {}, wb = w.bg || {}, miss = Object.keys(hb).filter((k) => hb[k] && !wb[k]);
        if (miss.length) { patch.bg = Object.assign({}, wb); miss.forEach((k) => { patch.bg[k] = hb[k]; }); }
        Object.keys(docs[p].was || {}).forEach((k) => { if (docs[p][k] && w[k] === docs[p].was[k] && w[k] !== docs[p][k]) patch[k] = docs[p][k]; });
        if (Object.keys(patch).length) { K.saveWine(Object.assign({}, w, patch)); noted++; }
      });
      /* the quiz questions that come with the menu (what the house knows about its own dishes): added, and kept up to
         date while they are as the list wrote them. One a manager has rewritten is left alone. */
      let asked = 0;
      (j.quiz || []).forEach((q, i) => {
        const id = 'house-' + (q.id || i), cur = D.quizq.find((x) => x.id === id);
        if (cur && !cur.house) return;
        const doc = Object.assign({ topic: 'food', house: true, at: Date.now() }, q);
        delete doc.id;
        if (cur && sameRec(Object.assign({}, cur, { id: undefined, at: 0 }), Object.assign({}, doc, { at: 0 }))) return;
        D.quizq = D.quizq.filter((x) => x.id !== id).concat([Object.assign({ id: id }, doc)]);
        K.db.doc('quizq/' + id).set(doc).catch(K.writeFailed);
        asked++;
      });
      /* dishes already loaded from this menu get its corrected ingredient explanations */
      let fixed = 0;
      (j.menu || []).forEach((e) => Object.keys(D.notes).forEach((id) => {
        const n = D.notes[id];
        if (e.menuBg && n.menuBg === e.menuBg && e.niche && JSON.stringify(n.niche || []) !== JSON.stringify(e.niche)) { K.saveNote(id, { niche: e.niche }); fixed++; }
      }));
      const fresh = (o) => { const c = Object.assign({}, o); delete c.was; return c; };
      return Promise.all(add.map((p) => K.db.doc(p).set(fresh(docs[p]))).concat(pics.map((x) => K.saveWine(Object.assign({}, x[0], { label: x[1], focus: x[2] }))))).then(() => {
        if (!quiet) K.toast([asked ? asked + ' quiz questions added' : '', noted ? noted + ' wines: notes added' : '', fixed ? fixed + ' dishes: ingredient notes updated' : '', add.length ? add.length + ' wines and drinks added' : '', pics.length ? pics.length + ' label pictures added' : ''].filter(Boolean).join(' · ') || 'The wines and drinks were already in');
        houseNow = j;
        const first = [asked ? asked + ' quiz questions added' : '', noted ? noted + ' wines: notes added' : '', add.length ? add.length + ' wines and drinks added' : '', pics.length ? pics.length + ' label pictures added' : ''].filter(Boolean);
        if (!(Array.isArray(j.menu) && j.menu.length)) { if (!quiet) { ui.sheet = null; K.render(); } K.release(); return; }
        /* every line that has its dish is written straight away: nothing waits for a second step */
        const items = matchMenu(j.menu), r = applyMenu(j, items);
        if (j.v && (D.houseV || 0) !== +j.v) { D.houseV = +j.v; K.saveSetting('house', { v: j.v }); }
        /* by itself it says only what changed, and nothing when nothing did */
        if (!quiet) K.toast([menuSummary(j, r)].concat(first).join(' · '));
        else {
          const what = [r.w ? (r.w === 1 ? '1 dish' : r.w + ' dishes') : '', r.tw ? 'the tasting menu' : '', r.paired ? 'wines for ' + r.paired + ' dishes' : '', asked ? asked + ' quiz questions' : '', noted || add.length ? (noted + add.length) + ' wines' : ''].filter(Boolean);
          if (what.length) K.toast('Menu updated: ' + what.join(' · '));
        }
        K.release();
        /* opened by hand: the lines show, to point one at another dish or to add one that was left out */
        if (!quiet) ui.sheet = { type: 'menuimport', extra: 0, items: items, house: j, done: true };
        /* by itself it does not draw over what somebody is doing: the next quiet moment shows it */
        if (quiet) K.refresh(); else K.render();
      });
    }).catch((e) => { K.release(); return quiet ? null : e && e.code ? K.writeFailed(e) : K.toast('The menu file could not be loaded. Check the connection and try again.', { tone: 'bad' }); });
  }
  /* The house menu, wine list, pairings, tasting menu and quiz questions come with the app (floor/data/house.json).
     When the app carries a newer one than the book has, whoever runs the floor book gets it brought in on opening:
     no button to find. Only the real, shared book does this; what was changed by hand is kept, as when loading by hand. */
  /* the same record, whatever order its fields come in */
  const sorted = (o) => (Array.isArray(o) ? o.map(sorted) : o && typeof o === 'object' ? Object.keys(o).sort().reduce((a, k) => { if (o[k] !== undefined) a[k] = sorted(o[k]); return a; }, {}) : o);
  const sameRec = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
  const HOUSE_V = 2026112603;
  K.houseSync = function (force) {
    if (K.demo || !K.canEdit() || (!force && (K.mode !== 'firebase' || (D.houseV || 0) >= HOUSE_V))) return false;
    loadHouse(true);
    return true;
  };
  function importFile() {
    K.pickFile('.json,application/json', false, (files) => {
      files[0].text().then((t) => {
        const j = JSON.parse(t), docs = (j && j.docs) || (j && j.menu ? {} : j) || {};
        const paths = Object.keys(docs).filter((p) => K.BOOK.includes(p.split('/')[0]) && p.split('/').length === 2);
        /* a menu prepared as a file: each line is matched to a kitchen dish by name, for you to check before it is saved */
        if (j && Array.isArray(j.menu) && j.menu.length) {
          return Promise.all(paths.map((p) => K.db.doc(p).set(docs[p]))).then(() => { ui.sheet = { type: 'menuimport', extra: paths.length, items: matchMenu(j.menu) }; K.render(); });
        }
        if (!paths.length) { K.toast('Nothing for the floor book in that file.', { tone: 'bad' }); return; }
        return Promise.all(paths.map((p) => K.db.doc(p).set(docs[p]))).then(() => { ui.sheet = null; K.render(); K.toast(paths.length + ' records added'); });
      }).catch(() => K.toast('That file could not be read.', { tone: 'bad' }));
    });
  }
  /* the kitchen recipe a menu line belongs to: the same name (Bulgarian, English or the kitchen's other name),
     else a name that contains it; dishes on the menu win a tie. '' when nothing fits. */
  function matchDish(e) {
    const want = [e.menuName, e.en].concat(e.match || []).map(K.normName).filter(Boolean);
    let best = '', score = 0;
    D.recipes.forEach((r) => {
      const have = [r.name, r.aka, K.en(r.name)].map(K.normName).filter(Boolean);
      let s = 0;
      want.forEach((w) => have.forEach((x) => {
        if (w === x) s = Math.max(s, 100);
        else if (w.length >= 5 && x.length >= 5 && (x.includes(w) || w.includes(x))) s = Math.max(s, 60 - Math.min(30, Math.abs(x.length - w.length)));
      }));
      if (!s) return;
      s += (r.type === 'dish' ? 5 : 0) + (r.onMenu ? 5 : 0);
      if (s > score) { score = s; best = r.id; }
    });
    return { id: best, score: score };
  }
  /* every line with its best kitchen dish; when two lines want the same dish, the better fit keeps it */
  /* the lines the tasting menu is made of (set while a list with a tasting menu is being loaded) */
  let houseNow = null;
  const tastingKeys = () => { const t = houseNow && houseNow.tasting; return t ? t.courses.map((c) => c.key).concat(t.extra ? [t.extra.key] : []) : []; };
  function matchMenu(menu) {
    /* a course that only the tasting menu has is the floor's own unless the kitchen book has it */
    /* so is a course of the tasting menu that the kitchen book has under no name the list knows: without it the menu could not be set */
    const need = tastingKeys();
    const items = menu.map((e) => {
      /* in the book already, from an earlier load: the same dish again (a kitchen recipe, or the floor's own) */
      const known = Object.keys(D.notes).find((id) => e.menuBg && D.notes[id].menuBg === e.menuBg), kn = known ? D.notes[known] : null;
      if (kn) return { e: e, to: kn.recipe && D.recipes.some((r) => r.id === kn.recipe) ? kn.recipe : known === ownId(e) ? '__own' : '', score: 200, need: need.includes(e.en) };
      const m = matchDish(e);
      return { e: e, to: m.id || (e.only === 'tasting' || need.includes(e.en) ? '__own' : ''), score: m.score, need: need.includes(e.en) };
    });
    items.forEach((x) => { if (x.to && items.some((y) => y !== x && y.to === x.to && y.score > x.score)) x.to = ''; });
    return items;
  }
  /* ---------- what was confirmed in the demo, brought into the real book ----------
     The demo keeps its data in the browser, at the same address as the real app, so the book can read it on the
     device where the demo was used. For each demo dish somebody worked on: the allergens settled on, who can eat it,
     the bread, what it can be made into. A dish is found in the book by its line on the menu, or its name. */
  const ANSWERS = ['diet', 'butterOnly', 'bread', 'breadAl', 'canDiet', 'canHow', 'canAl', 'notAl'];
  const answered = (n) => !!(n.updated && (n.checked || n.diet || n.bread || n.canDiet || n.butterOnly || (n.allergens || []).length || (n.notAl || []).length));
  K.demoAnswers = function () {
    const best = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!/^komat\.floor\.demo\.v\d+$/.test(key)) continue;
        const docs = JSON.parse(localStorage.getItem(key) || '{}');
        Object.keys(docs).forEach((p) => {
          const n = docs[p], k = n && (n.menuBg || n.en || n.name);
          if (p.indexOf('dishnotes/') !== 0 || !k || !answered(n)) return;
          if (!best[k] || (n.updated || 0) > (best[k].updated || 0)) best[k] = n;
        });
      }
    } catch (e) { /* this browser keeps nothing */ }
    return Object.keys(best).map((k) => best[k]);
  };
  /* the allergens a demo dish ended with, once confirmed: found in its ingredients and menu line, plus what was ticked, minus what was unticked */
  const demoSet = (n) => {
    if (!n.checked) return null;
    const m = Object.assign({}, n);
    if (n.notAl === undefined) m.notAl = Object.keys(K.menuAllergens({ n: n }));
    return Object.keys(K.allergenWhere({ id: 'demo', name: n.name, en: n.en, ings: n.ings || [], parts: [], r: null, n: m }));
  };
  /* how many demo answers on this device have not been brought over yet */
  const movedAt = () => { try { return +JSON.parse(localStorage.getItem('komat.fohDemoMoved') || '0') || 0; } catch (e) { return 0; } };
  K.demoPending = () => (K.demo ? 0 : K.demoAnswers().filter((n) => (n.updated || 0) > movedAt()).length);
  K.SHEETS.fromdemo = function (S) {
    if (!S.items) S.items = (S.pasted || K.demoAnswers()).map((n) => ({ n: n, set: demoSet(n), d: K.dishes(true).find((x) => (n.menuBg && x.n.menuBg === n.menuBg) || (n.en && x.en === n.en) || x.name === n.name) || null }))
      .sort((a, b) => (a.d ? 0 : 1) - (b.d ? 0 : 1) || String(a.n.name).localeCompare(String(b.n.name)));
    const hardOf = (d) => { const w = K.allergenWhere(d); return Object.keys(w).filter((k) => w[k].some((x) => x !== 'ticked by hand' && !K.fromMenu(x))); };
    const can = S.items.filter((x) => x.d), lost = S.items.filter((x) => !x.d);
    const apply = () => {
      let done = 0, noRight = 0;
      can.forEach((x) => {
        const n = x.n, d = x.d, hard = hardOf(d), soft = Object.keys(K.menuAllergens(d)).filter((k) => !hard.includes(k));
        const flags = { butterOnly: !!n.butterOnly, bread: !!n.bread, breadAl: n.breadAl || [], diet: n.diet || '', canDiet: n.canDiet || '', canHow: n.canHow || '', canAl: n.canAl || [] };
        if (x.set) flags.notAl = soft.filter((k) => !x.set.includes(k));
        K.saveNote(d.id, flags);
        if (x.set) { if (K.canCheck(d)) K.confirmAllergens(d, x.set.filter((k) => !hard.includes(k))); else noRight++; }
        done++;
      });
      try { localStorage.setItem('komat.fohDemoMoved', JSON.stringify(Math.max.apply(null, S.items.map((x) => x.n.updated || 0).concat([Date.now()])))); } catch (e) { /* nothing kept: the card shows again */ }
      ui.sheet = null; K.render();
      K.toast(done + ' dishes brought over from the demo' + (noRight ? ' · ' + noRight + ' still need a chef or the owner to confirm' : ''));
    };
    const names = (l) => K.orderAl(l).map((k) => K.AL[k]).join(', ');
    const row = (x) => {
      const n = x.n, hard = x.d ? hardOf(x.d) : [], more = x.set ? hard.filter((k) => !x.set.includes(k)) : [];
      return h('li', { class: 'fd-row' + (x.d ? '' : ' none') },
        h('b', null, x.d ? x.d.name : n.name), n.en ? h('span', { class: 'card-en' }, n.en) : null,
        x.set ? h('span', null, x.set.length ? 'Allergens: ' + names(x.set) : 'No allergens') : h('span', { class: 'muted' }, 'Allergens not confirmed in the demo'),
        more.length ? h('span', { class: 'fd-more' }, 'The kitchen’s recipe also has: ' + names(more) + '. It stays until the recipe is corrected.') : null,
        n.diet || n.canDiet || n.bread || n.butterOnly ? h('span', { class: 'muted' }, [n.diet ? K.DIET[n.diet] : '', n.canDiet ? K.canText(n) : '', n.bread ? 'Served with bread' + ((n.breadAl || []).length ? ', can go without' : '') : '', n.butterOnly ? 'The only dairy is butter' : ''].filter(Boolean).join(' · ')) : null);
    };
    return K.sheet('From the demo', h('div', { class: 'stack' },
      h('p', { class: 'hint' }, 'What was confirmed in the demo on this device, matched to the dishes in the book by their line on the menu. Check it, then bring it over. An allergen the kitchen’s own recipe shows cannot be removed here.'),
      can.length ? h('ul', { class: 'fd-list' }, can.map(row)) : h('p', { class: 'muted' }, 'None of the demo’s dishes are in the book yet. Load the house menu first.'),
      lost.length ? [h('p', { class: 'hint' }, 'Not in the book yet (load the house menu first):'), h('ul', { class: 'fd-list' }, lost.map(row))] : null,
      h('button', { class: 'btn primary wide', type: 'button', disabled: !can.length, onclick: apply }, K.icon('check'), 'Bring over ' + can.length + ' dishes'),
      /* the demo was used on another phone or computer: its answers come over as copied text */
      h('details', { class: 'fd-paste' }, h('summary', null, 'The demo was on another phone or computer'),
        h('p', { class: 'hint' }, 'There, open the demo → Settings → Copy what I confirmed here. Then paste it below.'),
        h('textarea', { class: 'input', id: 'fd-paste', rows: '3', placeholder: 'Paste here', oninput: (e) => { S.text = e.target.value; } }),
        h('button', { class: 'btn', type: 'button', onclick: () => {
          let l = null;
          try { l = JSON.parse(S.text || '').komatDemo; } catch (e) { l = null; }
          if (!Array.isArray(l) || !l.length) { K.toast('That is not what the demo copies. Copy it again there and paste all of it.', { tone: 'bad' }); return; }
          S.pasted = l; S.items = null; K.render();
        } }, 'Use what I pasted'))), { wide: true });
  };
  /* ---------- writing the house menu into the book ----------
     `items` says, for each line of the menu, which dish it is: a kitchen recipe's id, '__own' (the floor's own
     dish), or '' (leave it out). Then the tasting menu and the house pairings are set.
     What somebody answered about a dish stays (ANSWERS). A text the house wrote before and nobody changed takes
     the house's new wording; one changed by hand is kept: each note remembers what the house last wrote (`house`). */
  const TEXTS = ['pitch', 'facts', 'story', 'niche', 'canHow'];
  const same = (x, y) => JSON.stringify(x === undefined ? null : x) === JSON.stringify(y === undefined ? null : y);
  function mergeEntry(cur, e) {
    const out = {}, snap = Object.assign({}, cur.house);
    Object.keys(e).forEach((k) => {
      if (k === 'was') return;
      if (ANSWERS.includes(k)) {
        /* left empty is not an answer: who can eat it, and what it can be made into, then take what the house says */
        const open = cur[k] === undefined || (k === 'diet' && cur.diet === '') || (['canDiet', 'canHow', 'canAl'].includes(k) && !cur.canDiet);
        /* still what the house said last time (remembered beside the note), or what it said before that was remembered
           (the entry's `was`): then the house's newer word takes its place. An answer somebody set by hand stays. */
        const last = snap['a_' + k], old = e.was ? e.was[k] : undefined;
        const fromHouse = last !== undefined ? same(cur[k], last) : old !== undefined && same(cur[k], old);
        if (open || fromHouse) out[k] = e[k];
        snap['a_' + k] = e[k];
        return;
      }
      if (k === 'bg') {
        const bg = Object.assign({}, cur.bg);
        Object.keys(e.bg).forEach((bk) => { const was = snap['bg_' + bk]; if (bg[bk] === undefined || was === undefined || same(bg[bk], was)) bg[bk] = e.bg[bk]; snap['bg_' + bk] = e.bg[bk]; });
        out.bg = bg;
        return;
      }
      if (TEXTS.includes(k)) { const was = snap[k]; if (cur[k] === undefined || cur[k] === '' || was === undefined || same(cur[k], was)) out[k] = e[k]; snap[k] = e[k]; return; }
      out[k] = e[k];
    });
    out.house = snap;
    return out;
  }
  const ownId = (e) => 'own-' + K.safeId(K.normName(e.en || e.menuName).replace(/ /g, '-'));
  function applyMenu(house, items) {
    const used = {};
    let n = 0, w = 0;
    /* a dish is written only when the house file changes something on it: nothing new, nothing saved */
    const put = (id, patch) => {
      const cur = D.notes[id] || {}, bare = (o) => Object.assign({}, o, { updated: 0 });
      n++;
      if (D.notes[id] && sameRec(bare(cur), bare(Object.assign({}, cur, patch)))) return;
      K.saveNote(id, patch); w++;
    };
    items.forEach((x) => {
      if (!x.to) return;
      const e = Object.assign({}, x.e); delete e.match;
      if (x.to === '__own') { const id = ownId(e); e.name = e.menuName; delete e.menuName; put(id, mergeEntry(D.notes[id] || {}, e)); return; }
      if (used[x.to]) return;
      used[x.to] = 1;
      put(x.to, Object.assign({ recipe: x.to }, mergeEntry(D.notes[x.to] || {}, e)));
    });
    /* the tasting menu that comes with the list: its courses, wines and prices, once every course is in the book */
    const t = house ? K.tastingFrom(house, (e) => { const d = K.dishes(true).find((x) => x.n.menuBg === e.menuBg); return d ? d.id : ''; }) : null;
    let tw = 0;
    if (t && !sameRec(Object.assign({}, D.tasting, { updated: 0, id: 0 }), Object.assign({}, t, { updated: 0, id: 0 }))) { K.saveSetting('tasting', t); tw = 1; }
    /* the house pairings that come with the list: written onto every dish that has none of its own */
    let paired = 0;
    (house && house.pairings || []).forEach((pr) => {
      const e = (house.menu || []).find((m) => m.en === pr.dish), d = e ? K.dishes(true).find((x) => x.n.menuBg === e.menuBg) : null;
      if (!d) return;
      const ok = pr.wines.filter((x) => K.wine(x.id)), why = {}, whyBg = {};
      ok.forEach((x) => { if (x.why) why[x.id] = x.why; if (x.whyBg) whyBg[x.id] = x.whyBg; });
      /* a dish paired on an earlier load keeps its wines when a manager changed them; one still paired exactly as
         the list paired it before takes the list's new choice. The reasons it keeps word for word get their Bulgarian. */
      const was = ((house.pairingsWas || {})[pr.dish] || []).join('|'), now = (d.n.pairs || []).join('|');
      if (now && now === ok.map((x) => x.id).join('|')) return;
      if (now && !(was && now === was)) {
        const have = d.n.pairWhy || {}, bgWhy = Object.assign({}, (d.n.bg || {}).pairWhy);
        let add = 0;
        pr.wines.forEach((x) => { if (x.whyBg && have[x.id] === x.why && !bgWhy[x.id]) { bgWhy[x.id] = x.whyBg; add++; } });
        if (add) K.saveNote(d.id, { bg: Object.assign({}, d.n.bg, { pairWhy: bgWhy }) });
        return;
      }
      if (ok.length) { K.saveNote(d.id, { pairs: ok.map((x) => x.id), pairWhy: why, bg: Object.assign({}, d.n.bg, { pairWhy: whyBg }) }); paired++; }
    });
    return { n: n, w: w, t: t, tw: tw, paired: paired, left: items.filter((x) => !x.to).length };
  }
  const menuSummary = (house, r) => r.n + ' dishes filled in' + (r.t ? ' · tasting menu set' : house && house.tasting ? ' · the tasting menu is NOT set: one of its dishes was skipped' : '') + (r.paired ? ' · wines paired with ' + r.paired + ' dishes' : '');
  K.SHEETS.menuimport = function (S) {
    const opts = [['', 'Skip this line'], ['__own', 'Not in the kitchen book: add as the floor’s own']].concat(D.recipes.slice().sort((a, b) => a.name.localeCompare(b.name)).map((r) => [r.id, r.name + (r.onMenu ? '' : ' (off the menu)')]));
    const n = S.items.filter((x) => x.to).length;
    const save = () => {
      const r = applyMenu(S.house, S.items);
      ui.sheet = null; K.render(); K.toast(menuSummary(S.house, r));
    };
    return K.sheet('Check the menu', h('div', { class: 'stack' },
      S.done ? h('p', { class: 'banner' }, h('b', null, 'The menu is in. '), 'Below is each line and its dish, in case one points at the wrong dish or was left out. Change it and save; otherwise just close this.') : null,
      h('p', { class: 'hint' }, 'Each line of the menu, and the kitchen dish it will be written onto. Correct any that are wrong, then save. Nothing in the kitchen book changes.' + (S.extra ? ' ' + S.extra + ' other records (wines) are already in.' : '')),
      S.items.some((x) => x.need && !x.to) ? h('p', { class: 'banner' }, h('b', null, 'The tasting menu needs every one of its dishes. '), 'A line marked “tasting menu” is set to be skipped: choose its kitchen dish, or add it as the floor’s own.') : null,
      h('div', { class: 'mi-list' }, S.items.map((x, i) => h('div', { class: 'mi-row' + (x.to ? '' : ' none') },
        h('div', { class: 'mi-name' }, h('b', null, x.e.menuName), h('span', { class: 'ing-en' }, x.e.en || ''), x.need ? h('span', { class: 'pill' }, 'tasting menu') : null),
        K.select(opts, x.to, (v) => { x.to = v; K.render(); }, { class: 'input small', id: 'mi-' + i, 'aria-label': 'Kitchen dish for ' + x.e.menuName })))),
      h('button', { class: 'btn primary wide', type: 'button', disabled: !n, onclick: save }, 'Save ' + n + ' dishes')), { wide: true });
  };
  function exportFile() {
    Promise.all(K.BOOK.map((c) => K.db.collection(c).get().then((s) => s.docs.map((x) => [c + '/' + x.id, x.data()]))))
      .then((lists) => {
        const docs = {};
        lists.forEach((l) => l.forEach((p) => { docs[p[0]] = p[1]; }));
        const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify({ docs: docs }, null, 1)], { type: 'application/json' })), download: 'komat-floor-' + K.day(0) + '.json' });
        document.body.append(a); a.click(); a.remove();
      }, K.writeFailed);
  }

  /* ---------- people and the floor code ---------- */
  K.openPeople = function () {
    ui.sheet = { type: 'people', code: null };
    K.render();
    K.Fire.getCode().then((c) => { if (ui.sheet && ui.sheet.type === 'people') { ui.sheet.code = c; K.render(); } }, () => { if (ui.sheet) { ui.sheet.code = ''; ui.sheet.noRules = true; K.render(); } });
  };
  const FLOOR = ['viewer', 'waiter', 'manager'];
  K.SHEETS.people = function (S) {
    const owner = K.Fire.ownerUid, chef = K.Fire.FULL.includes(K.me.role) && K.me.role !== 'manager';
    const all = Object.keys(D.members).map((id) => Object.assign({ id: id }, D.members[id]));
    const floor = all.filter((p) => FLOOR.includes(p.role)).sort((a, b) => a.name.localeCompare(b.name));
    const kitchen = all.filter((p) => !FLOOR.includes(p.role));
    const site = location.origin + location.pathname.replace(/index\.html$/, '');
    const codeBox = S.edit
      ? h('form', { class: 'inline-form', onsubmit: (e) => {
        e.preventDefault();
        const v = document.getElementById('new-code').value.trim();
        if (v.length < 6) { K.toast('Make the code at least 6 characters.', { tone: 'bad' }); return; }
        K.Fire.setCode(v).then(() => { S.code = v; S.edit = false; K.render(); K.toast('New floor code saved'); }, K.writeFailed);
      } }, h('input', { class: 'input mono', id: 'new-code', value: S.code || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, minlength: 6, 'aria-label': 'Floor code' }), h('button', { class: 'btn primary', type: 'submit' }, 'Save'))
      : h('div', { class: 'code-row' }, h('b', { class: 'kcode mono' }, S.code === null ? '…' : S.code || 'not set yet'), h('button', { class: 'btn small', type: 'button', onclick: () => { S.edit = true; K.render(); } }, S.code ? 'Change' : 'Set it'));
    return K.sheet('People and floor code', h('div', { class: 'stack' },
      S.noRules ? h('p', { class: 'banner bad' }, 'The database does not know the floor book yet: publish the new firebase/firestore.rules in the Firebase console first.') : null,
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Floor code'), codeBox,
        h('p', { class: 'hint' }, 'Waiters open ', h('b', { class: 'sel' }, site), ' on their phone, add it to the home screen and join with their name and this code. It is not the kitchen code.')),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'The floor (' + floor.length + ')'),
        floor.length ? h('ul', { class: 'people' }, floor.map((p) => {
          const me = p.id === K.me.id, sure = S.confirm === p.id;
          return h('li', { class: 'person' },
            h('span', { class: 'p-name' }, h('b', null, p.name || 'No name'), me ? h('span', { class: 'muted' }, ' (you)') : null),
            me ? h('span', { class: 'codechip' }, K.Fire.roleName(p.role)) : h('span', { class: 'btns' },
              K.select(K.Fire.ROLES.filter((r) => FLOOR.includes(r[0]) || chef), p.role, (v) => { if (document.activeElement) document.activeElement.blur(); K.Fire.setRole(p.id, v).then(() => K.toast(p.name + ' is now ' + K.Fire.roleName(v).toLowerCase()), K.writeFailed); }, { class: 'input small', 'aria-label': 'Role of ' + p.name }),
              h('button', { class: 'btn small danger', type: 'button', onclick: () => {
                if (!sure) { S.confirm = p.id; K.render(); return; }
                S.confirm = ''; K.Fire.remove(p.id).then(() => K.toast(p.name + ' removed'), K.writeFailed);
              } }, sure ? 'Tap again to remove' : 'Remove')));
        })) : h('p', { class: 'muted' }, 'Nobody has joined with the floor code yet.')),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'The kitchen (' + kitchen.length + ')'),
        h('p', { class: 'hint' }, 'Cooks can read the bibles, count bottles and play the quiz. Chefs can change everything here too. The head chef manages them in the kitchen book.'),
        h('p', { class: 'muted' }, kitchen.map((p) => p.name + (p.id === owner ? ' (set the kitchen up)' : '')).join(', ')))));
  };
})();
