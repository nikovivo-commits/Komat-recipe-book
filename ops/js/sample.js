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
      ['Espresso beans', 'Coffee', S, 'kg', 1, 4, null, 1, '', B, 22]
    ];
    const items = rows.map(function (r, i) {
      const item = {
        id: 'ex-item-' + String(i + 1).padStart(2, '0'),
        name: r[0], category: r[1], location: r[2], unit: r[3], onHand: r[4], par: r[5],
        packSize: r[7], packLabel: r[8], supplierId: r[9], cost: r[10]
      };
      if (r[6] !== null) item.reorderAt = r[6];
      if (r[11] !== undefined) item.price = r[11];
      return item;
    });

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

    [suppliers, items, reservations, orders].forEach(function (list) {
      list.forEach(function (x) { x.example = true; });
    });
    return { suppliers: suppliers, items: items, reservations: reservations, orders: orders };
  }

  const api = { build: build };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.KomatSample = api;
})(typeof window !== 'undefined' ? window : globalThis);
