/* Sends the kitchen's push notifications: a new event (or one a chef sent again with "Notify the team"),
   a new week of The Brigade, and a reminder before a supplier's order deadline. It also reads photos of the
   whiteboard taken in the app (scan.mjs, with the secret ANTHROPIC_API_KEY) and writes their lines on the board. Runs every few minutes from .github/workflows/notify.yml.
   It signs in either with a Firebase service account key (the secret FIREBASE_SERVICE_ACCOUNT: the JSON file from
   Firebase console > Project settings > Service accounts > Generate new private key), or as a kitchen member with
   the full rights (a saved sign-in in the secret KOMAT_NOTIFY_TOKEN). It signs the pushes with the secret VAPID_PRIVATE_KEY,
   the other half of the public key in js/notify.js. It remembers when it last looked in settings/pushstate;
   the very first run only starts the clock, so nothing old is sent.
   Try it without sending anything: DRY=1 node tools/notify/send.mjs */
import fs from 'node:fs';
import crypto from 'node:crypto';
import webpush from 'web-push';
import { createRequire } from 'node:module';

const PUBLIC = 'BC85jaVS08C44ojYHcP6rADTpkau3aynlN3p8qY0J8L8Ydqrx-gPM8JoyHGi-62PAzrMQUeNqEofC71IUUREZiw';
const SITE = 'https://nikovivo-commits.github.io/Komat-recipe-book/';
const DRY = !!process.env.DRY;
const cfg = fs.readFileSync(new URL('../../firebase-config.js', import.meta.url), 'utf8');
const KEY = cfg.match(/apiKey:\s*'([^']+)'/)[1], PROJECT = cfg.match(/projectId:\s*'([^']+)'/)[1];
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.KOMAT_NOTIFY_TOKEN) { console.error('missing secret FIREBASE_SERVICE_ACCOUNT (or KOMAT_NOTIFY_TOKEN)'); process.exit(1); }
if (!DRY && !process.env.VAPID_PRIVATE_KEY) { console.error('missing secret VAPID_PRIVATE_KEY'); process.exit(1); }
/* a pasted secret often carries a line break or spaces */
if (!DRY) webpush.setVapidDetails(SITE, PUBLIC, process.env.VAPID_PRIVATE_KEY.replace(/\s+/g, ''));

/* Firestore REST values <-> plain JSON */
const unval = (v) => 'stringValue' in v ? v.stringValue : 'integerValue' in v ? +v.integerValue : 'doubleValue' in v ? v.doubleValue : 'booleanValue' in v ? v.booleanValue : 'nullValue' in v ? null
  : 'arrayValue' in v ? (v.arrayValue.values || []).map(unval) : 'mapValue' in v ? unfields(v.mapValue.fields || {}) : null;
const unfields = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, unval(v)]));
const val = (v) => v === null || v === undefined ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === 'string' ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(val) } } : { mapValue: { fields: fieldsOf(v) } };
const fieldsOf = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, val(v)]));

let token = '';
async function signIn() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT.trim()), now = Math.floor(Date.now() / 1000);
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
    const jwt = head + '.' + crypto.createSign('RSA-SHA256').update(head).sign(sa.private_key).toString('base64url');
    const t = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + jwt }).then((x) => x.json());
    if (!t.access_token) throw new Error('service account sign-in failed: ' + JSON.stringify(t.error || t));
    token = t.access_token; return;
  }
  const r = await fetch('https://securetoken.googleapis.com/v1/token?key=' + KEY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(process.env.KOMAT_NOTIFY_TOKEN) }).then((x) => x.json());
  if (!r.id_token) throw new Error('sign-in failed: ' + JSON.stringify(r.error || r));
  token = r.id_token;
}
async function call(method, path, body) {
  const r = await fetch(FS + '/' + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (method === 'GET' && r.status === 404) return null;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(method + ' ' + path + ': ' + r.status + ' ' + ((j.error && j.error.message) || ''));
  return j;
}
async function list(coll) {
  const out = []; let page = '';
  do {
    const j = await call('GET', coll + '?pageSize=300' + (page ? '&pageToken=' + encodeURIComponent(page) : ''));
    ((j && j.documents) || []).forEach((d) => out.push({ id: d.name.split('/').pop(), created: Date.parse(d.createTime), data: unfields(d.fields || {}) }));
    page = j && j.nextPageToken;
  } while (page);
  return out;
}

/* the kitchen's calendar: Sofia */
const sofia = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const pretty = (ymd, o) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('en-GB', Object.assign({ timeZone: 'UTC' }, o));
function weekRange(wk) {
  const a = new Date(wk + 'T12:00:00Z'), b = new Date(a.getTime() + 6 * 864e5), m = (d) => d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' });
  return a.getUTCDate() + (m(a) === m(b) ? '' : ' ' + m(a)) + '–' + b.getUTCDate() + ' ' + m(b);
}

await signIn();
const started = Date.now();
const state = await call('GET', 'settings/pushstate');
const prior = state ? unfields(state.fields || {}) : {};
const reminded = prior.reminded && typeof prior.reminded === 'object' ? prior.reminded : {};
let pruned = prior.pruned || '';
const save = () => DRY ? null : call('PATCH', 'settings/pushstate', { fields: {
  since: { integerValue: String(started) },
  pruned: { stringValue: pruned },
  reminded: { mapValue: { fields: Object.fromEntries(Object.entries(reminded).map(([k, v]) => [k, { stringValue: String(v) }])) } },
} });
if (!state) { await save(); console.log('first run: notifications start from now'); process.exit(0); }
const since = +prior.since || started;
const today = sofia(new Date());

/* The database's free tier allows 50,000 reads a day and the job runs every minute, so a quick run only asks
   whether a board photo is waiting (one read). The full round (events, Brigade weeks, order reminders, guests)
   runs every 10 minutes, and old lines are tidied away once a day. */
const FULL = !!process.env.FULL || started - since >= 9.5 * 60000;
async function query(coll, eq) {
  const where = { compositeFilter: { op: 'AND', filters: Object.entries(eq).map(([f, v]) => ({ fieldFilter: { field: { fieldPath: f }, op: 'EQUAL', value: val(v) } })) } };
  const r = await fetch(FS + ':runQuery', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: coll }], where } }) });
  const j = await r.json().catch(() => []);
  if (!r.ok) throw new Error('query ' + coll + ': ' + r.status + ' ' + ((j[0] && j[0].error && j[0].error.message) || (j.error && j.error.message) || ''));
  return j.filter((x) => x.document).map((x) => ({ id: x.document.name.split('/').pop(), created: Date.parse(x.document.createTime), data: unfields(x.document.fields || {}) }));
}
let supData = null;
const getSup = async () => { if (!supData) { const d = await call('GET', 'settings/suppliers'); supData = d ? unfields(d.fields || {}) : {}; } return supData; };
/* what the kitchen taught the board: product -> supplier, from every line someone moved or ordered (boards/wblearn) */
let learned = null;
const getLearned = async () => { if (!learned) { const d = await call('GET', 'boards/wblearn'); learned = d ? (unfields(d.fields || {}).map || {}) : {}; } return learned; };
const lineKey = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
/* the same loose match as the app: жълтък / жълтъци, яйце / яйцата, лук / лукове find each other */
const SWAP = { ц: 'к', ч: 'к', з: 'г', ж: 'г' };
const looseWord = (w) => { let x = w.replace(/[ьъ]/g, '').replace(/й/g, 'и'); if (/^[а-я]+$/.test(x) && x.length > 3) { x = x.replace(/^(.{3,}?)(ове|еве|ите|ата|ята|ото|ете|ът|ят)$/, '$1').replace(/^(.{3,})[аиеяоу]$/, '$1'); const l = x.slice(-1); if (SWAP[l]) x = x.slice(0, -1) + SWAP[l]; } return x; };
const loose = (n) => lineKey(n).replace(/[^a-zа-я0-9% ]/g, ' ').split(/\s+/).filter(Boolean).map(looseWord).join(' ');
/* who sells a product: what the kitchen taught first (the same name, then a looser spelling), then the longest
   product word from a taught name or a supplier's "Sells" list found in the line */
function supWho(n) {
  const sd = supData || {}, lm = learned || {}, k = lineKey(n), ids = new Set((sd.list || []).filter((x) => !x.paused).map((x) => x.id));
  if (lm[k] && ids.has(lm[k])) return lm[k];
  if ((sd.map || {})[k] && ids.has(sd.map[k])) return sd.map[k];
  const lk = ' ' + loose(n) + ' ';
  let best = '', len = 0;
  for (const [name, sup] of Object.entries(lm)) { const ln = loose(name); if (ids.has(sup) && ln.length >= 3 && lk.includes(' ' + ln + ' ') && ln.length >= len) { best = sup; len = ln.length; } }
  (sd.list || []).filter((x) => !x.paused).forEach((x) => String(x.sells || '').split(/[,;\n]/).map(lineKey).filter((w) => w.length >= 3).forEach((w) => { if (k.includes(w) && w.length > len) { best = x.id; len = w.length; } }));
  return best;
}
/* a board section named like a supplier ("Зеленчук" for the vegetable supplier) puts its lines with that supplier */
const supFor = (sec) => { const k = lineKey(sec); if (!k) return ''; const s = ((supData || {}).list || []).find((x) => { const n = lineKey(x.name); return n && (n.includes(k) || k.includes(n)); }); return s ? s.id : ''; };

/* photos of the whiteboard or a paper list, taken in the app: Claude reads each one and its lines go on the board */
const pending = await query('boards', { kind: 'scan', status: 'pending' });
if (pending.length && !process.env.ANTHROPIC_API_KEY) console.log(pending.length + ' board photo(s) waiting: add the secret ANTHROPIC_API_KEY to read them');
if (pending.length && process.env.ANTHROPIC_API_KEY) {
  const { readBoardPhoto } = await import('./scan.mjs');
  await getSup(); await getLearned();
  const open = new Set((await query('boards', { kind: 'item', status: 'need' })).map((d) => lineKey(d.data.n)));
  for (const sc of pending) {
    const d = sc.data;
    try {
      const meta = unfields(((await call('GET', 'blobs/' + d.photo)) || {}).fields || {});
      if (!meta.n) throw new Error('the photo is missing');
      const parts = [];
      for (let i = 0; i < meta.n; i++) { const p = await call('GET', 'blobs/' + d.photo + '/p/' + i); parts.push(Buffer.from(((p || {}).fields || {}).d.bytesValue, 'base64')); }
      const res = await readBoardPhoto(Buffer.concat(parts), meta.type);
      const added = [];
      for (const it of res.items) {
        if (open.has(lineKey(it.name))) continue;
        open.add(lineKey(it.name)); added.push(it.name);
        if (DRY) continue;
        await call('PATCH', 'boards/wb' + crypto.randomBytes(6).toString('hex'), { fields: fieldsOf({
          kind: 'item', n: it.name, qty: it.qty, status: 'need', sup: supWho(it.name) || supFor(it.section), via: 'photo',
          by: d.by || '', ink: d.ink || 'blue', hand: d.hand || 'caveat', st: d.st || '', at: Date.now(),
        }) });
      }
      console.log('board photo ' + sc.id + ': ' + res.items.length + ' lines read, ' + added.length + ' new');
      if (!DRY) await call('PATCH', 'boards/' + sc.id, { fields: fieldsOf(Object.assign({}, d, { status: 'done', added: added.length, names: added, note: res.note, doneAt: Date.now() })) });
    } catch (err) {
      console.error('board photo ' + sc.id + ' failed:', err.message);
      if (!DRY) await call('PATCH', 'boards/' + sc.id, { fields: fieldsOf(Object.assign({}, d, { status: 'failed', error: String(err.message || err).slice(0, 160), doneAt: Date.now() })) });
    }
  }
}
if (!FULL) { console.log('quick run: ' + pending.length + ' photo(s)'); process.exit(0); }

/* guests: someone who joins with the kitchen code and "(гост)" or "(guest)" in their name is made a Viewer
   (reads everything, changes nothing) on the next full round, within 10 minutes */
const members = await list('members');
for (const m of members) {
  if (m.data.role === 'cook' && /\((гост|guest|viewer)\)/i.test(String(m.data.name || ''))) {
    if (!DRY) await call('PATCH', 'members/' + m.id + '?updateMask.fieldPaths=role', { fields: { role: { stringValue: 'viewer' } } });
    console.log('guest ' + m.data.name + ' is now a viewer');
  }
}
/* once a day: lines ordered more than a week ago, sent orders older than two weeks and read photos older than
   three days leave the board, so every phone opening Ordering reads less */
if (pruned !== today) {
  const back = (n) => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const old = [].concat(
    (await query('boards', { kind: 'item', status: 'ordered' })).filter((d) => (d.data.date || '') && d.data.date < back(7)),
    (await query('boards', { kind: 'item', status: 'got' })).filter((d) => !d.data.date || d.data.date < back(7)),
    (await query('boards', { kind: 'sent' })).filter((d) => (d.data.date || '') < back(14)),
    (await query('boards', { kind: 'scan', status: 'done' })).filter((d) => (d.data.at || 0) < started - 3 * 864e5),
    (await query('boards', { kind: 'scan', status: 'failed' })).filter((d) => (d.data.at || 0) < started - 3 * 864e5));
  if (!DRY) for (const d of old) await call('DELETE', 'boards/' + d.id).catch(() => {});
  console.log('tidied ' + old.length + ' old lines off the board');
  pruned = today;
}
const mon = (() => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
const msgs = [];
const weeks = await list('schedules');
for (const w of weeks) {
  if (w.created > since && w.id >= mon) msgs.push({ title: 'The Brigade for ' + weekRange(w.id) + ' is out', body: 'Check your shifts', url: SITE + '#schedule', tag: 'wk-' + w.id });
}
const evList = await list('events');
for (const e of evList) {
  const d = e.data, ann = +d.announce || 0;
  if (d.status === 'cancelled' || !(d.date >= today) || !(e.created > since || ann > since)) continue;
  const fresh = e.created > since && !(ann > e.created + 60000);
  msgs.push({
    title: (fresh ? 'New event: ' : 'Event: ') + (d.title || 'Event'),
    body: [pretty(d.date, { weekday: 'short', day: 'numeric', month: 'short' }), d.guests ? d.guests + ' guests' : '', 'check it out'].filter(Boolean).join(' · '),
    url: SITE + '#events', tag: 'ev-' + e.id,
  });
}
/* The Brigade locks itself. At 23:00 on Saturday the chefs get a heads-up that next week goes out at midnight
   (and how many holes it still has); from midnight, a week nobody saved is drafted exactly as the generator
   shows it in the app (js/rotagen.js, the same code and the same inputs) and saved. The usual "The Brigade is
   out" notification then goes to everyone on the next round. A week a chef saved by hand is never touched. */
{
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Sofia', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday), mins = +parts.hour * 60 + +parts.minute;
  const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const nextMon = addDays(mon, 7);
  const due = wd === 6 ? nextMon : mon; /* on Sunday the coming week, otherwise this week if it was never saved */
  const remind = wd === 5 && mins >= 23 * 60 && reminded.brigade !== nextMon;
  const saved = new Set(weeks.map((w) => w.id));
  const target = remind ? nextMon : due;
  if ((remind || !saved.has(due)) && !saved.has(target)) {
    const rotaGen = createRequire(import.meta.url)('../../js/rotagen.js');
    const rp = (await call('GET', 'settings/rotaplan')), staffDoc = await call('GET', 'settings/staff');
    const plan = rp ? unfields(rp.fields || {}) : {};
    const ones = () => [1, 1, 1, 1, 1, 1, 1];
    plan.people = plan.people || {};
    plan.needs = plan.needs || { hot: ones(), cold: ones(), pass: ones() };
    ['hot', 'cold', 'pass'].forEach((s) => { if (!Array.isArray(plan.needs[s])) plan.needs[s] = ones(); });
    if (!Array.isArray(plan.busy)) plan.busy = [4, 5];
    if (!Array.isArray(plan.brDays)) plan.brDays = [5, 6];
    plan.brCode = plan.brCode || 'BR+P';
    const ready = Object.keys(plan.people).some((id) => (plan.people[id] || {}).mode === 'auto');
    if (ready) {
      const pins = ((plan.pins || {})[target] || []).slice(); delete plan.pins;
      const people = ((staffDoc ? unfields(staffDoc.fields || {}) : {}).people || []).map((p) => ({ id: p.id, name: p.name }));
      const end = addDays(target, 6), after = addDays(target, 7);
      const events = evList.map((e) => e.data).filter((e) => e.status !== 'cancelled' && e.status !== 'pending' && e.date >= target && e.date <= after && (+e.cooks > 0 || +e.before > 0))
        .map((e) => ({ date: e.date, cooks: e.date <= end ? +e.cooks || 0 : 0, when: e.when || '', before: +e.before || 0, title: e.title || 'Event' }));
      const requests = (await list('dayoff')).map((d) => d.data).filter((r) => r.date >= target && r.date <= end).map((r) => ({ person: r.person, date: r.date, kind: r.kind, status: r.status }));
      const input = { week: target, plan, people, requests: [], keep: {}, events, pins };
      const base = rotaGen(input);
      const r = requests.length ? rotaGen(Object.assign({}, input, { requests, prev: { rows: base.rows, st: base.st } })) : base;
      const holes = r.issues.filter((x) => x.sev === 'red').length;
      if (remind) {
        reminded.brigade = nextMon;
        msgs.push({ chefsOnly: true, title: 'The Brigade for ' + weekRange(nextMon) + ' goes out at midnight', body: holes ? holes + (holes === 1 ? ' hole' : ' holes') + ' still to fill in the generator' : 'The draft is complete: check it once more', url: SITE + '#schedule', tag: 'wk-lock-' + nextMon });
        console.log('brigade: reminder for ' + nextMon + ', ' + holes + ' holes');
      } else {
        const body = { week: target, people: r.order.slice(), rows: r.rows, st: r.st, note: '', updated: Date.now(), made: 'auto' };
        if (!DRY) await call('PATCH', 'schedules/' + target, { fields: fieldsOf(body) });
        console.log('brigade: saved ' + target + ' from the draft, ' + holes + ' holes');
        if (holes) msgs.push({ chefsOnly: true, title: 'The Brigade for ' + weekRange(target) + ' is out with ' + holes + (holes === 1 ? ' hole' : ' holes'), body: 'Fill them on The Brigade', url: SITE + '#schedule', tag: 'wk-holes-' + target });
      }
    }
  }
}
/* the whiteboard: an hour before a supplier's order deadline, on its order days, remind the chefs of what is still on it */
await getSup();
const sd = supData, supList = Array.isArray(sd.list) ? sd.list : [];
if (supList.length) {
  await getLearned();
  const open = await query('boards', { kind: 'item', status: 'need' });
  const now = new Date(), parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Sofia', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]));
  const dayIdx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday), mins = +parts.hour * 60 + +parts.minute;
  for (const s of supList) {
    if (!s || !s.deadline || !(s.days || []).includes(dayIdx) || reminded[s.id] === today) continue;
    const [hh, mm] = String(s.deadline).split(':').map(Number), dl = (hh * 60 + (mm || 0)) || 1440; /* 00:00 means midnight */
    if (mins < dl - 60 || mins >= dl) continue;
    const mine = open.filter((i) => (i.data.sup || supWho(i.data.n)) === s.id);
    if (!mine.length) continue;
    reminded[s.id] = today;
    msgs.push({ admins: true, title: s.name + ': order by ' + (s.deadline === '00:00' ? 'midnight' : s.deadline), body: mine.length + ' in Ordering: ' + mine.slice(0, 5).map((i) => i.data.n).join(', ') + (mine.length > 5 ? '…' : ''), url: SITE + '#orders', tag: 'sup-' + s.id });
  }
}
if (!msgs.length) { await save(); console.log('nothing new'); process.exit(0); }

/* who has the full rights: reminders to order go to them only */
/* reminders to order go to the people chosen to order (Suppliers > Who can order), else to the chefs */
const chefs = new Set();
/* the Brigade's notices go to the chefs with the full rights (sous chef, head chef) and the owner */
const heads = new Set();
if (msgs.some((m) => m.chefsOnly)) {
  for (const m of members) if (['sous', 'admin', 'dev'].includes(m.data.role)) heads.add(m.id);
  const own = await call('GET', 'private/owner'); if (own) heads.add(unfields(own.fields || {}).uid);
}
if (msgs.some((m) => m.admins)) {
  const who = Array.isArray(supData.orderers) ? supData.orderers : [];
  if (who.length) {
    const staffDoc = await call('GET', 'settings/staff');
    const people = staffDoc ? (unfields(staffDoc.fields || {}).people || []) : [];
    const norm = (x) => String(x || '').trim().toLowerCase();
    const names = people.filter((p) => who.includes(p.id)).map((p) => norm(p.name));
    for (const m of members) { const n = norm(m.data.name); if (n && names.some((x) => x === n || x.split(' ')[0] === n.split(' ')[0])) chefs.add(m.id); }
  } else {
    for (const m of members) if (['sous', 'admin', 'dev'].includes(m.data.role)) chefs.add(m.id);
    const own = await call('GET', 'private/owner'); if (own) chefs.add(unfields(own.fields || {}).uid);
  }
}
const subs = await list('pushsubs');
console.log(msgs.length + ' to send to ' + subs.length + ' phones:', msgs.map((m) => m.title).join(' | '));
let sent = 0, gone = 0, failed = 0;
for (const s of subs) {
  for (const m of msgs) {
    if (m.admins && !chefs.has(s.id)) continue;
    if (m.chefsOnly && !heads.has(s.id)) continue;
    if (DRY) continue;
    try { await webpush.sendNotification({ endpoint: s.data.endpoint, keys: s.data.keys }, JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.tag }), { TTL: 86400, urgency: 'normal' }); sent++; } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) { gone++; await call('DELETE', 'pushsubs/' + s.id).catch(() => {}); break; }
      failed++; console.error('push failed', err.statusCode || '', (err.body || err.message || '').slice(0, 200));
    }
  }
}
await save();
console.log(`sent ${sent}, removed ${gone} phones that stopped working, ${failed} failed`);
