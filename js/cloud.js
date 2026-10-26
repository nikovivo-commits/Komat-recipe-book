/* The kitchen's own shared database (Google Firebase), used by the stand-alone site once
   firebase-config.js holds the project's settings. Without them the site keeps everything on
   the device, as before.
   - Cooks join with their name and the kitchen code; the head chef signs in with email.
   - Records live in Firestore and a copy stays on the phone, so the book opens and ticks save
     without Wi-Fi, then catch up.
   - Photos and videos are kept in the database in pieces, so there is no file storage to set up.
   It offers the same small database API as the Claude version and the device copy (store.js). */
(function () {
  'use strict';
  const K = window.K, F = window.FB, cfg = window.KOMAT_FIREBASE;
  if (!F || !cfg || !cfg.apiKey || !cfg.projectId) return;

  const app = F.initializeApp(cfg);
  const auth = F.initializeAuth(app, { persistence: [F.indexedDBLocalPersistence, F.browserLocalPersistence] });
  let fs;
  try { fs = F.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch (e) { fs = F.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: F.memoryLocalCache() }); }
  if (cfg.emulators) {
    F.connectAuthEmulator(auth, cfg.emulators.auth, { disableWarnings: true });
    const hp = cfg.emulators.firestore.split(':');
    F.connectFirestoreEmulator(fs, hp[0], +hp[1]);
  }

  /* errors in the words the rest of the app already uses (see writeFailed in data.js) */
  const CODES = { 'permission-denied': 'invalid_argument', 'not-found': 'invalid_argument', 'resource-exhausted': 'quota_exceeded' };
  const err = (e) => ({ code: CODES[e && e.code] || (e && e.code) || 'unknown', message: (e && e.message) || '', fb: e && e.code });

  /* A write resolves when the server has it. With no connection it is queued on the phone and
     sent later, so after a few seconds the app carries on; a late refusal still shows a message. */
  function write(p) {
    return new Promise((res, rej) => {
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; res(); } }, navigator.onLine === false ? 0 : 4000);
      p.then(() => { if (!done) { done = true; clearTimeout(t); res(); } }, (e) => {
        const x = err(e);
        if (!done) { done = true; clearTimeout(t); rej(x); } else K.writeFailed(x);
      });
    });
  }

  /* ---------- database ---------- */
  const dsnap = (s) => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: s.metadata });
  const qsnap = (q) => { const docs = q.docs.map(dsnap); return { docs: docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: q.metadata }; };
  const plain = (v) => !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
  /* update() merges nested objects like the other stores do: {marks: {a: {...}}} changes marks.a only */
  function fields(o, pre, out) {
    Object.keys(o).forEach((k) => {
      const v = o[k], p = pre.concat(k);
      if (plain(v)) { if (Object.keys(v).length) fields(v, p, out); }
      else if (v !== undefined) out.push(new F.FieldPath(...p), v);
    });
    return out;
  }
  function docRef(path) {
    const r = F.doc(fs, path);
    return {
      id: r.id, path: path,
      get: () => F.getDoc(r).then(dsnap, (e) => Promise.reject(err(e))),
      set: (d) => write(F.setDoc(r, d)),
      update: (d) => { const a = fields(d, [], []); return a.length ? write(F.updateDoc(r, ...a)) : Promise.resolve(); },
      delete: () => write(F.deleteDoc(r)),
      onSnapshot: (next, bad) => F.onSnapshot(r, (s) => next(dsnap(s)), (e) => { if (bad) bad(err(e)); }),
      collection: (sub) => collRef(path + '/' + sub),
    };
  }
  function collRef(path) {
    const base = F.collection(fs, path);
    function query(cs) {
      const q = () => (cs.length ? F.query(base, ...cs) : base);
      return {
        where: (f, op, v) => query(cs.concat(F.where(f, op, v))),
        orderBy: (f, dir) => query(cs.concat(F.orderBy(f, dir || 'asc'))),
        limit: (n) => query(cs.concat(F.limit(n))),
        get: () => F.getDocs(q()).then(qsnap, (e) => Promise.reject(err(e))),
        onSnapshot: (next, bad) => F.onSnapshot(q(), (s) => next(qsnap(s)), (e) => { if (bad) bad(err(e)); }),
      };
    }
    return Object.assign(query([]), {
      path: path,
      doc: (id) => docRef(path + '/' + (id || K.uid())),
      add: (d) => { const ref = docRef(path + '/' + K.uid()); return ref.set(d).then(() => ref); },
    });
  }
  /* the collections a backup holds (people, the kitchen code and photos stay out) */
  const BOOK = ['recipes', 'settings', 'schedules', 'events', 'checks', 'prep', 'orders', 'boards', 'bugs'];
  async function commitAll(ops) {
    for (let i = 0; i < ops.length; i += 300) {
      const b = F.writeBatch(fs);
      ops.slice(i, i + 300).forEach((o) => { const r = F.doc(fs, o[0]); if (o[1] === undefined) b.delete(r); else b.set(r, o[1]); });
      await b.commit().catch((e) => Promise.reject(err(e)));
    }
  }
  const db = {
    doc: docRef,
    collection: collRef,
    exportAll() {
      return Promise.all(BOOK.map((c) => F.getDocs(F.collection(fs, c)).then((s) => s.docs.map((x) => [c + '/' + x.id, x.data()]))))
        .then((lists) => { const o = {}; lists.forEach((l) => l.forEach((p) => { o[p[0]] = p[1]; })); return o; }, (e) => Promise.reject(err(e)));
    },
    /* replace the whole book with `docs`; with {keep: true} only add and overwrite */
    async importAll(docs, opts) {
      const ops = Object.keys(docs || {}).filter((p) => BOOK.includes(p.split('/')[0]) && p.split('/').length === 2).map((p) => [p, docs[p]]);
      if (!(opts && opts.keep)) {
        const have = await this.exportAll();
        Object.keys(have).forEach((p) => { if (!(p in docs)) ops.push([p, undefined]); });
      }
      await commitAll(ops);
    },
  };

  /* ---------- photos and videos ---------- */
  const PART = 900 * 1024;
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  /* a copy of every photo already seen stays on the phone, so pages open fast and offline */
  const cache = {
    idb: null,
    open() {
      if (this.idb) return Promise.resolve(this.idb);
      return new Promise((res, rej) => {
        let r;
        try { r = indexedDB.open('komat-photos', 1); } catch (e) { rej(e); return; }
        r.onupgradeneeded = () => r.result.createObjectStore('blobs');
        r.onsuccess = () => { this.idb = r.result; res(this.idb); };
        r.onerror = () => rej(r.error);
      });
    },
    tx(mode, fn) {
      return this.open().then((idb) => new Promise((res) => {
        const t = idb.transaction('blobs', mode), out = fn(t.objectStore('blobs'));
        t.oncomplete = () => res(out && out.result);
        t.onerror = () => res(undefined);
      })).catch(() => undefined);
    },
    get(id) { return this.tx('readonly', (s) => s.get(id)); },
    put(id, blob) { return this.tx('readwrite', (s) => s.put(blob, id)); },
    del(id) { return this.tx('readwrite', (s) => s.delete(id)); },
  };
  const assets = {
    urls: {}, loading: {}, missing: {},
    init() { return Promise.resolve(); },
    /* where to show a photo from; the first time it is fetched, then the page redraws */
    url(id) {
      if (this.urls[id]) return this.urls[id];
      if (this.missing[id]) return 'assets/photos/' + id + '.jpg';
      if (!this.loading[id]) this.load(id);
      return BLANK;
    },
    async load(id) {
      this.loading[id] = true;
      try {
        let blob = await cache.get(id);
        if (!blob) {
          const meta = await F.getDoc(F.doc(fs, 'blobs/' + id));
          if (!meta.exists()) { this.missing[id] = true; K.refresh(); return; }
          const parts = await F.getDocs(F.collection(fs, 'blobs/' + id + '/p'));
          const bytes = parts.docs.map((x) => [+x.id, x.data().d.toUint8Array()]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
          blob = new Blob(bytes, { type: meta.data().type || 'image/jpeg' });
          cache.put(id, blob);
        }
        this.urls[id] = URL.createObjectURL(blob);
        K.refresh();
      } catch (e) { /* offline and never seen: try again on the next redraw */ }
      finally { delete this.loading[id]; }
    },
    async put(id, blob) {
      const buf = new Uint8Array(await blob.arrayBuffer()), n = Math.max(1, Math.ceil(buf.length / PART));
      for (let i = 0; i < n; i++) await write(F.setDoc(F.doc(fs, 'blobs/' + id + '/p/' + i), { d: F.Bytes.fromUint8Array(buf.subarray(i * PART, (i + 1) * PART)) }));
      await write(F.setDoc(F.doc(fs, 'blobs/' + id), { type: blob.type || 'application/octet-stream', size: buf.length, n: n, at: Date.now(), by: K.me.id || '' }));
      cache.put(id, blob);
      delete this.missing[id];
      if (this.urls[id]) URL.revokeObjectURL(this.urls[id]);
      this.urls[id] = URL.createObjectURL(blob);
      return this.urls[id];
    },
    upload(blob) {
      if (blob.size > 20 * 1024 * 1024) return Promise.reject({ code: 'too_large' });
      const id = 'f' + K.uid();
      return this.put(id, blob).then((url) => ({ id: id, url: url, sizeBytes: blob.size, contentType: blob.type }), (e) => Promise.reject(e && e.code ? e : err(e)));
    },
    async delete(id) {
      if (/[/:]/.test(id)) return { deleted: false };
      const meta = await F.getDoc(F.doc(fs, 'blobs/' + id)).catch(() => null);
      if (!meta || !meta.exists()) return { deleted: false };
      const n = meta.data().n || 1;
      for (let i = 0; i < n; i++) await write(F.deleteDoc(F.doc(fs, 'blobs/' + id + '/p/' + i)));
      await write(F.deleteDoc(F.doc(fs, 'blobs/' + id)));
      cache.del(id);
      if (this.urls[id]) URL.revokeObjectURL(this.urls[id]);
      delete this.urls[id];
      return { deleted: true };
    },
  };

  /* ---------- people and sign-in ---------- */
  const D = K.D;
  D.members = {};
  const S = {
    db: db, assets: assets, auth: auth,
    ownerUid: '', busy: false, ready: false, uid: '',
  };
  let meUnsub = null;
  function enter() {
    if (S.ready) return;
    S.ready = true;
    F.getDoc(F.doc(fs, 'private/owner')).then((s) => { S.ownerUid = s.exists() ? s.data().uid : ''; K.refresh(); }, () => {});
    F.onSnapshot(F.collection(fs, 'members'), (s) => {
      const m = {};
      s.docs.forEach((x) => { const d = x.data(); m[x.id] = { name: d.name || '', role: d.role || 'cook', at: d.at || 0 }; });
      D.members = m;
      D.names = {};
      K.refresh();
    }, () => {});
    K.user = { profiles: (ids) => Promise.resolve(ids.reduce((o, id) => { if (D.members[id]) o[id] = { name: D.members[id].name }; return o; }, {})) };
    K.subscribe();
  }
  function watch(u) {
    if (meUnsub) meUnsub();
    /* only the server's word counts: a join waits until the kitchen code is accepted */
    meUnsub = F.onSnapshot(F.doc(fs, 'members/' + u.uid), { includeMetadataChanges: true }, (s) => {
      if (s.metadata.hasPendingWrites) return;
      if (s.exists()) {
        const m = s.data();
        K.me = { id: u.uid, admin: m.role === 'admin', canWrite: true, name: m.name || '', email: u.email || '', guest: !!u.isAnonymous };
        K.ui.auth = null;
        enter();
        K.subscribeBugs();
        K.refresh(true);
      } else if (s.metadata.fromCache) return;
      else if (S.ready) { K.ui.auth = 'removed'; K.refresh(true); }
      else if (!S.busy) { K.ui.auth = u.isAnonymous ? 'join' : 'nokitchen'; K.refresh(true); }
    }, () => { if (!S.ready && !S.busy) { K.ui.auth = 'join'; K.refresh(true); } });
  }
  S.start = function () {
    F.onAuthStateChanged(auth, (u) => {
      /* someone else signed in on this phone: start clean */
      if (S.ready && (!u || u.uid !== S.uid)) { location.reload(); return; }
      S.uid = u ? u.uid : '';
      if (u) watch(u);
      else if (!S.busy) { K.ui.auth = K.ui.authWant || 'join'; K.refresh(true); }
    });
  };
  const fail = (code) => Object.assign(new Error(code), { code: code });
  /* a cook joins with their name and the kitchen code */
  S.join = async function (name, code) {
    S.busy = true;
    try {
      const u = auth.currentUser || (await F.signInAnonymously(auth)).user;
      await F.setDoc(F.doc(fs, 'members/' + u.uid), { name: name, role: 'cook', code: code, at: Date.now() })
        .catch((e) => Promise.reject(e && e.code === 'permission-denied' ? fail('bad_code') : e));
    } finally { S.busy = false; }
  };
  S.signIn = function (email, pw) { return F.signInWithEmailAndPassword(auth, email, pw); };
  S.resetPassword = function (email) { return F.sendPasswordResetEmail(auth, email); };
  /* first time only: the head chef's account becomes the owner and sets the kitchen code */
  S.setup = async function (name, email, pw, code) {
    S.busy = true;
    try {
      let u;
      try { u = (await F.createUserWithEmailAndPassword(auth, email, pw)).user; }
      catch (e) { if (e && e.code === 'auth/email-already-in-use') u = (await F.signInWithEmailAndPassword(auth, email, pw)).user; else throw e; }
      const own = await F.getDoc(F.doc(fs, 'private/owner'));
      if (own.exists() && own.data().uid !== u.uid) throw fail('taken');
      if (!own.exists()) await F.setDoc(F.doc(fs, 'private/owner'), { uid: u.uid, at: Date.now() });
      const me = await F.getDoc(F.doc(fs, 'members/' + u.uid));
      if (!me.exists()) await F.setDoc(F.doc(fs, 'members/' + u.uid), { name: name, role: 'admin', at: Date.now() });
      await F.setDoc(F.doc(fs, 'private/join'), { code: code, at: Date.now() });
    } finally { S.busy = false; }
  };
  /* a cook's phone sign-in can't be used again, so leaving also takes them off the people list */
  S.signOut = async function () {
    const u = auth.currentUser;
    if (u && u.isAnonymous) await F.deleteDoc(F.doc(fs, 'members/' + u.uid)).catch(() => {});
    await F.signOut(auth).catch(() => {});
    try { await F.terminate(fs); await F.clearIndexedDbPersistence(fs); } catch (e) { /* other tabs still open */ }
    location.reload();
  };
  S.getCode = () => F.getDoc(F.doc(fs, 'private/join')).then((s) => (s.exists() ? s.data().code : ''), (e) => Promise.reject(err(e)));
  S.setCode = (code) => write(F.setDoc(F.doc(fs, 'private/join'), { code: code, at: Date.now() }));
  S.setRole = (uid, role) => write(F.updateDoc(F.doc(fs, 'members/' + uid), { role: role }));
  S.rename = (name) => write(F.updateDoc(F.doc(fs, 'members/' + K.me.id), { name: name }));
  S.remove = (uid) => write(F.deleteDoc(F.doc(fs, 'members/' + uid)));
  /* friendly words for sign-in problems */
  S.authErr = function (e) {
    const c = (e && e.code) || '';
    if (c === 'bad_code') return 'That kitchen code is not right. Check it with the head chef.';
    if (c === 'taken') return 'This kitchen already has a head chef. Sign in, or ask them to make you head chef.';
    if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'Email or password is not right.';
    if (/invalid-email/.test(c)) return 'That email address does not look right.';
    if (/weak-password/.test(c)) return 'Use a password of at least 6 characters.';
    if (/too-many-requests/.test(c)) return 'Too many tries. Wait a few minutes and try again.';
    if (/network|unavailable/.test(c)) return 'No connection. Check the Wi-Fi and try again.';
    if (/operation-not-allowed|admin-restricted/.test(c)) return 'This sign-in is switched off in the Firebase project. See the setup steps.';
    return 'That did not work. Try again.';
  };
  K.Fire = S;
})();
