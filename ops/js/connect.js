/* Komat Back Office: outside connections.
 *  - Gmail (through the viewer's claude.ai Gmail connector): send orders, save drafts, read supplier mail.
 *  - File saves (claude.ai downloads, or a plain browser download when standalone).
 * Everything here is optional: the app works without it and falls back to copy / email-app links. */
(function (root) {
  'use strict';

  const GMAIL = 'Gmail';
  const DRIVE = 'Google Drive';
  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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
    driveMissing: false,

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
        const self = this;
        const has = async function (server) {
          try {
            const list = await self.mcp.listTools(server);
            return ((list && list.servers) || []).some(function (s) { return s.server === server && (s.tools || []).length; });
          } catch (e) {
            return true; // unknown: let the first call decide
          }
        };
        const found = await Promise.all([has(GMAIL), has(DRIVE)]);
        this.gmailMissing = !found[0];
        this.driveMissing = !found[1];
      }
    },

    gmail: function () { return this.state === 'ready' && !this.gmailMissing; },
    drive: function () { return this.state === 'ready' && !this.driveMissing; },

    /** A Google Sheet as an Excel file: resolves {content (base64), title}. */
    sheetAsXlsx: async function (fileId, refresh) {
      const cache = { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 };
      if (refresh) cache.refresh = true;
      const res = await this.mcp.callTool(DRIVE, 'download_file_content', { fileId: fileId, exportMimeType: XLSX_MIME }, { cache: cache });
      const p = (res && res.payload) || {};
      if (!p.content) throw { code: 'tool_error', message: 'Google Drive sent no file content.' };
      return { content: p.content, title: p.title || '' };
    },

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

    /** Viewer-facing explanation for a connector failure. kind: 'read' | 'write'. */
    explain: function (err, kind, server) {
      const name = server || GMAIL;
      const code = (err && err.code) || 'upstream_error';
      switch (code) {
        case 'needs_reauth':
          return { code: code, text: name + ' needs to be reconnected. In claude.ai open Settings → Connectors and reconnect ' + name + '.' };
        case 'server_not_connected':
        case 'server_not_found':
          return { code: code, text: name + ' is not connected for you. Add ' + name + ' in claude.ai Settings → Connectors, then reload this page.' };
        case 'selection_required':
          return { code: code, text: 'You have more than one ' + name + ' account connected. Pick the business account when claude.ai asks, then try again.' };
        case 'not_in_manifest':
        case 'approval_required':
        case 'consent_required':
          return { code: code, allow: true, text: 'This page is not allowed to use your ' + name + ' yet.' };
        case 'blocked_by_policy':
          return { code: code, text: 'Your organization does not allow ' + name + ' here.' };
        case 'tool_error':
          return { code: code, text: name + ' refused: ' + ((err && err.message) || 'unknown reason') };
        case 'not_granted':
        case 'capability_disabled':
        case 'capability_removed':
          return { code: code, text: name + ' is not available in this view. Open the page on claude.ai to use it.' };
        default:
          return kind === 'write'
            ? { code: code, unsure: true, text: name + ' did not confirm. Check your Gmail Sent folder before sending again.' }
            : { code: code, retry: true, text: name + ' did not answer. Try again in a minute.' };
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
