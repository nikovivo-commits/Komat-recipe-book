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
const save = () => DRY ? null : call('PATCH', 'settings/pushstate', { fields: {
  since: { integerValue: String(started) },
  reminded: { mapValue: { fields: Object.fromEntries(Object.entries(reminded).map(([k, v]) => [k, { stringValue: String(v) }])) } },
} });
if (!state) { await save(); console.log('first run: notifications start from now'); process.exit(0); }
const since = +prior.since || started;

const today = sofia(new Date());

/* photos of the whiteboard or a paper list, taken in the app: Claude reads each one and its lines go on the board */
const boards = await list('boards');
const supDoc = await call('GET', 'settings/suppliers');
const supData = supDoc ? unfields(supDoc.fields || {}) : {};
const lineKey = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
/* a board section named like a supplier ("Зеленчук" for the vegetable supplier) puts its lines with that supplier */
const supFor = (sec) => { const k = lineKey(sec); if (!k) return ''; const s = (supData.list || []).find((x) => { const n = lineKey(x.name); return n && (n.includes(k) || k.includes(n)); }); return s ? s.id : ''; };
const pending = boards.filter((d) => d.data.kind === 'scan' && d.data.status === 'pending');
if (pending.length && !process.env.ANTHROPIC_API_KEY) console.log(pending.length + ' board photo(s) waiting: add the secret ANTHROPIC_API_KEY to read them');
if (pending.length && process.env.ANTHROPIC_API_KEY) {
  const { readBoardPhoto } = await import('./scan.mjs');
  const open = new Set(boards.filter((d) => d.data.kind === 'item' && d.data.status === 'need').map((d) => lineKey(d.data.n)));
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
          kind: 'item', n: it.name, qty: it.qty, status: 'need', sup: (supData.map || {})[lineKey(it.name)] || supFor(it.section), via: 'photo',
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
const mon = (() => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
const msgs = [];
for (const w of await list('schedules')) {
  if (w.created > since && w.id >= mon) msgs.push({ title: 'The Brigade for ' + weekRange(w.id) + ' is out', body: 'Check your shifts', url: SITE + '#schedule', tag: 'wk-' + w.id });
}
for (const e of await list('events')) {
  const d = e.data, ann = +d.announce || 0;
  if (d.status === 'cancelled' || !(d.date >= today) || !(e.created > since || ann > since)) continue;
  const fresh = e.created > since && !(ann > e.created + 60000);
  msgs.push({
    title: (fresh ? 'New event: ' : 'Event: ') + (d.title || 'Event'),
    body: [pretty(d.date, { weekday: 'short', day: 'numeric', month: 'short' }), d.guests ? d.guests + ' guests' : '', 'check it out'].filter(Boolean).join(' · '),
    url: SITE + '#events', tag: 'ev-' + e.id,
  });
}
/* the whiteboard: an hour before a supplier's order deadline, on its order days, remind the chefs of what is still on it */
const sd = supData, supList = Array.isArray(sd.list) ? sd.list : [], supMap = sd.map || {};
if (supList.length) {
  const key = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const open = (await list('boards')).filter((d) => d.data.kind === 'item' && d.data.status === 'need'); /* fresh: includes lines just read from photos */
  const now = new Date(), parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Sofia', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]));
  const dayIdx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday), mins = +parts.hour * 60 + +parts.minute;
  for (const s of supList) {
    if (!s || !s.deadline || !(s.days || []).includes(dayIdx) || reminded[s.id] === today) continue;
    const [hh, mm] = String(s.deadline).split(':').map(Number), dl = hh * 60 + (mm || 0);
    if (mins < dl - 60 || mins >= dl) continue;
    const mine = open.filter((i) => (i.data.sup || supMap[key(i.data.n)]) === s.id);
    if (!mine.length) continue;
    reminded[s.id] = today;
    msgs.push({ admins: true, title: s.name + ': order by ' + s.deadline, body: mine.length + ' on the whiteboard: ' + mine.slice(0, 5).map((i) => i.data.n).join(', ') + (mine.length > 5 ? '…' : ''), url: SITE + '#orders', tag: 'sup-' + s.id });
  }
}
if (!msgs.length) { await save(); console.log('nothing new'); process.exit(0); }

/* who has the full rights: reminders to order go to them only */
const chefs = new Set();
if (msgs.some((m) => m.admins)) {
  for (const m of await list('members')) if (['sous', 'admin', 'dev'].includes(m.data.role)) chefs.add(m.id);
  const own = await call('GET', 'private/owner'); if (own) chefs.add(unfields(own.fields || {}).uid);
}
const subs = await list('pushsubs');
console.log(msgs.length + ' to send to ' + subs.length + ' phones:', msgs.map((m) => m.title).join(' | '));
let sent = 0, gone = 0, failed = 0;
for (const s of subs) {
  for (const m of msgs) {
    if (m.admins && !chefs.has(s.id)) continue;
    if (DRY) continue;
    try { await webpush.sendNotification({ endpoint: s.data.endpoint, keys: s.data.keys }, JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.tag }), { TTL: 86400, urgency: 'normal' }); sent++; } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) { gone++; await call('DELETE', 'pushsubs/' + s.id).catch(() => {}); break; }
      failed++; console.error('push failed', err.statusCode || '', (err.body || err.message || '').slice(0, 200));
    }
  }
}
await save();
console.log(`sent ${sent}, removed ${gone} phones that stopped working, ${failed} failed`);
