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
  function foodQs() {
    const out = [], dishes = K.dishes(), ens = dishes.map((d) => d.en).filter(Boolean), names = dishes.map((d) => d.name);
    const allAl = (K.ALLERGENS || []).map((a) => a[0]);
    const whats = [];
    dishes.forEach((d) => (d.n.niche || []).forEach((x) => { if (x.what) whats.push(short(K.T(x.what), 80)); }));
    Object.keys(D.gloss).forEach((id) => { if (D.gloss[id].what) whats.push(short(K.T(D.gloss[id].what), 80)); });
    dishes.forEach((d) => {
      if (d.en && d.en !== d.name) out.push(mk('food', 'How do you say ' + d.name + ' in English?', d.en, ens.concat(['Chef’s special', 'Garden salad', 'Slow-cooked beef']), d.n.pitch && short(d.n.pitch, 140)));
      const al = K.dishAllergens(d).keys;
      if (al.length) {
        const a = al[Math.floor(Math.random() * al.length)];
        out.push(mk('food', 'Which allergen is in ' + d.name + '?', K.AL[a], allAl.filter((k) => !al.includes(k)).map((k) => K.AL[k]), d.name + ' has: ' + al.map((k) => K.AL[k]).join(', ') + '.'));
      }
      const others = [];
      dishes.forEach((x) => { if (x !== d) x.ings.forEach((i) => { if (!d.ings.some((j) => K.ingKey(j) === K.ingKey(i))) others.push(i); }); });
      const mine = d.ings.filter((i) => i.length < 40);
      if (others.length && mine.length >= 3) {
        const a = others[Math.floor(Math.random() * others.length)];
        const q = mk('food', 'Which of these is NOT in ' + d.name + '?', a, mine, 'In it: ' + mine.slice(0, 8).join(', ') + (mine.length > 8 ? '…' : '') + '.');
        if (q) out.push(q);
      }
      (d.n.niche || []).forEach((x) => {
        out.push(mk('food', 'Which dish has ' + x.n + '?', d.name, names, x.what));
        if (x.what) out.push(mk('food', 'What is ' + x.n + '?', short(K.T(x.what), 80), whats, 'In ' + d.name + '.'));
      });
      if (d.price) out.push(mk('food', 'How much is ' + d.name + '?', K.price(d.price), dishes.filter((x) => x.price).map((x) => K.price(x.price)).concat([+d.price + 2, +d.price - 2, +d.price + 4].filter((x) => x > 0).map((x) => K.price(String(x)))), ''));
      if (d.photo || K.dishArt(d)) out.push(mk('food', 'Which dish is this?', d.name, names, d.en, d.photo ? K.media(d.photo) : K.dishArt(d)));
    });
    Object.keys(D.gloss).forEach((id) => {
      const g = D.gloss[id];
      if (g.name && g.what) out.push(mk('food', 'What is ' + g.name + '?', short(K.T(g.what), 80), whats, g.en ? 'In English: ' + g.en + '.' : ''));
    });
    return out.filter(Boolean);
  }
  function bankQs(topic) {
    return BANK[topic].map((b) => mk(topic, b[0], b[1], b[2], b[3])).filter(Boolean)
      .concat(D.quizq.filter((q) => (q.topic || 'food') === topic).map((q) => mk(topic, q.q, q.a, q.wrong || [], q.why, q.photo ? K.media(q.photo) : '')).filter(Boolean));
  }
  /* a round: mostly questions about our own wines and dishes, topped up from the general ones */
  function round(topic) {
    const own = topic === 'wine' ? wineQs() : topic === 'food' ? foodQs() : wineQs().concat(foodQs());
    const gen = topic === 'all' ? bankQs('wine').concat(bankQs('food')) : bankQs(topic);
    const seen = {}, out = [];
    pickN(own, 7).concat(pickN(gen, ROUND)).forEach((q) => { if (out.length < ROUND && !seen[q.q]) { seen[q.q] = 1; out.push(q); } });
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
      const left = Math.max(0, SECONDS - (Date.now() - Q.t0) / 1000);
      const bar = document.getElementById('qz-time'), num = document.getElementById('qz-sec');
      if (bar) bar.style.transform = 'scaleX(' + (left / SECONDS) + ')';
      if (num) num.textContent = String(Math.ceil(left));
      if (left <= 0) answer(-1);
    }, 200);
  }
  function answer(i) {
    const Q = ui.quiz, q = Q.qs[Q.i];
    if (Q.picked != null) return;
    stopClock();
    const ok = i >= 0 && q.opts[i] === q.a, left = Math.max(0, SECONDS - (Date.now() - Q.t0) / 1000);
    const pts = ok ? 100 + Math.round(50 * left / SECONDS) : 0;
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
    body.append(K.pageHead('The quiz', mine.length ? 'Your best this week: ' + Math.max.apply(null, mine.map((s) => s.score)) + ' points' : 'Ten questions, twenty seconds each. Quick answers score more.', null, '', 'quiz-head'));
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
    const left = Math.max(0, SECONDS - (Date.now() - Q.t0) / 1000);
    const body = h('div', { class: 'wrap quiz-play' },
      h('div', { class: 'qp-top' },
        h('span', { class: 'mono' }, (Q.i + 1) + ' / ' + Q.qs.length),
        h('span', { class: 'qp-score mono' }, Q.score + ' pts'),
        h('span', { class: 'qp-sec mono', id: 'qz-sec' }, done ? '' : String(Math.ceil(left)))),
      h('div', { class: 'qp-timer' }, h('span', { id: 'qz-time', style: { transform: 'scaleX(' + (done ? 0 : left / SECONDS) + ')' } })),
      h('p', { class: 'kicker' }, q.topic === 'wine' ? 'Wine' : 'Food'),
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
