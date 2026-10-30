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
  K.doMark = function (draw) {
    const s = document.createElement('span');
    s.className = 'domark' + (draw && !reduced() ? ' draw' : '');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<svg viewBox="0 0 50 34" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">' +
      DO_PATHS.map((d, i) => '<path pathLength="1" style="--i:' + i + '" d="' + d + '"/>').join('') + '</svg>';
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
