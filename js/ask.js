/* Ask Claude: anyone who can write in the book types a question; the job that runs every minute
   (tools/notify/send.mjs + ask.mjs) answers it from the kitchen's recipes, prep, Brigade, orders and events,
   and the answer appears here (and as a notification). Questions live in boards/ as kind 'ask' for two weeks. */
(function () {
  'use strict';
  const K = window.K, h = K.h, D = K.D, ui = K.ui;
  const SEEN = 'komat.askSeen';
  const seenAt = () => { try { return +localStorage.getItem(SEEN) || 0; } catch (e) { return 0; } };
  const markSeen = () => { try { localStorage.setItem(SEEN, String(Date.now())); } catch (e) { /* private window */ } };

  /* the mark: a small burst of rays */
  K.askMark = function (cls) {
    const s = h('span', { class: 'ask-mark' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
    const rays = [];
    for (let i = 0; i < 10; i++) {
      const a = (i * 36 - 90) * Math.PI / 180, r1 = 2.6, r2 = i % 2 ? 8.2 : 10;
      rays.push('<path d="M' + (12 + r1 * Math.cos(a)).toFixed(2) + ' ' + (12 + r1 * Math.sin(a)).toFixed(2) + 'L' + (12 + r2 * Math.cos(a)).toFixed(2) + ' ' + (12 + r2 * Math.sin(a)).toFixed(2) + '"/>');
    }
    s.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">' + rays.join('') + '</svg>';
    return s;
  };

  K.canAsk = () => K.mode === 'firebase' && !!(K.me && K.me.id && K.me.canWrite !== false && !K.me.viewer);
  const mine = () => (D.asks || []).filter((a) => a.by === K.me.id).sort((a, b) => (a.at || 0) - (b.at || 0));
  K.askUnseen = () => K.canAsk() && mine().some((a) => a.status === 'done' && (a.doneAt || 0) > seenAt());

  /* the conversation shown: the one in use, or the last one if it is under three hours old */
  function thread() {
    if (ui.askThread) return ui.askThread;
    const last = mine().slice(-1)[0];
    ui.askThread = last && last.thread && (Date.now() - (last.at || 0)) < 3 * 3600e3 ? last.thread : 'th' + K.uid();
    return ui.askThread;
  }

  K.askOpen = function () { ui.sheet = { type: 'ask' }; K.render(); };

  function send(text) {
    const q = String(text || '').trim();
    if (!q) return;
    if (q.length > 2000) { K.toast('That is a bit long: keep it under 2000 letters.'); return; }
    const id = 'ask' + K.uid();
    const doc = { kind: 'ask', status: 'pending', q: q, by: K.me.id, name: K.me.name || '', thread: thread(), at: Date.now() };
    D.asks = (D.asks || []).concat([Object.assign({ id: id }, doc)]);
    ui.askDraft = '';
    const box = document.getElementById('ask-q'); if (box) box.value = '';
    K.render();
    K.db.doc('boards/' + id).set(doc).catch((e) => { D.asks = (D.asks || []).filter((a) => a.id !== id); ui.askDraft = q; K.render(); K.writeFailed(e); });
  }
  function retry(a) {
    a.status = 'pending'; delete a.error; K.render();
    K.db.doc('boards/' + a.id).update({ status: 'pending', error: '', at: Date.now() }).catch(K.writeFailed);
  }

  const IDEAS = ["What's on tomorrow's prep?", 'Who is on hot this Saturday?', 'How do we make the dolly cake?', 'Какво поръчахме вчера?'];

  function bubbles(list) {
    const out = [];
    list.forEach((a) => {
      out.push(h('div', { class: 'ask-row me' }, h('div', { class: 'ask-b me' }, h('p', null, a.q), h('span', { class: 'ask-t' }, K.hm(a.at || Date.now())))));
      if (a.status === 'done') {
        out.push(h('div', { class: 'ask-row' }, K.askMark('ask-av'),
          h('div', { class: 'ask-b' }, String(a.a || '').split(/\n{2,}/).map((p) => h('p', null, p)),
            h('div', { class: 'ask-foot' }, h('span', { class: 'ask-t' }, K.hm(a.doneAt || a.at)),
              h('button', { type: 'button', class: 'ask-copy', 'aria-label': 'Copy the answer', onclick: () => { (navigator.clipboard ? navigator.clipboard.writeText(a.a || '') : Promise.reject()).then(() => K.toast('Copied'), () => {}); } }, K.icon('copy'))))));
      } else if (a.status === 'failed') {
        out.push(h('div', { class: 'ask-row' }, K.askMark('ask-av'),
          h('div', { class: 'ask-b bad' }, h('p', null, 'I could not answer that' + (a.error ? ' (' + a.error + ')' : '') + '.'),
            h('button', { type: 'button', class: 'btn small', onclick: () => retry(a) }, 'Try again'))));
      } else {
        out.push(h('div', { class: 'ask-row' }, K.askMark('ask-av spin'),
          h('div', { class: 'ask-b wait' }, h('p', null, h('span', { class: 'ask-dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), ' Thinking… about a minute. You can close this: a notification comes when it is ready.'))));
      }
    });
    return out;
  }

  K.SHEETS.ask = function () {
    if (!K.canAsk()) { if (K.me && K.me.id) ui.sheet = null; return null; }
    markSeen();
    const th = thread(), list = mine().filter((a) => a.thread === th);
    const box = h('textarea', { id: 'ask-q', class: 'input ask-in', rows: 2, maxlength: 2000, placeholder: 'Ask about a recipe, the prep, the Brigade, orders…', 'aria-label': 'Your question',
      oninput: (e) => { ui.askDraft = e.target.value; },
      onkeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(e.target.value); } } });
    box.value = ui.askDraft || '';
    const body = h('div', { class: 'ask' },
      list.length ? null : h('div', { class: 'ask-hello' },
        K.askMark('ask-big'),
        h('p', null, 'Ask me anything about the kitchen book: recipes and amounts, today’s and tomorrow’s prep, who works when, what is ordered, the events. In Bulgarian or English.'),
        h('div', { class: 'ask-ideas' }, IDEAS.map((t) => h('button', { type: 'button', class: 'chip', onclick: () => send(t) }, t)))),
      h('div', { class: 'ask-log', 'aria-live': 'polite' }, bubbles(list)),
      h('div', { class: 'ask-bar' }, box,
        h('button', { type: 'button', class: 'btn primary ask-send', 'aria-label': 'Send', onclick: () => send(document.getElementById('ask-q').value) }, K.icon('send'))),
      list.length ? h('button', { type: 'button', class: 'btn ghost small ask-new', onclick: () => { ui.askThread = 'th' + K.uid(); ui.askDraft = ''; K.render(); } }, 'New question (start over)') : null,
      h('p', { class: 'hint ask-note' }, 'Claude reads the book and cannot change anything. Check allergens and amounts on the recipe when it matters.'));
    const s = K.sheet('Ask Claude', body, { wide: true });
    s.classList.add('ask-sheet');
    /* keep the newest message in view */
    const n = list.length + ':' + list.map((a) => a.status).join('');
    requestAnimationFrame(() => {
      const b = s.querySelector('.sheet-body');
      if (b && ui.askShown !== n) { b.scrollTop = b.scrollHeight; ui.askShown = n; }
    });
    return s;
  };
})();
