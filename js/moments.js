/* Moments: the few short scenes that mark something happening in the kitchen: a timer going
   off, an order leaving in its crate, a new kitchen day starting fresh, a station getting
   ready. Each one lasts a few seconds, never blocks a tap for long, and is skipped when the
   phone asks for reduced motion. */
(function () {
  'use strict';
  const K = window.K, h = K.h, ui = K.ui;
  const reduced = () => K.reducedMotion && K.reducedMotion();
  const later = (fn, ms) => setTimeout(fn, ms);

  /* a timer reaching zero: the screen pulses green, rings go out, a banner drops in with a swinging bell */
  K.timerDone = function (t) {
    if (reduced()) return;
    const veil = h('div', { class: 't-veil', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
    const banner = h('button', { type: 'button', class: 't-banner', 'aria-label': 'Dismiss the timer message', onclick: () => gone() },
      h('span', { class: 't-bell' }, K.icon('bell')),
      h('span', { class: 't-bt' }, h('b', null, 'Time!'), h('span', null, t.name || 'Timer')));
    const tray = document.getElementById('timers');
    if (tray) { tray.classList.remove('shake'); void tray.offsetWidth; tray.classList.add('shake'); later(() => tray.classList.remove('shake'), 900); }
    document.body.append(veil, banner);
    const gone = () => { banner.classList.add('out'); later(() => { banner.remove(); }, 320); };
    later(() => veil.remove(), 1500);
    later(gone, 4200);
  };

  /* the order leaves: its products drop into a crate, SENT lands on it */
  K.sentMoment = function (items, label) {
    if (reduced() || !items.length) return false;
    const names = items.slice(0, 4);
    const crate = h('img', { class: 'sm-crate', src: 'assets/motion/crate-b.webp', alt: '', draggable: 'false' });
    const cards = names.map((x, i) => h('span', { class: 'sm-card', style: { '--i': i, '--x': (i - (names.length - 1) / 2) * 56 + 'px' } },
      K.produceThumb ? K.produceThumb(x.n, 'sm-th') : null, h('b', null, x.n)));
    const back = h('div', { class: 'sent-moment', role: 'status', onclick: () => end() },
      h('div', { class: 'sm-stage' }, crate, cards, h('span', { class: 'sm-stamp' }, 'Sent')),
      h('p', { class: 'sm-msg' }, label || 'Order sent'));
    document.body.append(back);
    const end = () => { back.classList.add('out'); later(() => back.remove(), 380); };
    later(end, 700 + names.length * 330 + 1500);
    return true;
  };

  /* the first look at Today on a new kitchen day: night turns to sunrise and the list starts clean */
  K.freshDay = function () {
    const seen = K.store.get('seenDay', ''), today = K.day(0);
    if (seen === today) return;
    K.store.set('seenDay', today);
    if (!seen || reduced()) return;
    const back = h('div', { class: 'fresh-moment', role: 'status', onclick: () => end() },
      K.clip ? K.clip('sunrise', 'fm-clip') : null,
      h('span', { class: 'fm-sun', 'aria-hidden': 'true' }),
      /* yesterday's sheet, scribbled in Sharpie, gets screwed up and thrown away */
      h('div', { class: 'fm-paper', 'aria-hidden': 'true' }, h('b', null, 'Yesterday'), [72, 54, 80, 46, 66, 58].map((wd, i) => h('i', { style: { width: wd + '%', '--r': (i % 2 ? 1 : -1) * 1.5 + 'deg' } }))),
      h('div', { class: 'fm-in' },
        h('p', { class: 'fm-clock mono' }, h('span', { class: 'a' }, '03:59'), h('span', { class: 'b' }, '04:00')),
        h('h2', { class: 'fm-title' }, 'A fresh list'),
        h('p', { class: 'fm-line' }, 'Nothing carries over from yesterday.')));
    document.body.append(back);
    const end = () => { back.classList.add('out'); later(() => back.remove(), 500); };
    later(end, 3600);
  };

  /* a tiny burst around a button that was just ticked */
  K.sparks = function (el) {
    if (reduced() || !el) return;
    for (let i = 0; i < 8; i++) el.append(h('i', { class: 'spark', 'aria-hidden': 'true', style: { '--a': i * 45 + 'deg' } }));
    later(() => el.querySelectorAll('.spark').forEach((s) => s.remove()), 700);
  };

  /* a number counting up to its value */
  K.countUp = function (el, to, ms) {
    if (!el || reduced()) return;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / (ms || 900));
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1 && el.isConnected) requestAnimationFrame(step);
      else if (el.isConnected) el.textContent = String(to);
    };
    requestAnimationFrame(step);
  };
})();
