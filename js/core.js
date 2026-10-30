/* Komat kitchen book: shared helpers (DOM, dates, quantities, toasts, sheets, icons). */
(function () {
  'use strict';
  const K = (window.K = window.K || {});

  /* ---------- DOM ---------- */
  /* h('button', {class:'btn', onclick: fn}, 'Label', child, [more]) */
  K.h = function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked') el.checked = !!v;
        else if (k === 'selected') el.selected = !!v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    append(el, Array.prototype.slice.call(arguments, 2));
    return el;
  };
  function append(el, kids) {
    for (const c of kids) {
      if (c == null || c === false) continue;
      if (Array.isArray(c)) append(el, c);
      else el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
  }
  const h = K.h;

  K.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  K.clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
  K.safeId = (s) => String(s).replace(/[^A-Za-z0-9_\-.~:@+]/g, '-');
  K.store = {
    get(k, d) { try { const v = localStorage.getItem('komat.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('komat.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  K.vibrate = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not allowed */ } };

  /* ---------- dates: the kitchen day runs until 4 am ---------- */
  const DAY = 86400000;
  K.ymd = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  K.parseYmd = (s) => { const p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  K.addDays = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
  K.kitchenNow = () => new Date(Date.now() - 4 * 3600 * 1000);
  /* K.day(0) = today's kitchen date, K.day(-1) = yesterday, K.day(1) = tomorrow */
  K.day = (n) => K.ymd(K.addDays(K.kitchenNow(), n || 0));
  K.daysUntil = (ds) => Math.round((K.parseYmd(ds) - K.parseYmd(K.day(0))) / DAY);
  K.mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  K.thisWeek = () => K.ymd(K.mondayOf(K.kitchenNow()));
  K.todayIdx = () => (K.kitchenNow().getDay() + 6) % 7;
  /* minutes since midnight in kitchen time: after midnight counts as 24:xx */
  K.kitchenMinutes = () => { const n = new Date(); const m = n.getHours() * 60 + n.getMinutes(); return m < 240 ? m + 1440 : m; };
  K.hm = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  K.prettyDate = (ds, opts) => K.parseYmd(ds).toLocaleDateString('en-GB', opts || { weekday: 'long', day: 'numeric', month: 'long' });
  K.DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  /* food-safety day-dot label colours, Monday first */
  K.DAY_DOTS = ['#2F6FD0', '#E8C02E', '#D23B2F', '#7A4B2A', '#2E9150', '#EE8A22', '#1B1B1B'];
  K.toMinutes = (hhmm) => { const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : null; };

  /* ---------- quantities ---------- */
  K.fmtNum = (n) => {
    n = +n;
    const s = n >= 100 ? Math.round(n) : n >= 10 ? Math.round(n * 10) / 10 : Math.round(n * 100) / 100;
    return String(s);
  };
  K.parseQty = (s) => {
    s = String(s == null ? '' : s).trim().replace(',', '.');
    let m;
    if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + +m[2] / +m[3];
    if ((m = s.match(/^(\d+)\/(\d+)$/))) return +m[1] / +m[2];
    if ((m = s.match(/^(\d*\.?\d+)\s*(?:-|–|—|до)\s*(\d*\.?\d+)$/))) return (parseFloat(m[1]) + parseFloat(m[2])) / 2;
    return /^\d*\.?\d+$/.test(s) ? parseFloat(s) : NaN;
  };
  /* amount and unit, multiplied by f; g/kg and ml/L switch over at 1000 */
  K.fmtQty = (q, u, f) => {
    q = (q == null ? '' : String(q)).trim();
    u = (u || '').trim();
    if (!q) return u;
    let n = K.parseQty(q);
    if (isNaN(n)) return (q + ' ' + u).trim();
    const rng = /\d\s*(?:-|–|—|до)\s*\.?\d/.test(q);
    if (rng && Math.abs(f - 1) < 0.0005) return (q + ' ' + u).trim();
    n *= f;
    const lu = u.toLowerCase();
    if (lu === 'g' && n >= 1000) { n /= 1000; u = 'kg'; }
    else if (lu === 'kg' && n < 1) { n *= 1000; u = 'g'; }
    else if (lu === 'ml' && n >= 1000) { n /= 1000; u = 'L'; }
    else if (lu === 'l' && n < 1) { n *= 1000; u = 'ml'; }
    return (rng ? '~' : '') + K.fmtNum(n) + (u ? ' ' + u : '');
  };
  const UNITFAM = { g: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], l: ['ml', 1000], cl: ['ml', 10], dl: ['ml', 100] };
  K.unitInfo = (u) => UNITFAM[String(u || '').trim().toLowerCase()] || null;
  K.UNITS = ['g', 'kg', 'ml', 'L', 'pcs', 'bunch', 'portions'];
  /* "1 portions" reads as "1 portion" */
  K.yieldText = (q, u) => K.fmtNum(q) + ' ' + (+q === 1 && /^portions$/i.test(u || '') ? 'portion' : u || '');

  /* ---------- toasts ---------- */
  let toastT = null;
  /* K.toast('Saved') or K.toast('Done: onions', {undo: fn}) */
  K.toast = function (msg, opts) {
    opts = opts || {};
    let box = document.getElementById('toast');
    if (!box) { box = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
    box.textContent = '';
    box.append(h('span', null, msg));
    if (opts.undo) {
      box.append(h('button', { type: 'button', class: 'toast-act', onclick: () => { box.hidden = true; document.body.classList.remove('toasting'); opts.undo(); } }, 'Undo'));
    }
    box.className = 'toast' + (opts.tone ? ' ' + opts.tone : '');
    box.hidden = false;
    document.body.classList.add('toasting');
    clearTimeout(toastT);
    toastT = setTimeout(() => { box.hidden = true; document.body.classList.remove('toasting'); }, opts.undo ? 5000 : 3200);
  };

  /* ---------- icons (24px, stroke) ---------- */
  const P = {
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/><path d="M9 7h7"/>',
    today: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8l1.5 1.5L12 7M8 14l1.5 1.5L12 13M14 8.5h3M14 14.5h3"/>',
    order: '<path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/>',
    rota: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 3v3M16 3v3M7 13.5h2M11 13.5h2M15 13.5h2M7 17h2M11 17h2"/>',
    event: '<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    up: '<path d="M6 15l6-6 6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    print: '<path d="M7 9V3.5h10V9"/><path d="M7 17.5H5a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4.5a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v6.5H7z"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5M12 2.5V6"/>',
    flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1 2.6 2 3 0-3.2-.5-5.6.5-8z"/>',
    snow: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    pass: '<path d="M3 15h18M5 15V9.5A7 7 0 0 1 19 9.5V15M12 5.5V3.5M9.5 3.5h5M2.5 19h19"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    alert: '<path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    chef: '<path d="M7 14.5V20h10v-5.5"/><path d="M7 14.5a4 4 0 0 1-1.6-7.6A4.5 4.5 0 0 1 12 4a4.5 4.5 0 0 1 6.6 2.9A4 4 0 0 1 17 14.5z"/><path d="M7 17h10"/>',
    minus: '<path d="M5 12h14"/>',
    cook: '<path d="M3 11h18v2a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7z"/><path d="M8 7c0-1.5 1-1.5 1-3M12 7c0-1.5 1-1.5 1-3M16 7c0-1.5 1-1.5 1-3"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.5M4.5 12h.5M4.5 18h.5"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    note: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    bug: '<rect x="7" y="7" width="10" height="13" rx="5"/><path d="M9 7a3 3 0 0 1 6 0M3 13h4M17 13h4M4 8l3 2M20 8l-3 2M4 19l3-2M20 19l-3-2"/>',
    photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 17v3h16v-3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M4 17v3h16v-3"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  };
  K.icon = function (name, cls) {
    const span = h('span', { class: 'ico' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
    span.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || '') + '</svg>';
    return span;
  };

  /* ---------- sheets (bottom sheet on phones, dialog on desktop) ---------- */
  K.sheet = function (title, body, opts) {
    opts = opts || {};
    const close = opts.onClose || (() => { K.ui.sheet = null; K.render(); });
    const head = h('div', { class: 'sheet-head' },
      h('span', { class: 'grab', 'aria-hidden': 'true' }),
      h('h2', null, title),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: close }, K.icon('close')));
    const sheet = h('div', { class: 'sheet' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title,
      onkeydown: (e) => { if (e.key === 'Escape') close(); } }, head, h('div', { class: 'sheet-body' }, body));
    /* pull the sheet down by its top to put it away */
    if (K.dragSheet) K.dragSheet(sheet, head, close);
    return h('div', { class: 'sheet-back', onclick: (e) => { if (e.target === e.currentTarget) close(); } }, sheet);
  };

  /* labelled form field; give the control an id so focus survives a redraw */
  let fid = 0;
  K.field = function (label, ctrl, hint, id) {
    ctrl.id = ctrl.id || id || 'f' + ++fid;
    return h('div', { class: 'field' }, h('label', { for: ctrl.id }, label), ctrl, hint ? h('p', { class: 'hint' }, hint) : null);
  };
  K.select = function (opts, value, onchange, attrs) {
    const s = h('select', Object.assign({ class: 'input', onchange: (e) => onchange(e.target.value) }, attrs || {}),
      opts.map((o) => h('option', { value: o[0] }, o[1])));
    s.value = value == null ? '' : value;
    return s;
  };
  /* segmented control: [[value,label],...] */
  K.seg = function (opts, value, onpick, attrs) {
    return h('div', Object.assign({ class: 'seg', role: 'group' }, attrs || {}),
      opts.map((o) => h('button', { type: 'button', 'aria-pressed': value === o[0] ? 'true' : 'false', onclick: () => onpick(o[0]) }, o[1])));
  };

  K.pickFile = function (accept, multiple, cb) {
    const i = h('input', { type: 'file', accept: accept, hidden: true });
    if (multiple) i.multiple = true;
    i.addEventListener('change', () => { const f = Array.from(i.files || []); i.remove(); if (f.length) cb(f); });
    document.body.append(i);
    i.click();
  };
  /* resize a photo to a JPEG blob */
  K.shrinkImage = function (file, max, q) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('read')); };
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
        cx.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', q || 0.84);
      };
      img.src = url;
    });
  };
  /* a photo small enough to live inside one database document (whiteboard, bug screenshot) */
  K.photoDataUrl = function (file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('read')); };
      img.onload = () => {
        URL.revokeObjectURL(url);
        const sizes = [1600, 1300, 1100, 900], qs = [0.7, 0.6, 0.5, 0.42];
        for (const size of sizes) {
          const sc = Math.min(1, size / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
          const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(img, 0, 0, c.width, c.height);
          for (const q of qs) { const d = c.toDataURL('image/jpeg', q); if (d.length < 235000) return res(d); }
        }
        rej(new Error('big'));
      };
      img.src = url;
    });
  };

  K.copyText = function (txt) {
    try {
      return navigator.clipboard.writeText(txt).then(() => K.toast('Copied'), () => K.toast('This device would not copy. Select the text and copy it by hand.'));
    } catch (e) { K.toast('This device would not copy. Select the text and copy it by hand.'); }
  };

  /* Latin spellings for Cyrillic search: "gyozi" finds "Гьози" */
  const LAT_A = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sht', ъ: 'a', ь: 'y', ю: 'yu', я: 'ya' };
  const LAT_B = Object.assign({}, LAT_A, { ж: 'j', ц: 'c', ъ: 'u', ю: 'iu', я: 'ia', й: 'i', ь: '' });
  K.latin = (t) => { t = String(t || '').toLowerCase(); return t.replace(/[а-я]/g, (c) => LAT_A[c] || c) + ' ' + t.replace(/[а-я]/g, (c) => (c in LAT_B ? LAT_B[c] : c)); };
  K.normName = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9а-яё ]/g, ' ').replace(/\s+/g, ' ').trim();
})();
