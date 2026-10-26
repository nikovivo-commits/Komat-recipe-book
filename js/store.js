/* Storage: one API for both ways the book runs.
   - Shared: inside Claude, the artifact's live database (everyone sees changes at once).
   - This device: the stand-alone site keeps a local copy in the browser (localStorage for
     records, IndexedDB for photos). It mimics the parts of the database API the app uses. */
(function () {
  'use strict';
  const K = window.K;

  /* ---------- local database ---------- */
  const DB_KEY = 'komat.db.v1';
  function parentOf(path) { const i = path.lastIndexOf('/'); return i < 0 ? '' : path.slice(0, i); }
  function snap(path, data) {
    const id = path.slice(path.lastIndexOf('/') + 1);
    return { id: id, exists: data !== undefined, data: () => (data === undefined ? undefined : K.clone(data)), metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function merge(into, patch) {
    for (const k of Object.keys(patch)) {
      const v = patch[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && into[k] && typeof into[k] === 'object' && !Array.isArray(into[k])) merge(into[k], v);
      else into[k] = K.clone(v);
    }
    return into;
  }
  function test(doc, w) {
    const v = doc[w[0]], x = w[2];
    switch (w[1]) {
      case '==': return v === x;
      case '!=': return v !== x;
      case '<': return v < x;
      case '<=': return v <= x;
      case '>': return v > x;
      case '>=': return v >= x;
      case 'in': return Array.isArray(x) && x.includes(v);
      case 'not-in': return Array.isArray(x) && !x.includes(v);
      case 'array-contains': return Array.isArray(v) && v.includes(x);
      default: return false;
    }
  }
  const err = (code, message) => ({ code: code, message: message || code });

  function LocalDB(seed) {
    this.subs = new Set();
    this.docs = this.load();
    if (!this.docs) { this.docs = {}; if (seed) seed(this.docs); this.save(); }
    window.addEventListener('storage', (e) => {
      if (e.key !== DB_KEY) return;
      this.docs = this.load() || {};
      this.subs.forEach((s) => this.deliver(s));
    });
  }
  LocalDB.prototype.load = function () {
    try { const raw = localStorage.getItem(DB_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  };
  LocalDB.prototype.save = function () {
    try { localStorage.setItem(DB_KEY, JSON.stringify(this.docs)); this.full = false; }
    catch (e) { if (!this.full) { this.full = true; K.toast('This device is out of storage space. Export a backup in Settings, then clear old photos.', { tone: 'bad' }); } }
  };
  LocalDB.prototype.write = function (path, data) {
    if (data === undefined) delete this.docs[path]; else this.docs[path] = K.clone(data);
    this.save();
    const coll = parentOf(path);
    this.subs.forEach((s) => { if (s.path === path || s.coll === coll) this.deliver(s); });
    return Promise.resolve();
  };
  LocalDB.prototype.deliver = function (s) {
    setTimeout(() => {
      if (!this.subs.has(s)) return;
      if (s.path) s.next(snap(s.path, this.docs[s.path]));
      else s.next(this.run(s.q));
    }, 0);
  };
  LocalDB.prototype.run = function (q) {
    let docs = Object.keys(this.docs).filter((p) => parentOf(p) === q.coll).map((p) => ({ p: p, d: this.docs[p] }));
    docs = docs.filter((x) => q.where.every((w) => test(x.d, w)));
    if (q.order) {
      const f = q.order[0], dir = q.order[1] === 'desc' ? -1 : 1;
      docs.sort((a, b) => (a.d[f] === b.d[f] ? 0 : a.d[f] === undefined ? 1 : b.d[f] === undefined ? -1 : a.d[f] < b.d[f] ? -dir : dir));
    } else docs.sort((a, b) => (a.p < b.p ? -1 : 1));
    if (q.limit) docs = docs.slice(0, q.limit);
    const list = docs.map((x) => snap(x.p, x.d));
    return { docs: list, size: list.length, empty: !list.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
  };
  LocalDB.prototype.doc = function (path) {
    const db = this;
    const ref = {
      id: path.slice(path.lastIndexOf('/') + 1), path: path,
      get: () => Promise.resolve(snap(path, db.docs[path])),
      set: (d) => db.write(path, d),
      update: (d) => (db.docs[path] ? db.write(path, merge(K.clone(db.docs[path]), d)) : Promise.reject(err('invalid_argument', 'Document does not exist'))),
      delete: () => db.write(path, undefined),
      onSnapshot: (next) => { const s = { path: path, next: next }; db.subs.add(s); db.deliver(s); return () => db.subs.delete(s); },
      collection: (sub) => db.collection(path + '/' + sub),
    };
    return ref;
  };
  LocalDB.prototype.collection = function (coll) {
    const db = this;
    function query(q) {
      return {
        where: (f, op, v) => query(Object.assign({}, q, { where: q.where.concat([[f, op, v]]) })),
        orderBy: (f, dir) => query(Object.assign({}, q, { order: [f, dir] })),
        limit: (n) => query(Object.assign({}, q, { limit: n })),
        get: () => Promise.resolve(db.run(q)),
        onSnapshot: (next) => { const s = { coll: coll, q: q, next: next }; db.subs.add(s); db.deliver(s); return () => db.subs.delete(s); },
      };
    }
    return Object.assign(query({ coll: coll, where: [] }), {
      path: coll,
      doc: (id) => db.doc(coll + '/' + (id || K.uid())),
      add: (d) => { const ref = db.doc(coll + '/' + K.uid()); return ref.set(d).then(() => ref); },
    });
  };
  LocalDB.prototype.exportAll = function () { return K.clone(this.docs); };
  LocalDB.prototype.importAll = function (docs) {
    this.docs = K.clone(docs || {});
    this.save();
    this.subs.forEach((s) => this.deliver(s));
  };
  K.LocalDB = LocalDB;

  /* ---------- local photo store (IndexedDB) ---------- */
  const LocalAssets = {
    urls: {},
    idb: null,
    open() {
      if (this.idb) return Promise.resolve(this.idb);
      return new Promise((res, rej) => {
        let r;
        try { r = indexedDB.open('komat-assets', 1); } catch (e) { rej(err('not_granted')); return; }
        r.onupgradeneeded = () => r.result.createObjectStore('blobs');
        r.onsuccess = () => { this.idb = r.result; res(this.idb); };
        r.onerror = () => rej(err('not_granted'));
      });
    },
    init() {
      return this.open().then((idb) => new Promise((res) => {
        const tx = idb.transaction('blobs', 'readonly'), st = tx.objectStore('blobs'), req = st.openCursor();
        req.onsuccess = () => {
          const c = req.result;
          if (c) { this.urls[c.key] = URL.createObjectURL(c.value); c.continue(); } else res();
        };
        req.onerror = () => res();
      })).catch(() => {});
    },
    upload(blob) {
      if (blob.size > 20 * 1024 * 1024) return Promise.reject(err('too_large'));
      const id = 'local-' + K.uid();
      return this.open().then((idb) => new Promise((res, rej) => {
        const tx = idb.transaction('blobs', 'readwrite');
        tx.objectStore('blobs').put(blob, id);
        tx.oncomplete = () => { this.urls[id] = URL.createObjectURL(blob); res({ id: id, url: this.urls[id], sizeBytes: blob.size, contentType: blob.type }); };
        tx.onerror = () => rej(err('quota_or_state'));
      }));
    },
    delete(id) {
      if (!String(id).startsWith('local-')) return Promise.resolve({ deleted: false });
      return this.open().then((idb) => new Promise((res) => {
        const tx = idb.transaction('blobs', 'readwrite');
        tx.objectStore('blobs').delete(id);
        tx.oncomplete = () => { if (this.urls[id]) URL.revokeObjectURL(this.urls[id]); delete this.urls[id]; res({ deleted: true }); };
        tx.onerror = () => res({ deleted: false });
      }));
    },
  };
  K.LocalAssets = LocalAssets;

  /* where a stored photo or video id can be shown from */
  K.media = function (id) {
    if (!id) return '';
    if (/[/:]/.test(id)) return id;
    if (K.mode === 'cloud') return '/_blob/' + id;
    return LocalAssets.urls[id] || 'assets/photos/' + id + '.jpg';
  };

  /* friendly text for upload failures */
  K.uploadErr = function (e) {
    const c = e && e.code;
    if (c === 'too_large') return 'That file is over 20 MB. Trim the video or record at 720p, then try again.';
    if (c === 'unsupported_type') return 'That file type is not supported. Use JPG or PNG photos and MP4 or WebM video.';
    if (c === 'quota_or_state') return 'Photo storage is full. Delete some old videos, then try again.';
    if (c === 'rate_limited') return 'Too many uploads at once. Wait a moment and try again.';
    if (c === 'not_granted') return 'Uploading is not available here.';
    return 'Upload failed. Check your connection and try again.';
  };
})();
