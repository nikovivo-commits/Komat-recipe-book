/* Kitchen timers. Durations written in a method step ("30 минути", "1 час", "10 min")
   become tap-to-start timers; running timers sit in a tray at the bottom of the screen,
   survive a reload, and ring and vibrate when they finish. Temperatures are picked out too. */
(function () {
  'use strict';
  const K = window.K, h = K.h;

  const UNIT = '(часа|часове|час|ч\\.|hours?|hrs?|h|минути|минута|мин\\.?|minutes?|mins?|секунди|секунда|сек\\.?|seconds?|secs?)';
  const NUM = '(\\d+(?:[.,]\\d+)?)';
  /* "10 минути", "10-12 min", "1,5 часа", "1 час и 30 минути" */
  const DUR = new RegExp(NUM + '(?:\\s*[-–]\\s*' + NUM + ')?\\s*' + UNIT + '(?![a-zа-я])', 'gi');
  const TEMP = /(\d+(?:[.,]\d+)?)\s*(?:°\s*[CС]?|градуса|degrees)(?![a-zа-я])/gi;

  function secondsOf(n, unit) {
    const u = unit.toLowerCase(), v = parseFloat(String(n).replace(',', '.'));
    if (/^(ч|час|hour|hr|h$)/.test(u) || u === 'h') return v * 3600;
    if (/^(сек|sec)/.test(u)) return v;
    return v * 60;
  }
  function label(sec) {
    if (sec >= 3600) { const hh = Math.floor(sec / 3600), mm = Math.round((sec % 3600) / 60); return hh + ' h' + (mm ? ' ' + mm + ' min' : ''); }
    if (sec >= 60) { const mm = Math.floor(sec / 60), ss = Math.round(sec % 60); return mm + ' min' + (ss ? ' ' + ss + ' s' : ''); }
    return Math.round(sec) + ' s';
  }
  K.timerLabel = label;

  /* split a step into text, timer and temperature pieces */
  K.stepPieces = function (text) {
    const hits = [];
    let m;
    DUR.lastIndex = 0;
    while ((m = DUR.exec(text))) {
      const sec = secondsOf(m[1], m[3]);
      if (sec >= 5 && sec <= 72 * 3600) hits.push({ i: m.index, j: m.index + m[0].length, kind: 'timer', sec: sec, text: m[0] });
    }
    TEMP.lastIndex = 0;
    while ((m = TEMP.exec(text))) {
      if (!hits.some((x) => m.index < x.j && m.index + m[0].length > x.i)) hits.push({ i: m.index, j: m.index + m[0].length, kind: 'temp', text: m[0] });
    }
    hits.sort((a, b) => a.i - b.i);
    const out = [];
    let at = 0;
    hits.forEach((x) => { if (x.i > at) out.push({ kind: 'text', text: text.slice(at, x.i) }); out.push(x); at = x.j; });
    if (at < text.length) out.push({ kind: 'text', text: text.slice(at) });
    return out;
  };
  /* render a step with its timers as buttons */
  K.stepNodes = function (text, ctx) {
    return K.stepPieces(text).map((p) => {
      if (p.kind === 'text') return p.text;
      if (p.kind === 'temp') return h('span', { class: 'temp' }, p.text);
      return h('button', {
        type: 'button', class: 'tchip', title: 'Start a ' + label(p.sec) + ' timer',
        onclick: (e) => { e.stopPropagation(); K.startTimer(p.sec, ctx || ''); },
      }, K.icon('timer'), p.text);
    });
  };

  /* ---------- running timers ---------- */
  let timers = K.store.get('timers', []).filter((t) => t.end > Date.now() - 3600 * 1000);
  let tick = null, audio = null, ringing = false;
  function save() { K.store.set('timers', timers); }
  K.timers = () => timers;
  K.startTimer = function (sec, name) {
    unlockAudio();
    timers.push({ id: K.uid(), name: name || 'Timer', total: sec, end: Date.now() + sec * 1000, paused: 0, done: false });
    save();
    K.toast('Timer started: ' + label(sec) + (name ? ' · ' + name : ''));
    paint();
  };
  function rem(t) { return t.paused ? Math.round(t.paused / 1000) : Math.max(0, Math.round((t.end - Date.now()) / 1000)); }
  function clock(s) { const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60; return (hh ? hh + ':' + String(mm).padStart(2, '0') : String(mm)) + ':' + String(ss).padStart(2, '0'); }
  function act(id, fn) { const t = timers.find((x) => x.id === id); if (t) fn(t); save(); paint(); }
  function unlockAudio() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) { audio = null; }
  }
  function beep() {
    if (!audio) return;
    try {
      const t0 = audio.currentTime;
      [0, 0.22, 0.44].forEach((d) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'square'; o.frequency.value = 1320;
        g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.16);
        o.connect(g); g.connect(audio.destination); o.start(t0 + d); o.stop(t0 + d + 0.18);
      });
    } catch (e) { /* no sound on this device */ }
  }
  let open = false;
  function paint() {
    let tray = document.getElementById('timers');
    if (!tray) { tray = h('div', { id: 'timers', class: 'timers' }); document.body.append(tray); }
    tray.textContent = '';
    if (!timers.length) { tray.hidden = true; clearInterval(tick); tick = null; return; }
    tray.hidden = false;
    let anyDone = false;
    timers.forEach((t) => { if (!t.paused && !t.done && t.end <= Date.now()) { t.done = true; save(); } if (t.done) anyDone = true; });
    if (anyDone && !ringing) { ringing = true; K.vibrate([300, 150, 300, 150, 300]); }
    if (!anyDone) ringing = false;
    if (anyDone && Math.floor(Date.now() / 1000) % 2 === 0) beep();
    const list = timers.slice().sort((a, b) => (b.done - a.done) || rem(a) - rem(b));
    const shown = open ? list : list.slice(0, 1);
    tray.classList.toggle('ring', anyDone);
    tray.append(h('div', { class: 'timers-in' },
      shown.map((t) => h('div', { class: 'timer' + (t.done ? ' done' : '') + (t.paused ? ' paused' : '') },
        h('div', { class: 'timer-txt' },
          h('b', { class: 'mono' }, t.done ? 'Time!' : clock(rem(t))),
          h('span', null, t.name)),
        t.done
          ? h('button', { type: 'button', class: 'tbtn solid', onclick: () => act(t.id, () => { timers = timers.filter((x) => x.id !== t.id); }) }, 'Stop')
          : [
            h('button', { type: 'button', class: 'tbtn', 'aria-label': 'Add one minute', onclick: () => act(t.id, (x) => { if (x.paused) x.paused += 60000; else x.end += 60000; }) }, '+1'),
            h('button', { type: 'button', class: 'tbtn', 'aria-label': t.paused ? 'Resume' : 'Pause', onclick: () => act(t.id, (x) => { if (x.paused) { x.end = Date.now() + x.paused; x.paused = 0; } else { x.paused = Math.max(1000, x.end - Date.now()); } }) }, K.icon(t.paused ? 'play' : 'pause')),
            h('button', { type: 'button', class: 'tbtn', 'aria-label': 'Cancel timer', onclick: () => act(t.id, () => { timers = timers.filter((x) => x.id !== t.id); }) }, K.icon('close')),
          ])),
      timers.length > 1 ? h('button', { type: 'button', class: 'timers-more', onclick: () => { open = !open; paint(); } }, open ? 'Show fewer' : '+' + (timers.length - 1) + ' more') : null));
    if (!tick) tick = setInterval(paint, 1000);
  }
  K.paintTimers = paint;
})();
