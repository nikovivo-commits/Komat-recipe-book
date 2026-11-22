/* The floor book's data: the kitchen's dishes (read from the kitchen book), what the floor says about them,
   the wines, bottles in stock, the quiz and the floor rota. It shares the kitchen's database, so the dishes
   and their allergens are always the kitchen's own. Loaded before cloud.js, which reads the settings below. */
(function () {
  'use strict';
  const K = window.K;
  /* cloud.js: which collections are this book's, who runs it, how waiters join */
  K.APP = 'floor';
  K.BOOK = ['wines', 'dishnotes', 'glossary', 'quizq', 'fohweeks', 'fohsettings', 'cellar', 'cellarmoves', 'quizscores'];
  K.FULL_ROLES = ['manager', 'sous', 'admin', 'owner', 'dev'];
  K.VIEW_ROLES = ['viewer'];
  K.JOIN_ROLE = 'waiter';
  K.CODE_DOC = 'private/floorjoin';

  const D = (K.D = {
    loaded: false, recipesSrc: [], recipes: [], wines: [], winesLoaded: false, notes: {}, gloss: {}, cellar: {}, moves: [],
    quizq: [], scores: [], weeks: {}, staff: { people: [] }, codes: null,
    branding: { logo: 'assets/brand/logo.png', heroes: [], pages: {} }, members: {}, names: {}, noWrite: false,
  });
  K.ui = {
    view: 'food', id: null, sheet: null, q: '', foodTab: 'dishes', sect: '', wq: '', colour: '', stockF: '', sq: '',
    schedView: '', week: '', quiz: null, board: 'week',
  };
  K.V = K.V || {};
  K.SHEETS = K.SHEETS || {};

  /* ---------- the kitchen's dishes ---------- */
  function normComp(c) {
    c = c || {};
    return { cid: c.cid || '', name: c.name || 'Part', ingredients: Array.isArray(c.ingredients) ? c.ingredients : [], from: c.from || '' };
  }
  function norm(r) {
    const comps = Array.isArray(r.components) ? r.components.map(normComp) : [];
    return {
      id: r.id, name: r.name || 'Untitled', aka: r.aka || '', category: r.category || '', photo: r.photo || '',
      gallery: Array.isArray(r.gallery) ? r.gallery.filter((g) => g && g.id) : [], ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      allergens: Array.isArray(r.allergens) ? r.allergens : [], allergensChecked: !!r.allergensChecked, onMenu: r.onMenu !== false, components: comps,
      services: Array.isArray(r.services) ? r.services : [], plating: r.plating || '',
      type: r.type === 'dish' || r.type === 'recipe' ? r.type : comps.length ? 'dish' : 'recipe',
    };
  }
  /* a part made from another recipe shows that recipe's ingredients */
  function linkParts(all) {
    all.forEach((r) => r.components.forEach((c) => {
      const s = c.from && c.from !== r.id ? all.find((x) => x.id === c.from) : null;
      if (s) c.ingredients = s.ingredients.slice();
    }));
    return all;
  }
  const TR = window.KOMAT_TR || {};
  const CYR = /[Ѐ-ӿ]/;
  /* English for a Bulgarian name, from the kitchen's translation list ('' when there is none yet) */
  K.en = (s) => { s = String(s || ''); if (!CYR.test(s)) return ''; return TR[s] || TR[s.trim()] || TR[s.trim().toLowerCase()] || ''; };
  K.find = (id) => D.recipes.find((r) => r.id === id) || null;
  K.kitchenLink = (id) => '../#r.' + id;

  /* ---------- the food bible ---------- */
  /* every dish the floor talks about: the kitchen's dishes on the menu, anything the floor has notes for, and
     dishes the floor added by hand (bread, the amuse-bouche). Hidden ones only show for managers. */
  K.dishes = function (withHidden) {
    const out = [], seen = {};
    D.recipes.forEach((r) => {
      const n = D.notes[r.id];
      if (!(n || (r.type === 'dish' && r.onMenu))) return;
      if (n && n.hide && !withHidden) return;
      seen[r.id] = 1;
      out.push(dishOf(r, n || {}));
    });
    Object.keys(D.notes).forEach((id) => {
      const n = D.notes[id];
      if (seen[id] || (n.recipe && K.find(n.recipe)) || (n.hide && !withHidden)) return;
      if (!n.name) return;
      out.push(dishOf(null, Object.assign({ id: id }, n)));
    });
    return out.sort((a, b) => ((a.order || 999) - (b.order || 999)) || a.name.localeCompare(b.name));
  };
  function dishOf(r, n) {
    /* the floor can show a kitchen dish under the name printed on the menu */
    const kname = (r && r.name) || '', name = (r && n.menuName) || kname || n.name || 'Dish';
    const ings = [];
    if (r) {
      r.ingredients.forEach((i) => ings.push(i.n));
      r.components.forEach((c) => c.ingredients.forEach((i) => ings.push(i.n)));
    }
    (n.ings || []).forEach((x) => ings.push(x));
    return {
      id: r ? r.id : n.id, r: r, n: n, name: name, kname: kname, en: n.en || K.en(name) || K.en(kname),
      section: n.section || (r && r.category) || 'Dishes', price: n.price || '', order: +n.order || 0, hide: !!n.hide, onMenu: r ? r.onMenu : n.onMenu !== false,
      ings: uniq(ings), parts: r ? r.components.map((c) => c.name) : [], photo: (r && (r.photo || (r.gallery[0] && r.gallery[0].id))) || n.photo || '',
      example: !!n.example,
    };
  }
  const uniq = (l) => { const s = {}, o = []; l.forEach((x) => { const k = K.normName(x); if (k && !s[k]) { s[k] = 1; o.push(x); } }); return o; };
  K.dish = (id) => K.dishes(true).find((d) => d.id === id) || null;
  K.dishAllergens = function (d) {
    const found = K.detectAllergens ? K.detectAllergens([d.ings.map((n) => ({ n: n }))]) : {};
    const keys = Object.keys(found).concat((d.r && d.r.allergens) || [], d.n.allergens || []);
    return { keys: K.orderAl ? K.orderAl(keys) : keys, found: found, checked: K.dishChecked(d) };
  };
  /* someone with the right to has gone through the dish's allergens and confirmed them */
  K.dishChecked = (d) => !!(d.r ? d.r.allergensChecked : d.n.checked);
  /* kitchen dishes are confirmed by the chefs and the owner; the floor's own dishes by whoever runs the floor book */
  K.canCheck = (d) => (d.r ? K.mode !== 'firebase' || ['sous', 'admin', 'owner', 'dev'].includes(K.me.role) : !!(K.me && K.me.admin));
  /* confirm a dish's allergens: `extra` are the ones ticked by hand on top of those found in the ingredients */
  K.confirmAllergens = function (d, extra) {
    if (!d.r) return K.saveNote(d.id, { allergens: extra, checked: true });
    const src = D.recipes.find((r) => r.id === d.r.id);
    if (src) { src.allergens = extra.slice(); src.allergensChecked = true; }
    K.refresh(true);
    return K.db.doc('recipes/' + d.r.id).update({ allergens: extra, allergensChecked: true, updated: Date.now() }).catch(K.writeFailed);
  };
  /* the tasting menu: its courses, in order */
  K.tasting = function () {
    const t = D.tasting || {};
    return { name: t.name || 'Tasting menu', price: t.price || '', note: t.note || '', courses: (t.courses || []).map(K.dish).filter(Boolean) };
  };
  /* where each allergen in a dish comes from: {key: ['Hollandaise: butter', ...]} */
  K.allergenWhere = function (d) {
    const out = {}, add = (k, s) => { (out[k] = out[k] || []); if (!out[k].includes(s)) out[k].push(s); };
    const scan = (part, list) => (list || []).forEach((i) => { const n = (i && i.n) || i; K.allergensIn(n).forEach((k) => add(k, (part ? part + ': ' : '') + String(n).split(/[(]/)[0].trim())); });
    if (d.r) {
      /* a main ingredient that is one of the dish's parts is explained by that part */
      const parts = d.r.components.map((c) => K.normName(c.name));
      scan('', d.r.ingredients.filter((i) => !parts.includes(K.normName(i.n))));
      d.r.components.forEach((c) => scan(c.name, c.ingredients));
    }
    scan('', (d.n.ings || []).map((x) => ({ n: x })));
    ((d.r && d.r.allergens) || []).concat(d.n.allergens || []).forEach((k) => { if (!out[k]) add(k, 'ticked by hand'); });
    return out;
  };
  /* for a guest with these allergies: 'no' (it has one of them), 'ok' (none, and the head chef checked the
     dish's allergens) or 'ask' (none found, but nobody has checked yet: the kitchen confirms) */
  K.allergyVerdict = function (d, sel) {
    const where = K.allergenWhere(d), n = d.n, bread = n.bread ? n.breadAl || [] : [];
    const hits = [], notes = [];
    let fix = true, unsure = false;
    sel.forEach((k) => {
      /* a diet: the dish's label has to be at least as strict; a dish without a label is one to ask about */
      if (K.DIET[k]) {
        if (!n.diet) unsure = true;
        else if (K.DIETS.indexOf(n.diet) < K.DIETS.indexOf(k)) { fix = false; hits.push({ k: k, where: [], txt: n.diet === 'meat' ? ': has meat' : ': the dish is ' + K.DIET[n.diet].toLowerCase() + ' only' }); }
        return;
      }
      /* lactose intolerance is milk, except that a dish whose only dairy is butter is fine */
      const real = k === 'lactose' ? 'milk' : k;
      if (!where[real]) return;
      if (k === 'lactose' && n.butterOnly) { notes.push('The only dairy is butter'); return; }
      const inBread = bread.includes(real);
      if (!inBread) fix = false;
      hits.push({ k: k, where: where[real], bread: inBread });
    });
    /* 'mod': everything in the way is only in the bread, and the dish can be served without it */
    const state = !hits.length ? (K.dishChecked(d) && !unsure ? 'ok' : 'ask') : fix ? 'mod' : 'no';
    if (state === 'mod') notes.unshift('Serve without the bread');
    return { state: state, hits: hits, notes: notes };
  };
  K.alName = (k) => (k === 'lactose' ? 'Lactose' : K.DIET[k] || K.AL[k]);
  /* who can eat a dish, from anyone to the strictest; a dish carries one label (`diet` on its note) */
  K.DIETS = ['meat', 'pesc', 'veg', 'vegan'];
  K.DIET = { meat: 'Meat', pesc: 'Pescatarian', veg: 'Vegetarian', vegan: 'Vegan' };
  const MEAT = /мес[оа]|телешк|говежд|свинск|пилешк|пиле\b|агнешк|патиц|патешк|бекон|шунка|прошуто|наденица|кайма|салам|луканка|пастърма|кост|chicken|beef|pork|lamb|duck|bacon|\bham\b|prosciutto|veal|sausage|chorizo|guanciale|pancetta|salami|bone|foie|gelatin|желатин/i;
  const FISH = /риба|сьомга|аншоа|хайвер|октопод|скарид|калмар|миди|fish|salmon|anchov|caviar|octopus|shrimp|prawn|squid|mussel|tuna|тон\b/i;
  /* what the ingredients suggest, for whoever sets the label; never shown to waiters as a fact */
  K.dietGuess = function (d) {
    const txt = d.ings.join(' | '), al = Object.keys(K.allergenWhere(d));
    if (!d.ings.length) return '';
    if (MEAT.test(txt)) return 'meat';
    if (FISH.test(txt) || al.some((k) => ['fish', 'crustaceans', 'molluscs'].includes(k))) return 'pesc';
    if (al.includes('milk') || al.includes('eggs') || /\bмед\b|honey/i.test(txt)) return 'veg';
    return 'vegan';
  };
  /* an illustration from the kitchen book for a dish without a photo */
  K.dishArt = (d) => (d && d.r && !d.photo && (window.KOMAT_ART || []).includes(d.r.id) ? 'assets/photos/art/' + d.r.id + '.jpg' : '');

  /* ingredients a guest asks about: everything in the dishes, minus salt, water and the like */
  const SKIP = /^(сол|вода|лед|пипер|черен пипер|бял пипер|захар|олио|salt|water|ice|pepper|black pepper|sugar|oil|sunflower oil)$/;
  const ingKey = (n) => K.normName(String(n || '').split(/[,(]/)[0].replace(/[0-9%.]+/g, ' '));
  K.ingKey = ingKey;
  /* the picture that goes with an explained ingredient, '' when there is none */
  let ART = null;
  K.ingArt = function (key) {
    if (!ART) { ART = {}; const m = window.KOMAT_ING_ART || {}; Object.keys(m).forEach((n) => { ART[ingKey(n)] = m[n]; }); }
    return ART[key] ? 'floor/art/' + ART[key] + '.jpg' : '';
  };
  K.ingredients = function () {
    const m = {};
    K.dishes().forEach((d) => {
      d.ings.forEach((n) => {
        const k = ingKey(n);
        if (!k || SKIP.test(k)) return;
        const e = m[k] || (m[k] = { key: k, name: String(n).split(/[,(]/)[0].trim(), dishes: [] });
        if (!e.dishes.includes(d)) e.dishes.push(d);
      });
      (d.n.niche || []).forEach((x) => {
        const k = ingKey(x.n);
        if (!k) return;
        const e = m[k] || (m[k] = { key: k, name: x.n, dishes: [] });
        if (!e.dishes.includes(d)) e.dishes.push(d);
        if (x.what && !e.niche) e.niche = x.what;
      });
    });
    Object.keys(D.gloss).forEach((id) => { const g = D.gloss[id], k = g.key || id; if (!m[k] && g.name) m[k] = { key: k, name: g.name, dishes: [] }; });
    return Object.keys(m).map((k) => {
      const e = m[k], g = D.gloss[K.safeId(k)] || {};
      e.g = g; e.en = g.en || K.en(e.name); e.what = g.what || e.niche || '';
      return e;
    }).sort((a, b) => a.name.localeCompare(b.name));
  };

  /* ---------- wines ---------- */
  K.COLOURS = [['red', 'Red'], ['white', 'White'], ['rose', 'Rosé'], ['orange', 'Orange'], ['sparkling', 'Sparkling'], ['sweet', 'Sweet'],
    /* the rest of the drinks list is kept the same way as the wines: a label, a price, bottles in stock */
    ['spirit', 'Spirits'], ['liqueur', 'Liqueurs & digestifs'], ['beer', 'Beer'], ['soft', 'Soft drinks'], ['hot', 'Hot drinks']];
  K.DRINK_KINDS = ['spirit', 'liqueur', 'beer', 'soft', 'hot'];
  K.isDrink = (w) => K.DRINK_KINDS.includes(w.colour);
  K.COL = {}; K.COLOURS.forEach((c) => { K.COL[c[0]] = c[1]; });
  K.normWine = function (w) {
    return {
      id: w.id, name: w.name || 'Wine', producer: w.producer || '', country: w.country || '', region: w.region || '', grapes: w.grapes || '', vintage: w.vintage || '',
      colour: K.COL[w.colour] ? w.colour : 'red', style: w.style || '', label: w.label || '', byGlass: !!w.byGlass, glassPrice: w.glassPrice || '', bottlePrice: w.bottlePrice || '',
      glassCl: w.glassCl || '', say: w.say || '', nose: w.nose || '', palate: w.palate || '', story: w.story || '', facts: w.facts || '', serve: w.serve || '', decant: w.decant || '',
      glass: w.glass || '', pairs: Array.isArray(w.pairs) ? w.pairs : [], par: w.par === '' || w.par == null ? 3 : +w.par, order: +w.order || 0, example: !!w.example, updated: w.updated || 0,
      off: !!w.off, measure: w.measure || '', nostock: !!w.nostock,
      /* the name of this bottle's article in Hype, the till */
      hype: w.hype || '',
      /* where the label sits on a bottle picture from the web: [x %, y %, zoom] */
      focus: Array.isArray(w.focus) && w.focus.length === 3 ? w.focus.map(Number) : null,
    };
  };
  K.wine = (id) => D.wines.find((w) => w.id === id) || null;
  K.winesSorted = () => D.wines.slice().sort((a, b) => {
    const o = K.COLOURS.findIndex((c) => c[0] === a.colour) - K.COLOURS.findIndex((c) => c[0] === b.colour);
    return o || (a.order || 999) - (b.order || 999) || a.name.localeCompare(b.name);
  });
  K.wineTitle = (w) => [w.producer, w.name].filter(Boolean).join(' ') + (w.vintage ? ' ' + w.vintage : '');
  K.price = (p) => { const s = String(p || '').trim(); return !s ? '' : /^[\d.,]+$/.test(s) ? s.replace('.', ',') + ' €' : s; };

  /* ---------- bottles: the last count plus every bottle in or out since ---------- */
  /* ---------- Hype, the till: its stock sheet is the source for every bottle paired with a Hype product ---------- */
  const UNIT = { 'бр': 'pc', 'бр.': 'pc', pc: 'pc', pcs: 'pc', 'кг': 'kg', 'кг.': 'kg', kg: 'kg', 'л': 'L', 'л.': 'L', l: 'L' };
  /* "7.280 бр." -> [7.28, 'pc']; a plain number keeps the unit given beside it */
  K.parseQty = function (v, unit) {
    const t = String(v == null ? '' : v).trim().replace(/\u00a0/g, ' ');
    const m = t.match(/^(-?[\d.,\s]*\d)\s*([^\d\s].*)?$/);
    if (!m) return [null, UNIT[String(unit || '').trim().toLowerCase()] || String(unit || '').trim()];
    let n = m[1].replace(/\s/g, '');
    n = n.includes(',') && n.includes('.') ? (n.lastIndexOf(',') > n.lastIndexOf('.') ? n.replace(/\./g, '').replace(',', '.') : n.replace(/,/g, '')) : n.replace(',', '.');
    const u = String(m[2] || unit || '').trim().toLowerCase();
    return [parseFloat(n), UNIT[u] || UNIT[u.replace(/\.$/, '')] || String(m[2] || unit || '').trim()];
  };
  /* rows as the sheet gives them: [name, warehouse, quantity, unit, category, barcode] */
  const DRINKS = /вин|алкохол|бира|раки|уиски|джин|водка|коняк|бренди|ром|ликьор|анасон|напитк|wine|beer|spirit|drink/i;
  K.setHypeStock = function (doc) {
    D.hypeStock = doc && Array.isArray(doc.rows) ? doc : null;
    const idx = {};
    ((D.hypeStock && D.hypeStock.rows) || []).forEach((r) => {
      const name = String(r[0] || '').trim(), q = K.parseQty(r[2], r[3]);
      /* drinks only: the kitchen's stock is none of the floor book's business */
      if (!name || q[0] == null || (r[4] && (!DRINKS.test(r[4]) || /топли|hot/i.test(r[4])))) return;
      const e = idx[name] || (idx[name] = { name: name, qty: 0, unit: q[1], cat: r[4] || '', wh: [] });
      e.qty += q[0]; if (r[1] && !e.wh.includes(r[1])) e.wh.push(r[1]);
    });
    D.hypeIdx = idx;
  };
  K.hypeRow = (w) => (w && w.hype && D.hypeIdx && D.hypeIdx[w.hype]) || null;
  /* read the sheet again through its link; whoever runs the floor book also saves it for every other phone */
  K.refreshHype = function () {
    if (!D.hypeUrl) return Promise.reject(new Error('nolink'));
    return fetch(D.hypeUrl, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('http')))).then((j) => {
      if (!j || !Array.isArray(j.rows)) throw new Error('shape');
      const doc = { at: Date.now(), modified: +j.modified || 0, by: K.myName(), rows: j.rows.map((r) => [String(r[0] || ''), String(r[1] || ''), r[2] == null ? '' : r[2], String(r[3] || ''), String(r[4] || ''), String(r[5] || '')]) };
      K.setHypeStock(doc);
      K.refresh(true);
      if (K.canEdit()) K.db.doc('fohsettings/hypestock').set(doc).catch(K.writeFailed);
      return doc;
    });
  };
  K.saveHypeUrl = function (url) { D.hypeUrl = url; return K.db.doc('fohsettings/hype').set({ url: url, updated: Date.now() }).catch(K.writeFailed); };

  K.stockOf = function (id) {
    const hr = K.hypeRow(K.wine(id));
    if (hr) return Math.max(0, Math.round(hr.qty * 100) / 100);
    const c = D.cellar[id];
    const since = c ? c.at || 0 : 0;
    let n = c ? +c.n || 0 : 0, moved = false;
    D.moves.forEach((m) => { if (m.w === id && m.at > since) { n += +m.n || 0; moved = true; } });
    if (!c && !moved) return null;
    return Math.max(0, n);
  };
  /* 'out', 'low', 'ok', or 'none' when nobody has counted it yet */
  K.stockState = function (w) {
    const n = K.stockOf(w.id);
    if (n == null) return 'none';
    if (n <= 0) return 'out';
    return n <= (w.par || 0) ? 'low' : 'ok';
  };
  K.stockBadge = function (w, big) {
    const st = K.stockState(w), n = K.stockOf(w.id), h = K.h;
    const hr = K.hypeRow(w), unit = hr && hr.unit !== 'pc' ? hr.unit : '';
    const txt = st === 'none' ? 'Not counted' : st === 'out' ? 'Out · 86' : unit ? n + ' ' + unit : n + (n === 1 ? ' bottle' : ' bottles');
    return h('span', { class: 'stk stk-' + st + (big ? ' big' : '') }, h('span', { class: 'stk-dot', 'aria-hidden': 'true' }), txt);
  };
  const myId = () => (K.me && K.me.id) || 'this-phone';
  K.myName = () => (K.me && K.me.name) || K.store.get('fohName', '') || '';
  K.moveBottles = function (w, n, why) {
    const id = K.uid(), doc = { w: w.id, n: n, at: Date.now(), by: myId(), name: K.myName(), why: why || (n < 0 ? 'sold' : 'in') };
    D.moves = D.moves.concat([Object.assign({ id: id }, doc)]);
    K.refresh(true);
    K.db.doc('cellarmoves/' + id).set(doc).catch((e) => { D.moves = D.moves.filter((m) => m.id !== id); K.writeFailed(e); });
    const left = K.stockOf(w.id);
    const what = why === 'glass' ? 'Opened for glasses' : n < 0 ? (n === -1 ? 'One bottle sold' : -n + ' bottles out') : n + (n === 1 ? ' bottle in' : ' bottles in');
    K.toast(what + ': ' + w.name + (left != null ? ' · ' + left + ' left' : ''), { undo: () => {
      D.moves = D.moves.filter((m) => m.id !== id);
      K.refresh(true);
      K.db.doc('cellarmoves/' + id).delete().catch(K.writeFailed);
    } });
  };
  K.countBottles = function (w, n) {
    const doc = { n: Math.max(0, Math.round(+n * 10) / 10 || 0), at: Date.now(), by: myId(), name: K.myName() };
    D.cellar = Object.assign({}, D.cellar, { [w.id]: doc });
    K.refresh(true);
    return K.db.doc('cellar/' + w.id).set(doc).catch(K.writeFailed);
  };

  /* ---------- saving the bibles (managers) ---------- */
  K.saveWine = function (w) {
    const id = w.id || K.safeId(K.normName([w.producer, w.name, w.vintage].join(' ')).replace(/ /g, '-')) || K.uid();
    const doc = Object.assign({}, w, { updated: Date.now() });
    delete doc.id;
    Object.keys(doc).forEach((k) => { if (doc[k] === undefined) delete doc[k]; });
    const i = D.wines.findIndex((x) => x.id === id), nw = K.normWine(Object.assign({ id: id }, doc));
    D.wines = i >= 0 ? D.wines.map((x) => (x.id === id ? nw : x)) : D.wines.concat([nw]);
    K.refresh(true);
    return K.db.doc('wines/' + id).set(doc).then(() => id, (e) => { K.writeFailed(e); return id; });
  };
  K.deleteWine = function (id) {
    D.wines = D.wines.filter((w) => w.id !== id);
    K.refresh(true);
    return K.db.doc('wines/' + id).delete().catch(K.writeFailed);
  };
  K.saveNote = function (id, patch) {
    const next = Object.assign({}, D.notes[id] || {}, patch, { updated: Date.now() });
    Object.keys(next).forEach((k) => { if (next[k] === undefined) delete next[k]; });
    D.notes = Object.assign({}, D.notes, { [id]: next });
    K.refresh(true);
    return K.db.doc('dishnotes/' + id).set(next).catch(K.writeFailed);
  };
  K.deleteNote = function (id) {
    const n = Object.assign({}, D.notes); delete n[id]; D.notes = n;
    K.refresh(true);
    return K.db.doc('dishnotes/' + id).delete().catch(K.writeFailed);
  };
  K.saveGloss = function (key, patch) {
    const id = K.safeId(key), next = Object.assign({ key: key }, D.gloss[id] || {}, patch, { updated: Date.now() });
    D.gloss = Object.assign({}, D.gloss, { [id]: next });
    K.refresh(true);
    return K.db.doc('glossary/' + id).set(next).catch(K.writeFailed);
  };
  K.saveSetting = function (name, data) {
    if (name === 'staff') D.staff = data;
    if (name === 'codes') D.codes = data;
    if (name === 'tasting') D.tasting = data;
    K.refresh(true);
    return K.db.doc('fohsettings/' + name).set(data).catch(K.writeFailed);
  };
  K.saveWeek = function (wk, doc) {
    D.weeks = Object.assign({}, D.weeks, { [wk]: doc });
    K.refresh(true);
    return K.db.doc('fohweeks/' + wk).set(doc).catch(K.writeFailed);
  };

  /* ---------- write errors ---------- */
  K.writeFailed = function (e) {
    if (e && e.code === 'viewer') { K.toast('View only: you can look around, nothing is changed.'); K.refresh(true); return; }
    if (e && e.code === 'invalid_argument') { K.toast('Not saved: this needs a floor manager, or the new database rules are not published yet.', { tone: 'bad' }); K.refresh(true); }
    else if (e && e.code === 'quota_exceeded') K.toast('The database is full for today. Try again tomorrow.', { tone: 'bad' });
    else K.toast('Not saved. Check your connection and try again.', { tone: 'bad' });
  };

  /* ---------- live data ---------- */
  K.subscribe = function () {
    const db = K.db;
    const list = (coll, fn, q) => (q || db.collection(coll)).onSnapshot((s) => { fn(s.docs.map((x) => Object.assign(K.clone(x.data() || {}), { id: x.id }))); K.refresh(); }, (e) => { D.denied = D.denied || (e && e.code === 'invalid_argument'); K.refresh(); });
    const byId = (l) => { const m = {}; l.forEach((x) => { m[x.id] = x; }); return m; };
    db.collection('recipes').onSnapshot((s) => {
      const l = [];
      s.docs.forEach((x) => { try { l.push(norm(Object.assign({}, x.data() || {}, { id: x.id }))); } catch (e) { /* unreadable row */ } });
      D.recipesSrc = l; D.recipes = linkParts(l.map((r) => K.clone(r)));
      const first = !D.loaded; D.loaded = true;
      K.refresh(first);
    }, () => { D.loaded = true; K.refresh(); });
    list('wines', (l) => { D.wines = l.map(K.normWine); D.winesLoaded = true; });
    list('dishnotes', (l) => { D.notes = byId(l); });
    list('glossary', (l) => { D.gloss = byId(l); });
    list('cellar', (l) => { D.cellar = byId(l); });
    /* bottles in and out from the last three months (a count resets what came before) */
    list('cellarmoves', (l) => { D.moves = l; }, db.collection('cellarmoves').where('at', '>=', Date.now() - 92 * 86400000));
    list('quizq', (l) => { D.quizq = l; });
    list('quizscores', (l) => { D.scores = l; });
    list('fohweeks', (l) => { D.weeks = byId(l); });
    list('fohsettings', (l) => {
      const m = byId(l);
      D.staff = m.staff && Array.isArray(m.staff.people) ? m.staff : { people: [] };
      D.codes = m.codes && Array.isArray(m.codes.codes) ? m.codes : null;
      D.tasting = m.tasting || null;
      D.hypeUrl = (m.hype && m.hype.url) || '';
      /* a fresher read made on this phone is not replaced by an older saved one */
      if (m.hypestock && (!D.hypeStock || (m.hypestock.at || 0) >= (D.hypeStock.at || 0))) K.setHypeStock(m.hypestock);
    });
  };
  K.subscribeBugs = function () { /* the kitchen book keeps the problem reports */ };
})();
