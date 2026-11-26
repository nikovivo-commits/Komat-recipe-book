/* The quiz: ten questions on the wines and drinks, the food or both, made from what is in the bibles (grapes,
   regions, labels, prices, pairings, the whiskies and other spirits, translations, allergens, the unusual
   ingredients) plus the floor manager's own questions and some general service knowledge. Quick answers score
   more; the board shows who knows best. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  /* ninety seconds a question: time to read it and think, for staff who are new to the list */
  const SECONDS = 90, ROUND = 10;
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
    /* whisky first, then the other spirits */
    drinks: [
      ['What makes a whisky a single malt?', 'It comes from one distillery and is made only from malted barley', ['It is aged in a single barrel', 'It is distilled only once', 'It is made from a single harvest'], 'Single means one distillery, malt means malted barley. A single barrel whisky is a different thing.'],
      ['What is bourbon mostly made from?', 'Corn (at least 51%)', ['Barley', 'Rye', 'Potatoes'], 'Bourbon is American whiskey made from at least 51% corn and aged in new charred oak barrels.'],
      ['Where does the smoky taste of an Islay whisky come from?', 'Peat smoke used to dry the malted barley', ['Charred barrels', 'Smoked water', 'A long time in the cask'], 'Peat is burnt to dry the barley and its smoke stays in the whisky. Lagavulin and Laphroaig are the classic examples.'],
      ['How long must Scotch whisky age before it can be called Scotch?', 'At least three years', ['At least one year', 'At least five years', 'At least ten years'], 'Three years in oak casks, in Scotland.'],
      ['A whisky bottle says “12 years”. What does the number mean?', 'The youngest whisky in the bottle is 12 years old', ['It is the average age of the whiskies in it', 'The oldest whisky in the bottle is 12 years old', 'It was bottled 12 years ago'], 'The age on the label is always that of the youngest whisky in the bottle.'],
      ['A guest orders a whisky “neat”. How do you serve it?', 'On its own: no ice, no water', ['Over ice', 'With soda water', 'Chilled, in a shot glass'], 'Neat means nothing added. You can offer a little water on the side.'],
      ['What does “on the rocks” mean?', 'Served over ice', ['Served warm', 'Served with soda water', 'Served without ice'], 'The rocks are the ice cubes.'],
      ['Why do some guests add a few drops of water to their whisky?', 'It opens up the aromas and softens the alcohol', ['It makes the whisky sweeter', 'It makes the whisky stronger', 'It keeps the whisky cold'], 'A little water lowers the strength and lets more of the aromas come out.'],
      ['Which of these is a whisky region of Scotland?', 'Speyside', ['Cognac', 'Kentucky', 'Jerez'], 'The whisky regions of Scotland are Speyside, the Highlands, the Lowlands, Islay and Campbeltown.'],
      ['Tennessee whiskey has one step that bourbon does not. Which?', 'It is filtered through maple charcoal before ageing', ['It is distilled three times', 'It is aged in sherry casks', 'It is made from barley only'], 'The spirit drips slowly through sugar maple charcoal before it goes into the barrel. Gentleman Jack is filtered this way twice.'],
      ['Which countries usually write “whiskey”, with an e?', 'Ireland and the USA', ['Scotland and Japan', 'Scotland and Canada', 'Japan and Taiwan'], 'Scotland, Japan and Canada write whisky; Ireland and the USA mostly write whiskey.'],
      ['What is cognac made from?', 'Grapes: it is a brandy from the Cognac region of France', ['Barley', 'Sugar cane', 'Apples'], 'Cognac is white wine distilled twice and aged in oak.'],
      ['What does XO on a cognac mean?', 'Extra old: aged at least ten years', ['Extra oak: aged in new barrels', 'A blend of exactly ten cognacs', 'Bottled at cask strength'], 'VS is aged at least two years, VSOP at least four, XO at least ten.'],
      ['What gives gin its main flavour?', 'Juniper berries', ['Aniseed', 'Hops', 'Vanilla'], 'Without juniper it is not gin; the other botanicals vary from one gin to the next.'],
      ['What is tequila made from?', 'Blue agave', ['Sugar cane', 'Corn', 'Cactus fruit'], 'Tequila is made in Mexico from the blue agave plant, which is not a cactus.'],
      ['What is rum made from?', 'Sugar cane: its juice or molasses', ['Wine grapes', 'Barley', 'Agave'], 'Most rum is made from molasses, what is left when sugar is made from the cane.'],
      ['Troyan is the Bulgarian town best known for which rakia?', 'Plum', ['Grape', 'Apricot', 'Quince'], 'Troyan plum rakia has been made there for centuries.'],
      ['Why do ouzo, mastika and Pernod turn cloudy when water is added?', 'The anise oils come out of the alcohol', ['The sugar crystallises', 'The alcohol evaporates', 'The water is too cold'], 'Anise oils dissolve in alcohol but not in water, so the drink turns milky.'],
      ['What is vermouth?', 'A fortified wine flavoured with herbs', ['A spirit distilled from grain', 'A fruit brandy', 'A bitter orange liqueur'], 'Vermouth is wine with added spirit, herbs and spices; wormwood gives it its name.'],
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
  /* ---------- answers that would also be true ----------
     A wrong answer must be plainly wrong. A region inside the right one or around it, a blend that shares a
     grape with the right one, a temperature that touches the right one, a wine the house would also pour with
     the dish: none of these is offered as a wrong answer. */
  const flat = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  /* where a region lies: [country, the areas it belongs to]. Two regions that share an area are never the right
     and a wrong answer together. Bulgaria's traditional regions and its two PGIs overlap: the Thracian Lowlands
     PGI takes in the Struma valley, the Rose valley and the southern coast, the Danubian Plain PGI the northern
     coast; Sakar and the eastern part lie inside the Thracian valley, the north-west inside the Danubian plain. */
  const GEO = {
    'Thracian Valley': ['Bulgaria', 'thrace'], 'East Thracian Valley': ['Bulgaria', 'thrace'], 'Eastern Thracian Valley': ['Bulgaria', 'thrace'], Sakar: ['Bulgaria', 'thrace'],
    'Thracian Lowlands': ['Bulgaria', 'thrace', 'struma', 'rose', 'sea-south'], 'Struma Valley': ['Bulgaria', 'struma'], 'Rose Valley': ['Bulgaria', 'rose'],
    'Black Sea region': ['Bulgaria', 'sea-north', 'sea-south'], 'Black Sea coast': ['Bulgaria', 'sea-north', 'sea-south'],
    'Danubian Plain': ['Bulgaria', 'danube', 'sea-north'], 'Danube Plain': ['Bulgaria', 'danube', 'sea-north'], 'North-western Bulgaria': ['Bulgaria', 'danube'],
    Burgundy: ['France', 'burgundy'], Chablis: ['France', 'burgundy'], Beaujolais: ['France', 'burgundy'], Champagne: ['France', 'champagne'], 'Loire Valley': ['France', 'loire'],
    'Rhône Valley': ['France', 'rhone'], Languedoc: ['France', 'languedoc'], 'Côtes du Roussillon': ['France', 'languedoc'], 'Côtes de Provence': ['France', 'provence'],
    Bordeaux: ['France', 'bordeaux'], 'Saint-Émilion, Bordeaux': ['France', 'bordeaux'],
    Piedmont: ['Italy', 'piedmont'], Barolo: ['Italy', 'piedmont'], Tuscany: ['Italy', 'tuscany'], 'Collio DOC': ['Italy', 'friuli'], Valdobbiadene: ['Italy', 'veneto'],
    Puglia: ['Italy', 'puglia'], Sardinia: ['Italy', 'sardinia'], Sicily: ['Italy', 'sicily'],
    Rioja: ['Spain', 'rioja'], 'Penedès': ['Spain', 'catalonia'], 'Rías Baixas': ['Spain', 'galicia'], Jerez: ['Spain', 'andalusia'],
    Mosel: ['Germany', 'mosel'], 'Mosel Valley': ['Germany', 'mosel'], Krems: ['Austria', 'lower-austria'], Epanomi: ['Greece', 'macedonia'],
  };
  /* the words that name a place or a wine, without the ones every name has */
  const PLAIN = /^(valley|plain|region|coast|hills|lowlands|north|south|east|west|northern|southern|eastern|western|upper|lower|central|cotes|coteaux|saint|terre|rive|superiore|classico|riserva|grand|premier|blanc|rouge|rosso|bianco|wine|vino)$/;
  const nameWords = (s) => flat(s).split(/[^a-zа-я]+/).filter((w) => w.length >= 4 && !PLAIN.test(w)).map((w) => w.slice(0, 5));
  const sharesWord = (a, b) => { const x = nameWords(b); return nameWords(a).some((w) => x.includes(w)); };
  const placeOf = (name, land) => { const g = GEO[name]; return g ? { land: g[0], areas: g.slice(1), known: true } : { land: land || '', areas: [], known: false }; };
  /* may region x stand as a wrong answer beside region a? Not when they share a word or an area. A region the
     table does not know could lie inside another of its own country, so beside it only a foreign one is safe. */
  const apart = (a, aLand, x, xLand) => {
    if (!x || x === a || sharesWord(a, x)) return false;
    const p = placeOf(a, aLand), q = placeOf(x, xLand);
    if (p.areas.some((t) => q.areas.includes(t))) return false;
    return (p.known && q.known) || (!!p.land && !!q.land && p.land !== q.land);
  };
  /* one grape under two names counts as one */
  const SAME_GRAPE = { garnacha: 'grenache', 'grenache noir': 'grenache', 'grenache gris': 'grenache', 'grenache blanc': 'grenache', rolle: 'vermentino', shiraz: 'syrah', 'pinot gris': 'pinot grigio',
    zinfandel: 'primitivo', 'shiroka melnik': 'melnik', 'shiroka melnishka loza': 'melnik', viura: 'macabeo', mazuelo: 'carignan', carinena: 'carignan', 'pinot meunier': 'meunier',
    'muscat of alexandria': 'zibibbo', monastrell: 'mourvedre', mataro: 'mourvedre', 'tinta de toro': 'tempranillo', 'tinto fino': 'tempranillo', kadarka: 'gamza', 'red misket': 'misket cherven',
    'muscat blanc': 'tamyanka', 'white mavrud': 'mavrud', 'mavrud blanc': 'mavrud', muscat: 'tamyanka', 'sauvignon': 'sauvignon blanc', 'cabernet': 'cabernet sauvignon' };
  const grapesOf = (s) => flat(s).split(/,|\s+and\s+|&|\/|\+/).map((g) => g.replace(/\d+\s*%/g, '').trim()).filter(Boolean).map((g) => SAME_GRAPE[g] || g);
  const sharesGrape = (a, b) => { const x = grapesOf(b); return grapesOf(a).some((g) => x.includes(g)); };
  /* two temperature ranges that overlap or touch (8–10 and 10–12) are both right at one point */
  const span = (s) => { const m = String(s || '').match(/(\d+(?:[.,]\d+)?)\D+(\d+(?:[.,]\d+)?)/); return m ? [parseFloat(m[1].replace(',', '.')), parseFloat(m[2].replace(',', '.'))] : null; };
  const tempsApart = (a, b) => { const x = span(a), y = span(b); return !x || !y ? String(a) !== String(b) : x[1] < y[0] || y[1] < x[0]; };

  /* The wines only: the whiskies, the other spirits, the beers and the rest have questions of their own
     (drinkQs), so a wine question never offers a whisky as an answer. */
  /* how hard a kind of wine question is; the kinds a waiter needs most come up more often (WEIGHT) */
  const WLEVEL = { 'w-pair': 2, 'w-dish': 2, 'w-nose': 2, 'w-palate': 2, 'w-say': 2, 'w-made': 3, 'w-app': 2, 'w-typical': 2, 'w-typical-of': 2, 'w-fromregion': 2, 'w-madefrom': 2 };
  const WEIGHT = { 'w-pair': 3, 'w-dish': 3, 'w-nose': 2, 'w-palate': 2, 'w-say': 2, 'w-grape': 2 };
  /* two tasting notes that share two or more of their words (“blackberry, pepper, violet”) are too alike to be
     the right and a wrong answer */
  const alike = (a, b, n) => { const x = nameWords(b); return nameWords(a).filter((w) => x.includes(w)).length >= (n || 2); };
  /* a note that only says how a wine feels (“juicy and smooth, with a fresh finish”) fits too many wines to ask about */
  const VAGUE = /^(body|bodie|finis|fresh|refre|long|lengt|smoot|juicy|firm|round|soft|light|mediu|full|acidi|tanni|balan|elega|silky|rich|crisp|clean|lively|ripe|fine|well|good|with|pleas|struc|textu|mouth|palat|taste|flavo|notes|hint|touch|very|quite|some)$/;
  const telling = (t) => nameWords(t).filter((w) => !VAGUE.test(w)).length >= 2;
  function wineQs() {
    const out = [], wines = D.wines.filter((w) => !w.off && !w.stockOnly && !K.isDrink(w));
    const add = (kind, q) => { if (q) { q.kind = kind; q.level = WLEVEL[kind] || 1; out.push(q); } };
    const title = K.wineTitle, lowFirst1 = (t) => t.charAt(0).toLowerCase() + t.slice(1);
    const isBg = (w) => K.origin && K.origin(w) && K.origin(w).bg, isFo = (w) => K.origin && K.origin(w) && !K.origin(w).bg;
    const home = wines.filter(isBg).map(title), foreign = wines.filter(isFo).map(title);
    /* the dishes and the house's wines for each, worked out once (not once per wine and dish) */
    const dishes = K.dishes(), poured = new Map(dishes.map((d) => [d, K.housePairs ? K.housePairs(d) : null]));
    const goes = (d, w) => (poured.get(d) ? poured.get(d).includes(w) : (d.n.pairs || []).includes(w.id) || w.pairs.includes(d.id));
    /* a wine the app itself would suggest with a dish (its style suits that kind of dish) is not a wrong answer */
    const styleOf = new Map(wines.map((w) => [w, K.wineStyle ? K.wineStyle(w) : ''])), kindOf = new Map(dishes.map((d) => [d, (K.dishKind && K.dishKind(d)) || null]));
    const suits = (d, w) => goes(d, w) || !!(kindOf.get(d) && styleOf.get(w) && kindOf.get(d)[2].includes(styleOf.get(w)));
    const lands = wines.map((x) => x.country).filter(Boolean).concat(['Bulgaria']);
    const cut = (t, n) => short(K.T(t), n).replace(/\.$/, '');
    const noseOf = (x) => cut(x.nose, 70).toLowerCase(), palateOf = (x) => cut(x.palate, 90).toLowerCase(), madeOf = (x) => cut(x.made, 90).toLowerCase(), head = (x) => flat(x.made).slice(0, 40);
    const only = (l, f, w) => l.filter((x) => f(x) === f(w)).length === 1;
    /* wines of other grapes whose own note reads differently */
    /* (a sparkling, rosé, sweet or orange wine is only set against wines of another kind: two sparkling wines
       both have “lively bubbles”) */
    const broad = (w) => w.colour === 'red' || w.colour === 'white';
    const others = (w, k) => wines.filter((x) => x !== w && x[k] && !sharesGrape(w.grapes, x.grapes) && !alike(w[k], x[k]) && (broad(w) || x.colour !== w.colour)).map(title);
    const APPS = [['Bordeaux AOC', 'Bordeaux'], ['Barolo DOCG', 'Piedmont'], ['Rioja DOCa', 'Rioja'], ['Chablis AOC', 'Chablis'], ['Prosecco DOC', 'Valdobbiadene']];
    const KINDS = { red: ['red'], white: ['white'], rose: ['rose'], orange: ['orange'], sparkling: ['sparkling', 'white', 'rose'], sweet: ['sweet', 'white', 'red', 'orange'] };
    const glass = wines.filter((x) => x.byGlass && x.glassPrice), bottle = wines.filter((x) => !x.byGlass);
    /* what a grape usually smells of, and which grape a smell belongs to: from the wines that have no notes of
       their own. Two grapes whose usual smells read alike are never offered against each other. */
    const seen = {}, typical = [];
    wines.forEach((w) => { const n = K.wineNotes ? K.wineNotes(w) : null; if (n && n.typical && n.grape && !seen[n.grape]) { seen[n.grape] = 1; typical.push(n); } });
    typical.forEach((n) => {
      const far = typical.filter((x) => x !== n && !alike(n.nose, x.nose, 1));
      add('w-typical', mk('wine', 'What does ' + n.grape + ' usually smell of?', n.nose, far.map((x) => x.nose), K.T(n.palate) + '.'));
      add('w-typical-of', mk('wine', 'Which grape usually smells of ' + lowFirst1(K.T(n.nose)).replace(/\.$/, '') + '?', n.grape, far.map((x) => x.grape), K.T(n.palate) + '.'));
    });
    wines.forEach((w) => {
      const t = title(w), o = K.origin ? K.origin(w) : null;
      /* a name two wines share (“Chardonnay”) is asked about with its producer */
      const nm = only(wines, (x) => x.name, w) ? w.name : t;
      /* no wrong answer shares a grape with the right one (Mavrud beside “Mavrud, Rubin”) */
      if (w.grapes) add('w-grape', mk('wine', 'Which grape is ' + t + ' made from?', w.grapes, wines.map((x) => x.grapes).concat(GRAPES).filter((g) => !sharesGrape(w.grapes, g)), w.story && short(K.T(w.story), 140)));
      /* the same the other way round, for a wine of one grape whose name does not say it */
      if (w.grapes && grapesOf(w.grapes).length === 1 && !tells(t, w.grapes)) add('w-madefrom', mk('wine', 'Which of these wines is made from ' + w.grapes + '?', t, wines.filter((x) => x.grapes && !sharesGrape(w.grapes, x.grapes)).map(title), w.say));
      /* no wrong answer lies inside the right region or around it, and none is a country */
      if (w.region) add('w-region', mk('wine', 'Where does ' + t + ' come from?', w.region, wines.filter((x) => apart(w.region, w.country, x.region, x.country)).map((x) => x.region).concat(REGIONS.filter((r) => apart(w.region, w.country, r, ''))).filter((r) => !lands.includes(r)), w.region + (w.country ? ', ' + w.country : '') + '.'));
      if (w.region && !tells(t, w.region)) add('w-fromregion', mk('wine', 'Which of these wines comes from: ' + w.region + '?', t, wines.filter((x) => apart(w.region, w.country, x.region, x.country)).map(title), w.region + (w.country ? ', ' + w.country : '') + '.'));
      if (w.label) add('w-label', mk('wine', 'Whose label is this?', t, wines.map(title), w.say, K.media(w.label)));
      if (w.byGlass && w.glassPrice) add('w-price', mk('wine', 'How much is a glass of ' + nm + '?', K.price(w.glassPrice), wines.filter((x) => x.glassPrice).map((x) => K.price(x.glassPrice)).concat([+w.glassPrice + 1, +w.glassPrice + 2, +w.glassPrice - 1, +w.glassPrice + 3].filter((x) => x > 0).map((x) => K.price(String(x)))), 'By the glass, ' + K.glassMl(w) + ' ml.'));
      if (w.bottlePrice) add('w-price', mk('wine', 'How much is a bottle of ' + nm + '?', K.price(w.bottlePrice), wines.filter((x) => x.bottlePrice).map((x) => K.price(x.bottlePrice)).concat([+w.bottlePrice + 4, +w.bottlePrice - 4, +w.bottlePrice + 8].filter((x) => x > 0).map((x) => K.price(String(x)))), ''));
      /* which wines we pour by the glass */
      if (glass.includes(w)) add('w-glass', mk('wine', 'Which of these wines do we pour by the glass?', t, bottle.map(title), 'By the glass, ' + K.glassMl(w) + ' ml.'));
      if (w.serve) add('w-temp', mk('wine', 'At what temperature do we serve ' + nm + '?', w.serve, wines.map((x) => x.serve).concat(TEMPS).filter((x) => tempsApart(w.serve, x)), w.glass ? 'In a ' + w.glass.toLowerCase() + '.' : ''));
      /* what kind of wine it is, when its name does not say; a sparkling wine is white or rosé too, a sweet one
         has a colour too, so those are not offered against each other */
      if (KINDS[w.colour] && !/ros[eé]|brut|blanc|rouge|red|white|sparkling|prosecco|cava|champagne|cr[eé]mant|ice|sweet|dos[eé]|nectar|n[eé]ctar/i.test(t)) add('w-kind', mk('wine', 'What kind of wine is ' + t + '?', K.COL[w.colour], Object.keys(KINDS).filter((k) => !KINDS[w.colour].includes(k) && !KINDS[k].includes(w.colour)).map((k) => K.COL[k]), w.say));
      /* who makes it, when one wine only has that name and the name does not say */
      if (w.producer && only(wines, (x) => x.name, w) && !tells(w.name, w.producer)) add('w-maker', mk('wine', 'Who makes ' + w.name + '?', w.producer, wines.map((x) => x.producer), w.say));
      /* how it smells, how it tastes, how we describe it: the wrong answers are wines of other grapes whose own
         notes read differently */
      if (w.nose && only(wines.filter((x) => x.nose), noseOf, w)) add('w-nose', mk('wine', 'Which wine smells of ' + noseOf(w) + '?', t, others(w, 'nose'), w.palate));
      if (w.palate && telling(w.palate) && only(wines.filter((x) => x.palate), palateOf, w)) add('w-palate', mk('wine', 'Which wine tastes like this: ' + palateOf(w) + '?', t, others(w, 'palate'), w.nose));
      if (w.say && !tells(w.say, t)) add('w-say', mk('wine', 'Which wine is this: “' + cut(w.say, 130) + '”?', t, others(w, 'say'), w.region + (w.country ? ', ' + w.country : '') + '.'));
      if (o && !o.bg && w.country) {
        add('w-country', mk('wine', 'Which country is ' + t + ' from?', w.country, wines.map((x) => x.country).concat(['Portugal', 'Argentina', 'Chile', 'Bulgaria']), o.where + '.'));
        if (!tells(t, w.country)) add('w-fromcountry', mk('wine', 'Which of these wines is from ' + w.country + '?', t, wines.filter((x) => x.country && x.country !== w.country).map(title), o.where + '.'));
      }
      if (o && foreign.length >= 3 && home.length >= 3) add('w-bulgarian', o.bg ? mk('wine', 'Which of these wines is Bulgarian?', t, foreign, 'From ' + o.where + '.') : mk('wine', 'Which of these wines is not Bulgarian?', t, home, 'From ' + o.where + '.'));
      /* an appellation of the same region (Chablis beside Bourgogne, Sicilia beside Terre Siciliane) is no wrong answer */
      if (w.appellation) add('w-app', mk('wine', 'Which appellation is ' + t + '?', w.appellation, wines.filter((x) => x.appellation && apart(w.region, w.country, x.region, x.country)).map((x) => x.appellation)
        .concat(APPS.filter((x) => apart(w.region, w.country, x[1], '')).map((x) => x[0])).filter((x) => !sharesWord(w.appellation, x)), w.region));
      /* the wrong answers are wines whose own making is written down and starts differently */
      if (w.made && only(wines.filter((x) => x.made), madeOf, w)) add('w-made', mk('wine', 'Which wine is made like this: ' + madeOf(w) + '?', t, wines.filter((x) => x !== w && x.made && head(x) !== head(w)).map(title), w.say));
      dishes.forEach((d) => {
        if (goes(d, w)) {
          const why = (d.n.pairWhy || {})[w.id] || d.n.pairText || w.say;
          /* the other right answers are left out of the wrong ones: a dish has several wines, a wine several dishes;
             and so are the wines whose style suits the dish, which the dish's page offers too */
          add('w-pair', mk('wine', 'Which wine do we pour with ' + K.dn(d) + '?', t, wines.filter((x) => !suits(d, x)).map(title), why));
          add('w-dish', mk('wine', 'Which dish do we pour ' + t + ' with?', K.dn(d), dishes.filter((x) => !suits(x, w)).map((x) => K.dn(x)), why));
        }
      });
    });
    return out;
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
  /* two names for nearly the same thing (“jus” and “mushroom jus”, “ponzu” and “sesame ponzu”): never the right
     and a wrong answer together, since the wrong one would be half true */
  const FILLER = /^(and|with|the|sauce|from|сос|със|без|или)$/;
  const bits = (s) => lc(s).split(/[^a-zа-я]+/).filter((w) => w.length >= 3 && !FILLER.test(w)).map((w) => (w.length >= 5 ? w.slice(0, 5) : w));
  const near = (a, b) => { const x = bits(b); return bits(a).some((w) => x.includes(w)); };
  /* how hard a kind of question is: 3 for what takes knowing the whole plate or judging a guest's case, 2 for what
     takes understanding a dish, 1 for what is learnt by heart. Points and time follow (see FACTOR, TIME). */
  const LEVEL = { guest: 3, swap: 3, plan: 3, missing: 3, exact: 3, shared: 3, allergenset: 3, change: 2, where: 2, canbe: 2, whatisrev: 2, oddone: 2, allthree: 2, sauce: 2, tasting: 2, house: 2, dwhich: 2, dwhat: 2 };
  /* ---------- the drinks that are not wine ----------
     Whisky first, then the other spirits: where a bottle is from, what it is, which one fits a description, how
     big its measure is and what it costs. The wrong answers are always drinks of the same sort, never wines.
     [how the drinks list names the sort, one, many, the answer to “what kind of drink is it”] */
  const FAMILY = [
    [/whisk|bourbon/i, 'whisky', 'whiskies', 'Whisky'], [/rakia/i, 'rakia', 'rakias', 'Rakia'], [/vodka/i, 'vodka', 'vodkas', 'Vodka'], [/\brum\b/i, 'rum', 'rums', 'Rum'],
    [/\bgin\b/i, 'gin', 'gins', 'Gin'], [/tequila/i, 'tequila', 'tequilas', 'Tequila'], [/brandy|cognac/i, 'brandy', 'brandies', 'Brandy or cognac'],
  ];
  const BRITAIN = ['Scotland', 'England', 'Wales', 'United Kingdom'];
  /* two names for one place, so never the right and a wrong answer together (Scotland is in the United Kingdom) */
  const sameLand = (a, b) => a === b || (BRITAIN.includes(a) && BRITAIN.includes(b));
  /* rakia is a fruit brandy: neither is offered as a wrong answer for the other */
  const akin = (a, b) => (a === 'rakia' && b === 'brandy') || (a === 'brandy' && b === 'rakia');
  /* a description without its article and full stop, to see whether one says the same as another */
  const gist = (w) => lc(w.say).replace(/^(an?|the)\s+/, '').replace(/[.!]+$/, '').trim();
  /* a place inside another: a Speyside malt is a Highland malt too, so it is no wrong answer for “a Highland malt” */
  const INSIDE = [['speyside', 'highland']];
  const fits = (x, w) => { const a = gist(x), b = gist(w); return !a || !b || a.includes(b) || b.includes(a) || INSIDE.some((p) => a.includes(p[0]) && b.includes(p[1])); };
  const lowFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const the = (c) => (/^(USA|United Kingdom|Netherlands)$/.test(c) ? 'the ' + c : c);
  function drinkQs() {
    const out = [], on = D.wines.filter((w) => !w.off && !w.stockOnly && K.isDrink(w));
    const strong = on.filter((w) => w.colour === 'spirit' || w.colour === 'liqueur'), lands = (l) => l.map((x) => x.country).filter(Boolean);
    const famOf = (w) => FAMILY.find((f) => f[0].test(w.style || '')) || null;
    const add = (kind, w, q) => { if (q) { const f = famOf(w); q.kind = kind; q.level = LEVEL[kind] || 1; q.drink = true; q.whisky = !!(f && f[1] === 'whisky'); out.push(q); } };
    const price = (w, pool) => {
      if (!w.glassPrice) return;
      const near = [+w.glassPrice + 1, +w.glassPrice + 2, +w.glassPrice - 1, +w.glassPrice + 3].filter((x) => x > 0).map((x) => K.price(String(x)));
      add('dprice', w, mk('wine', 'How much is ' + (w.measure ? w.measure + ' of ' : '') + w.name + '?', K.price(w.glassPrice), pool.filter((x) => x.glassPrice).map((x) => K.price(x.glassPrice)).concat(near), w.say));
    };
    /* which country: the wrong answers from the same sort of drink first, from the whole list when those are too few */
    const from = (w, list) => {
      const t = K.wineTitle(w);
      if (!w.country || tells(t, w.country)) return;
      const own = lands(list).filter((c) => !sameLand(c, w.country)), few = own.filter((c, i) => own.indexOf(c) === i).length < 3;
      add('dfrom', w, mk('wine', 'Which country is ' + t + ' from?', w.country, (few ? own.concat(lands(strong)) : own).filter((c) => !sameLand(c, w.country)), w.say));
    };
    FAMILY.forEach((f) => {
      const list = strong.filter((w) => famOf(w) === f);
      if (!list.length) return;
      list.forEach((w) => {
        const t = K.wineTitle(w);
        from(w, list);
        if (w.country && !tells(t, w.country)) add('dwhich', w, mk('wine', 'Which of these ' + f[2] + ' is from ' + the(w.country) + '?', t, list.filter((x) => x.country && !sameLand(x.country, w.country)).map(K.wineTitle), w.say));
        /* the wrong answers are drinks whose own description says something else */
        if (w.say && !tells(w.say, t)) add('dwhat', w, mk('wine', 'Which ' + f[1] + ' is this: ' + lowFirst(String(K.T(w.say)).trim().replace(/[.!]+$/, '')) + '?', t, list.filter((x) => x !== w && !fits(x, w)).map(K.wineTitle), w.country ? 'From ' + the(w.country) + '.' : ''));
        if (!tells(t, f[1] + ' ' + f[3] + ' ' + (w.style || ''))) add('dkind', w, mk('wine', 'What kind of drink is ' + t + '?', f[3], FAMILY.filter((x) => x !== f && !akin(x[1], f[1])).map((x) => x[3]), w.say));
        price(w, list);
      });
      /* the measure, when the whole sort is poured the same */
      const sizes = list.map((w) => w.measure).filter((m, i, l) => m && l.indexOf(m) === i);
      if (sizes.length === 1) add('dmeasure', list[0], mk('wine', 'How many ml do we pour for one ' + f[1] + '?', sizes[0], ['20 ml', '25 ml', '30 ml', '40 ml', '50 ml', '100 ml'], 'On the drinks list: ' + f[3] + ', ' + sizes[0] + '.'));
    });
    /* liqueurs, digestifs, anise and the rest of the strong ones: a description names its country, so the wrong
       answers come from other countries */
    const rest = strong.filter((w) => !famOf(w));
    rest.forEach((w) => {
      const t = K.wineTitle(w);
      from(w, rest);
      if (w.say && w.country && !tells(w.say, t)) add('dwhat', w, mk('wine', 'Which drink is this: ' + lowFirst(String(K.T(w.say)).trim().replace(/[.!]+$/, '')) + '?', t, rest.filter((x) => x !== w && x.country && !sameLand(x.country, w.country) && !fits(x, w)).map(K.wineTitle), 'From ' + the(w.country) + '.'));
      price(w, rest);
    });
    /* beer, soft and hot drinks: what they cost */
    const light = on.filter((w) => w.colour !== 'spirit' && w.colour !== 'liqueur');
    light.forEach((w) => price(w, light));
    return out;
  }
  /* one question of each kind in turn, so a round is not three prices */
  function byKind(qs, n, weight) {
    const by = {}, out = [];
    qs.forEach((q) => { (by[q.kind] = by[q.kind] || []).push(q); });
    Object.keys(by).forEach((k) => { by[k] = shuffle(by[k]); });
    /* a random order in which a kind of weight 3 comes early three times as often */
    const order = (l) => l.map((k) => [k, Math.pow(Math.random(), 1 / ((weight && weight[k]) || 1))]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
    let kinds = order(Object.keys(by));
    while (out.length < n && kinds.length) {
      kinds.forEach((k) => { const q = by[k].shift(); if (q && out.length < n && !out.some((o) => o.q === q.q)) out.push(q); });
      kinds = kinds.filter((k) => by[k].length);
    }
    return out;
  }
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
        add('where', mk('food', 'Where is the ' + lc(K.AL[k]) + ' in ' + d.name + '?', src[0], items.filter((i) => !K.allergensIn(i).includes(k) && !src.some((s) => lc(s) === lc(i) || near(s, i))), K.T(K.AL[k]) + ': ' + src.slice(0, 3).join(', ') + '.'));
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
      /* a part of another plate that is close to one of this plate's own is not used as a wrong answer */
      const far = foreign.filter((f) => !x.p.some((i) => near(i, f)));
      if (hide) add('missing', mk('food', 'On the menu ' + x.d.name + ' is: ' + x.p.filter((i) => i !== hide).join(', ') + ', and one more thing. What is it?', hide, far, full(x)));
      /* the whole line, against three with one part swapped for something from another plate */
      if (far.length >= 3) add('exact', mk('food', 'Which line is ' + x.d.name + ', exactly as on the menu?', x.p.join(', '),
        shuffle(far).slice(0, 3).map((f, i) => { const p = x.p.slice(); p[(i + Math.floor(Math.random() * p.length)) % p.length] = f; return p.join(', '); }), ''));
      /* three of its parts, without its name; a dish that has all three too is not a wrong answer */
      const three = shuffle(x.p.filter((i) => !tells(i, nm))).slice(0, 3);
      if (three.length === 3) add('allthree', mk('food', 'Which dish has ' + three[0] + ', ' + three[1] + ' and ' + three[2] + '?', x.d.name, dishes.filter((y) => y === x.d || !three.every((i) => onPlate(y, i))).map((y) => y.name), full(x)));
    });
    /* a part two dishes share */
    const sharedSeen = {};
    shuffle(plates).forEach((a, i, l) => l.slice(i + 1).forEach((b) => {
      const both = a.p.filter((x) => b.p.some((y) => lc(y) === lc(x)));
      if (!both.length || (sharedSeen[lc(both[0])] = (sharedSeen[lc(both[0])] || 0) + 1) > 2) return;
      add('shared', mk('food', 'Which of these is in both ' + a.d.name + ' and ' + b.d.name + '?', both[0], a.p.concat(b.p).filter((x) => !both.some((y) => lc(y) === lc(x) || near(y, x))), ''));
    }));
    /* the sauce */
    const SAUCE = /сос|(^|\s)жу($|\s)|винегрет|дресинг|холандез|бьор блан|понзу|sauce|\bjus\b|vinaigrette|dressing|hollandaise|beurre blanc|ponzu/i;
    const sauces = parts.filter((i) => SAUCE.test(i));
    plates.forEach((x) => { const s = x.p.filter((i) => SAUCE.test(i)); if (s.length === 1) add('sauce', mk('food', 'Which sauce comes with ' + x.d.name + '?', s[0], sauces.filter((i) => !onPlate(x.d, i) && !near(s[0], i)), full(x))); });
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
    /* a dish that has something close to the ingredient (mushroom jus, asked about jus) counts as having it */
    const holds = (y, name) => y.ings.concat(String(y.n.menuBg || '').split(/,\s*/), String(y.n.menuEn || '').split(/,\s*/), (y.n.niche || []).map((z) => z.n)).some((i) => i && near(i, name));
    dishes.forEach((d) => {
      (d.n.niche || []).forEach((x) => {
        if (!tells(x.n + ' ' + (K.en(x.n) || ''), d.name + ' ' + (d.en || ''))) add('has', mk('food', 'Which dish has ' + x.n + '?', d.name, dishes.filter((y) => y === d || (!has(y, x.n) && !holds(y, x.n))).map((y) => y.name), x.what ? bare(x.what) : ''));
      });
      if (d.en && d.en !== d.name && !tells(d.name, d.en)) add('translate', mk('food', 'How do you say ' + d.name + ' in English?', d.en, ens.concat(['Chef’s special', 'Garden salad', 'Slow-cooked beef']), d.n.pitch && short(K.T(d.n.pitch), 140)));
      const al = K.dishAllergens(d).keys;
      if (al.length) {
        const a = one(al);
        add('allergen', mk('food', 'Which allergen is in ' + d.name + '?', K.AL[a], allAl.filter((k) => !al.includes(k) && !K.menuAllergens(d)[k]).map((k) => K.AL[k]), d.name + ' has: ' + al.map((k) => K.AL[k]).join(', ') + '.'));
      }
      const others = [];
      dishes.forEach((x) => { if (x !== d) x.ings.forEach((i) => { if (!d.ings.some((j) => K.ingKey(j) === K.ingKey(i)) && !has(d, i) && !holds(d, i)) others.push(i); }); });
      const mine = d.ings.filter((i) => i.length < 40);
      if (others.length && mine.length >= 3) add('oddone', mk('food', 'Which of these is NOT in ' + d.name + '?', one(others), mine, 'In it: ' + mine.slice(0, 8).join(', ') + (mine.length > 8 ? '…' : '') + '.'));
      if (d.price) add('price', mk('food', 'How much is ' + d.name + '?', K.price(d.price), dishes.filter((x) => x.price).map((x) => K.price(x.price)).concat([+d.price + 2, +d.price - 2, +d.price + 4].filter((x) => x > 0).map((x) => K.price(String(x)))), ''));
      if (d.photo || K.dishArt(d)) add('photo', mk('food', 'Which dish is this?', d.name, names, d.en, d.photo ? K.media(d.photo) : K.dishArt(d)));
    });
    return out;
  }
  /* every food question the book can make right now, with its kind: for looking over the quiz, and for the tests */
  K.quizFood = foodQs;
  K.quizWine = wineQs;
  K.quizDrinks = drinkQs;
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
  const FACTOR = [1, 1, 1.5, 2], TIME = [SECONDS, SECONDS, SECONDS, SECONDS], LEVELS = ['', 'Easy', 'Medium', 'Hard'];
  const secsOf = (q) => TIME[(q && q.level) || 1], worth = (q) => Math.round(150 * FACTOR[(q && q.level) || 1]);
  function bankQs(topic) {
    /* the drinks are part of the wine round: their questions count for it, and say “Drinks” above the question */
    if (topic === 'drinks') return BANK.drinks.map((b) => { const q = mk('wine', b[0], b[1], b[2], b[3]); if (q) { q.drink = true; q.whisky = /whisk|bourbon|scotch/i.test(b[0]); } return q; }).filter(Boolean);
    return BANK[topic].map((b) => mk(topic, b[0], b[1], b[2], b[3])).filter(Boolean)
      .concat(D.quizq.filter((q) => (q.topic || 'food') === topic && topic !== 'food').map((q) => mk(topic, q.q, q.a, q.wrong || [], q.why, q.photo ? K.media(q.photo) : '')).filter(Boolean));
  }
  /* ---------- the big book of general questions ----------
     Well over a thousand questions of general knowledge (grapes and how they taste, Bulgarian wine, regions,
     winemaking, tasting and service, spirits, the bar, cooking, ingredients, allergens and table service, food
     culture), in a file of its own for each language: floor/data/quiz-en.json and quiz-bg.json, fetched when the
     quiz page is first opened and kept for offline use. A question there is
     [question, answer, [three wrong answers], why, level, kind, subject]; both files hold the same questions
     in the same order. Until the file has arrived (or if it cannot), the short lists in BANK stand in. */
  const SIDE = { grapes: 'wine', bulgaria: 'wine', regions: 'wine', winemaking: 'wine', service: 'wine', spirits: 'drinks', bar: 'drinks', cooking: 'food', ingredients: 'food', allergens: 'food', cuisines: 'food' };
  let book = null, bookLang = '', loading = false;
  function loadBook() {
    if (loading || (book && bookLang === K.flang) || typeof fetch !== 'function') return;
    loading = true;
    const lang = K.flang;
    fetch('floor/data/quiz-' + (lang === 'bg' ? 'bg' : 'en') + '.json').then((r) => (r.ok ? r.json() : Promise.reject(new Error('no quiz book'))))
      .then((j) => { if (j && Array.isArray(j.q) && Array.isArray(j.subjects)) { book = j; bookLang = lang; } loading = false; }, () => { loading = false; });
  }
  K.quizBook = () => (book && bookLang === K.flang ? book : null);
  K.loadQuizBook = loadBook;
  /* the general questions of one side of the quiz: 'wine' (wine and drinks) or 'food' */
  function bookQs(side) {
    const b = K.quizBook(), out = [];
    if (!b) return out;
    /* a question is remembered by its own words, so the memory of what was asked survives new questions being added */
    b.q.forEach((x) => {
      const subject = b.subjects[x[6]], of = SIDE[subject];
      if (!of || (side === 'food') !== (of === 'food')) return;
      out.push({ topic: side, q: x[0], a: x[1], opts: shuffle([x[1]].concat(x[2])), why: x[3] || '', img: '', level: x[4] || 1, kind: subject, drink: of === 'drinks', id: 'b' + hash(x[0] + '|' + x[1]) });
    });
    return out;
  }
  /* the short lists and the manager's own questions, as one more subject beside the book's */
  const basics = (side) => (side === 'food' ? bankQs('food') : bankQs('wine').concat(bankQs('drinks'))).map((q) => { q.kind = 'basics'; return q; });

  /* what this phone asked lately, so that a round brings questions not seen for a long while */
  const SEEN_MAX = 1500;
  let seenList = null;
  const hash = (t) => { let a = 5381; for (let i = 0; i < t.length; i++) a = ((a * 33) ^ t.charCodeAt(i)) >>> 0; return a.toString(36); };
  const keyOf = (q) => q.id || 'q' + hash(q.q + '|' + q.a);
  const seenNow = () => { if (!seenList) { const l = K.store.get('fohQuizSeen', []); seenList = Array.isArray(l) ? l : []; } return seenList; };
  /* the ones not asked lately; once nearly every one has been asked, the ones asked longest ago come back first */
  const fresh = (qs) => {
    const when = new Map();
    seenNow().forEach((k, i) => when.set(k, i));
    const f = qs.filter((q) => !when.has(keyOf(q)));
    if (f.length >= Math.min(qs.length, 12)) return f;
    const old = qs.filter((q) => when.has(keyOf(q))).sort((x, y) => when.get(keyOf(x)) - when.get(keyOf(y)));
    return f.concat(old.slice(0, Math.max(12, Math.ceil(qs.length / 4)) - f.length));
  };
  const remember = (qs) => { seenList = seenNow().concat(qs.map(keyOf)).slice(-SEEN_MAX); K.store.set('fohQuizSeen', seenList); };

  /* a round of ten: six from our own wines, drinks and dishes, four of general knowledge */
  function round(topic) {
    /* if making the questions from the book fails, the round still starts, from the general questions */
    const safe = (make) => { try { return make(); } catch (e) { if (window.console) console.error('quiz questions', e); return []; } };
    const general = (side) => fresh(bookQs(side).concat(basics(side)));
    let own, gen;
    if (topic === 'food') { own = pickMixed(fresh(safe(foodQs)), 6); gen = byKind(general('food'), ROUND); }
    else {
      /* wine and drinks: of the six questions from the book, two are about the drinks, one of them a whisky
         (one of the four in a round of everything) */
      const dq = fresh(safe(drinkQs)), wh = dq.filter((q) => q.whisky), rest = dq.filter((q) => !q.whisky);
      const d = topic === 'wine' ? byKind(wh, 1).concat(byKind(rest, 1)) : byKind(wh.length && Math.random() < 0.6 ? wh : dq, 1);
      own = byKind(fresh(safe(wineQs)), (topic === 'wine' ? 6 : 4) - d.length, WEIGHT).concat(d);
      if (topic === 'all') own = own.concat(pickMixed(fresh(safe(foodQs)), 3));
      /* a subject at a time, so the general questions of a round are not four of one sort */
      gen = byKind(general('wine').concat(topic === 'all' ? general('food') : []), ROUND);
    }
    const had = {}, out = [];
    own.concat(gen).forEach((q) => { if (out.length < ROUND && !had[q.q]) { had[q.q] = 1; out.push(q); } });
    remember(out);
    return shuffle(out);
  }
  K.quizRound = round;

  /* ---------- playing ---------- */
  let tick = null;
  function stopClock() { clearInterval(tick); tick = null; }
  /* A tap made before the screen it lands on was drawn is not meant for it: a second tap on Play or on Next
     question, or a tap made while the phone was still busy, arrives when an answer has just appeared under the
     finger. So a question takes answers only from taps made a moment after it was drawn. */
  const OPEN_AFTER = 700;
  let openAt = 0, starting = false;
  const drawn = () => { openAt = performance.now() + OPEN_AFTER; };
  const early = (e) => {
    const now = performance.now(), at = e && e.timeStamp > 0 && e.timeStamp <= now ? e.timeStamp : now;
    return at < openAt;
  };
  function start(topic, e) {
    if (starting || early(e)) return;
    if (!K.canWrite()) { K.toast('View only: ask the floor manager to make you a waiter to play.'); return; }
    if (K.mode === 'local' && !K.myName()) { ui.sheet = { type: 'name', then: () => start(topic) }; K.render(); return; }
    /* making the round takes a moment on a phone: the button shows at once that it was pressed, the round is made
       in the next frame */
    starting = true;
    const btn = e && e.currentTarget;
    if (btn && btn.classList) { btn.classList.add('busy'); btn.setAttribute('aria-busy', 'true'); }
    let went = false;
    const go = () => {
      if (went) return;
      went = true; starting = false;
      ui.quiz = { stage: 'play', topic: topic, qs: round(topic), i: 0, picked: null, right: 0, score: 0, t0: Date.now(), log: [] };
      /* the round gets a step of its own in the phone's history, so the back button ends the round and shows
         the quiz page, as Stop does, and does not leave the quiz with the round still running */
      try { if (!(history.state && history.state.quiz)) history.pushState({ k: 1, quiz: 1 }, '', location.pathname + location.search + location.hash); } catch (e) { /* file:// */ }
      K.render(true);
      drawn();
      clock();
    };
    if (window.requestAnimationFrame) requestAnimationFrame(() => setTimeout(go, 0));
    setTimeout(go, 150);
  }
  function clock() {
    stopClock();
    tick = setInterval(() => {
      const Q = ui.quiz;
      if (!Q || Q.stage !== 'play' || Q.picked != null) { stopClock(); return; }
      if (Q.frozen != null) return;
      const secs = secsOf(Q.qs[Q.i]), left = Math.max(0, secs - (Date.now() - Q.t0) / 1000);
      const bar = document.getElementById('qz-time'), num = document.getElementById('qz-sec');
      if (bar) bar.style.transform = 'scaleX(' + (left / secs) + ')';
      if (num) num.textContent = String(Math.ceil(left));
      if (left <= 0) answer(-1);
    }, 200);
  }
  function answer(i, e) {
    const Q = ui.quiz, q = Q.qs[Q.i];
    if (Q.picked != null) return;
    if (i >= 0 && early(e)) return;
    stopClock();
    const secs = secsOf(q), ok = i >= 0 && q.opts[i] === q.a, left = Q.frozen != null ? Q.frozen : Math.max(0, secs - (Date.now() - Q.t0) / 1000);
    const pts = ok ? Math.round((100 + 50 * left / secs) * FACTOR[q.level || 1]) : 0;
    Q.picked = i; Q.pts = pts;
    if (ok) { Q.right++; Q.score += pts; K.vibrate(15); } else K.vibrate([30, 40, 30]);
    Q.log.push({ q: q.q, a: q.a, ok: ok });
    K.render();
  }
  /* Jokers, for whoever is new and stuck. Each can be played once in a round, on any question, and costs nothing:
     everybody has the same four, so the board stays fair.
     - 50:50 takes away two of the wrong answers.
     - Stop the clock freezes the time of this question, with the time bonus as it stood.
     - Ask a friend: a colleague reads out what the book says about the question (the line shown after it), with
       the answer itself left out. Where that says too little, the friend names an answer and is usually right.
     - Ask the room: how the room would vote. The room is usually right, never certain. */
  const JOKERS = [['half', '50:50', 'Two wrong answers go'], ['clock', 'Stop the clock', 'Take your time'], ['friend', 'Ask a friend', 'A colleague’s hint'], ['room', 'Ask the room', 'How the room votes']];
  const stillIn = (Q, q) => q.opts.map((o, i) => i).filter((i) => !(Q.gone || []).includes(i));
  function friendSays(Q, q) {
    const a = String(K.T(q.a)), why = String(K.T(q.why || ''));
    /* the answer and its own words are taken out of the line */
    let t = why;
    [a].concat(a.split(/[^A-Za-zÀ-ÿА-я0-9’']+/).filter((w) => w.length >= 4)).forEach((w) => { if (w) t = t.split(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).join('…'); });
    t = t.replace(/(…\s*)+/g, '… ').trim();
    const said = t.replace(/…/g, '').replace(/[^A-Za-zÀ-ÿА-я]+/g, '');
    if (said.length >= 28 && said.length >= why.replace(/[^A-Za-zÀ-ÿА-я]+/g, '').length * 0.5) return { hint: t };
    /* nothing useful written down: the friend names an answer, right about four times in five */
    const open = stillIn(Q, q), right = q.opts.indexOf(q.a), wrong = open.filter((i) => i !== right);
    return { pick: Math.random() < 0.8 || !wrong.length ? right : one(wrong) };
  }
  function roomSays(Q, q) {
    const open = stillIn(Q, q), right = q.opts.indexOf(q.a), share = {};
    /* a harder question splits the room more */
    let top = Math.round((q.level === 3 ? 42 : q.level === 2 ? 52 : 62) + Math.random() * 18), rest = 100 - top;
    if (open.length === 2) { top = Math.max(top, 60 + Math.round(Math.random() * 20)); rest = 100 - top; }
    const others = shuffle(open.filter((i) => i !== right));
    others.forEach((i, n) => { const v = n === others.length - 1 ? rest : Math.round(rest * (0.35 + Math.random() * 0.3)); share[i] = v; rest -= v; });
    share[right] = top;
    /* now and then the room is wrong: its favourite is one of the others (more often on a hard question) */
    if (others.length && Math.random() < (q.level === 3 ? 0.3 : q.level === 2 ? 0.2 : 0.12)) { const o = others[0], t = share[o]; share[o] = share[right]; share[right] = t; }
    return share;
  }
  /* for looking over what the friend and the room say, and for the tests */
  K.quizFriend = (q) => friendSays({}, q);
  K.quizRoom = (q) => roomSays({}, q);
  function joker(kind, e) {
    const Q = ui.quiz, q = Q && Q.qs[Q.i];
    if (!q || Q.picked != null || early(e) || (Q.used || {})[kind]) return;
    Q.used = Object.assign({}, Q.used, { [kind]: Q.i + 1 });
    if (kind === 'half') { Q.gone = shuffle(q.opts.map((o, i) => i).filter((i) => q.opts[i] !== q.a)).slice(0, 2); if (Q.room) Q.room = roomSays(Q, q); }
    if (kind === 'clock') Q.frozen = Math.max(0, secsOf(q) - (Date.now() - Q.t0) / 1000);
    if (kind === 'friend') Q.friend = friendSays(Q, q);
    if (kind === 'room') Q.room = roomSays(Q, q);
    K.vibrate(10);
    K.render();
  }
  function next() {
    const Q = ui.quiz;
    if (Q.i + 1 >= Q.qs.length) { finish(); return; }
    Q.i++; Q.picked = null; Q.gone = null; Q.frozen = null; Q.friend = null; Q.room = null; Q.t0 = Date.now();
    K.render(true);
    drawn();
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
    drawn();
    stepBack();
  }
  /* the round's own step in the phone's history is taken back when the round ends */
  function stepBack() {
    try { if (history.state && history.state.quiz) { K.quizPop = Date.now(); history.back(); } } catch (e) { /* file:// */ }
  }
  K.quitQuiz = function () { stopClock(); ui.quiz = null; openAt = 0; };
  /* Stop, or a round given up: back to the quiz page */
  function stopRound() { K.quitQuiz(); stepBack(); K.render(true); }
  /* The app left in the background in the middle of a round (the phone locked, another app). A glance away
     changes nothing: the clock runs on. After a longer absence the round is over, so the quiz does not greet
     you with an old question that ran out of time while you were away. */
  const AWAY_MAX = 30000;
  let awayAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { awayAt = Date.now(); return; }
    const Q = ui.quiz, away = awayAt ? Date.now() - awayAt : 0;
    awayAt = 0;
    if (Q && Q.stage === 'play' && away > AWAY_MAX) { stopRound(); K.toast('The round was stopped: you were away.'); }
  });

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
  const TOPICS = [['wine', 'Wine & drinks', 'glass', 'Wines, pairings and prices; whiskies and other spirits'], ['food', 'Food', 'plate', 'Translations, allergens and the unusual ingredients'], ['all', 'Everything', 'trophy', 'Both, mixed']];

  K.V.quiz = function () {
    const Q = ui.quiz;
    loadBook();
    if (Q && Q.stage === 'play') return playView(Q);
    const body = h('div', { class: 'page' });
    const mine = D.scores.filter((s) => s.uid === ((K.me && K.me.id) || 'this-phone') && s.at >= since('week'));
    body.append(K.pageHead('The quiz', mine.length ? 'Your best this week: ' + Math.max.apply(null, mine.map((s) => s.score)) + ' points' : 'Ten questions, four jokers, 90 seconds each. A harder question gives up to double the points; a quick answer scores more.', null, '', 'quiz-head'));
    const w = h('div', { class: 'wrap' });
    body.append(w);
    /* the quiz's own badge (an image made for it) */
    w.append(h('img', { class: 'quiz-logo', src: 'floor/assets/quiz-logo.webp', alt: 'Who wants to be a sommelier?', width: 190, height: 190 }));
    if (Q && Q.stage === 'done') w.append(doneCard(Q));
    w.append(h('div', { class: 'quiz-topics' }, TOPICS.map((t) => h('button', { type: 'button', class: 'qt qt-' + t[0], onclick: (e) => start(t[0], e) },
      K.icon(t[2]), h('b', null, t[1]), h('span', null, t[3]), h('span', { class: 'qt-go' }, 'Play', K.icon('next'))))));
    const per = ui.board || 'week', top = ui.boardTopic || 'all', rows = board(per, top);
    w.append(h('section', { class: 'group lb' },
      h('div', { class: 'lb-head' }, h('h2', { class: 'group-title' }, 'Leaderboard'),
        K.seg([['week', 'This week'], ['month', 'Month'], ['all', 'All time']], per, (v) => { ui.board = v; K.render(); }, { class: 'seg small-seg', 'aria-label': 'Period' })),
      K.seg([['all', 'Everything'], ['wine', 'Wine & drinks'], ['food', 'Food']], top, (v) => { ui.boardTopic = v; K.render(); }, { class: 'seg small-seg lb-topic', 'aria-label': 'Topic' }),
      rows.length ? h('ol', { class: 'lb-list' }, rows.map((r, i) => h('li', { class: 'lb-row' + (r.uid === ((K.me && K.me.id) || 'this-phone') ? ' me' : '') },
        h('span', { class: 'lb-pos' + (i < 3 ? ' m' + (i + 1) : '') }, String(i + 1)),
        h('span', { class: 'lb-name' }, h('b', null, r.name || 'Someone'), h('span', { class: 'muted' }, r.rounds + (r.rounds === 1 ? ' round' : ' rounds') + ' · ' + Math.round(100 * r.right / Math.max(1, r.of)) + '% right')),
        h('span', { class: 'lb-best mono' }, String(r.best))))) : h('p', { class: 'muted lb-none' }, 'Nobody has played ' + (per === 'week' ? 'this week' : per === 'month' ? 'this month' : 'yet') + '. Be the first.')));
    if (K.canEdit()) {
      w.append(h('section', { class: 'group' }, h('h2', { class: 'group-title' }, 'Your own questions', h('span', { class: 'n' }, String(D.quizq.length))),
        h('p', { class: 'hint' }, 'Most questions are made from the wine and food bibles by themselves. Add your own for anything else: house rules, the producers, the team’s favourite facts.'),
        D.quizq.length ? h('div', { class: 'ing-list' }, D.quizq.map((q) => h('button', { type: 'button', class: 'ing-row', onclick: () => { ui.sheet = { type: 'qedit', id: q.id }; K.render(); } },
          h('span', { class: 'ing-name' }, h('b', null, q.q)), h('span', { class: 'ing-what' }, q.a), h('span', { class: 'ing-in' }, q.topic === 'wine' ? 'Wine & drinks' : 'Food')))) : null,
        h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', onclick: () => { ui.sheet = { type: 'qedit', id: null }; K.render(); } }, K.icon('plus'), 'Add a question'))));
    }
    return { body: body };
  };
  function doneCard(Q) {
    const rows = board('week', 'all'), pos = rows.findIndex((r) => r.uid === ((K.me && K.me.id) || 'this-phone')) + 1;
    const missed = Q.log.filter((x) => !x.ok);
    return h('section', { class: 'quiz-done' },
      h('p', { class: 'kicker' }, 'Round finished'),
      h('div', { class: 'qd-score' }, h('b', { class: 'mono' }, String(Q.score)), h('span', null, 'points · ' + Q.right + ' of ' + Q.qs.length + ' right'), Object.keys(Q.used || {}).length ? h('span', { class: 'qd-tips' }, Object.keys(Q.used).length === 1 ? 'with 1 joker' : 'with ' + Object.keys(Q.used).length + ' jokers') : null),
      pos ? h('p', null, pos === 1 ? 'You are top of the board this week.' : 'Number ' + pos + ' on this week’s board.') : null,
      missed.length ? h('details', { class: 'qd-missed' }, h('summary', null, 'The ones you missed (' + missed.length + ')'),
        h('ul', null, missed.map((x) => h('li', null, x.q, h('b', null, ' ' + x.a))))) : h('p', null, 'A perfect round.'),
      h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: (e) => start(Q.topic, e) }, 'Play again'),
        h('button', { class: 'btn', type: 'button', onclick: () => { ui.quiz = null; K.render(); } }, 'Close')));
  }
  function playView(Q) {
    const q = Q.qs[Q.i], done = Q.picked != null;
    if (!q) { ui.quiz = null; return K.V.quiz(); }
    const secs = secsOf(q), left = Q.frozen != null ? Q.frozen : Math.max(0, secs - (Date.now() - Q.t0) / 1000);
    const used = Q.used || {};
    const body = h('div', { class: 'wrap quiz-play' },
      h('div', { class: 'qp-top' },
        h('span', { class: 'mono' }, (Q.i + 1) + ' / ' + Q.qs.length),
        h('span', { class: 'qp-score mono' }, Q.score + ' pts'),
        h('span', { class: 'qp-sec mono' + (Q.frozen != null && !done ? ' frozen' : ''), id: 'qz-sec' }, done ? '' : Q.frozen != null ? [K.icon('pause'), String(Math.ceil(left))] : String(Math.ceil(left)))),
      h('div', { class: 'qp-timer' + (Q.frozen != null && !done ? ' frozen' : '') }, h('span', { id: 'qz-time', style: { transform: 'scaleX(' + (done ? 0 : left / secs) + ')' } })),
      h('p', { class: 'kicker qp-kick' }, h('span', null, q.drink ? 'Drinks' : q.topic === 'wine' ? 'Wine' : 'Food'), h('span', { class: 'qp-level l' + (q.level || 1) }, h('b', null, LEVELS[q.level || 1]), h('span', null, 'up to ' + worth(q) + ' points'))),
      q.img ? h('div', { class: 'qp-img' }, h('img', { src: q.img, alt: '' })) : null,
      h('h1', { class: 'qp-q' }, q.q),
      h('div', { class: 'qp-opts' }, q.opts.map((o, i) => {
        const out = !!Q.gone && Q.gone.includes(i);
        const cls = !done ? (out ? ' gone' : '') : o === q.a ? ' right' : i === Q.picked ? ' wrong' : ' dim';
        const vote = Q.room && !out ? Q.room[i] || 0 : null;
        return h('button', { type: 'button', class: 'qp-opt' + cls + (vote != null ? ' voted' : ''), disabled: done || out, style: vote != null ? { '--vote': vote + '%' } : null, onclick: (e) => answer(i, e) },
          h('span', { class: 'qp-l mono' }, 'ABCD'[i]), h('span', null, o), vote != null ? h('span', { class: 'qp-vote mono' }, vote + '%') : null);
      })),
      !done && Q.friend ? h('div', { class: 'qp-friend' }, K.icon('chef'), h('div', null, h('b', null, 'Your friend says'),
        Q.friend.hint ? h('p', null, '“' + Q.friend.hint + '”') : h('p', null, 'I would go with ' + 'ABCD'[Q.friend.pick] + ', but I am not completely sure.'))) : null,
      !done ? h('div', { class: 'qp-jokers', role: 'group', 'aria-label': 'Jokers' }, JOKERS.map((j) => h('button', { type: 'button', class: 'qp-joker j-' + j[0] + (used[j[0]] ? ' used' : ''), disabled: !!used[j[0]], onclick: (e) => joker(j[0], e) },
        h('b', null, j[1]), h('span', null, used[j[0]] ? 'Played' : j[2])))) : null,
      done ? h('div', { class: 'qp-after ' + (Q.pts ? 'ok' : 'no') },
        h('b', null, Q.pts ? 'Right · +' + Q.pts : Q.picked < 0 ? 'Time is up' : 'Not quite'),
        Q.pts ? null : h('p', null, 'The answer: ', h('b', null, q.a)),
        q.why ? h('p', { class: 'muted' }, q.why) : null,
        h('button', { class: 'btn primary wide', type: 'button', onclick: next }, Q.i + 1 >= Q.qs.length ? 'See your score' : 'Next question')) : null);
    return {
      top: K.subbar('Stop', stopRound, [], q.topic === 'all' ? 'Quiz' : 'Quiz · ' + (Q.topic === 'wine' ? 'Wine & drinks' : Q.topic === 'food' ? 'Food' : 'Everything')),
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
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'About'), K.seg([['wine', 'Wine & drinks'], ['food', 'Food']], f.topic, (v) => { f.topic = v; K.render(); })),
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
