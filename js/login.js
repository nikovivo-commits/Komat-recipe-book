/* Signing in to the kitchen's own database (cloud.js): cooks join with their name and the
   kitchen code, the head chef signs in with email, and the head chef manages people and the code. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const lg = () => (ui.lg = ui.lg || { name: '', code: '', email: '', pw: '' });

  function go(screen) { ui.auth = screen; ui.authWant = screen; ui.authErr = ''; ui.authNote = ''; K.render(true); }
  function run(fn, after) {
    ui.authBusy = true; ui.authErr = ''; ui.authNote = ''; K.render();
    fn().then(() => { ui.authBusy = false; if (after) after(); K.render(); },
      (e) => { ui.authBusy = false; ui.authErr = K.Fire.authErr(e); K.render(); });
  }
  const input = (key, attrs) => h('input', Object.assign({ class: 'input big', id: 'lg-' + key, value: lg()[key], required: true, oninput: (e) => { lg()[key] = e.target.value; } }, attrs));
  const linkBtn = (label, onclick) => h('button', { type: 'button', class: 'linkish', onclick: onclick }, label);
  const msg = () => [
    ui.authErr ? h('p', { class: 'banner bad', role: 'alert' }, ui.authErr) : null,
    ui.authNote ? h('p', { class: 'banner', role: 'status' }, ui.authNote) : null,
  ];
  const submit = (label, busyLabel) => h('button', { class: 'btn primary wide', type: 'submit', disabled: !!ui.authBusy }, ui.authBusy ? busyLabel : label);

  function joinForm() {
    const v = lg(), u = K.Fire.auth.currentUser, signedIn = u && !u.isAnonymous;
    return h('form', { class: 'login-card card', onsubmit: (e) => {
      e.preventDefault();
      const name = v.name.trim(), code = v.code.trim();
      if (!name || !code) { ui.authErr = 'Write your name and the kitchen code.'; K.render(); return; }
      run(() => K.Fire.join(name, code));
    } },
      h('h2', { class: 'login-title' }, 'Join the kitchen'),
      h('p', { class: 'muted' }, signedIn ? 'Signed in as ' + u.email + ', but not part of this kitchen yet. Join with the kitchen code.' : 'Your name and the kitchen code from the head chef. You only do this once on this phone.'),
      K.field('Your name', input('name', { autocomplete: 'given-name', maxlength: 40, enterkeyhint: 'next', placeholder: 'First name' })),
      K.field('Kitchen code', input('code', { autocomplete: 'off', autocapitalize: 'off', spellcheck: false, enterkeyhint: 'go', class: 'input big mono' })),
      msg(),
      submit('Join', 'Joining…'),
      h('div', { class: 'login-alt' },
        signedIn ? linkBtn('Sign out', () => K.Fire.signOut()) : linkBtn('Head chef? Sign in with email', () => go('chef'))));
  }
  function chefForm() {
    const v = lg();
    return h('form', { class: 'login-card card', onsubmit: (e) => {
      e.preventDefault();
      if (!v.email.trim() || !v.pw) { ui.authErr = 'Write your email and password.'; K.render(); return; }
      run(() => K.Fire.signIn(v.email.trim(), v.pw), () => { lg().pw = ''; });
    } },
      h('h2', { class: 'login-title' }, 'Head chef sign-in'),
      K.field('Email', input('email', { type: 'email', autocomplete: 'username', autocapitalize: 'off', spellcheck: false, enterkeyhint: 'next' })),
      K.field('Password', input('pw', { type: 'password', autocomplete: 'current-password', enterkeyhint: 'go' })),
      msg(),
      submit('Sign in', 'Signing in…'),
      h('div', { class: 'login-alt' },
        linkBtn('Forgot your password?', () => {
          if (!v.email.trim()) { ui.authErr = 'Write your email first, then tap Forgot your password.'; K.render(); return; }
          run(() => K.Fire.resetPassword(v.email.trim()), () => { ui.authNote = 'Check your email for a link to set a new password.'; });
        }),
        linkBtn('Cook? Join with the kitchen code', () => go('join')),
        linkBtn('First time? Set up the kitchen', () => go('setup'))));
  }
  function setupForm() {
    const v = lg();
    return h('form', { class: 'login-card card', onsubmit: (e) => {
      e.preventDefault();
      const name = v.name.trim(), email = v.email.trim(), code = v.code.trim();
      if (!name || !email || !v.pw || !code) { ui.authErr = 'Fill in all four.'; K.render(); return; }
      if (v.pw.length < 6) { ui.authErr = 'Use a password of at least 6 characters.'; K.render(); return; }
      if (code.length < 6) { ui.authErr = 'Make the kitchen code at least 6 characters.'; K.render(); return; }
      run(() => K.Fire.setup(name, email, v.pw, code), () => { lg().pw = ''; K.toast('The kitchen is ready'); });
    } },
      h('h2', { class: 'login-title' }, 'Set up the kitchen'),
      h('p', { class: 'muted' }, 'Do this once. Your account becomes the head chef’s. Cooks join with the kitchen code you choose here.'),
      K.field('Your name', input('name', { autocomplete: 'given-name', maxlength: 40 })),
      K.field('Email', input('email', { type: 'email', autocomplete: 'username', autocapitalize: 'off', spellcheck: false })),
      K.field('Password', input('pw', { type: 'password', autocomplete: 'new-password', minlength: 6 }), 'At least 6 characters.'),
      K.field('Kitchen code for cooks', input('code', { autocomplete: 'off', autocapitalize: 'off', spellcheck: false, class: 'input big mono', minlength: 6 }), 'Easy to say out loud, like basil-42. You can change it later.'),
      msg(),
      submit('Set up the kitchen', 'Setting up…'),
      h('div', { class: 'login-alt' }, linkBtn('Already set up? Sign in', () => go('chef'))));
  }
  function removed() {
    return h('div', { class: 'login-card card' },
      h('h2', { class: 'login-title' }, 'This phone was taken off the kitchen'),
      h('p', { class: 'muted' }, 'The head chef removed it from the people list. Ask them for the kitchen code to join again.'),
      h('button', { class: 'btn primary wide', type: 'button', onclick: () => K.Fire.signOut() }, 'OK'));
  }

  const logo = () => h('img', { class: 'logo', src: 'assets/brand/logo.png', alt: 'Komat' });
  K.V.login = function () {
    const a = ui.auth;
    /* a phone that has joined before opens straight into the book, so the wait looks like any start-up */
    if (a === 'wait') return { top: h('span', { hidden: true }), body: h('div', { class: 'boot' }, h('div', { class: 'boot-mark' }, logo()), h('p', { class: 'muted' }, 'Opening the kitchen book…')), tabs: false };
    const top = h('section', { class: 'hero photo login-hero' }, K.photoLayer('assets/photos/theme/today.jpg'), K.rays('ph-rays'),
      h('div', { class: 'wrap hero-in' }, h('span', { class: 'login-mark' }, logo()),
        h('h1', { class: 'hero-title' }, 'The kitchen ', h('em', null, 'book')),
        h('p', { class: 'hero-sub' }, 'Recipes, mise en place, orders and the rota, shared with the whole team.')));
    let card;
    if (a === 'chef') card = chefForm();
    else if (a === 'setup') card = setupForm();
    else if (a === 'removed') card = removed();
    else card = joinForm();
    return { top: top, body: h('div', { class: 'wrap login' }, card), tabs: false };
  };

  /* ---------- people and the kitchen code (head chef) ---------- */
  K.openPeople = function () {
    ui.sheet = { type: 'people', code: null, editCode: false, confirm: '' };
    K.render();
    K.Fire.getCode().then((c) => { if (ui.sheet && ui.sheet.type === 'people') { ui.sheet.code = c; K.render(); } }, () => {});
  };
  K.SHEETS.people = function (S) {
    const owner = K.Fire.ownerUid, list = Object.keys(D.members).map((id) => Object.assign({ id: id }, D.members[id]))
      .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'admin' ? -1 : 1));
    const site = location.origin + location.pathname.replace(/index\.html$/, '');
    const codeBox = S.editCode
      ? h('form', { class: 'inline-form', onsubmit: (e) => {
        e.preventDefault();
        const v = document.getElementById('new-code').value.trim();
        if (v.length < 6) { K.toast('Make the code at least 6 characters.', { tone: 'bad' }); return; }
        K.Fire.setCode(v).then(() => { S.code = v; S.editCode = false; K.render(); K.toast('New kitchen code saved'); }, K.writeFailed);
      } },
        h('input', { class: 'input mono', id: 'new-code', value: S.code || '', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, 'aria-label': 'New kitchen code', minlength: 6 }),
        h('button', { class: 'btn primary', type: 'submit' }, 'Save'))
      : h('div', { class: 'code-row' }, h('b', { class: 'kcode mono' }, S.code === null ? '…' : S.code || 'not set'),
        h('button', { class: 'btn small', type: 'button', onclick: () => { S.editCode = true; K.render(); const el = document.getElementById('new-code'); if (el) el.focus(); } }, 'Change'));
    return K.sheet('People and kitchen code', h('div', { class: 'stack' },
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Kitchen code'), codeBox,
        h('p', { class: 'hint' }, 'New cooks open ', h('b', { class: 'sel' }, site), ' on their phone, add it to the home screen, and join with their name and this code. Changing the code does not remove anyone.')),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'People (' + list.length + ')'),
        h('ul', { class: 'people' }, list.map((p) => {
          const me = p.id === K.me.id, isOwner = p.id === owner, sure = S.confirm === p.id;
          return h('li', { class: 'person' },
            h('span', { class: 'p-name' }, h('b', null, p.name || 'No name'), me ? h('span', { class: 'muted' }, ' (you)') : null),
            h('span', { class: 'codechip' + (p.role === 'admin' ? ' chef' : '') }, isOwner ? 'Owner' : p.role === 'admin' ? 'Head chef' : 'Cook'),
            !isOwner && !me ? h('span', { class: 'btns' },
              h('button', { class: 'btn small', type: 'button', onclick: () => K.Fire.setRole(p.id, p.role === 'admin' ? 'cook' : 'admin').catch(K.writeFailed) }, p.role === 'admin' ? 'Make cook' : 'Make head chef'),
              h('button', { class: 'btn small danger', type: 'button', onclick: () => {
                if (!sure) { S.confirm = p.id; K.render(); return; }
                S.confirm = ''; K.Fire.remove(p.id).then(() => K.toast(p.name + ' removed'), K.writeFailed);
              } }, sure ? 'Tap again to remove' : 'Remove')) : null);
        })),
        h('p', { class: 'hint' }, 'Head chefs can change recipes, lists, the rota, events and settings. Remove people who have left the team.'))), { wide: true });
  };
})();
