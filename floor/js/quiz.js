/* The quiz: ten questions on the wines, the food or both, made from what is in the bibles (grapes, regions,
   labels, prices, pairings, translations, allergens, the unusual ingredients) plus the floor manager's own
   questions and some general service knowledge. Quick answers score more; the board shows who knows best. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const SECONDS = 20, ROUND = 10;
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const pickN = (a, n) => shuffle(a).slice(0, n);
  const lines = (t) => String(t || '').split(/\n+/).map((x) => x.replace(/^[-•·*]\s*/, '').trim()).filter(Boolean);
  const short = (t, n) => { t = String(t || '').trim(); return t.length > (n || 90) ? t.slice(0, (n || 90) - 1).replace(/\s+\S*$/, '') + '…' : t; };

  const GRAPES = ['Mavrud', 'Rubin', 'Gamza', 'Pamid', 'Dimyat', 'Misket Cherven', 'Tamyanka', 'Shiroka Melnishka Loza', 'Cabernet Sauvignon', 'Merlot', 'Syrah', 'Pinot Noir', 'Chardonnay', 'Sauvignon Blanc', 'Riesling', 'Tempranillo', 'Sangiovese', 'Nebbiolo'];
  const REGIONS = ['Thracian Valley', 'Danube Plain', 'Struma Valley', 'Black Sea coast', 'Rose Valley', 'Bordeaux', 'Rioja', 'Tuscany', 'Mosel', 'Burgundy', 'Piedmont'];
  const TEMPS = ['6–8 °C', '8–10 °C', '10–12 °C', '12–14 °C', '14–16 °C', '16–18 °C', '18–20 °C'];
  /* general floor knowledge: [question, answer, three wrong answers, why] */
  const BANK = {
    wine: [
      ['Which Bulgarian grape was bred from Nebbiolo and Syrah?', 'Rubin', ['Mavrud', 'Gamza', 'Dimyat'], 'Rubin was created in Bulgaria in the 1940s by crossing Nebbiolo with Syrah.'],
      ['Tamyanka belongs to which family of grapes?', 'Muscat', ['Riesling', 'Pinot', 'Cabernet'], 'Tamyanka is the Bulgarian name for Muscat Blanc à Petits Grains; “tamyan” means incense.'],
      ['What does NV on a label mean?', 'Non-vintage: a blend of several years', ['New vine', 'No added sulphites', 'Natural wine'], 'Most sparkling wines are blended from several harvests to keep the house style the same.'],
      ['Why do we decant an older red?', 'To leave the sediment behind in the bottle', ['To cool it down', 'To add bubbles', 'To make it sweeter'], 'Old reds throw a sediment; decanting also lets a young wine breathe.'],
      ['Who tastes the wine first when a bottle is opened?', 'The guest who ordered it', ['The oldest guest', 'The waiter', 'Whoever sits on the right'], 'They check it is sound, not whether they like it.'],
      ['A wine smells of wet cardboard and a damp cellar. It is…', 'Corked (TCA)', ['Oaked', 'Too cold', 'Natural'], 'Cork taint (TCA) flattens the fruit and smells musty. Offer a new bottle.'],
      ['At what temperature do we serve a light red, like Gamay or a young Pinot Noir?', '12–14 °C', ['6–8 °C', '16–18 °C', '20–22 °C'], 'A light red is served the coolest of the reds, almost like a white.'],
      ['At what temperature do we serve a medium-bodied red, like Merlot or Sangiovese?', '14–16 °C', ['8–10 °C', '18–20 °C', '22–24 °C'], 'Between the light reds (12–14 °C) and the full ones (16–18 °C).'],
      ['At what temperature do we serve a full, tannic red, like Mavrud, Bordeaux or Barolo?', '16–18 °C', ['10–12 °C', '12–14 °C', '22–24 °C'], 'The warmest of the reds, and still below the temperature of the room.'],
      ['A red wine at today’s room temperature (22–24 °C) is…', 'Too warm: the alcohol takes over', ['Just right for any red', 'Too cold: its aromas hide', 'Right only for old wines'], 'Red wine is served at 12–18 °C, depending on its body. A warm bottle gets a few minutes in the cooler.'],
      ['What happens to a red wine that is served too cold?', 'Its aromas hide and the tannins feel harder', ['It tastes sweeter', 'The alcohol takes over', 'It loses its colour'], 'Too warm, the alcohol takes over; too cold, the wine closes up.'],
      ['Which red do we serve coolest?', 'A light one, like Gamza or Gamay', ['A full one, like Mavrud', 'An old Barolo', 'They are all served the same'], 'Light reds 12–14 °C, medium 14–16 °C, full and tannic 16–18 °C.'],
      ['At what temperature do we serve most sparkling wine?', '6–8 °C', ['12–14 °C', '16–18 °C', 'Room temperature'], 'Well chilled keeps the bubbles fine and the wine fresh.'],
      ['Which grape grows around Melnik in the Struma Valley?', 'Shiroka Melnishka Loza', ['Mavrud', 'Dimyat', 'Pamid'], 'The Broad-leaved Melnik vine ripens late in the warm south-west of Bulgaria.'],
      ['How does Champagne get its bubbles?', 'A second fermentation in the bottle', ['Gas added before corking', 'Shaking the barrels', 'Freezing the grapes'], 'The traditional method: yeast and sugar go into the bottle and make the bubbles there.'],
      ['Most of the tannin in a red wine comes from…', 'The grape skins and seeds', ['The sugar', 'The water', 'The bubbles'], 'Red wine ferments with its skins; oak barrels add a little more.'],
      ['How full do we pour a glass of still wine?', 'About a third, to the widest part', ['To the brim', 'Half', 'Just a splash'], 'Room in the glass lets the guest swirl and smell the wine.'],
      ['Misket Cherven has pink skins. What colour is its wine?', 'White', ['Red', 'Rosé', 'Orange'], 'The juice is clear and the skins come off early, so Red Misket makes an aromatic white.'],
      ['Gamza is known in Hungary as…', 'Kadarka', ['Furmint', 'Tokaji', 'Kékfrankos'], 'The same grape, a light, fresh red from the Danube plain in Bulgaria.'],
      ['Which Bulgarian red is famous around Asenovgrad and Plovdiv?', 'Mavrud', ['Gamza', 'Dimyat', 'Misket Cherven'], 'Mavrud is the dark, tannic red of the Thracian Valley.'],
      ['How much wine goes in a glass?', '150 ml', ['100 ml', '125 ml', '200 ml'], 'A glass is 150 ml: five glasses to a bottle.'],
      ['How much of each wine do we pour for the tasting pairing?', 'About 80 ml', ['About 50 ml', 'About 120 ml', '150 ml, a full glass'], 'A pairing pour is about 80 ml: nine pours to a bottle.'],
      ['How many glasses does one bottle of wine give?', 'Five', ['Four', 'Six', 'Seven'], 'A bottle is 750 ml and a glass is 150 ml.'],
      ['How many tasting-pairing pours does one bottle give?', 'Nine', ['Five', 'Seven', 'Twelve'], 'A bottle is 750 ml and a pairing pour is about 80 ml.'],
      ['From which side do we pour a guest’s wine?', 'From their right', ['From their left', 'From behind', 'From across the table'], 'Drinks are served from the right, where the glasses stand.'],
    ],
    food: [
      ['How many allergens must a menu in the EU declare?', '14', ['8', '10', '20'], 'The EU 14: gluten, crustaceans, eggs, fish, peanuts, soy, milk, nuts, celery, mustard, sesame, sulphites, lupin and molluscs.'],
      ['Which of these is one of the 14 allergens?', 'Lupin', ['Garlic', 'Tomato', 'Cinnamon'], 'Lupin flour turns up in some breads and pastries.'],
      ['Which of these is one of the 14 allergens?', 'Celery', ['Onion', 'Carrot', 'Basil'], 'Celery covers the stalk, the leaves, the seeds and celeriac.'],
      ['A guest is coeliac. Which allergen matters?', 'Gluten', ['Milk', 'Eggs', 'Sulphites'], 'Coeliac disease is a reaction to gluten, in wheat, rye, barley and oats.'],
      ['What does “86” mean on the floor?', 'It is sold out', ['Table 86', 'Ready to go', 'The bill is paid'], 'An 86’d dish or wine is off for the rest of the service.'],
      ['Sulphites are an allergen. Where are they almost always found?', 'Wine', ['Bread', 'Rice', 'Fresh herbs'], 'Wine labels say “contains sulphites”.'],
      ['Peanuts and tree nuts are…', 'Two separate allergens', ['The same allergen', 'Not allergens', 'Only an allergy when raw'], 'Peanuts are a legume; almonds, walnuts and hazelnuts are tree nuts.'],
      ['A guest with an allergy asks if a dish is safe. You…', 'Check with the kitchen every time', ['Say it is fine', 'Guess from the menu', 'Ask another guest'], 'Recipes and suppliers change. The kitchen always has the last word.'],
    ],
  };

  /* ---------- making the questions ---------- */
  function mk(topic, q, a, wrongPool, why, img) {
    a = String(a || '').trim();
    if (!a) return null;
    const wrong = [];
    shuffle(wrongPool.map((x) => String(x || '').trim())).forEach((x) => { if (x && x !== a && !wrong.includes(x) && wrong.length < 3) wrong.push(x); });
    if (wrong.length < 3) return null;
    return { topic: topic, q: q, a: a, opts: shuffle([a].concat(wrong)), why: why || '', img: img || '' };
  }
  function wineQs() {
    const out = [], wines = D.wines.filter((w) => !w.off && !w.stockOnly), titles = wines.map(K.wineTitle);
    const isBg = (w) => !K.isDrink(w) && K.origin && K.origin(w) && K.origin(w).bg, isFo = (w) => !K.isDrink(w) && K.origin && K.origin(w) && !K.origin(w).bg;
    const home = wines.filter(isBg).map(K.wineTitle), foreign = wines.filter(isFo).map(K.wineTitle);
    /* what a grape usually smells of: one question per grape, from the wines that have no notes of their own */
    const seen = {}, typical = [];
    wines.forEach((w) => { const n = K.wineNotes ? K.wineNotes(w) : null; if (n && n.typical && n.grape && !seen[n.grape]) { seen[n.grape] = 1; typical.push(n); } });
    typical.forEach((n) => out.push(mk('wine', 'What does ' + n.grape + ' usually smell of?', n.nose, typical.map((x) => x.nose), K.T(n.palate) + '.')));
    wines.forEach((w) => {
      const t = K.wineTitle(w);
      if (w.grapes) out.push(mk('wine', 'Which grape is ' + t + ' made from?', w.grapes, wines.map((x) => x.grapes).concat(GRAPES), w.story && short(K.T(w.story), 140)));
      if (w.region) out.push(mk('wine', 'Where does ' + t + ' come from?', w.region, wines.map((x) => x.region).concat(REGIONS), w.region + (w.country ? ', ' + w.country : '') + '.'));
      if (w.label) out.push(mk('wine', 'Whose label is this?', t, titles, w.say, K.media(w.label)));
      if (w.byGlass && w.glassPrice) out.push(mk('wine', 'How much is ' + (K.isDrink(w) ? (w.measure ? w.measure + ' of ' : '') : 'a glass of ') + w.name + '?', K.price(w.glassPrice), wines.filter((x) => x.glassPrice).map((x) => K.price(x.glassPrice)).concat([+w.glassPrice + 1, +w.glassPrice + 2, +w.glassPrice - 1, +w.glassPrice + 3].filter((x) => x > 0).map((x) => K.price(String(x)))), 'By the glass, ' + K.glassMl(w) + ' ml.'));
      if (w.bottlePrice) out.push(mk('wine', 'How much is a bottle of ' + w.name + '?', K.price(w.bottlePrice), wines.filter((x) => x.bottlePrice).map((x) => K.price(x.bottlePrice)).concat([+w.bottlePrice + 4, +w.bottlePrice - 4, +w.bottlePrice + 8].filter((x) => x > 0).map((x) => K.price(String(x)))), ''));
      if (w.serve) out.push(mk('wine', 'At what temperature do we serve ' + w.name + '?', w.serve, wines.map((x) => x.serve).concat(TEMPS), w.glass ? 'In a ' + w.glass.toLowerCase() + '.' : ''));
      if (w.nose) out.push(mk('wine', 'Which wine smells of ' + short(K.T(w.nose), 70).replace(/\.$/, '').toLowerCase() + '?', t, titles, w.palate));
      const o = !K.isDrink(w) && K.origin ? K.origin(w) : null;
      if (o && !o.bg && w.country) out.push(mk('wine', 'Which country is ' + t + ' from?', w.country, wines.map((x) => x.country).concat(['Portugal', 'Argentina', 'Chile', 'Bulgaria']), o.where + '.'));
      if (o && foreign.length >= 3 && home.length >= 3) out.push(o.bg ? mk('wine', 'Which of these wines is Bulgarian?', t, foreign, 'From ' + o.where + '.') : mk('wine', 'Which of these wines is not Bulgarian?', t, home, 'From ' + o.where + '.'));
      if (w.appellation) out.push(mk('wine', 'Which appellation is ' + t + '?', w.appellation, wines.map((x) => x.appellation).concat(['Bordeaux AOC', 'Barolo DOCG', 'Rioja DOCa', 'Chablis AOC', 'Prosecco DOC']), w.region));
      if (w.made) out.push(mk('wine', 'Which wine is made like this: ' + short(K.T(w.made), 90).replace(/\.$/, '').toLowerCase() + '?', t, titles, w.say));
      K.dishes().forEach((d) => {
        if (K.housePairs ? K.housePairs(d).includes(w) : (d.n.pairs || []).includes(w.id) || w.pairs.includes(d.id)) {
          const why = (d.n.pairWhy || {})[w.id] || d.n.pairText || w.say;
          /* the other right answers are left out of the wrong ones: a dish has several wines, a wine several dishes */
          const others = K.housePairs ? K.housePairs(d).filter((x) => x !== w).map(K.wineTitle) : [];
          out.push(mk('wine', 'Which wine do we pour with ' + K.dn(d) + '?', t, titles.filter((x) => !others.includes(x)), why));
          out.push(mk('wine', 'Which dish do we pour ' + t + ' with?', K.dn(d), K.dishes().filter((x) => x === d || !K.housePairs || !K.housePairs(x).includes(w)).map((x) => K.dn(x)), why));
        }
      });
    });
    return out.filter(Boolean);
  }
  /* ---------- food ----------
     First what a waitress has to decide at the table: who can eat what, what to write on the order, where an
     allergen comes from, what stands in for a course of the tasting menu. Then what she has to know by heart.
     Every question carries its kind, and a round draws from different kinds, so it is not ten of one sort.
     A question whose wording gives its answer away (“which dish has pacha?” — “cold pork pacha”) is left out. */
  const lc = (s) => String(s || '').toLowerCase();
  const cap = (s) => { s = String(s || '').trim(); return s.charAt(0).toUpperCase() + s.slice(1); };
  const one = (l) => l[Math.floor(Math.random() * l.length)];
  /* an explanation without the word it explains in front (“Krokmach: a fermented…” would name the answer) */
  const bare = (what) => { const t = K.T(what), i = t.indexOf(': '); return cap(i > 0 && i <= 40 ? t.slice(i + 2) : t); };
  const LAT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: '', ю: 'yu', я: 'ya' };
  const latin = (s) => lc(s).split('').map((c) => (LAT[c] != null ? LAT[c] : c)).join('');
  const stems = (s) => (lc(s) + ' ' + latin(s)).split(/[^a-zа-я]+/).filter((w) => w.length >= 4).map((w) => w.slice(0, 4));
  /* does one text give the other away: they share the start of a word, in either alphabet */
  const tells = (a, b) => { const x = stems(b); return stems(a).some((w) => x.includes(w)); };
  /* how hard a kind of question is: 3 for what takes knowing the whole plate or judging a guest's case, 2 for what
     takes understanding a dish, 1 for what is learnt by heart. Points and time follow (see FACTOR, TIME). */
  const LEVEL = { guest: 3, swap: 3, plan: 3, missing: 3, exact: 3, shared: 3, allergenset: 3, change: 2, where: 2, canbe: 2, whatisrev: 2, oddone: 2, allthree: 2, sauce: 2, tasting: 2, house: 2 };
  const DIETQ = {
    vegan: ['A guest is vegan. Which of these can they eat as it comes?', 'A guest is vegan. Which of these do you not offer?', 'A vegan guest orders ', 'A vegan guest takes the tasting menu. '],
    veg: ['A guest is vegetarian. Which of these can they eat as it comes?', 'A guest is vegetarian. Which of these do you not offer?', 'A vegetarian guest orders ', 'A vegetarian guest takes the tasting menu. '],
    pesc: ['A guest is pescatarian. Which of these can they eat as it comes?', 'A guest is pescatarian. Which of these do you not offer?', 'A pescatarian guest orders ', 'A pescatarian guest takes the tasting menu. '],
  };
  function foodQs() {
    const out = [], dishes = K.dishes(), ens = dishes.map((d) => d.en).filter(Boolean), names = dishes.map((d) => d.name);
    const add = (kind, q, level) => { if (q) { q.kind = kind; q.level = level || LEVEL[kind] || 1; out.push(q); } };
    const allAl = (K.ALLERGENS || []).map((a) => a[0]), keys = allAl.concat(['lactose', 'vegan', 'veg', 'pesc']);
    const menu = dishes.filter((d) => d.onMenu && d.n.only !== 'tasting');
    /* everything a dish is known to have, in one text: its menu line, its ingredients, what guests ask about */
    const textOf = (y) => [y.n.menuBg, y.n.menuEn, y.ings.join(' | '), (y.n.niche || []).map((z) => z.n).join(' | ')].join(' | ').toLowerCase();
    const has = (y, name) => { const n = String(name || '').split(/[,(]/)[0].trim().toLowerCase(); return !!n && textOf(y).includes(n); };
    /* where an allergen sits in a dish, as a guest would be told: the ingredient, not the app's wording */
    const sources = (d, k) => (K.allergenWhere(d)[k] || []).filter((s) => s !== 'ticked by hand' && s !== 'its name')
      .map((s) => (K.fromMenu(s) ? s.replace(/^the menu line \(|\)$/g, '') : s.split(': ').pop()).split('(')[0].trim()).filter((s, i, l) => s && l.findIndex((x) => lc(x) === lc(s)) === i);
    const whyNo = (x, k) => { const hit = x.v.hits[0] || {}, src = sources(x.d, k === 'lactose' ? 'milk' : k); return hit.txt ? x.d.name + K.T(hit.txt) + '.' : x.d.name + ': ' + lc(K.T(K.alName(k))) + (src.length ? K.T(' in ' + src.slice(0, 2).join(', ')) : '') + '.'; };

    /* 1. a guest with an allergy or a diet: what can they eat, what do you not offer. Only settled answers are
          used: a dish still waiting to be confirmed is neither a right nor a wrong one. */
    keys.forEach((k) => {
      const v = menu.map((d) => ({ d: d, v: K.allergyVerdict(d, [k]) })), yes = v.filter((x) => x.v.state === 'ok'), no = v.filter((x) => x.v.state === 'no');
      const q = K.DIET[k] ? DIETQ[k] : k === 'lactose' ? ['A guest avoids lactose but eats butter. Which of these can they eat as it comes?', 'A guest avoids lactose but eats butter. Which of these do you not offer?']
        : ['A guest is allergic to ' + lc(K.AL[k]) + '. Which of these can they eat as it comes?', 'A guest is allergic to ' + lc(K.AL[k]) + '. Which of these do you not offer?'];
      if (yes.length && no.length >= 3) add('guest', mk('food', q[0], one(yes).d.name, no.map((x) => x.d.name), 'It is confirmed without it; the other three have it.'));
      if (no.length && yes.length >= 3) { const x = one(no); add('guest', mk('food', q[1], x.d.name, yes.map((y) => y.d.name), whyNo(x, k))); }
      /* 2. fine with a change: what do you write on the order */
      v.filter((x) => x.v.state === 'mod' && x.v.notes.length).forEach((x) => add('change', mk('food',
        K.DIET[k] ? DIETQ[k][2] + x.d.name + '. What do you do?' : 'A guest cannot eat ' + lc(K.alName(k)) + ' and orders ' + x.d.name + '. What do you do?',
        x.v.notes.map(K.T).join(' · '), ['Serve it as it comes', 'Say we cannot make it for them', 'Ask the kitchen to leave out the sauce', 'Offer a half portion'].map(K.T), 'Write the change on the order, so the kitchen sees it.')));
    });
    /* the bread comes off, the gluten stays: the dish itself has it */
    menu.forEach((d) => {
      if (d.n.bread && K.allergenWhere(d).gluten && !(d.n.breadAl || []).includes('gluten')) add('change', mk('food', 'A guest cannot eat gluten. Can they have ' + d.name + ' without the bread?',
        'No: the gluten is in the dish itself', ['Yes: only the bread has gluten', 'Yes, with brioche instead of the bread', 'Yes, as a half portion'], K.T(K.AL.gluten) + ': ' + sources(d, 'gluten').slice(0, 3).join(', ') + '.'));
    });

    /* 3. where is the allergen: which ingredient carries it */
    menu.forEach((d) => {
      const items = (d.ings.length ? d.ings : String(d.n.menuBg || '').split(/,\s*/)).map((x) => String(x).split('(')[0].trim()).filter((x) => x && x.length <= 36);
      Object.keys(K.allergenWhere(d)).forEach((k) => {
        const src = sources(d, k);
        if (!src.length || src[0].length > 40) return;
        add('where', mk('food', 'Where is the ' + lc(K.AL[k]) + ' in ' + d.name + '?', src[0], items.filter((i) => !K.allergensIn(i).includes(k) && !src.some((s) => lc(s) === lc(i))), K.T(K.AL[k]) + ': ' + src.slice(0, 3).join(', ') + '.'));
      });
    });

    /* 4. the tasting menu: its order, what is on it, and what stands in for a course a guest cannot have */
    const t = K.tasting(), cs = t.courses;
    if (cs.length >= 4) {
      const onIt = cs.map((c) => c.id).concat(t.extra ? [t.extra.dish.id] : []), off = menu.filter((d) => !onIt.includes(d.id)), order = K.T('The order: ') + cs.map((c) => c.name).join(' → ');
      for (let i = 0; i < cs.length - 1; i++) add('tasting', mk('food', 'On the tasting menu, what comes after ' + cs[i].name + '?', cs[i + 1].name, cs.filter((c, j) => j !== i && j !== i + 1).map((c) => c.name), order));
      for (let i = 0; i < 3 && off.length; i++) add('tasting', mk('food', 'Which of these is not on the tasting menu?', one(off).name, cs.map((c) => c.name), order));
      add('tasting', mk('food', 'How many courses does the tasting menu have?', String(cs.length), [cs.length - 2, cs.length - 1, cs.length + 1, cs.length + 2].map(String), order), 1);
      if (+t.price) add('tasting', mk('food', 'How much is the tasting menu for one guest?', K.price(t.price), [-15, -10, 10, 15].map((x) => K.price(String(+t.price + x))), t.pairing ? K.T('The wine pairing: ') + K.price(t.pairing) : ''), 1);
      if (t.extra) add('tasting', mk('food', 'What can a table add to the tasting menu?', t.extra.dish.name, off.map((d) => d.name), t.extra.price ? K.price(t.extra.price) : ''));
      /* the menu the house has set for a diet (vegan): which dish takes the place of which course, and the course the kitchen makes itself */
      const PLANQ = { vegan: ['On the vegan tasting menu, what takes the place of ', 'On the vegan tasting menu, which course does the kitchen replace with one of its own?', 'The vegan tasting menu: '], veg: ['On the vegetarian tasting menu, what takes the place of ', 'On the vegetarian tasting menu, which course does the kitchen replace with one of its own?', 'The vegetarian tasting menu: '], pesc: ['On the pescatarian tasting menu, what takes the place of ', 'On the pescatarian tasting menu, which course does the kitchen replace with one of its own?', 'The pescatarian tasting menu: '] };
      Object.keys(t.plans || {}).forEach((k) => {
        const pl = t.plans[k], set = cs.filter((c) => pl[c.id] !== undefined), named = set.filter((c) => pl[c.id] && K.dish(pl[c.id]));
        if (!PLANQ[k] || named.length < 2) return;
        const dn = (c) => K.dish(pl[c.id]).name;
        const all = K.T(PLANQ[k][2]) + set.filter((c) => !pl[c.id] || K.dish(pl[c.id])).map((c) => (pl[c.id] ? dn(c) : K.T('the kitchen’s own course')) + K.T(' instead of ') + c.name).join(' · ');
        named.forEach((c) => add('plan', mk('food', PLANQ[k][0] + c.name + '?', dn(c), off.filter((d) => d.id !== pl[c.id]).map((d) => d.name), all)));
        set.filter((c) => !pl[c.id]).forEach((c) => add('plan', mk('food', PLANQ[k][1], c.name, cs.filter((x) => x.id !== c.id).map((x) => x.name), all)));
      });
      if (K.courseKind) keys.forEach((k) => cs.forEach((c) => {
        if (K.allergyVerdict(c, [k]).state !== 'no') return;
        /* a course the house has settled for this diet is asked above, with the house's answer */
        if (t.plans && t.plans[k] && t.plans[k][c.id] !== undefined) return;
        const pool = off.map((d) => ({ d: d, v: K.allergyVerdict(d, [k]) })), kind = K.courseKind(c);
        const right = pool.filter((x) => K.standsIn(kind, K.courseKind(x.d)) && (x.v.state === 'ok' || x.v.state === 'mod'));
        /* wrong: a dish of another kind (a dip for a main), or one of the right kind the guest cannot have either */
        const wrong = pool.filter((x) => !K.standsIn(kind, K.courseKind(x.d)) || x.v.state === 'no');
        if (right.length) add('swap', mk('food', (K.DIET[k] ? DIETQ[k][3] : 'A guest on the tasting menu cannot eat ' + lc(K.alName(k)) + '. ') + 'What can take the place of ' + c.name + '?', one(right).d.name, wrong.map((x) => x.d.name),
          'A course is only replaced by one of its kind: a main by a main, a starter by a starter, a dessert by a dessert. A dip can stand in for the bread or the bites, never for a plated course.'));
      }));
    }

    /* 5. what the kitchen can make of a dish on request */
    const cans = menu.filter((d) => d.n.canDiet && d.n.canHow);
    cans.forEach((d) => add('canbe', mk('food', 'How do we make ' + d.name + ' ' + lc(K.DIET[d.n.canDiet]) + '?', cap(K.T(d.n.canHow)),
      cans.filter((x) => x !== d).map((x) => cap(K.T(x.n.canHow))).concat(['Without the dressing', 'With oil instead of butter', 'With the sauce on the side', 'We cannot'].map(K.T)), (d.n.canAl || []).length ? K.T('Then it has no ' + d.n.canAl.map((k) => K.AL[k].toLowerCase()).join(', ') + '.') : '')));
    [['vegan', 'Which of these can be made vegan on request?'], ['veg', 'Which of these can be made vegetarian on request?']].forEach((x) => {
      const rank = (l) => K.DIETS.indexOf(l), yes = menu.filter((d) => d.n.canDiet && rank(d.n.canDiet) >= rank(x[0]) && !(d.n.diet && rank(d.n.diet) >= rank(x[0]))), no = menu.filter((d) => K.allergyVerdict(d, [x[0]]).state === 'no');
      if (yes.length && no.length >= 3) { const d = one(yes); add('canbe', mk('food', x[1], d.name, no.map((y) => y.name), K.T(K.canText(d.n)))); }
    });

    /* 6. the bread on the side */
    const bready = (d) => /хляб|bread|бриош|brioche|блини|blini|галета/.test(textOf(d));
    const withBread = menu.filter((d) => d.n.bread), noBread = menu.filter((d) => !d.n.bread && !bready(d));
    if (withBread.length && noBread.length >= 3) add('bread', mk('food', 'Which of these comes with bread on the side?', one(withBread).name, noBread.map((d) => d.name), 'A guest who cannot eat gluten gets it without the bread, where the dish itself has none.'));

    /* 6b. everything on the plate. Waiters rarely know every part of every dish: these ask for it, and are worth the most.
           A plate is what the menu prints for the dish, in the reader's language. */
    const plate = (d) => String((K.flang === 'bg' ? d.n.menuBg : d.n.menuEn || d.n.menuBg) || '').split(/,\s*/).map((x) => x.trim()).filter(Boolean);
    /* a line that names things instead of listing what is on the plate (the three bites) is left out */
    const plates = dishes.filter((d) => d.onMenu && !d.n.lineIs).map((d) => ({ d: d, p: plate(d) })).filter((x) => x.p.length >= 3);
    const parts = [];
    plates.forEach((x) => x.p.forEach((i) => { if (!parts.some((y) => lc(y) === lc(i))) parts.push(i); }));
    const onPlate = (d, item) => has(d, item) || plate(d).some((i) => lc(i) === lc(item));
    const full = (x) => K.T('On the menu: ') + x.p.join(', ');
    plates.forEach((x) => {
      const nm = x.d.name + ' ' + (x.d.en || ''), foreign = parts.filter((i) => !onPlate(x.d, i));
      /* one part left out */
      const hide = one(x.p.filter((i) => !tells(i, nm)).concat(x.p.slice(0, 0)));
      if (hide) add('missing', mk('food', 'On the menu ' + x.d.name + ' is: ' + x.p.filter((i) => i !== hide).join(', ') + ', and one more thing. What is it?', hide, foreign, full(x)));
      /* the whole line, against three with one part swapped for something from another plate */
      if (foreign.length >= 3) add('exact', mk('food', 'Which line is ' + x.d.name + ', exactly as on the menu?', x.p.join(', '),
        shuffle(foreign).slice(0, 3).map((f, i) => { const p = x.p.slice(); p[(i + Math.floor(Math.random() * p.length)) % p.length] = f; return p.join(', '); }), ''));
      /* three of its parts, without its name */
      const three = shuffle(x.p.filter((i) => !tells(i, nm))).slice(0, 3);
      if (three.length === 3) add('allthree', mk('food', 'Which dish has ' + three[0] + ', ' + three[1] + ' and ' + three[2] + '?', x.d.name, names, full(x)));
    });
    /* a part two dishes share */
    const sharedSeen = {};
    shuffle(plates).forEach((a, i, l) => l.slice(i + 1).forEach((b) => {
      const both = a.p.filter((x) => b.p.some((y) => lc(y) === lc(x)));
      if (!both.length || (sharedSeen[lc(both[0])] = (sharedSeen[lc(both[0])] || 0) + 1) > 2) return;
      add('shared', mk('food', 'Which of these is in both ' + a.d.name + ' and ' + b.d.name + '?', both[0], a.p.concat(b.p).filter((x) => !both.some((y) => lc(y) === lc(x))), ''));
    }));
    /* the sauce */
    const SAUCE = /сос|(^|\s)жу($|\s)|винегрет|дресинг|холандез|бьор блан|понзу|sauce|\bjus\b|vinaigrette|dressing|hollandaise|beurre blanc|ponzu/i;
    const sauces = parts.filter((i) => SAUCE.test(i));
    plates.forEach((x) => { const s = x.p.filter((i) => SAUCE.test(i)); if (s.length === 1) add('sauce', mk('food', 'Which sauce comes with ' + x.d.name + '?', s[0], sauces.filter((i) => !onPlate(x.d, i)), full(x))); });
    /* all of a dish's allergens at once: only for dishes whose allergens are confirmed */
    dishes.filter((d) => d.onMenu && K.dishChecked(d)).forEach((d) => {
      const al = K.dishAllergens(d).keys, rest = allAl.filter((k) => !al.includes(k)), nm = (l) => K.orderAl(l).map((k) => K.T(K.AL[k])).join(', ');
      if (al.length < 2 || !rest.length) return;
      const wrong = [];
      for (let i = 0; i < 6; i++) { const w = al.slice(); if (i % 3 === 0) w.splice(Math.floor(Math.random() * w.length), 1, one(rest)); else if (i % 3 === 1) w.push(one(rest)); else w.splice(Math.floor(Math.random() * w.length), 1); wrong.push(nm(w)); }
      add('allergenset', mk('food', 'Which are all the allergens in ' + d.name + '?', nm(al), wrong, ''));
    });
    /* which part of the menu a dish is under */
    const under = {};
    menu.forEach((d) => { (under[d.section] = under[d.section] || []).push(d); });
    Object.keys(under).forEach((s) => { const out2 = menu.filter((d) => d.section !== s); if (under[s].length >= 3 && out2.length) add('section', mk('food', 'Which of these is not under ' + s + ' on the menu?', one(out2).name, under[s].map((d) => d.name), '')); });
    /* what the house knows about itself: the questions that come with the menu, and the managers' own */
    D.quizq.filter((q) => (q.topic || 'food') === 'food').forEach((q) => add('house', mk('food', q.q, q.a, q.wrong || [], q.why, q.photo ? K.media(q.photo) : ''), +q.level || 2));

    /* 7. a dish from its line on the menu, when the line does not name it */
    dishes.forEach((d) => {
      const line = K.flang === 'bg' ? d.n.menuBg : d.n.menuEn || d.n.menuBg;
      if (line && line.split(',').length >= 3 && !tells(line, d.name + ' ' + (d.en || ''))) add('menuline', mk('food', 'The menu says: “' + line + '”. Which dish is it?', d.name, names, d.en));
    });

    /* 8. the ingredients guests ask about: what one is, and which one a description means */
    const niche = [];
    dishes.forEach((d) => (d.n.niche || []).forEach((x) => { if (x.what && !niche.some((y) => y.n === x.n)) niche.push({ n: x.n, what: x.what, d: d }); }));
    Object.keys(D.gloss).forEach((id) => { const g = D.gloss[id]; if (g.name && g.what && !niche.some((y) => y.n === g.name)) niche.push({ n: g.name, what: g.what, d: null }); });
    const bares = niche.map((x) => short(bare(x.what), 80));
    niche.forEach((x) => {
      const where = x.d ? 'In ' + x.d.name + '.' : '';
      add('whatis', mk('food', 'What is ' + x.n + '?', short(bare(x.what), 80), bares, where));
      if (!tells(bare(x.what), x.n + ' ' + (K.en(x.n) || ''))) add('whatisrev', mk('food', 'Which ingredient is this: “' + short(bare(x.what), 120) + '”?', x.n, niche.map((y) => y.n), where));
    });

    /* 9. by heart: which dish an ingredient is in (when the name does not say so), the English names that are not
          the same word, an allergen, an odd one out, prices, pictures */
    dishes.forEach((d) => {
      (d.n.niche || []).forEach((x) => {
        if (!tells(x.n + ' ' + (K.en(x.n) || ''), d.name + ' ' + (d.en || ''))) add('has', mk('food', 'Which dish has ' + x.n + '?', d.name, dishes.filter((y) => y === d || !has(y, x.n)).map((y) => y.name), x.what ? bare(x.what) : ''));
      });
      if (d.en && d.en !== d.name && !tells(d.name, d.en)) add('translate', mk('food', 'How do you say ' + d.name + ' in English?', d.en, ens.concat(['Chef’s special', 'Garden salad', 'Slow-cooked beef']), d.n.pitch && short(K.T(d.n.pitch), 140)));
      const al = K.dishAllergens(d).keys;
      if (al.length) {
        const a = one(al);
        add('allergen', mk('food', 'Which allergen is in ' + d.name + '?', K.AL[a], allAl.filter((k) => !al.includes(k) && !K.menuAllergens(d)[k]).map((k) => K.AL[k]), d.name + ' has: ' + al.map((k) => K.AL[k]).join(', ') + '.'));
      }
      const others = [];
      dishes.forEach((x) => { if (x !== d) x.ings.forEach((i) => { if (!d.ings.some((j) => K.ingKey(j) === K.ingKey(i)) && !has(d, i)) others.push(i); }); });
      const mine = d.ings.filter((i) => i.length < 40);
      if (others.length && mine.length >= 3) add('oddone', mk('food', 'Which of these is NOT in ' + d.name + '?', one(others), mine, 'In it: ' + mine.slice(0, 8).join(', ') + (mine.length > 8 ? '…' : '') + '.'));
      if (d.price) add('price', mk('food', 'How much is ' + d.name + '?', K.price(d.price), dishes.filter((x) => x.price).map((x) => K.price(x.price)).concat([+d.price + 2, +d.price - 2, +d.price + 4].filter((x) => x > 0).map((x) => K.price(String(x)))), ''));
      if (d.photo || K.dishArt(d)) add('photo', mk('food', 'Which dish is this?', d.name, names, d.en, d.photo ? K.media(d.photo) : K.dishArt(d)));
    });
    return out;
  }
  /* every food question the book can make right now, with its kind: for looking over the quiz, and for the tests */
  K.quizFood = foodQs;
  /* a food round: the situations first, one of each kind in turn, then what is known by heart */
  function pickMixed(qs, n) {
    const out = [], pool = { 1: {}, 2: {}, 3: {} };
    qs.forEach((q) => { const p = pool[q.level || 1]; (p[q.kind] = p[q.kind] || []).push(q); });
    [1, 2, 3].forEach((l) => Object.keys(pool[l]).forEach((k) => { pool[l][k] = shuffle(pool[l][k]); }));
    /* from one level: a question of each kind in turn, never the same wording twice */
    const take = (level, max) => {
      const by = pool[level];
      let left = true;
      while (max > 0 && left) {
        left = false;
        shuffle(Object.keys(by)).forEach((k) => {
          if (max <= 0 || !by[k].length) return;
          const q = by[k].shift();
          left = true;
          if (!out.some((o) => o.q === q.q)) { out.push(q); max--; }
        });
      }
    };
    const hard = Math.round(n * 3 / 7);
    take(3, hard); take(2, n - out.length - 1); take(1, n - out.length);
    take(2, n - out.length); take(3, n - out.length);
    return out;
  }
  /* what a level is worth, and how long it gets: a hard question pays double and has ten seconds more */
  const FACTOR = [1, 1, 1.5, 2], TIME = [SECONDS, SECONDS, 25, 30], LEVELS = ['', 'Easy', 'Medium', 'Hard'];
  const secsOf = (q) => TIME[(q && q.level) || 1], worth = (q) => Math.round(150 * FACTOR[(q && q.level) || 1]);
  function bankQs(topic) {
    return BANK[topic].map((b) => mk(topic, b[0], b[1], b[2], b[3])).filter(Boolean)
      .concat(D.quizq.filter((q) => (q.topic || 'food') === topic && topic !== 'food').map((q) => mk(topic, q.q, q.a, q.wrong || [], q.why, q.photo ? K.media(q.photo) : '')).filter(Boolean));
  }
  /* a round: mostly questions about our own wines and dishes, topped up from the general ones */
  function round(topic) {
    /* if making the questions from the book fails, the round still starts, from the general questions */
    const safe = (make) => { try { return make(); } catch (e) { if (window.console) console.error('quiz questions', e); return []; } };
    const own = topic === 'wine' ? pickN(safe(wineQs), 7) : topic === 'food' ? pickMixed(safe(foodQs), 7) : pickN(safe(wineQs), 4).concat(pickMixed(safe(foodQs), 4));
    const gen = topic === 'all' ? bankQs('wine').concat(bankQs('food')) : bankQs(topic);
    const seen = {}, out = [];
    own.concat(pickN(gen, ROUND)).forEach((q) => { if (out.length < ROUND && !seen[q.q]) { seen[q.q] = 1; out.push(q); } });
    return shuffle(out);
  }

  /* ---------- playing ---------- */
  let tick = null;
  function stopClock() { clearInterval(tick); tick = null; }
  function start(topic) {
    if (!K.canWrite()) { K.toast('View only: ask the floor manager to make you a waiter to play.'); return; }
    if (K.mode === 'local' && !K.myName()) { ui.sheet = { type: 'name', then: () => start(topic) }; K.render(); return; }
    ui.quiz = { stage: 'play', topic: topic, qs: round(topic), i: 0, picked: null, right: 0, score: 0, t0: Date.now(), log: [] };
    K.render(true);
    clock();
  }
  function clock() {
    stopClock();
    tick = setInterval(() => {
      const Q = ui.quiz;
      if (!Q || Q.stage !== 'play' || Q.picked != null) { stopClock(); return; }
      const secs = secsOf(Q.qs[Q.i]), left = Math.max(0, secs - (Date.now() - Q.t0) / 1000);
      const bar = document.getElementById('qz-time'), num = document.getElementById('qz-sec');
      if (bar) bar.style.transform = 'scaleX(' + (left / secs) + ')';
      if (num) num.textContent = String(Math.ceil(left));
      if (left <= 0) answer(-1);
    }, 200);
  }
  function answer(i) {
    const Q = ui.quiz, q = Q.qs[Q.i];
    if (Q.picked != null) return;
    stopClock();
    const secs = secsOf(q), ok = i >= 0 && q.opts[i] === q.a, left = Math.max(0, secs - (Date.now() - Q.t0) / 1000);
    const pts = ok ? Math.round((100 + 50 * left / secs) * FACTOR[q.level || 1]) : 0;
    Q.picked = i; Q.pts = pts;
    if (ok) { Q.right++; Q.score += pts; K.vibrate(15); } else K.vibrate([30, 40, 30]);
    Q.log.push({ q: q.q, a: q.a, ok: ok });
    K.render();
  }
  function next() {
    const Q = ui.quiz;
    if (Q.i + 1 >= Q.qs.length) { finish(); return; }
    Q.i++; Q.picked = null; Q.t0 = Date.now();
    K.render(true);
    clock();
  }
  function finish() {
    const Q = ui.quiz;
    Q.stage = 'done';
    stopClock();
    const id = K.uid(), doc = { uid: (K.me && K.me.id) || 'this-phone', name: K.myName() || 'Me', score: Q.score, right: Q.right, of: Q.qs.length, topic: Q.topic, at: Date.now() };
    D.scores = D.scores.concat([Object.assign({ id: id }, doc)]);
    K.db.doc('quizscores/' + id).set(doc).catch(K.writeFailed);
    if (K.celebrate && Q.right >= Q.qs.length * 0.8) K.celebrate('');
    K.render(true);
  }
  K.quitQuiz = function () { stopClock(); ui.quiz = null; };

  /* ---------- the board ---------- */
  function since(period) {
    if (period === 'week') return K.mondayOf(new Date()).getTime();
    if (period === 'month') { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
    return 0;
  }
  function board(period, topic) {
    const from = since(period), m = {};
    D.scores.forEach((s) => {
      if (s.at < from || (topic !== 'all' && s.topic !== topic)) return;
      const k = s.uid + '';
      const e = m[k] || (m[k] = { uid: s.uid, name: s.name, best: 0, total: 0, rounds: 0, right: 0, of: 0 });
      e.name = s.name || e.name; e.best = Math.max(e.best, s.score); e.total += s.score; e.rounds++; e.right += s.right; e.of += s.of;
    });
    return Object.values(m).sort((a, b) => b.best - a.best || b.total - a.total);
  }
  const TOPICS = [['wine', 'Wine', 'glass', 'Grapes, regions, labels, prices and pairings'], ['food', 'Food', 'plate', 'Translations, allergens and the unusual ingredients'], ['all', 'Everything', 'trophy', 'Both, mixed']];

  K.V.quiz = function () {
    const Q = ui.quiz;
    if (Q && Q.stage === 'play') return playView(Q);
    const body = h('div', { class: 'page' });
    const mine = D.scores.filter((s) => s.uid === ((K.me && K.me.id) || 'this-phone') && s.at >= since('week'));
    body.append(K.pageHead('The quiz', mine.length ? 'Your best this week: ' + Math.max.apply(null, mine.map((s) => s.score)) + ' points' : 'Ten questions. A harder one gives more time and up to double the points; a quick answer scores more.', null, '', 'quiz-head'));
    const w = h('div', { class: 'wrap' });
    body.append(w);
    if (Q && Q.stage === 'done') w.append(doneCard(Q));
    w.append(h('div', { class: 'quiz-topics' }, TOPICS.map((t) => h('button', { type: 'button', class: 'qt qt-' + t[0], onclick: () => start(t[0]) },
      K.icon(t[2]), h('b', null, t[1]), h('span', null, t[3]), h('span', { class: 'qt-go' }, 'Play', K.icon('next'))))));
    const per = ui.board || 'week', top = ui.boardTopic || 'all', rows = board(per, top);
    w.append(h('section', { class: 'group lb' },
      h('div', { class: 'lb-head' }, h('h2', { class: 'group-title' }, 'Leaderboard'),
        K.seg([['week', 'This week'], ['month', 'Month'], ['all', 'All time']], per, (v) => { ui.board = v; K.render(); }, { class: 'seg small-seg', 'aria-label': 'Period' })),
      K.seg([['all', 'Everything'], ['wine', 'Wine'], ['food', 'Food']], top, (v) => { ui.boardTopic = v; K.render(); }, { class: 'seg small-seg lb-topic', 'aria-label': 'Topic' }),
      rows.length ? h('ol', { class: 'lb-list' }, rows.map((r, i) => h('li', { class: 'lb-row' + (r.uid === ((K.me && K.me.id) || 'this-phone') ? ' me' : '') },
        h('span', { class: 'lb-pos' + (i < 3 ? ' m' + (i + 1) : '') }, String(i + 1)),
        h('span', { class: 'lb-name' }, h('b', null, r.name || 'Someone'), h('span', { class: 'muted' }, r.rounds + (r.rounds === 1 ? ' round' : ' rounds') + ' · ' + Math.round(100 * r.right / Math.max(1, r.of)) + '% right')),
        h('span', { class: 'lb-best mono' }, String(r.best))))) : h('p', { class: 'muted lb-none' }, 'Nobody has played ' + (per === 'week' ? 'this week' : per === 'month' ? 'this month' : 'yet') + '. Be the first.')));
    if (K.canEdit()) {
      w.append(h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'Your own questions', h('span', { class: 'n' }, String(D.quizq.length))),
        h('p', { class: 'hint' }, 'Most questions are made from the wine and food bibles by themselves. Add your own for anything else: house rules, the producers, the team’s favourite facts.'),
        D.quizq.length ? h('div', { class: 'ing-list' }, D.quizq.map((q) => h('button', { type: 'button', class: 'ing-row', onclick: () => { ui.sheet = { type: 'qedit', id: q.id }; K.render(); } },
          h('span', { class: 'ing-name' }, h('b', null, q.q)), h('span', { class: 'ing-what' }, q.a), h('span', { class: 'ing-in' }, q.topic === 'wine' ? 'Wine' : 'Food')))) : null,
        h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', onclick: () => { ui.sheet = { type: 'qedit', id: null }; K.render(); } }, K.icon('plus'), 'Add a question'))));
    }
    return { body: body };
  };
  function doneCard(Q) {
    const rows = board('week', 'all'), pos = rows.findIndex((r) => r.uid === ((K.me && K.me.id) || 'this-phone')) + 1;
    const missed = Q.log.filter((x) => !x.ok);
    return h('section', { class: 'quiz-done' },
      h('p', { class: 'kicker' }, 'Round finished'),
      h('div', { class: 'qd-score' }, h('b', { class: 'mono' }, String(Q.score)), h('span', null, 'points · ' + Q.right + ' of ' + Q.qs.length + ' right')),
      pos ? h('p', null, pos === 1 ? 'You are top of the board this week.' : 'Number ' + pos + ' on this week’s board.') : null,
      missed.length ? h('details', { class: 'qd-missed' }, h('summary', null, 'The ones you missed (' + missed.length + ')'),
        h('ul', null, missed.map((x) => h('li', null, x.q, h('b', null, ' ' + x.a))))) : h('p', null, 'A perfect round.'),
      h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => start(Q.topic) }, 'Play again'),
        h('button', { class: 'btn', type: 'button', onclick: () => { ui.quiz = null; K.render(); } }, 'Close')));
  }
  function playView(Q) {
    const q = Q.qs[Q.i], done = Q.picked != null;
    if (!q) { ui.quiz = null; return K.V.quiz(); }
    const secs = secsOf(q), left = Math.max(0, secs - (Date.now() - Q.t0) / 1000);
    const body = h('div', { class: 'wrap quiz-play' },
      h('div', { class: 'qp-top' },
        h('span', { class: 'mono' }, (Q.i + 1) + ' / ' + Q.qs.length),
        h('span', { class: 'qp-score mono' }, Q.score + ' pts'),
        h('span', { class: 'qp-sec mono', id: 'qz-sec' }, done ? '' : String(Math.ceil(left)))),
      h('div', { class: 'qp-timer' }, h('span', { id: 'qz-time', style: { transform: 'scaleX(' + (done ? 0 : left / secs) + ')' } })),
      h('p', { class: 'kicker qp-kick' }, h('span', null, q.topic === 'wine' ? 'Wine' : 'Food'), h('span', { class: 'qp-level l' + (q.level || 1) }, h('b', null, LEVELS[q.level || 1]), h('span', null, 'up to ' + worth(q) + ' points'))),
      q.img ? h('div', { class: 'qp-img' }, h('img', { src: q.img, alt: '' })) : null,
      h('h1', { class: 'qp-q' }, q.q),
      h('div', { class: 'qp-opts' }, q.opts.map((o, i) => {
        const cls = !done ? '' : o === q.a ? ' right' : i === Q.picked ? ' wrong' : ' dim';
        return h('button', { type: 'button', class: 'qp-opt' + cls, disabled: done, onclick: () => answer(i) }, h('span', { class: 'qp-l mono' }, 'ABCD'[i]), h('span', null, o));
      })),
      done ? h('div', { class: 'qp-after ' + (Q.pts ? 'ok' : 'no') },
        h('b', null, Q.pts ? 'Right · +' + Q.pts : Q.picked < 0 ? 'Time is up' : 'Not quite'),
        Q.pts ? null : h('p', null, 'The answer: ', h('b', null, q.a)),
        q.why ? h('p', { class: 'muted' }, q.why) : null,
        h('button', { class: 'btn primary wide', type: 'button', onclick: next }, Q.i + 1 >= Q.qs.length ? 'See your score' : 'Next question')) : null);
    return {
      top: K.subbar('Stop', () => { K.quitQuiz(); K.render(true); }, [], q.topic === 'all' ? 'Quiz' : 'Quiz · ' + (Q.topic === 'wine' ? 'Wine' : Q.topic === 'food' ? 'Food' : 'Everything')),
      body: body, tabs: false, solid: true,
    };
  }

  /* ---------- a question of the manager's own ---------- */
  K.SHEETS.qedit = function (S) {
    const q = S.id ? D.quizq.find((x) => x.id === S.id) : null;
    if (!S.f) S.f = { q: q ? q.q : '', a: q ? q.a : '', w1: q ? (q.wrong || [])[0] || '' : '', w2: q ? (q.wrong || [])[1] || '' : '', w3: q ? (q.wrong || [])[2] || '' : '', why: q ? q.why || '' : '', topic: q ? q.topic || 'food' : 'wine' };
    const f = S.f;
    const inp = (k, ph) => h('input', { class: 'input', id: 'qe-' + k, value: f[k], placeholder: ph || '', oninput: (e) => { f[k] = e.target.value; } });
    const save = (e) => {
      e.preventDefault();
      const wrong = [f.w1, f.w2, f.w3].map((x) => x.trim()).filter(Boolean);
      if (!f.q.trim() || !f.a.trim() || wrong.length < 3) { K.toast('Write the question, the answer and three wrong answers.', { tone: 'bad' }); return; }
      const id = q ? q.id : K.uid(), doc = { q: f.q.trim(), a: f.a.trim(), wrong: wrong, why: f.why.trim(), topic: f.topic, at: Date.now() };
      D.quizq = D.quizq.filter((x) => x.id !== id).concat([Object.assign({ id: id }, doc)]);
      K.db.doc('quizq/' + id).set(doc).then(() => K.toast('Saved'), K.writeFailed);
      ui.sheet = null; K.render();
    };
    return K.sheet(q ? 'Edit the question' : 'A question of your own', h('form', { class: 'stack', onsubmit: save },
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'About'), K.seg([['wine', 'Wine'], ['food', 'Food']], f.topic, (v) => { f.topic = v; K.render(); })),
      K.field('Question', inp('q', 'Which producer makes our house Mavrud?')),
      K.field('Right answer', inp('a')),
      K.field('Wrong answers', h('div', { class: 'stack tight' }, inp('w1', 'Wrong answer 1'), inp('w2', 'Wrong answer 2'), inp('w3', 'Wrong answer 3'))),
      K.field('Shown after answering', inp('why', 'A line that explains it (optional)')),
      h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'submit' }, 'Save'),
        q ? h('button', { class: 'btn danger', type: 'button', onclick: () => {
          D.quizq = D.quizq.filter((x) => x.id !== q.id);
          K.db.doc('quizq/' + q.id).delete().catch(K.writeFailed);
          ui.sheet = null; K.render(); K.toast('Question deleted');
        } }, 'Delete') : null)));
  };
})();
