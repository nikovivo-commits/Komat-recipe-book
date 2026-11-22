/* Tests against a pretend Hype on this computer (made-up sales): node test/test.mjs
   Nothing here talks to the real Hype or to Firestore. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import iconv from 'iconv-lite';
import { parseNum, parseTime, parseCsv, parseSales, parseStock, dayOf, dayBefore, formatDay, zonedToMs } from '../lib/parse.mjs';
import { openBrowser, closeBrowser } from '../lib/hype.mjs';
import { sync } from '../hype-sync.mjs';

const TZ = 'Europe/Sofia';
const COLS = { time: ['Час'], date: [], bill: ['Сметка'], item: ['Артикул'], qty: ['Количество'], price: ['Цена'], total: ['Сума'], op: ['Оператор'], cust: ['Клиент'] };
const csvFor = (d) => `Детайлни продажби;;;;;;;\r\nПериод: ${d} - ${d};;;;;;;\r\n` +
  'Час;Сметка;Артикул;Количество;Цена;Сума;Оператор;Клиент\r\n' +
  `${d} 19:05:10;1042;"Вино ""Примерно"", бяло 0.75";1;48,00;48,00;Примерен Оператор;\r\n` +
  `${d} 12:31:00;1040;Супа на деня;2;9,50;19,00;Примерен Оператор;Примерен Гост\r\n` +
  `${d} 19:06:00;1042;Минерална вода 0.75;-1;6,00;-6,00;Друг Оператор;\r\n` +
  'Общо;;;2;;61,00;;\r\n';

/* ---- reading ---- */
assert.equal(parseNum('1 234,50'), 1234.5);
assert.equal(parseNum('1,234.50'), 1234.5);
assert.equal(parseNum('12.5 лв'), 12.5);
assert.equal(parseNum('-1'), -1);
assert.equal(parseNum(''), null);
assert.equal(parseNum('1,000', '.'), 1000);
assert.equal(dayBefore('2026-03-01'), '2026-02-28');
assert.equal(formatDay('2026-11-02', 'D.M.YY'), '2.11.26');
assert.equal(zonedToMs(2026, 11, 22, 14, 10, 0, TZ), Date.UTC(2026, 10, 22, 12, 10, 0)); /* winter: UTC+2 */
assert.equal(zonedToMs(2026, 7, 1, 14, 10, 0, TZ), Date.UTC(2026, 6, 1, 11, 10, 0)); /* summer: UTC+3 */
assert.equal(parseTime('22.11.2026 14:10:05', 'DD.MM.YYYY HH:mm:ss', TZ, '2026-01-01'), Date.UTC(2026, 10, 22, 12, 10, 5));
assert.equal(parseTime('14:10', 'HH:mm', TZ, '2026-11-22'), Date.UTC(2026, 10, 22, 12, 10, 0));
assert.equal(parseTime('2026-11-22T14:10:05', 'YYYY-MM-DDTHH:mm:ss', TZ, '2026-01-01'), Date.UTC(2026, 10, 22, 12, 10, 5));
assert.equal(parseTime('Общо', 'DD.MM.YYYY HH:mm:ss', TZ, '2026-11-22'), null);
assert.deepEqual(parseCsv('a,b\n"x, ""y""",2\n\n'), [['a', 'b'], ['x, "y"', '2']]);
assert.equal(dayOf(Date.UTC(2026, 10, 22, 22, 30), TZ), '2026-11-23');

for (const enc of ['utf8', 'win1251', 'utf16le']) {
  const buf = enc === 'utf16le' ? Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode(csvFor('22.11.2026'), enc)]) : iconv.encode(csvFor('22.11.2026'), enc);
  const { rows, skipped } = parseSales(buf, { columns: COLS, timeFormat: 'DD.MM.YYYY HH:mm:ss' }, TZ, '2026-11-22');
  assert.equal(rows.length, 3, enc);
  assert.equal(skipped, 1, enc);
  assert.deepEqual(rows[0], { t: Date.UTC(2026, 10, 22, 10, 31, 0), bill: '1040', item: 'Супа на деня', qty: 2, price: 9.5, total: 19, op: 'Примерен Оператор', cust: 'Примерен Гост' });
  assert.equal(rows[1].item, 'Вино "Примерно", бяло 0.75');
  assert.equal(rows[2].qty, -1);
}
assert.throws(() => parseSales(Buffer.from('a;b\n1;2\n'), { columns: COLS }, TZ, '2026-11-22'), /could not find the columns/);
assert.deepEqual(parseStock(Buffer.from('Item,Quantity,Unit\nSample wine 0.75,11,btl\nSample gin,0.35,l\n'), { columns: { item: ['Item'], qty: ['Quantity'], unit: ['Unit'] } }).rows,
  [{ item: 'Sample gin', qty: 0.35, unit: 'l' }, { item: 'Sample wine 0.75', qty: 11, unit: 'btl' }]);
console.log('reading: ok');

/* ---- a pretend Hype ---- */
let hits = 0;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), inside = /sid=ok/.test(req.headers.cookie || '');
  const send = (code, type, body, extra = {}) => { res.writeHead(code, { 'content-type': type, ...extra }); res.end(body); };
  if (url.pathname === '/login' && req.method === 'POST') return send(302, 'text/plain', '', { 'set-cookie': 'sid=ok; Path=/; HttpOnly', location: '/' }); /* a cookie that ends with the browser */
  if (url.pathname === '/login') return send(200, 'text/html', '<html><form method="post" action="/login"><input name="u"><input type="password" name="p"><button>Sign in</button></form></html>');
  if (!inside) return send(302, 'text/plain', '', { location: '/login' });
  if (url.pathname === '/') return send(200, 'text/html', '<html>Back office</html>');
  if (url.pathname === '/reports/sales') return send(200, 'text/html', `<html><form action="/export/sales.csv"><input name="from"><input name="to"><button id="csv">CSV</button></form></html>`);
  if (url.pathname === '/export/sales.csv') { hits++; return send(200, 'text/csv', iconv.encode(csvFor(url.searchParams.get('from')), 'win1251'), { 'content-disposition': 'attachment; filename="sales.csv"' }); }
  if (url.pathname === '/export/stock.csv') return send(200, 'text/csv', 'Артикул;Наличност;Мярка\r\nПримерно вино 0.75;11;бр\r\n');
  send(404, 'text/plain', 'no');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-sync-test-'));
const cfg = {
  baseUrl: base, timezone: TZ, headless: true, timeoutSeconds: 20, loginUrlPattern: 'login', yesterdayUntilHour: 2,
  profileDir: path.join(tmp, 'profile'), stateFile: path.join(tmp, 'state.json'),
  sales: { mode: 'request', request: { url: '/export/sales.csv?from={from}&to={to}' }, paramDateFormat: 'DD.MM.YYYY', timeFormat: 'DD.MM.YYYY HH:mm:ss', columns: COLS,
    click: { url: '/reports/sales', steps: [{ fill: 'input[name=from]', value: '{from}' }, { fill: 'input[name=to]', value: '{to}' }], download: '#csv' } },
  stock: { enabled: true, mode: 'request', request: { url: '/export/stock.csv' }, columns: { item: ['Артикул'], qty: ['Наличност'], unit: ['Мярка'] } },
};
const written = [];
const db = { set: async (p, d) => { written.push([p, d]); } };
const noon = zonedToMs(2026, 11, 22, 14, 10, 0, TZ);

try {
  /* not signed in yet */
  let st = await sync(cfg, db, { now: noon });
  assert.deepEqual(st, { at: noon, ok: false, rows: 0, err: 'login' });
  assert.deepEqual(written.map((w) => w[0]), ['hypesync/status']);

  /* sign in by hand (here: by the test), then the browser closes */
  const ctx = await openBrowser(cfg, cfg.profileDir, { headless: true });
  const page = await ctx.newPage();
  await page.goto(base + '/login');
  await page.fill('input[name=p]', 'not-a-real-password');
  await page.click('button');
  await closeBrowser(ctx, cfg.profileDir);

  /* a new browser still has the login, and the sync writes sales, stock and status */
  written.length = 0;
  st = await sync(cfg, db, { now: noon });
  assert.deepEqual(st, { at: noon, ok: true, rows: 3, err: null });
  assert.deepEqual(written.map((w) => w[0]), ['hypesales/2026-11-22', 'hypestock/current', 'hypesync/status']);
  assert.equal(written[0][1].day, '2026-11-22');
  assert.deepEqual(Object.keys(written[0][1].rows[0]), ['t', 'bill', 'item', 'qty', 'price', 'total', 'op', 'cust']);
  assert.deepEqual(written[1][1].rows, [{ item: 'Примерно вино 0.75', qty: 11, unit: 'бр' }]);

  /* nothing changed: only the status is written */
  written.length = 0;
  await sync(cfg, db, { now: noon + 600000 });
  assert.deepEqual(written.map((w) => w[0]), ['hypesync/status']);

  /* just after midnight: yesterday as well */
  written.length = 0;
  await sync(cfg, db, { now: zonedToMs(2026, 11, 23, 0, 20, 0, TZ) });
  assert.deepEqual(written.map((w) => w[0]), ['hypesales/2026-11-23', 'hypesync/status']); /* the 22nd is unchanged */

  /* the other way: pressing the button on the page */
  written.length = 0; hits = 0;
  fs.rmSync(cfg.stateFile);
  st = await sync({ ...cfg, sales: { ...cfg.sales, mode: 'click' } }, db, { now: noon });
  assert.equal(st.ok, true, st.err);
  assert.equal(hits, 1);
  assert.equal(written[0][0], 'hypesales/2026-11-22');
  assert.equal(written[0][1].rows.length, 3);

  /* a wrong address gives an error that is not 'login' */
  st = await sync({ ...cfg, sales: { ...cfg.sales, request: { url: '/nothing' } } }, db, { now: noon });
  assert.equal(st.ok, false);
  assert.match(st.err, /404/);
  console.log('syncing: ok');
} finally {
  server.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
