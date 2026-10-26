/* Settings, branding, kitchen rules, backups and problem reports. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const WD = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];

  /* ---------- settings sheet ---------- */
  K.SHEETS.settings = function () {
    const rows = [];
    rows.push(h('div', { class: 'set-row' }, h('div', null, h('b', null, 'Recipe language'), h('span', { class: 'muted' }, 'The book is written in Bulgarian. English uses the translation list.')), K.langSwitch()));
    rows.push(h('div', { class: 'set-row' }, h('div', null, h('b', null, 'Where your changes go'),
      h('span', { class: 'muted' }, K.mode === 'cloud' ? 'Shared live in Claude. Everyone with access sees ticks, tasks and orders as they happen.'
        : K.mode === 'firebase' ? 'Shared live with the whole kitchen. A copy stays on this phone, so it keeps working when the Wi-Fi drops.'
          : 'This browser only. Nothing reaches the rest of the team from here.'))));
    if (K.mode === 'firebase') {
      rows.push(h('div', { class: 'set-row' }, h('div', null, h('b', null, 'Signed in as ' + (K.me.name || 'you')),
        h('span', { class: 'muted' }, (K.me.admin ? 'Head chef' : 'Cook') + (K.me.email ? ' · ' + K.me.email : ''))),
        h('button', { class: 'btn small', type: 'button', onclick: () => {
          if (K.me.guest && !ui.confirmOut) { ui.confirmOut = true; K.render(); return; }
          ui.confirmOut = false; K.Fire.signOut();
        } }, ui.confirmOut ? 'Tap again: you will need the code' : 'Sign out')));
      if (K.me.admin) rows.push(h('button', { class: 'set-link', type: 'button', onclick: () => K.openPeople() }, K.icon('chef'), h('span', null, h('b', null, 'People and kitchen code'), h('span', { class: 'muted' }, Object.keys(D.members).length + ' people can open the book')), K.icon('next')));
    }
    if (K.me.admin) {
      rows.push(h('button', { class: 'set-link', type: 'button', onclick: () => { ui.sheet = { type: 'kitchen', k: K.clone(K.kitchen()) }; K.render(); } }, K.icon('chef'), h('span', null, h('b', null, 'Kitchen rules'), h('span', { class: 'muted' }, 'Order deadline, repeating tasks, products to check daily')), K.icon('next')));
      rows.push(h('button', { class: 'set-link', type: 'button', onclick: () => { ui.sheet = null; K.go('brand'); } }, K.icon('photo'), h('span', null, h('b', null, 'Branding'), h('span', { class: 'muted' }, 'Logo and the photo at the top of each page')), K.icon('next')));
      rows.push(h('button', { class: 'set-link', type: 'button', onclick: () => { ui.sheet = { type: 'bugs' }; K.render(); } }, K.icon('bug'), h('span', null, h('b', null, 'Problem reports'), h('span', { class: 'muted' }, D.bugs.filter((b) => b.status !== 'fixed').length + ' open')), K.icon('next')));
    }
    if ((K.mode === 'cloud' || K.mode === 'firebase') && K.me.admin) {
      rows.push(h('div', { class: 'set-row' }, h('div', null, h('b', null, 'Clear old daily records'), h('span', { class: 'muted' }, 'Ticks, tasks, orders and whiteboard photos older than 30 days. Keeps the shared database lean.')),
        h('button', { class: 'btn small', type: 'button', disabled: !!ui.cleaning, onclick: () => {
          ui.cleaning = true; K.render();
          K.housekeeping(30).then((n) => { ui.cleaning = false; K.render(); K.toast(n ? 'Cleared ' + n + ' old records' : 'Nothing old to clear'); }, (e) => { ui.cleaning = false; K.render(); K.writeFailed(e); });
        } }, ui.cleaning ? 'Clearing…' : 'Clear')));
    }
    if (K.mode === 'firebase' && K.me.admin) {
      rows.push(h('div', { class: 'set-row' }, h('div', null, h('b', null, 'Backup'), h('span', { class: 'muted' }, 'Save the recipes, lists, rota and events to a file, or load one back. Loading replaces them for everyone.')),
        h('div', { class: 'btns' },
          h('button', { class: 'btn small', type: 'button', disabled: !!ui.backupBusy, onclick: exportBackup }, K.icon('download'), 'Export'),
          h('button', { class: 'btn small', type: 'button', disabled: !!ui.backupBusy, onclick: () => {
            if (!ui.confirmImport) { ui.confirmImport = true; K.render(); return; }
            ui.confirmImport = false; K.render(); K.importBackup();
          } }, K.icon('upload'), ui.backupBusy ? 'Loading…' : ui.confirmImport ? 'Tap again to choose a file' : 'Import'))));
    }
    if (K.mode === 'local') {
      rows.push(h('div', { class: 'set-row' }, h('div', null, h('b', null, 'Backup'), h('span', { class: 'muted' }, 'Save everything on this device to a file, or load one back.')),
        h('div', { class: 'btns' },
          h('button', { class: 'btn small', type: 'button', onclick: exportBackup }, K.icon('download'), 'Export'),
          h('button', { class: 'btn small', type: 'button', onclick: () => K.importBackup() }, K.icon('upload'), 'Import'))));
      rows.push(h('div', { class: 'set-row' }, h('div', null, h('b', null, 'Start over'), h('span', { class: 'muted' }, 'Put back the original recipes and lists. Your ticks, tasks and edits on this device are removed.')),
        h('button', { class: 'btn small danger', type: 'button', onclick: () => {
          if (!ui.confirmReset) { ui.confirmReset = true; K.render(); return; }
          ui.confirmReset = false; K.db.importAll(K.seedDocs()); ui.sheet = null; K.go('recipes'); K.toast('The book is back to its original recipes');
        } }, ui.confirmReset ? 'Tap again to reset' : 'Reset')));
    }
    /* tucked away at the bottom: recipes are mostly added through Claude, problems are rare */
    if (K.me.admin) rows.push(h('button', { class: 'set-link quiet', type: 'button', onclick: () => K.openAdd(ui.view === 'recipes' ? ui.cat : '') }, K.icon('plus'), h('span', null, h('b', null, 'Add a recipe by hand'), h('span', { class: 'muted' }, 'New dish, new prep, or scan a recipe sheet')), K.icon('next')));
    rows.push(h('button', { class: 'set-link quiet', type: 'button', onclick: () => { ui.sheet = { type: 'bug', text: '', photo: '' }; K.render(); } }, K.icon('bug'), h('span', null, h('b', null, 'Report a problem'), h('span', { class: 'muted' }, 'Something broken or confusing? Tell the head chef')), K.icon('next')));
    return K.sheet('Settings', h('div', { class: 'settings' }, rows));
  };
  function exportBackup() {
    ui.backupBusy = true; K.render();
    Promise.resolve(K.db.exportAll()).then((docs) => {
      ui.backupBusy = false; K.render();
      const blob = new Blob([JSON.stringify({ app: 'komat-kitchen-book', at: new Date().toISOString(), docs: docs }, null, 1)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'komat-backup-' + K.day(0) + '.json' });
      document.body.append(a); a.click(); a.remove();
      K.toast(K.mode === 'firebase' ? 'Backup saved. Photos stay in the kitchen database.' : 'Backup saved. Photos you added stay on this device.');
    }, (e) => { ui.backupBusy = false; K.render(); K.writeFailed(e); });
  }
  /* a backup can carry photos too ({assets: {id: data URL}}); the kitchen database keeps them */
  function loadAssets(map) {
    if (!map || K.mode !== 'firebase') return Promise.resolve();
    return Object.keys(map).reduce((p, id) => p.then(() => fetch(map[id]).then((r) => r.blob()).then((b) => K.assets.put(id, b))), Promise.resolve());
  }
  K.importBackup = function () {
    K.pickFile('application/json,.json', false, (f) => {
      f[0].text().then((t) => {
        const o = JSON.parse(t);
        if (!o || !o.docs || typeof o.docs !== 'object') throw new Error('shape');
        return o;
      }).then((o) => {
        ui.backupBusy = true; K.render();
        return loadAssets(o.assets).then(() => K.db.importAll(o.docs)).then(() => {
          ui.backupBusy = false; ui.sheet = null; K.go('recipes'); K.toast('Backup loaded');
        }, (e) => { ui.backupBusy = false; K.render(); K.writeFailed(e); });
      }, () => K.toast('That file is not a Komat backup.', { tone: 'bad' }));
    });
  };

  /* ---------- kitchen rules ---------- */
  K.SHEETS.kitchen = function (S) {
    const k = S.k;
    k.repeats = k.repeats || []; k.daily = k.daily || []; k.basics = k.basics || [];
    const addBasic = (e) => { e.preventDefault(); const el = document.getElementById('k-basic'), v = el.value.trim(); if (!v) return; if (!k.basics.some((x) => x.toLowerCase() === v.toLowerCase())) k.basics.push(v); el.value = ''; K.render(); };
    return K.sheet('Kitchen rules', h('div', { class: 'stack' },
      K.field('Tomorrow’s prep list starts at', h('input', { class: 'input mono', id: 'k-plan', type: 'time', value: k.planFrom || '21:00', oninput: (e) => { k.planFrom = e.target.value; } }),
        'From this time until 4 am the mise en place list is for the next day: whoever closes marks what needs making, and the morning shift finds it on their list. Anyone can switch between Today and Tomorrow by hand.'),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Repeating tasks'),
        h('p', { class: 'hint' }, 'They appear on a station’s to-do list on the chosen days, like ordering bread. A product name adds it to the top of that day’s order check.'),
        k.repeats.map((rp, i) => h('div', { class: 'rep card' },
          h('div', { class: 'xrow' }, h('input', { class: 'input', id: 'rp-n' + i, value: rp.name, placeholder: 'Task', 'aria-label': 'Task', oninput: (e) => { rp.name = e.target.value; } }),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove ' + rp.name, onclick: () => { k.repeats.splice(i, 1); K.render(); } }, K.icon('trash'))),
          h('div', { class: 'two' }, K.select(K.STATIONS, rp.station || 'pass', (v) => { rp.station = v; }, { class: 'input small', 'aria-label': 'Station' }),
            h('input', { class: 'input small', id: 'rp-i' + i, value: rp.item || '', placeholder: 'Product to order (optional)', 'aria-label': 'Product', oninput: (e) => { rp.item = e.target.value; } })),
          h('div', { class: 'daypick', role: 'group', 'aria-label': 'Days' }, WD.map((d) => h('button', { type: 'button', 'aria-pressed': (rp.days || []).includes(d[0]) ? 'true' : 'false', onclick: () => {
            rp.days = rp.days || []; const j = rp.days.indexOf(d[0]); if (j >= 0) rp.days.splice(j, 1); else rp.days.push(d[0]); K.render();
          } }, d[1]))))),
        h('button', { class: 'btn small', type: 'button', onclick: () => { k.repeats.push({ id: K.uid(), name: '', station: K.getStation(), days: [], item: '' }); K.render(); } }, K.icon('plus'), 'Repeating task')),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Check every day'),
        h('p', { class: 'hint' }, 'Products pinned to the top of a station’s order check, every day.'),
        k.daily.map((x, i) => h('div', { class: 'xrow' },
          h('input', { class: 'input', id: 'dl-n' + i, value: x.name, placeholder: 'Product', 'aria-label': 'Product', oninput: (e) => { x.name = e.target.value; } }),
          K.select(K.STATIONS, x.station || 'pass', (v) => { x.station = v; }, { class: 'input', 'aria-label': 'Station' }),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove ' + x.name, onclick: () => { k.daily.splice(i, 1); K.render(); } }, K.icon('close')))),
        h('button', { class: 'btn small', type: 'button', onclick: () => { k.daily.push({ station: K.getStation(), name: '' }); K.render(); } }, K.icon('plus'), 'Product')),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Never on the order check'),
        h('p', { class: 'hint' }, 'Basics the kitchen always has, so nobody has to swipe past them. Salt, pepper and water are always left out.'),
        k.basics.length ? h('div', { class: 'tags' }, k.basics.map((x, i) => h('span', { class: 'codechip basic' }, x,
          h('button', { type: 'button', class: 'chip-x', 'aria-label': 'Put ' + x + ' back on the order check', onclick: () => { k.basics.splice(i, 1); K.render(); } }, K.icon('close'))))) : null,
        h('form', { class: 'inline-form', onsubmit: addBasic },
          h('input', { class: 'input', id: 'k-basic', placeholder: 'e.g. Брашно', 'aria-label': 'Product to leave out', enterkeyhint: 'done' }),
          h('button', { class: 'btn', type: 'submit' }, 'Leave out'))),
      h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => {
        k.repeats = k.repeats.filter((r) => (r.name || '').trim() && (r.days || []).length).map((r) => ({ id: r.id || K.uid(), name: r.name.trim(), station: r.station || 'pass', days: r.days.slice().sort(), item: (r.item || '').trim() }));
        k.daily = k.daily.filter((x) => (x.name || '').trim()).map((x) => ({ station: x.station || 'pass', name: x.name.trim() }));
        k.basics = k.basics.map((x) => String(x).trim()).filter(Boolean);
        ui.sheet = null;
        K.saveKitchen(k).then(() => K.toast('Kitchen rules saved'));
      } }, 'Save'))), { wide: true });
  };

  /* ---------- branding ---------- */
  function upload(file, max, label) {
    if (!K.assets) return Promise.reject({ code: 'not_granted' });
    ui.uploading = label; K.render();
    return (max ? K.shrinkImage(file, max) : Promise.resolve(file)).then((b) => K.assets.upload(b))
      .then((r) => { ui.uploading = ''; return r; }, (e) => { ui.uploading = ''; K.render(); K.toast(e && e.message === 'read' ? 'That photo could not be read.' : K.uploadErr(e), { tone: 'bad' }); throw e; });
  }
  const drop = (id) => { if (K.assets && id) K.assets.delete(id).catch(() => {}); };
  K.V.brand = function () {
    const b = D.branding, hs = b.heroes || [];
    const top = K.subbar('Recipes', () => K.go('recipes'), [ui.uploading ? h('span', { class: 'upl' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), ui.uploading) : null], 'Branding');
    const w = h('div', { class: 'wrap page form' });
    w.append(h('h1', { class: 'rtitle' }, 'Branding'), h('p', { class: 'muted' }, 'The logo and photos at the top of the book.'));
    w.append(h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Logo'),
      h('p', { class: 'hint' }, 'A white or light logo on a transparent background looks best on the dark header. PNG or SVG.'),
      b.logo ? h('div', { class: 'logo-prev' }, h('img', { class: 'logo', src: K.media(b.logo), alt: 'Current logo' })) : null,
      h('div', { class: 'btns' },
        h('button', { class: 'btn', type: 'button', disabled: !K.assets || !!ui.uploading, onclick: () => K.pickFile('image/png,image/svg+xml,image/webp,image/jpeg', false, (f) => upload(f[0], 0, 'Uploading the logo…').then((r) => { const old = b.logo; return K.saveBranding({ logo: r.id }).then(() => drop(old)); }).catch(() => {})) }, K.icon('upload'), b.logo ? 'Replace logo' : 'Upload logo'),
        b.logo ? h('button', { class: 'btn', type: 'button', onclick: () => { const old = b.logo; K.saveBranding({ logo: '' }).then(() => drop(old)); } }, 'Remove') : null)));
    w.append(h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Header photo'),
      h('p', { class: 'hint' }, 'Sits behind the top of the recipe list. Wide shots of the room, the pass or the team work best. The first one is used.'),
      hs.length ? h('div', { class: 'heroes' }, hs.map((id, i) => h('figure', null, h('img', { src: K.media(id), alt: 'Restaurant photo ' + (i + 1) }),
        h('button', { class: 'icon-btn on-photo', type: 'button', 'aria-label': 'Remove photo ' + (i + 1), onclick: () => K.saveBranding({ heroes: hs.filter((x) => x !== id) }).then(() => drop(id)) }, K.icon('trash')),
        i > 0 ? h('button', { class: 'btn small light on-photo-l', type: 'button', onclick: () => { const n = hs.slice(); n.splice(i, 1); n.unshift(id); K.saveBranding({ heroes: n }); } }, 'Use this one') : h('span', { class: 'pill on-photo-l' }, 'In use')))) : null,
      h('button', { class: 'btn', type: 'button', disabled: !K.assets || !!ui.uploading, onclick: () => K.pickFile('image/*', true, (files) => {
        const ids = [];
        files.reduce((p, f) => p.then(() => upload(f, 2000, 'Uploading photos…').then((r) => ids.push(r.id))), Promise.resolve()).catch(() => {})
          .then(() => { if (ids.length) K.saveBranding({ heroes: hs.concat(ids) }); });
      }) }, K.icon('plus'), 'Add photos')));
    const pages = b.pages || {};
    w.append(h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Page photos'),
      h('p', { class: 'hint' }, 'The photo at the top of each page. Recipes changes dish every day unless you pick one.'),
      h('div', { class: 'pagephotos' }, K.PAGE_PHOTO_TABS.map((t) => {
        const cur = pages[t[0]];
        return h('div', { class: 'pp card' },
          h('img', { src: K.pagePhoto(t[0]), alt: '', loading: 'lazy' }),
          h('div', { class: 'pp-txt' }, h('b', null, t[1]), h('span', { class: 'muted small' }, cur ? 'Your photo' : t[0] === 'recipes' && hs[0] ? 'Header photo' : t[0] === 'recipes' ? 'A dish a day' : 'Komat photo'),
            h('div', { class: 'btns' },
              h('button', { class: 'btn small', type: 'button', disabled: !K.assets || !!ui.uploading, onclick: () => K.pickFile('image/*', false, (f) => upload(f[0], 2000, 'Uploading the photo…').then((r) => {
                const n = Object.assign({}, pages); n[t[0]] = r.id;
                return K.saveBranding({ pages: n }).then(() => { if (cur && cur.indexOf('/') < 0) drop(cur); });
              }).catch(() => {})) }, K.icon('photo'), 'Change'),
              cur ? h('button', { class: 'btn small', type: 'button', onclick: () => {
                const n = Object.assign({}, pages); delete n[t[0]];
                K.saveBranding({ pages: n }).then(() => { if (cur.indexOf('/') < 0) drop(cur); });
              } }, 'Reset') : null)));
      }))));
    if (!K.assets) w.append(h('p', { class: 'banner warn' }, 'Uploading needs editor access to the book.'));
    return { top: top, body: w, tabs: false };
  };

  /* ---------- problem reports ---------- */
  const VIEW_NAMES = { recipes: 'Recipes', recipe: 'Recipe', edit: 'Edit recipe', today: 'Today', stock: 'Order check', lists: 'Edit list', orders: 'Orders', schedule: 'Schedule', events: 'Events', brand: 'Branding' };
  K.SHEETS.bug = function (B) {
    const where = (VIEW_NAMES[ui.view] || ui.view) + (ui.view === 'today' || ui.view === 'stock' ? ' · ' + K.ST[K.getStation()] : '') + (ui.view === 'recipe' && K.find(ui.id) ? ' · ' + K.find(ui.id).name : '');
    const send = () => {
      const t = (B.text || '').trim();
      if (!t) { K.toast('Write what went wrong first.'); return; }
      B.sending = true; K.render();
      const doc = { text: t.slice(0, 2000), where: where, view: ui.view, at: Date.now(), by: K.me.id || '', status: 'open', notified: false, ua: (navigator.userAgent || '').slice(0, 160) };
      if (B.photo) doc.photo = B.photo;
      K.db.collection('bugs').add(doc).then(() => { ui.sheet = null; K.render(); K.toast(K.mode === 'cloud' ? 'Sent. Thank you!' : 'Saved on this device. Show it to the head chef, or report it in the shared version.'); },
        (e) => { B.sending = false; K.render(); K.writeFailed(e); });
    };
    return K.sheet('Report a problem', h('div', { class: 'stack' },
      h('p', { class: 'hint' }, 'What went wrong, or what should work differently? The head chef reads every report.'),
      h('textarea', { class: 'input', id: 'bugtext', rows: '5', placeholder: 'e.g. On Today, ticking a row on Cold did nothing', value: B.text, oninput: (e) => { B.text = e.target.value; } }),
      h('div', { class: 'btns' },
        h('button', { class: 'btn small', type: 'button', onclick: () => K.pickFile('image/*', false, (f) => K.photoDataUrl(f[0]).then((d) => { B.photo = d; K.render(); }, () => K.toast('Could not read that picture.'))) }, K.icon('photo'), B.photo ? 'Change screenshot' : 'Add a screenshot'),
        B.photo ? h('button', { class: 'btn small', type: 'button', onclick: () => { B.photo = ''; K.render(); } }, 'Remove') : null),
      B.photo ? h('img', { class: 'bug-shot', src: B.photo, alt: 'Screenshot' }) : null,
      h('p', { class: 'hint' }, 'Sent with it: the page (' + where + '), the time and your name.'),
      h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', disabled: B.sending, onclick: send }, B.sending ? 'Sending…' : 'Send report'))));
  };
  K.SHEETS.bugs = function () {
    const list = D.bugs.slice().sort((a, b) => (a.status === 'fixed') - (b.status === 'fixed') || (b.at || 0) - (a.at || 0));
    return K.sheet('Problem reports', h('div', { class: 'stack' }, list.length ? list.map((b) => h('div', { class: 'bugitem card' + (b.status === 'fixed' ? ' fixed' : '') },
      h('div', { class: 'muted small' }, new Date(b.at || 0).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · ' + (b.where || '') + (K.nameOf(b.by) ? ' · ' + K.nameOf(b.by) : '')),
      h('p', { class: 'prose' }, b.text || ''),
      b.photo ? h('img', { class: 'bug-shot', src: b.photo, alt: 'Screenshot' }) : null,
      h('div', { class: 'btns' }, h('button', { class: 'btn small', type: 'button', onclick: () => K.db.doc('bugs/' + b.id).update({ status: b.status === 'fixed' ? 'open' : 'fixed' }).catch(K.writeFailed) }, b.status === 'fixed' ? 'Reopen' : 'Mark fixed')))) : h('p', { class: 'none' }, 'No reports yet.')), { wide: true });
  };
})();
