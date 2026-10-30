/* Markers: everyone writes on the sheet in their own Sharpie colour, picked the first time they
   open the app, so the kitchen can see who wrote a DO, crossed a line out or left a comment.
   Each mark keeps the colour it was written in. */
(function () {
  'use strict';
  const K = window.K, h = K.h;
  K.SHEETS = K.SHEETS || {};
  K.INKS = [
    { k: 'black', name: 'Black', light: '#1C1B1A', dark: '#ECEAE4' },
    { k: 'blue', name: 'Blue', light: '#1F48B8', dark: '#93B4FF' },
    { k: 'red', name: 'Red', light: '#B3261E', dark: '#FF8F86' },
    { k: 'green', name: 'Green', light: '#1E7A44', dark: '#7BD3A0' },
    { k: 'purple', name: 'Purple', light: '#6B3FA0', dark: '#C9A8F2' },
    { k: 'orange', name: 'Orange', light: '#C2570C', dark: '#FFB27A' },
    { k: 'teal', name: 'Teal', light: '#0E7C86', dark: '#6FD6DE' },
    { k: 'pink', name: 'Pink', light: '#B83280', dark: '#F59AC9' },
  ];
  K.HANDS = [
    { k: 'caveat', name: 'Caveat' },
    { k: 'neucha', name: 'Neucha' },
    { k: 'marck', name: 'Marck Script' },
    { k: 'amatic', name: 'Amatic SC' },
    { k: 'pangolin', name: 'Pangolin' },
    { k: 'badscript', name: 'Bad Script' },
    { k: 'shantell', name: 'Shantell Sans' },
    { k: 'pacifico', name: 'Pacifico' },
    { k: 'comforter', name: 'Comforter Brush' },
    { k: 'underdog', name: 'Underdog' },
    { k: 'lobster', name: 'Lobster' },
    { k: 'wetpaint', name: 'Rubik Wet Paint' },
  ];
  const known = (k) => K.INKS.some((x) => x.k === k), knownHand = (k) => K.HANDS.some((x) => x.k === k);
  K.myHand = () => { const k = (K.me && K.me.hand) || K.store.get('hand', ''); return knownHand(k) ? k : ''; };
  K.handClass = (k) => 'hand-' + (knownHand(k) ? k : 'caveat');
  K.setHand = function (k) {
    if (!knownHand(k)) return;
    K.store.set('hand', k);
    if (K.me) K.me.hand = k;
    if (K.Fire && K.Fire.setHand && K.mode === 'firebase') K.Fire.setHand(k).catch(() => {});
    K.render();
  };
  K.myInk = () => { const k = (K.me && K.me.ink) || K.store.get('ink', ''); return known(k) ? k : ''; };
  K.inkClass = (k) => 'ink-' + (known(k) ? k : 'blue');

  K.setInk = function (k) {
    if (!known(k)) return;
    K.store.set('ink', k);
    if (K.me) K.me.ink = k;
    if (K.Fire && K.Fire.setInk && K.mode === 'firebase') K.Fire.setInk(k).catch(() => {});
    K.render();
  };

  /* who already writes in which colour (the kitchen's own database knows everyone) */
  function takenBy() {
    const out = {};
    Object.keys(K.D.members || {}).forEach((id) => { const m = K.D.members[id]; if (m && m.ink && id !== (K.me && K.me.id)) (out[m.ink] = out[m.ink] || []).push(m.name || ''); });
    return out;
  }
  K.SHEETS.ink = function (S) {
    const ink = K.myInk() || 'blue', hand = K.myHand() || 'caveat', taken = takenBy();
    const done = () => { if (!K.myInk()) K.setInk(ink); if (!K.myHand()) K.setHand(hand); K.ui.sheet = null; K.render(); K.toast('Your marker is ready', { tone: 'good' }); };
    const sample = (K.me && K.me.name ? K.me.name.split(' ')[0] + ': ' : '') + 'Defrost 4 lamb · дефростирай';
    const body = h('div', { class: 'inkpick ' + K.inkClass(ink) },
      h('p', { class: 'muted' }, S.first ? 'Pick your handwriting and your Sharpie colour. Every DO, crossed-out line and comment you write shows in them, so the next shift knows who wrote what.' : 'How your writing looks on the sheet.'),
      h('h3', { class: 'ink-h' }, 'Handwriting'),
      h('div', { class: 'hand-grid', role: 'radiogroup', 'aria-label': 'Handwriting' }, K.HANDS.map((x) => h('button', { type: 'button', role: 'radio', 'aria-checked': hand === x.k ? 'true' : 'false', 'aria-label': x.name, class: 'hand-opt ' + K.handClass(x.k), onclick: () => K.setHand(x.k) },
        h('span', { class: 'hand-sample' }, sample)))),
      h('h3', { class: 'ink-h' }, 'Colour'),
      h('div', { class: 'ink-grid', role: 'radiogroup', 'aria-label': 'Marker colour' }, K.INKS.map((x) => h('button', { type: 'button', role: 'radio', 'aria-checked': ink === x.k ? 'true' : 'false', class: 'ink-opt ' + K.inkClass(x.k), onclick: () => K.setInk(x.k) },
        h('span', { class: 'ink-cap', 'aria-hidden': 'true' }), h('b', null, x.name), taken[x.k] ? h('small', null, taken[x.k].filter(Boolean).join(', ')) : null))),
      h('button', { class: 'btn primary wide', type: 'button', onclick: done }, 'Done'));
    return K.sheet(S.first ? 'Pick your marker' : 'Your marker', body);
  };
  /* the first time someone is in the app, ask once */
  K.inkPrompt = function () {
    if (K.ui.sheet || K.ui.cook || K.ui.inkAsked || (K.myInk() && K.myHand())) return false;
    if (K.mode === 'firebase' && !(K.me && K.me.id)) return false;
    if (K.ui.auth) return false;
    K.ui.inkAsked = true;
    K.ui.sheet = { type: 'ink', first: true };
    return true;
  };
})();
