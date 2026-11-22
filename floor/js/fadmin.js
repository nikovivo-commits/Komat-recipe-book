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
    return { top: top, body: h('div', { class: 'wrap login' }, card), tabs: false };
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
      !fire ? link('edit', 'Your name', K.myName() || 'Not set', open('name')) : null,
      fire && K.me.admin ? link('lock', 'People and floor code', 'Who has joined, roles, the code waiters join with', () => K.openPeople()) : null,
      K.canEdit() ? link('glass', 'Add a wine', 'With a photo of its label', () => { ui.sheet = { type: 'wineedit', id: null }; K.render(); }) : null,
      K.canEdit() ? link('plate', 'Add to the food bible', 'A kitchen recipe, or a dish of the floor’s own', open('adddish')) : null,
      K.canEdit() ? link('trophy', 'Add a quiz question', null, open('qedit', { id: null })) : null,
      K.canEdit() ? link('rota', 'The floor team', 'The people on the schedule', open('team')) : null,
      K.canEdit() && !ex ? link('sparkle', 'Load the example wines', 'Six Bulgarian wines and notes, to see how it works', () => { ui.sheet = null; K.loadExamples(); K.render(); }) : null,
      K.canEdit() && ex ? link('trash', 'Remove the examples', 'The example wines, dish notes and questions', () => { ui.sheet = null; K.removeExamples(); K.render(); }) : null,
      K.canEdit() ? link('list', 'Load the house menu and drinks', 'The printed menu, wine list and drinks, already typed in. What you have changed is kept.', loadHouse) : null,
      K.canEdit() ? link('download', 'Prices and stock from Hype', 'Read a file exported from the till: bottles in stock and prices', open('hype')) : null,
      K.canEdit() ? link('upload', 'Add from a file', 'Wines, notes or a week prepared as a file', importFile) : null,
      K.canEdit() ? link('download', 'Backup', 'Save everything in the floor book to a file', exportFile) : null,
      link('kitchen', 'The kitchen book', 'Recipes, prep lists and The Brigade', null, { href: '../' }),
      fire ? h('button', { class: 'btn wide', type: 'button', onclick: () => K.Fire.signOut() }, 'Sign out of this phone') : null));
  };

  /* a file prepared for the floor book: {docs: {"wines/id": {...}}}; it only adds and replaces */
  /* the restaurant's own menu and wine list, kept with the app (floor/data/house.json): wines that are not in yet
     are added, and the menu opens for checking against the kitchen's dishes */
  function loadHouse() {
    K.toast('Loading the menu and wine list…');
    fetch('floor/data/house.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : Promise.reject(r))).then((j) => {
      const docs = j.docs || {}, add = Object.keys(docs).filter((p) => p.startsWith('wines/') && !K.wine(p.slice(6)));
      /* bottles already in the book keep everything; one that has no picture yet gets the one that comes with the list */
      const pics = Object.keys(docs).filter((p) => p.startsWith('wines/') && docs[p].label).map((p) => [K.wine(p.slice(6)), docs[p].label, docs[p].focus || null]).filter((x) => x[0] && !x[0].label);
      return Promise.all(add.map((p) => K.db.doc(p).set(docs[p])).concat(pics.map((x) => K.saveWine(Object.assign({}, x[0], { label: x[1], focus: x[2] }))))).then(() => {
        K.toast([add.length ? add.length + ' wines and drinks added' : '', pics.length ? pics.length + ' label pictures added' : ''].filter(Boolean).join(' · ') || 'The wines and drinks were already in');
        if (Array.isArray(j.menu) && j.menu.length) ui.sheet = { type: 'menuimport', extra: 0, items: matchMenu(j.menu) };
        else ui.sheet = null;
        K.render();
      });
    }).catch((e) => (e && e.code ? K.writeFailed(e) : K.toast('The menu file could not be loaded. Check the connection and try again.', { tone: 'bad' })));
  }
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
  function matchMenu(menu) {
    const items = menu.map((e) => { const m = matchDish(e); return { e: e, to: m.id, score: m.score }; });
    items.forEach((x) => { if (x.to && items.some((y) => y !== x && y.to === x.to && y.score > x.score)) x.to = ''; });
    return items;
  }
  K.SHEETS.menuimport = function (S) {
    const opts = [['', 'Skip this line'], ['__own', 'Not in the kitchen book: add as the floor’s own']].concat(D.recipes.slice().sort((a, b) => a.name.localeCompare(b.name)).map((r) => [r.id, r.name + (r.onMenu ? '' : ' (off the menu)')]));
    const n = S.items.filter((x) => x.to).length;
    const save = () => {
      const used = {};
      S.items.forEach((x, i) => {
        if (!x.to) return;
        const e = Object.assign({}, x.e); delete e.match;
        if (x.to === '__own') { const id = 'own-' + K.safeId(K.normName(e.en || e.menuName).replace(/ /g, '-')); e.name = e.menuName; delete e.menuName; K.saveNote(id, e); return; }
        if (used[x.to]) return;
        used[x.to] = 1;
        K.saveNote(x.to, Object.assign({ recipe: x.to }, e));
      });
      ui.sheet = null; K.render(); K.toast(n + ' dishes filled in');
    };
    return K.sheet('Check the menu', h('div', { class: 'stack' },
      h('p', { class: 'hint' }, 'Each line of the menu, and the kitchen dish it will be written onto. Correct any that are wrong, then save. Nothing in the kitchen book changes.' + (S.extra ? ' ' + S.extra + ' other records (wines) are already in.' : '')),
      h('div', { class: 'mi-list' }, S.items.map((x, i) => h('div', { class: 'mi-row' + (x.to ? '' : ' none') },
        h('div', { class: 'mi-name' }, h('b', null, x.e.menuName), h('span', { class: 'ing-en' }, x.e.en || '')),
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
