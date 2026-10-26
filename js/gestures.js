/* Touch gestures and small celebrations: swipeable rows, drag-to-close sheets, confetti. */
(function () {
  'use strict';
  const K = window.K, h = K.h;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* A row that can be swiped sideways. The row holds .sw-bg (what shows underneath) and
     .sw-in (the content that slides). opts.right / opts.left = {run} for each direction. */
  K.swipeable = function (row, opts) {
    const inner = row.querySelector('.sw-in');
    const th = opts.threshold || 76;
    let x0 = 0, y0 = 0, dx = 0, pid = null, axis = null, armed = false, swipedAt = 0;
    const reset = () => {
      inner.style.transition = 'transform .18s ease';
      inner.style.transform = '';
      row.classList.remove('sw-r', 'sw-l', 'sw-armed', 'dragging');
    };
    row.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('input, textarea, select, a')) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; pid = e.pointerId; axis = null; armed = false;
      inner.style.transition = 'none';
    });
    row.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!axis) {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
        axis = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y';
        if (axis === 'x') { try { row.setPointerCapture(pid); } catch (err) { /* not capturable */ } row.classList.add('dragging'); }
      }
      if (axis !== 'x') return;
      dx = mx;
      if ((dx > 0 && !opts.right) || (dx < 0 && !opts.left)) dx /= 4;
      inner.style.transform = 'translateX(' + dx + 'px)';
      row.classList.toggle('sw-r', dx > 0);
      row.classList.toggle('sw-l', dx < 0);
      const now = Math.abs(dx) > th;
      if (now !== armed) { armed = now; row.classList.toggle('sw-armed', armed); if (armed) K.vibrate(6); }
    });
    const end = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (axis !== 'x') return;
      swipedAt = Date.now();
      const go = dx > th && opts.right ? opts.right : dx < -th && opts.left ? opts.left : null;
      if (!go) { reset(); return; }
      inner.style.transition = 'transform .16s ease-out';
      inner.style.transform = 'translateX(' + (dx > 0 ? 110 : -110) + '%)';
      K.vibrate(12);
      setTimeout(() => { go.run(); reset(); }, 150);
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', (e) => { if (e.pointerId === pid) { pid = null; reset(); } });
    /* a swipe is not a tap: swallow the click that follows it */
    row.addEventListener('click', (e) => { if (Date.now() - swipedAt < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
    return row;
  };

  /* drag a bottom sheet down by its handle to close it */
  K.dragSheet = function (sheet, handle, onClose) {
    let y0 = 0, dy = 0, pid = null, t0 = 0;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      pid = e.pointerId; y0 = e.clientY; dy = 0; t0 = Date.now();
      try { handle.setPointerCapture(pid); } catch (err) { /* not capturable */ }
      sheet.style.transition = 'none';
    });
    handle.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      dy = Math.max(0, e.clientY - y0);
      sheet.style.transform = 'translateY(' + dy + 'px)';
    });
    const end = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      const fast = dy > 40 && dy / Math.max(1, Date.now() - t0) > 0.6;
      sheet.style.transition = 'transform .2s ease';
      if (dy > 110 || fast) { sheet.style.transform = 'translateY(100%)'; setTimeout(onClose, 170); }
      else sheet.style.transform = '';
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };

  /* confetti in the kitchen's colours, then a message */
  K.celebrate = function (msg) {
    if (msg) K.toast(msg, { tone: 'good' });
    K.vibrate([20, 40, 20]);
    if (reduced()) return;
    const c = h('canvas', { class: 'confetti', 'aria-hidden': 'true' });
    document.body.append(c);
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    const cx = c.getContext('2d');
    cx.scale(dpr, dpr);
    const colours = ['#E0AFA3', '#EDBE45', '#2E7A4E', '#C42F1C', '#2C6A98', '#F2F2EE', '#B8561F'];
    const bits = Array.from({ length: 130 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 13 - 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 6, h2: 8 + Math.random() * 8, c: colours[(Math.random() * colours.length) | 0],
    }));
    const t0 = performance.now();
    (function frame(t) {
      const age = t - t0;
      cx.clearRect(0, 0, W, H);
      bits.forEach((b) => {
        b.vy += 0.38; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        cx.save(); cx.translate(b.x, b.y); cx.rotate(b.r);
        cx.globalAlpha = Math.max(0, 1 - age / 1900);
        cx.fillStyle = b.c; cx.fillRect(-b.w / 2, -b.h2 / 2, b.w, b.h2 * Math.abs(Math.cos(b.r * 2)) + 2);
        cx.restore();
      });
      if (age < 1900) requestAnimationFrame(frame); else c.remove();
    })(t0);
  };
})();
