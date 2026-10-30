/* Komat Back Office: storage.
 * Two backends behind one API:
 *  - shared: the claude.ai artifact database (live, everyone on the team sees the same stock)
 *  - local:  this browser's localStorage (when the page is opened on its own)
 * Records are plain JSON objects in four collections plus one settings document. */
(function (root) {
  'use strict';

  const COLLECTIONS = ['items', 'suppliers', 'orders', 'reservations', 'moves', 'kitchen'];
  const CORE = ['items', 'suppliers', 'orders', 'reservations'];
  const LS_KEY = 'komat-backoffice-v1';
  const MAX_PARALLEL_WRITES = 4;
  // Stock movements older than this are folded into the counted figures, so only recent ones are loaded.
  const MOVES_WINDOW_DAYS = 60;
  const LOCAL_MOVES_KEEP_DAYS = 120;

  const DEFAULT_SETTINGS = {
    restaurant: 'Komat',
    sender: '',
    signature: '',
    address: '',
    currency: 'EUR',
    copyTo: '',
    emailIntro: 'please send us the following',
    normalCoversWeek: 0,
    boost: true,
    boostCap: 1.5,
    bookingsQuery: '(резервация OR резервации OR reservation OR booking OR reservation.tools) newer_than:14d',
    inboxQuery: '(фактура OR поръчка OR доставка OR проформа OR invoice OR order OR delivery) newer_than:14d'
  };

  function newId(prefix) {
    return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function clean(obj) {
    // JSON round-trip drops undefined values and functions; the store accepts plain JSON only.
    const body = JSON.parse(JSON.stringify(obj));
    delete body.id;
    return body;
  }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function dayIso(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /** One id per browser tab: each tab writes only its own movement documents. */
  function tabId() {
    try {
      let id = root.sessionStorage.getItem('komat-tab');
      if (!id) { id = 't' + Math.random().toString(36).slice(2, 10); root.sessionStorage.setItem('komat-tab', id); }
      return id;
    } catch (e) {
      return 't' + Math.random().toString(36).slice(2, 10);
    }
  }

  const store = {
    mode: 'starting', // 'starting' | 'shared' | 'local'
    ready: false,
    readOnly: false,
    persistent: true, // false when even localStorage is unavailable
    error: null,
    data: { items: {}, suppliers: {}, orders: {}, reservations: {}, moves: {}, kitchen: {} },
    settings: Object.assign({}, DEFAULT_SETTINGS),
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    COLLECTIONS: COLLECTIONS,
    newId: newId,
    tabId: tabId(),

    _db: null,
    _listeners: [],
    _errorListeners: [],
    _queue: {},
    _active: 0,
    _waiting: [],
    _loaded: {},
    _saveTimer: null,

    onChange: function (fn) { this._listeners.push(fn); },
    onError: function (fn) { this._errorListeners.push(fn); },
    _emit: function () { const self = this; this._listeners.forEach(function (fn) { fn(self); }); },
    _fail: function (message, code) {
      this._errorListeners.forEach(function (fn) { fn(message, code); });
    },

    start: async function () {
      const claude = root.claude;
      if (claude && typeof claude.use === 'function') {
        let db = null;
        try { db = await claude.use('db'); } catch (e) { db = null; }
        if (db) {
          try {
            const user = await claude.use('user');
            const can = user && typeof user.can === 'function' ? await user.can('data.write') : null;
            if (can === false) this.readOnly = true;
          } catch (e) { /* unknown: let a refused write decide */ }
          this._startShared(db);
          return;
        }
      }
      this._startLocal();
    },

    _startLocal: function () {
      this.mode = 'local';
      try {
        const raw = root.localStorage.getItem(LS_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          COLLECTIONS.forEach(function (c) { store.data[c] = (saved.data && saved.data[c]) || {}; });
          this.settings = Object.assign({}, DEFAULT_SETTINGS, saved.settings || {});
          // Browser storage is small: drop movement documents nobody needs any more.
          const keep = dayIso(-LOCAL_MOVES_KEEP_DAYS);
          Object.keys(this.data.moves).forEach(function (id) { if ((store.data.moves[id].date || '') < keep) delete store.data.moves[id]; });
        }
      } catch (e) {
        this.persistent = false;
      }
      this.ready = true;
      this._emit();
    },

    _persistLocal: function () {
      if (this.mode !== 'local') return;
      clearTimeout(this._saveTimer);
      const self = this;
      this._saveTimer = setTimeout(function () {
        try {
          root.localStorage.setItem(LS_KEY, JSON.stringify({ data: self.data, settings: self.settings }));
          self.persistent = true;
        } catch (e) {
          if (self.persistent) self._fail('This browser is not saving changes (private window or storage blocked). Export a backup before closing.', 'storage');
          self.persistent = false;
        }
      }, 150);
    },

    _startShared: function (db) {
      this.mode = 'shared';
      this._db = db;
      const self = this;
      const onErr = function (e) {
        const code = e && e.code;
        self.error = code || 'unavailable';
        if (code === 'revoked') self.readOnly = true;
        self._fail(code === 'revoked'
          ? 'Access to the shared data ended. Reload the page to reconnect.'
          : 'Live updates stopped. Reload the page to reconnect.', code);
        self._emit();
      };
      const markLoaded = function (key) {
        self._loaded[key] = true;
        if (!self.ready && COLLECTIONS.concat(['settings']).every(function (k) { return self._loaded[k]; })) self.ready = true;
      };
      COLLECTIONS.forEach(function (col) {
        const source = col === 'moves' ? db.collection(col).where('date', '>=', dayIso(-MOVES_WINDOW_DAYS)) : db.collection(col);
        source.onSnapshot(function (snap) {
          const next = {};
          snap.docs.forEach(function (d) {
            if (d.exists) next[d.id] = Object.assign({}, d.data(), { id: d.id });
          });
          // Keep edits that are queued locally but not written yet.
          Object.keys(self._queue).forEach(function (path) {
            const q = self._queue[path];
            const parts = path.split('/');
            if (parts[0] !== col || !q.pending) return;
            if (q.pending.type === 'delete') delete next[parts[1]];
            else next[parts[1]] = Object.assign({}, q.pending.body, { id: parts[1] });
          });
          self.data[col] = next;
          markLoaded(col);
          self._emit();
        }, onErr);
      });
      db.doc('settings/main').onSnapshot(function (snap) {
        self.settings = Object.assign({}, DEFAULT_SETTINGS, snap.exists ? snap.data() : {});
        markLoaded('settings');
        self._emit();
      }, onErr);
    },

    /* ----- reads ----- */

    list: function (col) { return Object.values(this.data[col] || {}); },
    get: function (col, id) { return (this.data[col] || {})[id] || null; },
    isEmpty: function () {
      const self = this;
      return CORE.every(function (c) { return Object.keys(self.data[c]).length === 0; });
    },

    /** Records a stock movement in this tab's own document for the day. */
    addMove: function (entry, date) {
      const day = date || dayIso(0);
      const id = day + '~' + this.tabId;
      const doc = this.get('moves', id);
      this.put('moves', { id: id, date: day, tab: this.tabId, entries: ((doc && doc.entries) || []).concat([entry]) });
    },

    /** Removes this tab's latest movement of today that matches; returns it, or null. */
    undoMove: function (match) {
      const id = dayIso(0) + '~' + this.tabId;
      const doc = this.get('moves', id);
      const entries = ((doc && doc.entries) || []).slice();
      for (let i = entries.length - 1; i >= 0; i--) {
        if (match(entries[i])) {
          const gone = entries.splice(i, 1)[0];
          this.put('moves', { id: id, date: doc.date, tab: this.tabId, entries: entries });
          return gone;
        }
      }
      return null;
    },

    /* ----- writes ----- */

    put: function (col, obj) {
      const id = obj.id || newId(col.slice(0, 2) + '-');
      const body = clean(obj);
      body.updatedAt = Date.now();
      this.data[col][id] = Object.assign({}, body, { id: id });
      this._emit();
      if (this.mode === 'shared') this._enqueue(col + '/' + id, { type: 'set', body: body });
      else this._persistLocal();
      return id;
    },

    patch: function (col, id, partial) {
      const current = this.get(col, id);
      if (!current) return null;
      return this.put(col, Object.assign({}, current, partial, { id: id }));
    },

    remove: function (col, id) {
      delete this.data[col][id];
      this._emit();
      if (this.mode === 'shared') this._enqueue(col + '/' + id, { type: 'delete' });
      else this._persistLocal();
    },

    saveSettings: function (partial) {
      this.settings = Object.assign({}, this.settings, partial);
      this._emit();
      if (this.mode === 'shared') this._enqueue('settings/main', { type: 'set', body: clean(this.settings) });
      else this._persistLocal();
    },

    /** Resolves once every queued write has reached the store. */
    flush: async function () {
      const running = Object.values(this._queue).map(function (q) { return q.running; }).filter(Boolean);
      await Promise.all(running);
    },

    _enqueue: function (path, op) {
      let q = this._queue[path];
      if (!q) q = this._queue[path] = { pending: null, running: null };
      q.pending = op; // a newer edit to the same record replaces an unsent older one
      if (!q.running) q.running = this._drain(path);
      return q.running;
    },

    _drain: async function (path) {
      const q = this._queue[path];
      try {
        while (q.pending) {
          await this._acquire();
          // Take the newest edit only after a write slot is free, so later edits coalesce into it.
          const op = q.pending;
          q.pending = null;
          try { if (op) await this._apply(path, op); } finally { this._release(); }
        }
      } finally {
        q.running = null;
        if (!q.pending) delete this._queue[path];
      }
    },

    _acquire: function () {
      if (this._active < MAX_PARALLEL_WRITES) { this._active++; return Promise.resolve(); }
      const self = this;
      return new Promise(function (resolve) { self._waiting.push(resolve); }).then(function () { self._active++; });
    },

    _release: function () {
      this._active--;
      const next = this._waiting.shift();
      if (next) next();
    },

    _apply: async function (path, op) {
      const ref = this._db.doc(path);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          if (op.type === 'delete') await ref.delete();
          else await ref.set(op.body);
          return;
        } catch (e) {
          const code = e && e.code;
          if ((code === 'unavailable' || code === 'resource_exhausted') && attempt === 0) {
            await delay(400 + Math.random() * 600);
            continue;
          }
          if (code === 'invalid_argument' && !this.readOnly) {
            this.readOnly = true;
            this._fail('You can look but not change anything here. Ask the owner to share this page with you as a Contributor or Editor.', code);
            this._emit();
          } else if (code === 'quota_exceeded') {
            this._fail('The shared storage is full. Delete old orders or bookings, then try again.', code);
          } else if (code !== 'invalid_argument') {
            this._fail('A change could not be saved. Check your connection and try again.', code);
          }
          return;
        }
      }
    }
  };

  root.KomatStore = store;
})(window);
