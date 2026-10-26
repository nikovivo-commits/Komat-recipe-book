/* Kitchen data: live subscriptions, the recipe model, stations, mise en place, prep tasks,
   orders, rota and events. Collections and fields match the first version of the book, so
   both read and write the same database. */
(function () {
  'use strict';
  const K = window.K;
  const D = (K.D = {
    loaded: false, recipesSrc: [], recipes: [],
    branding: { logo: '', heroes: [], approve: '' },
    checklists: null, checks: {}, prep: {}, orders: {}, boards: {}, events: [], weeks: {},
    staff: { people: [] }, codes: { codes: [] }, kitchen: null, bugs: [], names: {}, noWrite: false,
  });

  K.STATIONS = [['hot', 'Hot'], ['cold', 'Cold'], ['pass', 'Pass & pastry']];
  K.ST = { hot: 'Hot', cold: 'Cold', pass: 'Pass & pastry' };
  K.ST_ICON = { hot: 'flame', cold: 'snow', pass: 'pass' };
  K.SERVICES = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['brunch', 'Brunch'], ['alacarte', 'À la carte']];
  K.SV = { breakfast: 'Breakfast', lunch: 'Lunch', brunch: 'Brunch', alacarte: 'À la carte' };
  K.SV_HINT = { breakfast: 'Every day', lunch: 'Mon–Fri', brunch: 'Sat–Sun', alacarte: 'Dinner' };
  K.BASE_CATS = ['Meat & fish prep', 'Sauces & stocks', 'Starters', 'Mains', 'Garnish', 'Desserts', 'Bread & pastry', 'Mise en place', 'Pickles & ferments'];
  const DEFAULT_KITCHEN = {
    orderDue: '23:00', orderContact: '',
    /* tasks that come back on set weekdays (0 = Sunday); item goes to the top of the order check */
    repeats: [{ id: 'bread', name: 'Поръчай хляб', station: 'pass', days: [0, 2, 4], item: 'Хляб' }],
    /* products to look at in every order check */
    daily: [{ station: 'pass', name: 'Микрозеленини' }],
  };
  K.kitchen = () => Object.assign({}, DEFAULT_KITCHEN, D.kitchen || {});

  /* ---------- recipes ---------- */
  function normComp(c) {
    c = c || {};
    return { cid: c.cid || '', name: c.name || 'Component', station: c.station || '', yieldQty: c.yieldQty || '', yieldUnit: c.yieldUnit || '',
      ingredients: Array.isArray(c.ingredients) ? c.ingredients : [], steps: Array.isArray(c.steps) ? c.steps : [], notes: c.notes || '' };
  }
  K.normComp = normComp;
  K.norm = function (r) {
    const comps = Array.isArray(r.components) ? r.components.map(normComp) : [];
    return {
      id: r.id, name: r.name || 'Untitled', category: r.category || '', yieldQty: r.yieldQty || '', yieldUnit: r.yieldUnit || '',
      photo: r.photo || '', videos: Array.isArray(r.videos) ? r.videos : [], ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      steps: Array.isArray(r.steps) ? r.steps : [], plating: r.plating || '', notes: r.notes || '', allergens: Array.isArray(r.allergens) ? r.allergens : [],
      allergensChecked: !!r.allergensChecked, updated: r.updated || 0, station: r.station || '',
      services: Array.isArray(r.services) ? r.services : [], onMenu: r.onMenu !== false, components: comps,
      type: r.type === 'dish' || r.type === 'recipe' ? r.type : comps.length ? 'dish' : 'recipe',
    };
  };

  /* recipe language: the book is written in Bulgarian; English comes from the translation list */
  K.lang = K.store.get('lang', 'bg') === 'en' ? 'en' : 'bg';
  const TR = window.KOMAT_TR || {};
  K.tx = (t) => (t && TR[t]) || t;
  function trPart(p, en) {
    const bag = [p.name, K.tx(p.name)];
    if (en) p.name = K.tx(p.name);
    p.ingredients = p.ingredients.map((i) => { bag.push(i.n, K.tx(i.n)); return en ? Object.assign({}, i, { n: K.tx(i.n), o: i.n }) : i; });
    if (en) { p.steps = p.steps.map(K.tx); if (p.notes) p.notes = K.tx(p.notes); }
    return bag;
  }
  function langRec(r) {
    const en = K.lang === 'en', c = K.clone(r);
    let bag = trPart(c, en);
    if (en && c.plating) c.plating = K.tx(c.plating);
    c.components.forEach((k) => { const b = trPart(k, en); k._alt = b.join(' ').toLowerCase(); bag = bag.concat(b); });
    c._alt = bag.join(' ').toLowerCase();
    return c;
  }
  K.setLang = function (l) {
    K.lang = l; K.store.set('lang', l);
    D.recipes = D.recipesSrc.map(langRec);
    K.render();
  };
  function setRecipes(list) { D.recipesSrc = list; D.recipes = list.map(langRec); houseFor = null; }
  /* show a saved recipe at once, before the database echoes it back */
  K.upsertRecipe = function (rec) {
    const list = D.recipesSrc.filter((r) => r.id !== rec.id);
    if (rec.name) list.push(rec);
    setRecipes(list);
  };
  K.find = (id) => D.recipes.find((r) => r.id === id) || null;
  K.findSrc = (id) => D.recipesSrc.find((r) => r.id === id) || null;
  K.cats = () => Array.from(new Set(D.recipes.map((r) => r.category).filter(Boolean))).sort();
  K.folders = () => { const l = K.BASE_CATS.slice(); K.cats().forEach((c) => { if (!l.includes(c)) l.push(c); }); return l; };
  K.allIngLists = (r) => [r.ingredients].concat((r.components || []).map((c) => c.ingredients));
  K.stationOf = (r, c) => (c && c.station) || r.station || '';

  /* a "link" points at a recipe ("id") or one of a dish's components ("id~2") */
  K.linkTarget = function (link) {
    if (!link) return null;
    const p = String(link).split('~'), r = K.find(p[0]);
    if (!r) return null;
    const ci = p.length > 1 ? +p[1] : -1;
    if (ci >= 0 && !r.components[ci]) return null;
    return { r: r, ci: ci, name: ci >= 0 ? r.components[ci].name : r.name, ingredients: ci >= 0 ? r.components[ci].ingredients : r.ingredients };
  };
  K.nameMatch = function (a, b, loose) {
    a = K.normName(a); b = K.normName(b);
    if (!a || !b) return false;
    if (a === b) return true;
    if (!loose) return false;
    const s = a.length < b.length ? a : b, l = a.length < b.length ? b : a;
    return s.length >= 4 && l.includes(s);
  };
  K.recipeOptions = function (emptyLabel) {
    const opts = [['', emptyLabel || 'No recipe']];
    D.recipes.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((r) => {
      if (r.type !== 'dish' || r.ingredients.length || !r.components.length) opts.push([r.id, r.name]);
      r.components.forEach((c, i) => opts.push([r.id + '~' + i, r.name + ' › ' + c.name]));
    });
    return opts;
  };

  /* ---------- services and prep items ---------- */
  K.servicesToday = () => { const d = K.kitchenNow().getDay(); return d === 0 || d === 6 ? ['breakfast', 'brunch', 'alacarte'] : ['breakfast', 'lunch', 'alacarte']; };
  const recServices = (r) => (r.services && r.services.length ? r.services : ['alacarte']);
  /* on-menu recipes and dish components that a station makes for today's services */
  K.prepItems = function (st) {
    const out = [], today = K.servicesToday();
    D.recipes.forEach((r) => {
      if (r.onMenu === false || !recServices(r).some((x) => today.includes(x))) return;
      if (r.type !== 'dish' && r.station === st) out.push({ key: r.id, name: r.name, r: r, ci: -1, ingredients: r.ingredients });
      if (r.type === 'dish') r.components.forEach((c, i) => {
        if (K.stationOf(r, c) === st) out.push({ key: r.id + '~' + i, name: c.name, r: r, ci: i, ingredients: c.ingredients, dish: r.name });
      });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name));
  };

  /* ---------- ordering: one line per product, no staples, nothing made in house ---------- */
  const ORD_QUAL = ['на много ситно', 'на много фино', 'на ситно', 'на фино', 'на дребно', 'на едро', 'на паста', 'нарязан без дръжки', 'нарязан', 'нарязана', 'без дръжки', 'изрезки', 'белен', 'белена', 'чистен', 'чистена', 'чистени', 'смачкани', 'бланширан', 'бланширани', 'бланширана', 'сурово', 'суров', 'печен', 'печена', 'печени', 'печено', 'готвено', 'остатъци', 'на купчета във фризера', 'на стайна температура', 'от мелничка', 'прясно смлян', 'шифонада', 'почистена', 'почистен', 'тънко', 'тънко нарязан'];
  const ORD_SYN = { 'даф лист': 'дафинов лист', 'стар лук': 'лук', прокрема: 'прокрем', 'тиквени семки': 'тиквено семе', 'сок лайм': 'лайм', 'сок от лимон': 'лимонов сок', 'краве мляко': 'мляко', 'горчица едромляна': 'едросмляна горчица', 'зелени чушки': 'зелена чушка', 'кора от половин лимон': 'лимон', 'кора от половин портокал': 'портокал', 'оризов оцет с комбу': 'оризов оцет', 'лио малини без силиката': 'лио малини', sugar: 'захар', 'olive oil': 'зехтин', 'extra virgin olive oil': 'зехтин', 'rice vinegar': 'оризов оцет', xanthan: 'ксантан', 'agar agar': 'агар', dill: 'копър', 'fresh dill': 'копър', parsley: 'магданоз', 'garlic clove': 'чесън', katyk: 'катък', chili: 'чили', chives: 'лук резанец', 'balsamic vinegar': 'балсамов оцет', 'good balsamic vinegar': 'балсамов оцет', 'orange juice': 'портокалов сок', 'fresh orange juice': 'портокалов сок', 'juice of limes': 'лайм', 'lime juice': 'лайм', 'fresh lemon juice': 'лимонов сок', 'wild garlic oil': 'олио левурда', zucchini: 'тиквички', cornstarch: 'нишесте', togarashi: 'тогараши', mirin: 'мирин', 'white fish': 'бяла риба', gelcrem: 'гелкрем', basil: 'босилек', gin: 'джин', cucumber: 'краставица', 'cucumber with the peel': 'краставица', 'cucumber peels': 'краставица', 'orange peel': 'портокал', жълтъци: 'жълтък', жълтъка: 'жълтък', белтъци: 'белтък', орехи: 'орех', 'скилидки чесън': 'чесън', лимони: 'лимон', ягоди: 'ягода' };
  const ORD_SKIP = /^(сол|вода|лед|пипер|черен пипер|бял пипер|зелен пипер|пипер зърна|черен пипер зърна|зърна черен пипер|бял пипер зърна|зелен пипер зърна|сол и пипер|salt|pepper|water|salt and pepper|ice|fine salt|salt, pepper|олио кервиз|олио левурда|зелено олио|wild garlic oil|лещен сос|крокмач)$/;
  function ordKey(n) {
    let k = String(n || '').split(/[,(]/)[0].split(' да ')[0].toLowerCase().replace(/[0-9%.?]+/g, ' ').replace(/\s+/g, ' ').trim();
    ORD_QUAL.forEach((q) => { k = (' ' + k + ' ').replace(' ' + q + ' ', ' ').trim(); });
    k = k.replace(/\s+/g, ' ').trim();
    return ORD_SYN[k] || k;
  }
  let houseNames = null, houseFor = null;
  function isHouseMade(k) {
    if (houseFor !== D.recipesSrc) {
      houseFor = D.recipesSrc; houseNames = {};
      D.recipesSrc.forEach((r) => { houseNames[ordKey(r.name)] = 1; r.components.forEach((c) => { houseNames[ordKey(c.name)] = 1; }); });
    }
    return !!houseNames[k] || /^редукция|^редуциран|^саламура|^дърпано|бульон|булион|^понзу|^confit|syrup|(^| )жу$|^жу |гел$/.test(k);
  }
  function orderable(n) {
    const k = ordKey(n);
    if (!k || ORD_SKIP.test(k) || /^(щипка|pinch|вода да покрие)/.test(k) || isHouseMade(k)) return null;
    return { key: k, name: k.charAt(0).toUpperCase() + k.slice(1) };
  }
  function addIng(map, g, used) {
    const o = orderable(g.o || g.n);
    if (!o) return;
    if (!map[o.key]) map[o.key] = { name: o.name, usedIn: [] };
    if (!map[o.key].usedIn.some((u) => u.toLowerCase() === String(used).toLowerCase())) map[o.key].usedIn.push(used);
  }
  /* what a mise en place row is made from: its linked recipe, else a recipe with the same name */
  K.recipeFor = function (item) {
    const lk = K.linkTarget(item.link);
    if (lk) return { name: lk.name, ingredients: lk.ingredients };
    let hit = null;
    D.recipes.forEach((r) => {
      if (!hit && r.type === 'dish' && K.nameMatch(r.name, item.group, true)) r.components.forEach((c) => { if (!hit && K.nameMatch(c.name, item.name, true)) hit = { name: c.name, ingredients: c.ingredients }; });
    });
    if (hit) return hit;
    D.recipes.forEach((r) => {
      if (hit) return;
      if (K.nameMatch(r.name, item.name)) hit = { name: r.name, ingredients: r.ingredients };
      else r.components.forEach((c) => { if (!hit && K.nameMatch(c.name, item.name)) hit = { name: c.name, ingredients: c.ingredients }; });
    });
    return hit;
  };
  /* the products behind a station: today's menu preps, plus (when closing) every mise en place row */
  K.stockList = function (st, closing) {
    const map = {}, unlinked = [];
    K.prepItems(st).forEach((it) => it.ingredients.forEach((g) => addIng(map, g, it.name)));
    if (closing) K.checkItems(st).forEach((it) => {
      const r = K.recipeFor(it);
      if (r && r.ingredients.length) r.ingredients.forEach((g) => addIng(map, g, it.name)); else unlinked.push(it.name);
    });
    const kc = K.kitchen(), pinned = [], skip = {};
    (kc.repeats || []).forEach((rp) => {
      if (!rp.item) return;
      skip[rp.item.toLowerCase()] = 1;
      if (rp.station === st && (rp.days || []).includes(K.kitchenNow().getDay())) pinned.push({ name: rp.item, usedIn: ['Order today (' + daysLabel(rp.days) + ')'], flag: 'red' });
    });
    (kc.daily || []).forEach((x) => { skip[x.name.toLowerCase()] = 1; if (x.station === st) pinned.push({ name: x.name, usedIn: ['Check every day'], flag: 'ask' }); });
    const list = Object.keys(map).sort().map((k) => map[k]).filter((x) => !skip[x.name.toLowerCase()]);
    return { ings: pinned.concat(list), unlinked: unlinked };
  };
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function daysLabel(days) { return (days || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WD[d]).join(', '); }
  K.daysLabel = daysLabel;

  /* ---------- mise en place checklists ---------- */
  K.sections = (st) => (D.checklists && D.checklists.stations && D.checklists.stations[st] && D.checklists.stations[st].sections) || [];
  K.checkId = (st, date) => (date || K.day(0)) + '_' + st;
  K.checkItems = function (st) {
    const out = [], d = D.checks[K.checkId(st)];
    K.sections(st).forEach((sec) => sec.groups.forEach((g) => {
      g.items.forEach((it) => out.push({ id: it.id, name: it.name, group: g.name, gkey: g.key, link: it.link || '' }));
      ((d && d.extra && d.extra[g.key]) || []).forEach((it) => out.push({ id: it.id, name: it.name, group: g.name, gkey: g.key, extra: true }));
    }));
    return out;
  };
  /* today's mark for a row; a DO (or urgent) left open on one of the last 3 days carries over */
  K.mark = function (st, id) {
    const t = D.checks[K.checkId(st)], m = t && t.marks && t.marks[id];
    if (m && 'd' in m) return Object.assign({}, m, { d: m.d === 'urg' ? 'do' : m.d });
    for (let k = 1; k <= 3; k++) {
      const p = D.checks[K.checkId(st, K.day(-k))], pm = p && p.marks && p.marks[id];
      if (pm && 'd' in pm) {
        if (pm.d === 'do' || pm.d === 'urg') return Object.assign({}, pm, m || {}, { d: 'do', from: K.day(-k) });
        return m || null;
      }
    }
    return m || null;
  };
  K.markState = (st, id) => { const m = K.mark(st, id); return (m && m.d) || ''; };
  K.isUrgent = (st, id) => { const m = K.mark(st, id); return !!(m && (m.u || m.d === 'urg') && m.d !== 'ok'); };
  K.markNote = (st, id) => { const m = K.mark(st, id); return (m && m.c) || ''; };

  /* patch one row's mark: {d:'do'|'ok'|''} or {u:bool} or {c:'comment'} */
  K.setMark = function (st, it, patch) {
    const id = K.checkId(st);
    let doc = D.checks[id];
    const fresh = !doc;
    if (!doc) doc = D.checks[id] = { date: K.day(0), station: st, marks: {}, extra: {} };
    doc.marks = doc.marks || {};
    const prev = doc.marks[it.id] ? K.clone(doc.marks[it.id]) : undefined;
    const em = K.mark(st, it.id) || {};
    const m = Object.assign({}, prev || {}, patch, { n: it.name });
    if (em.from) { if (m.c === undefined && em.c) m.c = em.c; if (m.d === undefined) m.d = em.d; if (m.u === undefined && em.u) m.u = em.u; }
    if ('d' in patch && (patch.d === 'ok' || patch.d === '')) m.u = false;
    if (!('c' in patch) || Object.keys(patch).length > 1) { m.t = Date.now(); m.by = K.me.id || ''; }
    doc.marks[it.id] = m;
    K.refresh(true);
    const ref = K.db.doc('checks/' + id), body = { marks: {}, at: Date.now() };
    body.marks[it.id] = m;
    const full = () => ref.set({ date: K.day(0), station: st, marks: doc.marks, extra: doc.extra || {}, at: Date.now() });
    const p = fresh ? full() : ref.update(body).catch((e) => (e && e.code === 'invalid_argument' ? full() : Promise.reject(e)));
    return p.catch((e) => { if (prev === undefined) delete doc.marks[it.id]; else doc.marks[it.id] = prev; K.refresh(true); writeFailed(e); });
  };
  K.addExtra = function (st, gkey, name) {
    const id = K.checkId(st);
    const doc = D.checks[id] || (D.checks[id] = { date: K.day(0), station: st, marks: {}, extra: {} });
    doc.extra = doc.extra || {};
    const list = (doc.extra[gkey] || []).concat([{ id: 'x' + K.uid(), name: name }]);
    return saveExtra(st, gkey, list);
  };
  K.removeExtra = function (st, gkey, itemId) {
    const doc = D.checks[K.checkId(st)];
    if (!doc || !doc.extra) return;
    return saveExtra(st, gkey, (doc.extra[gkey] || []).filter((x) => x.id !== itemId));
  };
  function saveExtra(st, gkey, list) {
    const id = K.checkId(st), doc = D.checks[id], old = (doc.extra[gkey] || []).slice();
    doc.extra[gkey] = list;
    K.refresh(true);
    const ref = K.db.doc('checks/' + id), patch = { extra: {}, at: Date.now() };
    patch.extra[gkey] = list;
    const full = () => ref.set({ date: K.day(0), station: st, marks: doc.marks || {}, extra: doc.extra, at: Date.now() });
    return ref.update(patch).catch((e) => (e && e.code === 'invalid_argument' ? full() : Promise.reject(e)))
      .catch((e) => { doc.extra[gkey] = old; K.refresh(true); writeFailed(e); });
  }
  K.closedInfo = (st) => { const d = D.checks[K.checkId(st)]; return d && d.closed && d.closed.at ? d.closed : null; };
  K.setClosed = function (st) {
    const id = K.checkId(st), doc = D.checks[id] || (D.checks[id] = { date: K.day(0), station: st, marks: {}, extra: {} });
    const c = { at: Date.now(), by: K.me.id || '' };
    doc.closed = c;
    const ref = K.db.doc('checks/' + id);
    return ref.update({ closed: c, at: Date.now() }).catch((e) => (e && e.code === 'invalid_argument'
      ? ref.set({ date: K.day(0), station: st, marks: doc.marks || {}, extra: doc.extra || {}, closed: c, at: Date.now() }) : Promise.reject(e)));
  };
  K.saveChecklists = function (n, msg) {
    D.checklists = n;
    K.refresh(true);
    return K.db.doc('settings/checklists').set(n).then(() => { if (msg) K.toast(msg); }, writeFailed);
  };

  /* ---------- prep tasks (free tasks, tasks left for tomorrow, event tasks, repeats) ---------- */
  K.prepId = (key, date) => (date || K.day(0)) + '_day_' + K.safeId(key);
  /* status: 'need' | 'done' | '' (removed). it = {key, name, note?, origId?} */
  K.setPrep = function (st, it, status, urgent) {
    const id = K.prepId(it.key), old = D.prep[id];
    let u = urgent === undefined ? !!(old && old.urgent) : !!urgent;
    if (status !== 'need') u = false;
    const body = { date: K.day(0), station: st, service: 'day', key: it.key, name: it.name, status: status, at: Date.now(), by: K.me.id || '', task: true, urgent: u };
    if (old && old.leftBy) { body.leftBy = old.leftBy; body.leftAt = old.leftAt || 0; }
    const nt = it.note !== undefined ? it.note : (old && old.note) || '';
    if (nt) body.note = nt;
    if (u) body.urgentAt = (old && old.urgent && old.urgentAt) || Date.now();
    const orig = it.origId && it.origId !== id ? it.origId : null, od = orig ? D.prep[orig] : null;
    if (orig && od) {
      if (od.leftBy && !body.leftBy) { body.leftBy = od.leftBy; body.leftAt = od.leftAt || 0; }
      if (od.note && !body.note) body.note = od.note;
      delete D.prep[orig];
    }
    if (status === '') delete D.prep[id]; else D.prep[id] = body;
    K.refresh(true);
    const ref = K.db.doc('prep/' + id);
    return (status === '' ? ref.delete() : ref.set(body))
      .then(() => { if (orig) return K.db.doc('prep/' + orig).delete().catch(() => {}); })
      .catch((e) => { if (old) D.prep[id] = old; else delete D.prep[id]; if (orig && od) D.prep[orig] = od; K.refresh(true); writeFailed(e); });
  };
  K.setPrepNote = function (id, text) {
    const d = D.prep[id];
    if (!d) return;
    const b = K.clone(d);
    if (text) b.note = text; else delete b.note;
    D.prep[id] = b;
    K.refresh(true);
    return K.db.doc('prep/' + id).set(b).catch((e) => { D.prep[id] = d; K.refresh(true); writeFailed(e); });
  };
  K.removePrep = function (id) {
    const old = D.prep[id];
    delete D.prep[id];
    K.refresh(true);
    return K.db.doc('prep/' + id).delete().catch((e) => { D.prep[id] = old; K.refresh(true); writeFailed(e); });
  };
  K.restorePrep = function (id, body) {
    D.prep[id] = body;
    K.refresh(true);
    return K.db.doc('prep/' + id).set(body).catch(writeFailed);
  };
  /* today's tasks for a station; unfinished free tasks from the last 3 days carry over */
  K.dayTasks = function (st) {
    const out = [], pre = K.day(0) + '_day_', have = {};
    Object.keys(D.prep).forEach((id) => {
      const d = D.prep[id];
      if (id.startsWith(pre) && d.station === st && d.status) { out.push(Object.assign({ _id: id }, d)); have[d.key] = 1; }
    });
    Object.keys(D.prep).forEach((id) => {
      const d = D.prep[id];
      if (d.station !== st || d.status !== 'need' || !d.task || have[d.key] || String(d.key).startsWith('evt-') || String(d.key).startsWith('auto-')) return;
      if (!(d.date < K.day(0))) return;
      have[d.key] = 1;
      out.push(Object.assign({}, d, { _id: id, _orig: id, _from: d.date }));
    });
    return out.sort((a, b) => (a.at || 0) - (b.at || 0));
  };
  K.leaveForTomorrow = function (st, name, urgent, note) {
    const date = K.day(1), key = 'task-' + K.uid(), id = K.prepId(key, date);
    const body = { date: date, station: st, service: 'day', key: key, name: name, status: 'need', at: Date.now(), by: K.me.id || '', task: true, urgent: !!urgent, leftBy: K.me.id || '', leftAt: Date.now() };
    if (urgent) body.urgentAt = Date.now();
    if (note) body.note = note;
    D.prep[id] = body;
    K.refresh(true);
    return K.db.doc('prep/' + id).set(body).then(() => K.toast('Left for tomorrow on ' + K.ST[st]), (e) => { delete D.prep[id]; K.refresh(true); writeFailed(e); });
  };
  K.tomorrowTasks = function (st) {
    const pre = K.day(1) + '_day_', out = [];
    Object.keys(D.prep).forEach((id) => { const d = D.prep[id]; if (id.startsWith(pre) && d.station === st && d.status === 'need') out.push({ id: id, d: d }); });
    return out.sort((a, b) => (b.d.urgent ? 1 : 0) - (a.d.urgent ? 1 : 0) || (a.d.at || 0) - (b.d.at || 0));
  };
  K.repeatsToday = function (st) {
    const wd = K.kitchenNow().getDay();
    return (K.kitchen().repeats || []).filter((rp) => rp.station === st && (rp.days || []).includes(wd)).map((rp) => {
      const key = 'auto-' + rp.id, d = D.prep[K.prepId(key)];
      return { key: key, name: rp.name, days: rp.days, done: !!(d && d.status === 'done') };
    });
  };
  /* every urgent thing in the kitchen today, oldest first */
  K.openUrgents = function () {
    const out = [], pre = K.day(0) + '_';
    Object.keys(D.prep).forEach((id) => { const d = D.prep[id]; if (id.startsWith(pre) && d.urgent && d.status === 'need') out.push(Object.assign({ _id: id }, d)); });
    K.STATIONS.forEach((s) => K.checkItems(s[0]).forEach((it) => {
      if (!K.isUrgent(s[0], it.id)) return;
      const m = K.mark(s[0], it.id) || {};
      out.push({ check: true, it: it, station: s[0], name: it.name, note: m.c || '', at: m.t || 0, by: m.by || '' });
    }));
    return out.sort((a, b) => (a.urgentAt || a.at || 0) - (b.urgentAt || b.at || 0));
  };

  /* ---------- orders and whiteboard ---------- */
  K.orderFor = (st, date) => D.orders[(date || K.day(0)) + '_' + st] || null;
  K.sendOrder = function (st, items, closing) {
    const id = K.day(0) + '_' + st, ref = K.db.doc('orders/' + id), had = !!D.orders[id];
    let p = items.length ? ref.set({ date: K.day(0), station: st, items: items, at: Date.now(), by: K.me.id || '' }) : had ? ref.delete() : Promise.resolve();
    if (closing) p = p.then(() => K.setClosed(st));
    return p;
  };
  K.saveBoard = function (dataUrl) {
    const d = K.day(0);
    return K.db.doc('boards/' + d).set({ date: d, photo: dataUrl, at: Date.now(), by: K.me.id || '' });
  };

  /* ---------- rota ---------- */
  K.personName = (id) => { const p = D.staff.people.find((x) => x.id === id); return p ? p.name : '?'; };
  K.codeClass = (c) => {
    c = String(c || '').trim().toUpperCase();
    if (!c) return 'blank';
    if (c === '0' || c === 'X') return 'off';
    if (c.startsWith('BR')) return 'br';
    if (c === 'P') return 'p';
    return 'other';
  };
  K.codeLabel = (c) => { const u = String(c || '').trim().toUpperCase(); const m = D.codes.codes.find((x) => String(x.code).toUpperCase() === u); return m && m.label ? m.label : ''; };
  K.onToday = function () {
    const w = D.weeks[K.thisWeek()], i = K.todayIdx();
    if (!w) return [];
    return (w.people || []).map((id) => ({ id: id, code: ((w.rows || {})[id] || [])[i] || '' }))
      .filter((x) => { const c = String(x.code).trim().toUpperCase(); return c && c !== '0' && c !== 'X'; });
  };
  K.saveWeek = function (wk, body) {
    D.weeks[wk] = body;
    K.refresh(true);
    return K.db.doc('schedules/' + wk).set(body).catch(writeFailed);
  };
  K.saveStaff = (n) => { D.staff = n; K.refresh(true); return K.db.doc('settings/staff').set(n).catch(writeFailed); };
  K.saveCodes = (n) => { D.codes = n; K.refresh(true); return K.db.doc('settings/shiftcodes').set(n).catch(writeFailed); };

  /* ---------- events ---------- */
  K.WHEN = [[0, 'On the day'], [1, '1 day before'], [2, '2 days before'], [3, '3 days before'], [5, '5 days before'], [7, '1 week before']];
  K.isLive = (e) => e.status !== 'cancelled';
  K.upcomingEvents = () => { const t = K.day(0); return D.events.filter((e) => e.date >= t).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))); };
  K.eventsOn = (ds) => D.events.filter((e) => e.date === ds);
  K.evDishes = (e) => (Array.isArray(e.dishes) ? e.dishes : []);
  K.evTasks = (e) => (Array.isArray(e.tasks) ? e.tasks : []);
  K.dueDate = (e, t) => K.ymd(K.addDays(K.parseYmd(e.date), -(+t.before || 0)));
  K.countdown = (e) => { const d = K.daysUntil(e.date); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : d > 1 ? 'In ' + d + ' days' : K.prettyDate(e.date, { day: 'numeric', month: 'short' }); };
  K.evTaskStatus = (key) => { const d = D.prep[K.prepId(key)]; return d ? d.status : 'need'; };
  /* event tasks that fall due today (or are overdue) for a station */
  K.eventTasksToday = function (st) {
    const out = [], t = K.day(0);
    D.events.forEach((e) => {
      if (e.status === 'cancelled' || e.status === 'pending') return;
      K.evTasks(e).forEach((k) => {
        const due = K.dueDate(e, k);
        if (k.station === st && due <= t && e.date >= t) out.push({ key: 'evt-' + e.id + '-' + k.id, name: k.text, event: e, late: due < t });
      });
    });
    return out;
  };
  /* portions asked for / the recipe's yield in portions = the factor to open the recipe at */
  K.scaleFor = function (d) {
    const lk = K.linkTarget(d.link);
    if (!lk) return null;
    const n = parseFloat(d.qty);
    if (!(n > 0)) return null;
    const part = lk.ci >= 0 ? lk.r.components[lk.ci] : lk.r, y = parseFloat(part.yieldQty), u = String(part.yieldUnit || '').toLowerCase();
    return y > 0 && /portion|pcs|порц|бр/.test(u) ? n / y : null;
  };
  K.saveEvent = function (id, body) {
    const i = D.events.findIndex((x) => x.id === id), next = Object.assign({ id: id }, body);
    if (i >= 0) D.events[i] = next; else D.events.push(next);
    K.refresh(true);
    return K.db.doc('events/' + id).set(body).then(() => K.toast('Event saved'), writeFailed);
  };
  K.deleteEvent = function (id) {
    D.events = D.events.filter((x) => x.id !== id);
    K.refresh(true);
    return K.db.doc('events/' + id).delete().then(() => K.toast('Event deleted'), writeFailed);
  };

  /* ---------- settings ---------- */
  K.saveBranding = function (patch) {
    const next = Object.assign({ logo: D.branding.logo || '', heroes: (D.branding.heroes || []).slice(), approve: D.branding.approve || '' }, patch);
    D.branding = next;
    K.refresh(true);
    return K.db.doc('settings/branding').set(next).catch(writeFailed);
  };
  K.saveKitchen = function (patch) {
    const next = Object.assign({}, K.kitchen(), patch);
    D.kitchen = next;
    K.refresh(true);
    return K.db.doc('settings/kitchen').set(next).catch(writeFailed);
  };

  /* ---------- write errors ---------- */
  function writeFailed(e) {
    if (e && e.code === 'invalid_argument') { D.noWrite = true; K.refresh(true); K.toast('Not saved: you can only view this book.', { tone: 'bad' }); }
    else if (e && e.code === 'quota_exceeded') K.toast('The database is full. Ask the head chef to clear old records in Settings.', { tone: 'bad' });
    else K.toast('Not saved. Check your connection and try again.', { tone: 'bad' });
  }
  K.writeFailed = writeFailed;

  /* ---------- names of the people behind ids ---------- */
  let nameQ = {}, nameT = null;
  K.nameOf = function (id) {
    if (!id) return '';
    if (!(id in D.names)) { nameQ[id] = 1; clearTimeout(nameT); nameT = setTimeout(resolveNames, 50); }
    return D.names[id] || '';
  };
  function resolveNames() {
    const ids = Object.keys(nameQ);
    nameQ = {};
    if (!ids.length) return;
    ids.forEach((id) => { D.names[id] = ''; });
    if (!K.user || typeof K.user.profiles !== 'function') return;
    Promise.resolve(K.user.profiles(ids)).then((ps) => {
      let changed = false;
      ids.forEach((id) => { const n = (ps && ps[id] && ps[id].name) || ''; if (n !== D.names[id]) { D.names[id] = n; changed = true; } });
      if (changed) K.refresh();
    }).catch(() => {});
  }

  /* ---------- live subscriptions ---------- */
  let unsubs = [], subDay = '';
  function dateSubs() {
    unsubs.forEach((u) => u());
    unsubs = [];
    subDay = K.day(0);
    const days = (list) => list.map((n) => K.day(n));
    const coll = (name, list, into) => unsubs.push(K.db.collection(name).where('date', 'in', days(list)).onSnapshot((s) => {
      const m = {};
      s.docs.forEach((x) => { m[x.id] = K.clone(x.data()); });
      D[into] = m;
      K.refresh();
    }, onErr));
    coll('checks', [0, -1, -2, -3], 'checks');
    coll('prep', [0, 1, -1, -2, -3], 'prep');
    coll('orders', [0, -1], 'orders');
    coll('boards', [0, -1], 'boards');
  }
  function onErr(e) { if (e && e.code === 'revoked') { D.revoked = true; K.refresh(); } }
  K.subscribe = function () {
    const db = K.db;
    db.collection('recipes').onSnapshot((s) => {
      const list = [];
      s.docs.forEach((x) => { try { const o = x.data() || {}; o.id = x.id; list.push(K.norm(o)); } catch (e) { /* unreadable row */ } });
      const first = !D.loaded;
      setRecipes(list);
      D.loaded = true;
      K.refresh(first);
    }, (e) => { D.loadErr = e && e.code; D.loaded = true; K.refresh(true); });
    const setting = (name, fn) => db.doc('settings/' + name).onSnapshot((x) => { fn(x.exists ? x.data() : null); K.refresh(); }, onErr);
    setting('branding', (d) => { D.branding = { logo: (d && d.logo) || '', heroes: d && Array.isArray(d.heroes) ? d.heroes.slice() : [], approve: (d && d.approve) || '' }; });
    setting('checklists', (d) => { D.checklists = d ? K.clone(d) : { stations: {} }; });
    setting('staff', (d) => { D.staff = d && Array.isArray(d.people) ? K.clone(d) : { people: [] }; });
    setting('shiftcodes', (d) => { D.codes = d && Array.isArray(d.codes) ? K.clone(d) : { codes: [] }; });
    setting('kitchen', (d) => { D.kitchen = d ? K.clone(d) : null; });
    db.collection('events').onSnapshot((s) => { D.events = s.docs.map((x) => Object.assign(K.clone(x.data()), { id: x.id })); K.refresh(); }, onErr);
    db.collection('schedules').onSnapshot((s) => { const w = {}; s.docs.forEach((x) => { w[x.id] = K.clone(x.data()); }); D.weeks = w; K.refresh(); }, onErr);
    dateSubs();
    /* the kitchen day turns over at 4 am: follow it if the app stays open */
    setInterval(() => { if (K.day(0) !== subDay) { dateSubs(); K.refresh(true); } }, 60000);
  };
  let bugSub = null;
  K.subscribeBugs = function () {
    if (bugSub || !K.me.admin) return;
    bugSub = K.db.collection('bugs').onSnapshot((s) => { D.bugs = s.docs.map((x) => Object.assign(K.clone(x.data()), { id: x.id })); K.refresh(); }, () => {});
  };

  /* clear daily records older than `days` (the shared database has a document cap) */
  K.housekeeping = function (days) {
    const cut = K.day(-days);
    const jobs = ['prep', 'checks', 'orders', 'boards'].map((c) => K.db.collection(c).where('date', '<', cut).get().then((s) => s.docs.map((x) => c + '/' + x.id)));
    return Promise.all(jobs).then((lists) => {
      const paths = [].concat.apply([], lists);
      return paths.reduce((p, path) => p.then(() => K.db.doc(path).delete()), Promise.resolve()).then(() => paths.length);
    });
  };
})();
