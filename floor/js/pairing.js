/* What a wine is like and what it goes with. Three things live here:
   - notes: what a wine smells and tastes of. Written on the wine they win; otherwise the notes typical of its grape
     are shown, and marked as typical, so a waitress always has something true to say.
   - origin: Bulgarian (and from which region) or foreign (and from where).
   - pairing: for a dish, the house's own pairing first (the tasting menu, or what a manager linked), then the wines
     in stock whose style suits the dish. For a wine, the same read the other way. Style pairings are marked as such. */
(function () {
  'use strict';
  const K = window.K, h = K.h, ui = K.ui;
  const low = (s) => String(s || '').toLowerCase();

  /* grape -> [what it smells of, how it feels in the mouth, style] */
  const G = {
    'chardonnay': ['Ripe apple, citrus, often butter or vanilla from the oak', 'Medium to full body, round, with fresh acidity', 'rich-white'],
    'sauvignon blanc': ['Gooseberry, citrus, fresh-cut grass', 'Light and crisp, high acidity', 'crisp-white'],
    'riesling': ['Lime, green apple, white flowers, a mineral or petrol note', 'Light body, high acidity, very fresh', 'crisp-white'],
    'aligoté': ['Green apple, lemon, a floral hint', 'Light and lean, high acidity', 'crisp-white'],
    'grüner veltliner': ['Green apple, citrus, white pepper', 'Light to medium body, crisp and peppery', 'crisp-white'],
    'albariño': ['Peach, lemon, a sea breeze', 'Light to medium body, high acidity, a salty finish', 'crisp-white'],
    'vermentino': ['Citrus, white peach, herbs, a salty note', 'Medium body, crisp, a slightly bitter almond finish', 'crisp-white'],
    'pinot grigio': ['Pear, apple, lemon', 'Light, dry and clean', 'crisp-white'],
    'friulano': ['Pear, almond, wild flowers', 'Medium body, soft acidity, an almond finish', 'crisp-white'],
    'dimyat': ['Apple, pear, ripe stone fruit', 'Light and soft, easy to drink', 'crisp-white'],
    'gergana': ['White flowers, citrus, peach', 'Light and fresh, lively acidity', 'aromatic-white'],
    'tamyanka': ['Grape, rose, orange blossom', 'Very aromatic, usually dry, with a fresh finish', 'aromatic-white'],
    'vrachanski misket': ['Rose, citrus, herbs', 'Aromatic, light and fresh', 'aromatic-white'],
    'malagousia': ['Peach, jasmine, citrus peel', 'Aromatic, medium body, fresh', 'aromatic-white'],
    'pinot noir': ['Red cherry, raspberry, earthy forest notes', 'Light to medium body, silky tannins, fresh', 'light-red'],
    'gamay': ['Strawberry, cherry, violet', 'Light and juicy, very little tannin', 'light-red'],
    'gamza': ['Sour cherry, raspberry, light spice', 'Light body, fresh acidity, soft tannins', 'light-red'],
    'cabernet franc': ['Raspberry, redcurrant, green pepper', 'Medium body, fresh, fine tannins', 'light-red'],
    'mavrud': ['Ripe blackberry, plum, spice, sometimes leather', 'Full body, firm tannins, deep and warming', 'full-red'],
    'rubin': ['Blackberry, violet, dark cherry, pepper', 'Full body, ripe tannins, juicy', 'full-red'],
    'merlot': ['Plum, black cherry, chocolate', 'Medium to full body, soft tannins, smooth', 'full-red'],
    'syrah': ['Blackberry, black pepper, smoke, violet', 'Full body, firm tannins, spicy', 'full-red'],
    'primitivo': ['Jammy plum, blackberry, sweet spice', 'Full and ripe, warming, soft tannins', 'full-red'],
    'nero d’avola': ['Black cherry, plum, liquorice', 'Full body, ripe fruit, medium tannins', 'full-red'],
    'nebbiolo': ['Rose, tar, sour cherry, dried herbs', 'Pale but powerful: high acidity and strong tannins', 'full-red'],
    'sangiovese': ['Sour cherry, tomato leaf, dried herbs', 'Medium body, high acidity, firm tannins', 'full-red'],
    'tempranillo': ['Cherry, plum, vanilla, tobacco', 'Medium to full body, smooth tannins', 'full-red'],
    'glera': ['Pear, green apple, white flowers', 'Light, gently sparkling, dry to off-dry', 'sparkling'],
    'zibibbo': ['Orange blossom, apricot, raisin', 'Aromatic and sweet', 'sweet'],
    'pedro ximénez': ['Raisin, fig, molasses, coffee', 'Very sweet, thick and syrupy', 'sweet'],
  };
  /* when the grape is not written, or it is a blend: what the colour usually gives */
  const C = {
    sparkling: ['Citrus, green apple, often fresh bread from its time on the lees', 'Dry, with fine bubbles and a fresh finish', 'sparkling'],
    rose: ['Strawberry, peach, citrus', 'Dry, light and fresh', 'rose'],
    white: ['Fresh fruit: apple, pear, citrus', 'Dry, light to medium body', 'crisp-white'],
    orange: ['Dried apricot, tea, orange peel', 'Dry, with a light grip like a red', 'rich-white'],
    red: ['Dark and red berries, a touch of spice', 'Medium to full body', 'full-red'],
    sweet: ['Honey, dried fruit, blossom', 'Sweet, to sip with dessert', 'sweet'],
  };
  const FITS = { white: /-white$/, orange: /-white$/, red: /-red$/, sparkling: /^sparkling$/, sweet: /^sweet$/, rose: /^rose$/ };
  /* the one grape a wine is made of, when its usual notes hold for this wine: not a blend, and the colour that grape
     usually gives (a white wine from Mavrud, or a rosé from Pinot Noir, does not smell like the red) */
  const grapeOf = (w) => {
    const g = low(w.grapes).split(/[,;/]| and /)[0].trim();
    return G[g] && !/[,;/]/.test(w.grapes) && (FITS[w.colour] || /^$/).test(G[g][2]) ? g : '';
  };
  const base = (w) => { const g = grapeOf(w); return (g ? G[g] : null) || C[w.colour] || null; };
  /* {nose, palate, typical}: `typical` when they are the grape's, not written for this bottle */
  K.wineNotes = function (w) {
    if (K.isDrink(w)) return { nose: w.nose, palate: w.palate, typical: false };
    const b = base(w);
    return { nose: w.nose || (b ? b[0] : ''), palate: w.palate || (b ? b[1] : ''), typical: !w.nose && !w.palate && !!b, grape: grapeOf(w) ? w.grapes : '' };
  };
  K.wineStyle = function (w) {
    if (['sparkling', 'rose', 'sweet'].includes(w.colour)) return w.colour;
    const b = base(w);
    let s = b ? b[2] : '';
    /* the body written on the bottle wins over what the grape usually gives: a full white is a rounder white, a light red a lighter red */
    if (w.body === 'full' && s === 'crisp-white') s = 'rich-white';
    if (w.body === 'light' && s === 'full-red') s = 'light-red';
    if (w.body === 'full' && s === 'light-red') s = 'full-red';
    return s;
  };
  const STYLE = { 'crisp-white': 'a crisp white', 'aromatic-white': 'an aromatic white', 'rich-white': 'a rounder white', 'light-red': 'a lighter red', 'full-red': 'a full red', rose: 'a rosé', sparkling: 'a sparkling wine', sweet: 'a sweet wine' };
  K.styleName = (s) => STYLE[s] || 'wine';

  /* Bulgarian or foreign, and from where */
  K.origin = function (w) {
    if (!w.country && !w.region) return null;
    const bg = /bulgaria|българия/i.test(w.country || '') || (!w.country && !!w.region);
    return { bg: bg, kind: bg ? 'Bulgarian' : 'Foreign', where: bg ? w.region || 'Bulgaria' : [w.country, w.region].filter((x, i, l) => x && l.indexOf(x) === i).join(', ') };
  };

  /* what kind of plate a dish is, read from its name, section and ingredients */
  const KIND = [
    ['caviar', /caviar|хайвер/, ['sparkling', 'crisp-white'], 'Bubbles and a clean white lift the salt of the caviar.'],
    ['cheese', /cheese board|сирена|cheese plate/, ['sweet', 'full-red', 'rich-white'], 'Cheese takes a sweet wine or a red with some body.'],
    ['dessert', /dessert|finish|край|chocolate|шоколад|kazandibi|тенджера|sorbet|сорбе|cake|торта|pudding/, ['sweet', 'sparkling'], 'A dessert wants a wine at least as sweet as it is.'],
    ['shellfish', /shrimp|prawn|скарид|gyoza|гьоз|mussel|миди|octopus|октопод|squid|калмар/, ['crisp-white', 'rich-white', 'sparkling'], 'Shellfish likes a fresh white with good acidity.'],
    ['fish', /fish|риба|sea bass|милокоп|bonito|паламуд|tarama|тарама|salmon|сьомга|tuna|sturgeon|есетра/, ['crisp-white', 'aromatic-white', 'rose'], 'Fish is best with a fresh, dry white.'],
    ['raw-beef', /tartare|тартар|carpaccio|карпачо/, ['crisp-white', 'light-red', 'rose'], 'Raw beef is delicate: a fresh white or a light red, nothing heavy.'],
    ['duck', /duck|патиц|патешк|foie|фоа гра|quail|пъдпъдък/, ['light-red', 'full-red'], 'Duck suits a red with fresh acidity, light to medium.'],
    ['red-meat', /beef|телешк|говежд|wagyu|уагиу|goat|яре|lamb|агне|steak|venison/, ['full-red', 'light-red'], 'Red meat carries a full red with tannin.'],
    ['pork', /pork|свин|terrine|пача|charcuterie|колбас|\bham\b|шунка|sausage/, ['light-red', 'rose', 'crisp-white'], 'Pork and cured meats go with a light red or a rosé.'],
    ['veg', /lentil|леща|falafel|фалафел|pepper|чушк|greens|салат|salad|mushroom|гъб|vegetable|зеленчу|dip|разядк|mezze|muhammara|мухамара|quince|дюл|bread|хляб/, ['aromatic-white', 'crisp-white', 'rose', 'light-red'], 'Vegetables and dips like an aromatic white, a rosé or a light red.'],
  ];
  K.dishKind = function (d) {
    const txt = low([d.name, d.en, d.section, d.n.menuEn, d.n.menuBg].join(' ')), ings = low(d.ings.join(' '));
    return KIND.find((k) => k[1].test(txt)) || KIND.find((k) => k[0] !== 'dessert' && k[0] !== 'veg' && k[1].test(ings)) || KIND.find((k) => k[0] === 'veg' && k[1].test(ings)) || null;
  };
  const listed = () => K.listWines().filter((w) => !w.off && !K.isDrink(w));
  const avail = (w) => w.nostock || K.stockState(w) !== 'out';
  /* the house's own pairing for a dish: linked on the dish, on the wine, or poured with it on the tasting menu */
  K.housePairs = function (d) {
    const t = K.tasting(), ids = (d.n.pairs || []).slice();
    if (t.wines[d.id] && t.wines[d.id].id) ids.push(t.wines[d.id].id);
    listed().forEach((w) => { if (w.pairs.includes(d.id)) ids.push(w.id); });
    return ids.filter((id, i) => ids.indexOf(id) === i).map(K.wine).filter(Boolean);
  };
  /* {house, style: [{w, why}], kind}: what to pour with a dish */
  K.pairFor = function (d) {
    const house = K.housePairs(d), kind = K.dishKind(d), style = [];
    if (kind) kind[2].forEach((s) => { listed().filter((w) => K.wineStyle(w) === s && avail(w) && !house.includes(w)).slice(0, 2).forEach((w) => { if (style.length < 5) style.push({ w: w, s: s }); }); });
    return { house: house, style: style, kind: kind };
  };
  /* the dishes a wine suits: {house, style} */
  K.dishesFor = function (w) {
    const all = K.dishes().filter((d) => d.onMenu), s = K.wineStyle(w);
    const house = all.filter((d) => K.housePairs(d).includes(w));
    return { house: house, style: all.filter((d) => !house.includes(d) && (K.dishKind(d) || [0, 0, []])[2].includes(s)).slice(0, 8), s: s };
  };

  /* the list's own price levels: the cheapest third, the middle, the dearest third of the bottles */
  K.priceBands = function () {
    const ps = listed().map((w) => parseFloat(String(w.bottlePrice).replace(',', '.'))).filter((x) => x > 0).sort((a, b) => a - b);
    if (ps.length < 6) return null;
    return { low: ps[Math.floor(ps.length / 3)], high: ps[Math.floor((ps.length * 2) / 3)] };
  };
  const priceOf = (w) => parseFloat(String(w.bottlePrice).replace(',', '.')) || 0;
  /* sold by the glass with a dessert or cheese: the sweet wines */
  const byTheGlass = (w) => w.colour === 'sweet' && w.byGlass && !!w.glassPrice;
  /* for a dish, one wine at each price level: the house's own choices first, then the wines whose style suits it */
  /* a number from a dish's id: two dishes of the same kind start at different bottles, so one wine is not offered everywhere */
  const turn = (d, n) => { let x = 7; String(d.id).split('').forEach((c) => { x = (x * 31 + c.charCodeAt(0)) % 9973; }); return n ? x % n : 0; };
  /* for a dish, up to two wines at each price level. The house's own choices come first, in the order they were
     written (the first is the one to lead with). Where the house chose fewer, wines whose style suits the dish fill in. */
  K.pairTiers = function (d) {
    const p = K.pairFor(d), bands = K.priceBands();
    if (!bands) return null;
    const ok = (w) => priceOf(w) > 0 && !byTheGlass(w) && avail(w);
    const house = p.house.filter(ok).map((w) => ({ w: w, house: true }));
    /* a dessert takes what the house chose and nothing else: no bottle is picked for it by style; nor for a course
       only the tasting menu has, which is poured what the menu says */
    const style = p.kind && p.kind[0] !== 'dessert' && d.n.only !== 'tasting' ? listed().filter((w) => p.kind[2].includes(K.wineStyle(w)) && ok(w) && !p.house.includes(w)).map((w) => ({ w: w, house: false })) : [];
    const pick = (lo, hi) => {
      const here = (x) => priceOf(x.w) >= lo && priceOf(x.w) < hi, mine = house.filter(here).slice(0, 2), fill = [];
      /* the style that suits the dish best first; within a style, start where this dish's turn falls */
      if (p.kind) p.kind[2].forEach((st) => { const l = style.filter((x) => here(x) && K.wineStyle(x.w) === st), from = turn(d, l.length); l.slice(from).concat(l.slice(0, from)).forEach((x) => fill.push(x)); });
      return mine.concat(fill).slice(0, 2);
    };
    return { bands: bands, low: pick(0, bands.low), mid: pick(bands.low, bands.high), high: pick(bands.high, Infinity) };
  };

  const wineRow = (w, note) => h('button', { type: 'button', class: 'to-row framed', onclick: () => K.go('winepage', { id: w.id }) }, K.wineLabel(w, 'mini'),
    h('span', { class: 'to-txt' }, h('b', null, K.wineTitle(w)), h('span', { class: 'muted' }, note)), K.icon('next'));
  const about = (w) => { const o = K.origin(w), n = K.wineNotes(w); return [o ? o.kind + ' · ' + o.where : '', n.nose ? low(K.T(n.nose).split(',').slice(0, 2).join(',')) : ''].filter(Boolean).join(' · '); };
  K.SHEETS.pair = function (S) {
    const d = K.dish(S.id);
    if (!d) return null;
    const p = K.pairFor(d), t = K.pairTiers(d), tw = K.tasting().wines[d.id], tWine = tw && tw.id ? K.wine(tw.id) : null;
    const why = (x) => (x.house && (d.n.pairWhy || {})[x.w.id]) || (p.kind && !x.house ? K.T(K.styleName(K.wineStyle(x.w))).replace(/^an? /, '').replace(/^./, (c) => c.toUpperCase()) + ': ' + low(K.T(K.wineNotes(x.w).nose) || about(x.w)) : about(x.w));
    const bottle = (x) => h('button', { type: 'button', class: 'pr-wine', onclick: () => K.go('winepage', { id: x.w.id }) }, K.wineLabel(x.w, 'mini'),
      h('span', { class: 'to-txt' }, h('b', null, K.wineTitle(x.w)), h('span', { class: 'pr-origin' }, K.origin(x.w) ? K.origin(x.w).kind + ' · ' + K.origin(x.w).where : K.COL[x.w.colour]), h('span', { class: 'muted' }, why(x))),
      h('span', { class: 'pr-price' }, K.price(x.w.bottlePrice), x.w.byGlass && x.w.glassPrice ? h('small', null, K.price(x.w.glassPrice) + ' glass') : null));
    /* two bottles at each price: the one to lead with, and another so the same wine is not sold to every table */
    const tier = (label, range, xs) => h('section', { class: 'pr-tier' },
      h('div', { class: 'pr-h' }, h('b', null, label), h('span', { class: 'muted' }, range)),
      xs.length ? xs.map((x, i) => [i ? h('span', { class: 'pr-or' }, 'or') : null, bottle(x)]) : h('p', { class: 'muted' }, 'Nothing at this price suits it.'));
    const e = (n) => Math.round(n) + ' €';
    const glass = p.house.filter((w) => byTheGlass(w) && avail(w)).concat(p.kind && ['dessert', 'cheese'].includes(p.kind[0]) ? listed().filter((w) => byTheGlass(w) && avail(w) && !p.house.includes(w)) : []);
    const glassRow = (w) => h('button', { type: 'button', class: 'pr-wine', onclick: () => K.go('winepage', { id: w.id }) }, K.wineLabel(w, 'mini'),
      h('span', { class: 'to-txt' }, h('b', null, K.wineTitle(w)), h('span', { class: 'pr-origin' }, K.origin(w) ? K.origin(w).kind + ' · ' + K.origin(w).where : K.COL[w.colour]), h('span', { class: 'muted' }, (d.n.pairWhy || {})[w.id] || w.say || about(w))),
      h('span', { class: 'pr-price' }, K.price(w.glassPrice), h('small', null, 'a glass')));
    const any = t && (t.low.length || t.mid.length || t.high.length);
    const shown = (t ? t.low.concat(t.mid, t.high) : []).map((x) => x.w).concat(glass);
    const more = p.house.filter((w) => avail(w) && !shown.includes(w));
    return K.sheet('What to pour with ' + K.dn(d), h('div', { class: 'stack' },
      d.n.pairText ? h('p', { class: 'prose' }, d.n.pairText) : null,
      tWine ? h('button', { type: 'button', class: 'pr-tasting', onclick: () => K.go('winepage', { id: tWine.id }) }, K.icon('glass'), h('span', null, h('b', null, 'On the tasting menu: '), K.wineTitle(tWine))) : null,
      p.kind ? h('p', { class: 'hint' }, p.kind[3]) : null,
      glass.length ? h('section', { class: 'pr-tier' }, h('div', { class: 'pr-h' }, h('b', null, 'By the glass'), h('span', { class: 'muted' }, 'sweet wines')), glass.map(glassRow)) : null,
      any ? [glass.length ? h('p', { class: 'hint' }, 'Or a bottle for the table:') : null, tier('Good value', 'up to ' + e(t.bands.low), t.low), tier('The middle', e(t.bands.low) + ' to ' + e(t.bands.high), t.mid), tier('The special bottle', 'from ' + e(t.bands.high), t.high)]
        : glass.length ? null : p.house.length || p.style.length ? h('div', { class: 'to-rows' }, p.house.map((w) => wineRow(w, (d.n.pairWhy || {})[w.id] || about(w))).concat(p.style.map((x) => wineRow(x.w, about(x.w)))))
          : h('p', { class: 'muted' }, 'Nothing on the list stands out for this dish. Ask the manager, who can link a wine to it under Edit.'),
      any ? h('p', { class: 'hint' }, 'Two bottles at each price, from what is in stock: change which one you offer, so the whole list sells. To sell up: offer the middle first, then say in a few words what the special bottle adds.') : null,
      more.length ? h('details', { class: 'pr-more' }, h('summary', null, 'Also good with it (' + more.length + ')'),
        h('div', { class: 'to-rows' }, more.map((w) => wineRow(w, K.price(w.bottlePrice) + ' · ' + ((d.n.pairWhy || {})[w.id] || about(w)))))) : null,
      any ? null
        : glass.length ? h('p', { class: 'hint' }, 'Offer a glass when you clear the main course, before the guest has decided against dessert.') : null), { wide: true });
  };
})();
