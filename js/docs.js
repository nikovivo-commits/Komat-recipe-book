/* Documents: the kitchen's standing paperwork (the closing checklist and the like), at the bottom of Today.
   Everyone opens and prints them; the head chef and sous chef add and change them. Each one is written in
   Bulgarian and English: a title, a line under it, the checklist ("# A heading" starts a section, every
   other line is something to tick), a sign-off sentence and the line to sign on. Kept in settings/docs. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;

  const CLOSING = {
    id: 'closing',
    title: { bg: 'Затваряне на кухнята', en: 'Kitchen closing checklist' },
    intro: { bg: 'Изпълни всяка точка, преди да си тръгнеш. Чисто означава безупречно, не просто подредено.', en: 'Complete every item before leaving. Clean means spotless, not just tidy.' },
    body: {
      bg: [
        '# Оборудване и машини',
        'Термомикс, Pacojet и вакуум машината – почистени основно.',
        'Миксерът KitchenAid и везните – измити и безупречни.',
        'Фурната – почистена отвън; саламандърът – без олио и мазнина.',
        'Тавичката за вода на планчата – изпразнена и почистена.',
        'Машината за топлите ястия – избърсана.',
        'Хладилниците – избърсани отвън.',
        'Вентилацията – спряна.',
        '# Работни места и плотове',
        'Всяка станция – основно почистена, подредена и освободена.',
        'Никъде не са оставени мръсни микрофибърни кърпи.',
        'Няма излишни неща и бъркотия по работните плотове.',
        'Стената между вакуум машината и студената секция – изтъркана основно.',
        '# Мивки и миялна зона',
        'Всички мивки – изтъркани и измити основно.',
        'В мивките няма мазнина, олио, остатъци от храна или наслоявания.',
        'Мивката до тоалетната – напълно празна и чиста.',
        '# Подове',
        'Подът между студената секция и паса – изтъркан и измит както трябва.',
        'Всички подове в кухнята – измити както трябва; без мръсотия, мазнина и остатъци от храна.',
        '# Сух склад',
        'Сухият склад – подреден; всичко на мястото си.',
        'В сухия склад не са оставени зеленчуци.',
      ].join('\n'),
      en: [
        '# Equipment & machines',
        'Thermomix, Pacojet and vacuum machine cleaned thoroughly.',
        'KitchenAid mixer and scales washed and spotless.',
        'Oven exterior cleaned; salamander free of oil and grease.',
        'Plancha water tray emptied and cleaned.',
        'Hot dish machine wiped down.',
        'Fridge exteriors wiped clean.',
        'Ventilation closed.',
        '# Workstations & surfaces',
        'Every station thoroughly cleaned, organized and clear.',
        'No dirty microfiber cloths left at any station.',
        'No extra items or clutter left on work surfaces.',
        'Wall between vacuum machine and cold section scrubbed thoroughly.',
        '# Sinks & washing areas',
        'All sinks thoroughly scrubbed and washed.',
        'No grease, oil, food debris or residue in sinks.',
        'Sink next to the restroom completely empty and clean.',
        '# Floors',
        'Floor between cold section and pass properly scrubbed and washed.',
        'All kitchen floors properly washed; no dirt, grease or food debris.',
        '# Dry storage',
        'Dry storage organized; everything in its place.',
        'No vegetables left in dry storage.',
      ].join('\n'),
    },
    sign: { bg: 'Потвърждавам, че кухнята е проверена и е готова за следващата смяна.', en: 'I confirm the kitchen has been checked and is ready for the next service.' },
    who: { bg: 'Затварящ готвач', en: 'Closing chef' },
    footer: { bg: 'Komat · дневен стандарт за затваряне', en: 'Komat · daily closing standard' },
  };
  K.docsList = () => (D.docs && Array.isArray(D.docs.list) ? D.docs.list : [CLOSING]);
  const findDoc = (id) => K.docsList().find((d) => d.id === id) || null;
  const pl = () => (K.printLang ? K.printLang() : 'both');
  const t = (o, lang) => { o = o || {}; return (lang === 'en' ? o.en || o.bg : o.bg || o.en) || ''; };
  /* the checklist text as sections: [{ head, items: [] }] */
  function parse(text) {
    const out = [];
    String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => {
      if (/^#/.test(l)) out.push({ head: l.replace(/^#+\s*/, ''), items: [] });
      else { if (!out.length) out.push({ head: '', items: [] }); out[out.length - 1].items.push(l); }
    });
    return out;
  }
  const count = (d) => parse(t(d.body, 'bg') || t(d.body, 'en')).reduce((a, s) => a + s.items.length, 0);
  function saveDocs(list) {
    const n = { list: list, updated: Date.now() };
    D.docs = n; K.refresh(true);
    return K.db.doc('settings/docs').set(n).catch(K.writeFailed);
  }

  /* ---------- at the bottom of Today ---------- */
  K.docsBox = function () {
    const list = K.docsList();
    return h('section', { class: 'docs-box' },
      h('h2', { class: 'docs-h' }, K.lang === 'en' ? 'Documents' : 'Документи'),
      h('div', { class: 'docs-list' }, list.map((d) => h('button', { type: 'button', class: 'doc-row', onclick: () => { ui.sheet = { type: 'doc', id: d.id }; K.render(); } },
        h('span', { class: 'doc-ico' }, K.icon('print')),
        h('span', { class: 'doc-txt' }, h('b', null, t(d.title, K.lang)), h('small', null, count(d) + (K.lang === 'en' ? ' items · open or print' : ' точки · отвори или принтирай'))),
        K.icon('next')))),
      K.me.admin ? h('button', { class: 'btn small', type: 'button', onclick: () => { ui.docDraft = { id: 'd' + K.uid(), title: { bg: '', en: '' }, intro: { bg: '', en: '' }, body: { bg: '', en: '' }, sign: { bg: '', en: '' }, who: { bg: '', en: '' }, footer: { bg: '', en: '' } }; ui.sheet = { type: 'docedit', id: null }; K.render(); } }, K.icon('plus'), 'Add a document') : null);
  };

  /* ---------- one document: read it, print it ---------- */
  K.SHEETS.doc = function (c) {
    const d = findDoc(c.id);
    if (!d) return null;
    const lang = pl(), secs = parse(t(d.body, K.lang));
    return K.sheet(t(d.title, K.lang), [
      t(d.intro, K.lang) ? h('p', { class: 'doc-intro' }, t(d.intro, K.lang)) : null,
      h('div', { class: 'doc-view' }, secs.map((s) => h('div', { class: 'doc-sec' }, s.head ? h('h3', null, s.head) : null,
        h('ul', null, s.items.map((it) => h('li', null, h('span', { class: 'doc-box', 'aria-hidden': 'true' }), it)))))),
      t(d.sign, K.lang) ? h('p', { class: 'doc-sign' }, t(d.sign, K.lang)) : null,
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Language on the paper'),
        K.seg([['bg', 'БГ'], ['both', 'БГ + English'], ['en', 'English']], lang, (v) => { K.store.set('printLang', v); K.render(); }, { 'aria-label': 'Language on the paper' })),
      h('div', { class: 'btns' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => K.printDoc(d, pl()) }, K.icon('print'), 'Print'),
        K.me.admin ? h('button', { class: 'btn', type: 'button', onclick: () => { ui.docDraft = K.clone(d); ui.sheet = { type: 'docedit', id: d.id }; K.render(); } }, K.icon('edit'), 'Edit') : null),
    ], { wide: true });
  };

  /* ---------- on paper: A4, a box to tick on every line, the sign-off and the line to sign ---------- */
  K.printDoc = function (d, lang) {
    const old = document.getElementById('printsheet');
    if (old) old.remove();
    const main = lang === 'en' ? 'en' : 'bg', sub = lang === 'both' ? 'en' : '';
    const A = parse(t(d.body, main)), B = sub ? parse(t(d.body, sub)) : [];
    const two = (a, b) => [h('b', null, a), b && b !== a ? h('span', { class: 'pr-en' }, b) : null];
    const page = h('section', { class: 'pr-page pr-doc' },
      h('header', { class: 'pr-head' },
        h('img', { class: 'pr-logo', src: 'assets/brand/logo-black.png', alt: 'Komat' }),
        h('div', { class: 'pr-title' }, h('span', { class: 'pr-kicker' }, 'Komat'),
          h('h1', null, t(d.title, main)), sub && t(d.title, sub) !== t(d.title, main) ? h('p', { class: 'pd-sub' }, t(d.title, sub)) : null,
          t(d.intro, main) ? h('p', null, t(d.intro, main)) : null, sub && t(d.intro, sub) ? h('p', { class: 'pd-sub' }, t(d.intro, sub)) : null)),
      A.map((s, i) => h('div', { class: 'pd-sec' },
        s.head ? h('h2', null, s.head, B[i] && B[i].head && B[i].head !== s.head ? h('span', null, ' · ' + B[i].head) : null) : null,
        h('ul', null, s.items.map((it, j) => h('li', null, h('span', { class: 'pd-box' }), h('span', { class: 'pd-txt' }, two(it, B[i] && B[i].items[j]))))))),
      t(d.sign, main) ? h('div', { class: 'pd-sign' },
        h('p', null, h('span', { class: 'pd-box' }), h('span', { class: 'pd-txt' }, two(t(d.sign, main), sub ? t(d.sign, sub) : ''))),
        h('div', { class: 'pd-lines' },
          h('span', null, (t(d.who, main) || (main === 'en' ? 'Name' : 'Име')) + (sub && t(d.who, sub) ? ' / ' + t(d.who, sub) : '') + ':', h('i')),
          h('span', null, (main === 'en' ? 'Date' : 'Дата') + (sub ? ' / Date' : '') + ':', h('i')))) : null,
      h('footer', { class: 'pd-foot' }, t(d.footer, main) || 'Komat'));
    const sheet = h('div', { id: 'printsheet', 'aria-hidden': 'true' }, page);
    document.body.append(sheet);
    Promise.all(Array.from(sheet.querySelectorAll('img')).map((im) => (im.complete ? null : new Promise((r) => { im.onload = r; im.onerror = r; }))))
      .then(() => { if (K.fitOnePage) K.fitOnePage(sheet); setTimeout(() => window.print(), 30); });
  };

  /* ---------- the head chef writes and changes them ---------- */
  K.SHEETS.docedit = function (c) {
    if (!K.me.admin) return null;
    const d = ui.docDraft;
    if (!d) return null;
    const pair = (label, key, rows, hint) => h('div', { class: 'field' }, h('span', { class: 'legend' }, label),
      h('div', { class: 'doc-pair' }, ['bg', 'en'].map((l) => {
        const attrs = { class: 'input', value: (d[key] || {})[l] || '', placeholder: l === 'bg' ? 'Български' : 'English', 'aria-label': label + (l === 'bg' ? ', Bulgarian' : ', English'), oninput: (e) => { d[key] = d[key] || {}; d[key][l] = e.target.value; } };
        return rows ? h('textarea', Object.assign({ rows: String(rows) }, attrs)) : h('input', attrs);
      })), hint ? h('small', { class: 'hint' }, hint) : null);
    const save = () => {
      if (!(d.title.bg || d.title.en).trim()) { K.toast('Give it a title.', { tone: 'bad' }); return; }
      const list = K.docsList().slice(), i = list.findIndex((x) => x.id === d.id);
      if (i >= 0) list[i] = K.clone(d); else list.push(K.clone(d));
      saveDocs(list); ui.docDraft = null; ui.sheet = { type: 'doc', id: d.id }; K.render(); K.toast('Saved', { tone: 'good' });
    };
    const del = () => {
      if (!ui.docDel) { ui.docDel = true; K.render(); return; }
      ui.docDel = false; saveDocs(K.docsList().filter((x) => x.id !== d.id)); ui.docDraft = null; ui.sheet = null; K.render(); K.toast('Removed');
    };
    return K.sheet(c.id ? 'Edit the document' : 'New document', [
      pair('Title', 'title'),
      pair('The line under the title', 'intro', 2),
      pair('What to tick', 'body', 12, 'One line for each thing to tick. A line starting with # is a heading, e.g. “# Floors”. Keep the two languages in the same order, so they print side by side.'),
      pair('Sign-off sentence', 'sign', 2),
      pair('Who signs', 'who', 0, 'e.g. Closing chef'),
      pair('Footer', 'footer'),
      h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: save }, 'Save'),
        c.id ? h('button', { class: 'btn danger small', type: 'button', onclick: del }, ui.docDel ? 'Tap again to remove' : 'Remove') : null),
    ], { wide: true });
  };
})();
