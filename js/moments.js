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
  /* a short film that plays once over the page; null when films are off (reduced motion, data saver) */
  function film(name) {
    if (reduced() || (navigator.connection && navigator.connection.saveData)) return null;
    const v = document.createElement('video');
    v.muted = true; v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    ['webm', 'mp4'].forEach((x) => { const so = document.createElement('source'); so.src = 'assets/motion/' + name + '.' + x; so.type = 'video/' + x; v.append(so); });
    return v;
  }
  /* yesterday's sheet goes in the bin: the film where it can play, a drawn paper ball where it can't */
  function binScene(back, label, then) {
    const v = film('bin');
    let done = false;
    const next = () => { if (done) return; done = true; back.classList.add('binned'); later(then, 450); };
    if (v) {
      v.className = 'bin-film';
      back.append(v, h('p', { class: 'bin-cap' }, label));
      v.addEventListener('ended', next);
      v.addEventListener('error', next, true);
      const p = v.play(); if (p && p.catch) p.catch(() => { v.remove(); paper(); });
      later(next, 6500);
    } else paper();
    function paper() {
      back.append(h('div', { class: 'fm-paper' }, h('b', null, 'Yesterday'), [72, 54, 80, 46, 66, 58].map((wd, i) => h('i', { style: { width: wd + '%', '--r': (i % 2 ? 1 : -1) * 1.5 + 'deg' } }))),
        h('p', { class: 'bin-cap' }, label));
      later(next, 1500);
    }
  }

  /* the first look at Today on a new kitchen day: yesterday's sheet goes in the bin, the sun comes up, a clean sheet */
  K.freshDay = function () {
    const seen = K.store.get('seenDay', ''), today = K.day(0);
    if (seen === today) return;
    K.store.set('seenDay', today);
    if (!seen || reduced()) return;
    const back = h('div', { class: 'fresh-moment binning', role: 'status', onclick: () => end() });
    document.body.append(back);
    let ended = false;
    const end = () => { if (ended) return; ended = true; back.classList.add('out'); later(() => back.remove(), 500); };
    binScene(back, (K.sheetDate ? K.sheetDate(seen) + ': ' : '') + 'yesterday’s sheet goes in the bin', () => {
      if (ended) return;
      back.classList.remove('binning');
      back.querySelectorAll('.bin-film, .bin-cap, .fm-paper').forEach((x) => x.remove());
      back.append(K.clip ? K.clip('sunrise', 'fm-clip') : '', h('span', { class: 'fm-sun', 'aria-hidden': 'true' }),
        h('div', { class: 'fm-in' },
          h('p', { class: 'fm-clock mono' }, h('span', { class: 'a' }, '03:59'), h('span', { class: 'b' }, '04:00')),
          h('h2', { class: 'fm-title' }, 'A fresh sheet'),
          h('p', { class: 'fm-date' }, K.sheetDate ? K.sheetDate(today) : ''),
          h('p', { class: 'fm-line' }, 'Nothing carries over from yesterday.')));
      later(end, 3600);
    });
  };

  /* closing: today's sheet goes in the bin, then whatever comes next (the lights going off) */
  K.tossSheet = function (then, day) {
    if (reduced()) { if (then) then(); return; }
    const back = h('div', { class: 'toss-moment binning', role: 'status' });
    document.body.append(back);
    binScene(back, (K.sheetDate ? K.sheetDate(day || K.day(0)) + ': ' : '') + 'today’s sheet goes in the bin', () => { back.classList.add('out'); later(() => back.remove(), 400); if (then) then(); });
  };

  /* the whiteboard is wiped: an eraser sweeps across and the writing smears away */
  K.wipeBoard = function (el) {
    if (reduced() || !el || !el.isConnected) return Promise.resolve();
    const er = h('span', { class: 'eraser', 'aria-hidden': 'true' });
    el.classList.add('wiping');
    el.querySelectorAll('.wb-line').forEach((l, i) => { l.style.animationDelay = (0.12 + i * 0.12) + 's'; });
    el.append(er);
    return new Promise((res) => later(() => { er.remove(); res(); }, 1500));
  };

  /* a tiny burst around a button that was just ticked */
  K.sparks = function (el) {
    if (reduced() || !el) return;
    for (let i = 0; i < 8; i++) el.append(h('i', { class: 'spark', 'aria-hidden': 'true', style: { '--a': i * 45 + 'deg' } }));
    later(() => el.querySelectorAll('.spark').forEach((x) => x.remove()), 700);
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
