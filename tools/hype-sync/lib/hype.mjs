/* The browser side: a Chromium window with its own saved profile, signed in to Hype once by hand.
   It only ever reads: it opens report pages and downloads their exports. */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { formatDay } from './parse.mjs';

export class LoginError extends Error {
  constructor(msg = 'the Hype login has expired') { super(msg); this.name = 'LoginError'; }
}

/* Chromium forgets "until the browser closes" cookies when it closes, and a login is often exactly that kind.
   So the cookies are also kept in a file inside the profile folder and put back at every start. */
const cookieFile = (dir) => path.join(dir, 'hype-sync-cookies.json');

export async function openBrowser(cfg, dir, { headless }) {
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await chromium.launchPersistentContext(dir, { headless, acceptDownloads: true, viewport: headless ? { width: 1400, height: 900 } : null });
  ctx.setDefaultTimeout((cfg.timeoutSeconds || 60) * 1000);
  try {
    const saved = JSON.parse(fs.readFileSync(cookieFile(dir), 'utf8'));
    const have = new Set((await ctx.cookies()).map((c) => `${c.name}|${c.domain}|${c.path}`));
    const missing = saved.filter((c) => !have.has(`${c.name}|${c.domain}|${c.path}`));
    if (missing.length) await ctx.addCookies(missing);
  } catch { /* first start: nothing saved yet */ }
  return ctx;
}
export async function saveCookies(ctx, dir) {
  try { fs.writeFileSync(cookieFile(dir), JSON.stringify(await ctx.cookies())); } catch { /* the window is already gone */ }
}
export async function closeBrowser(ctx, dir) {
  await saveCookies(ctx, dir);
  await ctx.close().catch(() => {});
}

const abs = (cfg, u) => new URL(u, cfg.baseUrl).toString();
/* {from} {to} {date}: the day as the report wants it; {day}: YYYY-MM-DD */
function fill(s, rep, day) {
  if (typeof s !== 'string') return s;
  const d = formatDay(day, rep.paramDateFormat || 'YYYY-MM-DD');
  return s.replaceAll('{from}', d).replaceAll('{to}', d).replaceAll('{date}', d).replaceAll('{day}', day);
}
const isLoginUrl = (cfg, u) => !!cfg.loginUrlPattern && new RegExp(cfg.loginUrlPattern, 'i').test(u);
function checkNotAPage(cfg, buf, url, contentType) {
  const head = buf.subarray(0, 4000).toString('latin1').trimStart().toLowerCase();
  const html = /text\/html/i.test(contentType || '') || head.startsWith('<!doctype html') || head.startsWith('<html');
  if (!html) return;
  if (isLoginUrl(cfg, url) || /type=["']?password/.test(buf.toString('latin1').toLowerCase())) throw new LoginError();
  throw new Error(`Hype answered with a web page instead of the export (${url}). The report settings in config.json are probably not right.`);
}

/* Downloads one report for one day and returns its bytes. rep: the "sales" or "stock" block of config.json */
export async function download(ctx, cfg, rep, day) {
  if (rep.mode === 'click') return viaClick(ctx, cfg, rep, day);
  return viaRequest(ctx, cfg, rep, day);
}

/* the request the export button makes, sent directly with the browser's cookies */
async function viaRequest(ctx, cfg, rep, day) {
  const q = rep.request || {};
  if (!q.url) throw new Error('config.json: the report has no request.url');
  const url = abs(cfg, fill(q.url, rep, day));
  const headers = Object.fromEntries(Object.entries(q.headers || {}).map(([k, v]) => [k, fill(v, rep, day)]));
  const res = await ctx.request.fetch(url, {
    method: q.method || 'GET', headers, timeout: (cfg.timeoutSeconds || 60) * 1000,
    ...(q.body != null ? { data: fill(q.body, rep, day) } : {}),
    ...(q.form ? { form: Object.fromEntries(Object.entries(q.form).map(([k, v]) => [k, fill(String(v), rep, day)])) } : {}),
  });
  if (res.status() === 401 || res.status() === 403 || isLoginUrl(cfg, res.url())) throw new LoginError();
  const buf = await res.body();
  if (!res.ok()) throw new Error(`Hype answered ${res.status()} for ${url}`);
  checkNotAPage(cfg, buf, res.url(), res.headers()['content-type']);
  return buf;
}

/* open the report page, set the dates, press the export button, take the file */
async function viaClick(ctx, cfg, rep, day) {
  const c = rep.click || {};
  if (!c.url || !c.download) throw new Error('config.json: the report needs click.url and click.download');
  const page = await ctx.newPage();
  try {
    await page.goto(abs(cfg, fill(c.url, rep, day)), { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const loggedOut = async () => isLoginUrl(cfg, page.url()) || (await page.locator('input[type=password]:visible').count()) > 0;
    if (await loggedOut()) throw new LoginError();
    try {
      for (const step of c.steps || []) {
        if (step.fill) await page.locator(step.fill).first().fill(fill(step.value ?? '', rep, day));
        else if (step.select) await page.locator(step.select).first().selectOption(fill(step.value ?? '', rep, day));
        else if (step.press) await page.keyboard.press(step.press);
        else if (step.click) await page.locator(step.click).first().click();
        else if (step.wait) await page.waitForTimeout(step.wait);
        if (step.fill || step.select || step.click) await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      }
      const [dl] = await Promise.all([page.waitForEvent('download'), page.locator(c.download).first().click()]);
      const file = await dl.path();
      const buf = fs.readFileSync(file);
      checkNotAPage(cfg, buf, dl.url(), '');
      return buf;
    } catch (e) {
      /* Hype may have thrown us out halfway */
      if (!(e instanceof LoginError) && await loggedOut().catch(() => false)) throw new LoginError();
      throw e;
    }
  } finally {
    await page.close().catch(() => {});
  }
}

/* `login`: a window to sign in to Hype by hand. Returns when the window is closed. */
export async function loginWindow(cfg, dir) {
  const ctx = await openBrowser(cfg, dir, { headless: false });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(cfg.baseUrl).catch((e) => console.log('Could not open ' + cfg.baseUrl + ': ' + e.message));
  const timer = setInterval(() => saveCookies(ctx, dir), 3000);
  await new Promise((done) => ctx.on('close', done));
  clearInterval(timer);
}

/* `capture`: a window in which you press the export buttons yourself, while the script writes down what each
   button really did (address, method, what was sent, what came back) and keeps the files. Cookies and tokens
   are never written down, only the names of the headers. */
export async function captureWindow(cfg, dir, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const ctx = await openBrowser(cfg, dir, { headless: false });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const log = { baseUrl: cfg.baseUrl, started: new Date().toISOString(), downloads: [], requests: [] };
  const logFile = path.join(outDir, `capture-${stamp}.json`);
  const save = () => fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
  const secret = /^(cookie|authorization|x-csrf|x-xsrf|.*token.*)$/i;
  const describe = async (req, res) => {
    const headers = Object.fromEntries(Object.entries(req.headers()).map(([k, v]) => [k, secret.test(k) ? `(present, ${v.length} characters)` : v]));
    return {
      at: new Date().toISOString(), page: req.frame()?.page()?.url?.() ?? '', method: req.method(), url: req.url(), kind: req.resourceType(),
      sent: (req.postData() || '').slice(0, 4000), requestHeaders: headers,
      status: res?.status(), contentType: res?.headers()['content-type'] || '', contentDisposition: res?.headers()['content-disposition'] || '',
    };
  };
  ctx.on('response', async (res) => {
    try {
      const req = res.request(), kind = req.resourceType(), h = res.headers();
      const file = /attachment/i.test(h['content-disposition'] || '') || /csv|excel|spreadsheet|octet-stream/i.test(h['content-type'] || '');
      if (!file && !['xhr', 'fetch', 'document'].includes(kind)) return;
      if (!file && req.method() === 'GET' && kind === 'document' && !/export|csv|xls|download|report/i.test(req.url())) return;
      const entry = await describe(req, res);
      entry.looksLikeAFile = file;
      log.requests.push(entry);
      if (log.requests.length > 400) log.requests.shift();
      if (file) { console.log(`  file request: ${entry.method} ${entry.url}`); save(); }
    } catch { /* a page closed under us */ }
  });
  const watch = (page) => page.on('download', async (dl) => {
    const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${dl.suggestedFilename().replace(/[^\w.\-]+/g, '_')}`;
    await dl.saveAs(path.join(outDir, name)).catch(() => {});
    log.downloads.push({ at: new Date().toISOString(), page: page.url(), url: dl.url(), suggestedName: dl.suggestedFilename(), savedAs: name,
      note: dl.url().startsWith('blob:') || dl.url().startsWith('data:') ? 'the page built this file itself: the data came from one of the requests just before it' : '' });
    console.log(`  download: ${dl.suggestedFilename()}  <-  ${dl.url().slice(0, 150)}`);
    save();
  });
  ctx.pages().forEach(watch);
  ctx.on('page', watch);
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto(cfg.baseUrl).catch(() => {});
  await new Promise((done) => ctx.on('close', done));
  save();
  return logFile;
}
