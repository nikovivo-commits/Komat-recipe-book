'use strict';
// Run with: node --test ops/tests
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');
const Sample = require('../js/sample.js');

test('parseNum understands European and English number formats', () => {
  assert.equal(L.parseNum('1,5'), 1.5);
  assert.equal(L.parseNum('1.234,50'), 1234.5);
  assert.equal(L.parseNum('1,234.50'), 1234.5);
  assert.equal(L.parseNum('€ 12,90'), 12.9);
  assert.equal(L.parseNum('2.5 kg'), 2.5);
  assert.equal(L.parseNum('1.234.567'), 1234567);
  assert.ok(Number.isNaN(L.parseNum('')));
  assert.ok(Number.isNaN(L.parseNum('abc')));
});

test('stock status: out, low at the reorder point, ok above it', () => {
  assert.equal(L.stockStatus({ onHand: 0, par: 10 }), 'out');
  assert.equal(L.stockStatus({ onHand: 4, par: 10 }), 'low'); // default reorder point is 40% of par
  assert.equal(L.stockStatus({ onHand: 4.5, par: 10 }), 'ok');
  assert.equal(L.stockStatus({ onHand: 6, par: 10, reorderAt: 6 }), 'low');
  assert.equal(L.stockStatus({ onHand: 3 }), 'ok'); // no par: never low
});

test('suggestLine rounds up to whole packs and respects stock on order', () => {
  const item = { id: 'a', name: 'House red', unit: 'bottle', onHand: 4, par: 24, packSize: 6, packLabel: 'case', cost: 6 };
  const line = L.suggestLine(item, 0, 1);
  assert.equal(line.qty, 4); // need 20 bottles -> 4 cases (24)
  assert.equal(line.orderUnit, 'case');
  assert.equal(L.describeLine(line), '4 × case (6 bottle)');
  assert.equal(L.suggestLine(item, 12, 1), null); // 4 + 12 on order is above the reorder point (9.6)
  const boosted = L.suggestLine(item, 0, 1.5); // target 36 -> need 32 -> 6 cases
  assert.equal(boosted.qty, 6);
});

test('suggestLine for loose items orders exact units', () => {
  const line = L.suggestLine({ id: 'b', name: 'Salmon', unit: 'kg', onHand: 1.2, par: 6 }, 0, 1);
  assert.equal(line.qty, 5); // 4.8 rounds up to 5 kg
  assert.equal(L.describeLine(line), '5 kg');
});

test('suggestOrders groups by supplier and ignores items without one', () => {
  const sample = Sample.build(new Date(2026, 9, 29), L);
  const groups = L.suggestOrders(sample.items, sample.suppliers, sample.orders, 1);
  assert.ok(groups.length >= 3);
  groups.forEach(g => assert.ok(g.lines.every(l => sample.items.find(i => i.id === l.itemId).supplierId === g.supplier.id)));
  const drinks = groups.find(g => g.supplier.id === 'ex-drinks');
  // House white (14, par 24) is above its reorder point, and espresso beans are already on order.
  assert.ok(!drinks.lines.find(l => l.name === 'House white'));
  assert.ok(!drinks.lines.find(l => l.name === 'Espresso beans'));
  assert.ok(drinks.lines.find(l => l.name === 'House red'));
  assert.equal(L.suggestOrders([{ id: 'x', name: 'Loose', onHand: 0, par: 5 }], sample.suppliers, [], 1).length, 0);
});

test('onOrderMap counts sent orders only, in counted units', () => {
  const map = L.onOrderMap([
    { status: 'sent', lines: [{ itemId: 'a', qty: 2, unitsPerPack: 6 }] },
    { status: 'draft', lines: [{ itemId: 'a', qty: 5, unitsPerPack: 6 }] },
    { status: 'received', lines: [{ itemId: 'a', qty: 1, unitsPerPack: 6 }] }
  ]);
  assert.deepEqual(map, { a: 12 });
});

test('demandBoost raises orders only in busy weeks and caps the raise', () => {
  const today = new Date(2026, 9, 29);
  const res = [];
  for (let i = 0; i < 7; i++) res.push({ date: L.isoDate(L.addDays(today, i)), covers: 30 });
  assert.equal(L.demandBoost(res, { normalCoversWeek: 140 }, today).factor, 1.5); // 210/140 = 1.5
  assert.equal(L.demandBoost(res, { normalCoversWeek: 100, boostCap: 1.3 }, today).factor, 1.3);
  assert.equal(L.demandBoost(res, { normalCoversWeek: 300 }, today).factor, 1); // quiet week: never below par
  assert.equal(L.demandBoost(res, { normalCoversWeek: 100, boost: false }, today).factor, 1);
  assert.equal(L.demandBoost(res, {}, today).factor, 1);
  // Bookings outside the window and cancelled ones do not count.
  res.push({ date: L.isoDate(L.addDays(today, 8)), covers: 500 }, { date: L.isoDate(today), covers: 500, status: 'cancelled' });
  assert.equal(L.demandBoost(res, { normalCoversWeek: 140 }, today).booked, 210);
});

test('nextOrderDay finds today or the next listed weekday', () => {
  const wed = new Date(2026, 9, 28); // Wednesday
  assert.deepEqual(L.nextOrderDay({ orderDays: [3] }, wed), { date: '2026-10-28', inDays: 0, weekday: 'Wed' });
  assert.equal(L.nextOrderDay({ orderDays: [1] }, wed).date, '2026-11-02');
  assert.equal(L.nextOrderDay({ orderDays: [] }, wed), null);
  assert.equal(L.expectedDelivery({ leadDays: 2 }, wed), '2026-10-30');
});

test('orderEmail lists every line and the supplier details', () => {
  const order = {
    number: 'K261029-01',
    deliveryDate: '2026-10-30',
    note: 'Back door please.',
    lines: [
      { name: 'House red', qty: 4, orderUnit: 'case', unitsPerPack: 6, unit: 'bottle' },
      { name: 'Salmon fillet', qty: 5, orderUnit: 'kg', unitsPerPack: 1, unit: 'kg', sku: 'SAL-1' },
      { name: 'Nothing', qty: 0, orderUnit: 'kg', unitsPerPack: 1, unit: 'kg' }
    ]
  };
  const mail = L.orderEmail(order, { name: 'Fresh Co', contact: 'Anna', customerNo: '42' }, { restaurant: 'Komat', sender: 'Niko', address: 'Main St 1' });
  assert.match(mail.subject, /^Order K261029-01 from Komat – delivery 2026-10-30$/);
  assert.match(mail.body, /^Hello Anna,/);
  assert.match(mail.body, /4 × case \(6 bottle\)\s+House red/);
  assert.match(mail.body, /5 kg\s+Salmon fillet {2}\[SAL-1\]/);
  assert.doesNotMatch(mail.body, /Nothing/);
  assert.match(mail.body, /Customer no\.: 42/);
  assert.match(mail.body, /Deliver to: Main St 1/);
  assert.match(mail.body, /Back door please\./);
  assert.match(mail.body, /Niko\nKomat$/);
});

test('orderNumber does not repeat on the same day', () => {
  const d = new Date(2026, 9, 29);
  assert.equal(L.orderNumber(d, []), 'K261029-01');
  assert.equal(L.orderNumber(d, [{ number: 'K261029-01' }]), 'K261029-02');
});

test('parseCSV handles semicolons, quotes, BOM and blank lines', () => {
  const rows = L.parseCSV('﻿Artikel;Bestand;Notiz\r\n"Tomaten, rot";3,5;"sagt ""frisch"""\r\n\r\nZwiebeln;10;\n');
  assert.deepEqual(rows, [['Artikel', 'Bestand', 'Notiz'], ['Tomaten, rot', '3,5', 'sagt "frisch"'], ['Zwiebeln', '10', '']]);
  assert.equal(L.detectDelimiter('a,b,c\n1,2,3'), ',');
  assert.equal(L.detectDelimiter('a\tb\n1\t2'), '\t');
});

test('mapHeaders recognises German columns', () => {
  const headers = ['Art.-Nr.', 'Bezeichnung', 'Warengruppe', 'Einheit', 'Istbestand', 'Mindestbestand', 'Sollbestand', 'EK-Preis', 'VK-Preis', 'Lieferant', 'Lagerort'];
  const m = L.mapHeaders(headers);
  assert.equal(m.sku, 0);
  assert.equal(m.name, 1);
  assert.equal(m.category, 2);
  assert.equal(m.unit, 3);
  assert.equal(m.onHand, 4);
  assert.equal(m.reorderAt, 5);
  assert.equal(m.par, 6);
  assert.equal(m.cost, 7);
  assert.equal(m.price, 8);
  assert.equal(m.supplier, 9);
  assert.equal(m.location, 10);
});

test('rowsToItems turns rows into items and skips rows without a name', () => {
  const rows = L.parseCSV('Name;On hand;Unit;Par;Cost;Supplier\nTomatoes;3,5;kg;12;2,40;Fresh Co\n;5;kg;;;\n');
  const items = L.rowsToItems(rows, L.mapHeaders(rows[0]));
  assert.deepEqual(items, [{ name: 'Tomatoes', unit: 'kg', supplier: 'Fresh Co', onHand: 3.5, par: 12, cost: 2.4 }]);
});

test('itemsToCSV round-trips through the importer', () => {
  const items = [{ id: '1', name: 'Olive oil, "EV"', unit: 'l', onHand: 3, par: 10, cost: 7.8, supplierId: 's' }];
  const csv = L.itemsToCSV(items, [{ id: 's', name: 'Dry Goods' }]);
  const rows = L.parseCSV(csv);
  const back = L.rowsToItems(rows, L.mapHeaders(rows[0]));
  assert.equal(back[0].name, 'Olive oil, "EV"');
  assert.equal(back[0].onHand, 3);
  assert.equal(back[0].supplier, 'Dry Goods');
});

test('rowsToReservations reads European dates and guest counts', () => {
  const rows = L.parseCSV('Datum;Uhrzeit;Name;Personen\n30.10.2026;19.30;Meier;4\n2026-10-31;20:00;Smith;2\nbad;;x;\n');
  assert.deepEqual(L.rowsToReservations(rows).map(r => [r.date, r.time, r.name, r.covers]), [
    ['2026-10-30', '19:30', 'Meier', 4],
    ['2026-10-31', '20:00', 'Smith', 2]
  ]);
});

test('supplierQuery and threadRows build Gmail searches and rows', () => {
  assert.equal(L.supplierQuery([{ email: 'A@x.com, b@y.com' }, { email: 'not-an-email' }, { email: 'a@x.com' }]), 'from:(a@x.com OR b@y.com) newer_than:30d');
  assert.equal(L.supplierQuery([{}]), '');
  const rows = L.threadRows({ threads: [{ id: '1a1819d8603432fd', messageCount: 1, messages: [{ id: 'm', sender: 'Shop <s@x.com>', subject: 'Order confirmed', threadId: '1a1819d8603432fd' }] }] });
  assert.equal(rows[0].subject, 'Order confirmed');
  assert.equal(new Date(rows[0].time).toISOString().slice(0, 10), '2026-10-28'); // time from the thread id
  assert.match(rows[0].url, /mail\.google\.com.*1a1819d8603432fd/);
  assert.deepEqual(L.threadRows({}), []);
});

test('example data is internally consistent', () => {
  const s = Sample.build(new Date(2026, 9, 29), L);
  const supplierIds = new Set(s.suppliers.map(x => x.id));
  s.items.forEach(i => assert.ok(supplierIds.has(i.supplierId), i.name));
  [s.items, s.suppliers, s.reservations, s.orders].forEach(list => list.forEach(x => assert.equal(x.example, true)));
  s.suppliers.forEach(x => assert.match(x.email, /@[a-z]+\.example\.com$/));
});

/* ---------- front of house ---------- */

const wine = { id: 'w', name: 'House red', kind: 'wine', unit: 'bottle', bottleCl: 75, glassCl: 15, price: 34, glassPrice: 8.5, cost: 6, onHand: 4.6 };
const cola = { id: 'c', name: 'Cola 0.33 l', kind: 'drink', unit: 'bottle', price: 4.5, cost: 0.9, onHand: 20 };

test('serves: wines by bottle and glass, drinks per piece, other items not sold', () => {
  assert.deepEqual(L.servesOf(wine).map(s => [s.id, s.portion, s.price]), [['bottle', 1, 34], ['glass', 0.2, 8.5]]);
  assert.equal(L.servesOf(wine)[1].label, 'Glass 15 cl');
  assert.deepEqual(L.servesOf({ kind: 'wine', bottleCl: 75 }).map(s => s.id), ['bottle']); // no glass size: bottles only
  assert.deepEqual(L.servesOf(cola).map(s => [s.id, s.portion, s.price]), [['piece', 1, 4.5]]);
  assert.deepEqual(L.servesOf({ name: 'Tomatoes' }), []);
});

test('margins take VAT out of the menu price', () => {
  const glass = L.serveOf(wine, 'glass');
  assert.equal(L.serveMargin(wine, glass, 0), Math.round((1 - 1.2 / 8.5) * 100));
  assert.equal(L.serveMargin(wine, glass, 20), Math.round((1 - 1.2 / (8.5 / 1.2)) * 100));
  assert.equal(L.serveMargin({ kind: 'drink', price: 4 }, { price: 4, portion: 1 }, 0), null); // no cost known
});

test('wineStock reads bottles and loose glasses', () => {
  assert.deepEqual(L.wineStock(wine), { bottles: 4, glasses: 3, totalGlasses: 23, text: '4 btl + 3 gl' });
  assert.equal(L.wineStock({ kind: 'wine', bottleCl: 75, onHand: 2 }).text, '2 btl');
});

test('applyMoves: stock = count + movements recorded after the count', () => {
  const items = [{ id: 'w', onHand: 10, baseAt: 1000 }, { id: 'x', onHand: 5 }];
  const moves = [
    { date: '2026-10-29', entries: [{ t: 900, i: 'w', q: -5 }, { t: 1100, i: 'w', q: -0.2 }, { t: 1200, i: 'w', q: -1 }] },
    { date: '2026-10-29', entries: [{ t: 1300, i: 'w', q: 6 }, { t: 50, i: 'x', q: -7 }] }
  ];
  const out = L.applyMoves(items, moves);
  assert.equal(out[0].onHand, 14.8); // the -5 happened before the count and is ignored
  assert.equal(out[1].onHand, 0); // never shown below zero
  assert.equal(out[1].rawOnHand, 5);
});

test('consolidation folds month-old movements into the count at a fixed cut-off', () => {
  const now = new Date(2026, 9, 29, 12);
  const day = L.DAY_MS;
  const items = [{ id: 'w', onHand: 10, baseAt: now - 60 * day }, { id: 'y', onHand: 3, baseAt: now - 5 * day }];
  const moves = [{ entries: [
    { t: now - 40 * day, i: 'w', q: -2 }, { t: now - 3 * day, i: 'w', q: -1 }, { t: now - 3600e3, i: 'w', q: -4 },
    { t: now - 3 * day, i: 'y', q: -1 }
  ] }];
  const out = L.consolidation(items, moves, now);
  assert.equal(out.length, 1); // y has nothing older than a month
  assert.equal(out[0].onHand, 7); // -2 and -1 folded; the movement from an hour ago stays a movement
  assert.equal(out[0].baseAt, L.addDays(now, -2).getTime());
  // Same live stock before and after folding.
  const after = L.applyMoves([Object.assign({}, items[0], out[0])], moves)[0].onHand;
  assert.equal(after, L.applyMoves(items, moves)[0].onHand);
});

test('salesSummary adds up sales per serve within the dates', () => {
  const docs = [
    { date: '2026-10-28', entries: [{ t: 1, i: 'w', s: 'glass', n: 3, p: 8.5, q: -0.6, k: 'sale' }, { t: 2, i: 'w', q: 6, k: 'receive' }] },
    { date: '2026-10-29', entries: [{ t: 3, i: 'w', s: 'glass', n: 1, p: 8.5, q: -0.2, k: 'sale' }, { t: 4, i: 'c', s: 'piece', n: 4, p: 4.5, q: -4, k: 'sale', src: 'pos' }] },
    { date: '2026-10-30', entries: [{ t: 5, i: 'w', s: 'bottle', n: 1, p: 34, q: -1, k: 'sale' }] }
  ];
  const s = L.salesSummary(docs, [wine, cola], '2026-10-28', '2026-10-29');
  assert.equal(s.qty, 8);
  assert.equal(s.revenue, 52);
  assert.deepEqual(s.sources, { bar: 4, pos: 4 });
  assert.deepEqual(s.rows.map(r => [r.name, r.label, r.qty, r.revenue]), [['House red', 'Glass 15 cl', 4, 34], ['Cola 0.33 l', 'Per bottle', 4, 18]]);
});

test('till report: rows add up per article and are matched to wines and drinks', () => {
  const rows = L.parseCSV('PLU;Artikel;Menge;Umsatz\n101;House red 0,15;3;25,50\n101;House red 0,15;1;8,50\n102;House red Flasche;1;34,00\n200;Cola 0.33 l;4;18,00\n300;Schnitzel;12;180,00\n;Summe;21;266,00\n');
  const m = L.mapSalesHeaders(rows[0]);
  assert.deepEqual([m.sku, m.name, m.qty, m.revenue], [0, 1, 2, 3]);
  const sales = L.rowsToSales(rows, m);
  assert.deepEqual(sales.map(x => [x.name, x.qty, x.revenue]), [['House red 0,15', 4, 34], ['House red Flasche', 1, 34], ['Cola 0.33 l', 4, 18], ['Schnitzel', 12, 180]]);
  const items = [wine, cola, { id: 't', name: 'Tomatoes' }];
  assert.deepEqual(L.matchSale(sales[0], items, {}), { itemId: 'w', serveId: 'glass' });
  assert.deepEqual(L.matchSale(sales[1], items, {}), { itemId: 'w', serveId: 'bottle' });
  assert.deepEqual(L.matchSale(sales[2], items, {}), { itemId: 'c', serveId: 'piece' });
  assert.equal(L.matchSale(sales[3], items, {}), null);
  assert.deepEqual(L.matchSale(sales[3], items, { schnitzel: { ignore: true } }), { ignore: true });
  assert.equal(L.hash('a'), L.hash('a'));
  assert.notEqual(L.hash('a'), L.hash('b'));
});

/* ---------- kitchen ---------- */

test('kitchenProducts lists bought products, not preparations or basics', () => {
  const recipes = [
    { name: 'Белуга леща', onMenu: true, station: 'hot', ingredients: [], components: [
      { name: 'Пюре от целина', ingredients: [{ n: 'целина', q: '500', u: 'g' }, { n: 'лук', q: '150', u: 'g' }, { n: 'сол', q: '6', u: 'g' }, { n: 'карамелизиран лук', q: '200', u: 'g' }] },
      { name: 'Крокет леща', ingredients: [{ n: 'леща белуга, сготвена', q: '50', u: 'g' }, { n: 'лук, готвен с цвят', q: '120', u: 'g' }] }
    ] },
    { name: 'Карамелизиран лук', station: 'hot', ingredients: [{ n: 'лук', q: '1', u: 'kg' }] },
    { name: 'Бъркани яйца', onMenu: true, station: 'hot', ingredients: [{ n: 'яйца', q: '3', u: 'pcs' }, { n: 'бекон (4 слайса)', q: '60', u: 'g' }] }
  ];
  const p = L.kitchenProducts(recipes);
  const names = p.map(x => x.name);
  assert.deepEqual(names.slice().sort(), ['Бекон', 'Леща белуга', 'Лук', 'Целина', 'Яйца'].sort());
  const onion = p.find(x => x.name === 'Лук');
  assert.deepEqual(onion.usedIn.sort(), ['Белуга леща', 'Карамелизиран лук'].sort());
  assert.equal(L.stockUnitFor(onion.units), 'kg');
  assert.equal(L.stockUnitFor(['pcs']), 'pcs');
  assert.equal(L.stockUnitFor(['ml']), 'l');
});

test('kitchenAsks merges station requests and links them to stock items', () => {
  const items = [{ id: 'eggs', name: 'Яйца' }, { id: 'bac', name: 'Bacon' }];
  const asks = L.kitchenAsks([
    { date: '2026-10-29', station: 'hot', at: 10, items: [{ n: 'Яйца', s: 'low' }, { n: 'Бекон', s: 'out', note: 'for brunch' }] },
    { date: '2026-10-29', station: 'cold', at: 20, items: [{ n: 'яйца', s: 'out' }, { n: 'Микрозеленини', s: 'low' }] }
  ], items, { 'бекон': 'bac' });
  assert.deepEqual(asks.map(a => [a.name, a.status, a.itemId, a.stations.join('+')]), [
    ['Бекон', 'out', 'bac', 'hot'],
    ['яйца', 'out', 'eggs', 'hot+cold'],
    ['Микрозеленини', 'low', null, 'cold']
  ]);
});

test('a kitchen request puts the item on the next order until an order is sent', () => {
  const items = [{ id: 'eggs', name: 'Eggs', unit: 'pcs', onHand: 150, par: 180, packSize: 30, packLabel: 'tray', supplierId: 's' }];
  const suppliers = [{ id: 's', name: 'Dairy' }];
  assert.equal(L.suggestOrders(items, suppliers, [], 1).length, 0); // the count alone says enough
  const asks = [{ itemId: 'eggs', status: 'out', at: 100 }];
  const g = L.suggestOrders(items, suppliers, [], 1, asks);
  assert.equal(g[0].lines[0].qty, 6); // out: top up to par 180 = 6 trays
  assert.equal(g[0].lines[0].asked, 'out');
  const low = L.suggestOrders(items, suppliers, [], 1, [{ itemId: 'eggs', status: 'low', at: 100 }]);
  assert.equal(low[0].lines[0].qty, 4); // low: counted as at the reorder point (72) -> 108 = 4 trays
  const sentLater = [{ status: 'sent', sentAt: 200, lines: [{ itemId: 'eggs', qty: 6, unitsPerPack: 30 }] }];
  assert.equal(L.suggestOrders(items, suppliers, sentLater, 1, asks).length, 0);
  const noPar = [{ id: 'm', name: 'Microgreens', unit: 'box', onHand: 0, supplierId: 's' }];
  assert.equal(L.suggestOrders(noPar, suppliers, [], 1, [{ itemId: 'm', status: 'out', at: 1 }])[0].lines[0].qty, 1);
});

test('stock status for items that were never counted', () => {
  assert.equal(L.stockStatus({ onHand: 0 }), 'new');
  assert.equal(L.stockStatus({ onHand: 0, countedAt: 1 }), 'out');
  assert.equal(L.stockStatus({ onHand: 0, baseAt: 1 }), 'out');
});

test('eventBookings turns Kitchen Book events into covers', () => {
  const ev = L.eventBookings([
    { id: 'e1', title: 'Wedding', date: '2026-10-31', time: '18:00', guests: '35-40', status: 'confirmed' },
    { id: 'e2', title: 'Maybe party', date: '2026-10-31', guests: '20', status: 'pending' },
    { id: 'e3', title: 'Off', date: '2026-10-31', guests: '10', status: 'cancelled' }
  ]);
  assert.deepEqual(ev.map(e => [e.name, e.covers, e.status]), [['Wedding', 40, 'booked'], ['Maybe party', 20, 'pending']]);
  const week = L.bookingsByDay(ev, '2026-10-31', 1);
  assert.equal(week[0].covers, 40); // pending events don't count yet
});

test('Bulgarian Hype-style exports: stock list, sales report and bookings', () => {
  const stock = L.parseCSV('Код;Наименование;Група;Мярка;Количество;Доставна цена;Продажна цена;Доставчик;Склад\n1001;Домати;Зеленчуци;кг;3,5;2,40;0;Плод ЕООД;Кухня\n');
  const m = L.mapHeaders(stock[0]);
  assert.deepEqual([m.sku, m.name, m.category, m.unit, m.onHand, m.cost, m.price, m.supplier, m.location], [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(L.rowsToItems(stock, m)[0], { name: 'Домати', sku: '1001', category: 'Зеленчуци', location: 'Кухня', unit: 'кг', supplier: 'Плод ЕООД', onHand: 3.5, cost: 2.4, price: 0 });
  const sales = L.parseCSV('Артикул;Количество;Сума\nВино Мавруд чаша;6;54,00\nОбщо;6;54,00\n');
  const sm = L.mapSalesHeaders(sales[0]);
  assert.deepEqual([sm.name, sm.qty, sm.revenue], [0, 1, 2]);
  assert.deepEqual(L.rowsToSales(sales, sm).map(r => [r.name, r.qty, r.revenue]), [['Вино Мавруд чаша', 6, 54]]);
  const mavrud = { id: 'm', name: 'Вино Мавруд', kind: 'wine', bottleCl: 75, glassCl: 15, price: 40, glassPrice: 9 };
  assert.deepEqual(L.matchSale(L.rowsToSales(sales, sm)[0], [mavrud], {}), { itemId: 'm', serveId: 'glass' });
  const res = L.parseCSV('Дата;Час;Име;Брой гости;Телефон\n30.10.2026;19:30;Иванов;4;0888\n');
  assert.deepEqual(L.rowsToReservations(res).map(r => [r.date, r.time, r.name, r.covers]), [['2026-10-30', '19:30', 'Иванов', 4]]);
});
