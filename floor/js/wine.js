/* The wine bible: every wine with a picture of its label, what to say, how it smells and tastes, the
   story, how to serve it, the dishes it goes with, and how many bottles are left right now. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const lines = (t) => String(t || '').split(/\n+/).map((x) => x.replace(/^[-•·*]\s*/, '').trim()).filter(Boolean);

  /* the label: the photo of the real sticker, or until there is one a drawn stand-in with the same words */
  K.wineLabel = function (w, cls) {
    /* small labels in lists only have room for an initial on the paper */
    const tiny = /mini/.test(cls || '');
    const drawn = () => tiny ? h('div', { class: 'wlabel drawn c-' + w.colour + ' ' + cls, 'aria-hidden': 'true' }, h('span', { class: 'wl-band' }), h('span', { class: 'wl-ini' }, (w.name || '?').charAt(0).toUpperCase())) : h('div', { class: 'wlabel drawn c-' + w.colour + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' },
      h('span', { class: 'wl-band' }),
      h('span', { class: 'wl-prod' }, w.producer || K.COL[w.colour]),
      h('span', { class: 'wl-name' }, w.name),
      h('span', { class: 'wl-sub' }, [w.grapes, w.region].filter(Boolean).join(' · ')),
      w.vintage ? h('span', { class: 'wl-vin' }, w.vintage) : null);
    if (!w.label) return drawn();
    return h('div', { class: 'wlabel photo' + (cls ? ' ' + cls : '') }, K.photoWithFallback(K.media(w.label), '', (im) => im.parentNode.replaceWith(drawn()), { alt: 'Label of ' + w.name, loading: 'lazy', decoding: 'async' }));
  };
  K.wineCard = function (w) {
    const st = K.stockState(w);
    return h('button', { class: 'rcard wcard st-' + st + (w.off ? ' off' : ''), type: 'button', onclick: () => K.go('winepage', { id: w.id }) },
      K.wineLabel(w, 'thumb'),
      h('div', { class: 'card-txt' },
        h('span', { class: 'kicker wk-' + w.colour }, K.COL[w.colour] + (w.region ? ' · ' + w.region : '')),
        h('span', { class: 'card-name' }, w.name + (w.vintage ? ' ' + w.vintage : '')),
        w.producer ? h('span', { class: 'card-en' }, w.producer) : null,
        h('span', { class: 'card-meta' },
          w.grapes ? h('span', null, w.grapes) : null,
          w.byGlass && w.glassPrice ? h('span', null, K.icon('glass'), K.price(w.glassPrice)) : null,
          w.bottlePrice ? h('span', null, K.icon('bottle'), K.price(w.bottlePrice)) : null),
        h('span', { class: 'card-pills' }, K.stockBadge(w), w.off ? h('span', { class: 'pill muted' }, 'Off the list') : null, w.example ? h('span', { class: 'pill muted' }, 'Example') : null)));
  };

  /* ---------- the list ---------- */
  K.V.wine = function () {
    const body = h('div', { class: 'page' }), all = K.winesSorted();
    const onList = all.filter((w) => !w.off), glass = onList.filter((w) => w.byGlass).length;
    body.append(K.pageHead('The wine list', onList.length ? onList.length + ' wines' + (glass ? ' · ' + glass + ' by the glass' : '') : 'Every bottle, its label and its story', null, '', 'wine-head has-search'));
    const w = h('div', { class: 'wrap' });
    body.append(w);
    w.append(K.searchBox('wq', ui.wq, 'Search a wine, grape, region or dish', (v) => { ui.wq = v; results(); }));
    const cols = K.COLOURS.filter((c) => all.some((x) => x.colour === c[0]));
    w.append(h('div', { class: 'chips', role: 'group', 'aria-label': 'Colour' },
      [['', 'All', all.length], ['glass', 'By the glass', glass]].concat(cols.map((c) => [c[0], c[1], all.filter((x) => x.colour === c[0]).length])).map((c) =>
        h('button', { class: 'chip' + (c[0] && c[0] !== 'glass' ? ' wc-' + c[0] : ''), type: 'button', 'aria-pressed': ui.colour === c[0] ? 'true' : 'false', onclick: () => { ui.colour = c[0]; K.render(); } }, c[1], h('span', { class: 'cn' }, String(c[2]))))
        .concat(K.canEdit() ? [h('button', { type: 'button', class: 'chip', onclick: () => { ui.sheet = { type: 'wineedit', id: null }; K.render(); } }, K.icon('plus'), 'Add a wine')] : [])));
    w.append(h('div', { id: 'wresults' }));
    return { body: body, after: results };
  };
  function hay(w) {
    const dishes = K.dishes().filter((d) => (d.n.pairs || []).includes(w.id) || w.pairs.includes(d.id)).map((d) => d.name + ' ' + d.en).join(' ');
    return [w.name, w.producer, w.region, w.country, w.grapes, w.vintage, K.COL[w.colour], w.style, w.nose, w.palate, dishes].join(' ');
  }
  function results() {
    const box = document.getElementById('wresults');
    if (!box) return;
    box.textContent = '';
    if (!D.winesLoaded) { box.append(K.loadingBox('Loading the wines')); return; }
    let all = K.winesSorted().filter((w) => K.matches(hay(w), ui.wq));
    if (ui.colour === 'glass') all = all.filter((w) => w.byGlass);
    else if (ui.colour) all = all.filter((w) => w.colour === ui.colour);
    if (!D.wines.length) {
      box.append(K.catRest('The wine list is empty', K.canEdit() ? 'Add the first wine with a photo of its label, or load the example wines to see how it works.' : 'Wines show here as soon as the floor manager adds them.',
        K.canEdit() ? h('div', { class: 'btns center' },
          h('button', { class: 'btn primary', type: 'button', onclick: () => { ui.sheet = { type: 'wineedit', id: null }; K.render(); } }, K.icon('plus'), 'Add a wine'),
          h('button', { class: 'btn', type: 'button', onclick: K.loadExamples }, 'Load the example wines')) : null));
      return;
    }
    if (!all.length) { box.append(h('div', { class: 'empty' }, h('strong', null, 'No wine like that'), 'Try a grape, a region, or a dish it goes with.')); return; }
    const groups = {};
    all.forEach((x) => { const k = x.off ? 'Off the list' : K.COL[x.colour]; (groups[k] = groups[k] || []).push(x); });
    Object.keys(groups).sort((a, b) => (a === 'Off the list') - (b === 'Off the list')).forEach((k) => {
      box.append(h('section', { class: 'group' }, h('h2', { class: 'group-title' }, k, h('span', { class: 'n' }, String(groups[k].length))), h('div', { class: 'grid' }, groups[k].map(K.wineCard))));
    });
  }

  /* ---------- one wine ---------- */
  K.V.winepage = function () {
    const w = K.wine(ui.id);
    if (!w) return { body: K.loadingBox() };
    const st = K.stockState(w), n = K.stockOf(w.id);
    const dishes = K.dishes().filter((d) => (d.n.pairs || []).includes(w.id) || w.pairs.includes(d.id));
    const body = h('div', { class: 'wrap page recipe wine-page' });
    const label = w.label ? h('button', { type: 'button', class: 'wl-big', 'aria-label': 'Open the label photo', onclick: () => K.openPhotos([{ id: w.label, title: K.wineTitle(w) }], 0) }, K.wineLabel(w, 'big'))
      : h('div', { class: 'wl-big' }, K.wineLabel(w, 'big'), K.canEdit() ? h('button', { type: 'button', class: 'btn small wl-add', onclick: () => addLabel(w) }, K.icon('camera'), 'Photo of the label') : null);
    body.append(h('div', { class: 'rhead has-photo whead' }, label,
      h('div', { class: 'rhead-txt' },
        h('p', { class: 'kicker wk-' + w.colour }, K.COL[w.colour] + (w.style ? ' · ' + w.style : '')),
        h('h1', { class: 'rtitle' }, w.name + (w.vintage ? ' ' + w.vintage : '')),
        w.producer ? h('p', { class: 'en-name' }, w.producer) : null,
        h('div', { class: 'meta-chips' },
          w.grapes ? h('span', { class: 'mchip' }, K.icon('leaf'), w.grapes) : null,
          w.region || w.country ? h('span', { class: 'mchip' }, K.icon('globe'), [w.region, w.country].filter(Boolean).join(', ')) : null,
          w.off ? h('span', { class: 'mchip off' }, 'Off the list') : null,
          w.example ? h('span', { class: 'mchip' }, 'Example') : null),
        h('div', { class: 'prices' },
          w.bottlePrice ? h('div', null, h('span', { class: 'label' }, 'Bottle'), h('b', null, K.price(w.bottlePrice))) : null,
          w.byGlass ? h('div', null, h('span', { class: 'label' }, 'Glass' + (w.glassCl ? ' · ' + w.glassCl + ' cl' : '')), h('b', null, K.price(w.glassPrice) || 'yes')) : h('div', null, h('span', { class: 'label' }, 'Glass'), h('b', { class: 'muted' }, 'bottle only'))),
        h('section', { class: 'stock-box st-' + st },
          h('div', { class: 'sb-top' }, h('span', { class: 'label' }, 'In the cellar now'), K.stockBadge(w, true)),
          h('p', { class: 'hint' }, st === 'none' ? 'Nobody has counted it yet. Count it in Stock.' : st === 'out' ? 'Out: tell the guest and offer something close.' : st === 'low' ? 'Running low: ' + n + ' left, the floor manager keeps at least ' + w.par + '.' : 'Plenty for tonight.'),
          K.canWrite() ? h('div', { class: 'btns' },
            h('button', { class: 'btn', type: 'button', disabled: !n, onclick: () => K.moveBottles(w, -1, 'sold') }, K.icon('minus'), 'Sold a bottle'),
            w.byGlass ? h('button', { class: 'btn', type: 'button', disabled: !n, onclick: () => K.moveBottles(w, -1, 'glass') }, K.icon('glass'), 'Opened for glasses') : null,
            h('button', { class: 'btn small', type: 'button', onclick: () => { ui.sheet = { type: 'count', id: w.id }; K.render(); } }, 'Count')) : null),
        w.say ? h('blockquote', { class: 'say' }, K.icon('quote'), h('div', null, h('span', { class: 'label' }, 'What to say at the table'), h('p', null, w.say))) : null)));
    if (w.nose || w.palate) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'In the glass'),
      h('dl', { class: 'niche' }, w.nose ? [h('dt', null, 'Nose'), h('dd', null, w.nose)] : null, w.palate ? [h('dt', null, 'Palate'), h('dd', null, w.palate)] : null)));
    if (w.serve || w.decant || w.glass) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'Serving it'),
      h('dl', { class: 'niche' }, w.serve ? [h('dt', null, 'Temperature'), h('dd', null, w.serve)] : null, w.glass ? [h('dt', null, 'Glass'), h('dd', null, w.glass)] : null, w.decant ? [h('dt', null, 'Decanting'), h('dd', null, w.decant)] : null)));
    if (w.story) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'The story'), h('p', { class: 'prose' }, w.story)));
    if (lines(w.facts).length) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'Good to know'), h('ul', { class: 'facts' }, lines(w.facts).map((f) => h('li', null, f)))));
    if (dishes.length) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'Goes with'),
      h('div', { class: 'mini-list' }, dishes.map((d) => h('button', { type: 'button', class: 'mini-dish', onclick: () => K.go('dish', { id: d.id }) }, K.dishThumb(d, 'sm'), h('span', null, d.name, d.en && d.en !== d.name ? h('small', null, d.en) : null))))));
    if (st === 'out' || st === 'low') {
      const alt = K.winesSorted().filter((x) => x.id !== w.id && !x.off && x.colour === w.colour && ['ok', 'low'].includes(K.stockState(x))).slice(0, 4);
      if (alt.length) body.append(h('section', { class: 'part' }, h('h2', { class: 'sec-title' }, 'If it runs out, offer'), h('div', { class: 'grid' }, alt.map(K.wineCard))));
    }
    return {
      top: K.subbar('Wine', () => K.back('wine'), [K.canEdit() ? h('button', { type: 'button', class: 'btn small', onclick: () => { ui.sheet = { type: 'wineedit', id: w.id }; K.render(); } }, K.icon('edit'), 'Edit') : null], w.name),
      body: body, tabs: false,
    };
  };

  /* a photo of the label, from the camera or the photo library */
  function uploadLabel(file) {
    return K.shrinkImage(file, 1400, 0.85).then((blob) => K.assets.upload(blob)).then((r) => r.id);
  }
  function addLabel(w) {
    K.pickFile('image/*', false, (files) => {
      K.toast('Saving the label…');
      uploadLabel(files[0]).then((id) => K.saveWine(Object.assign({}, w, { label: id }))).then(() => K.toast('Label saved'), (e) => K.toast(K.uploadErr(e), { tone: 'bad' }));
    });
  }

  /* ---------- editing ---------- */
  const FIELDS = ['name', 'producer', 'vintage', 'colour', 'style', 'grapes', 'region', 'country', 'bottlePrice', 'glassPrice', 'glassCl', 'say', 'nose', 'palate', 'story', 'facts', 'serve', 'glass', 'decant', 'par', 'order'];
  K.SHEETS.wineedit = function (S) {
    const w = S.id ? K.wine(S.id) : null;
    if (!S.f) {
      S.f = {};
      FIELDS.forEach((k) => { S.f[k] = w ? (w[k] == null ? '' : String(w[k])) : ''; });
      if (!w) { S.f.colour = 'red'; S.f.par = '3'; S.f.country = 'Bulgaria'; }
      S.f.byGlass = w ? w.byGlass : false; S.f.off = w ? w.off : false; S.f.label = w ? w.label : ''; S.f.pairs = w ? w.pairs.slice() : [];
    }
    const f = S.f;
    const inp = (k, attrs) => h('input', Object.assign({ class: 'input', id: 'we-' + k, value: f[k], oninput: (e) => { f[k] = e.target.value; } }, attrs || {}));
    const area = (k, rows, ph) => h('textarea', { class: 'input', id: 'we-' + k, rows: String(rows), value: f[k], placeholder: ph || '', oninput: (e) => { f[k] = e.target.value; } });
    const save = (e) => {
      e.preventDefault();
      if (!f.name.trim()) { K.toast('Give the wine a name.', { tone: 'bad' }); return; }
      const doc = {};
      FIELDS.forEach((k) => { doc[k] = String(f[k] || '').trim(); });
      doc.par = doc.par === '' ? 3 : +doc.par || 0;
      doc.order = doc.order === '' ? 0 : +doc.order || 0;
      Object.assign(doc, { byGlass: f.byGlass, off: f.off, label: f.label || '', pairs: f.pairs, example: w ? w.example && !S.touched : false });
      if (w) doc.id = w.id;
      K.saveWine(doc).then((id) => { K.toast('Saved'); if (!w) K.go('winepage', { id: id }); });
      ui.sheet = null; K.render();
    };
    const dishes = K.dishes();
    const labelBox = h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Label'),
      h('div', { class: 'label-edit' }, K.wineLabel(K.normWine(Object.assign({ id: 'x' }, f)), 'thumb'),
        h('div', { class: 'btns' },
          h('button', { class: 'btn small', type: 'button', disabled: !!S.busy, onclick: () => K.pickFile('image/*', false, (files) => {
            S.busy = true; K.render();
            uploadLabel(files[0]).then((id) => { f.label = id; S.busy = false; K.render(); }, (er) => { S.busy = false; K.render(); K.toast(K.uploadErr(er), { tone: 'bad' }); });
          }) }, K.icon('camera'), S.busy ? 'Saving…' : f.label ? 'New photo' : 'Photo of the label'),
          f.label ? h('button', { class: 'btn small', type: 'button', onclick: () => { f.label = ''; K.render(); } }, 'Remove') : null)),
      h('p', { class: 'hint' }, 'Take it straight on, the label filling the picture. Without one the list draws a label from the words below.'));
    return K.sheet(w ? 'Edit ' + w.name : 'Add a wine', h('form', { class: 'stack', oninput: () => { S.touched = true; }, onsubmit: save },
      labelBox,
      K.field('Name', inp('name', { required: true, placeholder: 'Mavrud Reserve' })),
      h('div', { class: 'two' }, K.field('Producer', inp('producer')), K.field('Vintage', inp('vintage', { inputmode: 'numeric', placeholder: '2021 or NV' }))),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Colour'), K.seg(K.COLOURS, f.colour, (v) => { f.colour = v; K.render(); }, { class: 'seg wrap-seg' })),
      h('div', { class: 'two' }, K.field('Grapes', inp('grapes', { placeholder: 'Mavrud' })), K.field('Style', inp('style', { placeholder: 'dry, full-bodied' }))),
      h('div', { class: 'two' }, K.field('Region', inp('region', { placeholder: 'Thracian Valley' })), K.field('Country', inp('country'))),
      h('div', { class: 'two' }, K.field('Bottle price', inp('bottlePrice', { inputmode: 'decimal' })),
        h('label', { class: 'check big' }, h('input', { type: 'checkbox', checked: f.byGlass, onchange: (e) => { f.byGlass = e.target.checked; K.render(); } }), h('span', null, 'Sold by the glass'))),
      f.byGlass ? h('div', { class: 'two' }, K.field('Glass price', inp('glassPrice', { inputmode: 'decimal' })), K.field('Glass size (cl)', inp('glassCl', { inputmode: 'decimal', placeholder: '15' }))) : null,
      K.field('What to say at the table', area('say', 3, 'One or two sentences to sell it.')),
      K.field('Nose', area('nose', 2, 'Dark cherry, plum, a little smoke')),
      K.field('Palate', area('palate', 2, 'Firm tannins, fresh acidity, long finish')),
      K.field('The story', area('story', 3, 'The producer, the place, the grape.')),
      K.field('Good to know', area('facts', 3, 'One fact per line'), 'One per line. They also go into the quiz.'),
      h('div', { class: 'two' }, K.field('Serve at', inp('serve', { placeholder: '16–18 °C' })), K.field('Glass', inp('glass', { placeholder: 'Bordeaux glass' }))),
      K.field('Decanting', inp('decant', { placeholder: '30 minutes before' })),
      h('div', { class: 'field' }, h('span', { class: 'legend' }, 'Goes with'),
        dishes.length ? h('div', { class: 'check-list' }, dishes.map((d) => h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: f.pairs.includes(d.id), onchange: (e) => { f.pairs = e.target.checked ? f.pairs.concat([d.id]) : f.pairs.filter((x) => x !== d.id); } }),
          h('span', null, d.name)))) : h('p', { class: 'hint' }, 'No dishes in the food bible yet.')),
      h('div', { class: 'two' }, K.field('Keep at least (bottles)', inp('par', { inputmode: 'numeric' }), 'Below this it shows as Low.'), K.field('Order on the list', inp('order', { inputmode: 'numeric' }))),
      h('label', { class: 'check big' }, h('input', { type: 'checkbox', checked: f.off, onchange: (e) => { f.off = e.target.checked; } }), h('span', null, 'Off the list (kept, not offered)')),
      h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'submit', disabled: !!S.busy }, 'Save'),
        w ? h('button', { class: 'btn danger', type: 'button', onclick: () => {
          if (!S.sure) { S.sure = true; K.render(); return; }
          K.deleteWine(w.id); ui.sheet = null; K.go('wine'); K.toast(w.name + ' deleted');
        } }, S.sure ? 'Tap again to delete' : 'Delete') : null)), { wide: true });
  };

  /* ---------- the example wines (device copy, or a new floor book) ---------- */
  K.loadExamples = function () {
    const docs = K.floorSeed(), paths = Object.keys(docs).filter((p) => /^(wines|dishnotes|glossary|quizq)\//.test(p) && !(p.startsWith('wines/') && K.wine(p.slice(6))));
    Promise.all(paths.map((p) => K.db.doc(p).set(docs[p]))).then(() => K.toast('The example wines are in'), K.writeFailed);
  };
  K.removeExamples = function () {
    const paths = [];
    D.wines.forEach((w) => { if (w.example) paths.push('wines/' + w.id); });
    Object.keys(D.notes).forEach((id) => { if (D.notes[id].example) paths.push('dishnotes/' + id); });
    Object.keys(D.gloss).forEach((id) => { if (D.gloss[id].example) paths.push('glossary/' + id); });
    D.quizq.forEach((q) => { if (q.example) paths.push('quizq/' + q.id); });
    Promise.all(paths.map((p) => K.db.doc(p).delete())).then(() => K.toast(paths.length + ' examples removed'), K.writeFailed);
  };
})();
