/* Kitchen AI: ask in plain words, in Bulgarian or English ("80 covers tomorrow, plan cold",
   "add a wine dinner on Friday for 40", "add this recipe", a photo of the whiteboard).
   Claude reads the book through a few page functions and answers with proposals. Nothing in the
   book changes until the chef taps a proposal: plans, events and recipes open in the app's own
   forms to check and save, tasks and prep rows are added with one tap and can be undone.
   Shown only where the page can ask Claude (the Claude versions of the book); the stand-alone
   site has no Claude yet, so it never shows there. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;

  /* the shared Claude version gets Claude at boot (app.js); the preview asks for it here */
  if (K.BUILD === 'preview' && window.claude && typeof window.claude.use === 'function') {
    window.claude.use('sample').then((s) => {
      if (!s) return;
      K.sample = s;
      return s.limits().then((l) => {
        K.aiCaps = l || {};
        K.sampleImages = l && l.images ? Math.min(4, l.images.maxCount || 1) : 0;
        K.refresh();
      });
    }).catch(() => {});
  }
  const AI = () => ui.ai || (ui.ai = { items: [], turns: [], busy: false, ctl: null, files: [], text: '' });
  K.aiOn = () => !!K.sample && !(ui.ai && ui.ai.off);
  K.aiButton = () => (K.aiOn() ? h('button', { type: 'button', class: 'icon-btn on-dark ai-btn', 'aria-label': 'Kitchen AI', title: 'Kitchen AI', onclick: openAI }, K.icon('sparkle')) : null);
  function openAI() {
    ui.sheet = { type: 'ai' };
    K.render();
    if (!K.aiCaps && K.sample && typeof K.sample.limits === 'function') K.sample.limits().then((l) => { K.aiCaps = l || {}; K.refresh(); }, () => { K.aiCaps = {}; });
    setTimeout(() => { const el = document.getElementById('ai-in'); if (el && matchMedia('(pointer: fine)').matches) el.focus({ preventScroll: true }); }, 80);
  }
  const tier = () => (K.store.get('aiTier', 'default') === 'complex' ? 'complex' : 'default');

  /* ---------- what Claude is told: the rules and the book as it is now ---------- */
  const longDate = (ds) => K.parseYmd(ds).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  function bookText() {
    const out = [];
    out.push('MISE EN PLACE LISTS (row id = name [quantity per 10 covers, when set]):');
    K.STATIONS.forEach((s) => {
      out.push('Station ' + s[0] + ' (' + s[1] + '):');
      K.sections(s[0]).forEach((sec) => sec.groups.forEach((g) => {
        const rows = g.items.map((it) => it.id + '=' + it.name + (it.par && +it.par.q > 0 ? ' [' + it.par.q + ' ' + (it.par.u || '') + ']' : ''));
        out.push('  ' + g.name + ': ' + rows.join('; '));
      }));
    });
    out.push('', 'RECIPES (id: name · kind · yield · parts by number):');
    D.recipesSrc.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((r) => {
      const parts = (r.components || []).map((c, i) => i + ' ' + c.name);
      out.push(r.id + ': ' + r.name + (r.aka ? ' / ' + r.aka : '') + ' · ' + (r.type || 'recipe') + (r.yieldQty ? ' · makes ' + r.yieldQty + ' ' + (r.yieldUnit || '') : '') + (r.station ? ' · ' + r.station : '') + (r.onMenu === false ? ' · off the menu' : '') + (parts.length ? ' · parts: ' + parts.join(', ') : ''));
    });
    const evs = K.upcomingEvents ? K.upcomingEvents().slice(0, 8) : [];
    out.push('', 'COMING EVENTS:', evs.length ? evs.map((e) => e.date + ' ' + (e.time || '') + ' ' + (e.title || 'Event') + (e.guests ? ', ' + e.guests + ' guests' : '')).join('\n') : 'none');
    out.push('', 'RECIPE FOLDERS: ' + K.folders().join(', '), 'EVENT TYPES: Group, Breakfast event, Private dinner, Catering, Other');
    return out.join('\n');
  }
  function rules() {
    const st = K.getStation(), t0 = K.day(0), t1 = K.day(1);
    return [
      'You are Kitchen AI, the assistant inside the kitchen book of restaurant Komat in Sofia. You help the chefs get work done in the book.',
      'How you work:',
      '- You never change the book yourself. To change anything, call a propose_ tool: it puts a proposal on the chef\'s screen and the chef checks it and saves it. After proposing, say in one short sentence what you proposed and that it is waiting for them; never say it is done or saved.',
      '- Use only the book below and what the chef tells you. Never invent amounts, recipes, list rows or dates. If something you need is missing or unclear (which station, which day, how many covers), ask one short question instead of guessing.',
      '- Amounts: scale recipes with scale_recipe and plan from covers with propose_plan; the app does the sums. Read a recipe with get_recipe before you quote its amounts.',
      '- "Tomorrow\'s prep" means tomorrow\'s mise en place list: mark rows that are on the list with propose_prep (with an amount when the chef gives one); anything that is not a row on the list becomes a task with propose_tasks.',
      '- A new recipe: propose_recipe with the ingredients and steps exactly as the chef gave them, in their language. Leave an amount empty rather than invent it.',
      '- A photo: a recipe sheet becomes propose_recipe (copy it exactly, unreadable amount = "?"); a whiteboard or handwritten prep list becomes propose_prep / propose_tasks line by line, matching rows on the station lists by name; a booking or event note becomes propose_event.',
      '- Reply in the language the chef writes in (Bulgarian or English), in 1-3 short sentences, in plain kitchen words.',
      '',
      'Today is ' + longDate(t0) + ' (' + t0 + '). Tomorrow is ' + longDate(t1) + ' (' + t1 + '). The chef has the ' + K.ST[st] + ' station (' + st + ') open.',
      'Stations: hot = Hot, cold = Cold & pastry, pass = Pass.',
      '',
      bookText(),
    ].join('\n');
  }

  /* ---------- the page functions Claude may call ---------- */
  const station = (v) => { const s = String(v || '').toLowerCase().trim(); if (!K.ST[s]) throw new Error('station must be one of hot, cold, pass'); return s; };
  const dayOf = (st, v) => (String(v || 'tomorrow').toLowerCase() === 'today' ? K.sday(st) : K.sday(st, 1));
  const num = (v) => { const n = K.parseQty(v); return n > 0 ? n : 0; };
  const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 400);
  function recipeOf(id) { const r = K.findSrc(String(id || '')); if (!r) throw new Error('no recipe with id ' + id + '; use an id from the RECIPES list'); return r; }
  function partOf(r, part) {
    const i = part == null || part === '' ? -1 : Math.round(Number(part));
    if (i >= 0) { const c = r.components[i]; if (!c) throw new Error(r.name + ' has no part ' + i); return { ci: i, name: c.name, yq: c.yieldQty, yu: c.yieldUnit, ingredients: c.ingredients, steps: c.steps }; }
    return { ci: -1, name: r.name, yq: r.yieldQty, yu: r.yieldUnit, ingredients: r.ingredients, steps: r.steps };
  }
  const ingsText = (l, f) => (l || []).map((g) => ((g.q ? K.fmtQty(g.q, g.u, f || 1) + ' ' : '') + (g.n || '')).trim());

  function tools(item) {
    const card = (c) => { item.cards.push(c); K.refresh(); return c; };
    const status = (s) => { item.status = s; paint(item); };
    return [
      { name: 'get_recipe', description: 'Read one recipe from the book: yield, ingredients with amounts, method, and its parts if it is a dish. Returns the recipe as stored, in its own language.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Recipe id from the RECIPES list' } }, required: ['id'] },
        execute: (a) => {
          const r = recipeOf(a.id);
          status('Reading ' + r.name + '…');
          const one = (p) => ({ yield: ((p.yieldQty || '') + ' ' + (p.yieldUnit || '')).trim(), ingredients: ingsText(p.ingredients), steps: (p.steps || []).slice(0, 15).map((s) => String(s).slice(0, 240)) });
          return Object.assign({ id: r.id, name: r.name, kind: r.type, station: r.station || '' }, one(r), { parts: (r.components || []).map((c, i) => Object.assign({ part: i, name: c.name }, one(c))) });
        } },
      { name: 'scale_recipe', description: 'Scale a recipe (or one part of a dish) by a factor, or to a target amount in the same kind of unit as its yield. The app does the maths and returns the scaled ingredient list; the chef also gets a button to open the recipe scaled.',
        inputSchema: { type: 'object', properties: { id: { type: 'string' }, part: { type: 'integer', description: 'Part number for one part of a dish; leave out for the whole recipe' }, factor: { type: 'number' }, target_qty: { type: 'number' }, target_unit: { type: 'string', description: 'g, kg, ml, L, portions or pcs' } }, required: ['id'] },
        execute: (a) => {
          const r = recipeOf(a.id), p = partOf(r, a.part);
          const f = num(a.factor) || (num(a.target_qty) ? K.planFactor(num(a.target_qty), str(a.target_unit, 20), p.yq, p.yu) : 0);
          if (!f) throw new Error('give a factor, or a target amount in the same kind of unit as the yield (' + ((p.yq || '?') + ' ' + (p.yu || '')).trim() + ')');
          status('Scaling ' + p.name + ' ×' + K.fmtNum(f) + '…');
          card({ type: 'open', id: r.id, ci: p.ci, f: f, name: p.name });
          return { name: p.name, factor: K.fmtNum(f), makes: p.yq ? K.fmtQty(p.yq, p.yu, f) : 'yield not written', ingredients: ingsText(p.ingredients, f) };
        } },
      { name: 'propose_plan', description: 'Propose planning a station\'s prep list from a number of covers. The app works out each row\'s amount from its quantity per 10 covers; the chef checks the amounts and what is already in the walk-in before anything is marked.',
        inputSchema: { type: 'object', properties: { station: { type: 'string', enum: ['hot', 'cold', 'pass'] }, covers: { type: 'integer' }, day: { type: 'string', enum: ['today', 'tomorrow'] } }, required: ['station', 'covers'] },
        execute: (a) => {
          const st = station(a.station), cov = Math.round(num(a.covers));
          if (!cov) throw new Error('covers must be a number above 0');
          const date = dayOf(st, a.day), n = K.parRows(st, date).length;
          card({ type: 'plan', st: st, date: date, covers: cov, rows: n });
          return 'Shown to the chef: plan ' + K.ST[st] + ' for ' + cov + ' covers on ' + date + '.' + (n ? '' : ' No row on that list has a quantity per 10 covers yet, so the chef has to set quantities first: tell them.');
        } },
      { name: 'propose_prep', description: 'Propose marking rows of a station\'s mise en place list DO (to make), with an amount when the chef gave one. Only rows that are on the list, by row id.',
        inputSchema: { type: 'object', properties: { station: { type: 'string', enum: ['hot', 'cold', 'pass'] }, day: { type: 'string', enum: ['today', 'tomorrow'] },
          rows: { type: 'array', items: { type: 'object', properties: { row_id: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string' } }, required: ['row_id'] } } }, required: ['station', 'rows'] },
        execute: (a) => {
          const st = station(a.station), date = dayOf(st, a.day), all = K.checkItems(st, date), rows = [];
          (Array.isArray(a.rows) ? a.rows : []).slice(0, 40).forEach((x) => {
            const it = all.find((i) => i.id === String(x && x.row_id));
            if (!it) throw new Error('no row ' + (x && x.row_id) + ' on the ' + st + ' list; use propose_tasks for things that are not on the list');
            rows.push({ it: it, q: num(x.qty), u: str(x.unit, 20) });
          });
          if (!rows.length) throw new Error('no rows given');
          card({ type: 'prep', st: st, date: date, rows: rows });
          return 'Shown to the chef: mark ' + rows.length + ' row(s) DO on ' + K.ST[st] + ' for ' + date + '.';
        } },
      { name: 'propose_tasks', description: 'Propose to-do tasks for stations, for today or for tomorrow (tomorrow\'s land on that day\'s to-do). Use for anything that is not a row on the mise en place lists.',
        inputSchema: { type: 'object', properties: { tasks: { type: 'array', items: { type: 'object', properties: { station: { type: 'string', enum: ['hot', 'cold', 'pass'] }, text: { type: 'string' }, day: { type: 'string', enum: ['today', 'tomorrow'] }, urgent: { type: 'boolean' } }, required: ['station', 'text'] } } }, required: ['tasks'] },
        execute: (a) => {
          const list = (Array.isArray(a.tasks) ? a.tasks : []).slice(0, 30).map((t) => ({ st: station(t && t.station), text: str(t && t.text, 160), day: String((t && t.day) || 'today').toLowerCase() === 'tomorrow' ? 'tomorrow' : 'today', urgent: !!(t && t.urgent) })).filter((t) => t.text);
          if (!list.length) throw new Error('no tasks given');
          card({ type: 'tasks', list: list });
          return 'Shown to the chef: ' + list.length + ' task(s) to add.';
        } },
      { name: 'propose_event', description: 'Propose a new event (a group, a private dinner, catering). It opens in the event form for the chef to check and save. Link dishes to recipes by id when they are in the book.',
        inputSchema: { type: 'object', properties: { title: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string', description: 'e.g. 19:30 dinner' }, kind: { type: 'string' }, guests: { type: 'integer' }, menu: { type: 'string' }, notes: { type: 'string' },
          dishes: { type: 'array', items: { type: 'object', properties: { recipe_id: { type: 'string' }, name: { type: 'string' }, portions: { type: 'integer' } } } } }, required: ['title', 'date'] },
        execute: (a) => {
          const date = str(a.date, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');
          const kinds = ['Group', 'Breakfast event', 'Private dinner', 'Catering', 'Other'], kind = kinds.find((k) => k.toLowerCase() === str(a.kind, 40).toLowerCase()) || (a.kind ? 'Other' : 'Group');
          const dishes = (Array.isArray(a.dishes) ? a.dishes : []).slice(0, 20).map((d) => { const r = d && d.recipe_id ? K.findSrc(String(d.recipe_id)) : null; return { name: r ? r.name : str(d && d.name, 80), link: r ? r.id : '', qty: d && +d.portions > 0 ? String(Math.round(+d.portions)) : '' }; }).filter((d) => d.name);
          const e = { id: '', date: date, time: str(a.time, 60), title: str(a.title, 80), kind: kind, guests: num(a.guests) ? String(Math.round(num(a.guests))) : '', contact: '', menu: str(a.menu, 600), notes: str(a.notes, 600), status: 'confirmed', dishes: dishes, tasks: [] };
          card({ type: 'event', e: e });
          return 'Shown to the chef: the event form with ' + e.title + ' on ' + date + ', to check and save.';
        } },
      { name: 'propose_recipe', description: 'Propose a new recipe for the book. It opens in the recipe editor for the chef to check and save. For a dish of several sub-recipes, put each in components.',
        inputSchema: { type: 'object', properties: { name: { type: 'string' }, category: { type: 'string' }, station: { type: 'string', enum: ['hot', 'cold', 'pass', ''] }, yieldQty: { type: 'string' }, yieldUnit: { type: 'string' },
          ingredients: { type: 'array', items: { type: 'object', properties: { q: { type: 'string' }, u: { type: 'string' }, n: { type: 'string' } }, required: ['n'] } }, steps: { type: 'array', items: { type: 'string' } },
          components: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, yieldQty: { type: 'string' }, yieldUnit: { type: 'string' }, ingredients: { type: 'array', items: { type: 'object' } }, steps: { type: 'array', items: { type: 'string' } } } } },
          plating: { type: 'string' }, notes: { type: 'string' } }, required: ['name'] },
        execute: (a) => {
          const d = JSON.parse(JSON.stringify(a || {}));
          d.name = str(d.name, 100);
          if (!d.name) throw new Error('the recipe needs a name');
          card({ type: 'recipe', d: d });
          return 'Shown to the chef: the recipe editor with ' + d.name + ', to check and save.';
        } },
      { name: 'open_order_check', description: 'Offer the chef the order check for a station: it asks about the ingredients for the rows marked DO on tomorrow\'s list, with the amounts they need.',
        inputSchema: { type: 'object', properties: { station: { type: 'string', enum: ['hot', 'cold', 'pass'] } }, required: ['station'] },
        execute: (a) => {
          const st = station(a.station), s = K.stockList(st);
          card({ type: 'order', st: st, n: s.ings.length });
          return { station: st, rows_to_make: s.toMake.map((it) => it.name), products: s.ings.slice(0, 60).map((x) => x.name + (x.usedIn && x.usedIn.length ? ' (' + x.usedIn.join('; ') + ')' : '')) };
        } },
    ];
  }

  /* ---------- asking ---------- */
  const ERR = {
    not_granted: 'Kitchen AI was not allowed to use Claude. Reload the page and tap Allow when Claude asks.',
    sampling_disabled: 'Claude is turned off for this account.',
    rate_limited: 'Too many questions in a short time, or the Claude usage limit is reached. Try again in a few minutes.',
    tools_unavailable: 'Kitchen AI cannot work in this view. Open the page in the Claude app or on claude.ai.',
    images_unavailable: 'Photos cannot be sent from this view. Type it instead.',
    image_rejected: 'That photo could not be used. Try a JPG or PNG under 20 MB.',
    refused: 'Claude declined that. Ask another way.',
    prompt_too_large: 'That was too much at once. Ask about one station or one recipe at a time.',
    session_expired: 'Sign in to Claude again, then ask again.',
  };
  const OFF = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'tools_unavailable'];
  function summary(item) {
    const said = (item.text || '').trim() || '(no answer)';
    const cards = item.cards.map((c) => c.type === 'plan' ? 'plan ' + c.st + ' for ' + c.covers + ' covers' : c.type === 'tasks' ? c.list.length + ' tasks' : c.type === 'prep' ? c.rows.length + ' prep rows on ' + c.st
      : c.type === 'event' ? 'event ' + c.e.title : c.type === 'recipe' ? 'recipe ' + c.d.name : c.type === 'order' ? 'order check ' + c.st : 'open ' + c.name + ' ×' + K.fmtNum(c.f));
    return said + (cards.length ? '\n[Proposals shown to the chef: ' + cards.join('; ') + '. The chef decides; do not assume they were saved.]' : '');
  }
  function send() {
    const A = AI(), el = document.getElementById('ai-in'), text = ((el && el.value) || A.text || '').trim(), files = A.files.slice();
    if (A.busy || (!text && !files.length)) return;
    A.text = ''; A.files = [];
    A.items.push({ who: 'me', text: text || 'Photo', photos: files.map((f) => URL.createObjectURL(f)) });
    const item = { who: 'ai', text: '', cards: [], status: 'Thinking…' };
    A.items.push(item);
    A.turns.push({ role: 'user', content: (text || 'Here is a photo.') + (files.length ? '\n[The chef attached ' + files.length + ' photo' + (files.length > 1 ? 's' : '') + '.]' : '') });
    A.busy = true; A.stick = true;
    const ctl = (A.ctl = new AbortController());
    const max = K.aiCaps && K.aiCaps.tools && K.aiCaps.tools.maxCount, list = tools(item);
    const opts = { signal: ctl.signal, modelTier: tier(), tools: max > 0 ? list.slice(0, max) : list, onText: (u) => { item.text = u.text; item.status = ''; paint(item); } };
    if (files.length) opts.images = files;
    K.render();
    Promise.resolve().then(() => K.sample([{ role: 'user', content: rules() }].concat(A.turns.slice(-12)), opts)).then((res) => {
      item.text = res.text;
      if (res.truncated) item.err = 'The answer was cut short. Ask for less at a time.';
    }, (e) => {
      const c = (e && e.code) || 'upstream_error';
      item.text = c === 'refused' ? '' : (e && e.text) || item.text;
      if (c === 'cancelled') item.stopped = true;
      else item.err = ERR[c] || 'Kitchen AI did not answer. Try again.';
      if (OFF.includes(c)) A.off = c !== 'tools_unavailable' ? true : A.off;
    }).then(() => {
      A.busy = false; A.ctl = null; item.status = '';
      A.turns.push({ role: 'assistant', content: summary(item) });
      K.render();
    });
  }
  /* streaming text changes in place: no redraw of the whole page while Claude writes */
  function paint(item) {
    const i = AI().items.indexOf(item), t = document.getElementById('ai-t' + i), s = document.getElementById('ai-s' + i);
    if (t) t.textContent = item.text;
    if (s) { s.textContent = item.status || ''; s.hidden = !item.status; }
    if (!t) K.refresh();
    stick();
  }
  function stick() { const b = document.querySelector('.sheet-body'); if (b && AI().stick) b.scrollTop = b.scrollHeight; }

  /* ---------- the proposals, and what tapping one does ---------- */
  const when = (date) => (date === K.day(0) ? 'today' : date === K.day(1) ? 'tomorrow' : K.sheetDate(date));
  function finish(c, words) { c.done = words; K.render(); }
  function applyCard(c) {
    const hand = (K.myHand && K.myHand()) || 'caveat';
    if (c.type === 'plan') { ui.sheet = { type: 'plan', st: c.st, day: c.date, covers: String(c.covers), have: {}, over: {} }; c.done = 'Opened the plan'; K.render(); return; }
    if (c.type === 'open') {
      /* one part opens on its own page (key x); a whole recipe scales its assembly (m) and every part (c0, c1…) */
      const f = {}, r = K.findSrc(c.id);
      if (c.ci >= 0) f.x = c.f; else { f.m = c.f; ((r && r.components) || []).forEach((x, i) => { f['c' + i] = c.f; }); }
      c.done = 'Opened'; K.go('recipe', { id: c.id, comp: c.ci, factors: f }); return;
    }
    if (c.type === 'order') { c.done = 'Opened'; K.startStock(c.st, false); return; }
    if (c.type === 'event') {
      if (!K.me.admin) { K.toast('Only the head chef can add events.'); return; }
      c.done = 'Opened the event form'; ui.sheet = { type: 'event', e: K.clone(c.e) }; K.render(); return;
    }
    if (c.type === 'recipe') {
      if (!K.me.admin) { K.toast('Only the head chef can add recipes.'); return; }
      c.done = 'Opened the recipe editor';
      const d = c.d, dish = Array.isArray(d.components) && d.components.length;
      K.startEdit(null, d.category || '', dish ? 'dish' : 'recipe');
      K.fillEdit(d);
      if (ui.edit && d.station && K.ST[d.station]) ui.edit.station = d.station;
      K.render();
      return;
    }
    if (c.type === 'prep') {
      const before = c.rows.map((x) => ({ it: x.it, m: K.clone(K.mark(c.st, x.it.id, c.date) || {}) }));
      K.setMarks(c.st, c.rows.map((x) => ({ it: x.it, patch: { d: 'do', k: '', q: x.q > 0 ? x.q : null, qu: x.q > 0 ? x.u : null, hand: hand } })), c.date);
      K.toast(c.rows.length + ' marked DO on ' + K.ST[c.st] + ' ' + when(c.date), { tone: 'good', undo: () => {
        K.setMarks(c.st, before.map((x) => ({ it: x.it, patch: { d: x.m.d || '', u: !!x.m.u, k: x.m.k || '', q: x.m.q > 0 ? x.m.q : null, qu: x.m.qu || null } })), c.date);
        c.done = ''; K.render();
      } });
      finish(c, 'Marked DO');
      return;
    }
    if (c.type === 'tasks') {
      c.list.forEach((t) => { if (t.day === 'tomorrow') K.leaveForTomorrow(t.st, t.text, t.urgent); else K.setPrep(t.st, { key: 'task-' + K.uid(), name: t.text }, 'need', t.urgent); });
      K.toast(c.list.length === 1 ? 'Task added' : c.list.length + ' tasks added', { tone: 'good' });
      finish(c, 'Added');
    }
  }
  function cardEl(c) {
    let title = '', lines = [], btn = '';
    if (c.type === 'plan') { title = 'Plan ' + K.ST[c.st] + ' for ' + c.covers + ' covers · ' + when(c.date); lines = [c.rows ? c.rows + (c.rows === 1 ? ' row has' : ' rows have') + ' a quantity per 10 covers. You check the amounts next.' : 'No row on this list has a quantity per 10 covers yet. Set them in Edit list first.']; btn = c.rows ? 'Check the amounts' : ''; }
    else if (c.type === 'prep') { title = 'Mark DO on ' + K.ST[c.st] + ' · ' + when(c.date); lines = c.rows.map((x) => K.trName(x.it.name, x.it.en) + (x.q ? ' · ' + K.fmtPlan(x.q, x.u) : '')); btn = 'Mark ' + c.rows.length + ' DO'; }
    else if (c.type === 'tasks') { title = c.list.length === 1 ? 'New task' : c.list.length + ' new tasks'; lines = c.list.map((t) => (t.urgent ? '! ' : '') + t.text + ' · ' + K.ST[t.st] + ' · ' + t.day); btn = c.list.length === 1 ? 'Add the task' : 'Add ' + c.list.length + ' tasks'; }
    else if (c.type === 'event') { title = 'New event: ' + c.e.title; lines = [K.sheetDate(c.e.date) + (c.e.time ? ' · ' + c.e.time : '') + (c.e.guests ? ' · ' + c.e.guests + ' guests' : '') + ' · ' + c.e.kind].concat(c.e.dishes.map((d) => d.name + (d.qty ? ' × ' + d.qty : '') + (d.link ? '' : ' (not in the book)'))); btn = 'Check and save'; }
    else if (c.type === 'recipe') { const d = c.d, n = (d.ingredients || []).length + (d.components || []).reduce((s, x) => s + ((x && x.ingredients) || []).length, 0); title = 'New recipe: ' + d.name; lines = [n + (n === 1 ? ' ingredient' : ' ingredients') + ((d.components || []).length ? ' in ' + d.components.length + ' parts' : '') + (d.yieldQty ? ' · makes ' + d.yieldQty + ' ' + (d.yieldUnit || '') : '')]; btn = 'Check and save'; }
    else if (c.type === 'order') { title = 'Order check · ' + K.ST[c.st]; lines = [c.n + ' products for tomorrow’s DO rows']; btn = 'Open the order check'; }
    else if (c.type === 'open') { title = c.name + ' × ' + K.fmtNum(c.f); lines = ['Opens the recipe already scaled']; btn = 'Open the recipe'; }
    return h('div', { class: 'ai-card' + (c.done ? ' done' : '') },
      h('b', null, title),
      lines.length ? h('ul', null, lines.slice(0, 12).map((l) => h('li', null, l)), lines.length > 12 ? h('li', { class: 'muted' }, '+' + (lines.length - 12) + ' more') : null) : null,
      c.done ? h('span', { class: 'ai-done' }, K.icon('check'), c.done) : btn ? h('button', { class: 'btn small primary', type: 'button', onclick: () => applyCard(c) }, btn) : null);
  }

  /* ---------- the sheet ---------- */
  const EXAMPLES = ['Утре имаме 80 куверта: планирай студената', 'Add 2 kg chestnut purée to tomorrow’s prep on Hot', 'Add a wine dinner on Friday at 19:30 for 40 guests', 'Scale дресинг бъз to 3 L'];
  K.SHEETS.ai = function () {
    const A = AI(), caps = K.aiCaps || {}, photos = !!(caps.images && K.sampleImages);
    const log = h('div', { class: 'ai-log', 'aria-live': 'polite' },
      !A.items.length ? h('div', { class: 'ai-intro' },
        h('p', null, 'Ask in your own words, in Bulgarian or English. Kitchen AI reads the book and suggests; nothing changes until you tap a suggestion and check it.'),
        h('div', { class: 'ai-ex' }, EXAMPLES.map((x) => h('button', { type: 'button', class: 'chip', onclick: () => { A.text = x; K.render(); const el = document.getElementById('ai-in'); if (el) el.focus(); } }, x)))) : null,
      A.items.map((it, i) => it.who === 'me'
        ? h('div', { class: 'ai-me' }, it.photos && it.photos.length ? h('div', { class: 'ai-photos' }, it.photos.map((u) => h('img', { src: u, alt: 'Photo sent' }))) : null, h('p', null, it.text))
        : h('div', { class: 'ai-said' },
          h('p', { class: 'ai-st', id: 'ai-s' + i, hidden: !it.status }, it.status || ''),
          h('p', { class: 'ai-txt', id: 'ai-t' + i }, it.text),
          it.cards.map(cardEl),
          it.stopped ? h('p', { class: 'hint' }, 'Stopped.') : null,
          it.err ? h('p', { class: 'ai-err' }, it.err) : null)));
    const input = h('textarea', { class: 'input ai-in', id: 'ai-in', rows: '2', placeholder: 'e.g. 80 covers tomorrow, plan Cold', 'aria-label': 'Ask Kitchen AI', value: A.text,
      oninput: (e) => { A.text = e.target.value; },
      onkeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } } });
    const composer = h('form', { class: 'ai-compose', onsubmit: (e) => { e.preventDefault(); send(); } },
      A.files.length ? h('div', { class: 'ai-files' }, A.files.map((f, i) => h('span', { class: 'chip' }, K.icon('photo'), f.name.slice(0, 24), h('button', { type: 'button', class: 'link-btn', 'aria-label': 'Remove ' + f.name, onclick: () => { A.files.splice(i, 1); K.render(); } }, K.icon('close'))))) : null,
      h('div', { class: 'ai-row' },
        photos ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Add a photo', title: 'Add a photo: a recipe sheet, the whiteboard, a booking', disabled: A.busy, onclick: () => K.pickFile('image/*', true, (f) => { A.files = A.files.concat(f).slice(0, K.sampleImages || 1); K.render(); }) }, K.icon('camera')) : null,
        input,
        A.busy ? h('button', { class: 'btn', type: 'button', onclick: () => { if (A.ctl) A.ctl.abort(); } }, 'Stop')
          : h('button', { class: 'btn primary', type: 'submit', 'aria-label': 'Send' }, K.icon('send'))),
      h('div', { class: 'ai-foot' },
        K.seg([['default', 'Normal'], ['complex', 'Thorough']], tier(), (v) => { K.store.set('aiTier', v); K.render(); }, { 'aria-label': 'How hard Kitchen AI thinks', class: 'seg ai-tier' }),
        h('span', { class: 'hint' }, tier() === 'complex' ? 'Slower, more careful' : 'Uses your Claude plan')));
    const back = K.sheet('Kitchen AI', h('div', { class: 'ai' }, log, composer), { wide: true });
    requestAnimationFrame(() => { if (A.stick) { stick(); if (!A.busy) A.stick = false; } });
    return back;
  };
})();
