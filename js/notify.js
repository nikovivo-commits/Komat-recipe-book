/* Notifications: a new event, or a new week of The Brigade.
   In the app: a notice at the top of Today and a dot on the tab until you have looked.
   On the phone: push notifications, once the phone says yes (an iPhone only asks when Komat is opened from
   the Home Screen). Each phone that said yes keeps its address in pushsubs/{uid}; a small job
   (tools/notify/send.mjs) looks for new events and weeks every few minutes and sends the pushes.
   An event counts as new when it is added, and again when a chef taps "Notify the team" on it. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  /* the public half of the key the pushes are signed with (the private half is a secret of the sending job) */
  const VAPID = 'BC85jaVS08C44ojYHcP6rADTpkau3aynlN3p8qY0J8L8Ydqrx-gPM8JoyHGi-62PAzrMQUeNqEofC71IUUREZiw';

  /* ---------- in the app ---------- */
  /* news counts from the first time this phone opened the app with this feature, so nobody gets a pile at once */
  const since = () => { let t = K.store.get('newsSince', 0); if (!t) { t = Date.now(); K.store.set('newsSince', t); } return t; };
  const stamp = (e) => Math.max(+e.created || 0, +e.announce || 0);
  K.newEvents = function () {
    if (!D.loaded) return [];
    const s = since(), seen = K.store.get('seenEv', {});
    return K.upcomingEvents().filter((e) => e.status !== 'cancelled' && stamp(e) > s && (seen[e.id] || 0) < stamp(e));
  };
  K.newWeeks = function () {
    const wks = Object.keys(D.weeks || {}).sort();
    if (!D.loaded || !wks.length) return [];
    let s = K.store.get('seenWk', null);
    if (s === null) { s = wks[wks.length - 1]; K.store.set('seenWk', s); }
    return wks.filter((w) => w > s && w >= K.thisWeek());
  };
  const markEvents = () => { const n = K.newEvents(); if (!n.length) return; const seen = K.store.get('seenEv', {}); n.forEach((e) => { seen[e.id] = stamp(e); }); K.store.set('seenEv', seen); };
  const markWeeks = () => { const n = K.newWeeks(); if (n.length) K.store.set('seenWk', n[n.length - 1]); };
  const wkRange = (wk) => {
    const a = K.parseYmd(wk), b = new Date(a); b.setDate(b.getDate() + 6);
    const m = (d) => d.toLocaleDateString('en-GB', { month: 'short' });
    return a.getDate() + (m(a) === m(b) ? '' : ' ' + m(a)) + '–' + b.getDate() + ' ' + m(b);
  };

  /* looking at the page is what clears the notice */
  ['events', 'schedule'].forEach((v) => {
    const page = K.V[v];
    K.V[v] = function () { const r = page.apply(this, arguments); if (v === 'events') markEvents(); else markWeeks(); return r; };
  });
  const today = K.V.today;
  K.V.today = function () {
    const r = today.apply(this, arguments), w = r && r.body && r.body.querySelector('.wrap.today'), box = newsBox();
    if (w && box) w.prepend(box);
    return r;
  };

  function newsBox() {
    const evs = K.newEvents(), wks = K.newWeeks(), ask = pushAsk();
    if (!evs.length && !wks.length && !ask) return null;
    return h('section', { class: 'news', 'aria-label': 'News' },
      wks.map((wk) => h('button', { type: 'button', class: 'news-item wk', onclick: () => { ui.week = wk; ui.schedView = 'mine'; K.go('schedule'); } },
        K.icon('rota'), h('span', null, h('b', null, 'The Brigade for ' + wkRange(wk) + ' is out'), h('span', null, 'Check your shifts')), K.icon('next'))),
      evs.map((e) => h('button', { type: 'button', class: 'news-item ev', onclick: () => { ui.calSel = e.date; ui.calMonth = e.date.slice(0, 7); K.go('events'); } },
        K.icon('event'), h('span', null, h('b', null, (+e.announce > +e.created ? 'Event: ' : 'New event: ') + (e.title || 'Event')),
          h('span', null, [K.prettyDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' }), e.guests ? e.guests + ' guests' : '', 'check it out'].filter(Boolean).join(' · '))), K.icon('next'))),
      ask);
  }

  /* ---------- on the phone ---------- */
  const iOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const homeScreen = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const canPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  let checking = false;
  /* none (no cloud / not signed in / no support), install (an iPhone in Safari), blocked, checking, off or on */
  K.pushState = function () {
    if (K.mode !== 'firebase' || !K.me.id) return 'none';
    if (!canPush()) return iOS() && !homeScreen() ? 'install' : 'none';
    if (Notification.permission === 'denied') return 'blocked';
    if (ui.pushOn === undefined) { check(); return 'checking'; }
    return ui.pushOn ? 'on' : 'off';
  };
  function check() {
    if (checking) return; checking = true;
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => {
      ui.pushOn = !!s && Notification.permission === 'granted';
      if (ui.pushOn) save(s).catch(() => {}); /* the phone may have renewed its address */
      K.render();
    }, () => { ui.pushOn = false; K.render(); });
  }
  const key = (s) => { const raw = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
  function save(s) {
    const j = s.toJSON();
    return K.db.doc('pushsubs/' + K.me.id).set({ endpoint: j.endpoint, keys: { p256dh: j.keys.p256dh, auth: j.keys.auth }, name: K.me.name || '', at: Date.now() });
  }
  K.pushOn = function () {
    ui.pushBusy = true; K.render();
    Notification.requestPermission().then((p) => {
      if (p !== 'granted') throw new Error(p);
      return navigator.serviceWorker.ready;
    }).then((r) => r.pushManager.getSubscription().then((s) => s || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(VAPID) })))
      .then(save).then(() => { ui.pushOn = true; ui.pushBusy = false; K.render(); K.toast('Notifications on'); }, () => {
        ui.pushBusy = false; K.render();
        K.toast(Notification.permission === 'denied' ? 'Notifications are blocked for Komat in the phone’s settings' : 'Could not turn notifications on. Try again in a moment.');
      });
  };
  K.pushOff = function () {
    ui.pushBusy = true; K.render();
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => s && s.unsubscribe())
      .then(() => K.db.doc('pushsubs/' + K.me.id).delete()).then(() => { ui.pushOn = false; ui.pushBusy = false; K.render(); K.toast('Notifications off'); },
        () => { ui.pushBusy = false; K.render(); K.toast('Could not turn notifications off'); });
  };

  /* the one-time ask on Today */
  function pushAsk() {
    const st = K.pushState();
    if (K.store.get('pushAsked', false) || !(st === 'off' || st === 'install')) return null;
    const later = () => { K.store.set('pushAsked', true); K.render(); };
    if (st === 'install') {
      return h('div', { class: 'news-ask' }, K.icon('bell'), h('span', null, h('b', null, 'Get a notification for new events and The Brigade'),
        h('span', null, 'On an iPhone: tap Share, then Add to Home Screen, and open Komat from there. Then turn them on in Settings.')),
        h('button', { type: 'button', class: 'btn small', onclick: later }, 'OK'));
    }
    return h('div', { class: 'news-ask' }, K.icon('bell'), h('span', null, h('b', null, 'Get a notification for new events and The Brigade'),
      h('span', null, 'Your phone buzzes when an event is added or next week is out.')),
      h('div', { class: 'btns' },
        h('button', { type: 'button', class: 'btn small primary', disabled: !!ui.pushBusy, onclick: () => { K.store.set('pushAsked', true); K.pushOn(); } }, ui.pushBusy ? 'Turning on…' : 'Turn on'),
        h('button', { type: 'button', class: 'btn small', onclick: later }, 'Not now')));
  }

  /* the row in Settings */
  K.pushRow = function () {
    const st = K.pushState();
    if (st === 'none') return null;
    const txt = {
      install: 'On an iPhone, add Komat to the Home Screen (Share, then Add to Home Screen) and open it from there to turn them on.',
      blocked: 'Blocked for Komat in the phone’s settings. Allow notifications there, then come back.',
      checking: 'Checking this phone…',
      off: 'Off on this phone. Turn on to get a buzz when an event is added or next week of The Brigade is out.',
      on: 'On for this phone: new events and each new week of The Brigade.',
    }[st];
    return h('div', { class: 'set-row' }, h('div', null, h('b', null, 'Notifications'), h('span', { class: 'muted' }, txt)),
      st === 'on' ? h('button', { class: 'btn small', type: 'button', disabled: !!ui.pushBusy, onclick: K.pushOff }, 'Turn off')
        : st === 'off' ? h('button', { class: 'btn small primary', type: 'button', disabled: !!ui.pushBusy, onclick: K.pushOn }, ui.pushBusy ? 'Turning on…' : 'Turn on') : null);
  };

  /* "Notify the team" on an event: the chefs can send it again (or for an event added before notifications) */
  K.notifyTeamBtn = function (e) {
    if (!K.me.admin || K.mode !== 'firebase' || e.status === 'cancelled' || K.daysUntil(e.date) < 0) return null;
    const sent = +e.announce || 0, arm = ui.notifyArm === e.id;
    return h('div', { class: 'evt-notify' },
      sent ? h('span', { class: 'muted' }, 'Team notified ' + (K.hm ? K.hm(sent) : '') + (K.ymd(new Date(sent)) !== K.ymd(new Date()) ? ', ' + new Date(sent).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '')) : null,
      h('button', { class: 'btn small', type: 'button', onclick: () => {
        if (!arm) { ui.notifyArm = e.id; K.render(); return; }
        ui.notifyArm = null;
        const body = K.clone(e); delete body.id; body.announce = Date.now(); if (!body.created) body.created = +e.createdAt || +e.updated || Date.now();
        K.saveEvent(e.id, body).then(() => K.toast('The team gets a notification in the next few minutes'));
      } }, K.icon('bell'), arm ? 'Tap again to send to everyone' : sent ? 'Notify again' : 'Notify the team'));
  };
})();
