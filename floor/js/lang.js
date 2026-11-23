/* The floor book in Bulgarian.
   The screens are written in English. When the language is Bulgarian, every piece of text is swapped as it is put
   on the screen (K.h asks K.tr for each text and label), from three sources:
   - floor/data/bg.js: the interface, as whole strings and as templates (“{0} bottles open”);
   - the wines and dishes themselves: each carries its Bulgarian texts beside the English (`bg`), so a line the
     manager rewrites in English simply stops being swapped until its Bulgarian is rewritten too;
   - words joined by “ · ” or commas (a region, a list of grapes) are swapped one by one.
   Anything with no Bulgarian yet stays in English: nothing breaks, it only reads mixed. */
(function () {
  'use strict';
  const K = window.K, D = K.D, BG = window.KOMAT_BG || { s: {}, t: [] };
  const read = () => { try { return JSON.parse(localStorage.getItem('komat.fohLang')); } catch (e) { return null; } };
  K.flang = read() === 'en' ? 'en' : read() === 'bg' ? 'bg' : /^bg/i.test(navigator.language || '') ? 'bg' : 'en';
  K.locale = K.flang === 'bg' ? 'bg-BG' : 'en-GB';
  document.documentElement.lang = K.flang;

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lines = (s) => String(s || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
  let pats = null, lower = null;
  function compile() {
    /* a template with one word of its own only takes a single word or number in each gap, so it cannot swallow a sentence */
    pats = BG.t.map((x) => {
      const parts = x[0].split(/\{\d+\}/), lit = parts.join(''), words = (lit.match(/[A-Za-z]{2,}/g) || []).length;
      return { re: new RegExp('^' + parts.map(esc).join(words >= 2 || x[2] ? '([\\s\\S]+?)' : '(\\S+)') + '$'), bg: x[1], w: lit.length };
    }).sort((a, b) => b.w - a.w);
    lower = {};
    Object.keys(BG.s).forEach((k) => { const l = k.toLowerCase(); if (l !== k && lower[l] == null && BG.s[l] == null) lower[l] = BG.s[k].charAt(0).toLowerCase() + BG.s[k].slice(1); });
  }

  /* the Bulgarian the wines, dishes and tasting menu carry, by their English text */
  let dyn = {}, seenW = null, seenN = null, seenT = null;
  function fromData() {
    if (D.wines === seenW && D.notes === seenN && D.tasting === seenT) return false;
    seenW = D.wines; seenN = D.notes; seenT = D.tasting; dyn = {};
    const put = (en, bg) => { if (en && bg && typeof en === 'string' && typeof bg === 'string') dyn[en.trim()] = bg.trim(); };
    const byLine = (en, bg) => { const a = lines(en), b = lines(bg); if (a.length === b.length) a.forEach((x, i) => put(x, b[i])); else put(en, bg); };
    (D.wines || []).forEach((w) => { const b = w.bg; if (!b) return; ['say', 'nose', 'palate', 'made', 'story'].forEach((k) => put(w[k], b[k])); byLine(w.facts, b.facts); });
    Object.keys(D.notes || {}).forEach((id) => {
      const n = D.notes[id], b = n.bg;
      if (!b) return;
      ['pitch', 'story', 'pairText', 'canHow'].forEach((k) => put(n[k], b[k]));
      byLine(n.facts, b.facts);
      (n.niche || []).forEach((x) => put(x.what, (b.niche || {})[x.n]));
      Object.keys(n.pairWhy || {}).forEach((wid) => put(n.pairWhy[wid], (b.pairWhy || {})[wid]));
    });
    const t = D.tasting;
    if (t && t.bg) { ['name', 'note', 'pairingName'].forEach((k) => put(t[k], t.bg[k])); if (t.welcome) put(t.welcome.text, t.bg.welcome); }
    return true;
  }

  const cache = new Map();
  const hit = (s) => (BG.s[s] != null ? BG.s[s] : dyn[s] != null ? dyn[s] : null);
  /* one word or name on its own: as written, or the lower-case form of a capitalised entry (“vegan” from “Vegan”) */
  const word = (s) => { const r = hit(s); return r != null ? r : lower[s] != null ? lower[s] : null; };
  function raw(s) {
    const core = s.trim();
    if (!core || !/[A-Za-z]/.test(core)) return s;
    let r = word(core);
    if (r != null) return s.replace(core, () => r);
    for (const p of pats) { const m = p.re.exec(s); if (m) return p.bg.replace(/\{(\d+)\}/g, (_, i) => tr(m[+i + 1] || '')); }
    for (const sep of [' · ', ' | ']) if (s.includes(sep)) return s.split(sep).map(tr).join(sep);
    /* a list (“Chardonnay, Riesling”): only when every item is a known word, so no sentence is cut up */
    if (core.includes(', ')) { const ps = core.split(', ').map(word); if (ps.every((x) => x != null)) return s.replace(core, () => ps.join(', ')); }
    /* the same with a colon or a full stop after it (“Milk, Vegan:”) */
    const end = /^([\s\S]*?[^\s:.])([:.]+)$/.exec(core);
    if (end) { const inner = raw(end[1]); if (inner !== end[1]) return s.replace(core, () => inner + end[2]); }
    return s;
  }
  function tr(s) {
    if (K.flang !== 'bg' || typeof s !== 'string' || !s) return s;
    if (!pats) compile();
    if (fromData()) cache.clear();
    let r = cache.get(s);
    if (r === undefined) { r = raw(s); cache.set(s, r); }
    return r;
  }
  K.tr = tr;
  /* for text the code cuts or lower-cases before showing it: swap first, then cut */
  K.T = tr;

  K.setLang = function (l) {
    K.flang = l === 'bg' ? 'bg' : 'en';
    K.locale = K.flang === 'bg' ? 'bg-BG' : 'en-GB';
    try { localStorage.setItem('komat.fohLang', JSON.stringify(K.flang)); } catch (e) { /* private window: the choice lasts until the page closes */ }
    document.documentElement.lang = K.flang;
    cache.clear();
    if (K.render) K.render();
  };
  /* БГ | EN */
  K.langSwitch = function () {
    const h = K.h;
    return h('div', { class: 'seg lang-seg', role: 'group', 'aria-label': 'Language' },
      /* each language is named in itself, whatever language is on */
      [['bg', 'Български'], ['en', 'English']].map((l) => { const b = h('button', { type: 'button', 'aria-pressed': K.flang === l[0] ? 'true' : 'false', lang: l[0], onclick: () => K.setLang(l[0]) }); b.append(document.createTextNode(l[1])); return b; }));
  };
  /* a text that has a Bulgarian of its own beside it: what the editor shows and saves in each language */
  K.bgMode = () => K.flang === 'bg';
  /* a dish by the name the reader uses: the Bulgarian one in Bulgarian, the English one (when it has one) in English */
  K.dn = (d) => (K.flang === 'bg' ? d.name : d.en || d.name);
})();
