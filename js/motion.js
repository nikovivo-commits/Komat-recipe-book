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
