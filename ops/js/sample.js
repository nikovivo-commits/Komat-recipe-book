/* Komat Back Office: example kitchen used by "Load example data".
 * Every record carries example: true so it can be removed in one go.
 * Supplier addresses use example.com, so nothing can be emailed by accident. */
(function (root) {
  'use strict';

  function build(today, L) {
    const t = today || new Date();
    const day = function (n) { return L.isoDate(L.addDays(t, n)); };

    const suppliers = [
      { id: 'ex-produce', name: 'Example Fresh Produce', contact: 'Produce team', email: 'orders@produce.example.com', phone: '+00 000 000 001', orderDays: [1, 3, 5], cutoff: '15:00', leadDays: 1, minOrder: 80, customerNo: 'K-1042' },
      { id: 'ex-meat', name: 'Example Meat & Fish', contact: 'Butchery desk', email: 'orders@meatfish.example.com', phone: '+00 000 000 002', orderDays: [2, 4], cutoff: '12:00', leadDays: 1, minOrder: 120, customerNo: '55871' },
      { id: 'ex-dry', name: 'Example Dairy & Dry Goods', contact: 'Order desk', email: 'orders@drygoods.example.com', phone: '+00 000 000 003', orderDays: [1, 4], cutoff: '18:00', leadDays: 2, minOrder: 150, customerNo: 'KOM-77' },
      { id: 'ex-drinks', name: 'Example Drinks Co', contact: 'Sales', email: 'orders@drinks.example.com', phone: '+00 000 000 004', orderDays: [3], cutoff: '16:00', leadDays: 2, minOrder: 200, customerNo: '30019' }
    ];

    const P = 'ex-produce', M = 'ex-meat', D = 'ex-dry', B = 'ex-drinks';
    const W = 'Walk-in fridge', F = 'Freezer', S = 'Dry store', R = 'Bar';
    // [name, category, location, unit, onHand, par, reorderAt, packSize, packLabel, supplier, cost, price]
    const rows = [
      ['Tomatoes', 'Produce', W, 'kg', 3, 12, 4, 6, 'box', P, 2.4],
      ['Red onions', 'Produce', S, 'kg', 8, 10, null, 10, 'sack', P, 1.1],
      ['Potatoes, waxy', 'Produce', S, 'kg', 0, 25, null, 25, 'sack', P, 0.85],
      ['Lemons', 'Produce', W, 'pcs', 14, 40, null, 20, 'net', P, 0.35],
      ['Flat-leaf parsley', 'Produce', W, 'bunch', 2, 8, null, 1, '', P, 0.9],
      ['Garlic', 'Produce', S, 'kg', 1.5, 2, 0.5, 1, '', P, 6.5],
      ['Mixed salad leaves', 'Produce', W, 'kg', 0.8, 3, null, 1, '', P, 9.8],
      ['Chicken thighs, boneless', 'Meat & fish', W, 'kg', 4, 10, null, 5, 'case', M, 7.9],
      ['Beef mince 15%', 'Meat & fish', W, 'kg', 6, 8, null, 2, 'pack', M, 9.4],
      ['Salmon fillet', 'Meat & fish', W, 'kg', 1.2, 6, null, 1, '', M, 18.5],
      ['Pork belly', 'Meat & fish', F, 'kg', 0, 5, null, 1, '', M, 8.4],
      ['Butter, unsalted', 'Dairy', W, 'kg', 2, 6, null, 5, 'case', D, 8.2],
      ['Cream 35%', 'Dairy', W, 'l', 4, 10, null, 6, 'case', D, 3.6],
      ['Eggs, free range', 'Dairy', W, 'pcs', 90, 180, null, 30, 'tray', D, 0.28],
      ['Parmesan', 'Dairy', W, 'kg', 1.8, 3, null, 1, '', D, 19],
      ['Flour type 00', 'Dry goods', S, 'kg', 12, 25, null, 25, 'sack', D, 0.9],
      ['Olive oil, extra virgin', 'Dry goods', S, 'l', 3, 10, null, 5, 'can', D, 7.8],
      ['Arborio rice', 'Dry goods', S, 'kg', 5, 10, null, 5, 'bag', D, 3.2],
      ['Napkins', 'Non-food', S, 'pack', 6, 10, null, 1, '', D, 4.5],
      ['House red', 'Wine', R, 'bottle', 9, 24, null, 6, 'case', B, 6.2, 34],
      ['House white', 'Wine', R, 'bottle', 14, 24, null, 6, 'case', B, 5.9, 32],
      ['Lager keg 30 l', 'Beer', 'Cellar', 'keg', 1, 3, null, 1, '', B, 89],
      ['Sparkling water 0.75 l', 'Soft drinks', R, 'bottle', 30, 48, null, 12, 'case', B, 0.6, 5.5],
      ['Espresso beans', 'Coffee', S, 'kg', 1, 4, null, 1, '', B, 22],
      ['Prosecco Extra Dry', 'Wine', R, 'bottle', 7, 18, null, 6, 'case', B, 7.4, 38],
      ['Rosé, Côtes de Provence', 'Wine', R, 'bottle', 5, 12, null, 6, 'case', B, 9.1, 42],
      ['Rioja Reserva', 'Wine', 'Cellar', 'bottle', 4, 6, null, 6, 'case', B, 14.5, 68],
      ['Chablis', 'Wine', 'Cellar', 'bottle', 2, 6, null, 6, 'case', B, 16, 72],
      ['Cola 0.33 l', 'Soft drinks', R, 'bottle', 26, 48, null, 24, 'case', B, 0.75, 4.5],
      ['Lemonade 0.33 l', 'Soft drinks', R, 'bottle', 9, 24, null, 24, 'case', B, 0.8, 4.5],
      ['Apple juice 0.2 l', 'Soft drinks', R, 'bottle', 18, 24, null, 24, 'case', B, 0.7, 4],
      ['Ginger beer 0.2 l', 'Soft drinks', R, 'bottle', 0, 12, null, 24, 'case', B, 0.95, 5],
      ['Still water 0.75 l', 'Soft drinks', R, 'bottle', 20, 36, null, 12, 'case', B, 0.5, 5]
    ];
    // How the bar sells them: wines by bottle (and glass), soft drinks per piece.
    const SOLD = {
      'House red': { kind: 'wine', colour: 'red', producer: 'Cantina Example', grape: 'Montepulciano', region: 'Abruzzo', vintage: '2022', glassCl: 15, glassPrice: 8.5 },
      'House white': { kind: 'wine', colour: 'white', producer: 'Weingut Beispiel', grape: 'Grüner Veltliner', region: 'Niederösterreich', vintage: '2023', glassCl: 15, glassPrice: 8 },
      'Prosecco Extra Dry': { kind: 'wine', colour: 'sparkling', producer: 'Example Spumanti', grape: 'Glera', region: 'Veneto', vintage: 'NV', glassCl: 12.5, glassPrice: 9 },
      'Rosé, Côtes de Provence': { kind: 'wine', colour: 'rose', producer: 'Domaine Exemple', grape: 'Grenache, Cinsault', region: 'Provence', vintage: '2023', glassCl: 15, glassPrice: 10 },
      'Rioja Reserva': { kind: 'wine', colour: 'red', producer: 'Bodega Ejemplo', grape: 'Tempranillo', region: 'Rioja', vintage: '2018' },
      'Chablis': { kind: 'wine', colour: 'white', producer: 'Domaine Exemple', grape: 'Chardonnay', region: 'Burgundy', vintage: '2022' },
      'Sparkling water 0.75 l': { kind: 'drink' },
      'Cola 0.33 l': { kind: 'drink' },
      'Lemonade 0.33 l': { kind: 'drink' },
      'Apple juice 0.2 l': { kind: 'drink' },
      'Ginger beer 0.2 l': { kind: 'drink' },
      'Still water 0.75 l': { kind: 'drink' }
    };
    // Counted half an hour ago; the example sales below happened before that, so they show in reports only.
    const countedAt = t.getTime() - 30 * 60 * 1000;
    const items = rows.map(function (r, i) {
      const item = {
        id: 'ex-item-' + String(i + 1).padStart(2, '0'),
        name: r[0], category: r[1], location: r[2], unit: r[3], onHand: r[4], par: r[5],
        packSize: r[7], packLabel: r[8], supplierId: r[9], cost: r[10]
      };
      if (r[6] !== null) item.reorderAt = r[6];
      if (r[11] !== undefined) item.price = r[11];
      item.baseAt = countedAt;
      item.countedAt = countedAt;
      const sold = SOLD[item.name];
      if (sold) {
        Object.assign(item, sold);
        if (sold.kind === 'wine') item.bottleCl = 75;
      }
      return item;
    });
    const byName = {};
    items.forEach(function (i) { byName[i.name] = i; });

    // Deterministic bookings for the next two weeks: busier towards the weekend.
    const reservations = [];
    const labels = ['Example: table for 2', 'Example: family dinner', 'Example: business lunch', 'Example: birthday', 'Example: walk-in hold', 'Example: date night'];
    const times = ['12:00', '12:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'];
    for (let d = 0; d < 14; d++) {
      const date = L.addDays(t, d);
      const wd = date.getDay();
      const count = wd === 5 || wd === 6 ? 8 : wd === 0 ? 4 : wd === 1 ? 2 : 4;
      for (let k = 0; k < count; k++) {
        const seed = (d * 7 + k * 3 + wd) % 6;
        reservations.push({
          id: 'ex-res-' + d + '-' + k,
          date: L.isoDate(date),
          time: times[(k * 2 + d) % times.length],
          name: labels[seed],
          covers: [2, 4, 3, 8, 2, 2][seed] + (wd === 6 && k === 0 ? 6 : 0),
          note: seed === 3 ? 'Cake at 20:30' : '',
          source: 'example'
        });
      }
    }

    const orders = [{
      id: 'ex-order-1',
      number: 'K-EXAMPLE-01',
      supplierId: B,
      status: 'sent',
      sentVia: 'example',
      createdAt: L.addDays(t, -2).getTime(),
      sentAt: L.addDays(t, -2).getTime(),
      deliveryDate: day(0),
      note: '',
      lines: [L.lineFor(items[20], 2), L.lineFor(items[23], 2)]
    }];

    // Two evenings of bar sales: [item, serve, how many]
    const evening = [
      ['House red', 'glass', 14], ['House red', 'bottle', 3], ['House white', 'glass', 9], ['House white', 'bottle', 2],
      ['Prosecco Extra Dry', 'glass', 11], ['Prosecco Extra Dry', 'bottle', 1], ['Rosé, Côtes de Provence', 'glass', 6],
      ['Rioja Reserva', 'bottle', 1], ['Cola 0.33 l', 'piece', 12], ['Lemonade 0.33 l', 'piece', 7], ['Apple juice 0.2 l', 'piece', 5],
      ['Ginger beer 0.2 l', 'piece', 4], ['Sparkling water 0.75 l', 'piece', 9], ['Still water 0.75 l', 'piece', 6]
    ];
    const moves = [-1, -2].map(function (offset) {
      const date = L.addDays(t, offset);
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 21, 0).getTime();
      return {
        id: L.isoDate(date) + '~example',
        date: L.isoDate(date),
        tab: 'example',
        entries: evening.map(function (s, k) {
          const item = byName[s[0]];
          const serve = L.serveOf(item, s[1]);
          const n = offset === -2 ? Math.max(1, Math.round(s[2] * 0.8)) : s[2];
          return { t: at + k * 60000, i: item.id, k: 'sale', s: s[1], n: n, p: serve.price, q: -L.round(serve.portion * n, 4), src: 'bar' };
        })
      };
    });

    // What the Komat Kitchen Book would send over: a station's order check and an upcoming event.
    const kitchen = [
      { id: 'req-example-hot', date: day(0), station: 'hot', at: t.getTime() - 3 * 3600 * 1000, items: [{ n: 'Eggs, free range', s: 'out', note: '' }, { n: 'Microgreens', s: 'low', note: 'For brunch plates' }] },
      { id: 'ev-example', title: 'Example: birthday dinner', date: day(2), time: '19:00', guests: '24', status: 'confirmed', kind: 'Birthday', menu: 'Set menu, 3 courses' },
      { id: 'products', items: [
        { name: 'Microgreens', units: ['g'], usedIn: ['Scrambled eggs', 'Beluga lentils'], stations: ['pass'], onMenu: true },
        { name: 'Beluga lentils', units: ['g'], usedIn: ['Beluga lentils'], stations: ['hot'], onMenu: true },
        { name: 'Cashew cheese', units: ['g'], usedIn: ['Beluga lentils'], stations: ['hot'], onMenu: true },
        { name: 'Celeriac', units: ['g'], usedIn: ['Beluga lentils'], stations: ['hot'], onMenu: true },
        { name: 'King oyster mushrooms', units: ['g'], usedIn: ['Mushroom jus'], stations: ['hot'], onMenu: false }
      ] },
      { id: 'meta', syncedAt: t.getTime() - 3600 * 1000, source: 'example' }
    ];

    [suppliers, items, reservations, orders, moves, kitchen].forEach(function (list) {
      list.forEach(function (x) { x.example = true; });
    });
    return { suppliers: suppliers, items: items, reservations: reservations, orders: orders, moves: moves, kitchen: kitchen };
  }

  const api = { build: build };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KomatSample = api;
})(typeof window !== 'undefined' ? window : globalThis);
