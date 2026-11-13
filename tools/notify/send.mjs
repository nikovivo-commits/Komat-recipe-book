/* Sends the kitchen's push notifications: a new event (or one a chef sent again with "Notify the team") and
   a new week of The Brigade. Runs every few minutes from .github/workflows/notify.yml.
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
const save = () => DRY ? null : call('PATCH', 'settings/pushstate', { fields: { since: { integerValue: String(started) } } });
if (!state) { await save(); console.log('first run: notifications start from now'); process.exit(0); }
const since = +unfields(state.fields || {}).since || started;

const today = sofia(new Date());
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
if (!msgs.length) { await save(); console.log('nothing new'); process.exit(0); }

const subs = await list('pushsubs');
console.log(msgs.length + ' to send to ' + subs.length + ' phones:', msgs.map((m) => m.title).join(' | '));
let sent = 0, gone = 0, failed = 0;
for (const s of subs) {
  for (const m of msgs) {
    if (DRY) continue;
    try { await webpush.sendNotification({ endpoint: s.data.endpoint, keys: s.data.keys }, JSON.stringify(m), { TTL: 86400, urgency: 'normal' }); sent++; } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) { gone++; await call('DELETE', 'pushsubs/' + s.id).catch(() => {}); break; }
      failed++; console.error('push failed', err.statusCode || '', (err.body || err.message || '').slice(0, 200));
    }
  }
}
await save();
console.log(`sent ${sent}, removed ${gone} phones that stopped working, ${failed} failed`);
