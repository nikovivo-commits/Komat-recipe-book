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

test('mapHeaders recognises Hypersoft-style German columns', () => {
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
