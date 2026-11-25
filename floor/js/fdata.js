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
    view: 'tonight', id: null, sheet: null, q: '', foodTab: 'dishes', sect: '', wq: '', colour: '', stockF: '', sq: '',
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
    /* the same list the allergy check works from: the ingredients, the dish's name, the line on the menu, and what was ticked by hand */
    const keys = Object.keys(K.allergenWhere(d));
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
    return { name: t.name || 'Tasting menu', price: t.price || '', note: t.note || '', courses: (t.courses || []).map(K.dish).filter(Boolean),
      /* the wine pairing: its price, the glass poured to start, a wine per course ({id, text}: the list's bottle and the line as printed) */
      pairing: t.pairing || '', pairingName: t.pairingName || 'Wine pairing', welcome: t.welcome || null, wines: t.wines || {}, lines: t.lines || {}, plans: t.plans || {},
      /* what can be added to it, like the caviar */
      extra: t.extra && K.dish(t.extra.dish) ? { dish: K.dish(t.extra.dish), price: t.extra.price || '' } : null };
  };
  /* the tasting menu that comes with the app (house.json), with its courses found among the dishes in the book.
     `find(entry)` gives the id of the dish made from a menu line, or ''. Null when a course is not in the book yet. */
  K.tastingFrom = function (house, find) {
    const t = house && house.tasting, by = {};
    if (!t) return null;
    (house.menu || []).forEach((m) => { by[m.en] = m; });
    const ids = t.courses.map((c) => (by[c.key] ? find(by[c.key]) : '')), wines = {};
    if (ids.some((id) => !id)) return null;
    t.courses.forEach((c, i) => { if (c.wine) wines[ids[i]] = c.wine; });
    /* a course the tasting menu prints with a line of its own (the tartare comes without its bread), or with none */
    const lines = {};
    t.courses.forEach((c, i) => { if (c.line !== undefined) lines[ids[i]] = { en: c.line, bg: c.lineBg || '' }; });
    /* the house's plan for a diet: {vegan: {course id: the dish that stands in, or '' where the kitchen makes its own}} */
    const plans = {};
    Object.keys(t.plans || {}).forEach((k) => { plans[k] = {}; t.plans[k].forEach((x) => { const c = by[x.course] ? find(by[x.course]) : '', dsh = x.dish && by[x.dish] ? find(by[x.dish]) : ''; if (c && (dsh || !x.dish)) plans[k][c] = dsh; }); });
    const extra = t.extra && by[t.extra.key] ? find(by[t.extra.key]) : '';
    return { name: t.name, price: t.price, pairing: t.pairing, pairingName: t.pairingName, note: t.note, bg: t.bg || null, welcome: t.welcome || null, courses: ids, wines: wines, lines: lines, plans: plans, extra: extra ? { dish: extra, price: t.extra.price || '' } : null };
  };
  /* the allergens the printed menu line points to: {key: ['the menu line (горчица)']} */
  K.fromMenu = (src) => String(src).indexOf('the menu line') === 0;
  K.menuAllergens = function (d) {
    const out = {};
    [d.n.menuBg, d.n.menuEn].forEach((line) => String(line || '').split(/,\s*/).map((x) => x.trim()).filter(Boolean)
      .forEach((item) => K.allergensIn(item).forEach((k) => { if (!out[k]) out[k] = ['the menu line (' + item + ')']; })));
    return out;
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
    /* the dish's own name counts too: a “cheese board” has milk even if nobody wrote its ingredients */
    [d.name, d.en].filter(Boolean).forEach((nm) => K.allergensIn(nm).forEach((k) => add(k, 'its name')));
    /* the line printed on the menu counts too: the kitchen's recipe can be a season behind it. What is read off
       that line can be unticked by whoever confirms the dish (`notAl`); what the ingredients show cannot. */
    const menu = K.menuAllergens(d), off = d.n.notAl || [];
    Object.keys(menu).forEach((k) => { if (!off.includes(k)) menu[k].forEach((s) => add(k, s)); });
    ((d.r && d.r.allergens) || []).concat(d.n.allergens || []).forEach((k) => { if (!out[k]) add(k, 'ticked by hand'); });
    return out;
  };
  /* for a guest with these allergies: 'no' (it has one of them), 'ok' (none, and the head chef checked the
     dish's allergens) or 'ask' (none found, but nobody has checked yet: the kitchen confirms) */
  K.allergyVerdict = function (d, sel) {
    const where = K.allergenWhere(d), n = d.n, bread = n.bread ? n.breadAl || [] : [], swap = n.canDiet ? n.canAl || [] : [];
    const hits = [], notes = [];
    let fix = true, unsure = false, byBread = false, bySwap = false;
    const covers = (label, k) => !!label && K.DIETS.indexOf(label) >= K.DIETS.indexOf(k);
    sel.forEach((k) => {
      /* a diet: the dish's label has to be at least as strict; a dish without a label is one to ask about */
      if (K.DIET[k]) {
        if (covers(n.diet, k)) return;
        /* not as it comes, but the kitchen makes it for this diet on request (a salad without its cheese) */
        if (covers(n.canDiet, k)) { bySwap = true; hits.push({ k: k, where: [], swap: true, txt: ': on request' }); }
        else if (!n.diet) {
          /* no label yet: ingredients that plainly have meat, fish, milk or egg already rule the dish out; otherwise it is one to ask about */
          const g = K.dietGuess(d);
          if (g && K.DIETS.indexOf(g) < K.DIETS.indexOf(k)) { fix = false; hits.push({ k: k, where: [], txt: g === 'meat' ? ': has meat' : g === 'pesc' ? ': has fish' : ': has milk, egg or honey' }); }
          else unsure = true;
        }
        else { fix = false; hits.push({ k: k, where: [], txt: n.diet === 'meat' ? ': has meat' : ': the dish is ' + K.DIET[n.diet].toLowerCase() + ' only' }); }
        return;
      }
      /* lactose intolerance is milk, except that a dish whose only dairy is butter is fine */
      const real = k === 'lactose' ? 'milk' : k;
      if (!where[real]) return;
      if (k === 'lactose' && n.butterOnly) { notes.push('The only dairy is butter'); return; }
      const inBread = bread.includes(real), inSwap = !inBread && swap.includes(real);
      if (inBread) byBread = true; else if (inSwap) bySwap = true; else fix = false;
      hits.push({ k: k, where: where[real], bread: inBread, swap: inSwap });
    });
    /* 'mod': everything in the way leaves with the bread, or with the change the kitchen makes on request */
    const state = !hits.length ? (K.dishChecked(d) && !unsure ? 'ok' : 'ask') : fix ? 'mod' : 'no';
    if (state === 'mod') { if (bySwap) notes.unshift(K.canText(n)); if (byBread) notes.unshift('Serve without the bread'); }
    return { state: state, hits: hits, notes: notes };
  };
  /* what to write on the order for a dish made for a stricter diet: “Order it vegan: without the cheese” */
  K.canText = (n) => (n.canDiet ? 'Order it ' + K.DIET[n.canDiet].toLowerCase() + (n.canHow ? ': ' + n.canHow : '') : '');
  /* the allergens that are gone for sure once a dish is made for that diet */
  K.CAN_GONE = { vegan: ['milk', 'eggs', 'fish', 'crustaceans', 'molluscs'], veg: ['fish', 'crustaceans', 'molluscs'], pesc: [] };
  K.alName = (k) => (k === 'lactose' ? 'Lactose' : K.DIET[k] || K.AL[k]);
  /* who can eat a dish, from anyone to the strictest; a dish carries one label (`diet` on its note) */
  K.DIETS = ['meat', 'pesc', 'veg', 'vegan'];
  K.DIET = { meat: 'Meat', pesc: 'Pescatarian', veg: 'Vegetarian', vegan: 'Vegan' };
  const MEAT = /мес[оа]|телешк|говежд|свинск|пилешк|пиле\b|агнешк|патиц|патешк|бекон|шунка|прошуто|наденица|кайма|салам|луканка|пастърма|кост(?!емон)|chicken|beef|pork|lamb|duck|bacon|\bham\b|prosciutto|veal|sausage|chorizo|guanciale|pancetta|salami|bone|foie|gelatin|желатин|колбас|charcuterie|cured meat|фоа гра|бонфиле|tenderloin|wagyu|уагиу|goatling|kid goat|ярешк|яре |яре,|крачета|trotter|сърца|конфи от пат/i;
  const FISH = /риба|сьомга|аншоа|хайвер|октопод|скарид|калмар|миди|fish|salmon|anchov|caviar|octopus|shrimp|prawn|squid|mussel|tuna|тон\b/i;
  /* what the ingredients suggest, for whoever sets the label; never shown to waiters as a fact */
  K.dietGuess = function (d) {
    /* the dish's own names count: “Патешко” says duck even when the menu line only says “leg confit” */
    const txt = [d.name, d.en].concat(d.ings).join(' | ') + ' ', where = K.allergenWhere(d);
    /* an allergen only read off the menu line is a maybe (a “celeriac cream” may have no dairy): it rules nothing out */
    const al = Object.keys(where).filter((k) => where[k].some((x) => !K.fromMenu(x)));
    if (!d.ings.length) return MEAT.test(txt) ? 'meat' : '';
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
      colour: K.COL[w.colour] ? w.colour : 'red', style: w.style || '', label: /no[_-]?image|placeholder/i.test(w.label || '') ? '' : w.label || '', byGlass: !!w.byGlass, glassPrice: w.glassPrice || '', bottlePrice: w.bottlePrice || '',
      glassCl: w.glassCl || '', say: w.say || '', nose: w.nose || '', palate: w.palate || '', story: w.story || '', facts: w.facts || '', serve: w.serve || '', decant: w.decant || '',
      glass: w.glass || '', pairs: Array.isArray(w.pairs) ? w.pairs : [], par: w.par === '' || w.par == null ? 3 : +w.par, order: +w.order || 0, example: !!w.example, updated: w.updated || 0,
      off: !!w.off, measure: w.measure || '', nostock: !!w.nostock,
      /* light, medium or full: how heavy it feels in the mouth */
      body: ['light', 'medium', 'full'].includes(w.body) ? w.body : '',
      /* the same texts in Bulgarian: {say, nose, palate, made, story, facts} */
      bg: w.bg && typeof w.bg === 'object' ? w.bg : {},
      /* the name of this bottle's article in Hype, the till */
      hype: w.hype || '',
      /* the memo for ordering: who delivers it, and how many litres one bottle holds (for products Hype keeps in litres) */
      supplier: w.supplier || '', size: +w.size || 0,
      /* how it is made, and its appellation: said at the table, asked in the quiz */
      made: w.made || '', appellation: w.appellation || '',
      /* a Hype product kept for the stock only: counted and ordered, never shown to guests or in the drinks bible */
      stockOnly: !!w.stockOnly,
      /* found on the shelf during a count and added to it by hand */
      extra: !!w.extra,
      /* where the label sits on a bottle picture from the web: [x %, y %, zoom] */
      focus: Array.isArray(w.focus) && w.focus.length === 3 ? w.focus.map(Number) : null,
    };
  };
  K.suppliers = () => { const o = []; D.wines.forEach((w) => { if (w.supplier && !o.includes(w.supplier)) o.push(w.supplier); }); return o.sort((a, b) => a.localeCompare(b)); };
  K.wine = (id) => D.wines.find((w) => w.id === id) || null;
  K.winesSorted = () => D.wines.slice().sort((a, b) => {
    const o = K.COLOURS.findIndex((c) => c[0] === a.colour) - K.COLOURS.findIndex((c) => c[0] === b.colour);
    return o || (a.order || 999) - (b.order || 999) || a.name.localeCompare(b.name);
  });
  /* the drinks the floor talks about: everything except the stock-only products */
  K.listWines = () => K.winesSorted().filter((w) => !w.stockOnly);
  /* a short, stable id from a Hype name, whatever alphabet it is written in */
  const hash = (t) => { let a = 5381, b = 52711; for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a = (a * 33) ^ c; b = (b * 33) ^ c; } return ((a >>> 0) * 4096 + (b >>> 0)).toString(36); };
  const KIND = [[/бел/i, 'white'], [/червен/i, 'red'], [/розе/i, 'rose'], [/пенлив/i, 'sparkling'], [/десерт/i, 'sweet'], [/вин/i, 'white'], [/бира/i, 'beer'], [/безалкохол|общи/i, 'soft'], [/ликьор|анасон/i, 'liqueur']];
  /* a Hype product that is not on the menu, as a stock-only bottle: made when one turns up on the shelf during a count */
  function looseDoc(r, i, now) {
    const kind = (KIND.find((k) => k[0].test(r.cat)) || [0, 'spirit'])[1];
    return { id: 'hype-' + hash(r.name), doc: { name: r.name, colour: kind, style: r.cat, hype: r.name, stockOnly: true, par: 0, order: 900 + i, byGlass: false, label: '', updated: now || Date.now() } };
  }
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
    if (doc && !Array.isArray(doc.rows) && typeof doc.json === 'string') { try { doc = Object.assign({}, doc, { rows: JSON.parse(doc.json) }); } catch (e) { doc = null; } }
    D.hypeStock = doc && Array.isArray(doc.rows) ? doc : null;
    const idx = {}, list = [];
    ((D.hypeStock && D.hypeStock.rows) || []).forEach((r) => {
      const name = String(r[0] || '').trim(), q = K.parseQty(r[2], r[3]);
      /* drinks only: the kitchen's stock is none of the floor book's business */
      if (!name || q[0] == null || (!D.hypeStock.bar && r[4] && (!DRINKS.test(r[4]) || /топли|hot/i.test(r[4])))) return;
      const row = { name: name, wh: String(r[1] || '').trim(), qty: Math.round(q[0] * 1000) / 1000, unit: q[1], cat: String(r[4] || '').trim() };
      list.push(row);
      /* a product kept in two places: the floor's bottle is the one behind the bar */
      if (!idx[name] || (/^бар$/i.test(row.wh) && !/^бар$/i.test(idx[name].wh))) idx[name] = row;
    });
    D.hypeIdx = idx; D.hypeRows = list;
  };
  /* when Hype exported the numbers: a time in ms, or 0 when the sheet's text is not a date we can read */
  K.hypeTime = function (v) {
    if (typeof v === 'number') return v;
    const t = String(v || '').trim(), m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime();
    /* "2026-11-23 1:18", as the sheet writes it (Sofia time, which is also the phones' time) */
    const y = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2}))?/);
    if (y) return new Date(+y[1], +y[2] - 1, +y[3], +(y[4] || 0), +(y[5] || 0)).getTime();
    const d = Date.parse(t);
    return isNaN(d) ? 0 : d;
  };
  /* "−2.4 L", "5", "0.7 L": a minus that cannot be missed, the unit unless it is pieces */
  K.qtyText = (n, unit) => (n < 0 ? '−' : '') + String(Math.abs(n)) + (unit && unit !== 'pc' ? ' ' + unit : '');
  /* older than this, the numbers are shown with a warning */
  K.HYPE_OLD = 12 * 3600000;
  K.hypeOld = () => { const hs = D.hypeStock, t = hs ? hs.exported || hs.modified : 0; return !!(t && Date.now() - t > K.HYPE_OLD); };
  K.hypeRow = (w) => (w && w.hype && D.hypeIdx && D.hypeIdx[w.hype]) || null;
  /* read the sheet again through its link; whoever runs the floor book also saves it for every other phone */
  K.refreshHype = function () {
    if (!D.hypeUrl) return Promise.reject(new Error('nolink'));
    return fetch(D.hypeUrl, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('http')))).then((j) => {
      if (!j || !Array.isArray(j.rows)) throw new Error('shape');
      const doc = { at: Date.now(), modified: +j.modified || 0, exported: K.hypeTime(j.exported), exportedRaw: String(j.exported || ''), bar: !!j.bar, by: K.myName(), rows: j.rows.map((r) => [String(r[0] || ''), String(r[1] || ''), r[2] == null ? '' : r[2], String(r[3] || ''), String(r[4] || ''), String(r[5] || '')]) };
      K.setHypeStock(doc);
      K.refresh(true);
      /* saved for the other phones. The database takes no list of lists, so the rows travel as one text. */
      if (K.canEdit()) {
        const saved = Object.assign({}, doc, { json: JSON.stringify(doc.rows) });
        delete saved.rows;
        try { K.db.doc('fohsettings/hypestock').set(saved).catch(K.writeFailed); } catch (e) { K.writeFailed(e); }
      }
      return doc;
    });
  };
  K.saveHypeUrl = function (url) { D.hypeUrl = url; return K.db.doc('fohsettings/hype').set({ url: url, updated: Date.now() }).catch(K.writeFailed); };

  /* litres in one bottle, for a product Hype keeps in litres: the memo, else what its Hype name says, else the usual size */
  /* ---------- open bottles of wine: opened for glasses, to be tasted again after three days ---------- */
  const NOTE = ['open', 'ok', 'gone'];   /* moves that only keep track of an open bottle and change no stock */
  K.OPEN_DAYS = 3;
  /* the pours: a glass of wine is 150 ml (five to a bottle, 0.2 of a bottle in Hype), a tasting-pairing pour 80 ml (nine to a bottle) */
  K.GLASS_ML = 150;
  K.PAIR_ML = 80;
  K.glassMl = (w) => (w && +w.glassCl ? Math.round(+w.glassCl * 10) : K.GLASS_ML);
  K.poursIn = (w, ml) => Math.floor((K.bottleL(w) * 1000) / (ml || K.glassMl(w)) + 0.001);
  K.openBottles = function () {
    const open = {}, now = Date.now();
    D.moves.slice().sort((a, b) => a.at - b.at).forEach((m) => {
      if (m.why === 'open') open[m.id] = { id: m.id, w: K.wine(m.w), at: m.at, who: m.name || '', ok: 0 };
      else if (m.ref && open[m.ref]) { if (m.why === 'ok') open[m.ref].ok = m.at; else if (m.why === 'gone' || m.why === 'bin') delete open[m.ref]; }
    });
    return Object.keys(open).map((k) => open[k]).filter((o) => o.w).map((o) => {
      o.days = Math.floor((now - o.at) / 86400000);
      /* from the third day it is tasted every day it stays open */
      o.due = o.days >= K.OPEN_DAYS && now - Math.max(o.ok, 0) > 20 * 3600000;
      return o;
    }).sort((a, b) => a.at - b.at);
  };
  /* one line in the open bottle's story: opened, tasted and fine, finished, or thrown away with what was left in it */
  K.openNote = function (w, why, ref, frac) {
    const id = K.uid(), doc = { w: w.id, n: 0, at: Date.now(), by: myId(), name: K.myName(), why: why };
    if (ref) doc.ref = ref;
    if (frac) doc.frac = frac;
    D.moves = D.moves.concat([Object.assign({ id: id }, doc)]);
    K.refresh(true);
    return K.db.doc('cellarmoves/' + id).set(doc).catch((e) => { D.moves = D.moves.filter((m) => m.id !== id); K.writeFailed(e); });
  };

  K.bottleL = function (w) {
    if (w.size) return w.size;
    const m = String(w.hype || '').match(/(?:^|\s)(0[.,]\d{1,3}|1[.,]\d{1,2}|[1-3])\s?(?:л|l)\b/i);
    if (m) return parseFloat(m[1].replace(',', '.'));
    return ['spirit', 'liqueur'].includes(w.colour) ? 0.7 : w.colour === 'beer' ? 0.33 : 0.75;
  };
  /* Hype's number for a bottle, in bottles */
  K.hypeBottles = (w, qty) => (K.hypeRow(w) && K.hypeRow(w).unit === 'L' ? qty / K.bottleL(w) : qty);
  /* Bottles on the shelf = our own count, minus what Hype has taken off since that count (its sales, glass by glass,
     through its recipes), plus what was entered by hand. Hype's own total is not used: it drifts below zero. */
  K.stockOf = function (id) {
    const c = D.cellar[id], w = K.wine(id), hr = K.hypeRow(w);
    const since = c ? c.at || 0 : 0;
    let n = c ? +c.n || 0 : 0, moved = false;
    D.moves.forEach((m) => { if (m.w === id && m.at > since && !NOTE.includes(m.why)) { n += (+m.n || 0) + (+m.frac || 0); moved = true; } });
    /* never counted: not known. Hype's own total drifts too far to be shown as the stock; it only says what sold since a count. */
    if (!c && (hr || !moved)) return null;
    if (c && hr && c.hq != null) return Math.round((n + K.hypeBottles(w, hr.qty - c.hq)) * 10) / 10;
    return Math.max(0, n);
  };
  /* Hype's own number for a drink, in bottles: a hint for managers, never the stock */
  K.hypeSays = function (w) { const hr = K.hypeRow(w); return hr ? Math.round(K.hypeBottles(w, hr.qty) * 10) / 10 : null; };
  /* what Hype has taken off since the count, in bottles; null when the bottle does not follow Hype */
  K.soldSince = function (w) {
    const c = D.cellar[w.id], hr = K.hypeRow(w);
    return c && hr && c.hq != null ? Math.round(K.hypeBottles(w, c.hq - hr.qty) * 10) / 10 : null;
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
    const txt = st === 'none' ? 'Not counted' : n < 0 ? 'Below zero (' + K.qtyText(n) + '): count it' : st === 'out' ? 'Out · 86' : n + (n === 1 ? ' bottle' : ' bottles');
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
  /* ---------- the physical count: everyone counts the shelves, each bottle is saved the moment it is typed ---------- */
  /* the count that is running, or null. It is one line in the settings: when it started, who started it, when it ended. */
  K.takeOn = () => (D.take && D.take.at && !D.take.done ? D.take : null);
  /* what a count covers: the drinks on the menu, plus the bottles added by hand as they turn up on the shelf.
     The rest of what Hype knows (old products, things never on the menu) is left out. */
  K.takeList = () => K.winesSorted().filter((w) => !w.off && !w.nostock && (!w.stockOnly || w.extra));
  /* Hype products that are not on the count list, for a bottle found on the shelf that the menu does not have */
  K.hypeOffList = function (q) {
    const on = {};
    K.takeList().forEach((w) => { if (w.hype) on[w.hype] = 1; });
    return Object.keys(D.hypeIdx || {}).filter((n) => !on[n] && K.matches(n + ' ' + D.hypeIdx[n].cat, q)).map((n) => D.hypeIdx[n]);
  };
  /* put one Hype product on the count list; gives back the bottle's id */
  K.countExtra = function (r) {
    const have = D.wines.find((w) => w.stockOnly && w.hype === r.name);
    if (have) { K.saveWine(Object.assign({}, have, { extra: true })); return have.id; }
    const x = looseDoc(r, 0);
    K.saveWine(Object.assign({ id: x.id }, x.doc, { extra: true }));
    return x.id;
  };
  K.countedIn = (w, take) => { const c = D.cellar[w.id]; return !!(c && take && c.at >= take.at); };
  /* the weekly count: due on a Monday, or whenever the last one is a week old */
  K.COUNT_DAY = 1;
  K.countDue = function () {
    if (K.takeOn() || !K.takeList().length) return null;
    const last = D.take && D.take.done ? D.take.done : 0, days = last ? Math.floor((Date.now() - last) / 86400000) : null;
    if (days == null) return { never: true };
    return days >= 7 || (new Date().getDay() === K.COUNT_DAY && days >= 4) ? { days: days } : null;
  };
  K.startTake = function () {
    const doc = { at: Date.now(), name: K.myName(), done: 0, hat: (D.hypeStock && (D.hypeStock.exported || D.hypeStock.at)) || 0 };
    D.take = doc;
    K.refresh(true);
    return K.db.doc('fohsettings/stocktake').set(doc).catch(K.writeFailed);
  };
  /* close the count; `zeroRest`: what nobody found is not on the shelf, so it goes to 0 */
  K.endTake = function (zeroRest) {
    const take = K.takeOn();
    if (!take) return Promise.resolve(0);
    const rest = zeroRest ? K.takeList().filter((w) => !K.countedIn(w, take)) : [];
    const writes = rest.map((w) => K.countBottles(w, 0, true, { auto: true }));
    const doc = Object.assign({}, take, { done: Date.now(), endName: K.myName(), zeroed: rest.length });
    D.take = doc;
    K.refresh(true);
    return Promise.all(writes.concat([K.db.doc('fohsettings/stocktake').set(doc).catch(K.writeFailed)])).then(() => rest.length);
  };
  /* `quiet`: no redraw (the count page updates its own row, so the keyboard stays up); `extra`: marks kept with the count */
  K.countBottles = function (w, n, quiet, extra) {
    const prev = D.cellar[w.id], take = K.takeOn();
    const doc = Object.assign({ n: Math.max(0, Math.round(+n * 10) / 10 || 0), at: Date.now(), by: myId(), name: K.myName() }, extra || {});
    /* what the book expected before this check: the difference is what went missing, or turned up.
       Counted a second time in the same stock take, the first expectation stands. */
    const again = !!(prev && take && prev.at >= take.at);
    const was = again ? prev.was : K.stockOf(w.id);
    if (was != null) doc.was = was;
    /* what Hype rang up between the last count and this one, in bottles: the losses are read against it */
    const sold = again ? prev.sold : K.soldSince(w);
    if (sold != null) doc.sold = sold;
    /* what Hype showed at the moment of the count: later sales are measured from here */
    const hr = K.hypeRow(w);
    if (hr) { doc.hq = hr.qty; doc.hat = (D.hypeStock && (D.hypeStock.exported || D.hypeStock.at)) || 0; }
    D.cellar = Object.assign({}, D.cellar, { [w.id]: doc });
    if (!quiet) K.refresh(true);
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
      D.houseV = (m.house && +m.house.v) || 0; D.settingsLoaded = true;
      D.take = m.stocktake || null;
      D.hypeUrl = (m.hype && m.hype.url) || '';
      /* a fresher read made on this phone is not replaced by an older saved one */
      if (m.hypestock && (!D.hypeStock || (m.hypestock.at || 0) >= (D.hypeStock.at || 0))) K.setHypeStock(m.hypestock);
    });
  };
  K.subscribeBugs = function () { /* the kitchen book keeps the problem reports */ };
})();
