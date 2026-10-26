/* Recipe editor: dishes and recipes, components, allergens, photos and plating videos,
   reading a recipe sheet from a photo, and keeping the mise en place lists in step. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;

  function blank(cat, type) {
    return { id: K.uid(), type: type === 'dish' ? 'dish' : 'recipe', name: '', category: typeof cat === 'string' ? cat : '', yieldQty: '', yieldUnit: type === 'dish' ? 'portions' : 'g',
      photo: '', videos: [], ingredients: [], steps: [], plating: '', notes: '', allergens: [], allergensChecked: false, components: [], station: '', services: ['alacarte'], onMenu: true };
  }
  function editComp(c) {
    c = K.normComp(c);
    return { cid: c.cid || 'c' + K.uid(), name: c.name === 'Component' ? '' : c.name, station: c.station || '', yieldQty: String(c.yieldQty || ''), yieldUnit: c.yieldUnit || 'g',
      ingredients: c.ingredients.length ? c.ingredients.map((i) => ({ q: i.q, u: i.u, n: i.n })) : [{ q: '', u: 'g', n: '' }], stepsText: c.steps.join('\n'), notes: c.notes, open: true };
  }
  K.startEdit = function (r, cat, type) {
    if (r) r = K.findSrc(r.id) || r;
    ui.isNew = !r;
    ui.orig = r ? K.clone(r) : null;
    const e = K.clone(r || blank(cat, type));
    e.stepsText = e.steps.join('\n');
    e.yieldQty = String(e.yieldQty || '');
    e.components = (e.components || []).map(editComp);
    e.components.forEach((c) => { c.open = false; });
    if (e.type === 'dish' && !e.components.length) e.components.push(editComp({}));
    if (!e.ingredients.length && e.type !== 'dish') e.ingredients.push({ q: '', u: 'g', n: '' });
    ui.edit = e; ui.editBase = JSON.stringify(e); ui.msg = ''; ui.confirmDel = false; ui.confirmLeave = false; ui.scan = null; ui.busy = false;
    K.go('edit');
  };
  const dirty = () => ui.edit && JSON.stringify(ui.edit) !== ui.editBase;
  const assetIds = (r) => { if (!r) return []; const a = []; if (r.photo) a.push(r.photo); (r.videos || []).forEach((v) => a.push(v.id)); return a; };
  const dropAssets = (ids) => { if (!K.assets) return; ids.forEach((id) => { K.assets.delete(id).catch(() => {}); }); };
  function leave() {
    const keep = assetIds(ui.orig);
    dropAssets(assetIds(ui.edit).filter((id) => !keep.includes(id)));
    const id = ui.edit.id, wasNew = ui.isNew;
    ui.edit = null; ui.scan = null; ui.confirmLeave = false;
    if (!wasNew && K.find(id)) K.go('recipe', { id: id }); else K.go('recipes');
  }
  function cancel() {
    if (dirty() && !ui.confirmLeave) { ui.confirmLeave = true; K.render(); return; }
    leave();
  }

  /* "50 g onion, brunoise" -> {q:'50', u:'g', n:'onion, brunoise'} */
  const UNIT_RE = /^(g|гр\.?|г|kg|кг|ml|мл|l|л|cl|dl|pcs|бр\.?|bunch|връзка|portions?|tbsp|tsp|с\.л\.|ч\.л\.|щипка|pinch)(?![a-zа-я])/i;
  function parseLine(line) {
    let s = line.replace(/^[\s\-•*·–]+/, '').trim();
    if (!s) return null;
    const m = s.match(/^(\d+(?:[.,]\d+)?(?:\s*[-–/]\s*\d+(?:[.,]\d+)?)?)\s*/);
    let q = '', u = '';
    if (m) { q = m[1].replace(/\s+/g, ''); s = s.slice(m[0].length); const um = s.match(UNIT_RE); if (um) { u = um[1]; s = s.slice(um[0].length).trim(); } }
    else {
      /* "onion 50 g" written the other way round */
      const t = s.match(/^(.*?)[\s:–-]+(\d+(?:[.,]\d+)?)\s*([a-zа-я.]{0,8})$/i);
      if (t && (!t[3] || UNIT_RE.test(t[3]))) { s = t[1].trim(); q = t[2]; u = t[3] || ''; }
    }
    u = ({ 'гр': 'g', 'гр.': 'g', 'г': 'g', 'кг': 'kg', 'мл': 'ml', 'л': 'L', l: 'L', 'бр': 'pcs', 'бр.': 'pcs' })[u.toLowerCase()] || u;
    return { q: q.replace(',', '.'), u: u, n: s.replace(/^[,:\s]+/, '') };
  }
  K.parseIngLine = parseLine;

  function ingEditor(list, key) {
    return h('div', { class: 'ing-edit' },
      h('div', { id: 'irows-' + key }, list.map((g, i) => h('div', { class: 'irow' },
        h('input', { class: 'input q mono', id: key + '-q' + i, inputmode: 'decimal', placeholder: 'Amount', 'aria-label': 'Amount, line ' + (i + 1), value: g.q, oninput: (ev) => { g.q = ev.target.value; } }),
        h('input', { class: 'input u', id: key + '-u' + i, list: 'unitl', placeholder: 'g', 'aria-label': 'Unit, line ' + (i + 1), value: g.u, oninput: (ev) => { g.u = ev.target.value; } }),
        h('input', { class: 'input n', id: key + '-n' + i, placeholder: 'Ingredient', 'aria-label': 'Ingredient, line ' + (i + 1), value: g.n, oninput: (ev) => { g.n = ev.target.value; }, onchange: refreshAllergens }),
        h('button', { class: 'icon-btn x', type: 'button', 'aria-label': 'Remove line ' + (i + 1), onclick: () => { list.splice(i, 1); K.render(); } }, K.icon('close'))))),
      h('div', { class: 'btns' },
        h('button', { class: 'btn small', type: 'button', onclick: () => { list.push({ q: '', u: 'g', n: '' }); K.render(); const el = document.getElementById(key + '-q' + (list.length - 1)); if (el) el.focus(); } }, K.icon('plus'), 'Ingredient'),
        h('button', { class: 'btn small', type: 'button', onclick: () => { ui.sheet = { type: 'paste', list: list, text: '' }; K.render(); } }, K.icon('list'), 'Paste a list')));
  }
  K.SHEETS.paste = function (S) {
    return K.sheet('Paste ingredients', [
      h('p', { class: 'hint' }, 'One ingredient per line, like "50 g onion, brunoise" or "лук 50 г". Amounts and units are split out for you.'),
      h('textarea', { class: 'input', id: 'pastelist', rows: '9', value: S.text, placeholder: '200 g celeriac\n30 g olive oil\n6 g salt', oninput: (e) => { S.text = e.target.value; } }),
      h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => {
        const rows = S.text.split('\n').map(parseLine).filter(Boolean);
        if (!rows.length) { K.toast('Paste at least one line first.'); return; }
        for (let i = S.list.length - 1; i >= 0; i--) if (!(S.list[i].n || '').trim() && !(S.list[i].q || '').trim()) S.list.splice(i, 1);
        rows.forEach((r) => S.list.push(r));
        ui.sheet = null; K.render(); refreshAllergens();
        K.toast(rows.length + (rows.length === 1 ? ' line added' : ' lines added') + '. Check the amounts.');
      } }, 'Add to the recipe')),
    ]);
  };

  function stationSelect(val, emptyLabel, onchange) {
    return K.select([['', emptyLabel]].concat(K.STATIONS), val || '', onchange);
  }
  function compEditor(e, c, i) {
    const n = e.components.length;
    const box = h('div', { class: 'cedit' + (c.open ? ' open' : '') },
      h('div', { class: 'cedit-head' },
        h('button', { class: 'cedit-toggle', type: 'button', 'aria-expanded': c.open ? 'true' : 'false', onclick: () => { c.open = !c.open; K.render(); } },
          h('span', { class: 'part-n mono' }, String(i + 1)), h('span', { class: 'cedit-name' }, c.name || 'New component'), K.icon(c.open ? 'up' : 'down')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: () => { e.components.splice(i - 1, 0, e.components.splice(i, 1)[0]); K.render(); } }, K.icon('up')),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Move down', disabled: i === n - 1, onclick: () => { e.components.splice(i + 1, 0, e.components.splice(i, 1)[0]); K.render(); } }, K.icon('down'))));
    if (c.open) box.append(h('div', { class: 'cedit-body' },
      K.field('Component name', h('input', { class: 'input', id: 'cn' + i, value: c.name, placeholder: 'e.g. Fennel foam', oninput: (ev) => { c.name = ev.target.value; } })),
      h('div', { class: 'two' },
        K.field('Station', stationSelect(c.station, 'Same as the dish', (v) => { c.station = v; }), null, 'cs' + i),
        h('div', { class: 'two tight' },
          K.field('Yield', h('input', { class: 'input mono', id: 'cy' + i, inputmode: 'decimal', placeholder: '500', value: c.yieldQty, oninput: (ev) => { c.yieldQty = ev.target.value; } })),
          K.field('Unit', h('input', { class: 'input', id: 'cu' + i, list: 'unitl', placeholder: 'g', value: c.yieldUnit, oninput: (ev) => { c.yieldUnit = ev.target.value; } })))),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Ingredients'), ingEditor(c.ingredients, 'c' + i)),
      K.field('Method', h('textarea', { class: 'input', id: 'cm' + i, rows: '6', value: c.stepsText, oninput: (ev) => { c.stepsText = ev.target.value; } }), 'One step per line. Times like "20 минути" become tap-to-start timers.'),
      K.field('Notes', h('textarea', { class: 'input', id: 'cno' + i, rows: '2', value: c.notes, oninput: (ev) => { c.notes = ev.target.value; } }), 'Storage, holding, shelf life.'),
      h('button', { class: 'btn danger small', type: 'button', onclick: () => { if (!c.confirmDel) { c.confirmDel = true; K.render(); return; } e.components.splice(i, 1); K.render(); } }, c.confirmDel ? 'Tap again to remove' : 'Remove component')));
    return box;
  }

  function editFound(e) { return K.detectAllergens([e.ingredients].concat(e.type === 'dish' ? e.components.map((c) => c.ingredients) : [])); }
  function refreshAllergens() { const f = document.getElementById('alfield'); if (f && ui.edit) f.replaceWith(allergenField(ui.edit)); }
  function allergenField(e) {
    const found = editFound(e);
    return h('div', { class: 'field', id: 'alfield' },
      h('span', { class: 'legend' }, 'Allergens'),
      h('p', { class: 'hint' }, 'Locked ticks were found in the ingredient names. Tick any others yourself.'),
      h('div', { class: 'checks' }, K.ALLERGENS.map((a) => {
        const auto = !!found[a[0]];
        return h('label', { class: 'check' + (auto ? ' auto' : ''), title: auto ? 'Found in: ' + found[a[0]].join(', ') : null },
          h('input', { type: 'checkbox', checked: auto || e.allergens.includes(a[0]), disabled: auto, onchange: (ev) => {
            const i = e.allergens.indexOf(a[0]);
            if (ev.target.checked && i < 0) e.allergens.push(a[0]);
            if (!ev.target.checked && i >= 0) e.allergens.splice(i, 1);
          } }),
          h('span', null, a[1], auto ? h('small', null, found[a[0]].join(', ')) : null));
      })),
      h('label', { class: 'check wide' }, h('input', { type: 'checkbox', checked: e.allergensChecked, onchange: (ev) => { e.allergensChecked = ev.target.checked; } }),
        h('span', null, 'I have double-checked the allergens', h('small', null, 'Until this is ticked the team sees "not yet checked".'))));
  }

  /* ---------- scanning a recipe sheet ---------- */
  K.scanNew = function (cat) {
    K.startEdit(null, cat, 'recipe');
    if (K.sample && K.sampleImages) chooseScan();
  };
  function chooseScan() {
    K.pickFile('image/*', true, (files) => runScan(files.slice(0, K.sampleImages || 1)));
  }
  function runScan(files, text) {
    const ctl = new AbortController();
    ui.scan = { state: 'reading', ctl: ctl, fromText: !!text };
    K.render();
    const src = text ? 'the pasted text below' : files.length > 1 ? 'these photos (pages of one recipe, in order)' : 'this photo';
    const prompt = [
      'You are transcribing a professional kitchen recipe from ' + src + ' for restaurant Komat.',
      'Return ONLY a JSON object with exactly these keys:',
      '{"name":string,"category":string,"yieldQty":string,"yieldUnit":string,"ingredients":[{"q":string,"u":string,"n":string}],"steps":[string],"components":[{"name":string,"yieldQty":string,"yieldUnit":string,"ingredients":[{"q":string,"u":string,"n":string}],"steps":[string],"notes":string}],"plating":string,"notes":string,"allergens":[string]}',
      'Rules:',
      '- If the sheet is a dish made of several sub-recipes (e.g. "roasted fennel", "fennel foam"), put each sub-recipe in "components" with its own ingredients, method and yield, in sheet order. Top-level "ingredients"/"steps" then hold only the final assembly (often empty). A single simple recipe has "components": [].',
      '- Copy quantities exactly as written. All weights are clean, prepped product weights: never convert, round or adjust them.',
      '- "u" is the unit as written (g, kg, ml, L, pcs...). If a number has no unit on a gram-based sheet, use "g". If a quantity is unreadable put "?" in "q".',
      '- "n" is the ingredient name, including any prep written next to it (e.g. "onion, brunoise").',
      '- Keep the language of the sheet. Do not translate. Do not invent ingredients, steps or amounts that are not on the sheet.',
      '- Split the method into separate steps in order. If there is no method, return [].',
      '- yieldQty/yieldUnit: the stated yield (e.g. "1200" and "g", or "10" and "portions"). Empty strings if not stated.',
      '- category: pick the closest of ' + JSON.stringify(K.folders()) + ' or "" if unclear.',
      '- plating: plating or service instructions on the sheet, else "". notes: storage, shelf life or other remarks, else "".',
      '- allergens: keys from ' + JSON.stringify(K.ALLERGENS.map((a) => a[0])) + ' clearly present in the listed ingredients. The chef will confirm them.',
    ].join('\n') + (text ? '\n\nRECIPE TEXT:\n' + text : '');
    const opts = { signal: ctl.signal, modelTier: 'default', cache: false };
    if (!text) opts.images = files;
    K.sample.json(prompt, opts).then((d) => {
      if (!d || typeof d !== 'object') throw { code: 'bad' };
      const e = ui.edit;
      if (!e) return;
      const ings = (l) => (Array.isArray(l) ? l.map((i) => ({ q: String(i.q == null ? '' : i.q), u: String(i.u || ''), n: String(i.n || '') })) : []);
      if (d.name) e.name = String(d.name);
      if (d.category) e.category = String(d.category);
      if (d.yieldQty != null && String(d.yieldQty).trim()) e.yieldQty = String(d.yieldQty).trim();
      if (d.yieldUnit) e.yieldUnit = String(d.yieldUnit);
      if (Array.isArray(d.ingredients) && d.ingredients.length) e.ingredients = ings(d.ingredients);
      if (Array.isArray(d.steps) && d.steps.length) e.stepsText = d.steps.map(String).join('\n');
      if (Array.isArray(d.components) && d.components.length) {
        e.components = d.components.map((c) => editComp({ name: String((c && c.name) || ''), yieldQty: String(c && c.yieldQty != null ? c.yieldQty : ''), yieldUnit: String((c && c.yieldUnit) || ''),
          ingredients: ings(c && c.ingredients), steps: Array.isArray(c && c.steps) ? c.steps.map(String) : [], notes: String((c && c.notes) || '') }));
        e.components.forEach((c) => { c.open = false; });
        e.type = 'dish';
        if (!(Array.isArray(d.ingredients) && d.ingredients.length)) e.ingredients = [];
      }
      if (d.plating) e.plating = String(d.plating);
      if (d.notes) e.notes = String(d.notes);
      if (Array.isArray(d.allergens)) e.allergens = d.allergens.filter((k) => K.AL[k]);
      e.allergensChecked = false;
      ui.scan = { state: 'done', fromText: !!text };
      K.render(true);
    }).catch((err) => {
      const c = err && err.code;
      if (c === 'cancelled') { ui.scan = null; K.render(); return; }
      let m = text ? 'Could not make sense of that text. Check it is the whole recipe and try again.' : 'Could not read that photo. Try a sharper, flat, well-lit shot of the sheet.';
      if (c === 'images_unavailable') { m = 'Photos cannot be sent from this view. Paste the recipe as text below instead.'; K.sampleImages = 0; }
      else if (c === 'image_rejected') m = 'That photo could not be used. Try a JPG or PNG under 20 MB.';
      else if (c === 'rate_limited') m = 'Too many scans in a short time. Wait a minute and try again.';
      else if (c === 'not_granted') m = 'Reading was not allowed. Reload the page and tap Allow when Claude asks.';
      else if (c === 'sampling_disabled') m = 'Reading recipes with Claude is turned off for this account.';
      else if (c === 'session_expired') m = 'You were signed out. Sign in to Claude again and retry.';
      ui.scan = { state: 'error', msg: m, paste: true };
      K.render();
    });
  }
  function scanBox() {
    const s = ui.scan;
    const paste = () => h('div', { class: 'stack' },
      h('textarea', { class: 'input', id: 'pastetext', rows: '6', placeholder: 'Paste the recipe here: ingredients with grams, method, yield…', value: ui.pasteText || '', oninput: (ev) => { ui.pasteText = ev.target.value; } }),
      h('div', { class: 'btns' }, h('button', { class: 'btn light', type: 'button', onclick: () => { const t = (ui.pasteText || '').trim(); if (t.length < 10) { K.toast('Paste the recipe text first.'); return; } runScan(null, t); } }, 'Fill in from the text')),
      h('p', { class: 'hint' }, 'On a phone, open the photo, use Copy text (Google Lens or Live Text), then paste it here.'));
    const box = h('section', { class: 'scanbox' });
    if (s && s.state === 'reading') {
      box.append(h('p', { class: 'status', 'aria-live': 'polite' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), s.fromText ? 'Sorting out the recipe…' : 'Reading the recipe sheet…'),
        h('p', { class: 'hint' }, 'This takes 10 to 40 seconds.'), h('button', { class: 'btn ghost-light small', type: 'button', onclick: () => s.ctl.abort() }, 'Stop'));
    } else if (s && s.state === 'done') {
      box.append(h('p', { class: 'status' }, K.icon('check'), 'Filled in' + (s.fromText ? ' from the text' : ' from the photo') + '. Check every amount before saving.'),
        h('div', { class: 'btns' }, K.sampleImages ? h('button', { class: 'btn ghost-light small', type: 'button', onclick: chooseScan }, 'Scan again') : null,
          h('button', { class: 'btn ghost-light small', type: 'button', onclick: () => { ui.showPaste = true; ui.scan = null; K.render(); } }, 'Paste text instead')));
    } else {
      box.append(h('p', { class: 'status' }, K.icon('sparkle'), s && s.state === 'error' ? s.msg : 'Have it on paper?'),
        h('p', { class: 'hint' }, K.sampleImages ? 'Take a photo of the recipe sheet (up to ' + K.sampleImages + ' pages) and Claude fills in the fields below for you to check. Or paste the recipe as text.' : 'Paste the recipe as text and Claude fills in the fields below for you to check.'),
        h('div', { class: 'btns' },
          K.sampleImages ? h('button', { class: 'btn light', type: 'button', onclick: chooseScan }, K.icon('camera'), 'Scan a photo') : null,
          h('button', { class: 'btn ghost-light', type: 'button', onclick: () => { ui.showPaste = !ui.showPaste; K.render(); } }, 'Paste recipe text')),
        ui.showPaste || (s && s.paste) ? paste() : null);
    }
    return box;
  }

  /* ---------- the editor page ---------- */
  K.V.edit = function () {
    const e = ui.edit, isDish = e.type === 'dish', noun = isDish ? 'dish' : 'recipe';
    const top = K.subbar('Cancel', cancel, [
      ui.uploading ? h('span', { class: 'upl' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), ui.uploading) : null,
      h('button', { class: 'btn small primary', type: 'button', onclick: save, disabled: ui.busy || !!ui.uploading || (ui.scan && ui.scan.state === 'reading') }, ui.busy ? 'Saving…' : 'Save ' + noun),
    ], (ui.isNew ? 'New ' : 'Edit ') + noun);
    const w = h('div', { class: 'wrap page form' });
    if (ui.confirmLeave) w.append(h('div', { class: 'banner warn', role: 'alert' }, h('b', null, 'Leave without saving?'),
      h('span', null, 'Your changes to this ' + noun + ' will be lost.'),
      h('div', { class: 'btns' }, h('button', { class: 'btn danger small', type: 'button', onclick: leave }, 'Discard changes'), h('button', { class: 'btn small', type: 'button', onclick: () => { ui.confirmLeave = false; K.render(); } }, 'Keep editing'))));
    w.append(h('h1', { class: 'rtitle' }, (ui.isNew ? 'New ' : 'Edit ') + noun));
    w.append(h('div', { class: 'field' },
      K.seg([['dish', 'Dish'], ['recipe', 'Recipe']], e.type, (v) => { e.type = v; if (v === 'dish' && !e.components.length) e.components.push(editComp({})); K.render(); }, { 'aria-label': 'Type' }),
      h('p', { class: 'hint' }, isDish ? 'A dish on the menu, built from several recipes (parts), with plating for service.' : 'A single prep: a sauce, a garnish, a butchery spec. Used on its own or inside a dish.'),
      !isDish && e.components.some((c) => (c.name || '').trim() || c.ingredients.some((x) => (x.n || '').trim())) ? h('p', { class: 'banner warn' }, 'This has parts. Saving it as a recipe removes them. Switch back to Dish to keep them.') : null));
    if (ui.msg) w.append(h('div', { class: 'banner bad', role: 'alert' }, ui.msg));
    if (K.me.admin && K.sample) w.append(scanBox());
    w.append(K.field(isDish ? 'Dish name' : 'Recipe name', h('input', { class: 'input big', id: 'ename', value: e.name, oninput: (ev) => { e.name = ev.target.value; } })));
    w.append(h('div', { class: 'two' },
      K.field('Folder', h('input', { class: 'input', id: 'ecat', list: 'catl', value: e.category, placeholder: 'e.g. Sauces & stocks', oninput: (ev) => { e.category = ev.target.value; } })),
      K.field(isDish ? 'Station (default for parts)' : 'Station', stationSelect(e.station, 'No station', (v) => { e.station = v; }), null, 'est')),
      h('datalist', { id: 'catl' }, K.folders().map((c) => h('option', { value: c }))),
      h('datalist', { id: 'unitl' }, K.UNITS.map((u) => h('option', { value: u }))));
    w.append(h('div', { class: 'two' },
      K.field('Yield', h('input', { class: 'input mono', id: 'eyq', inputmode: 'decimal', placeholder: 'e.g. 1200', value: e.yieldQty, oninput: (ev) => { e.yieldQty = ev.target.value; } })),
      K.field('Yield unit', h('input', { class: 'input', id: 'eyu', list: 'unitl', placeholder: 'g, portions…', value: e.yieldUnit, oninput: (ev) => { e.yieldUnit = ev.target.value; } }))));
    if (!Array.isArray(e.services)) e.services = [];
    w.append(h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Menu'),
      h('div', { class: 'checks' }, K.SERVICES.map((sv) => h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: e.services.includes(sv[0]), onchange: (ev) => { const i = e.services.indexOf(sv[0]); if (ev.target.checked && i < 0) e.services.push(sv[0]); if (!ev.target.checked && i >= 0) e.services.splice(i, 1); } }),
        h('span', null, sv[1], h('small', null, K.SV_HINT[sv[0]]))))),
      h('label', { class: 'check wide' }, h('input', { type: 'checkbox', checked: e.onMenu !== false, onchange: (ev) => { e.onMenu = ev.target.checked; } }),
        h('span', null, 'On the current menu', h('small', null, 'Untick when it comes off the menu. It stays in the book but leaves the daily order lists.'))),
      h('p', { class: 'hint' }, 'Nothing ticked counts as À la carte.')));

    /* photo */
    w.append(h('div', { class: 'field' }, h('span', { class: 'legend' }, isDish ? 'Dish photo' : 'Photo'),
      h('div', { class: 'media-edit' },
        e.photo ? h('img', { src: K.media(e.photo), alt: 'Current photo' }) : null,
        h('div', { class: 'btns' },
          h('button', { class: 'btn', type: 'button', disabled: !K.assets || !!ui.uploading, onclick: () => K.pickFile('image/*', false, (f) => {
            ui.uploading = 'Uploading photo…'; K.render();
            K.shrinkImage(f[0], 1600).then((b) => K.assets.upload(b)).then((r) => {
              const old = e.photo; e.photo = r.id; ui.uploading = '';
              if (old && !assetIds(ui.orig).includes(old)) dropAssets([old]);
              K.render();
            }, (err) => { ui.uploading = ''; K.render(); K.toast(err && err.message === 'read' ? 'That photo could not be read. Try another.' : K.uploadErr(err), { tone: 'bad' }); });
          }) }, K.icon('photo'), e.photo ? 'Replace photo' : 'Add photo'),
          e.photo ? h('button', { class: 'btn', type: 'button', onclick: () => { const old = e.photo; e.photo = ''; if (!assetIds(ui.orig).includes(old)) dropAssets([old]); K.render(); } }, 'Remove') : null),
        !K.assets ? h('p', { class: 'hint' }, 'Only editors can add photos.') : null)));

    if (isDish) w.append(h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Parts'),
      h('p', { class: 'hint' }, 'Each part of the dish (fennel foam, roasted fennel…) gets its own yield, ingredients and method.'),
      e.components.map((c, i) => compEditor(e, c, i)),
      h('button', { class: 'btn', type: 'button', onclick: () => { e.components.forEach((x) => { x.open = false; }); e.components.push(editComp({})); K.render(); const el = document.getElementById('cn' + (e.components.length - 1)); if (el) el.focus(); } }, K.icon('plus'), 'Add a part')));

    w.append(h('div', { class: 'field' }, h('span', { class: 'legend' }, isDish ? 'Assembly ingredients' : 'Ingredients'),
      h('p', { class: 'hint' }, isDish ? 'Only what is added when putting the dish together. Leave empty if the parts cover everything.' : 'Clean, prepped weights. Amounts scale with the yield.'),
      ingEditor(e.ingredients, 'm')));
    w.append(K.field(isDish ? 'Assembly method' : 'Method', h('textarea', { class: 'input', id: 'esteps', rows: isDish ? '4' : '8', value: e.stepsText, oninput: (ev) => { e.stepsText = ev.target.value; } }), 'One step per line. Times like "20 минути" become tap-to-start timers.'));

    if (isDish || e.videos.length || (e.plating || '').trim()) {
      w.append(h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Plating videos'),
        h('p', { class: 'hint' }, 'Short clips work best: under 20 MB, about a minute at 720p.'),
        e.videos.map((v, i) => h('div', { class: 'vrow' },
          h('video', { src: K.media(v.id), controls: true, playsinline: true, preload: 'metadata' }),
          h('input', { class: 'input', id: 'vt' + i, placeholder: 'Caption, e.g. Pass plating, 2 covers', 'aria-label': 'Video caption ' + (i + 1), value: v.title || '', oninput: (ev) => { v.title = ev.target.value; } }),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove video ' + (i + 1), onclick: () => { e.videos.splice(i, 1); if (!assetIds(ui.orig).includes(v.id)) dropAssets([v.id]); K.render(); } }, K.icon('trash')))),
        h('button', { class: 'btn', type: 'button', disabled: !K.assets || !!ui.uploading, onclick: () => K.pickFile('video/mp4,video/webm,video/*', false, (f) => {
          const file = f[0];
          if (file.size > 20 * 1024 * 1024) { K.toast(K.uploadErr({ code: 'too_large' }), { tone: 'bad' }); return; }
          ui.uploading = 'Uploading video…'; K.render();
          K.assets.upload(file, { type: file.type === 'video/webm' ? 'video/webm' : 'video/mp4' }).then((r) => { ui.uploading = ''; e.videos.push({ id: r.id, title: '' }); K.render(); },
            (err) => { ui.uploading = ''; K.render(); K.toast(K.uploadErr(err), { tone: 'bad' }); });
        }) }, K.icon('video'), 'Add a plating video')));
      w.append(K.field('Plating notes', h('textarea', { class: 'input', id: 'eplating', rows: '4', value: e.plating, oninput: (ev) => { e.plating = ev.target.value; } }), 'What goes where on the plate, garnish, sauce amount, plate type.'));
    }
    w.append(allergenField(e));
    w.append(K.field('Notes', h('textarea', { class: 'input', id: 'enotes', rows: '4', value: e.notes, oninput: (ev) => { e.notes = ev.target.value; } }), 'Storage, shelf life, holding temperature.'));
    w.append(h('div', { class: 'btns end' }, h('button', { class: 'btn primary', type: 'button', onclick: save, disabled: ui.busy || !!ui.uploading }, ui.busy ? 'Saving…' : 'Save ' + noun)));
    if (!ui.isNew) w.append(h('div', { class: 'danger-zone' }, h('button', { class: 'btn danger', type: 'button', disabled: ui.busy, onclick: del }, K.icon('trash'), ui.confirmDel ? 'Tap again to delete for good' : 'Delete ' + noun)));
    return { top: top, body: w, tabs: false };
  };

  function del() {
    if (!ui.confirmDel) { ui.confirmDel = true; K.render(); return; }
    const e = ui.edit, gone = ui.orig || e;
    ui.busy = true; K.render();
    K.db.doc('recipes/' + e.id).delete().then(() => {
      dropAssets(Array.from(new Set(assetIds(ui.orig).concat(assetIds(e)))));
      K.upsertRecipe({ id: e.id });
      ui.busy = false; ui.edit = null;
      K.go('recipes');
      K.toast('Deleted');
      syncAfterDelete(gone);
    }, (err) => { ui.busy = false; ui.msg = err && err.code === 'invalid_argument' ? 'Only the head chef can delete recipes.' : 'Could not delete. Check your connection and try again.'; K.render(true); });
  }
  function save() {
    const e = ui.edit, name = (e.name || '').trim();
    const fail = (m) => { ui.msg = m; K.render(true); };
    if (!name) return fail('Give it a name.');
    const yq = (e.yieldQty || '').trim(), yu = (e.yieldUnit || '').trim();
    if (yq && !(K.parseQty(yq) > 0)) return fail('Yield must be a number above zero, like 1200 or 1.5.');
    if (yq && !yu) return fail('Add a yield unit, like g or portions.');
    const clean = (l) => l.filter((i) => (i.n || '').trim()).map((i) => ({ q: (i.q || '').trim(), u: (i.u || '').trim(), n: i.n.trim() }));
    const comps = [];
    for (let ci = 0; e.type === 'dish' && ci < e.components.length; ci++) {
      const c = e.components[ci], cq = (c.yieldQty || '').trim(), cn = (c.name || '').trim();
      const ings = clean(c.ingredients), steps = (c.stepsText || '').split('\n').map((x) => x.trim()).filter(Boolean);
      if (!cn && !ings.length && !steps.length) continue;
      if (!cn) { c.open = true; return fail('Give part ' + (ci + 1) + ' a name.'); }
      if (cq && !(K.parseQty(cq) > 0)) { c.open = true; return fail('The yield of “' + cn + '” must be a number above zero.'); }
      comps.push({ cid: c.cid || 'c' + K.uid(), name: cn, station: c.station || '', yieldQty: cq ? String(K.parseQty(cq)) : '', yieldUnit: cq ? (c.yieldUnit || '').trim() || 'g' : '', ingredients: ings, steps: steps, notes: (c.notes || '').trim() });
    }
    const rec = {
      name: name, category: (e.category || '').trim(), yieldQty: yq ? String(K.parseQty(yq)) : '', yieldUnit: yq ? yu : '',
      photo: e.photo || '', videos: e.videos.map((v) => ({ id: v.id, title: (v.title || '').trim() })),
      ingredients: clean(e.ingredients), steps: (e.stepsText || '').split('\n').map((s) => s.trim()).filter(Boolean),
      plating: (e.plating || '').trim(), notes: (e.notes || '').trim(), allergens: e.allergens.slice(), allergensChecked: !!e.allergensChecked,
      components: comps, type: e.type === 'dish' ? 'dish' : 'recipe', station: e.station || '', services: (e.services || []).filter((x) => K.SV[x]), onMenu: e.onMenu !== false, updated: Date.now(),
    };
    const autoK = Object.keys(K.detectAllergens(K.allIngLists(rec)));
    rec.allergens = rec.allergens.filter((k) => K.AL[k] && !autoK.includes(k));
    ui.busy = true; ui.msg = ''; K.render();
    K.db.doc('recipes/' + e.id).set(rec).then(() => {
      const keep = assetIds(rec);
      dropAssets(assetIds(ui.orig).filter((id) => !keep.includes(id)));
      const orig = ui.orig, full = K.norm(Object.assign({ id: e.id }, rec));
      K.upsertRecipe(full);
      ui.busy = false; ui.edit = null; ui.scan = null;
      K.go('recipe', { id: e.id });
      K.toast('Saved');
      syncAfterSave(full, orig ? K.norm(orig) : null);
    }, (err) => {
      ui.busy = false;
      fail(err && err.code === 'invalid_argument' ? 'Only the head chef can save recipes.' : err && err.code === 'quota_exceeded' ? 'The book is full. Delete old recipes first.' : 'Could not save. Check your connection and try again.');
    });
  }

  /* ---------- keep mise en place lists in step with recipe changes ---------- */
  function compMap(oldC, newC) {
    const used = {}, m = {};
    oldC.forEach((c, i) => { if (!c.cid) return; const j = newC.findIndex((n, k) => !used[k] && n.cid === c.cid); if (j >= 0) { used[j] = 1; m[i] = j; } });
    oldC.forEach((c, i) => { if (m[i] !== undefined) return; const j = newC.findIndex((n, k) => !used[k] && K.normName(n.name) === K.normName(c.name)); if (j >= 0) { used[j] = 1; m[i] = j; } });
    oldC.forEach((c, i) => { if (m[i] === undefined && c.cid) m[i] = -1; });
    oldC.forEach((c, i) => { if (m[i] !== undefined) return; if (newC[i] && !used[i]) { used[i] = 1; m[i] = i; } else m[i] = -1; });
    return m;
  }
  function eachListItem(doc, fn) {
    K.STATIONS.forEach((s) => ((doc.stations && doc.stations[s[0]] && doc.stations[s[0]].sections) || []).forEach((sec) => sec.groups.forEach((g) => g.items.forEach((it) => fn(it, g, s[0])))));
  }
  function syncAfterSave(rec, orig) {
    if (!K.me.admin) return;
    const n = K.clone(D.checklists || { stations: {} });
    n.stations = n.stations || {};
    const m = orig ? compMap(orig.components || [], rec.components) : {}, removed = [], renames = [], linked = {}, oldOf = {};
    let changed = 0;
    Object.keys(m).forEach((i) => { if (m[i] >= 0) oldOf[m[i]] = +i; });
    eachListItem(n, (it, g, st) => {
      if (!it.link) return;
      const p = String(it.link).split('~');
      if (p[0] !== rec.id) return;
      if (p.length < 2) { if (orig && orig.name !== rec.name && K.normName(it.name) === K.normName(orig.name)) renames.push({ id: it.id, from: it.name, to: rec.name, st: st, group: g.name, on: true }); return; }
      const i = +p[1], j = orig ? (m[i] !== undefined ? m[i] : -1) : i;
      if (j < 0 || !rec.components[j]) { removed.push({ id: it.id, name: it.name, group: g.name, st: st, on: true }); return; }
      if (j !== i) { it.link = rec.id + '~' + j; changed++; }
      const oc = orig && orig.components[i];
      if (oc && oc.name !== rec.components[j].name && K.normName(it.name) === K.normName(oc.name)) renames.push({ id: it.id, from: it.name, to: rec.components[j].name, st: st, group: g.name, on: true });
      linked[j] = 1;
    });
    const missing = [];
    if (rec.type === 'dish' && rec.onMenu !== false) rec.components.forEach((c, j) => {
      if (linked[j] || oldOf[j] !== undefined) return;
      missing.push({ j: j, name: c.name, st: K.ST[c.station] ? c.station : K.ST[rec.station] ? rec.station : 'hot', on: true });
    });
    if (changed) K.saveChecklists(n);
    if (removed.length || missing.length || renames.length) { ui.sheet = { type: 'sync', rid: rec.id, name: rec.name, removed: removed, missing: missing, renames: renames, del: false }; K.render(); }
  }
  function syncAfterDelete(rec) {
    if (!K.me.admin || !D.checklists) return;
    const removed = [];
    eachListItem(D.checklists, (it, g, st) => { if (it.link && String(it.link).split('~')[0] === rec.id) removed.push({ id: it.id, name: it.name, group: g.name, st: st, on: true }); });
    if (removed.length) { ui.sheet = { type: 'sync', rid: rec.id, name: rec.name, removed: removed, missing: [], renames: [], del: true }; K.render(); }
  }
  function applySync(S) {
    const r = K.find(S.rid), n = K.clone(D.checklists || { stations: {} });
    n.stations = n.stations || {};
    const kill = {}, ren = {};
    let rn = 0, added = 0;
    S.removed.forEach((x) => { if (x.on) kill[x.id] = 1; });
    S.renames.forEach((x) => { if (x.on) ren[x.id] = x.to; });
    eachListItem(n, (it) => { if (ren[it.id]) { it.name = ren[it.id]; rn++; } });
    K.STATIONS.forEach((s) => ((n.stations[s[0]] && n.stations[s[0]].sections) || []).forEach((sec) => sec.groups.forEach((g) => { g.items = g.items.filter((it) => !kill[it.id]); })));
    S.missing.forEach((x) => {
      if (!x.on || !r) return;
      if (!n.stations[x.st]) n.stations[x.st] = { sections: [] };
      const secs = n.stations[x.st].sections;
      let grp = null;
      secs.forEach((sec) => sec.groups.forEach((g) => { if (!grp && g.items.some((it) => it.link && String(it.link).split('~')[0] === r.id)) grp = g; }));
      if (!grp) secs.forEach((sec) => sec.groups.forEach((g) => { if (!grp && K.normName(g.name) === K.normName(r.name)) grp = g; }));
      if (!grp) { if (!secs.length) secs.push({ title: 'Mise en place', groups: [] }); grp = { key: 'g' + K.uid(), name: r.name, items: [] }; secs[0].groups.push(grp); }
      grp.items.push({ id: 'i' + K.uid(), name: x.name, link: r.id + '~' + x.j });
      added++;
    });
    const k = Object.keys(kill).length;
    const partsTxt = [rn ? rn + ' renamed' : '', added ? added + ' added' : '', k ? k + ' removed' : ''].filter(Boolean);
    ui.sheet = null;
    K.saveChecklists(n, partsTxt.length ? 'Lists updated: ' + partsTxt.join(', ') : '');
  }
  K.SHEETS.sync = function (S) {
    const row = (x, extra) => h('label', { class: 'synrow' }, h('input', { type: 'checkbox', checked: x.on, onchange: (e) => { x.on = e.target.checked; } }),
      h('span', null, extra || x.name, h('small', null, K.ST[x.st] + (x.group ? ' · ' + x.group : ''))));
    return K.sheet('Update mise en place lists', [
      h('p', { class: 'hint' }, S.del ? 'These rows were linked to “' + S.name + '”, which is now deleted.' : 'You changed “' + S.name + '”. Update the station lists to match?'),
      S.renames.length ? h('h3', { class: 'label' }, 'Renamed: rename the row too') : null,
      S.renames.map((x) => row(x, x.from + ' → ' + x.to)),
      S.missing.length ? h('h3', { class: 'label' }, 'New parts: add them to a station list') : null,
      S.missing.map((x) => h('div', { class: 'synrow' }, h('input', { type: 'checkbox', checked: x.on, 'aria-label': 'Add ' + x.name, onchange: (e) => { x.on = e.target.checked; } }),
        h('span', null, x.name, K.select(K.STATIONS, x.st, (v) => { x.st = v; }, { class: 'input small', 'aria-label': 'Station for ' + x.name })))),
      S.removed.length ? h('h3', { class: 'label' }, S.del ? 'Remove these rows' : 'No longer in the dish: remove the row') : null,
      S.removed.map((x) => row(x)),
      h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => applySync(S) }, 'Update lists'),
        h('button', { class: 'btn', type: 'button', onclick: () => { ui.sheet = null; K.render(); } }, 'Leave them as they are')),
    ]);
  };
})();
