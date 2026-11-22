/* Example content for the floor book: a device-only copy starts with it, and a floor manager can load it into a
   new floor book (Settings → Load the example wines) and remove it again in one go. Every record is marked
   example: true. The producers are made up; the grapes, regions and facts are real. */
(function () {
  'use strict';
  const W = {
    'ex-mavrud': {
      name: 'Mavrud Reserve', producer: 'Example Estate', vintage: '2020', colour: 'red', style: 'dry, full-bodied', grapes: 'Mavrud', region: 'Thracian Valley', country: 'Bulgaria',
      bottlePrice: '58', byGlass: true, glassPrice: '11', glassCl: '15', par: 4, order: 1,
      say: 'Our most Bulgarian red: Mavrud, a grape that grows almost nowhere else. Dark, a little wild, with plenty of grip for the meat dishes.',
      nose: 'Blackberry, dark cherry and plum, with a little spice and smoke.', palate: 'Firm tannins and fresh acidity, ripe dark fruit, a long finish.',
      story: 'Mavrud is an old Bulgarian variety from the Thracian Valley, around Asenovgrad and Plovdiv. Its small, thick-skinned berries give deep colour and a lot of tannin, so it often spends time in oak.',
      facts: 'Mavrud is grown almost only in Bulgaria.\nA well-known legend links its name to a brave young man called Mavrud in the time of Khan Krum.\nIt ages well: good ones keep for ten years and more.',
      serve: '16–18 °C', glass: 'Large Bordeaux glass', decant: '30–45 minutes before, for a young vintage', pairs: [],
    },
    'ex-melnik': {
      name: 'Broad-leaved Melnik', producer: 'Example Estate', vintage: '2021', colour: 'red', style: 'dry, medium-bodied', grapes: 'Shiroka Melnishka Loza', region: 'Struma Valley', country: 'Bulgaria',
      bottlePrice: '52', byGlass: false, par: 3, order: 2,
      say: 'From the warm south-west, around the little town of Melnik. Lighter than a Mavrud, with red fruit, tobacco and a fresh finish.',
      nose: 'Red cherry, dried herbs, tobacco and leather.', palate: 'Medium body, bright acidity, soft tannins.',
      story: 'Shiroka Melnishka Loza, the broad-leaved vine of Melnik, ripens late in the hot Struma Valley near the Greek border. Melnik’s wines were traded for centuries and kept in cellars cut into the sandstone.',
      facts: 'The story goes that Winston Churchill ordered Melnik wine every year.\nThe vine ripens very late, often in October.\nMelnik is one of the smallest towns in Bulgaria.',
      serve: '15–17 °C', glass: 'Burgundy glass', decant: 'Not needed', pairs: [],
    },
    'ex-rubin': {
      name: 'Rubin', producer: 'Example Cellars', vintage: '2022', colour: 'red', style: 'dry, rich', grapes: 'Rubin', region: 'Thracian Valley', country: 'Bulgaria',
      bottlePrice: '46', byGlass: true, glassPrice: '9', glassCl: '15', par: 6, order: 3,
      say: 'A Bulgarian grape bred from Nebbiolo and Syrah: the colour and spice of Syrah with some of Nebbiolo’s structure.',
      nose: 'Ripe red and black fruit, violet, black pepper.', palate: 'Round and juicy, soft tannins, a peppery finish.',
      story: 'Rubin was created in Bulgaria in the 1940s by crossing Nebbiolo with Syrah. It is planted mostly in the Thracian Valley.',
      facts: 'Rubin means ruby, for its deep colour.\nIts parents are Nebbiolo (Piedmont) and Syrah (Rhône).',
      serve: '16–18 °C', glass: 'Bordeaux glass', decant: 'Not needed', pairs: [],
    },
    'ex-dimyat': {
      name: 'Dimyat', producer: 'Example Coast', vintage: '2024', colour: 'white', style: 'dry, light', grapes: 'Dimyat', region: 'Black Sea coast', country: 'Bulgaria',
      bottlePrice: '38', byGlass: true, glassPrice: '7', glassCl: '15', par: 6, order: 1,
      say: 'A light, fresh Bulgarian white from the Black Sea coast. Peach and pear, easy to drink, good with the starters.',
      nose: 'Peach, pear, white flowers.', palate: 'Light, crisp and fresh.',
      story: 'Dimyat is one of the oldest Bulgarian white grapes, planted along the Black Sea and in the east of the country.',
      facts: 'Dimyat is also used for Bulgarian grape brandy, rakia.\nIt is best drunk young.',
      serve: '8–10 °C', glass: 'White wine glass', decant: '', pairs: ['demo-eggs-benedict'],
    },
    'ex-misket': {
      name: 'Red Misket', producer: 'Example Valley', vintage: '2024', colour: 'white', style: 'dry, aromatic', grapes: 'Misket Cherven', region: 'Sungurlare Valley', country: 'Bulgaria',
      bottlePrice: '42', byGlass: false, par: 3, order: 2,
      say: 'Red Misket has pink skins but makes a white wine: very aromatic, roses and honey on the nose, yet dry in the mouth.',
      nose: 'Rose petal, honeysuckle, lime.', palate: 'Dry, medium body, gentle acidity, a floral finish.',
      story: 'Misket Cherven is an old Bulgarian grape, at home in the Sungurlare Valley in the east. Its pink-skinned berries give a pale, aromatic white.',
      facts: 'Despite the name Red Misket, the wine is white.\nThe Sungurlare Valley is the best-known place for it.',
      serve: '8–10 °C', glass: 'White wine glass', decant: '', pairs: [],
    },
    'ex-gamza': {
      name: 'Gamza', producer: 'Example Danube', vintage: '2023', colour: 'red', style: 'dry, light', grapes: 'Gamza', region: 'Danube Plain', country: 'Bulgaria',
      bottlePrice: '40', byGlass: true, glassPrice: '8', glassCl: '15', par: 4, order: 4,
      say: 'A light red from the north, by the Danube. Red berries, soft and fresh: good slightly cool with lighter food.',
      nose: 'Raspberry, red cherry, a hint of spice.', palate: 'Light body, low tannin, fresh acidity.',
      story: 'Gamza grows in the north-west of Bulgaria along the Danube. In Hungary the same grape is called Kadarka.',
      facts: 'Gamza and Kadarka are the same grape.\nIt is one of the few reds that is nice slightly chilled.',
      serve: '14–16 °C', glass: 'Burgundy glass', decant: '', pairs: [],
    },
  };
  const docs = {};
  Object.keys(W).forEach((id) => { docs['wines/' + id] = Object.assign({ example: true, label: '', updated: 0 }, W[id]); });

  docs['dishnotes/demo-eggs-benedict'] = {
    example: true, recipe: 'demo-eggs-benedict', section: 'Breakfast & brunch', price: '16', order: 1,
    pitch: 'Two poached eggs on a toasted English muffin with smoked ham, under our hollandaise made fresh every morning. The yolks are runny, so cut in from the side.',
    story: 'Eggs Benedict was born in New York in the late 1800s. The best-known story is a stockbroker, Lemuel Benedict, ordering it at the Waldorf Hotel in 1894 to cure a hangover.',
    niche: [{ n: 'Hollandaise', what: 'A warm sauce of egg yolks whisked with melted butter and lemon. Rich and silky.' }, { n: 'English muffin', what: 'A small, flat, round bread toasted on a griddle, not a sweet muffin.' }],
    facts: 'The hollandaise has egg, butter and lemon: eggs and milk are both allergens.\nDelmonico’s restaurant in New York also claims the dish.',
    pairs: ['ex-dimyat'], pairText: 'The fresh acidity of the Dimyat cuts through the hollandaise.',
  };
  docs['dishnotes/demo-creme-brulee'] = {
    example: true, recipe: 'demo-creme-brulee', section: 'Desserts', price: '9', order: 1,
    pitch: 'A cold vanilla custard under a sheet of burnt sugar we caramelise to order. Tap the top with the spoon to crack it.',
    story: 'Crème brûlée means “burnt cream”. A recipe appears in a French cookbook from 1691; Spain’s crema catalana and Cambridge’s “burnt cream” are close cousins.',
    niche: [{ n: 'Vanilla pod', what: 'The dried seed pod of a tropical orchid; the tiny black seeds in the cream are the vanilla.' }],
    facts: 'The sugar is caramelised with a blowtorch just before it goes out.\nIt is set gently in a water bath so it stays smooth.',
    pairs: ['ex-misket'], pairText: 'Red Misket’s floral nose goes with the vanilla.',
  };
  docs['dishnotes/ex-shopska'] = {
    example: true, name: 'Шопска салата', en: 'Shopska salad', section: 'Starters', price: '11', order: 1,
    ings: ['домати', 'краставици', 'печени чушки', 'лук', 'магданоз', 'сирене'],
    pitch: 'The Bulgarian classic: tomatoes, cucumber, roasted peppers and onion, under a snow of grated white brined cheese.',
    story: 'The salad is named after the Shopi, the people of the Sofia region. It became the national salad in the second half of the 20th century.',
    niche: [{ n: 'сирене', what: 'Bulgarian white brined cheese, made from cow’s or sheep’s milk; salty and crumbly, close to feta.' }],
    facts: 'White, green and red: the salad has the colours of the Bulgarian flag.\nIt is traditionally eaten with a glass of rakia.',
    pairs: ['ex-dimyat'],
  };
  docs['dishnotes/ex-tarator'] = {
    example: true, name: 'Таратор', en: 'Tarator, cold cucumber and yoghurt soup', section: 'Starters', price: '7', order: 2,
    ings: ['кисело мляко', 'краставици', 'чесън', 'копър', 'орехи', 'зехтин'],
    pitch: 'A cold soup of Bulgarian yoghurt and cucumber with garlic, dill and walnuts. Refreshing on a hot day.',
    niche: [{ n: 'кисело мляко', what: 'Bulgarian yoghurt, soured with the bacterium Lactobacillus bulgaricus, named after Bulgaria.' }],
    facts: 'Lactobacillus bulgaricus was identified by the Bulgarian doctor Stamen Grigorov in 1905.\nThe walnuts make it a nut allergen.',
    pairs: [],
  };
  docs['glossary/hollandaise'] = { example: true, key: 'hollandaise', name: 'Hollandaise', en: 'Hollandaise', what: 'A warm emulsion of egg yolks, melted butter and lemon juice; one of the French mother sauces.' };
  docs['quizq/ex-q1'] = { example: true, topic: 'wine', q: 'Which of our wines comes from the town of Melnik?', a: 'Broad-leaved Melnik', wrong: ['Mavrud Reserve', 'Dimyat', 'Gamza'], why: 'The Broad-leaved Melnik vine grows in the Struma Valley around Melnik.' };
  docs['quizq/ex-q2'] = { example: true, topic: 'food', q: 'What do we tell a guest about the yolks in the Eggs Benedict?', a: 'They are runny: cut in from the side', wrong: ['They are hard-boiled', 'They are scrambled', 'There are none'], why: 'The eggs are poached so the yolks stay runny.' };
  window.KOMAT_FLOOR_SEED = docs;

  /* for the device copy only: a floor team, this week's schedule and some bottles on the shelf */
  const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const wk = mon.getFullYear() + '-' + String(mon.getMonth() + 1).padStart(2, '0') + '-' + String(mon.getDate()).padStart(2, '0');
  window.KOMAT_FLOOR_DEVICE = {
    'fohsettings/staff': { people: [{ id: 'ana', name: 'Ana', role: 'manager' }, { id: 'boris', name: 'Boris', role: 'waiter' }, { id: 'vera', name: 'Vera', role: 'waiter' }, { id: 'kalin', name: 'Kalin', role: 'bar' }, { id: 'mira', name: 'Mira', role: 'host' }] },
    ['fohweeks/' + wk]: { week: wk, people: ['ana', 'boris', 'vera', 'kalin', 'mira'], note: '', updated: 0, rows: {
      ana: ['D', 'D', 'X', 'E', 'E', 'D', 'X'], boris: ['M', 'L', 'E', 'X', 'E', 'E', 'M'], vera: ['X', 'E', 'E', 'M', 'L', 'D', 'E'],
      kalin: ['B', 'X', 'B', 'B', 'B', 'B', 'X'], mira: ['X', 'X', 'H', 'H', 'H', 'H', 'L'] } },
    'cellar/ex-mavrud': { n: 9, at: 1, by: '', name: '' }, 'cellar/ex-melnik': { n: 2, at: 1, by: '', name: '' }, 'cellar/ex-rubin': { n: 14, at: 1, by: '', name: '' },
    'cellar/ex-dimyat': { n: 0, at: 1, by: '', name: '' }, 'cellar/ex-misket': { n: 5, at: 1, by: '', name: '' },
  };
})();
