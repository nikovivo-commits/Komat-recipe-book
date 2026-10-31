/* Motion: the small animations that make the app feel smooth. Page changes cross-fade (a dish
   photo grows into its page), rows fold away when they are done, changed numbers roll into
   place, and highlight pills slide. Everything is skipped when the phone asks for less motion. */
(function () {
  'use strict';
  const K = window.K;
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  K.reducedMotion = reduced;

  /* a page change: a dish photo grows into its page as a view transition (Chrome, Safari 18).
     A view transition swallows taps while it runs, so every other page just fades in, and a
     tap during the photo morph finishes it at once. */
  let running = null;
  document.addEventListener('pointerdown', () => { if (running) running.skipTransition(); }, true);
  K.transition = function (update) {
    if (reduced()) { update(); return; }
    if (!K.ui.morph || typeof document.startViewTransition !== 'function' || document.visibilityState !== 'visible') { K.ui.pageIn = true; update(); return; }
    try {
      const t = running = document.startViewTransition(() => { update(); K.ui.morph = false; });
      t.finished.then(() => { if (running === t) running = null; }, () => { if (running === t) running = null; });
    } catch (e) { update(); }
  };

  /* name the photo that was tapped, so it grows into the photo on the next page */
  K.morphFrom = function (el) {
    if (!el || reduced()) return;
    const img = el.matches('img') ? el : el.querySelector('img');
    if (!img) return;
    img.style.viewTransitionName = 'k-hero';
    K.ui.morph = true;
    setTimeout(() => { K.ui.morph = false; }, 900);
  };
  K.morphTo = function (img) {
    if (img && K.ui.morph) img.style.viewTransitionName = 'k-hero';
    return img;
  };

  /* fold a row away, then run what removes it, so the list closes the gap smoothly */
  K.foldAway = function (row, then, delay) {
    if (!row || !row.isConnected || reduced()) { then(); return; }
    /* the gap to the next row closes too: a list with a gap pulls the row's margin in */
    const gap = parseFloat(getComputedStyle(row.parentNode).rowGap) || 0, last = !row.nextElementSibling;
    row.style.height = row.offsetHeight + 'px';
    row.classList.add('folding');
    void row.offsetHeight;
    setTimeout(() => {
      row.style.height = '0px';
      row.style.opacity = '0';
      if (gap) row.style[last ? 'marginTop' : 'marginBottom'] = -gap + 'px';
    }, delay || 0);
    setTimeout(then, (delay || 0) + 240);
  };

  /* numbers that changed roll up into place, one after another */
  K.rollNumbers = function (oldTexts, els) {
    if (reduced()) return;
    Array.prototype.forEach.call(els, (el, i) => {
      const was = oldTexts[i], now = el.textContent;
      if (!was || was === now) return;
      el.dataset.old = was;
      el.textContent = '';
      el.append(K.h('span', null, now));
      el.style.setProperty('--d', Math.min(i, 12) * 28 + 'ms');
      el.classList.add('roll');
    });
  };

  /* the + button on Today steps aside while the list scrolls down, back on the way up */
  let lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY, d = y - lastY;
    if (Math.abs(d) < 10 && y > 120) return;
    document.body.classList.toggle('fab-away', d > 0 && y > 120);
    lastY = y;
  }, { passive: true });

  /* a short film clip behind a screen. One element per clip is kept, so a redraw does not restart
     it; it plays once, fades down and stays still. Nothing loads when motion or data is saved. */
  const clips = {};
  K.clip = function (name, cls) {
    const sd = navigator.connection && navigator.connection.saveData;
    if (reduced() || sd) return null;
    let v = clips[name];
    if (!v) {
      v = clips[name] = K.h('video', { muted: '', playsinline: '', preload: 'auto', 'aria-hidden': 'true', tabindex: '-1' });
      v.muted = true; v.setAttribute('playsinline', '');
      ['webm', 'mp4'].forEach((x) => { const s = document.createElement('source'); s.src = 'assets/motion/' + name + '.' + x; s.type = 'video/' + x; v.append(s); });
      v.addEventListener('ended', () => v.classList.add('rested'));
    }
    v.className = 'clip ' + (cls || '') + (v.ended ? ' rested' : '');
    if (!v.ended) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    return v;
  };

  /* a full-screen moment: the clip plays over the page for a few seconds, then fades away */
  K.flash = function (name, ms) {
    const sd = navigator.connection && navigator.connection.saveData;
    if (reduced() || sd) return;
    const v = document.createElement('video');
    v.className = 'flash'; v.muted = true; v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    ['webm', 'mp4'].forEach((x) => { const s = document.createElement('source'); s.src = 'assets/motion/' + name + '.' + x; s.type = 'video/' + x; v.append(s); });
    const gone = () => { v.classList.remove('on'); setTimeout(() => v.remove(), 600); };
    v.addEventListener('ended', gone); v.addEventListener('error', () => v.remove(), true);
    document.body.append(v);
    const p = v.play(); if (p && p.catch) p.catch(() => v.remove());
    requestAnimationFrame(() => v.classList.add('on'));
    setTimeout(gone, ms || 3500);
  };

  /* DO, written by hand in Sharpie. Fresh marks are drawn stroke by stroke, like on the paper sheet */
  const DO_PATHS = [
    'M9.5 6.5c-.3 6.8-.1 13.6.2 20.6',
    'M8.6 7.4c6.4-2.3 13.2.1 14.4 7.3 1.1 6.6-4.1 11.6-13.9 12.6',
    'M35.6 6.8c-6.3.3-9.1 6.7-8.4 12 .7 5.3 4.4 8.6 9.1 7.9 5.2-.8 7.9-6.3 7.1-11.7-.7-4.8-4-8.6-9-7.6-1.6.4-2.8 1.3-3.6 2.4',
    'M4.5 31.2c11.4-1.9 25.5-2.3 41.3-.6',
  ];
  /* the letters of the box words, one stroke each, drawn like the DO above (y 6 to 27) */
  const GLYPH = {
    D: [17, 'M1.5 6.5c-.3 6.8-.1 13.6.2 20.6', 'M.6 7.4c6.4-2.3 13.2.1 14.4 7.3 1.1 6.6-4.1 11.6-13.9 12.6'],
    O: [18, 'M8.6 6.8c-6.3.3-9.1 6.7-8.4 12 .7 5.3 4.4 8.6 9.1 7.9 5.2-.8 7.9-6.3 7.1-11.7-.7-4.8-4-8.6-9-7.6-1.6.4-2.8 1.3-3.6 2.4'],
    P: [16, 'M2 27c-.2-7-.3-13.6.1-20.4', 'M1.2 7.2c6.6-1.8 13.2.2 13.2 5.6 0 5.2-5.6 7.4-12.9 6.6'],
    T: [17, 'M0 7.4c5.4-1 10.8-1.2 16.2-.2', 'M8.2 7.4c-.4 6.4-.2 13.2.2 19.6'],
    C: [16, 'M14.6 10.2c-2.6-3.8-8.4-4.4-11.6-.8-3.2 3.6-3 10.4.4 14 3.2 3.2 8.8 3 11.4-1.2'],
    H: [16, 'M2 6.6c.2 6.8.1 13.6-.1 20.4', 'M14 6.4c.2 6.8.2 13.8 0 20.6', 'M2 16.8c4-.6 8-.8 12-.2'],
    E: [16, 'M2 6.8c-.2 6.8-.1 13.4.1 20.2', 'M2.2 7.2c4-.8 8.2-.8 12.6-.2', 'M2.4 16.4c3.4-.5 6.8-.5 10-.2', 'M2.2 26.8c4.4-.6 8.8-.6 13 0'],
    F: [15, 'M2 6.8c-.2 6.8-.1 13.4.1 20.2', 'M2.2 7.2c4-.8 8.2-.8 12.6-.2', 'M2.4 16.4c3.4-.5 6.8-.5 10-.2'],
    K: [16, 'M2 6.6c.2 6.8.1 13.6-.1 20.4', 'M14.6 6.6c-4.2 3.2-8.2 6.2-12.6 9.4', 'M5.6 14.4c3.4 3.6 6.8 8.2 9.4 12.6'],
    R: [16, 'M2 27c-.2-7-.3-13.6.1-20.4', 'M1.2 7.2c6.6-1.8 13.2.2 13.2 5.6 0 5.2-5.6 7.4-12.9 6.6', 'M7.4 19.6c2.4 2.6 4.6 5 7 7.6'],
    I: [13, 'M3.6 7c3-.4 6-.4 8.8 0', 'M3.6 26.8c3 .4 6 .4 8.8 0', 'M8 7.2c.2 6.6.1 13.2-.1 19.6'],
    N: [17, 'M2 27c-.2-7-.3-13.6.1-20.4', 'M2.2 7c4.2 5.8 8.8 12 12 19.8', 'M14.4 26.6c.2-6.6.2-13.4 0-20.2'],
    V: [17, 'M1 6.6c3.6 6.8 7.2 13.8 7.6 20.4', 'M8.6 27c2.4-7 4.6-13.6 7-20.4'],
    A: [17, 'M.6 27c2.4-7 4.6-13.8 7.2-20.6', 'M7.8 6.4c2.6 6.8 5 13.8 7.4 20.6', 'M3.8 18.6c3.4-.6 6.8-.6 9.8-.2'],
  };
  function wordSvg(word) {
    let x = 4, paths = '';
    word.split('').forEach((ch) => {
      const g = GLYPH[ch];
      if (!g) return;
      paths += '<g transform="translate(' + x + ' 0)">' + g.slice(1).map((d, i) => '<path pathLength="1" style="--i:' + i + '" d="' + d + '"/>').join('') + '</g>';
      x += g[0] + 3;
    });
    const w = x + 2;
    return '<svg viewBox="0 0 ' + w.toFixed(0) + ' 34" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
  }
  K.doMark = function (draw, kind, hand) {
    const s = document.createElement('span');
    const ks = (Array.isArray(kind) ? kind : kind ? [kind] : []).filter((c) => c !== 'do');
    if (ks.length) {
      /* OPT, CHECK, DEF, PORTION, VAC: the same marker strokes and underline as DO, one word under the other */
      s.className = 'domark words n' + Math.min(ks.length, 3);
      s.setAttribute('aria-hidden', 'true');
      K.kindWords(ks).forEach((w) => s.insertAdjacentHTML('beforeend', wordSvg(w)));
      return s;
    }
    s.className = 'domark' + (draw && !reduced() ? ' draw' : '');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<svg viewBox="0 0 50 34" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">' +
      DO_PATHS.map((d, i) => '<path pathLength="1" style="--i:' + i + '" d="' + d + '"/>').join('') + '</svg>';
    return s;
  };

  /* ready: the word in the box (DO, OPT or CHECK) crossed out with one Sharpie stroke, like on the paper sheet */
  K.doneMark = function (kind, hand, draw) {
    const s = document.createElement('span');
    s.className = 'donemark' + (draw && !reduced() ? ' draw' : '');
    s.setAttribute('aria-hidden', 'true');
    s.append(K.doMark(false, K.kindsOf({ k: kind }), hand));
    const x = document.createElement('span');
    x.className = 'strike';
    x.innerHTML = '<svg viewBox="0 0 60 20" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"><path pathLength="1" d="M2 13.5c12-3.2 28-6.4 56-8.6"/></svg>';
    s.append(x);
    return s;
  };

  /* a highlight pill that slides to the chosen button of a group */
  K.placePill = function (pill, btn, animate) {
    if (!pill) return;
    if (!btn) { pill.style.opacity = '0'; return; }
    if (!animate || reduced()) pill.style.transition = 'none';
    pill.style.opacity = '1';
    pill.style.width = btn.offsetWidth + 'px';
    pill.style.height = btn.offsetHeight + 'px';
    pill.style.transform = 'translate(' + btn.offsetLeft + 'px,' + btn.offsetTop + 'px)';
    if (!animate || reduced()) { void pill.offsetWidth; pill.style.transition = ''; }
  };
})();
