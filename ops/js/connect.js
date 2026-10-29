/* Komat Back Office: outside connections.
 *  - Gmail (through the viewer's claude.ai Gmail connector): send orders, save drafts, read supplier mail.
 *  - File saves (claude.ai downloads, or a plain browser download when standalone).
 * Everything here is optional: the app works without it and falls back to copy / email-app links. */
(function (root) {
  'use strict';

  const GMAIL = 'Gmail';

  function compact(obj) {
    const out = {};
    Object.keys(obj).forEach(function (k) {
      const v = obj[k];
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return;
      out[k] = v;
    });
    return out;
  }

  function emails(value) {
    return String(value || '').split(/[,;\s]+/).filter(function (e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); });
  }

  const connect = {
    mcp: null,
    downloads: null,
    state: 'checking', // 'checking' | 'ready' | 'off'
    gmailMissing: false, // the page may use Gmail, but this viewer has no Gmail connector

    start: async function () {
      const claude = root.claude;
      if (!claude || typeof claude.use !== 'function') { this.state = 'off'; return; }
      const results = await Promise.all([
        claude.use('mcp').catch(function () { return null; }),
        claude.use('downloads').catch(function () { return null; })
      ]);
      this.mcp = results[0];
      this.downloads = results[1];
      this.state = this.mcp ? 'ready' : 'off';
      if (this.mcp) {
        try {
          const list = await this.mcp.listTools(GMAIL);
          this.gmailMissing = !(list && list.servers || []).some(function (s) { return s.server === GMAIL && (s.tools || []).length; });
        } catch (e) {
          this.gmailMissing = false; // unknown: let the first call decide
        }
      }
    },

    gmail: function () { return this.state === 'ready' && !this.gmailMissing; },

    sendEmail: async function (msg) {
      const res = await this.mcp.callTool(GMAIL, 'send_message', compact({
        to: emails(msg.to), cc: emails(msg.cc), subject: msg.subject, body: msg.body
      }));
      return res && res.payload;
    },

    draftEmail: async function (msg) {
      const res = await this.mcp.callTool(GMAIL, 'create_draft', compact({
        to: emails(msg.to), cc: emails(msg.cc), subject: msg.subject, body: msg.body
      }));
      const p = (res && res.payload) || {};
      return { id: p.id || (p.draft && p.draft.id), url: p.viewUrl || (p.draft && p.draft.viewUrl) || 'https://mail.google.com/mail/u/0/#drafts' };
    },

    /** One-off search, used by "Connect Gmail" so the viewer gets asked for access. */
    search: async function (query) {
      const res = await this.mcp.callTool(GMAIL, 'search_threads', { query: query, pageSize: 12 });
      return res;
    },

    /** Live search: handler({ok, payload, storedAt} | {ok:false, error}). Returns unsubscribe. */
    watchSearch: function (query, handler) {
      if (!this.mcp) return function () {};
      return this.mcp.watchTool(GMAIL, 'search_threads', { query: query, pageSize: 12 }, function (ev) {
        if (ev.type === 'data') {
          handler({ ok: true, payload: ev.result && ev.result.payload, storedAt: ev.result && ev.result.cache ? ev.result.cache.storedAt : Date.now() });
        } else {
          handler({ ok: false, error: ev.error });
        }
      }, { refetchInterval: 5 * 60 * 1000, cache: { staleTime: 60 * 1000, gcTime: 30 * 60 * 1000 } });
    },

    /** Viewer-facing explanation for a Gmail failure. kind: 'read' | 'write'. */
    explain: function (err, kind) {
      const code = (err && err.code) || 'upstream_error';
      switch (code) {
        case 'needs_reauth':
          return { code: code, text: 'Gmail needs to be reconnected. In claude.ai open Settings → Connectors and reconnect Gmail.' };
        case 'server_not_connected':
        case 'server_not_found':
          return { code: code, text: 'Gmail is not connected for you. Add Gmail in claude.ai Settings → Connectors, then reload this page.' };
        case 'selection_required':
          return { code: code, text: 'You have more than one Gmail account connected. Pick the business account when claude.ai asks, then try again.' };
        case 'not_in_manifest':
        case 'approval_required':
        case 'consent_required':
          return { code: code, allow: true, text: 'This page is not allowed to use your Gmail yet.' };
        case 'blocked_by_policy':
          return { code: code, text: 'Your organization does not allow Gmail here.' };
        case 'tool_error':
          return { code: code, text: 'Gmail refused: ' + ((err && err.message) || 'unknown reason') };
        case 'not_granted':
        case 'capability_disabled':
        case 'capability_removed':
          return { code: code, text: 'Email is not available in this view. Open the page on claude.ai to use Gmail.' };
        default:
          return kind === 'write'
            ? { code: code, unsure: true, text: 'Gmail did not confirm. Check your Gmail Sent folder before sending again.' }
            : { code: code, retry: true, text: 'Gmail did not answer. Try again in a minute.' };
      }
    },

    /** Saves a text file. Resolves true when saved, false when the viewer declined. */
    saveFile: async function (filename, text, mime) {
      if (this.downloads) {
        try {
          await this.downloads.save({ filename: filename, data: text });
          return true;
        } catch (e) {
          if (e && e.code === 'declined') return false;
          throw e;
        }
      }
      if (root.claude && typeof root.claude.use === 'function' && root.parent !== root) {
        // Framed by claude.ai without the downloads grant: a link download would be blocked.
        throw { code: 'unavailable' };
      }
      const blob = new Blob([text], { type: mime || 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      return true;
    },

    emails: emails
  };

  root.KomatConnect = connect;
})(window);
